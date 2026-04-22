/**
 * KALMAPH — Улучшенная и стабилизированная версия MapH.
 * 
 * Особенности KalmapH:
 * 1. Повышенная стабильность шлейфа (захват 3x3).
 * 2. Мягкие правила исчезновения (шарик не пропадает, пока жива хотя бы одна база).
 * 3. Система "Наёмников" (Bot Helper) для помощи игрокам.
 * 4. Оптимизированный цикл отрисовки и очистки.
 */
'use strict';

const KalmapHGame = {
    // --- Системные переменные ---
    _socket: null,
    _animFrameId: null,
    _scoreInterval: null,
    _cleanupInterval: null,
    _restarting: false,

    // --- Звуки (ZzFX) ---
    _zzfxV: 0.1,
    _zzfxX: null,
    _soundConfig: { spawn: true, attack: true, hit: true, explosion: true, helper: true, capture: true, ui_click: true },

    _initAudio() {
        if (!this._zzfxX) {
            try { this._zzfxX = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
        }
    },

    zzfx(...args) {
        if (!this._zzfxX) return;
        if (this._zzfxX.state === 'suspended') this._zzfxX.resume();
        const play = (p = 1, k = .05, b = 220, e = 0, r = 0, t = .1, q = 0, D = 1, u = 0, y = 0, v = 0, z = 0, l = 0, E = 0, A = 0, F = 0, c = 0, w = 1, m = 0, B = 0) => {
            let M = Math, R = 44100, d = 2 * M.PI, G = u *= 500 * d / R / R, C = b *= (1 - k + 2 * k * M.random(k = [])) * d / R, g = 0, H = 0, a = 0, n = 1, I = 0, J = 0, f = 0, x, h;
            e = R * e + 9; m *= R; r *= R; t *= R; c *= R; y *= 500 * d / R ** 3; A *= d / R; v *= d / R; z *= R; l = R * l | 0;
            for (h = e + m + r + t + c | 0; a < h; k[a++] = f)
                ++J % (100 * F | 0) || (f = q ? 1 < q ? 2 < q ? 3 < q ? M.sin((g % d) ** 3) : M.max(M.min(M.tan(g), 1), -1) : 1 - (2 * g / d % 2 + 2) % 2 : 1 - 4 * M.abs(M.round(g / d) - g / d) : M.sin(g), f = (l ? 1 - B + B * M.sin(d * a / l) : 1) * (0 < f ? 1 : -1) * M.abs(f) ** D * p * this._zzfxV * (a < e ? a / e : a < e + m ? 1 - (a - e) / m * (1 - w) : a < e + m + r ? w : a < h - c ? (h - a - c) / t * w : 0), f = c ? f / 2 + (c > a ? 0 : (a < h - c ? 1 : (h - a) / c) * k[a - c | 0] / 2) : f), x = (b += u += y) * M.cos(A * H++), g += x - x * E * (1 - 1E9 * (M.sin(a) + 1) % 2), n && ++n > z && (b += v, C += v, n = 0), !l || ++I % l || (b = C, u = G, n = n || 1);
            p = this._zzfxX.createBuffer(1, h, R); p.getChannelData(0).set(k); b = this._zzfxX.createBufferSource(); b.buffer = p; b.connect(this._zzfxX.destination); b.start();
            return b;
        };
        return play(...args);
    },

    playSound(type) {
        const globalVol = parseInt(localStorage.getItem('sg-volume') || '50');
        this._zzfxV = (globalVol / 100) * 0.3;
        if (localStorage.getItem('sg-sound-enabled') === 'false' || this._zzfxV <= 0) return;
        if (!this._soundConfig[type]) return;
        this._initAudio();
        switch (type) {
            case 'spawn': this.zzfx(1.16, 0, 378, .02, .07, .25, 1, 1.87, 0, 0, 0, 0, 0, .4, 0, .1, 0, .79, .01); break;
            case 'attack': this.zzfx(1.5, 0.1, 600, 0, .05, .15, 1, 1.5, -5, 0, 0, 0, 0, 0, 0, 0, 0, .6, .1); break;
            case 'hit': this.zzfx(0.6, 0, 142, .05, .02, .03, 2, 1.38, 15, 0, 0, 0, 0, 19, 0, 0, .59, .01); break;
            case 'explosion': this.zzfx(2.11, 0, 61, .06, .15, .76, 4, 2.94, 22, 0, 0, 0, 0, .6, -0.1, 0, .04, .3, .09); break;
            case 'helper': this.zzfx(1, 0, 300, .01, .05, .1, 1, 1.5, 0, 0, 10, 0, 0, 0, 0, 0, .1, .5, .02); break;
            case 'capture': this.zzfx(1, 0, 754, 0, .04, .14, 1, 1.93, 0, 0, 32, .08, 0, 0, 0, .2, 0, .72, .07); break;
            case 'ui_click': this.zzfx(0.5, 0, 75, 0, .03, .01, 1, 1.67, 0, -5.4, 0, 0, 0, 0, .1, 0, 0, .12, .01); break;
        }
    },

    // --- Настройки и состояние ---
    _GRID_SIZE: 60, // Больше для читаемости цифр
    _BALL_RADIUS: 25, // Больше для аватаров
    _BASE_SIZE: 24,
    _BALL_SPEED_MULT: 0.1, // Скорость анимации перемещения
    _JOIN_COMMAND: '#go',
    _MAX_PLAYERS: 50,
    _SOLDIER_INTERVAL_SEC: 2,
    _SOLDIER_AMOUNT: 1,
    _soldierTick: 0,
    _USE_COLLISIONS: false,
    _USE_BALLS: true,
    _USE_BASES: false, // В этом режиме базы не нужны? Или как домики?
    _SHOW_GRID: true,
    _CELL_CAPACITY: 3, 
    _BG_COLOR: '#0d1117',
    _CAPTURE_RADIUS: 0, 
    _SHOW_BALLS_VISUAL: true,
    _ROUND_STATE: 'WAITING', // WAITING, THINKING, DANGER
    _roundTimer: 0,
    _dangerCells: new Set(),
    _safeCells: new Set(),

    _canvas: null,
    _ctx: null,
    _cols: 0,
    _rows: 0,
    _grid: [],
    _balls: [],
    _players: new Map(),
    _bases: [],
    _squads: [],
    _particles: [],
    _avatarCache: new Map(),
    _baseLobby: new Map(),
    _availableColors: [],
    _baseAvatarModule: 'Gen_Flag',
    _helperAvatarModule: 'Gen_Ava',

    _PALETTE: ['#00f2ff','#7000FF','#FF00D6','#ADFF00','#FF3E3E','#FFB800','#00FF66','#0066FF','#eab308','#ec4899','#10b981','#f97316','#22d3ee','#818cf8','#f472b6','#fbbf24','#34d399','#f87171','#a78bfa','#fb7185','#4ade80','#60a5fa','#facc15','#a855f7'],

    // --- Инициализация ---
    init(containers) {
        localStorage.setItem('sg-last-game', 'kalmaph');
        this._clearState();
        this._buildEditorWindow(containers.winEditor);
        this._buildStreamWindow(containers.winStream);
        this._buildInfoWindow(containers.winInfo);

        setTimeout(() => {
            this._initCanvas();
            this._setupListeners();
            this._startLoop();
            this._scoreInterval = setInterval(() => this._updateScores(), 1000);
            this._gameCycleInterval = setInterval(() => this._runGameCycle(), 1000);
            this._botInterval = setInterval(() => this._runBotLogic(), 3000);
        }, 50);
    },

    destroy() {
        if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
        if (this._scoreInterval) clearInterval(this._scoreInterval);
        if (this._gameCycleInterval) clearInterval(this._gameCycleInterval);
        if (this._botInterval) clearInterval(this._botInterval);
        if (this._socket) { this._socket.disconnect(); this._socket = null; }
    },

    _initCanvas() {
        const canvas = document.getElementById('kal-gameCanvas');
        const container = document.getElementById('kal-canvas-container');
        if (!canvas || !container) return;
        this._canvas = canvas; this._ctx = canvas.getContext('2d');
        const isObs = document.body.classList.contains('obs-mode');
        const mult = isObs ? 3.33 : 1;
        canvas.width = container.clientWidth / mult;
        canvas.height = container.clientHeight / mult;
        this._cols = Math.ceil(canvas.width / this._GRID_SIZE);
        this._rows = Math.ceil(canvas.height / this._GRID_SIZE);
        if (this._grid.length === 0) this._grid = Array.from({ length: this._rows }, () => new Array(this._cols).fill(null));
    },

    _buildStreamWindow(win) {
        win.style.cssText += 'padding:0;overflow:hidden;';
        win.innerHTML = `<div id="kal-canvas-container" style="width:100%;height:100%;position:relative;background:#050508;"><canvas id="kal-gameCanvas" style="display:block;"></canvas></div>`;
    },

    // --- Портированные окна из MapH с обновленными ID ---
    _buildEditorWindow(win) {
        win.innerHTML = `
        <div class="sidebar-content">
            <div class="editor-info-header">
                <button id="kal-btn-restart" class="editor-indicator" title="Начать сначала">KALMAPH</button>
                <div class="info-toggles">
                    <button id="kal-editor-toggle-1" class="info-toggle-btn active">🛠️</button>
                    <button id="kal-editor-toggle-2" class="info-toggle-btn">🖇️</button>
                </div>
            </div>
            <div id="kal-editor-tab-1" class="info-tab">
                <div class="editor-scroll-area">
                    <div class="settings-section">
                        <div class="section-title">▼ ГЕЙМПЛЕЙ</div>
                        <div class="control-grid-3">
                             <div class="control-box">
                                <span class="hint">Сетка</span>
                                <div class="val-row"><button id="kal-grid-minus">-</button><span id="kal-grid-val">5</span><button id="kal-grid-plus">+</button></div>
                             </div>
                             <div class="control-box">
                                <span class="hint">Скорость</span>
                                <div class="val-row"><button id="kal-speed-minus">-</button><span id="kal-speed-val">5</span><button id="kal-speed-plus">+</button></div>
                             </div>
                             <div class="control-box">
                                <span class="hint">Игроков</span>
                                <div class="val-row"><button id="kal-players-minus">-</button><span id="kal-players-val">15</span><button id="kal-players-plus">+</button></div>
                             </div>
                             <div class="control-box">
                                <span class="hint">Захват</span>
                                <div class="val-row"><button id="kal-capture-minus">-</button><span id="kal-capture-val">0</span><button id="kal-capture-plus">+</button></div>
                             </div>
                             <div class="control-box">
                                <span class="hint">Боты</span>
                                <div class="val-row"><button id="kal-btn-add-bot-test" style="width:100%; height:20px; font-size:0.6rem; padding:0;">+ БОТ</button></div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="kal-editor-tab-2" class="info-tab" style="display:none;">
                <div class="settings-section">
                    <div class="section-title">▼ МОДУЛИ</div>
                    <select id="kal-base-ava" class="sidebar-input"></select>
                    <select id="kal-help-ava" class="sidebar-input" style="margin-top:8px;"></select>
                </div>
            </div>
        </div>`;
    },

    _buildInfoWindow(win) {
        win.innerHTML = `
        <div class="sidebar-content">
            <div class="stream-info">
                <div class="live-indicator">STABLE</div>
                <div class="info-toggles">
                    <button id="kal-toggle-lb" class="info-toggle-btn active">🏆</button>
                    <button id="kal-toggle-chat" class="info-toggle-btn">🤖</button>
                </div>
            </div>
            <div id="kal-tab-lb" class="info-tab"><div id="kal-lb-list"></div></div>
            <div id="kal-tab-chat" class="info-tab" style="display:none;"><div id="kal-chat-box" class="chat-messages"></div></div>
            <div class="info-footer">
                <div class="simulation-row">
                    <input type="text" id="kal-inp-name" placeholder="Name" style="width:60px;">
                    <input type="text" id="kal-inp-cmd" placeholder="Command" style="flex:1;">
                    <button id="kal-btn-send">🚀</button>
                    <button id="kal-btn-bot" style="color:#a855f7;">🦾</button>
                </div>
            </div>
        </div>`;
    },

    _updateBall(b) {
        // Плавное движение к цели
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 1) {
            b.x += dx * 0.1;
            b.y += dy * 0.1;
        } else {
            b.x = b.tx;
            b.y = b.ty;
        }
    },

    _runGameCycle() {
        this._roundTimer--;
        if (this._roundTimer <= 0) {
            if (this._ROUND_STATE === 'WAITING' || this._ROUND_STATE === 'DANGER') {
                // Начинаем раздумья
                this._ROUND_STATE = 'THINKING';
                this._roundTimer = 3;
                this._dangerCells.clear();
                this._safeCells.clear();
            } else if (this._ROUND_STATE === 'THINKING') {
                // Начинаем опасность
                this._ROUND_STATE = 'DANGER';
                this._roundTimer = 3;
                
                // Рандомим красные и зеленые клетки
                const total = this._rows * this._cols;
                const indices = Array.from({length: total}, (_, i) => i + 1);
                for (let i = indices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indices[i], indices[j]] = [indices[j], indices[i]];
                }
                
                const half = Math.floor(total / 2);
                this._dangerCells = new Set(indices.slice(0, half));
                this._safeCells = new Set(indices.slice(half));
            }
        }
        
        // В конце фазы DANGER убиваем тех кто в красном
        if (this._ROUND_STATE === 'DANGER' && this._roundTimer === 0) {
            this._balls.forEach(b => {
                if (b.cellId && this._dangerCells.has(b.cellId)) {
                    b.isDead = true;
                }
            });
            this._balls = this._balls.filter(b => !b.isDead);
        }
    },

    _runBotLogic() {
        this._balls.forEach(b => {
            if (b.owner.startsWith('Bot_') && this._ROUND_STATE === 'THINKING') {
                if (Math.random() > 0.3) {
                    const randomCell = Math.floor(Math.random() * (this._rows * this._cols)) + 1;
                    this._movePlayerToCell(b.owner, randomCell);
                }
            }
        });
    },

    _drawGrid() {
        const ctx = this._ctx;
        ctx.font = '12px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let r = 0; r < this._rows; r++) {
            for (let c = 0; c < this._cols; c++) {
                const x = c * this._GRID_SIZE;
                const y = r * this._GRID_SIZE;
                const id = r * this._cols + c + 1;

                if (this._ROUND_STATE === 'DANGER') {
                    ctx.fillStyle = this._dangerCells.has(id) ? 'rgba(255,0,0,0.4)' : 'rgba(0,255,0,0.4)';
                    ctx.fillRect(x, y, this._GRID_SIZE, this._GRID_SIZE);
                }
                
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, this._GRID_SIZE, this._GRID_SIZE);
                
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillText(id, x + this._GRID_SIZE/2, y + this._GRID_SIZE/2);
            }
        }
        
        // Рисуем таймер и статус
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Outfit';
        ctx.textAlign = 'left';
        let statusText = this._ROUND_STATE === 'THINKING' ? "ВЫБИРАЙТЕ КЛЕТКУ!" : 
                         this._ROUND_STATE === 'DANGER' ? "ОПАСНОСТЬ!" : "ОЖИДАНИЕ...";
        ctx.fillText(`${statusText} [${this._roundTimer}с]`, 10, 25);
    },

    _drawBall(b) {
        const ctx = this._ctx;
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, this._BALL_RADIUS, 0, Math.PI * 2);
        ctx.clip();
        if (b.avatarImg && b.avatarImg.complete) {
            ctx.drawImage(b.avatarImg, b.x - this._BALL_RADIUS, b.y - this._BALL_RADIUS, this._BALL_RADIUS * 2, this._BALL_RADIUS * 2);
        } else {
            ctx.fillStyle = b.color;
            ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, this._BALL_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
    },

    _movePlayerToCell(u, id, avatarUrl) {
        if (!this._players.has(u)) {
            const spawned = this._spawnPlayer(u, avatarUrl);
            if (!spawned) return;
        }
        
        const r = Math.floor((id - 1) / this._cols);
        const c = (id - 1) % this._cols;
        
        // Проверка лимита 3 человека в клетке
        const playersInCell = this._balls.filter(b => b.cellId === id).length;
        if (playersInCell >= this._CELL_CAPACITY) return;

        const ball = this._balls.find(b => b.owner === u);
        if (ball) {
            ball.cellId = id;
            // Рассчитываем смещение внутри клетки (три позиции)
            let ox = 0, oy = 0;
            if (playersInCell === 1) { ox = -12; oy = 12; }
            else if (playersInCell === 2) { ox = 12; oy = 12; }
            
            ball.tx = c * this._GRID_SIZE + this._GRID_SIZE / 2 + ox;
            ball.ty = r * this._GRID_SIZE + this._GRID_SIZE / 2 + oy;
        }
    },

    async _spawnPlayer(name, avatarUrl = null) {
        if (this._balls.find(b => b.owner === name)) return false;
        
        const color = `hsl(${Math.random() * 360}, 70%, 60%)`;
        const img = new Image();
        img.src = avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${name}`;
        
        const ball = {
            owner: name,
            x: Math.random() * this._canvas.width,
            y: Math.random() * this._canvas.height,
            tx: Math.random() * this._canvas.width,
            ty: Math.random() * this._canvas.height,
            radius: this._BALL_RADIUS,
            color,
            avatarImg: img,
            cellId: null
        };
        this._balls.push(ball);
        this._players.set(name, { color });
        return true;
    },

    _startLoop() {
        const loop = () => {
            if (!this._ctx) return;
            const ctx = this._ctx;
            ctx.fillStyle = this._BG_COLOR; ctx.fillRect(0,0,this._canvas.width,this._canvas.height);
            this._drawGrid();
            this._balls.forEach(b => { this._updateBall(b); this._drawBall(b); });
            this._animFrameId = requestAnimationFrame(loop);
        };
        loop();
    },

    _clearState() {
        this._balls = []; this._players = new Map(); this._bases = []; this._grid = []; this._particles = []; this._avatarCache = new Map(); this._availableColors = [...this._PALETTE];
    },

    _updateScores() {
        const counts = this._balls.length;
        const list = document.getElementById('kal-lb-list'); 
        if (list) {
            list.innerHTML = `<div>Всего игроков: ${counts}</div>` + 
                this._balls.slice(0,10).map((b,i)=>`<div>#${i+1} ${b.owner} (Клетка ${b.cellId||'?'})</div>`).join('');
        }
    },

    _removePlayer(name) {
        const p = this._players.get(name); if(p) this._availableColors.push(p.color);
        this._players.delete(name); this._bases = this._bases.filter(b => b.owner !== name);
        for(let r=0; r<this._rows; r++) for(let c=0; c<this._cols; c++) if(this._grid[r][c] === name) this._grid[r][c] = null;
    },

    _removeBaseHelpers(bid) { this._balls = this._balls.filter(b => b.attachedToBaseId !== bid); },
    _getGenerator(id) { return window.MODUL_REGISTRY?.find(m=>m.id===id)?.generator; },
    _connectSocket() { if(window.io) { this._socket = io(); this._socket.on('tiktok-msg', d => this._processChat(d.user, d.text, d.avatar)); } },
    
    _processChat(u, t, a) { 
        const msg = t.trim().toLowerCase();
        if (msg === this._JOIN_COMMAND) {
            this._spawnPlayer(u, a);
            return;
        }

        // Если это число - перемещаем игрока
        const cellId = parseInt(msg);
        if (!isNaN(cellId) && cellId > 0 && cellId <= this._rows * this._cols) {
            this._movePlayerToCell(u, cellId, a);
        }
    },

    _movePlayerToCell(u, id, avatarUrl) {
        if (!this._players.has(u)) {
            this._spawnPlayer(u, avatarUrl);
        }
        
        const r = Math.floor((id - 1) / this._cols);
        const c = (id - 1) % this._cols;
        
        // Проверка лимита 3 человека в клетке
        const playersInCell = this._balls.filter(b => b.cellId === id).length;
        if (playersInCell >= this._CELL_CAPACITY) return;

        const ball = this._balls.find(b => b.owner === u);
        if (ball) {
            ball.cellId = id;
            // Рассчитываем смещение внутри клетки, чтобы они не перекрывались полностью
            const offsetIdx = playersInCell; 
            const offsetX = (offsetIdx % 2 === 0 ? -1 : 1) * 10;
            const offsetY = (offsetIdx > 0 ? 1 : -1) * 10;
            
            ball.tx = c * this._GRID_SIZE + this._GRID_SIZE / 2 + (offsetIdx === 0 ? 0 : offsetX);
            ball.ty = r * this._GRID_SIZE + this._GRID_SIZE / 2 + (offsetIdx === 0 ? 0 : offsetY);
        }
    },

    async _spawnPlayer(name, avatarUrl) {
        if (this._balls.find(b => b.owner === name)) return;
        
        const color = `hsl(${Math.random() * 360}, 70%, 60%)`;
        const img = new Image();
        img.src = avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${name}`;
        
        const ball = {
            owner: name,
            x: Math.random() * this._canvas.width,
            y: Math.random() * this._canvas.height,
            tx: Math.random() * this._canvas.width,
            ty: Math.random() * this._canvas.height,
            color,
            avatarImg: img,
            cellId: null
        };
        this._balls.push(ball);
        this._players.set(name, { color });
    },

    _setupListeners() {
        document.getElementById('kal-btn-send')?.addEventListener('click', () => {
            const n = document.getElementById('kal-inp-name').value || 'Tester';
            const t = document.getElementById('kal-inp-cmd').value;
            if(t) this._processChat(n,t);
        });
        document.getElementById('kal-btn-bot')?.addEventListener('click', () => {
             const n = document.getElementById('kal-inp-name').value;
             this._addBotHelper(n || null);
        });
        document.getElementById('kal-btn-restart')?.addEventListener('click', () => { this._clearState(); this._initCanvas(); });
        
        // Tabs
        document.getElementById('kal-editor-toggle-1')?.addEventListener('click', () => {
            document.getElementById('kal-editor-tab-1').style.display = 'block';
            document.getElementById('kal-editor-tab-2').style.display = 'none';
        });
        document.getElementById('kal-editor-toggle-2')?.addEventListener('click', () => {
            document.getElementById('kal-editor-tab-1').style.display = 'none';
            document.getElementById('kal-editor-tab-2').style.display = 'block';
        });

        // Capture Radius
        document.getElementById('kal-capture-minus')?.addEventListener('click', () => {
            if (this._CAPTURE_RADIUS > 0) {
                this._CAPTURE_RADIUS--;
                document.getElementById('kal-capture-val').textContent = this._CAPTURE_RADIUS;
            }
        });
        document.getElementById('kal-capture-plus')?.addEventListener('click', () => {
            if (this._CAPTURE_RADIUS < 5) {
                this._CAPTURE_RADIUS++;
                document.getElementById('kal-capture-val').textContent = this._CAPTURE_RADIUS;
            }
        });
        document.getElementById('kal-capture-val')?.addEventListener('click', () => {
            this._CAPTURE_RADIUS = 1;
            document.getElementById('kal-capture-val').textContent = this._CAPTURE_RADIUS;
        });

        // Speed
        document.getElementById('kal-speed-minus')?.addEventListener('click', () => {
            const val = Math.round(this._BALL_SPEED_MULT * 8);
            if (val > 1) {
                this._BALL_SPEED_MULT = (val - 1) / 8;
                document.getElementById('kal-speed-val').textContent = val - 1;
            }
        });
        document.getElementById('kal-speed-plus')?.addEventListener('click', () => {
            const val = Math.round(this._BALL_SPEED_MULT * 8);
            if (val < 15) {
                this._BALL_SPEED_MULT = (val + 1) / 8;
                document.getElementById('kal-speed-val').textContent = val + 1;
            }
        });
        document.getElementById('kal-speed-val')?.addEventListener('click', () => {
            this._BALL_SPEED_MULT = 5 / 8;
            document.getElementById('kal-speed-val').textContent = 5;
        });

        // Добавление ботов из редактора
        document.getElementById('kal-btn-add-bot-test')?.addEventListener('click', () => {
            this._addBotHelper();
            this.playSound('ui_click');
        });
    }
};

if (typeof GameShell !== 'undefined') GameShell.register('kalmaph', KalmapHGame);
