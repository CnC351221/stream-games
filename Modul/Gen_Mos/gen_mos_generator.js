/**
 * ============================================
 *  УНИВЕРСАЛЬНЫЙ ГЕНЕРАТОР МОНСТРИКОВ
 *  Modul/Gen_Mos/gen_mos_generator.js
 * ============================================
 *  Общий модуль — используется несколькими играми.
 *  Подключение: <script src="/Modul/Gen_Mos/gen_mos_generator.js"></script>
 * ============================================
 */

// ========== ГЕНЕРАТОР ТЕЛА ==========
const BodyGenerator = {
    // Создает функцию генерации случайных чисел на основе сида
    _createRandom(seed) {
        let h = 0x811c9dc5;
        for (let i = 0; i < seed.length; i++) {
            h ^= seed.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return () => {
            h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
            h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
            return ((h ^= h >>> 16) >>> 0) / 0xffffffff;
        };
    },

    // Генерирует точки контура тела с учетом шума/искажений
    generateBodyPoints(props, rnd) {
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI;
            const jitter = (rnd() - 0.5) * props.noise;
            props.points.push({
                x: Math.sin(angle) * (props.size + jitter),
                y: -Math.cos(angle) * (props.size + jitter)
            });
        }
        // Применяем фильтр для сглаживания стыков
        this._applySmoothingFilter(props.points);
    },

    // Дополнительный фильтр: проверяет и исправляет острые углы в местах стыка (верх и низ)
    _applySmoothingFilter(points) {
        if (points.length < 3) return;

        // Обработка верхнего стыка
        const p0 = points[0];
        const p1 = points[1];
        const dy0 = Math.abs(p1.y - p0.y);
        const limit0 = p1.x * 0.1;
        if (dy0 > limit0) {
            p1.y = p0.y + (p1.y - p0.y) * (limit0 / dy0);
        }

        // Обработка нижнего стыка
        const last = points.length - 1;
        const pn = points[last];
        const pn1 = points[last - 1];
        const dyn = Math.abs(pn.y - pn1.y);
        const limitn = pn1.x * 0.1;
        if (dyn > limitn) {
            pn1.y = pn.y + (pn1.y - pn.y) * (limitn / dyn);
        }
    },

    /**
     * Прикрепляет уши/рога к определенным точкам кривой тела
     */
    drawIntegratedAppendages(ctx, body, props, colors) {
        const eRnd = this._createRandom(props.accessorySeed.toString());

        // Выбираем индекс 2 или 3 из точек тела
        const rootIdx = 2 + Math.floor(eRnd() * 2);
        const root = body.points[rootIdx];

        const length = 20 + eRnd() * 40;
        const width = 10 + eRnd() * 20;

        for (let side of [-1, 1]) {
            ctx.save();
            ctx.scale(side, 1);

            const peak = { x: root.x + eRnd() * length, y: root.y - eRnd() * length };
            const lobe = { x: root.x + width + eRnd() * width, y: root.y + eRnd() * 20 };
            const returnRoot = body.points[rootIdx + 1] || root;

            ctx.beginPath();
            ctx.moveTo(root.x, root.y);
            ctx.bezierCurveTo(peak.x, peak.y, lobe.x, lobe.y, returnRoot.x, returnRoot.y);

            ctx.fillStyle = colors.main;
            ctx.fill();
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = 5;
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Затенение внутренней части уха
            ctx.beginPath();
            ctx.moveTo(root.x + 3, root.y + 3);
            ctx.quadraticCurveTo(peak.x * 0.7, peak.y * 0.7, returnRoot.x - 3, returnRoot.y - 3);
            ctx.strokeStyle = colors.dark;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }
    },

    // Отрисовка основного контура тела по сгенерированным точкам
    drawBodyFromPoints(ctx, body, colors) {
        const pts = body.points;
        const last = pts.length - 1;

        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Начинаем сверху (центр)
        ctx.moveTo(0, pts[0].y);

        // Правая сторона
        for (let i = 0; i < last; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        }

        // Нижняя центральная точка
        ctx.lineTo(0, pts[last].y);

        // Левая сторона (зеркально)
        for (let i = last; i > 0; i--) {
            const p1 = pts[i];
            const p2 = pts[i - 1];
            ctx.quadraticCurveTo(-p1.x, p1.y, (-p1.x - p2.x) / 2, (p1.y + p2.y) / 2);
        }

        ctx.closePath();
        ctx.fillStyle = colors.main;
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 5;
        ctx.stroke();
    }
};

