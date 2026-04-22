/**
 * ============================================
 *  ГЕНЕРАТОР ГРИБОВ (Gen_Grb)
 *  Портировано с Godot Grb_gen
 * ============================================
 */

// Простая реализация шума (вместо FastNoiseLite)
const SimpleNoise = {
    _perm: new Uint8Array(512),
    _init() {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) this._perm[i] = p[i & 255];
    },
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
    lerp(t, a, b) { return a + t * (b - a); },
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.fade(x);
        const v = this.fade(y);
        const A = this._perm[X] + Y, AA = this._perm[A], AB = this._perm[A + 1];
        const B = this._perm[X + 1] + Y, BA = this._perm[B], BB = this._perm[B + 1];
        return this.lerp(v, this.lerp(u, this.grad(this._perm[AA], x, y),
            this.grad(this._perm[BA], x - 1, y)),
            this.lerp(u, this.grad(this._perm[AB], x, y - 1),
                this.grad(this._perm[BB], x - 1, y - 1)));
    }
};
SimpleNoise._init();

const Gen_GrbGenerator = {
    _cfg: {
        of_fill: 0.1,
        noise_gain: 0.5,
        color_noise: 0.1,
        n_steps: 4,
        birth: 5,
        death: 4,
        n_colors: 10,
        show_eyes: true,
        show_outline: true,
        scale: 6
    },

    applySettings(key, value) {
        if (key in this._cfg) {
            this._cfg[key] = value;
        }
    },

    _createRandom(seed) {
        let h = 0x811c9dc5;
        const s = seed.toString();
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return () => {
            h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
            h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
            return ((h ^= h >>> 16) >>> 0) / 0xffffffff;
        };
    },

    generate(seed) {
        const rnd = this._createRandom(seed);
        const size = { x: 45, y: 45 };

        // 1. Map Generation (MapGenerator.gd)
        let map = this._get_random_map(size, rnd);
        for (let i = 0; i < 2; i++) {
            this._random_walk(size, map, rnd);
        }

        // 2. Cellular Automata (CellularAutomata.gd)
        map = this._do_steps(map, this._cfg.n_steps, this._cfg.birth, this._cfg.death);

        // 3. Color Scheme (ColorSchemeGenerator.gd)
        const scheme_seed = Math.floor(rnd() * 1000000);
        const eye_scheme_seed = Math.floor(rnd() * 1000000);
        const colorscheme = this._generate_colorscheme(this._cfg.n_colors, scheme_seed, rnd);
        const eye_colorscheme = this._generate_colorscheme(this._cfg.n_colors, eye_scheme_seed, rnd);

        // 4. Flood Fill (ColorFiller.gd)
        const seed_shum1 = rnd();
        const seed_shum2 = rnd();
        const all_groups = this._fill_colors(map, colorscheme, eye_colorscheme, seed_shum1, seed_shum2, this._cfg.n_colors, this._cfg.show_outline);

        // 5. Rendering (GroupDrawer.gd & CellDrawer.gd)
        return this._draw_to_canvas(all_groups, size);
    },

    _get_random_map(size, rnd) {
        const map = Array.from({ length: size.x }, () => []);
        const halfX = size.x / 2;
        const centerY = size.y / 2;

        for (let x = 0; x < halfX; x++) {
            const arr = [];
            for (let y = 0; y < size.y; y++) {
                // Расстояние до центра (0..1)
                const dx = (halfX - x) / halfX; // 1 у краев, 0 у центра
                const dy = Math.abs(y - centerY) / centerY; // 1 у краев Y, 0 у центра
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Коэффициент затухания к краям (чем ближе к краю, тем выше порогrnd)
                const edgeFactor = Math.pow(Math.max(0, 1.0 - dist * 1.1), 0.5);

                // Добавляем турбулентность через шум (Noise Gain)
                const noiseVal = (SimpleNoise.noise(x * 0.2, y * 0.2) * this._cfg.noise_gain) * 1.5;

                let val = rnd() > (this._cfg.of_fill + (1.0 - edgeFactor) * 0.8 + noiseVal);

                // Осевая линия (ствол/центр) - всегда плотнее
                if (x > halfX - 4) {
                    if (rnd() * 0.5 > dy) val = true;
                }

                // Жесткий бордюр
                if (x < 1 || y < 1 || y > size.y - 2) val = false;

                arr.push(val);
            }
            map[Math.floor(x)] = [...arr];
            map[size.x - Math.floor(x) - 1] = [...arr];
        }
        return map;
    },

    _random_walk(size, map, rnd) {
        // Начинаем ближе к центру
        let pos = {
            x: Math.floor(rnd() * (size.x * 0.4)) + Math.floor(size.x * 0.3),
            y: Math.floor(rnd() * (size.y * 0.4)) + Math.floor(size.y * 0.3)
        };
        for (let i = 0; i < 100; i++) {
            this._set_at_pos(map, pos, true);
            this._set_at_pos(map, { x: size.x - pos.x - 1, y: pos.y }, true);
            pos.x += Math.floor(rnd() * 3) - 1;
            pos.y += Math.floor(rnd() * 3) - 1;

            // Удерживаем внутри безопасной зоны
            pos.x = Math.max(3, Math.min(size.x - 4, pos.x));
            pos.y = Math.max(3, Math.min(size.y - 4, pos.y));
        }
    },

    _set_at_pos(map, pos, val) {
        if (pos.x < 0 || pos.x >= map.length || pos.y < 0 || pos.y >= map[0].length) return false;
        map[Math.floor(pos.x)][Math.floor(pos.y)] = val;
        return true;
    },

    _do_steps(map, n_steps, birth, death) {
        let currentMap = map;
        for (let i = 0; i < n_steps; i++) {
            const nextMap = currentMap.map(col => [...col]);
            for (let x = 0; x < currentMap.length; x++) {
                for (let y = 0; y < currentMap[x].length; y++) {
                    const n = this._get_neighbours(currentMap, x, y);
                    if (currentMap[x][y] && n < death) nextMap[x][y] = false;
                    else if (!currentMap[x][y] && n > birth) nextMap[x][y] = true;
                }
            }
            currentMap = nextMap;
        }
        return currentMap;
    },

    _get_neighbours(map, x, y) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                if (this._get_at_pos(map, x + i, y + j)) count++;
            }
        }
        return count;
    },

    _get_at_pos(map, x, y) {
        if (x < 0 || x >= map.length || y < 0 || y >= map[0].length) return false;
        return map[x][y];
    },

    _generate_colorscheme(n_colors, seed, rnd) {
        const ng = this._cfg.color_noise;
        // Ported from ColorSchemeGenerator.gd
        const a = { x: rnd() * 0.5, y: rnd() * 0.5, z: rnd() * 0.5 };
        const b = { x: 0.1 + rnd() * 0.5, y: 0.1 + rnd() * 0.5, z: 0.1 + rnd() * 0.5 };
        const c = { x: (0.15 + rnd() * 0.65) * (1.0 + ng), y: (0.15 + rnd() * 0.65) * (1.0 + ng), z: (0.15 + rnd() * 0.65) * (1.0 + ng) };
        const d = { x: rnd() * (1.0 + ng), y: rnd() * (1.0 + ng), z: rnd() * (1.0 + ng) };

        const cols = [];
        const n = n_colors - 1;
        for (let i = 0; i < n_colors; i++) {
            const t = i / n;
            const r = (a.x + b.x * Math.cos(6.28318 * (c.x * t + d.x))) + t * 0.8;
            const g = (a.y + b.y * Math.cos(6.28318 * (c.y * t + d.y))) + t * 0.8;
            const bl = (a.z + b.z * Math.cos(6.28318 * (c.z * t + d.z))) + t * 0.8;
            cols.push(`rgb(${Math.floor(Math.max(0, Math.min(1, r)) * 255)}, ${Math.floor(Math.max(0, Math.min(1, g)) * 255)}, ${Math.floor(Math.max(0, Math.min(1, bl)) * 255)})`);
        }
        return cols;
    },

    _fill_colors(map, colorscheme, eye_colorscheme, s1, s2, n_colors, outline) {
        const groups = [];
        const negative_groups = [];

        // Flood fill logic ported from ColorFiller.gd
        groups.push(...this._flood_fill_internal(map, colorscheme, eye_colorscheme, n_colors, false, outline, s1, s2));

        const negMap = map.map(col => col.map(v => !v));
        negative_groups.push(...this._flood_fill_internal(negMap, colorscheme, eye_colorscheme, n_colors, true, outline, s1, s2));

        return { groups, negative_groups };
    },

    _flood_fill_internal(map, colorscheme, eye_colorscheme, n_colors, is_negative, outline, s1, s2) {
        const checked = map.map(col => col.map(() => false));
        const results = [];

        for (let x = 0; x < map.length; x++) {
            for (let y = 0; y < map[x].length; y++) {
                if (!checked[x][y] && map[x][y]) {
                    const group = { arr: [], valid: true };
                    const bucket = [{ x, y }];
                    checked[x][y] = true;

                    while (bucket.length > 0) {
                        const pos = bucket.pop();
                        const neighbors = [
                            { x: pos.x + 1, y: pos.y }, { x: pos.x - 1, y: pos.y },
                            { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 }
                        ];

                        const states = neighbors.map(n => {
                            if (n.x < 0 || n.x >= map.length || n.y < 0 || n.y >= map[0].length) {
                                if (is_negative) group.valid = false;
                                return null;
                            }
                            return map[n.x][n.y];
                        });

                        const color = this._get_cell_color(map, pos, is_negative, states, colorscheme, eye_colorscheme, n_colors, outline, group, s1, s2);
                        group.arr.push({ x: pos.x, y: pos.y, color });

                        neighbors.forEach((n, idx) => {
                            if (states[idx] === true && !checked[n.x][n.y]) {
                                checked[n.x][n.y] = true;
                                bucket.push(n);
                            }
                        });
                    }
                    results.push(group);
                }
            }
        }
        return results;
    },

    _get_cell_color(map, pos, is_negative, neighbors, colorscheme, eye_colorscheme, n_colors, outline, group, s1, s2) {
        const col_x = Math.abs(pos.x - (map.length - 1) * 0.5);
        const noiseMult = 1.0 + this._cfg.color_noise * 3.0;
        const noiseScale = 0.1 + this._cfg.color_noise * 0.3;
        let n = Math.abs(SimpleNoise.noise(col_x * noiseScale + s1 * 10, pos.y * noiseScale + s2 * 10)) * noiseMult;
        let n2 = Math.abs(SimpleNoise.noise(col_x * noiseScale + s2 * 10, pos.y * noiseScale + s1 * 10)) * noiseMult;

        // Neighbor effects
        if (!neighbors[2]) { // down
            if (is_negative) n2 -= 0.1; else n -= 0.45;
            n *= 0.8;
            if (outline) group.arr.push({ x: pos.x, y: pos.y + 1, color: 'rgb(0,0,0)' });
        }
        if (!neighbors[0]) { // right
            if (is_negative) n2 += 0.1; else n += 0.2;
            n *= 1.1;
            if (outline) group.arr.push({ x: pos.x + 1, y: pos.y, color: 'rgb(0,0,0)' });
        }
        if (!neighbors[3]) { // up
            if (is_negative) n2 += 0.15; else n += 0.45;
            n *= 1.2;
            if (outline) group.arr.push({ x: pos.x, y: pos.y - 1, color: 'rgb(0,0,0)' });
        }
        if (!neighbors[1]) { // left
            if (is_negative) n2 += 0.1; else n += 0.2;
            n *= 1.1;
            if (outline) group.arr.push({ x: pos.x - 1, y: pos.y, color: 'rgb(0,0,0)' });
        }

        n = Math.floor(Math.max(0, Math.min(1, n)) * (n_colors - 1));
        n2 = Math.floor(Math.max(0, Math.min(1, n2)) * (n_colors - 1));

        return is_negative ? eye_colorscheme[n2] : colorscheme[n];
    },

    _draw_to_canvas(all_groups, gridSize) {
        const padding = 4; // Padding in cells
        const canvas = document.createElement('canvas');
        const scale = this._cfg.scale;
        canvas.width = (gridSize.x + padding * 2) * scale;
        canvas.height = (gridSize.y + padding * 2) * scale;
        const ctx = canvas.getContext('2d');
        const offset = padding * scale;

        const largest = Math.max(...all_groups.groups.map(g => g.arr.length), 1);

        all_groups.groups.forEach(g => {
            if (g.arr.length >= largest * 0.25) {
                g.arr.forEach(cell => {
                    ctx.fillStyle = cell.color;
                    ctx.fillRect(offset + cell.x * scale, offset + cell.y * scale, scale, scale);
                });
            }
        });

        all_groups.negative_groups.forEach(g => {
            if (g.valid) {
                let touching = false;
                all_groups.groups.forEach(g2 => {
                    if (this._groups_touch(g.arr, g2.arr)) touching = true;
                });

                if (touching) {
                    const isEye = this._cfg.show_eyes && (g.arr.length + all_groups.negative_groups.length) % 5 >= 3;
                    const avg = { x: 0, y: 0 };
                    g.arr.forEach(c => { avg.x += c.x; avg.y += c.y; });
                    avg.x /= g.arr.length; avg.y /= g.arr.length;
                    const eyeCutoff = Math.sqrt(g.arr.length) * 0.3;

                    g.arr.forEach(cell => {
                        ctx.fillStyle = cell.color;
                        ctx.fillRect(offset + cell.x * scale, offset + cell.y * scale, scale, scale);
                        if (isEye) {
                            const dist = Math.sqrt((cell.x - avg.x) ** 2 + (cell.y - avg.y) ** 2);
                            if (dist < eyeCutoff) {
                                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                                ctx.fillRect(offset + cell.x * scale, offset + cell.y * scale, scale, scale);
                            }
                        }
                    });
                }
            }
        });

        return canvas.toDataURL();
    },

    _groups_touch(g1, g2) {
        for (let c1 of g1) {
            for (let c2 of g2) {
                if ((Math.abs(c1.x - c2.x) === 1 && c1.y === c2.y) || (Math.abs(c1.y - c2.y) === 1 && c1.x === c2.x)) return true;
            }
        }
        return false;
    }
};

window.Gen_GrbGenerator = Gen_GrbGenerator;
console.log('🧩 [Gen_Grb] Генератор грибов загружен');
