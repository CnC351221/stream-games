/**
 * MAPH — Игровой модуль (версия для новой оболочки)
 * Регистрируется в GameShell и заполняет 3 окна при вызове init()
 */
'use strict';

const MapHGame = {

    _socket: null,
    _animFrameId: null,
    _scoreInterval: null,
    _cleanupInterval: null,

    // Звуки (ZzFX)
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
        // Читаем глобальную громкость из оболочки (0-100) и масштабируем до 0.0 - 0.3 для ZzFX
        const globalVol = parseInt(localStorage.getItem('sg-volume') || '50');
        this._zzfxV = (globalVol / 100) * 0.3;

        // Если выключен звук глобально или через toggle
        const isSoundGlobalEnabled = localStorage.getItem('sg-sound-enabled') !== 'false';
        if (!isSoundGlobalEnabled || this._zzfxV <= 0) return;
        if (this._soundConfig && !this._soundConfig[type]) return;

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

    // Canvas и контекст
    _canvas: null,
    _ctx: null,

    // Состояние
    _GRID_SIZE: 5,
    _BALL_RADIUS: 10,
    _BASE_SIZE: 24,
    _BALL_SPEED_MULT: 0.625, // 5 / 8
    _JOIN_COMMAND: '#baza',
    _MAX_PLAYERS: 10,
    _SOLDIER_INTERVAL_SEC: 2,
    _SOLDIER_AMOUNT: 1,
    _soldierTick: 0,
    _USE_COLLISIONS: true,
    _USE_BALLS: true,
    _USE_BASES: true,
    _SHOW_GRID: false,
    _PER_BASE_PRODUCTION: true,
    _BASE_TERRITORY_RADIUS: 6,
    _BASE_HIT_RADIUS: 1,
    _SQUAD_RADIUS: 10,
    _SQUAD_SPEED_BASE: 1,
    _SQUAD_VISIBILITY: 0,
    _START_SOLDIERS: 10,
    _USE_DYNAMIC_START: true,
    _BG_COLOR: '#1d1a47',
    _CAPTURE_RADIUS: 1, // 1 = 3x3, 2 = 5x5, etc.
    _MAX_HELPERS_PER_BASE: 2,
    _SHOW_BALLS_VISUAL: true,
    _baseLobby: new Map(),
    _bases: [],
    _squads: [],
    _cols: 0,
    _rows: 0,
    _grid: [],
    _balls: [],
    _players: new Map(),
    _particles: [],
    _avatarCache: new Map(),
    _availableColors: [],
    _baseAvatarModule: 'Gen_Flag',
    _helperAvatarModule: 'Gen_Ava',

    _PALETTE: [
        '#00f2ff', '#7000FF', '#FF00D6', '#ADFF00',
        '#FF3E3E', '#FFB800', '#00FF66', '#0066FF',
        '#eab308', '#ec4899', '#10b981', '#f97316',
        '#22d3ee', '#818cf8', '#f472b6', '#fbbf24',
        '#34d399', '#f87171', '#a78bfa', '#fb7185',
        '#4ade80', '#60a5fa', '#facc15', '#a855f7'
    ],

    /**
     * Инициализация при выборе игры.
     */
    init(containers) {
        localStorage.setItem('sg-last-game', 'maph');

        // Сброс состояния
        this._balls = [];
        this._players = new Map();
        this._particles = [];
        this._avatarCache = new Map();
        this._grid = [];
        this._availableColors = [...this._PALETTE];
        this._baseLobby = new Map();

        // Строим HTML для 3 окон
        this._buildEditorWindow(containers.winEditor);
        this._buildStreamWindow(containers.winStream);
        this._buildInfoWindow(containers.winInfo);

        // Немного ждём, пока DOM соберётся
        setTimeout(() => {
            this._initCanvas();
            this._setupListeners();
            this._connectSocket();
            this._startLoop();

            this._scoreInterval = setInterval(() => this._updateScores(), 1000);
            this._cleanupInterval = setInterval(() => this._cleanupDisconnectedTerritories(), 2000);
            this._botBrainInterval = setInterval(() => this._runBotBrain(), 2000); // Мозг ботов раз в 2 сек
        }, 50);
    },

    /**
     * Уничтожаем всё при смене игры.
     */
    destroy() {
        if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
        if (this._scoreInterval) clearInterval(this._scoreInterval);
        if (this._cleanupInterval) clearInterval(this._cleanupInterval);
        if (this._botBrainInterval) clearInterval(this._botBrainInterval);
        if (this._socket) { this._socket.disconnect(); this._socket = null; }
        this._animFrameId = null;
    },

    /**
     * Настройки для боковой панели.
     */
    getSettings() {
        return null;
    },

    // ─── HTML ОКОН ───────────────────────────────────────────────────────────

    _buildEditorWindow(win) {
        win.innerHTML = `
        <div class="sidebar-content">
            <div class="editor-info-header">
                <button id="mh-btn-restart" class="editor-indicator" style="cursor:pointer; border:none; transition:all 0.2s; outline:none; font-family:inherit;" title="Начать сначала (5 сек)">EDITOR</button>
                <div class="info-toggles">
                    <button id="mh-editor-toggle-1" class="info-toggle-btn active" title="Настройки">🛠️</button>
                    <button id="mh-editor-toggle-2" class="info-toggle-btn" title="Компоненты">🖇️</button>
                </div>
            </div>

            <!-- TAB 1: SETTINGS -->
            <div id="mh-editor-tab-1" class="info-tab">
                <div class="editor-scroll-area">
                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ Основной</div>
                        <div style="display:flex; align-items:stretch; gap:4px;">
                            <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                <span class="hint" style="font-size:0.75rem; text-align:center;">Размер сетки</span>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button id="mh-grid-size-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 2">-</button>
                                    <div id="mh-grid-size-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 5">5</div>
                                    <button id="mh-grid-size-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 30">+</button>
                                </div>
                            </div>
                            <div class="control-group" style="flex:0 0 55px; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                <div style="position:relative; width:100%; height:14px;">
                                    <input type="color" id="mh-bg-color-editor" value="#1d1a47" style="position:absolute; width:100%; height:100%; opacity:0; cursor:pointer; z-index:2;">
                                    <div id="mh-bg-color-preview" style="width:100%; height:100%; border:1px solid rgba(255,255,255,0.2); border-radius:3px; background:#1d1a47;"></div>
                                </div>
                                <button id="mh-grid-toggle-editor" class="value-button" style="width:100%; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;">🥅⛔</button>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ Игра</div>
                        <div style="display:flex; align-items:stretch; gap:4px;">
                            <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                <span class="hint" style="font-size:0.75rem; text-align:center;">Макс. игроков</span>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button id="mh-max-players-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 1">-</button>
                                    <div id="mh-max-players-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; white-space:nowrap; font-size:0.85rem; font-weight:bold;" title="Сбросить до 10">👥 10</div>
                                    <button id="mh-max-players-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 20">+</button>
                                </div>
                            </div>
                            <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                <span class="hint" style="font-size:0.75rem; text-align:center;">Помощников на базу</span>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button id="mh-max-helpers-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 0">-</button>
                                    <div id="mh-max-helpers-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; white-space:nowrap; font-size:0.85rem; font-weight:bold;" title="Сбросить до 2">🦾 2</div>
                                    <button id="mh-max-helpers-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 10">+</button>
                                </div>
                            </div>
                            <div class="control-group" style="flex:0 0 55px; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; gap:4px; min-height:65px;" id="mh-game-btn-container">
                                <button id="mh-base-toggle-editor" class="value-button active-val" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;" title="Показывать домики?">🏠✅</button>
                                <button id="mh-balls-visible-editor" class="value-button active-val" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;" title="Показывать шарики?">🏐✅</button>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ Размер</div>
                        <div style="display:flex; align-items:stretch; gap:4px;">
                            <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                <span class="hint" style="font-size:0.75rem; text-align:center;">Размер базы</span>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button id="mh-base-size-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 5">-</button>
                                    <div id="mh-base-size-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 24">24</div>
                                    <button id="mh-base-size-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 60">+</button>
                                </div>
                            </div>
                            <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                <span class="hint" style="font-size:0.75rem; text-align:center;">Размер шарика</span>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button id="mh-ball-radius-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 5">-</button>
                                    <div id="mh-ball-radius-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 10">10</div>
                                    <button id="mh-ball-radius-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 50">+</button>
                                </div>
                            </div>
                            <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                <span class="hint" style="font-size:0.75rem; text-align:center;">Размер отряда</span>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button id="mh-squad-radius-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 2">-</button>
                                    <div id="mh-squad-radius-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 10">10</div>
                                    <button id="mh-squad-radius-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 15">+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ База</div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; align-items:stretch; gap:4px;">
                                <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                    <span class="hint" style="font-size:0.75rem; text-align:center;">Основание базы</span>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <button id="mh-base-hit-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Уменьшить">-</button>
                                        <div id="mh-base-hit-val" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 1">🧱 1</div>
                                        <button id="mh-base-hit-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Увеличить">+</button>
                                    </div>
                                </div>
                                <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                    <span class="hint" style="font-size:0.75rem; text-align:center;">Территория базы</span>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <button id="mh-base-territory-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Уменьшить территорию">-</button>
                                        <div id="mh-base-territory-val" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 6">🗺️ 6</div>
                                        <button id="mh-base-territory-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Увеличить территорию">+</button>
                                    </div>
                                </div>
                                <div class="control-group" style="flex:0 0 55px; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;" id="mh-base-extra-btn-container">
                                    <button id="mh-dynamic-start-toggle-editor" class="value-button active-val" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;" title="Динамический старт (среднее по базам)">🛡️✅</button>
                                    <button id="mh-start-soldiers-btn" class="value-button" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0; font-weight:bold;" title="Начальные войска">🛡️ 10</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ Шарик</div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; align-items:stretch; gap:4px;">
                                <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                    <span class="hint" style="font-size:0.75rem; text-align:center;">Прирост солдат</span>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <div id="mh-soldier-interval-btn" class="value-button" style="flex:1; min-width:0; height:32px; padding:0; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Клик: изменить интервал">⏱️ 2</div>
                                        <div id="mh-soldier-reset-btn" class="value-button" style="flex:0.6; min-width:0; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.85rem;" title="Сбросить прирост">=</div>
                                        <div id="mh-soldier-amount-btn" class="value-button" style="flex:1; min-width:0; height:32px; padding:0; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Клик: изменить количество">⚔️ 1</div>
                                    </div>
                                </div>
                                 <div class="control-group" style="flex:0 0 55px; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                    <button id="mh-prod-toggle-editor" class="value-button active-val" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;" title="Прирост: ✅ Каждая / ⛔ По очереди">🪇✅</button>
                                    <button id="mh-balls-toggle-editor" class="value-button active-val" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;" title="Включить/Выключить шары">⚽✅</button>
                                </div>
                                <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                    <span class="hint" style="font-size:0.75rem; text-align:center;">Захват (пикс)</span>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <button id="mh-capture-radius-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Уменьшить">-</button>
                                        <div id="mh-capture-radius-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="0=1пкс, 1=5пкс(➕), 3=9пкс(⬛), 4=13пкс(💠)">1</div>
                                        <button id="mh-capture-radius-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Увеличить">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ Скорость</div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; align-items:stretch; gap:4px;">
                                <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                    <span class="hint" style="font-size:0.75rem; text-align:center;">Скорость шаров</span>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <button id="mh-speed-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 1">-</button>
                                        <div id="mh-speed-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 5">5</div>
                                        <button id="mh-speed-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 15">+</button>
                                    </div>
                                </div>
                                <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;">
                                    <span class="hint" style="font-size:0.75rem; text-align:center;">Скорость атаки</span>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <button id="mh-squad-speed-minus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Минимум: 0.2">-</button>
                                        <div id="mh-squad-speed-val-editor" class="value-button" style="flex:1; min-width:0; padding-left:2px; padding-right:2px; height:32px; cursor:pointer; border-color:transparent; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold;" title="Сбросить до 1">1</div>
                                        <button id="mh-squad-speed-plus" class="value-button" style="flex:1; min-width:0; padding:0; height:32px; display:flex; align-items:center; justify-content:center; font-size:0.85rem;" title="Максимум: 5">+</button>
                                    </div>
                                </div>
                                <div class="control-group" style="flex:0 0 55px; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:65px;" id="mh-speed-extra-btn-container">
                                    <button id="mh-squad-amount-toggle-editor" class="value-button active-val" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;" title="Отображение количества солдат (числа) в отряде: Всегда / Никогда / В чужой зоне / В нейтральной и чужой">☄️✅</button>
                                    <button id="mh-collision-toggle-editor" class="value-button active-val" style="width:100%; flex:1; display:flex; align-items:center; justify-content:center; font-size:0.85rem; padding:0;" title="Включить/Выключить столкновения">🥁✅</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ Команды и Наёмники</div>
                        <div style="display:flex; gap:4px;">
                            <div class="control-group" style="flex:1; margin:0; background:rgba(255,255,255,0.03); border-radius:8px; padding:4px; min-height:50px;">
                                <span class="hint" style="font-size:0.6rem; margin-bottom:4px; display:block; text-align:center;">Команда входа</span>
                                <input type="text" id="mh-join-cmd-input-editor" value="${this._JOIN_COMMAND}" class="sidebar-input" style="width:100%; height:28px; box-sizing:border-box; font-size:0.75rem;">
                            </div>
                        </div>
                    </div>

                    <div class="settings-section" style="padding:8px; margin-bottom:12px;">
                        <div class="section-title" style="margin-bottom:2px; font-size:0.75rem; cursor:pointer; user-select:none;" onclick="const t=this.nextElementSibling; t.style.display=t.style.display==='none'?'flex':'none'; this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼')">▼ Звук (ZzFX)</div>
                        <div style="display:flex; flex-wrap:wrap; gap:4px;">
                                <button id="mh-snd-spawn" class="value-button" style="flex:1; min-width:30%; height:28px; font-size:0.75rem; padding:0; display:flex; align-items:center; justify-content:center;" title="Появление игрока">🚀✅</button>
                                <button id="mh-snd-attack" class="value-button" style="flex:1; min-width:30%; height:28px; font-size:0.75rem; padding:0; display:flex; align-items:center; justify-content:center;" title="Вылет отряда">⚔️✅</button>
                                <button id="mh-snd-hit" class="value-button" style="flex:1; min-width:30%; height:28px; font-size:0.75rem; padding:0; display:flex; align-items:center; justify-content:center;" title="Столкновение">💥✅</button>
                                <button id="mh-snd-capture" class="value-button" style="flex:1; min-width:30%; height:28px; font-size:0.75rem; padding:0; display:flex; align-items:center; justify-content:center;" title="Захват базы">🚩✅</button>
                                <button id="mh-snd-explosion" class="value-button" style="flex:1; min-width:30%; height:28px; font-size:0.75rem; padding:0; display:flex; align-items:center; justify-content:center;" title="Уничтожение игрока">☠️✅</button>
                                <button id="mh-snd-helper" class="value-button" style="flex:1; min-width:30%; height:28px; font-size:0.75rem; padding:0; display:flex; align-items:center; justify-content:center;" title="Вход наёмника">🦾✅</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 2: COMPONENTS -->
            <div id="mh-editor-tab-2" class="info-tab" style="display:none;">
                <div class="editor-scroll-area">
                    <div class="settings-section" style="padding:8px;">
                        <div class="section-title" style="margin-bottom:4px; cursor:pointer; user-select:none;" onclick="
                            const ch = Array.from(this.parentElement.children).slice(1);
                            const hide = ch[0].style.display !== 'none';
                            ch.forEach(c => c.style.display = hide ? 'none' : 'block');
                            this.innerText = this.innerText.startsWith('▼') ? this.innerText.replace('▼','▶') : this.innerText.replace('▶','▼');
                        ">▼ Связи с модулями</div>
                        
                        <div class="control-group" style="margin-bottom:15px; background:rgba(255,255,255,0.03); padding:4px; border-radius:8px; display:block;">
                            <span class="hint" style="display:block; margin-bottom:6px; color:var(--accent);">🤖 Аватары баз (игроки)</span>
                            <select id="mh-comp-base-ava" class="sidebar-input" style="width:100%; height:32px; background:#2a2438; border:1px solid rgba(255,255,255,0.1); color:white;"></select>
                            <span class="hint" style="font-size:0.6rem; margin-top:4px; opacity:0.5;">Модуль для генерации аватаров основных игроков</span>
                        </div>

                        <div class="control-group" style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                            <span class="hint" style="display:block; margin-bottom:6px; color:var(--accent);">🦾 Аватары помощников</span>
                            <select id="mh-comp-helper-ava" class="sidebar-input" style="width:100%; height:32px; background:#2a2438; border:1px solid rgba(255,255,255,0.1); color:white;"></select>
                            <span class="hint" style="font-size:0.6rem; margin-top:4px; opacity:0.5;">Модуль для генерации аватаров наёмников базы</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    _buildStreamWindow(win) {
        win.style.cssText += 'padding:0;overflow:hidden;';
        win.innerHTML = `
        <div id="mh-canvas-container" style="width:100%;height:100%;position:relative;background:#050508;">
            <canvas id="mh-gameCanvas" style="display:block;"></canvas>
        </div>`;
    },

    _buildInfoWindow(win) {
        win.innerHTML = `
        <div class="sidebar-content">
            <div class="stream-info">
                <div class="live-indicator">INFO</div>
                <div class="info-toggles">
                    <button id="mh-toggle-1" class="info-toggle-btn active" title="Рейтинг">🏆</button>
                    <button id="mh-toggle-2" class="info-toggle-btn" title="Боты">🤖</button>
                </div>
            </div>

            <div id="mh-tab-leaderboard" class="info-tab">
                <div class="leaderboard-block">
                    <div class="leaderboard-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>🏆 ТОП ЗАХВАТЧИКОВ</span>
                        <button id="mh-dock-leaderboard-btn" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin:0; padding:0; line-height:1; filter:grayscale(1); transition:0.2s;" title="Открепить в отдельное плавающее окно (для OBS)">📌</button>
                    </div>
                    <div id="mh-leaderboard-list"></div>
                </div>
            </div>
            
            <div id="mh-tab-chat" class="info-tab" style="display:none;">
                <div class="leaderboard-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>💬 СОБЫТИЯ И ЧАТ</span>
                    <button id="mh-dock-chat-btn" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin:0; padding:0; line-height:1; filter:grayscale(1); transition:0.2s;" title="Открепить бегущую строку в плавающее окно (для OBS)">📌</button>
                </div>
                <div id="mh-chat-messages" class="chat-messages">
                </div>
            </div>

            <div class="info-footer" style="margin-top:auto; padding-top:14px; margin-top:14px; border-top:1px solid rgba(255,255,255,0.1);">
                <div class="simulation-row" style="display:flex; gap:4px; align-items:center; width:100%;">
                    <div style="position:relative; width:70px; flex-shrink:0;">
                        <input type="text" id="mh-info-name" placeholder="Имя" style="width:100%; padding-right:16px; font-size:0.75rem; height:32px; box-sizing:border-box;">
                        <button id="mh-info-pick-player" style="position:absolute; right:2px; top:50%; transform:translateY(-50%); background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; padding:0; font-size:0.75rem; z-index:10;">👤</button>
                        <div id="mh-info-player-list" style="display:none; position:absolute; bottom:100%; left:0; width:110px; background:#2a2438; border:1px solid rgba(255,255,255,0.1); border-radius:4px; max-height:150px; overflow-y:auto; z-index:100; box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>
                    </div>
                    <div style="position:relative; flex:1; min-width:60px;">
                        <input type="text" id="mh-info-input" placeholder="Команда" style="width:100%; padding-right:16px; font-size:0.75rem; height:32px; box-sizing:border-box;">
                        <button id="mh-info-pick-cmd" style="position:absolute; right:2px; top:50%; transform:translateY(-50%); background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; padding:0; font-size:0.75rem; z-index:10;">⚡</button>
                        <div id="mh-info-cmd-list" style="display:none; position:absolute; bottom:100%; left:0; width:140px; background:#2a2438; border:1px solid rgba(255,255,255,0.1); border-radius:4px; max-height:150px; overflow-y:auto; z-index:100; box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>
                    </div>
                    <div style="display:flex; gap:4px; flex-shrink:0;">
                        <button id="mh-info-send" style="width:40px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-sizing:border-box;" title="Отправить">🚀</button>
                        <button id="mh-info-random" class="auto-find-btn" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-sizing:border-box;" title="Добавить бота-игрока (LVL 1)">🤖</button>
                        <button id="mh-info-bot-helper" class="auto-find-btn" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-sizing:border-box; color: #a855f7; border-color: rgba(168, 85, 247, 0.4);" title="Добавить бота-наёмника (к базе или нику)">🦾</button>
                    </div>
                </div>
                <div style="display:flex; gap:2px; margin-top:4px;">
                    <button id="mh-bot-lvl-1" class="value-button" style="flex:1; height:24px; font-size:0.65rem; padding:0;" title="Бот 1 уровня (Новичок)">L1</button>
                    <button id="mh-bot-lvl-2" class="value-button" style="flex:1; height:24px; font-size:0.65rem; padding:0;" title="Бот 2 уровня (Агрессор)">L2</button>
                    <button id="mh-bot-lvl-3" class="value-button" style="flex:1; height:24px; font-size:0.65rem; padding:0;" title="Бот 3 уровня (Стратег)">L3</button>
                    <button id="mh-bot-lvl-4" class="value-button" style="flex:1; height:24px; font-size:0.65rem; padding:0;" title="Бот 4 уровня (Элита)">L4</button>
                    <button id="mh-bot-lvl-5" class="value-button" style="flex:1; height:24px; font-size:0.65rem; padding:0;" title="Бот 5 уровня (Безумный)">L5</button>
                </div>
            </div>
        </div>`;
    },

    // ─── ИГРОВАЯ МЕХАНИКА ────────────────────────────────────────────────────

    _initCanvas() {
        const canvas = document.getElementById('mh-gameCanvas');
        const container = document.getElementById('mh-canvas-container');
        if (!canvas || !container) return;

        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        // Вычисляем множитель режима стрима (OBS), если он активен
        // Мы используем тот же коэффициент 3.3, что и в main_app.js
        const isObs = document.body.classList.contains('obs-mode');
        const multiplier = isObs ? 3.3 : 1;

        // Устанавливаем внутреннее разрешение холста.
        // Мы делим реальный размер контейнера на множитель, чтобы логическое
        // разрешение всегда было основано на базовых 420px ширины.
        // Таким образом, клетки по 10px будут визуально крупными в режиме стрима.
        canvas.width = container.clientWidth / multiplier;
        canvas.height = container.clientHeight / multiplier;

        const newCols = Math.ceil(canvas.width / this._GRID_SIZE);
        const newRows = Math.ceil(canvas.height / this._GRID_SIZE);

        // Создаем сетку только если размеры реально изменились или сетка пуста
        if (newCols !== this._cols || newRows !== this._rows || this._grid.length === 0) {
            this._cols = newCols;
            this._rows = newRows;
            this._grid = [];
            for (let i = 0; i < this._rows; i++) {
                this._grid[i] = new Array(this._cols).fill(null);
            }
        }
    },

    _resolveCollision(b1, b2) {
        const dx = b2.x - b1.x, dy = b2.y - b1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) return; // Защита от деления на ноль при совпадении позиций
        if (dist < b1.radius + b2.radius) {
            for (let i = 0; i < 3; i++) {
                this._particles.push({ x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2, color: b1.color, dx: (Math.random() - 0.5) * 8, dy: (Math.random() - 0.5) * 8, life: 1.0, size: Math.random() * 2 + 1 });
            }
            const overlap = (b1.radius + b2.radius - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            b1.x -= nx * overlap; b1.y -= ny * overlap;
            b2.x += nx * overlap; b2.y += ny * overlap;
            const v1n = b1.dx * nx + b1.dy * ny;
            const v2n = b2.dx * nx + b2.dy * ny;
            b1.dx += (v2n - v1n) * nx; b1.dy += (v2n - v1n) * ny;
            b2.dx += (v1n - v2n) * nx; b2.dy += (v1n - v2n) * ny;

            const player = this._players.get(b1.owner);
            const targetSpeed1 = 3 + (player ? player.bonusSpeed : 0);
            const player2 = this._players.get(b2.owner);
            const targetSpeed2 = 3 + (player2 ? player2.bonusSpeed : 0);

            const s1 = Math.sqrt(b1.dx * b1.dx + b1.dy * b1.dy);
            const s2 = Math.sqrt(b2.dx * b2.dx + b2.dy * b2.dy);
            // Защита от NaN: если скорость 0, задаём случайное направление
            if (s1 < 0.01) {
                const a = Math.random() * Math.PI * 2;
                b1.dx = Math.cos(a) * targetSpeed1; b1.dy = Math.sin(a) * targetSpeed1;
            } else {
                b1.dx = (b1.dx / s1) * targetSpeed1; b1.dy = (b1.dy / s1) * targetSpeed1;
            }
            if (s2 < 0.01) {
                const a = Math.random() * Math.PI * 2;
                b2.dx = Math.cos(a) * targetSpeed2; b2.dy = Math.sin(a) * targetSpeed2;
            } else {
                b2.dx = (b2.dx / s2) * targetSpeed2; b2.dy = (b2.dy / s2) * targetSpeed2;
            }
        }
    },

    async _getAvatarImage(name, avatarUrl = null) {
        if (this._avatarCache.has(name)) return this._avatarCache.get(name);

        return new Promise((resolve) => {
            const tryGenerator = () => {
                const gen = this._getGenerator(this._baseAvatarModule);
                if (gen && gen.generate) {
                    const dataUrl = gen.generate(name);
                    const mImg = new Image();
                    mImg.onload = () => { this._avatarCache.set(name, mImg); resolve(mImg); };
                    mImg.src = dataUrl;
                } else {
                    resolve(null);
                }
            };

            if (!avatarUrl) { tryGenerator(); return; }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { this._avatarCache.set(name, img); resolve(img); };
            img.onerror = () => tryGenerator();
            img.src = avatarUrl;
        });
    },

    _getGenerator(id) {
        if (!window.MODUL_REGISTRY) return null;
        const mod = window.MODUL_REGISTRY.find(m => m.id === id);
        return mod ? mod.generator : null;
    },

    async _spawnPlayer(name, avatarUrl = null, aiLevel = 0) {
        if (this._players.has(name)) return;
        
        // Считаем только владельцев государств (не наёмников)
        const ownersCount = [...this._players.values()].filter(p => !p.isHelper).length;
        if (ownersCount >= this._MAX_PLAYERS) return;

        const color = this._availableColors.shift();
        if (!color) return;

        // 1. Выбираем уникальную букву для игрока
        const takenLetters = [...this._players.values()].map(p => p.letter).filter(l => l);
        let playerLetter = (name || "X").charAt(0).toUpperCase();
        if (!/^[A-Z]$/.test(playerLetter) || takenLetters.includes(playerLetter)) {
            const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const freeAlpha = [...alpha].filter(l => !takenLetters.includes(l));
            playerLetter = freeAlpha[Math.floor(Math.random() * freeAlpha.length)] || 'X';
        }

        console.log(`[MapH] Спавним игрока: ${name} (Буква: ${playerLetter})`);
        this._players.set(name, {
            color,
            score: 0,
            avatar: avatarUrl,
            avatarModule: this._baseAvatarModule, // Запоминаем текущий модуль
            letter: playerLetter,
            bonusSpeed: 0,
            lastMessages: [],
            decayTick: 0,
            aiLevel: aiLevel, // 0 = Человек, 1-5 = Бот
            lastAiTick: 0,
            isHelper: false
        });

        // 2. Находим свободный номер для первой базы игрока (обычно 1)
        const playerBases = this._bases.filter(b => b.owner === name);
        const existingNums = playerBases.map(b => parseInt(b.baseId.substring(1)) || 0);
        let nextNum = 1;
        while (existingNums.includes(nextNum)) nextNum++;
        const baseId = playerLetter + nextNum;

        const avatarImg = await this._getAvatarImage(name, avatarUrl);
        if (!this._players.has(name)) return;

        const canvas = this._canvas;
        if (!canvas) return;

        // Ищем место для базы, чтобы начальные круги не пересекались
        let x, y, r, c;
        let attempts = 0;
        let found = false;
        const margin = 50;
        const minDistancePx = 15 * this._GRID_SIZE; // Минимум 15 клеток между центрами баз

        while (!found && attempts < 50) {
            x = margin + Math.random() * (canvas.width - margin * 2);
            y = margin + Math.random() * (canvas.height - margin * 2);
            r = Math.floor(y / this._GRID_SIZE);
            c = Math.floor(x / this._GRID_SIZE);

            found = true;
            // Проверяем расстояние до всех других баз
            for (const b of this._bases) {
                const bx = b.c * this._GRID_SIZE;
                const by = b.r * this._GRID_SIZE;
                const dist = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
                if (dist < minDistancePx) {
                    found = false;
                    break;
                }
            }
            attempts++;
        }

        // Закрашиваем круглую территорию вокруг базы при появлении
        const radiusCells = this._BASE_TERRITORY_RADIUS;
        for (let dr = -radiusCells; dr <= radiusCells; dr++) {
            for (let dc = -radiusCells; dc <= radiusCells; dc++) {
                if (dr * dr + dc * dc <= radiusCells * radiusCells) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols) {
                        this._grid[nr][nc] = name;
                    }
                }
            }
        }

        const angle = Math.random() * Math.PI * 2;
        const speed = 3; // Фиксированная базовая скорость

        if (this._USE_BALLS) {
            const ball = { x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, radius: this._BALL_RADIUS, color, owner: name, avatarImg, mass: 1, score: 0 };
            this._balls.push(ball);
        }

        // Рассчитываем начальные войска
        let startSoldiers = this._START_SOLDIERS;
        if (this._USE_DYNAMIC_START && this._bases.length > 0) {
            const totalS = this._bases.reduce((sum, b) => sum + b.soldiers, 0);
            startSoldiers = Math.floor(totalS / this._bases.length);
        }

        // Создаем первую базу
        this._bases.push({
            r, c,
            owner: name,
            soldiers: startSoldiers,
            baseId,
            color
        });

        this._addChatMessage(name, 'основал государство!');
        this.playSound('spawn');

        // Эффект вспышки при появлении
        for (let i = 0; i < 20; i++) {
            this._particles.push({
                x, y, color,
                dx: (Math.random() - 0.5) * 15,
                dy: (Math.random() - 0.5) * 15,
                life: 1.5, size: Math.random() * 3 + 2
            });
        }
    },

    /**
     * Добавляет наёмника-бота.
     * Если targetOwner указан - ищет его базу с вакансией.
     * Если нет - ищет любую базу с вакансией.
     */
    _addBotHelper(targetOwner = null) {
        let vacancyBases = [];
        if (targetOwner) {
            vacancyBases = this._bases.filter(b => b.owner === targetOwner);
        } else {
            vacancyBases = [...this._bases];
        }

        // Фильтруем базы, где еще есть место для помощников
        vacancyBases = vacancyBases.filter(b => {
            const currentCount = this._balls.filter(ball => ball.attachedToBaseId === b.baseId).length;
            return currentCount < this._MAX_HELPERS_PER_BASE;
        });

        if (vacancyBases.length === 0) {
            console.log("[MapH] Нет свободных вакансий для ботов-наёмников");
            return;
        }

        // Выбираем случайную базу из подходящих
        const targetBase = vacancyBases[Math.floor(Math.random() * vacancyBases.length)];
        const owner = targetBase.owner;
        const botName = "Bot_" + Math.random().toString(36).substr(2, 4).toUpperCase();

        // Регистрируем "игрока-бота" (наёмника)
        if (!this._players.has(botName)) {
            this._players.set(botName, {
                color: targetBase.color,
                letter: '?',
                bonusSpeed: 3, // Боты чуть быстрее
                lastMessages: [],
                decayTick: 0,
                avatarModule: this._helperAvatarModule,
                isHelper: true
            });
        }

        // Подготавливаем аватар
        const img = new Image();
        const gen = this._getGenerator(this._helperAvatarModule);
        if (gen && gen.generate) {
            img.src = gen.generate(botName);
        } else {
            img.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${botName}`;
        }
        this._avatarCache.set(botName, img);

        // Спауним шар
        const x = targetBase.c * this._GRID_SIZE + this._GRID_SIZE / 2;
        const y = targetBase.r * this._GRID_SIZE + this._GRID_SIZE / 2;

        this._balls.push({
            owner: botName,
            parentOwner: owner,
            attachedToBaseId: targetBase.baseId,
            baseR: targetBase.r,
            baseC: targetBase.c,
            x, y,
            dx: (Math.random() - 0.5) * 5,
            dy: (Math.random() - 0.5) * 5,
            radius: this._BALL_RADIUS,
            color: targetBase.color,
            avatarImg: img
        });

        this._addChatMessage(botName, `(BOT) нанят защищать базу ${targetBase.baseId}!`);
        this.playSound('helper');
    },

    _handleAttack(sender, fromId, amount, toId) {
        const sourceBase = this._bases.find(b => b.baseId === fromId && b.owner === sender);
        const targetBase = this._bases.find(b => b.baseId === toId);

        if (!sourceBase) return; // База не найдена или не принадлежит игроку
        if (!targetBase) return; // Цель не найдена
        if (sourceBase === targetBase) return; // Нельзя атаковать себя

        const actualAmount = Math.min(amount, sourceBase.soldiers);
        if (actualAmount <= 0) return;

        sourceBase.soldiers -= actualAmount;

        const playerBall = this._balls.find(b => b.owner === sender);

        // Создаем отряд
        this._squads.push({
            id: Math.random().toString(36).substr(2, 9),
            x: sourceBase.c * this._GRID_SIZE + this._GRID_SIZE / 2,
            y: sourceBase.r * this._GRID_SIZE + this._GRID_SIZE / 2,
            targetBase: targetBase,
            amount: actualAmount,
            owner: sender,
            color: sourceBase.color,
            avatarImg: playerBall ? playerBall.avatarImg : this._avatarCache.get(sender),
            baseLetter: fromId.charAt(0), // Запоминаем букву базы (S, D и т.д.)
            speed: 2, // Базовая скорость (будет пересчитана в update)
            battleTimer: 0,
            targetSquadId: null
        });

        this.playSound('attack');
    },

    _updateSquads() {
        for (let i = this._squads.length - 1; i >= 0; i--) {
            const s = this._squads[i];

            // Если отряд в битве
            if (s.battleTimer > 0) {
                if (s.targetBallObj) {
                    if (!this._balls.includes(s.targetBallObj)) {
                        s.battleTimer = 0;
                        s.targetBallObj = null;
                        continue;
                    }
                    s.battleTimer--;
                    s.targetBallObj.battleTimer = s.battleTimer;

                    if (s.battleTimer % 15 === 0) this.playSound('hit');

                    if (Math.random() > 0.7) {
                        this._particles.push({
                            x: (s.x + s.targetBallObj.x) / 2, y: (s.y + s.targetBallObj.y) / 2,
                            color: Math.random() > 0.5 ? s.color : s.targetBallObj.color,
                            dx: (Math.random() - 0.5) * 10, dy: (Math.random() - 0.5) * 10,
                            life: 0.8, size: Math.random() * 2 + 1
                        });
                    }

                    if (s.battleTimer <= 0) {
                        const ball = s.targetBallObj;
                        ball.battleTimer = 0;
                        ball.dx = -ball.dx + (Math.random() - 0.5);
                        ball.dy = -ball.dy + (Math.random() - 0.5);
                        if (ball.dx === 0 && ball.dy === 0) { ball.dx = 1; ball.dy = 1; }

                        this._squads.splice(i, 1);
                    }
                    continue;
                }

                const other = this._squads.find(os => os.id === s.targetSquadId);
                if (!other) {
                    s.battleTimer = 0;
                    s.targetSquadId = null;
                    continue;
                }

                // Чтобы не уменьшать таймер дважды за один кадр, 
                // пусть это делает только отряд с "меньшим" ID
                if (s.id < other.id) {
                    s.battleTimer--;
                    other.battleTimer = s.battleTimer;

                    // Звук ударов во время боя каждые ~0.25 сек (15 кадров)
                    if (s.battleTimer % 15 === 0) {
                        this.playSound('hit');
                    }
                }

                // Эффект искр во время битвы
                if (Math.random() > 0.7) {
                    this._particles.push({
                        x: (s.x + other.x) / 2, y: (s.y + other.y) / 2,
                        color: Math.random() > 0.5 ? s.color : other.color,
                        dx: (Math.random() - 0.5) * 10, dy: (Math.random() - 0.5) * 10,
                        life: 0.8, size: Math.random() * 2 + 1
                    });
                }

                if (s.battleTimer <= 0) {
                    const sAmount = s.amount;
                    const oAmount = other.amount;

                    if (sAmount > oAmount) {
                        // S победил
                        s.amount = sAmount - oAmount;
                        s.targetSquadId = null;
                        // Удаляем Other
                        const oIdx = this._squads.indexOf(other);
                        if (oIdx > -1) this._squads.splice(oIdx, 1);
                        // Если oIdx был меньше i, нужно уменьшить i
                        if (oIdx > -1 && oIdx < i) i--;
                    } else if (oAmount > sAmount) {
                        // Other победил
                        other.amount = oAmount - sAmount;
                        other.targetSquadId = null;
                        other.battleTimer = 0;
                        // Удаляем S
                        this._squads.splice(i, 1);
                        continue;
                    } else {
                        // Ничья
                        const oIdx = this._squads.indexOf(other);
                        if (oIdx > -1) this._squads.splice(oIdx, 1);
                        if (oIdx > -1 && oIdx < i) i--;
                        this._squads.splice(i, 1);
                        continue;
                    }
                }
                continue;
            }

            // Ищем столкновение с ДРУГИМИ отрядами
            let merged = false;
            for (let j = 0; j < this._squads.length; j++) {
                if (j === i) continue;
                const s2 = this._squads[j];
                const distSq = (s.x - s2.x) ** 2 + (s.y - s2.y) ** 2;
                const collideDist = this._SQUAD_RADIUS * 2;
                if (distSq < collideDist * collideDist) {
                    if (s.owner === s2.owner) {
                        // СЛИЯНИЕ с союзными отрядами
                        s2.amount += s.amount;
                        this._squads.splice(i, 1);
                        merged = true;
                        break;
                    } else if (s2.battleTimer === 0) {
                        // НАЧАЛО БИТВЫ с врагом
                        this.playSound('hit');
                        s.battleTimer = 120; // 2 сек
                        s.targetSquadId = s2.id;
                        s2.battleTimer = 120;
                        s2.targetSquadId = s.id;
                        break;
                    }
                }
            }
            if (merged) continue;

            // Столкновение солдат с чужим шариком (если включено в настройках)
            if (this._USE_COLLISIONS && s.battleTimer === 0) {
                for (let j = 0; j < this._balls.length; j++) {
                    const ball = this._balls[j];
                    const targetOwner = ball.parentOwner || ball.owner;
                    if (s.owner !== targetOwner && !ball.battleTimer) {
                        const distSq = (s.x - ball.x) ** 2 + (s.y - ball.y) ** 2;
                        const collideDist = this._SQUAD_RADIUS + ball.radius;
                        if (distSq < collideDist * collideDist) {
                            this.playSound('hit');
                            s.battleTimer = 120;
                            s.targetBallObj = ball;
                            ball.battleTimer = 120;
                            break;
                        }
                    }
                }
            }

            if (s.battleTimer > 0) continue;

            const tx = s.targetBase.c * this._GRID_SIZE + this._GRID_SIZE / 2;
            const ty = s.targetBase.r * this._GRID_SIZE + this._GRID_SIZE / 2;

            const dx = tx - s.x;
            const dy = ty - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
                // Прибыли!
                this._resolveAttack(s);
                this._squads.splice(i, 1);
            } else {
                // Определяем скорость в зависимости от территории и настроек атаки
                const r = Math.floor(s.y / this._GRID_SIZE);
                const c = Math.floor(s.x / this._GRID_SIZE);

                // Используем новую переменную _SQUAD_SPEED_BASE
                const baseSpeed = this._SQUAD_SPEED_BASE;
                let currentSpeed = baseSpeed * 0.5; // На чужой — 50%

                if (r >= 0 && r < this._rows && c >= 0 && c < this._cols) {
                    if (this._grid[r][c] === s.owner) {
                        currentSpeed = baseSpeed; // На своей — 100%
                    }
                }

                s.x += (dx / dist) * currentSpeed;
                s.y += (dy / dist) * currentSpeed;
            }
        }
    },

    _processChat(sender, text, avatarUrl = null) {
        const cleanText = text.trim().toLowerCase();

        // Команды выхода
        if (cleanText === '#выход' || cleanText === '#exit' || cleanText === '#reset') {
            if (this._players.has(sender)) {
                this._removePlayer(sender);
                return;
            }
        }

        const cleanTextForParsing = text.trim(); // Сохраняем регистр для ID баз и кодов

        // Парсим команду: #ID#COUNT#ID или #ID#CODE
        if (cleanText.startsWith('#')) {
            const parts = cleanText.split('#').filter(p => p);

            // #ID#COUNT#ID (Атака)
            if (parts.length === 3) {
                const fromId = parts[0].toUpperCase();
                const amount = parseInt(parts[1]);
                const toId = parts[2].toUpperCase();
                if (!isNaN(amount) && amount > 0) {
                    this._handleAttack(sender, fromId, amount, toId);
                    return;
                }
            }

            // #ID#CODE (Найм помощника)
            if (parts.length === 2) {
                const baseId = parts[0].toUpperCase();
                const code = parts[1];
                const targetBase = this._bases.find(b => b.baseId === baseId);

                if (targetBase) {
                    let lobby = this._baseLobby.get(baseId) || [];

                    // Проверяем лимит помощников
                    const currentHelpers = this._balls.filter(b => b.attachedToBaseId === baseId).length;
                    if (currentHelpers >= this._MAX_HELPERS_PER_BASE) return;

                    // Ищем первое совпадение кода (FIFO - первый написавший)
                    const matchIndex = lobby.findIndex(entry => entry.code === code && entry.pendingUser !== sender);

                    if (matchIndex !== -1) {
                        const lobbyEntry = lobby[matchIndex];
                        const owner = targetBase.owner;
                        const user1 = lobbyEntry.pendingUser;
                        const user2 = sender;

                        // Сделка, если один из двоих - владелец
                        if (user1 === owner || user2 === owner) {
                            const helper = (user1 === owner) ? user2 : user1;
                            const helperAvatarUrl = (user1 === owner) ? avatarUrl : (lobbyEntry.avatarUrl || null);

                            // Регистрируем игрока
                            if (!this._players.has(helper)) {
                                this._players.set(helper, { 
                                    color: targetBase.color, 
                                    letter: '?', 
                                    bonusSpeed: 0, 
                                    lastMessages: [], 
                                    decayTick: 0,
                                    avatarModule: this._helperAvatarModule // Запоминаем модуль для наёмника
                                });
                            }
                            if (!this._avatarCache.has(helper)) {
                                const img = new Image();
                                const gen = this._getGenerator(this._helperAvatarModule);
                                if (gen && gen.generate) {
                                    img.src = helperAvatarUrl || gen.generate(helper);
                                } else {
                                    img.src = helperAvatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${helper}`;
                                }
                                this._avatarCache.set(helper, img);
                            }

                            // Spawn ball
                            this._balls = this._balls.filter(b => b.owner !== helper);
                            const x = targetBase.c * this._GRID_SIZE + this._GRID_SIZE / 2;
                            const y = targetBase.r * this._GRID_SIZE + this._GRID_SIZE / 2;
                            this._balls.push({
                                owner: helper, parentOwner: owner, attachedToBaseId: baseId,
                                baseR: targetBase.r, baseC: targetBase.c,
                                x, y, dx: (Math.random() - 0.5) * 5, dy: (Math.random() - 0.5) * 5,
                                radius: this._BALL_RADIUS, color: targetBase.color,
                                avatarImg: this._avatarCache.get(helper)
                            });

                            // Сделка совершена -> Код больше недействителен (удаляем ВСЕ записи с этим кодом для этой базы)
                            const newLobby = lobby.filter(e => e.code !== code);
                            this._baseLobby.set(baseId, newLobby);

                            this._addChatMessage(helper, `нанят в базу ${baseId}!`);
                            this.playSound('helper');
                            return;
                        }
                    }

                    // Если совпадений нет, просто встаем в очередь
                    lobby.push({ code, pendingUser: sender, avatarUrl });
                    this._baseLobby.set(baseId, lobby);

                    if (targetBase.owner === sender) {
                        this._addChatMessage(sender, `открыл вакансию в базе ${baseId}!`);
                    } else {
                        // Не спамим сильно, если игрок просто пишет код
                        // Но можно добавить микро-эффект или подтверждение
                    }
                    return;
                }
            }
        }

        // Механика ускорения за сообщения в чате
        const player = this._players.get(sender);
        if (player) {
            if (!player.lastMessages.includes(cleanText)) {
                // Добавляем +1 к скорости, максимум +5
                player.bonusSpeed = Math.min(5, player.bonusSpeed + 1);

                // Запоминаем последние 3 сообщения
                player.lastMessages.push(cleanText);
                if (player.lastMessages.length > 3) player.lastMessages.shift();

                console.log(`[MapH] ${sender} получил ускорение! Бонус: +${player.bonusSpeed}`);
            }
        }

        // Команда входа
        if (cleanText.toLowerCase() === this._JOIN_COMMAND.toLowerCase()) {
            this._spawnPlayer(sender, avatarUrl);
        }
    },

    _resolveAttack(squad) {
        const target = squad.targetBase;
        if (target.owner === squad.owner) {
            // Подкрепление своим
            target.soldiers += squad.amount;
            target.flashColor = '#00ff00'; // Зеленый для своих
            target.flashTimer = 20;
        } else {
            // АТАКА
            const oldOwner = target.owner;
            target.flashColor = '#ff0000'; // Красный для врагов
            target.flashTimer = 20;

            if (squad.amount > target.soldiers) {
                // ЗАХВАТ!
                const oldOwner = target.owner;

                // Стандартная логика (остаток отряда)
                target.soldiers = squad.amount - target.soldiers;

                target.owner = squad.owner;
                target.color = squad.color;

                // Удаляем наёмников, которые были привязаны к этой базе
                this._removeBaseHelpers(target.baseId);
                // Очищаем лобби кодов для этой базы
                this._baseLobby.delete(target.baseId);

                // При захвате создаем "плацдарм" — круглую территорию вокруг базы
                const radiusCells = 6;
                for (let dr = -radiusCells; dr <= radiusCells; dr++) {
                    for (let dc = -radiusCells; dc <= radiusCells; dc++) {
                        if (dr * dr + dc * dc <= radiusCells * radiusCells) {
                            const nr = target.r + dr;
                            const nc = target.c + dc;
                            if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols) {
                                this._grid[nr][nc] = squad.owner;
                            }
                        }
                    }
                }

                // Переименовываем базу (находим самую маленькую свободную цифру)
                const playerInfo = this._players.get(squad.owner);
                const pLetter = playerInfo ? playerInfo.letter : (squad.baseLetter || 'X');

                const currentBases = this._bases.filter(b => b.owner === squad.owner);
                const busyNums = currentBases.map(b => parseInt(b.baseId.substring(1)) || 0);
                let bestNum = 1;
                while (busyNums.includes(bestNum)) bestNum++;

                target.baseId = pLetter + bestNum;

                this._addChatMessage(squad.owner, `захватил базу ${target.baseId}!`);
                this.playSound('capture');

                // Если у прошлого владельца не осталось баз — он проиграл
                if (oldOwner) {
                    const remainingBases = this._bases.filter(b => b.owner === oldOwner);
                    if (remainingBases.length === 0) {
                        this._removePlayer(oldOwner);
                    }
                }
            } else {
                // УРОН
                target.soldiers -= squad.amount;
                if (target.soldiers < 0) target.soldiers = 0;
            }
        }
    },

    /**
     * Удаляет всех помощников, привязанных к конкретной базе
     */
    _removeBaseHelpers(baseId) {
        const helpers = this._balls.filter(b => b.attachedToBaseId === baseId);
        helpers.forEach(h => {
            // Взрыв помощника
            for (let i = 0; i < 15; i++) {
                this._particles.push({
                    x: h.x, y: h.y, color: h.color,
                    dx: (Math.random() - 0.5) * 15,
                    dy: (Math.random() - 0.5) * 15,
                    life: 1.0, size: Math.random() * 3 + 1
                });
            }
            this._addChatMessage(h.owner, `потерял базу-опору ${baseId} и взорвался!`);
        });
        this._balls = this._balls.filter(b => b.attachedToBaseId !== baseId);
    },

    _removePlayer(name) {
        const player = this._players.get(name);
        if (player && player.color) {
            this._availableColors.push(player.color);
        }

        // Очищаем сетку от территории этого игрока
        for (let r = 0; r < this._rows; r++) {
            for (let c = 0; c < this._cols; c++) {
                if (this._grid[r][c] === name) {
                    this._grid[r][c] = null;
                }
            }
        }

        // Взрыв при потере ВСЕХ баз или шара? 
        // В этой версии удаляем если шар пропал (или если все базы захвачены)
        const victimBall = this._balls.find(b => b.owner === name);
        const playerBases = this._bases.filter(b => b.owner === name);

        const sx = victimBall ? victimBall.x : (this._canvas.width / 2);
        const sy = victimBall ? victimBall.y : (this._canvas.height / 2);

        this._balls = this._balls.filter(b => b.owner !== name);
        this._bases = this._bases.filter(b => b.owner !== name);
        this._players.delete(name);

        for (let i = 0; i < 40; i++) {
            this._particles.push({
                x: sx, y: sy, color: player.color || '#fff',
                dx: (Math.random() - 0.5) * 20,
                dy: (Math.random() - 0.5) * 20,
                life: 2.0, size: Math.random() * 4 + 2
            });
        }

        // Сообщаем в чат и обновляем списки
        this._addChatMessage(name, 'государство пало...');
        this.playSound('explosion');
        this._updateScores();
    },

    _updateBall(ball) {
        if (ball.battleTimer > 0) return;

        const player = this._players.get(ball.owner);
        const targetSpeed = 3 + (player ? player.bonusSpeed : 0);
        const targetOwner = ball.parentOwner || ball.owner;

        // Защита от NaN: если координаты стали NaN — сбрасываем в центр
        if (isNaN(ball.x) || isNaN(ball.y) || isNaN(ball.dx) || isNaN(ball.dy)) {
            ball.x = this._canvas ? this._canvas.width / 2 : 200;
            ball.y = this._canvas ? this._canvas.height / 2 : 200;
            const angle = Math.random() * Math.PI * 2;
            ball.dx = Math.cos(angle) * targetSpeed;
            ball.dy = Math.sin(angle) * targetSpeed;
        }

        // Принудительно корректируем магнитуду скорости под текущий бонус каждый кадр
        const currentMag = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        if (currentMag < 0.01) {
            // Скорость ноль — задаём случайное направление, чтобы избежать деления на 0
            const angle = Math.random() * Math.PI * 2;
            ball.dx = Math.cos(angle) * targetSpeed;
            ball.dy = Math.sin(angle) * targetSpeed;
        } else if (Math.abs(currentMag - targetSpeed) > 0.01) {
            ball.dx = (ball.dx / currentMag) * targetSpeed;
            ball.dy = (ball.dy / currentMag) * targetSpeed;
        }

        let nx = ball.x + ball.dx * this._BALL_SPEED_MULT;
        let ny = ball.y + ball.dy * this._BALL_SPEED_MULT;

        const canvas = this._canvas;
        if (nx + ball.radius > canvas.width || nx - ball.radius < 0) {
            ball.dx = -ball.dx;
            nx = ball.x;
        }
        if (ny + ball.radius > canvas.height || ny - ball.radius < 0) {
            ball.dy = -ball.dy;
            ny = ball.y;
        }

        const nc = Math.floor(nx / this._GRID_SIZE);
        const nr = Math.floor(ny / this._GRID_SIZE);
        ball.radius = this._BALL_RADIUS;

        if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols) {
            const cellOwner = this._grid[nr][nc];
            if (cellOwner !== targetOwner) {
                // Прямой захват территории шариком
                this._grid[nr][nc] = targetOwner;

                // ПРОВЕРКА: База теперь конфигурируемого размера (круглая форма/плюсик)
                const baseUnder = this._bases.find(b => {
                    const dr = b.r - nr;
                    const dc = b.c - nc;
                    return (dr * dr + dc * dc) <= (this._BASE_HIT_RADIUS * this._BASE_HIT_RADIUS);
                });
                if (baseUnder && baseUnder.owner !== targetOwner) {
                    const victim = baseUnder.owner;
                    const victimBaseId = baseUnder.baseId;
                    // Удаляем базу
                    this._bases = this._bases.filter(b => b !== baseUnder);
                    this._removeBaseHelpers(victimBaseId);
                    this._baseLobby.delete(victimBaseId);
                    this._addChatMessage(targetOwner, `разрушил базу игрока ${victim}!`);

                    // Проверяем, остались ли еще базы у жертвы
                    const remainingBases = this._bases.filter(b => b.owner === victim);
                    if (remainingBases.length === 0) {
                        this._addChatMessage(victim, 'потерял все базы и выбывает!');
                        this._removePlayer(victim);
                    }
                }

                // Сталкиваемся с чужой или пустой клеткой
                // Просто отражаем вектор и нормализуем, сохраняя скорость ровно (3 + бонус)
                const player = this._players.get(ball.owner);
                const targetSpeed = 3 + (player ? player.bonusSpeed : 0);

                ball.dx = -ball.dx + (Math.random() - 0.5);
                ball.dy = -ball.dy + (Math.random() - 0.5);

                const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                ball.dx = (ball.dx / currentSpeed) * targetSpeed;
                ball.dy = (ball.dy / currentSpeed) * targetSpeed;

                // Захватываем область вокруг (динамический размер шлейфа по запросу)
                const tr = this._CAPTURE_RADIUS;
                if (tr === 0) {
                    // 1 пиксель
                    this._grid[nr][nc] = targetOwner;
                } else if (tr === 1) {
                    // 5 пикселей (плюсик)
                    for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
                        const rr = nr + dr, cc = nc + dc;
                        if (rr >= 0 && rr < this._rows && cc >= 0 && cc < this._cols) this._grid[rr][cc] = targetOwner;
                    }
                } else if (tr === 1 || tr === 2) {
                    // 2 - промежуточный (пусть будет тоже 5 пикселей или чуть больше)
                    for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
                        const rr = nr + dr, cc = nc + dc;
                        if (rr >= 0 && rr < this._rows && cc >= 0 && cc < this._cols) this._grid[rr][cc] = targetOwner;
                    }
                } else if (tr === 3) {
                    // 9 пикселей (квадрат 3x3)
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const rr = nr + dr, cc = nc + dc;
                            if (rr >= 0 && rr < this._rows && cc >= 0 && cc < this._cols) this._grid[rr][cc] = targetOwner;
                        }
                    }
                } else if (tr >= 4) {
                    // 4 = 13 пикселей (ромб R=2)
                    // 5+ = тоже ромбы или квадраты для масштаба
                    const R = tr - 2; // для 4 -> R=2
                    for (let dr = -R; dr <= R; dr++) {
                        for (let dc = -R; dc <= R; dc++) {
                            if (Math.abs(dr) + Math.abs(dc) <= R) {
                                const rr = nr + dr, cc = nc + dc;
                                if (rr >= 0 && rr < this._rows && cc >= 0 && cc < this._cols) this._grid[rr][cc] = targetOwner;
                            }
                        }
                    }
                }

                if (Math.random() > 0.5) {
                    this._particles.push({
                        x: nx, y: ny, color: ball.color,
                        dx: (Math.random() - 0.5) * 8, dy: (Math.random() - 0.5) * 8,
                        life: 1.0, size: Math.random() * 2 + 1
                    });
                }
            }

            // В любом случае обновляем позицию шарика
            ball.x = nx;
            ball.y = ny;
        } else {
            // Если вышли за пределы сетки (край экрана) — просто обновляем позицию
            ball.x = nx;
            ball.y = ny;
        }
    },

    _resolveCollision(b1, b2) {
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) return; // Защита от деления на ноль
        const minDist = b1.radius + b2.radius;

        if (dist < minDist) {
            const angle = Math.atan2(dy, dx);
            const tx = b1.x + Math.cos(angle) * minDist;
            const ty = b1.y + Math.sin(angle) * minDist;
            const ax = (tx - b2.x) * 0.1;
            const ay = (ty - b2.y) * 0.1;

            b1.dx -= ax;
            b1.dy -= ay;
            b2.dx += ax;
            b2.dy += ay;

            // Разведение шаров, чтобы не слипались
            const overlap = (minDist - dist) / 2;
            b1.x -= Math.cos(angle) * overlap;
            b1.y -= Math.sin(angle) * overlap;
            b2.x += Math.cos(angle) * overlap;
            b2.y += Math.sin(angle) * overlap;
        }
    },

    _drawBall(ball) {
        const ctx = this._ctx;
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = ball.color;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ball.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.clip();
        if (ball.avatarImg && ball.avatarImg.complete) {
            ctx.drawImage(ball.avatarImg, ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);
        } else {
            ctx.fillStyle = ball.color;
            ctx.fill();
        }
        ctx.restore(); // Выходим из clip()

        // Отрисовка текста бонуса скорости (ТЕПЕРЬ СНАРУЖИ КЛИПА)
        const player = this._players.get(ball.owner);
        if (player && player.bonusSpeed > 0) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Outfit, sans-serif';
            ctx.textAlign = 'left';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'black';
            // Смещаем ближе к изгибу шарика
            ctx.fillText(`+${player.bonusSpeed}`, ball.x + ball.radius * 0.5, ball.y - ball.radius * 0.5);
            ctx.restore();
        }
    },

    _startLoop() {
        const loop = () => {
            if (!this._canvas || !this._ctx) return;

            // === ГАРАНТИРУЕМ: requestAnimationFrame вызовется ВСЕГДА ===
            try {
                this._renderFrame();
            } catch (e) {
                console.error('[MapH] ОШИБКА В ЦИКЛЕ РЕНДЕРА:', e);
                // Сбросим контекст на всякий случай (clip, transform и т.д.)
                try {
                    const ctx = this._ctx;
                    ctx.restore(); // на случай висящего save/clip
                    ctx.globalAlpha = 1;
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                } catch (_) {}
            }

            this._animFrameId = requestAnimationFrame(loop);
        };
        loop();
    },

    /**
     * Основное тело рендеринга, вынесено для обёртки в try-catch
     */
    _renderFrame() {
        const ctx = this._ctx;
        const cw = this._canvas.width;
        const ch = this._canvas.height;

        // Если canvas имеет нулевой размер — не рисуем
        if (cw <= 0 || ch <= 0) return;

        // Очистка
        ctx.fillStyle = this._BG_COLOR;
        ctx.fillRect(0, 0, cw, ch);

        for (let r = 0; r < this._rows; r++) {
            const row = this._grid[r];
            if (!row) continue; // Защита от неполной сетки
            for (let c = 0; c < this._cols; c++) {
                const owner = row[c];
                if (owner) {
                    const p = this._players.get(owner);
                    if (p) { ctx.fillStyle = p.color + 'aa'; ctx.fillRect(c * this._GRID_SIZE, r * this._GRID_SIZE, this._GRID_SIZE, this._GRID_SIZE); }
                } else if (this._SHOW_GRID) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
                    ctx.strokeRect(c * this._GRID_SIZE, r * this._GRID_SIZE, this._GRID_SIZE, this._GRID_SIZE);
                }
            }
        }

        // Коллизии — «snapshot» массива, чтобы модификации во время перебора не ломали
        if (this._USE_COLLISIONS) {
            const ballsSnap = this._balls;
            for (let i = 0; i < ballsSnap.length; i++) {
                for (let j = i + 1; j < ballsSnap.length; j++) {
                    try { this._resolveCollision(ballsSnap[i], ballsSnap[j]); } catch (_) {}
                }
            }
        }

        // Обновляем и рисуем отряды
        try { this._updateSquads(); } catch (e) { console.error('[MapH] Ошибка updateSquads:', e); }

        this._squads.forEach(s => {
            try {
                const sRadius = this._SQUAD_RADIUS;

                // Тряска если идет битва
                let ox = 0, oy = 0;
                if (s.battleTimer > 0) {
                    ox = (Math.random() - 0.5) * 4;
                    oy = (Math.random() - 0.5) * 4;
                }

                ctx.save();
                ctx.translate(ox, oy);
                ctx.shadowBlur = sRadius > 4 ? 8 : 4;
                ctx.shadowColor = s.color || '#fff';

                // Рисуем тело "мини-шарика" (АВАТАР ВСЕГДА ВИДЕН)
                ctx.beginPath();
                ctx.arc(s.x, s.y, sRadius, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = sRadius > 8 ? 2 : 1;
                ctx.stroke();

                ctx.clip();
                if (s.avatarImg && s.avatarImg.complete && s.avatarImg.naturalWidth > 0) {
                    ctx.drawImage(s.avatarImg, s.x - sRadius, s.y - sRadius, sRadius * 2, sRadius * 2);
                } else {
                    ctx.fillStyle = s.color || '#888';
                    ctx.fill();
                }
                ctx.restore();

                // Проверка видимости для ЧИСЛА СОЛДАТ
                const gridR = Math.floor(s.y / this._GRID_SIZE);
                const gridC = Math.floor(s.x / this._GRID_SIZE);
                const cellOwner = (gridR >= 0 && gridR < this._rows && gridC >= 0 && gridC < this._cols) ? this._grid[gridR][gridC] : null;

                let showAmount = false;
                const vMode = this._SQUAD_VISIBILITY;
                if (vMode === 0) showAmount = true; // ✅ (Всегда везде)
                else if (vMode === 1) showAmount = false; // ⛔ (Нигде)
                else if (vMode === 2) showAmount = (cellOwner !== s.owner && cellOwner !== null); // ⭕ (Только в чужой зоне)
                else if (vMode === 3) showAmount = (cellOwner !== s.owner); // 🔘 (В нейтральной и чужой)

                if (showAmount) {
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 10px Outfit, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 2;
                    ctx.strokeText(s.amount, s.x, s.y - 8);
                    ctx.fillText(s.amount, s.x, s.y - 8);
                }
            } catch (e) {
                ctx.restore(); // Гарантируем выход из save/clip
            }
        });

        // Отрисовка баз
        if (this._USE_BASES) {
            this._bases.forEach(base => {
                try {
                    const gs = this._GRID_SIZE;
                    let bs = this._BASE_SIZE;

                    // Эффекты ТРЯСКИ (без изменения цвета домика и размера)
                    let offsetX = 0, offsetY = 0;
                    if (base.flashTimer > 0) {
                        offsetX = (Math.random() - 0.5) * 6; // Тряска
                        offsetY = (Math.random() - 0.5) * 6;
                        base.flashTimer--;
                    }

                    const bx = base.c * gs - (bs - gs) / 2 + offsetX;
                    const by = base.r * gs - (bs - gs) / 2 + offsetY;

                    ctx.fillStyle = base.color;
                    ctx.fillRect(bx, by, bs, bs);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(bx, by, bs, bs);

                    // Аватарка внутри домика
                    const avatar = this._avatarCache.get(base.owner);
                    if (avatar && avatar.complete && avatar.naturalWidth > 0) {
                        ctx.drawImage(avatar, bx + 2, by + 2, bs - 4, bs - 4);
                    }

                    // КРЫША
                    ctx.beginPath();
                    ctx.moveTo(bx - (bs * 0.2), by);
                    ctx.lineTo(bx + bs + (bs * 0.2), by);
                    ctx.lineTo(bx + bs / 2, by - bs / 1.2);
                    ctx.closePath();
                    ctx.fillStyle = base.color;
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.stroke();

                    ctx.fillStyle = base.flashTimer > 0 ? base.flashColor : 'white';
                    ctx.font = `bold ${Math.max(10, bs / 2)}px Outfit, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 2;
                    ctx.strokeText(base.baseId || 'B?', bx + bs / 2, by - 3);
                    ctx.fillText(base.baseId || 'B?', bx + bs / 2, by - 3);

                    ctx.fillStyle = base.flashTimer > 0 ? base.flashColor : 'rgba(255,255,255,0.9)';
                    const soldierFontSize = Math.max(10, bs / 2);
                    ctx.font = `bold ${soldierFontSize}px Outfit, sans-serif`;
                    ctx.textAlign = 'center';

                    const soldierText = `⚔️${base.soldiers || 0}`;
                    const textX = bx + bs / 2;
                    const textY = by + bs + (bs / 2);

                    // Обычный вид без наёмников под базой (по просьбе пользователя)
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 2;
                    ctx.strokeText(soldierText, textX, textY);
                    ctx.fillText(soldierText, textX, textY);
                } catch (_) {}
            });
        }

        // Обновляем и рисуем шары (они будут СВЕРХУ баз)
        // Копируем массив на случай если _updateBall() вызовет _removePlayer() и заменит this._balls
        const ballsCopy = [...this._balls];
        for (let i = 0; i < ballsCopy.length; i++) {
            const b = ballsCopy[i];
            try {
                // Принудительная привязка к границам canvas
                if (isNaN(b.x) || b.x < 0) b.x = Math.random() * cw;
                if (isNaN(b.y) || b.y < 0) b.y = Math.random() * ch;
                if (b.x > cw) b.x = cw - b.radius;
                if (b.y > ch) b.y = ch - b.radius;

                this._updateBall(b);
                if (this._SHOW_BALLS_VISUAL) {
                    this._drawBall(b);
                }
            } catch (e) {
                ctx.restore(); // Гарантируем выход из save/clip в drawBall
            }
        }

        for (let i = this._particles.length - 1; i >= 0; i--) {
            const p = this._particles[i];
            p.x += p.dx; p.y += p.dy; p.life -= 0.03;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color || '#fff';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 1, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            if (p.life <= 0) this._particles.splice(i, 1);
        }
    },

    _updateScores() {
        // Логика прироста солдат по таймеру
        this._soldierTick++;
        if (this._soldierTick >= this._SOLDIER_INTERVAL_SEC) {
            if (this._PER_BASE_PRODUCTION) {
                // ПАРАЛЛЕЛЬНО (каждая база получает солдат)
                this._bases.forEach(b => {
                    b.soldiers += this._SOLDIER_AMOUNT;
                });
            } else {
                // ПО ОЧЕРЕДИ (один солдат на одну из баз игрока в цикл)
                const owners = new Set(this._bases.map(b => b.owner));
                owners.forEach(owner => {
                    const playerBases = this._bases.filter(b => b.owner === owner);
                    if (playerBases.length === 0) return;

                    const p = this._players.get(owner);
                    if (p) {
                        if (p.prodIdx === undefined) p.prodIdx = 0;
                        if (p.prodIdx >= playerBases.length) p.prodIdx = 0;

                        playerBases[p.prodIdx].soldiers += this._SOLDIER_AMOUNT;
                        p.prodIdx = (p.prodIdx + 1) % playerBases.length;
                    }
                });
            }
            this._soldierTick = 0;
        }

        // Логика затухания бонусной скорости (каждые 5 секунд -1)
        this._players.forEach(p => {
            if (p.bonusSpeed > 0) {
                p.decayTick++;
                if (p.decayTick >= 5) {
                    p.bonusSpeed--;
                    p.decayTick = 0;
                }
            } else {
                p.decayTick = 0;
            }
        });

        const scores = new Map();
        for (let r = 0; r < this._rows; r++) {
            for (let c = 0; c < this._cols; c++) {
                const o = this._grid[r][c];
                if (o) scores.set(o, (scores.get(o) || 0) + 1);
            }
        }
        const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, this._MAX_PLAYERS);
        this._renderLeaderboard(sorted);
        this._updateMarquee();
    },

    _runBotBrain() {
        if (this._restarting) return;

        this._players.forEach((p, name) => {
            if (p.aiLevel <= 0) return;

            const now = Date.now();
            // Задержка между действиями зависит от уровня (L1: 15с, L5: 3с)
            const delay = Math.max(3000, 18000 - (p.aiLevel * 3000));
            
            if (now - p.lastAiTick < delay) return;
            p.lastAiTick = now;

            // Находим все базы бота
            const myBases = this._bases.filter(b => b.owner === name);
            if (myBases.length === 0) return;

            // Логика по уровням
            myBases.forEach(source => {
                // Шанс действия зависит от уровня
                if (Math.random() * 5 > p.aiLevel + 1) return;

                let target = null;
                let percent = 50;

                if (p.aiLevel === 1) {
                    // LVL 1: Случайная чужая база, мало вояк
                    if (source.soldiers < 20) return;
                    const others = this._bases.filter(b => b.owner !== name);
                    target = others[Math.floor(Math.random() * others.length)];
                    percent = 30;
                } 
                else if (p.aiLevel === 2) {
                    // LVL 2: Самая слабая чужая база
                    if (source.soldiers < 15) return;
                    const others = this._bases.filter(b => b.owner !== name);
                    if (others.length > 0) {
                        target = others.reduce((prev, curr) => prev.soldiers < curr.soldiers ? prev : curr);
                    }
                    percent = 50;
                }
                else if (p.aiLevel >= 3) {
                    // LVL 3+: Умный выбор (атака слабого или помощь своему)
                    const weakMyBase = myBases.find(mb => mb.soldiers < 5 && mb !== source);
                    if (weakMyBase && Math.random() > 0.5) {
                        target = weakMyBase; // Помогаем своим
                        percent = 40;
                    } else {
                        // Атакуем самого слабого врага
                        const others = this._bases.filter(b => b.owner !== name);
                        if (others.length > 0) {
                            target = others.reduce((prev, curr) => (prev.soldiers < curr.soldiers) ? prev : curr);
                        }
                        percent = 60 + (p.aiLevel * 5); // LVL 5 отправляет 85%
                    }
                }

                if (target && target !== source) {
                    this._handleAttack(name, source.baseId, Math.floor(source.soldiers * (percent / 100)), target.baseId);
                }
            });
        });
    },

    _toggleFloatingLeaderboard() {
        let fLb = document.getElementById('mh-floating-leaderboard');
        if (fLb) {
            fLb.remove();
            return; // Закрываем, если окно уже было открыто
        }

        fLb = document.createElement('div');
        fLb.id = 'mh-floating-leaderboard';
        fLb.style.position = 'fixed';
        fLb.style.top = '100px';
        fLb.style.left = '400px';
        fLb.style.width = '240px';
        fLb.style.background = 'rgba(20, 15, 25, 0.9)'; // Транспарентный фон для OBS
        fLb.style.backdropFilter = 'blur(5px)';
        fLb.style.border = '2px solid var(--accent, #a855f7)';
        fLb.style.borderRadius = '12px';
        fLb.style.padding = '12px';
        fLb.style.zIndex = '999999';
        fLb.style.color = 'white';
        fLb.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
        fLb.style.userSelect = 'none';

        fLb.innerHTML = `
            <div id="mh-floating-leaderboard-list" style="cursor:move; min-height:50px;">
                <!-- Сюда будет дублироваться рейтинг -->
            </div>
        `;

        document.body.appendChild(fLb);

        // Логика перемещения (Drag & Drop)
        const handle = document.getElementById('mh-floating-leaderboard-list');
        let isDown = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName.toLowerCase() === 'button') return;
            isDown = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = fLb.offsetLeft;
            startTop = fLb.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            fLb.style.left = (startLeft + (e.clientX - startX)) + 'px';
            fLb.style.top = (startTop + (e.clientY - startY)) + 'px';
        });

        document.addEventListener('mouseup', () => isDown = false);

        // Форсируем обновление UI
        this._soldierTick = this._SOLDIER_INTERVAL_SEC;
    },

    _toggleFloatingMarquee() {
        let fMq = document.getElementById('mh-floating-marquee');
        if (fMq) {
            fMq.remove();
            return;
        }

        fMq = document.createElement('div');
        fMq.id = 'mh-floating-marquee';
        fMq.style.position = 'fixed';

        // Подстраиваем ширину под окно стрима
        const streamContainer = document.getElementById('mh-canvas-container');
        if (streamContainer) {
            const rect = streamContainer.getBoundingClientRect();
            fMq.style.left = rect.left + 'px';
            fMq.style.top = (rect.bottom - 60) + 'px';
            fMq.style.width = rect.width + 'px';
        } else {
            fMq.style.left = '200px';
            fMq.style.bottom = '50px';
            fMq.style.width = '800px';
        }

        fMq.style.height = '40px';
        fMq.style.background = 'rgba(20, 15, 25, 0.9)';
        fMq.style.backdropFilter = 'blur(5px)';
        fMq.style.border = '2px solid var(--accent, #a855f7)';
        fMq.style.borderRadius = '8px';
        fMq.style.padding = '0 10px';
        fMq.style.zIndex = '999999';
        fMq.style.color = 'white';
        fMq.style.boxShadow = '0 5px 20px rgba(0,0,0,0.8)';
        fMq.style.userSelect = 'none';
        fMq.style.cursor = 'move';
        fMq.style.display = 'flex';
        fMq.style.alignItems = 'center';
        fMq.style.fontSize = '1.3rem';
        fMq.style.fontWeight = 'bold';
        fMq.style.boxSizing = 'border-box';

        fMq.innerHTML = `
            <marquee id="mh-floating-marquee-text" scrollamount="8" style="pointer-events:none; width:100%; letter-spacing:1px;"></marquee>
        `;

        document.body.appendChild(fMq);

        let isDown = false;
        let startX, startY, startLeft, startTop;

        fMq.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = fMq.offsetLeft;
            startTop = fMq.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            fMq.style.left = (startLeft + (e.clientX - startX)) + 'px';
            fMq.style.top = (startTop + (e.clientY - startY)) + 'px';
        });

        document.addEventListener('mouseup', () => isDown = false);

        this._updateMarquee();
    },

    _updateMarquee() {
        const mqNode = document.getElementById('mh-floating-marquee-text');
        if (!mqNode) return;

        let parts = [
            `🚀 Создать базу: <span style="color:#a855f7;">${this._JOIN_COMMAND}</span>`,
            `⚔️ Aтаковать: <span style="color:#a855f7;">#своя_база#солдаты#цель</span> (пример: <b><span style="color:#a855f7;">#A1#10#B2</span></b>)`
        ];

        const lobbyBases = [];
        this._bases.forEach(b => {
            const currentHelpers = this._balls.filter(ball => ball.attachedToBaseId === b.baseId).length;
            if (currentHelpers < this._MAX_HELPERS_PER_BASE) {
                lobbyBases.push(`<span style="color:${b.color};">#${b.baseId}</span>`);
            }
        });

        if (lobbyBases.length > 0) {
            parts.push(`🦾 Наёмникам: <span style="color:#a855f7;">#ID_базы#любые_цифры</span> (пример: <b><span style="color:#a855f7;">#A1#333</span></b>) (список вакансий ID_базы: ${lobbyBases.join(', ')}), и чтобы владелец тоже принял!`);
        } else {
            parts.push(`🦾 Мест для наёмников пока нет!`);
        }

        const newHtml = parts.join('&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;');
        if (mqNode.innerHTML !== newHtml) {
            mqNode.innerHTML = newHtml;
        }
    },

    _renderLeaderboard(data) {
        const list = document.getElementById('mh-leaderboard-list');
        const floatingList = document.getElementById('mh-floating-leaderboard-list');
        if (!list && !floatingList) return;

        if (list) list.innerHTML = '';
        if (floatingList) floatingList.innerHTML = '';
        data.forEach(([name, score], index) => {
            const p = this._players.get(name);
            const playerBases = this._bases.filter(b => b.owner === name);
            const totalSoldiers = playerBases.reduce((acc, b) => acc + b.soldiers, 0);

            const item = document.createElement('div');
            const isTop3 = index < 3;
            item.className = `leader-item ${isTop3 ? 'top-three' : ''}`;

            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
            const rankText = medal || `#${index + 1}`;
            const avatarHtml = this._getAvatarHtml(name, p?.avatar, 'leader-avatar', p?.avatarModule || this._baseAvatarModule);

            const helpers = this._balls.filter(b => b.parentOwner === name && b.owner !== name);
            let helpersHtml = '';
            helpers.forEach(h => {
                const helperPlayer = this._players.get(h.owner);
                const hAva = this._avatarCache.get(h.owner)?.src || '';
                helpersHtml += this._getAvatarHtml(h.owner, hAva, 'leader-helper-avatar', helperPlayer?.avatarModule || this._helperAvatarModule);
            });

            item.innerHTML = `
                ${avatarHtml}
                <span class="leader-rank ${!isTop3 ? 'numeric' : ''}">${rankText}</span>
                <span class="leader-name">
                    ${name} 
                    <span style="font-size:0.75em; opacity:0.6; margin-left:4px;">⚔️${totalSoldiers}</span>
                    <span class="leader-helpers-container">${helpersHtml}</span>
                </span>
                <span class="leader-score">${score}</span>
            `;
            if (list) list.appendChild(item);
            if (floatingList) {
                const clone = item.cloneNode(true);
                const nameNode = clone.querySelector('.leader-name');
                if (nameNode && nameNode.childNodes[0]) {
                    nameNode.childNodes[0].nodeValue = name.substring(0, 3) + ' ';
                }
                floatingList.appendChild(clone);
            }
        });
    },

    /**
     * Генерирует HTML для аватара (как в PeekH)
     */
    _getAvatarHtml(name, avatarUrl, className = 'leader-avatar', moduleId = null) {
        // 1. Пытаемся взять из кеша (уже загруженный/сгенерированный Image)
        const cached = this._avatarCache.get(name);
        if (cached && cached.src) {
            return `<img src="${cached.src}" class="${className}" alt="${name}">`;
        }

        // 2. Если есть внешний URL
        if (avatarUrl && avatarUrl !== '') {
            return `<img src="${avatarUrl}" class="${className}" alt="${name}">`;
        }

        if (moduleId) {
            const gen = this._getGenerator(moduleId);
            if (gen && gen.generate) {
                return `<img src="${gen.generate(name)}" class="${className}" alt="${name}">`;
            }
        }

        const firstLetter = (name || "?").charAt(0).toUpperCase();
        const colors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const color = colors[Math.abs(hash) % colors.length];

        return `<div class="${className}" style="background-color: ${color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 950; font-size: 10px;">${firstLetter}</div>`;
    },

    _cleanupDisconnectedTerritories() {
        if (this._balls.length === 0 && this._bases.length === 0) return;

        if (this._USE_BASES) {
            const ballsToRemove = [];
            const targetOwners = new Set();
            this._balls.forEach(b => targetOwners.add(b.parentOwner || b.owner));
            this._bases.forEach(b => targetOwners.add(b.owner));

            targetOwners.forEach(targetOwner => {
                const connected = new Set();
                const stack = [];
                const ownerBases = this._bases.filter(b => b.owner === targetOwner);

                ownerBases.forEach(b => {
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const r = b.r + dr, c = b.c + dc;
                            if (r >= 0 && r < this._rows && c >= 0 && c < this._cols && this._grid[r][c] === targetOwner) {
                                stack.push([r, c]);
                            }
                            // Убрана ошибочная ветка: ранее пушились даже чужие/пустые клетки
                        }
                    }
                });

                while (stack.length > 0) {
                    const [r, c] = stack.pop();
                    const key = `${r},${c}`;
                    if (connected.has(key)) continue;
                    connected.add(key);

                    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols && this._grid[nr][nc] === targetOwner && !connected.has(`${nr},${nc}`)) {
                            stack.push([nr, nc]);
                        }
                    }
                }

                for (let r = 0; r < this._rows; r++) {
                    for (let c = 0; c < this._cols; c++) {
                        if (this._grid[r][c] === targetOwner && !connected.has(`${r},${c}`)) {
                            this._grid[r][c] = null;
                        }
                    }
                }

                this._balls.forEach(ball => {
                    if ((ball.parentOwner || ball.owner) === targetOwner) {
                        const ballC = Math.floor(ball.x / this._GRID_SIZE);
                        const ballR = Math.floor(ball.y / this._GRID_SIZE);
                        // ИЗМЕНЕНИЕ: Не удаляем шарик, пока у игрока есть хоть одна живая база
                        const hasAnyBase = this._bases.some(b => b.owner === targetOwner);
                        if (!connected.has(`${ballR},${ballC}`) && !hasAnyBase) {
                            ballsToRemove.push(ball);
                        }
                    }
                });
            });

            ballsToRemove.forEach(ball => {
                const index = this._balls.indexOf(ball);
                if (index !== -1) this._balls.splice(index, 1);

                let msg = (ball.owner !== ball.parentOwner && ball.parentOwner) ? "был отрезан от базы и исчез!" : "шарик отрезан от базы и уничтожен!";
                this._addChatMessage(ball.owner, msg);

                for (let i = 0; i < 20; i++) {
                    this._particles.push({
                        x: ball.x, y: ball.y, color: ball.color,
                        dx: (Math.random() - 0.5) * 15, dy: (Math.random() - 0.5) * 15,
                        life: 1.0, size: Math.random() * 3 + 1
                    });
                }
                this.playSound('explosion');
            });
        } else {
            const toRemove = [];
            this._balls.forEach(ball => {
                const targetOwner = ball.parentOwner || ball.owner;
                let sr = Math.floor(ball.y / this._GRID_SIZE);
                let sc = Math.floor(ball.x / this._GRID_SIZE);

                const connected = new Set();
                const stack = [];
                if (sr >= 0 && sr < this._rows && sc >= 0 && sc < this._cols && this._grid[sr][sc] === targetOwner) stack.push([sr, sc]);

                while (stack.length > 0) {
                    const [r, c] = stack.pop();
                    const key = `${r},${c}`;
                    if (connected.has(key)) continue;
                    connected.add(key);
                    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols && this._grid[nr][nc] === targetOwner && !connected.has(`${nr},${nc}`)) stack.push([nr, nc]);
                    }
                }

                for (let r = 0; r < this._rows; r++) {
                    for (let c = 0; c < this._cols; c++) {
                        if (this._grid[r][c] === targetOwner && !connected.has(`${r},${c}`)) this._grid[r][c] = null;
                    }
                }
                const ballC = Math.floor(ball.x / this._GRID_SIZE);
                const ballR = Math.floor(ball.y / this._GRID_SIZE);
                if (!connected.has(`${ballR},${ballC}`)) {
                    toRemove.push(ball.owner);
                }
            });
            toRemove.forEach(name => this._removePlayer(name));
        }
    },

    _addChatMessage(user, text) {
        const chat = document.getElementById('mh-chat-messages');
        if (!chat) return;
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = `<span class="user" style="color:${this._players.get(user)?.color || '#fff'}">${user}:</span> ${text}`;
        chat.prepend(msg);
        if (chat.children.length > 15) chat.lastChild.remove();
    },

    _setupListeners() {
        // Симуляция: синхронизация имен и запуск
        const editorInput = document.getElementById('mh-sim-name');
        const infoName = document.getElementById('mh-info-name');
        const infoInput = document.getElementById('mh-info-input');
        const infoSend = document.getElementById('mh-info-send');
        const infoRandom = document.getElementById('mh-info-random');

        const handleChatSim = () => {
            const name = infoName?.value.trim() || "Tester";
            const text = infoInput?.value.trim();
            if (text) {
                this._processChat(name, text);
                this._addChatMessage(name, text);
                if (infoInput) infoInput.value = '';
            }
        };

        if (infoSend) infoSend.onclick = handleChatSim;
        if (infoInput) infoInput.onkeyup = e => { if (e.key === 'Enter') handleChatSim(); };
        if (infoName) infoName.onkeyup = e => { if (e.key === 'Enter') handleChatSim(); };

        if (infoRandom) {
            infoRandom.onclick = () => {
                const syllables = ["Ka", "Lu", "Ro", "Sa", "Te", "Vo", "Ni", "Pa", "Zu"];
                const name = syllables[Math.floor(Math.random() * syllables.length)] + syllables[Math.floor(Math.random() * syllables.length)];
                this._spawnPlayer(name, null, 1); // По умолчанию LVL 1
            };
        }

        // Кнопки уровней ботов
        for (let i = 1; i <= 5; i++) {
            const btn = document.getElementById(`mh-bot-lvl-${i}`);
            if (btn) {
                btn.onclick = () => {
                    const syllables = ["AI", "Bot", "Cyb", "Droid", "Mech", "Unit", "Zod", "Max"];
                    const name = syllables[Math.floor(Math.random() * syllables.length)] + "_" + (Math.random() * 100).toFixed(0) + "_L" + i;
                    this._spawnPlayer(name, null, i);
                    this.playSound('ui_click');
                };
            }
        }

        const botHelperBtn = document.getElementById('mh-info-bot-helper');
        if (botHelperBtn) {
            botHelperBtn.onclick = () => {
                const targetName = infoName?.value.trim();
                this._addBotHelper(targetName || null);
            };
        }

        // Звуки (Слушатели кнопок)
        const sndToggles = [
            { id: 'mh-snd-spawn', key: 'spawn', icon: '🚀' },
            { id: 'mh-snd-attack', key: 'attack', icon: '⚔️' },
            { id: 'mh-snd-hit', key: 'hit', icon: '💥' },
            { id: 'mh-snd-capture', key: 'capture', icon: '🚩' },
            { id: 'mh-snd-explosion', key: 'explosion', icon: '☠️' },
            { id: 'mh-snd-helper', key: 'helper', icon: '🦾' }
        ];

        sndToggles.forEach(t => {
            const btn = document.getElementById(t.id);
            if (btn) {
                // Инициализация кнопки
                const isEnabled = this._soundConfig[t.key] !== false;
                btn.innerHTML = `${t.icon}${isEnabled ? '✅' : '⛔'}`;
                if (isEnabled) btn.classList.add('active-val'); else btn.classList.remove('active-val');

                // Клик
                btn.onclick = () => {
                    this._soundConfig[t.key] = !this._soundConfig[t.key];
                    const enabled = this._soundConfig[t.key];
                    btn.innerHTML = `${t.icon}${enabled ? '✅' : '⛔'}`;
                    if (enabled) btn.classList.add('active-val'); else btn.classList.remove('active-val');
                    this.playSound('ui_click');
                };
            }
        });

        // Наёмники
        const mhHelpersMinus = document.getElementById('mh-max-helpers-minus');
        const mhHelpersPlus = document.getElementById('mh-max-helpers-plus');
        const mhHelpersVal = document.getElementById('mh-max-helpers-val-editor');

        if (mhHelpersMinus) {
            mhHelpersMinus.onclick = () => {
                if (this._MAX_HELPERS_PER_BASE > 0) {
                    this._MAX_HELPERS_PER_BASE--;
                    mhHelpersVal.textContent = `🦾 ${this._MAX_HELPERS_PER_BASE}`;
                }
            };
        }
        if (mhHelpersPlus) {
            mhHelpersPlus.onclick = () => {
                if (this._MAX_HELPERS_PER_BASE < 5) {
                    this._MAX_HELPERS_PER_BASE++;
                    mhHelpersVal.textContent = `🦾 ${this._MAX_HELPERS_PER_BASE}`;
                }
            };
        }

        const pickPlayerBtn = document.getElementById('mh-info-pick-player');
        const playerList = document.getElementById('mh-info-player-list');
        if (pickPlayerBtn && playerList) {
            pickPlayerBtn.onclick = (e) => {
                const names = Array.from(this._players.keys());
                if (names.length === 0) return;

                playerList.innerHTML = names.map(n => `
                    <div class="player-item" data-name="${n}" style="padding:4px 8px; cursor:pointer; font-size:0.75rem; border-bottom:1px solid rgba(255,255,255,0.05); color:${this._players.get(n)?.color || 'white'}; display:flex; align-items:center; justify-content:space-between;">
                        <span>${n}</span>
                        <span class="kick-btn" style="padding:0 4px; opacity:0.5;" title="Выгнать">❌</span>
                    </div>
                `).join('');

                playerList.style.display = playerList.style.display === 'block' ? 'none' : 'block';

                const items = playerList.querySelectorAll('.player-item');
                items.forEach(item => {
                    const playerName = item.getAttribute('data-name');
                    const kickBtn = item.querySelector('.kick-btn');

                    item.onclick = () => {
                        infoName.value = playerName;
                        playerList.style.display = 'none';
                    };

                    kickBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (confirm(`Выгнать игрока ${playerName}?`)) {
                            this._removePlayer(playerName);
                            playerList.style.display = 'none';
                        }
                    };

                    item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.1)';
                    item.onmouseout = () => item.style.background = 'none';
                });
                e.stopPropagation();
            };
            document.addEventListener('click', () => { playerList.style.display = 'none'; });
        }

        const pickCmdBtn = document.getElementById('mh-info-pick-cmd');
        const cmdList = document.getElementById('mh-info-cmd-list');
        if (pickCmdBtn && cmdList) {
            pickCmdBtn.onclick = (e) => {
                const name = infoName.value.trim();
                const myBases = this._bases.filter(b => b.owner === name);
                const allOtherBases = this._bases; // Все базы на карте для выбора целей

                const options = [];
                if (myBases.length === 0) {
                    options.push({ cmd: this._JOIN_COMMAND, color: 'white' });
                } else {
                    myBases.forEach(from => {
                        allOtherBases.forEach(to => {
                            if (from.baseId !== to.baseId) {
                                options.push({ cmd: `#${from.baseId}#10#${to.baseId}`, color: to.color || '#00ffcc' });
                            }
                        });
                    });
                }

                cmdList.innerHTML = options.map(o => `
                    <div class="cmd-item" style="padding:4px 8px; cursor:pointer; font-size:0.7rem; border-bottom:1px solid rgba(255,255,255,0.05); color:${o.color};">${o.cmd}</div>
                `).join('');

                cmdList.style.display = cmdList.style.display === 'block' ? 'none' : 'block';

                const items = cmdList.querySelectorAll('.cmd-item');
                items.forEach(item => {
                    item.onclick = () => {
                        infoInput.value = item.textContent;
                        cmdList.style.display = 'none';
                    };
                    item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.1)';
                    item.onmouseout = () => item.style.background = 'none';
                });
                e.stopPropagation();
            };
            document.addEventListener('click', () => { cmdList.style.display = 'none'; });
        }

        // Ползунки в редакторе
        const gsEdMinus = document.getElementById('mh-grid-size-minus');
        const gsEdPlus = document.getElementById('mh-grid-size-plus');
        const gsEdVal = document.getElementById('mh-grid-size-val-editor');
        const brEdMinus = document.getElementById('mh-ball-radius-minus');
        const brEdPlus = document.getElementById('mh-ball-radius-plus');
        const brEdVal = document.getElementById('mh-ball-radius-val-editor');
        const bsEdMinus = document.getElementById('mh-base-size-minus');
        const bsEdPlus = document.getElementById('mh-base-size-plus');
        const bsEdVal = document.getElementById('mh-base-size-val-editor');
        const spEdMinus = document.getElementById('mh-speed-minus');
        const spEdPlus = document.getElementById('mh-speed-plus');
        const spEdVal = document.getElementById('mh-speed-val-editor');
        const cmdEdInput = document.getElementById('mh-join-cmd-input-editor');
        const mpEdBtn = document.getElementById('mh-max-players-btn');
        const collBtnEd = document.getElementById('mh-collision-toggle-editor');
        const sIntBtn = document.getElementById('mh-soldier-interval-btn');
        const sAmtBtn = document.getElementById('mh-soldier-amount-btn');
        const bTerrMinus = document.getElementById('mh-base-territory-minus');
        const bTerrPlus = document.getElementById('mh-base-territory-plus');
        const bTerrVal = document.getElementById('mh-base-territory-val');
        const bHitMinus = document.getElementById('mh-base-hit-minus');
        const bHitPlus = document.getElementById('mh-base-hit-plus');
        const bHitVal = document.getElementById('mh-base-hit-val');

        if (gsEdVal) gsEdVal.onclick = () => {
            this._GRID_SIZE = 5;
            gsEdVal.textContent = this._GRID_SIZE;
            this._initCanvas();
        };
        if (brEdVal) brEdVal.onclick = () => {
            this._BALL_RADIUS = 10;
            brEdVal.textContent = this._BALL_RADIUS;
            this._balls.forEach(b => b.radius = this._BALL_RADIUS);
        };
        if (bsEdVal) bsEdVal.onclick = () => {
            this._BASE_SIZE = 24;
            bsEdVal.textContent = this._BASE_SIZE;
        };
        if (spEdVal) spEdVal.onclick = () => {
            this._BALL_SPEED_MULT = 5 / 8;
            spEdVal.textContent = "5";
        };

        if (bTerrVal) bTerrVal.onclick = () => {
            this._BASE_TERRITORY_RADIUS = 6;
            bTerrVal.textContent = `🗺️ ${this._BASE_TERRITORY_RADIUS}`;
        };
        if (bHitVal) bHitVal.onclick = () => {
            this._BASE_HIT_RADIUS = 1;
            bHitVal.textContent = `🧱 ${this._BASE_HIT_RADIUS}`;
        };

        if (gsEdMinus) gsEdMinus.onclick = () => {
            if (this._GRID_SIZE > 2) {
                this._GRID_SIZE--;
                if (gsEdVal) gsEdVal.textContent = this._GRID_SIZE;
                this._initCanvas();
            }
        };
        if (gsEdPlus) gsEdPlus.onclick = () => {
            if (this._GRID_SIZE < 30) {
                this._GRID_SIZE++;
                if (gsEdVal) gsEdVal.textContent = this._GRID_SIZE;
                this._initCanvas();
            }
        };
        if (brEdMinus) brEdMinus.onclick = () => {
            if (this._BALL_RADIUS > 5) {
                this._BALL_RADIUS--;
                if (brEdVal) brEdVal.textContent = this._BALL_RADIUS;
                this._balls.forEach(b => b.radius = this._BALL_RADIUS);
            }
        };
        if (brEdPlus) brEdPlus.onclick = () => {
            if (this._BALL_RADIUS < 50) {
                this._BALL_RADIUS++;
                if (brEdVal) brEdVal.textContent = this._BALL_RADIUS;
                this._balls.forEach(b => b.radius = this._BALL_RADIUS);
            }
        };
        if (bsEdMinus) bsEdMinus.onclick = () => {
            if (this._BASE_SIZE > 5) {
                this._BASE_SIZE--;
                if (bsEdVal) bsEdVal.textContent = this._BASE_SIZE;
            }
        };
        if (bsEdPlus) bsEdPlus.onclick = () => {
            if (this._BASE_SIZE < 60) {
                this._BASE_SIZE++;
                if (bsEdVal) bsEdVal.textContent = this._BASE_SIZE;
            }
        };
        if (spEdMinus) spEdMinus.onclick = () => {
            let val = parseInt(spEdVal.textContent);
            if (val > 1) {
                val--;
                spEdVal.textContent = val;
                this._BALL_SPEED_MULT = val / 8;
            }
        };
        if (spEdPlus) spEdPlus.onclick = () => {
            let val = parseInt(spEdVal.textContent);
            if (val < 15) {
                val++;
                spEdVal.textContent = val;
                this._BALL_SPEED_MULT = val / 8;
            }
        };

        if (bTerrMinus) bTerrMinus.onclick = () => {
            if (this._BASE_TERRITORY_RADIUS > 1) {
                this._BASE_TERRITORY_RADIUS--;
                if (bTerrVal) bTerrVal.textContent = `🗺️ ${this._BASE_TERRITORY_RADIUS}`;
            }
        };
        if (bTerrPlus) bTerrPlus.onclick = () => {
            if (this._BASE_TERRITORY_RADIUS < 10) {
                this._BASE_TERRITORY_RADIUS++;
                if (bTerrVal) bTerrVal.textContent = `🗺️ ${this._BASE_TERRITORY_RADIUS}`;
            }
        };

        if (bHitMinus) bHitMinus.onclick = () => {
            if (this._BASE_HIT_RADIUS > 0) {
                this._BASE_HIT_RADIUS--;
                if (bHitVal) bHitVal.textContent = `🧱 ${this._BASE_HIT_RADIUS}`;
            }
        };
        if (bHitPlus) bHitPlus.onclick = () => {
            if (this._BASE_HIT_RADIUS < 10) {
                this._BASE_HIT_RADIUS++;
                if (bHitVal) bHitVal.textContent = `🧱 ${this._BASE_HIT_RADIUS}`;
            }
        };

        if (cmdEdInput) cmdEdInput.addEventListener('input', e => {
            this._JOIN_COMMAND = e.target.value.trim() || '#baza';
        });

        const mpEdMinus = document.getElementById('mh-max-players-minus');
        const mpEdPlus = document.getElementById('mh-max-players-plus');
        const mpEdVal = document.getElementById('mh-max-players-val-editor');
        const mhMinus = document.getElementById('mh-max-helpers-minus');
        const mhPlus = document.getElementById('mh-max-helpers-plus');
        const mhVal = document.getElementById('mh-max-helpers-val-editor');
        const sResBtn = document.getElementById('mh-soldier-reset-btn');

        if (mpEdMinus) mpEdMinus.onclick = () => {
            if (this._MAX_PLAYERS > 1) {
                this._MAX_PLAYERS--;
                if (mpEdVal) mpEdVal.textContent = `👥 ${this._MAX_PLAYERS}`;
            }
        };
        if (mpEdPlus) mpEdPlus.onclick = () => {
            if (this._MAX_PLAYERS < 20) {
                this._MAX_PLAYERS++;
                if (mpEdVal) mpEdVal.textContent = `👥 ${this._MAX_PLAYERS}`;
            }
        };
        if (mpEdVal) mpEdVal.onclick = () => {
            this._MAX_PLAYERS = 10;
            mpEdVal.textContent = `👥 ${this._MAX_PLAYERS}`;
        };

        if (mhMinus) mhMinus.onclick = () => {
            if (this._MAX_HELPERS_PER_BASE > 0) {
                this._MAX_HELPERS_PER_BASE--;
                if (mhVal) mhVal.textContent = `🦾 ${this._MAX_HELPERS_PER_BASE}`;
            }
        };
        if (mhPlus) mhPlus.onclick = () => {
            if (this._MAX_HELPERS_PER_BASE < 10) {
                this._MAX_HELPERS_PER_BASE++;
                if (mhVal) mhVal.textContent = `🦾 ${this._MAX_HELPERS_PER_BASE}`;
            }
        };
        if (mhVal) mhVal.onclick = () => {
            this._MAX_HELPERS_PER_BASE = 2;
            mhVal.textContent = `🦾 ${this._MAX_HELPERS_PER_BASE}`;
        };

        if (sResBtn) sResBtn.onclick = () => {
            this._SOLDIER_INTERVAL_SEC = 2;
            this._SOLDIER_AMOUNT = 1;
            this._soldierTick = 0;
            if (sIntBtn) sIntBtn.textContent = `⏱️ 2`;
            if (sAmtBtn) sAmtBtn.textContent = `⚔️ 1`;
        };

        if (sIntBtn) sIntBtn.onclick = () => {
            this._SOLDIER_INTERVAL_SEC++;
            if (this._SOLDIER_INTERVAL_SEC > 10) this._SOLDIER_INTERVAL_SEC = 1;
            sIntBtn.textContent = `⏱️ ${this._SOLDIER_INTERVAL_SEC}`;
            this._soldierTick = 0;
        };
        if (sAmtBtn) sAmtBtn.onclick = () => {
            this._SOLDIER_AMOUNT++;
            if (this._SOLDIER_AMOUNT > 10) this._SOLDIER_AMOUNT = 0;
            sAmtBtn.textContent = `⚔️ ${this._SOLDIER_AMOUNT}`;
        };

        const captureRadMinus = document.getElementById('mh-capture-radius-minus');
        const captureRadPlus = document.getElementById('mh-capture-radius-plus');
        const captureRadVal = document.getElementById('mh-capture-radius-val-editor');

        if (captureRadMinus) {
            captureRadMinus.onclick = () => {
                if (this._CAPTURE_RADIUS > 0) {
                    this._CAPTURE_RADIUS--;
                    captureRadVal.textContent = this._CAPTURE_RADIUS;
                }
            };
        }
        if (captureRadPlus) {
            captureRadPlus.onclick = () => {
                if (this._CAPTURE_RADIUS < 5) { // макс 5 (11x11)
                    this._CAPTURE_RADIUS++;
                    captureRadVal.textContent = this._CAPTURE_RADIUS;
                }
            };
        }
        if (captureRadVal) {
            captureRadVal.onclick = () => {
                this._CAPTURE_RADIUS = 1;
                captureRadVal.textContent = this._CAPTURE_RADIUS;
            };
        }
        const ballsBtnEd = document.getElementById('mh-balls-toggle-editor');
        if (ballsBtnEd) ballsBtnEd.onclick = () => {
            this._USE_BALLS = !this._USE_BALLS;
            ballsBtnEd.textContent = this._USE_BALLS ? '⚽✅' : '⚽⛔';
            ballsBtnEd.style.borderColor = this._USE_BALLS ? 'var(--accent)' : 'rgba(255,255,255,0.1)';
            if (!this._USE_BALLS) {
                this._balls = []; // Убираем все шары, если выключено
            }
        };

        if (collBtnEd) collBtnEd.onclick = () => {
            this._USE_COLLISIONS = !this._USE_COLLISIONS;
            collBtnEd.textContent = this._USE_COLLISIONS ? '🥁✅' : '🥁⛔';
            collBtnEd.style.borderColor = this._USE_COLLISIONS ? 'var(--accent)' : 'rgba(255,255,255,0.1)';
        };

        const dockBtn = document.getElementById('mh-dock-leaderboard-btn');
        if (dockBtn) {
            dockBtn.addEventListener('click', () => {
                this._toggleFloatingLeaderboard();
            });
        }

        const dockChatBtn = document.getElementById('mh-dock-chat-btn');
        if (dockChatBtn) {
            dockChatBtn.addEventListener('click', () => {
                this._toggleFloatingMarquee();
            });
        }

        // Раздел Атака
        const sqRadVal = document.getElementById('mh-squad-radius-val-editor');
        document.getElementById('mh-squad-radius-minus').onclick = () => {
            if (this._SQUAD_RADIUS > 2) this._SQUAD_RADIUS--;
            sqRadVal.textContent = this._SQUAD_RADIUS;
        };
        document.getElementById('mh-squad-radius-plus').onclick = () => {
            if (this._SQUAD_RADIUS < 15) this._SQUAD_RADIUS++;
            sqRadVal.textContent = this._SQUAD_RADIUS;
        };
        sqRadVal.onclick = () => {
            this._SQUAD_RADIUS = 10;
            sqRadVal.textContent = this._SQUAD_RADIUS;
        };

        const sqSpeedVal = document.getElementById('mh-squad-speed-val-editor');
        document.getElementById('mh-squad-speed-minus').onclick = () => {
            if (this._SQUAD_SPEED_BASE > 0.3) this._SQUAD_SPEED_BASE -= 0.2;
            this._SQUAD_SPEED_BASE = parseFloat(this._SQUAD_SPEED_BASE.toFixed(1));
            sqSpeedVal.textContent = this._SQUAD_SPEED_BASE;
        };
        document.getElementById('mh-squad-speed-plus').onclick = () => {
            if (this._SQUAD_SPEED_BASE < 5) this._SQUAD_SPEED_BASE += 0.2;
            this._SQUAD_SPEED_BASE = parseFloat(this._SQUAD_SPEED_BASE.toFixed(1));
            sqSpeedVal.textContent = this._SQUAD_SPEED_BASE;
        };
        sqSpeedVal.onclick = () => {
            this._SQUAD_SPEED_BASE = 1;
            sqSpeedVal.textContent = this._SQUAD_SPEED_BASE;
        };

        const sqAmtBtn = document.getElementById('mh-squad-amount-toggle-editor');
        if (sqAmtBtn) {
            const icons = ['☄️✅', '☄️⛔', '☄️⭕', '☄️🔘'];
            // Синхронизируем текст при инициализации (на случай если дефолт поменяется)
            sqAmtBtn.textContent = icons[this._SQUAD_VISIBILITY];

            sqAmtBtn.onclick = () => {
                this._SQUAD_VISIBILITY = (this._SQUAD_VISIBILITY + 1) % 4;
                sqAmtBtn.textContent = icons[this._SQUAD_VISIBILITY];
                // Подсвечиваем если не равно "Никогда" (режим 1)
                sqAmtBtn.style.borderColor = (this._SQUAD_VISIBILITY === 1) ? 'rgba(255,255,255,0.1)' : 'var(--accent)';
                this.playSound('ui_click');
            };
        }

        const dsBtn = document.getElementById('mh-dynamic-start-toggle-editor');
        if (dsBtn) dsBtn.onclick = () => {
            this._USE_DYNAMIC_START = !this._USE_DYNAMIC_START;
            dsBtn.textContent = this._USE_DYNAMIC_START ? '🛡️✅' : '🛡️⛔';
            dsBtn.style.borderColor = this._USE_DYNAMIC_START ? 'var(--accent)' : 'rgba(255,255,255,0.1)';
        };

        // Кнопка перезапуска
        const btnRestart = document.getElementById('mh-btn-restart');
        if (btnRestart) {
            btnRestart.onclick = () => this._restartGame();
            btnRestart.onmouseover = () => { btnRestart.style.background = 'var(--accent)'; btnRestart.style.color = 'black'; };
            btnRestart.onmouseout = () => { btnRestart.style.background = ''; btnRestart.style.color = ''; };
        }

        // Переключатели в редакторе (ВКЛАДКИ 🛠️ 🖇️)
        const et1 = document.getElementById('mh-editor-toggle-1');
        const et2 = document.getElementById('mh-editor-toggle-2');
        const eTab1 = document.getElementById('mh-editor-tab-1');
        const eTab2 = document.getElementById('mh-editor-tab-2');

        if (et1) et1.onclick = () => {
            et1.classList.add('active');
            et2?.classList.remove('active');
            if (eTab1) eTab1.style.display = 'flex';
            if (eTab2) eTab2.style.display = 'none';
        };

        if (et2) et2.onclick = () => {
            et2.classList.add('active');
            et1?.classList.remove('active');
            if (eTab1) eTab1.style.display = 'none';
            if (eTab2) eTab2.style.display = 'flex';
        };

        // Переключатели в инфо-окне
        const t1 = document.getElementById('mh-toggle-1');
        const t2 = document.getElementById('mh-toggle-2');
        const tabLeaderboard = document.getElementById('mh-tab-leaderboard');
        const tabChat = document.getElementById('mh-tab-chat');

        if (t1) t1.onclick = () => {
            t1.classList.add('active');
            t2?.classList.remove('active');
            if (tabLeaderboard) tabLeaderboard.style.display = 'flex';
            if (tabChat) tabChat.style.display = 'none';
        };

        const baseToggle = document.getElementById('mh-base-toggle-editor');
        if (baseToggle) baseToggle.onclick = () => {
            this._USE_BASES = !this._USE_BASES;
            baseToggle.textContent = this._USE_BASES ? '🏠✅' : '🏠⛔';
            baseToggle.classList.toggle('active', this._USE_BASES);
        };

        const ballVisToggle = document.getElementById('mh-balls-visible-editor');
        if (ballVisToggle) ballVisToggle.onclick = () => {
            this._SHOW_BALLS_VISUAL = !this._SHOW_BALLS_VISUAL;
            ballVisToggle.textContent = this._SHOW_BALLS_VISUAL ? '🏐✅' : '🏐⛔';
            ballVisToggle.classList.toggle('active', this._SHOW_BALLS_VISUAL);
        };

        const ssBtn = document.getElementById('mh-start-soldiers-btn');
        if (ssBtn) ssBtn.onclick = () => {
            this._START_SOLDIERS += 10;
            if (this._START_SOLDIERS > 100) this._START_SOLDIERS = 0;
            ssBtn.textContent = `🛡️ ${this._START_SOLDIERS}`;
        };

        const prodToggle = document.getElementById('mh-prod-toggle-editor');
        if (prodToggle) prodToggle.onclick = () => {
            this._PER_BASE_PRODUCTION = !this._PER_BASE_PRODUCTION;
            prodToggle.textContent = this._PER_BASE_PRODUCTION ? '🪇✅' : '🪇⛔';
            prodToggle.classList.toggle('active-val', this._PER_BASE_PRODUCTION);
        };

        const gridToggle = document.getElementById('mh-grid-toggle-editor');
        if (gridToggle) gridToggle.onclick = () => {
            this._SHOW_GRID = !this._SHOW_GRID;
            gridToggle.textContent = this._SHOW_GRID ? '🥅✅' : '🥅⛔';
            gridToggle.style.borderColor = this._SHOW_GRID ? 'var(--accent)' : 'rgba(255,255,255,0.1)';
        };

        const bgColorInp = document.getElementById('mh-bg-color-editor');
        const bgColorPrev = document.getElementById('mh-bg-color-preview');
        if (bgColorInp) {
            bgColorInp.oninput = (e) => {
                this._BG_COLOR = e.target.value;
                if (bgColorPrev) bgColorPrev.style.background = this._BG_COLOR;
            };
        }

        if (t2) t2.onclick = () => {
            t2.classList.add('active');
            t1?.classList.remove('active');
            if (tabLeaderboard) tabLeaderboard.style.display = 'none';
            if (tabChat) tabChat.style.display = 'flex';
        };

        // Ресайз
        window.addEventListener('resize', () => this._initCanvas());

        // Инициализация Таба Компонентов
        this._updateComponentTab();
    },

    _updateComponentTab() {
        const baseSel = document.getElementById('mh-comp-base-ava');
        const helpSel = document.getElementById('mh-comp-helper-ava');
        if (!baseSel || !helpSel) return;

        const modules = window.MODUL_REGISTRY || [];
        // Фильтруем те, у которых есть генераторы в глобальной видимости
        const available = modules.filter(m => this._getGenerator(m.id));

        const optionsHtml = available.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('');

        baseSel.innerHTML = optionsHtml;
        helpSel.innerHTML = optionsHtml;

        baseSel.value = this._baseAvatarModule;
        helpSel.value = this._helperAvatarModule;

        baseSel.onchange = (e) => { this._baseAvatarModule = e.target.value; };
        helpSel.onchange = (e) => { this._helperAvatarModule = e.target.value; };
    },

    _restartGame() {
        if (this._restarting) return;
        this._restarting = true;

        const container = document.getElementById('mh-canvas-container');
        if (!container) {
            this._doActualReset();
            this._restarting = false;
            return;
        }

        let overlay = document.getElementById('mh-restart-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mh-restart-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                z-index: 10000; font-family: 'Outfit', sans-serif;
                color: #fff; backdrop-filter: blur(5px);
            `;
            container.appendChild(overlay);
        }
        overlay.style.display = 'flex';

        // Мгновенно очищаем состояние и поле — пока идёт отсчёт
        this._clearState();

        // Добавляем стили анимации если их нет
        if (!document.getElementById('mh-restart-styles')) {
            const style = document.createElement('style');
            style.id = 'mh-restart-styles';
            style.innerHTML = `
                @keyframes mh-count-in {
                    0% { transform: scale(2); opacity: 0; filter: blur(10px); }
                    30% { transform: scale(1); opacity: 1; filter: blur(0px); }
                    100% { transform: scale(0.8); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        let count = 5;
        const updateCountdown = () => {
            if (count > 0) {
                overlay.innerHTML = `
                    <div style="font-size: 1.2rem; text-transform: uppercase; letter-spacing: 4px; color: #00ffcc; margin-bottom: 20px; font-weight: bold; text-shadow: 0 0 10px rgba(0,255,204,0.3);">NEW GAME BEGINS</div>
                    <div key="${count}" style="font-size: 12rem; font-weight: 950; background: linear-gradient(to bottom, #fff, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; animation: mh-count-in 1s ease-out forwards; text-shadow: 0 0 30px rgba(59,130,246,0.3);">${count}</div>
                    <div style="margin-top: 20px; width: 200px; height: 2px; background: rgba(255,255,255,0.1); position: relative; overflow: hidden; border-radius: 1px;">
                        <div style="position: absolute; left: 0; top: 0; height: 100%; background: #3b82f6; width: ${(count / 5) * 100}%; transition: width 1s linear;"></div>
                    </div>
                `;
                count--;
                setTimeout(updateCountdown, 1000);
            } else {
                overlay.style.display = 'none';
                this._doActualReset();
                this._restarting = false;
            }
        };
        updateCountdown();
    },

    _clearState() {
        // Мгновенная очистка логики и данных
        this._balls = [];
        this._players = new Map();
        this._particles = [];
        this._avatarCache = new Map();
        this._bases = [];
        this._squads = [];
        this._grid = []; // <--- Очищаем сетку, чтобы _initCanvas пересоздал её пустой
        this._baseLobby = new Map();
        this._availableColors = [...this._PALETTE];

        // Сброс истории в генераторах (если поддерживают)
        if (typeof MODUL_REGISTRY !== 'undefined') {
            const mods = [MODUL_REGISTRY[this._baseAvatarModule], MODUL_REGISTRY[this._helperAvatarModule]];
            mods.forEach(m => {
                if (m && m.generator && typeof m.generator.reset === 'function') {
                    m.generator.reset();
                }
            });
        }

        // Сброс поля (сетка становится пустой)
        this._initCanvas();

        // Очистка UI
        this._renderLeaderboard([]);
        const chat = document.getElementById('mh-chat-messages');
        if (chat) chat.innerHTML = '';

        this._addChatMessage("SYSTEM", "NEW GAME STARTED");
    },

    _doActualReset() {
        // В MapH основная работа по очистке уже сделана в _clearState.
        // Здесь можно добавить финальную инициализацию, если потребуется.
        // Сейчас просто убеждаемся, что канвас готов.
        if (this._ctx) {
            this._ctx.clearRect(0, 0, this._ctx.canvas.width, this._ctx.canvas.height);
        }
    },

    _connectSocket() {
        try {
            const socket = (window.location.protocol === 'file:')
                ? io('http://localhost:3000')
                : io();
            this._socket = socket;

            socket.on('connect', () => {
                console.log('[MapH] Сокет успешно подключён к серверу');
            });

            socket.on('tiktok-msg', data => {
                const text = data.text.trim();
                const userName = data.nickname || data.user;

                console.log(`[MapH] Входящее сообщение от ${userName}: "${text}"`);

                this._processChat(userName, text, data.avatar);
                this._addChatMessage(userName, text);
            });

            socket.on('tiktok-member', data => {
                if (data.type === 'leave') {
                    const userName = data.nickname || data.user;
                    console.log(`[MapH] Игрок покинул стрим: ${userName}`);
                    this._removePlayer(userName);
                }
            });
        } catch (e) {
            console.error('[MapH] Ошибка при подключении сокета:', e);
        }
    }
};

// ─── РЕГИСТРАЦИЯ В ОБОЛОЧКЕ ──────────────────────────────────────────────────
if (typeof GameShell !== 'undefined') {
    GameShell.register('maph', MapHGame);
} else {
    console.error('[MapH] GameShell не найден!');
}