// ========== ГЕНЕРАТОР МОНСТРОВ ==========
const MonsterGenerator = {
    allowedEyeShapes: [0, 1, 2, 3, 4, 5, 6, 7],
    allowedPupilStyles: [0, 1, 2, 3, 4, 5, 6, 7],
    allowedMouthStyles: [0, 1, 2, 3, 4, 5, 6, 7],

    // Гармоничные цвета глаз
    eyeColors: [
        '#ffffff', // Default white
        '#8effc1', // Light Mint/Emerald
        '#7dd3fc', // Bright Sky
        '#fef08a', // Light Gold/Yellow
        '#fbcfe8', // Light Pink
        '#ddd6fe', // Light Lavender
        '#fda4af'  // Light Rose
    ],

    // ---- Конфигурация из настроек (изменяется через applySettings) ----
    _cfg: {
        allowedEyeShapes: [0, 1, 2, 3, 4, 5, 6, 7],
        allowedPupilStyles: [0, 1, 2, 3, 4, 5, 6, 7],
        allowedMouthStyles: [0, 1, 2, 3, 4, 5, 6, 7],
        colorfulEyes: false,      // true = всегда цветные глаза
        doubleEyesModes: [1, 2],   // [1]=всегда 1 глаз, [2]=всегда 2, [1,2]=рандом
        scale: 6                  // Масштабирование (размер спрайта)
    },

    // Применить настройку из UI-панели
    applySettings(key, value) {
        if (key in this._cfg) {
            this._cfg[key] = value;
            return;
        }
        switch (key) {
            case 'eyeShapes': this._cfg.allowedEyeShapes = value.length ? value : [0]; break;
            case 'pupils': this._cfg.allowedPupilStyles = value.length ? value : [0]; break;
            case 'mouths': this._cfg.allowedMouthStyles = value.length ? value : [0]; break;
            case 'colorfulEyes': this._cfg.colorfulEyes = value; break;
            case 'doubleEyes': this._cfg.doubleEyesModes = value.length ? value : [1]; break;
        }
    },

    generate(seed) {
        const scale = this._cfg.scale || 4;
        const canvas = document.createElement('canvas');
        // Базовый размер - 32 ед. Масштаб 4 дает 128px, Масштаб 8 даст 256px
        canvas.width = 32 * scale;
        canvas.height = 32 * scale;
        const ctx = canvas.getContext('2d');
        const rnd = this._createRandom(seed);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // Масштабируем отрисовку относительно базового размера 128
        const drawScale = (canvas.width / 128) * 0.75;
        ctx.scale(drawScale, drawScale);

        // 1. Тело
        const bodyProps = {
            noise: 8 + rnd() * 15,
            size: 42 + rnd() * 10,
            points: []
        };
        BodyGenerator.generateBodyPoints(bodyProps, rnd);

        // 2. Глаза: форма и цвет
        const shape = this._pickFromList(this._cfg.allowedEyeShapes, rnd);
        let eyeColor = this._cfg.colorfulEyes ? this._pickEyeColor(rnd) : '#ffffff';

        // 3. Количество глаз из настройки
        const modes = this._cfg.doubleEyesModes;
        let hasDoubleEyes;
        if (modes.length === 1) {
            hasDoubleEyes = modes[0] === 2;
        } else {
            hasDoubleEyes = rnd() > 0.2; // оба включены — рандом
        }

        const props = {
            hue: rnd() * 360,
            sat: 70 + rnd() * 30,
            eyeShape: shape,
            eyeColor: eyeColor,
            pupilStyle: this._pickFromList(this._cfg.allowedPupilStyles, rnd),
            pupilSize: 0.4 + rnd() * 0.4,
            mouthStyle: this._pickFromList(this._cfg.allowedMouthStyles, rnd),
            eyeSize: 8 + rnd() * 12,
            hasDoubleEyes: hasDoubleEyes,
            accessorySeed: rnd()
        };

        const colors = {
            main: `hsl(${props.hue}, ${props.sat}%, 60%)`,
            dark: `hsl(${props.hue}, ${props.sat}%, 35%)`,
            bright: `hsl(${props.hue}, ${props.sat}%, 85%)`,
            stroke: `hsl(${props.hue}, 90%, 15%)`
        };

        // 4. Рисуем
        BodyGenerator.drawIntegratedAppendages(ctx, bodyProps, props, colors);
        BodyGenerator.drawBodyFromPoints(ctx, bodyProps, colors);
        this._drawStylizedEyes(ctx, props, rnd, colors);
        this._drawNoisyMouth(ctx, props, rnd);

        ctx.restore();
        return canvas.toDataURL();
    },

    _createRandom(seed) {
        let h = 0x811c9dc5;
        for (let i = 0; i < seed.length; i++) {
            h ^= seed.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return () => {
            h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
            h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
            return ((h ^= h >>> 16) >>> 0) / 0xffffffff;
        };
    },

    _pickFromList(list, rnd) {
        if (!list || list.length === 0) return null;
        return list[Math.floor(rnd() * list.length)];
    },

    _pickEyeColor(rnd) {
        const idx = 1 + Math.floor(rnd() * (this.eyeColors.length - 1));
        return this.eyeColors[idx];
    },

    _drawStylizedEyes(ctx, props, rnd, colors) {
        const counts = props.hasDoubleEyes ? 2 : 1;
        const spacing = counts === 1 ? 0 : 15 + rnd() * 10;
        const eyeY = -12 + (rnd() - 0.5) * 10;

        for (let i = 0; i < counts; i++) {
            const side = counts === 1 ? 1 : (i === 0 ? -1 : 1);
            ctx.save();
            ctx.translate(spacing * side, eyeY);

            const r = props.eyeSize;

            ctx.fillStyle = props.eyeColor || 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            this._drawEyeShape(ctx, props.eyeShape, r);
            ctx.fill();
            ctx.stroke();
            ctx.clip();

            if (props.pupilStyle !== null) {
                ctx.fillStyle = 'black';
                this._drawPupilStyle(ctx, props.pupilStyle, r * props.pupilSize);
            }

            ctx.restore();
        }
    },

    _drawEyeShape(ctx, style, r) {
        ctx.beginPath();
        switch (style) {
            case 0: // Circle
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                break;
            case 1: // Square
                ctx.rect(-r, -r, r * 2, r * 2);
                break;
            case 2: // Angry - narrowed + centered
                ctx.save();
                ctx.scale(0.85, 1);
                ctx.arc(0, r * 1.6, r * 2, -Math.PI * 0.8, -Math.PI * 0.2);
                ctx.closePath();
                ctx.restore();
                break;
            case 3: // Octagon
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
                    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                ctx.closePath();
                break;
            case 4: // Horizontal Oval (Alien)
                ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
                break;
            case 5: // Pointy / Droplet
                ctx.moveTo(-r, 0);
                ctx.quadraticCurveTo(0, -r * 1.5, r, 0);
                ctx.quadraticCurveTo(0, r * 1.5, -r, 0);
                ctx.closePath();
                break;
            case 6: // Vertical Tall geometric
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
                    ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 1.2);
                }
                ctx.closePath();
                break;
            case 7: // Small Tall Angry
                const sr = r * 0.8;
                ctx.save();
                ctx.scale(0.8, 1.5);
                ctx.arc(0, sr * 1.6, sr * 2, -Math.PI * 0.8, -Math.PI * 0.2);
                ctx.closePath();
                ctx.restore();
                break;
        }
    },

    _drawPupilStyle(ctx, style, r) {
        ctx.beginPath();
        switch (style) {
            case 0: // Normal Dot
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 1: // Slit (Cat)
                ctx.ellipse(0, 0, r * 0.3, r, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 2: // Shine
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(-r / 3, -r / 3, r / 3, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 3: // Cross
                ctx.rect(-r, -r / 4, r * 2, r / 2);
                ctx.rect(-r / 4, -r, r / 2, r * 2);
                ctx.fill();
                break;
            case 4: // Target
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, r / 3, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 5: // Horizontal Slit (Goat)
                ctx.ellipse(0, 0, r, r * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 6: // Diamond (Reptile)
                ctx.moveTo(0, -r);
                ctx.lineTo(r * 0.7, 0);
                ctx.lineTo(0, r);
                ctx.lineTo(-r * 0.7, 0);
                ctx.closePath();
                ctx.fill();
                break;
            case 7: // Heart (Fantasy)
                const hr = r * 1.0;
                ctx.save();
                ctx.translate(0, -hr * 0.3);
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(hr / 2, -hr / 1.5, hr, 0, 0, hr);
                ctx.bezierCurveTo(-hr, 0, -hr / 2, -hr / 1.5, 0, 0);
                ctx.fill();
                ctx.restore();
                break;
        }
    },

    _drawCircleEye(ctx, r, pSize, color) {
        ctx.fillStyle = color || 'white';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.stroke();
        if (pSize > 0) {
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.arc(2, 2, r * pSize, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(-r / 3, -r / 3, r / 4, 0, Math.PI * 2); ctx.fill();
        }
    },

    _drawNoisyMouth(ctx, props, rnd) {
        ctx.save();
        ctx.translate(0, 15);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const w = 15 + rnd() * 15;
        ctx.beginPath();
        switch (props.mouthStyle) {
            case 0: ctx.arc(0, 0, w / 2, 0.2, Math.PI - 0.2); break;
            case 1: ctx.ellipse(0, 5, w / 3, w / 2, 0, 0, Math.PI * 2); break;
            case 2: ctx.moveTo(-w / 2, 0); for (let i = 1; i <= 4; i++) ctx.lineTo(-w / 2 + (i / 4) * w, (i % 2) * 5); break;
            case 3: ctx.bezierCurveTo(-w / 2, 0, 0, 10, w / 2, -5); break;
            case 4: ctx.arc(0, 0, w / 2, 0, Math.PI); ctx.stroke();
                ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(0, 5, w / 3, 0, Math.PI); ctx.fill(); break;
            case 5: ctx.moveTo(-w / 2, 5); ctx.lineTo(w / 2, 5); break;
            case 6: ctx.moveTo(-w / 2, 5);
                ctx.bezierCurveTo(-w / 4, -3, w / 4, 13, w / 2, 5); break;
            case 7: ctx.arc(0, 5, 4, 0, Math.PI * 2); break;
            default: ctx.arc(0, 0, w / 2, 0.2, Math.PI - 0.2); break;
        }
        ctx.stroke();
        ctx.restore();
    },

    getPartPreview(type, index) {
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.translate(20, 20);

        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;

        const r = 14;
        if (type === 'shape') {
            this._drawEyeShape(ctx, index, r);
            ctx.fill();
            ctx.stroke();
        } else if (type === 'pupil') {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.clip();
            ctx.fillStyle = 'black';
            this._drawPupilStyle(ctx, index, r * 0.6);
        } else if (type === 'mouth') {
            ctx.translate(0, -15);
            const fakeProps = { mouthStyle: index };
            const fakeRnd = () => 0.5;
            this._drawNoisyMouth(ctx, fakeProps, fakeRnd);
        }
        return canvas.toDataURL();
    }
};

// ========== ЭКСПОРТ ==========
window.BodyGenerator = BodyGenerator;
window.MonsterGenerator = MonsterGenerator;
window.Gen_MosGenerator = MonsterGenerator;
console.log('🧩 [Gen_Mos] Генератор монстриков загружен');
