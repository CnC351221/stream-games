/**
 * PEEKH — Игровой модуль (версия для новой оболочки)
 * Регистрируется в GameShell и заполняет 3 окна при вызове init()
 */
'use strict';

// ─── КОНФИГУРАЦИЯ ────────────────────────────────────────────────────────────
const TOTAL_MONSTERS = 66;
const SHOW_TIME = 3000;
const MONSTER_IDS = Array.from({ length: TOTAL_MONSTERS }, (_, i) => (i + 1).toString().padStart(2, '0'));
const TARGET_LABELS = ["НАЙДИ МЕНЯ", "FIND ME", "¡BÚSCAME!", "나를 찾아라", "ابحث عني"];
const NAME_SYLLABLES = ["Ka", "Lu", "Ro", "Sa", "Te", "Vo", "Ni", "Pa", "Zu"];

// ─── СОСТОЯНИЕ ИГРЫ ──────────────────────────────────────────────────────────
let peekh_foundMonsters = new Set();
let peekh_foundByWhom = {};
let peekh_targetMonsterId = null;
let peekh_findCount = 0;
let peekh_recentWinners = [];
let peekh_userScores = {};
let peekh_monsterSeeds = {};
let peekh_availableMonsters = [...MONSTER_IDS];
let peekh_restartDelay = 30;
let peekh_waitingForStart = false;
let peekh_isCelebrating = false;
let peekh_currentLabelIndex = 0;
let peekh_activeModifiers = { '1': false, '2': true, '3': true, '4': false };
let peekh_botAvatarModule = 'Gen_Txt';
let peekh_gameAvatarModule = 'Gen_Mos';

// ─── ЗВУКОВОЙ ДВИЖОК ─────────────────────────────────────────────────────────
const PeekHSound = {
    ctx: null,
    enabled: true,
    volume: 0.3,
    init() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    },
    play(type) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        if (type === 'found') {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(this.volume, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'newTarget') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(330, now + 0.1);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(this.volume * 0.4, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        } else if (type === 'gameOver') {
            [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
                const s = this.ctx.createOscillator(), g = this.ctx.createGain();
                s.connect(g); g.connect(this.ctx.destination);
                s.frequency.setValueAtTime(f, now + i * 0.15);
                g.gain.setValueAtTime(0.0001, now + i * 0.15);
                g.gain.linearRampToValueAtTime(this.volume, now + i * 0.15 + 0.05);
                g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 0.5);
                s.start(now + i * 0.15); s.stop(now + i * 0.15 + 0.5);
            });
        } else if (type === 'tick') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(this.volume * 0.2, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
            osc.start(now); osc.stop(now + 0.05);
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(this.volume * 0.1, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        }
    }
};

// ─── МОДУЛЬ ИГРЫ ─────────────────────────────────────────────────────────────
const PeekHGame = {

    _socket: null,
    _containers: null,

    /**
     * Вызывается оболочкой при выборе игры.
     * @param {{ winEditor, winStream, winInfo }} containers
     */
    init(containers) {
        this._containers = containers;
        localStorage.setItem('sg-last-game', 'peekh');

        // Сброс состояния
        peekh_foundMonsters = new Set();
        peekh_foundByWhom = {};
        peekh_targetMonsterId = null;
        peekh_findCount = 0;
        peekh_recentWinners = [];
        peekh_userScores = {};
        peekh_monsterSeeds = {};
        peekh_availableMonsters = [...MONSTER_IDS];
        peekh_restartDelay = 30;
        peekh_waitingForStart = false;
        peekh_isCelebrating = false;

        PeekHSound.init();

        // Строим HTML для 3 окон
        this._buildEditorWindow(containers.winEditor);
        this._buildStreamWindow(containers.winStream);
        this._buildInfoWindow(containers.winInfo);

        // Инициализируем игровую логику
        this._createGrid();
        this._setupGameListeners();
        this._connectSocket();

        // Ротация текста цели
        this._labelInterval = setInterval(() => this._rotateTargetLabel(), 30000);
    },

    /**
     * Вызывается при смене игры — уничтожает всё что создали.
     */
    destroy() {
        if (this._socket) {
            this._socket.disconnect();
            this._socket = null;
        }
        if (this._labelInterval) {
            clearInterval(this._labelInterval);
        }
    },

    /**
     * Возвращает DOM-элемент с настройками игры для панели.
     */
    getSettings() {
        // Раньше здесь были настройки, теперь они все в окне EDITOR.
        const wrap = document.createElement('div');
        return wrap;
    },

    // ─── СТРОИТЕЛИ HTML ОКОН ────────────────────────────────────────────────

    _buildEditorWindow(win) {
        win.innerHTML = `
        <div class="sidebar-content">
            <div class="editor-info-header">
                <button id="pk-btn-restart" class="editor-indicator" style="cursor:pointer; border:none; transition:all 0.2s; outline:none; font-family:inherit;" title="Start Over (5 sec)">EDITOR</button>
                <div class="info-toggles">
                    <button id="pk-editor-toggle-1" class="info-toggle-btn active" title="Настройки">🛠️</button>
                    <button id="pk-editor-toggle-2" class="info-toggle-btn" title="Компоненты">🖇️</button>
                </div>
            </div>

            <!-- TAB 1: SETTINGS -->
            <div id="pk-editor-tab-1" class="info-tab">
                <div class="editor-scroll-area">
                    <div class="settings-section">
                        <div class="section-title">Выбор режима</div>
                        <div class="control-group">
                            <div class="corner-selector" id="game-mode-selector">
                                <button class="corner-btn" data-mode="1" title="Аватар при победе">1</button>
                                <button class="corner-btn active" data-mode="2" title="Фон ячейки — аватар">2</button>
                                <button class="corner-btn active" data-mode="3" title="Режим зачистки">3</button>
                                <button class="corner-btn" data-mode="4" title="Авто-рестарт">4</button>
                            </div>
                            <div id="auto-restart-container" class="control-group" style="margin-top:15px;">
                                <span class="hint">Авто-рестарт (сек): <span id="restart-delay-val">30</span></span>
                                <input type="range" id="restart-delay-slider" min="5" max="60" step="5" value="30" class="size-slider">
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <div class="section-title">Настройки UI</div>
                        <div class="control-group">
                            <span class="hint">Отступы сеток</span>
                            <input type="range" id="grid-gap-slider" min="0" max="20" value="4" class="size-slider">
                        </div>
                        <div class="control-group">
                            <span class="hint">Скругление</span>
                            <input type="range" id="radius-slider" min="0" max="50" value="5" class="size-slider">
                        </div>
                        <div class="control-group">
                            <span class="hint">Размер №</span>
                            <input type="range" id="number-size-slider" min="6" max="24" value="8" class="size-slider">
                        </div>
                        <div class="control-group">
                            <span class="hint">Прозрачность</span>
                            <input type="range" id="monster-opacity-slider" min="0" max="100" value="100" class="size-slider">
                        </div>
                        <div class="control-group">
                            <span class="hint">Расположение №</span>
                            <div class="corner-selector">
                                <button class="corner-btn" data-corner="tl">↖</button>
                                <button class="corner-btn" data-corner="tr">↗</button>
                                <button class="corner-btn" data-corner="bl">↙</button>
                                <button class="corner-btn active" data-corner="br">↘</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 2: MODULES / COMPONENTS -->
            <div id="pk-editor-tab-2" class="info-tab" style="display:none;">
                <div class="editor-scroll-area">
                    <div class="settings-section" style="padding:10px;">
                        <div class="section-title" style="margin-bottom:12px;">Связи с модулями</div>
                        
                        <div class="control-group" style="margin-bottom:15px; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                            <span class="hint" style="display:block; margin-bottom:6px; color:var(--accent);">👾 Аватары игры (монстры)</span>
                            <select id="pk-comp-game-ava" class="sidebar-input" style="width:100%; height:32px; background:#2a2438; border:1px solid rgba(255,255,255,0.1); color:white;"></select>
                            <span class="hint" style="font-size:0.6rem; margin-top:4px; opacity:0.5;">Модуль для генерации основных целей игры</span>
                        </div>

                        <div class="control-group" style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                            <span class="hint" style="display:block; margin-bottom:6px; color:var(--accent);">🤖 Аватары ботов</span>
                            <select id="pk-comp-bot-ava" class="sidebar-input" style="width:100%; height:32px; background:#2a2438; border:1px solid rgba(255,255,255,0.1); color:white;"></select>
                            <span class="hint" style="font-size:0.6rem; margin-top:4px; opacity:0.5;">Модуль для аватаров ботов и чат-команд</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>`;
    },

    _buildStreamWindow(win) {
        win.innerHTML = `
        <div id="grid-viewport" class="grid-viewport">
            <div id="monster-grid" class="monster-grid"></div>
        </div>`;
    },

    _buildInfoWindow(win) {
        win.innerHTML = `
        <div class="sidebar-content">
            <div class="stream-info">
                <div class="live-indicator">INFO</div>
                <div class="info-toggles">
                    <button id="pk-toggle-1" class="info-toggle-btn active" title="Рейтинг">🏆</button>
                    <button id="pk-toggle-2" class="info-toggle-btn" title="Чат">🤖</button>
                </div>
            </div>

            <div id="pk-tab-leaderboard" class="info-tab">
                <div class="leaderboard-block">
                    <div class="leaderboard-header">🏆 ТОП РЕЙТИНГ</div>
                    <div id="global-leaderboard" class="leaderboard-list"></div>
                </div>
            </div>

            <div id="pk-tab-chat" class="info-tab" style="display:none;">
                <div id="chat-messages" class="chat-messages">
                </div>
            </div>

            <div class="info-footer" style="margin-top:auto; padding-top:14px; margin-top:14px; border-top:1px solid rgba(255,255,255,0.1);">
                <div class="simulation-row">
                    <input type="text" id="sim-input" placeholder="Напр: 57 Anonymous" maxlength="20">
                    <button id="sim-send">🚀</button>
                    <button id="auto-find-btn" class="auto-find-btn">🎲</button>
                </div>
            </div>
        </div>`;
    },

    // ─── ИГРОВАЯ ЛОГИКА ──────────────────────────────────────────────────────

    _createGrid() {
        const grid = document.getElementById('monster-grid');
        if (!grid) return;

        peekh_targetMonsterId = this._pickNewTargetId();
        this._updateTargetDisplay();

        grid.classList.add('num-br');
        if (peekh_activeModifiers['2']) grid.classList.add('show-avatars');

        let monsterCounter = 1;
        const slotsToSkip = new Set([28, 33, 34]);

        for (let slot = 1; slot <= 72; slot++) {
            if (slotsToSkip.has(slot)) continue;

            const card = document.createElement('div');

            if (slot === 27) {
                card.className = 'monster-card target-area';
                card.id = 'monster-target';
                card.innerHTML = `
                    <div class="target-label">НАЙДИ МЕНЯ</div>
                    <div class="success-label">№00</div>
                    <div class="card-shadow"></div>
                    <img src="" class="monster-img grayscale" alt="Target"
                         style="--breathing-delay:-1s;--breathing-duration:5s;">`;
                grid.appendChild(card);
                continue;
            }

            if (slot === 39) {
                card.className = 'winners-podium';
                card.id = 'winners-podium';
                grid.appendChild(card);
                continue;
            }

            if (slot === 40) continue;

            if (monsterCounter <= TOTAL_MONSTERS) {
                const id = monsterCounter < 10 ? `0${monsterCounter}` : `${monsterCounter}`;
                card.className = 'monster-card';
                card.id = `monster-${id}`;
                const delay = (Math.random() * -5).toFixed(2);
                const duration = (3 + Math.random() * 3).toFixed(2);
                peekh_monsterSeeds[id] = id;
                
                const gen = this._getGenerator(peekh_gameAvatarModule);
                const monsterImage = (gen && gen.generate) ? gen.generate(peekh_monsterSeeds[id]) : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${id}`;
                
                card.innerHTML = `
                    <div class="number">${id}</div>
                    <div class="bg-number">${id}</div>
                    <div class="avatar-holder"></div>
                    <div class="card-shadow"></div>
                    <img src="${monsterImage}" class="monster-img" alt="Monster ${id}"
                         style="--breathing-delay:${delay}s;--breathing-duration:${duration}s;">`;
                monsterCounter++;
                grid.appendChild(card);
            }
        }

        this._syncTargetImage();
        this._updateWinnersPodium();
    },

    _pickNewTargetId() {
        if (peekh_availableMonsters.length === 0) return null;
        if (peekh_availableMonsters.length === 1) return peekh_availableMonsters[0];
        let newId;
        do {
            newId = peekh_availableMonsters[Math.floor(Math.random() * peekh_availableMonsters.length)];
        } while (newId === peekh_targetMonsterId && peekh_availableMonsters.length > 1);
        return newId;
    },

    _updateTargetDisplay() {
        const simInput = document.getElementById('sim-input');
        if (simInput) simInput.placeholder = `Напр: ${peekh_targetMonsterId} Anonymous`;
    },

    _syncTargetImage() {
        const targetEl = document.getElementById('monster-target');
        if (!targetEl || !peekh_targetMonsterId) return;
        const targetImg = targetEl.querySelector('.monster-img');
        const gridCard = document.getElementById(`monster-${peekh_targetMonsterId}`);
        if (gridCard) {
            const gridImg = gridCard.querySelector('.monster-img');
            if (gridImg) { targetImg.src = gridImg.src; return; }
        }
        const gen = this._getGenerator(peekh_gameAvatarModule);
        targetImg.src = (gen && gen.generate) ? gen.generate(peekh_monsterSeeds[peekh_targetMonsterId] || peekh_targetMonsterId) : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${peekh_targetMonsterId}`;
    },

    _getGenerator(id) {
        if (!window.MODUL_REGISTRY) return null;
        const mod = window.MODUL_REGISTRY.find(m => m.id === id);
        return mod ? mod.generator : null;
    },

    _attemptFind(monsterId, username, avatarUrl = null, platform = 'system') {
        const id = monsterId.toString().padStart(2, '0');
        if (id !== peekh_targetMonsterId || peekh_isCelebrating) return;

        PeekHSound.play('found');

        const monsterEl = document.getElementById(`monster-${id}`);
        if (!monsterEl || monsterEl.classList.contains('found')) return;

        peekh_findCount++;
        const replacementDelay = 1500;
        const monsterImg = monsterEl.querySelector('.monster-img');

        monsterEl.classList.add('found');

        const avatarHolder = monsterEl.querySelector('.avatar-holder');
        if (avatarHolder) {
            avatarHolder.innerHTML = this._getAvatarHtml(username, avatarUrl, 'grid-avatar');
            avatarHolder.classList.add('captured');
        }

        if (peekh_activeModifiers['1']) monsterEl.classList.add('temp-avatar');
        monsterImg.classList.add('replacing');

        setTimeout(() => {
            if (peekh_activeModifiers['3']) {
                peekh_availableMonsters = peekh_availableMonsters.filter(m => m !== id);
                monsterImg.classList.add('vanished');
                if (peekh_availableMonsters.length === 0) setTimeout(() => this._showGameOverScreen(), 1000);
            } else {
                const newSeed = `${id}-${Date.now()}`;
                peekh_monsterSeeds[id] = newSeed;
                const gen = this._getGenerator(peekh_gameAvatarModule);
                monsterImg.src = (gen && gen.generate) ? gen.generate(newSeed) : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${newSeed}`;
                monsterImg.classList.remove('vanished');
            }
            monsterImg.classList.remove('replacing');
            if (!monsterImg.classList.contains('vanished')) monsterImg.classList.add('new-arrival');
            monsterEl.classList.remove('found', 'temp-avatar');
            setTimeout(() => monsterImg.classList.remove('new-arrival'), 600);
        }, replacementDelay);

        const targetEl = document.getElementById('monster-target');
        if (targetEl) {
            targetEl.classList.add('found', 'celebrate-card');
            const label = targetEl.querySelector('.target-label');
            const successLabel = targetEl.querySelector('.success-label');
            if (label && successLabel) {
                label.classList.add('hidden');
                successLabel.innerText = `№${id}`;
                successLabel.classList.add('visible');
            }
            this._spawnConfetti(targetEl);
            peekh_isCelebrating = true;
        }

        setTimeout(() => {
            if (peekh_activeModifiers['3'] && peekh_availableMonsters.length === 0) {
                peekh_isCelebrating = false;
                return;
            }
            peekh_targetMonsterId = this._pickNewTargetId();
            if (peekh_targetMonsterId) {
                this._updateTargetDisplay();
                if (targetEl) {
                    targetEl.classList.remove('found', 'celebrate-card');
                    this._syncTargetImage();
                    PeekHSound.play('newTarget');
                    const label = targetEl.querySelector('.target-label');
                    const successLabel = targetEl.querySelector('.success-label');
                    if (label && successLabel) {
                        label.classList.remove('hidden');
                        label.innerText = TARGET_LABELS[peekh_currentLabelIndex];
                        successLabel.classList.remove('visible');
                    }
                }
            }
            peekh_isCelebrating = false;
        }, replacementDelay);

        if (!peekh_userScores[username]) peekh_userScores[username] = { score: 0, avatar: avatarUrl };
        peekh_userScores[username].score += 1;
        if (avatarUrl) peekh_userScores[username].avatar = avatarUrl;

        this._updateWinnersPodium(username);
        this._updateGlobalLeaderboard();

        if (window.gameSocket) {
            window.gameSocket.emit('monster-found', { username, monsterId: id, platform });
        }
    },

    _addChatMessage(user, text, type = '') {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        const msg = document.createElement('div');
        msg.className = `msg ${type}`;
        msg.innerHTML = `<span class="user">${user}:</span> <span class="${type}">${text}</span>`;
        chatMessages.prepend(msg);
        if (chatMessages.children.length > 20) chatMessages.lastChild.remove();
    },

    _getAvatarHtml(name, avatarUrl, className = 'podium-avatar') {
        if (avatarUrl && name !== 'Anonymous') {
            return `<img src="${avatarUrl}" class="${className}" alt="${name}">`;
        }
        
        const gen = this._getGenerator(peekh_botAvatarModule);
        if (gen && gen.generate) {
            return `<img src="${gen.generate(name)}" class="${className}" alt="${name}">`;
        }

        const firstLetter = (name || "?").charAt(0).toUpperCase();
        const colors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const color = colors[Math.abs(hash) % colors.length];

        return `<div class="${className}-placeholder" style="background-color: ${color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 950; font-family: 'Outfit', sans-serif;">${firstLetter}</div>`;
    },

    _updateWinnersPodium(newWinner) {
        if (newWinner) {
            peekh_recentWinners = [newWinner]; // Only show the last winner
        }
        const podium = document.getElementById('winners-podium');
        if (!podium) return;
        const allSorted = Object.keys(peekh_userScores).sort((a, b) => peekh_userScores[b].score - peekh_userScores[a].score);
        podium.innerHTML = '';
        const medals = ["🥇", "🥈", "🥉"];
        peekh_recentWinners.forEach((name, index) => {
            const tag = document.createElement('div');
            tag.className = 'winner-tag';
            if (index === 0 && newWinner) tag.classList.add('new-winner');
            const userData = peekh_userScores[name] || { score: 0, avatar: null };
            const globalIndex = allSorted.indexOf(name);
            const isLowRank = globalIndex >= 3;
            if (isLowRank) tag.classList.add('low-rank');
            const rankText = globalIndex < 3 ? medals[globalIndex] : `#${globalIndex + 1}`;
            const avatarHtml = this._getAvatarHtml(name, userData.avatar, 'podium-avatar');

            tag.innerHTML = `
                <div class="podium-top-row">
                    <span class="podium-rank ${isLowRank ? 'numeric' : ''}">${rankText}</span>
                    ${avatarHtml}
                    <span class="podium-score">${userData.score}</span>
                </div>
                <div class="podium-bottom-row">
                    <span class="podium-name">${name}</span>
                </div>
            `;
            podium.appendChild(tag);
        });
    },

    _updateGlobalLeaderboard() {
        const leaderboard = document.getElementById('global-leaderboard');
        if (!leaderboard) return;
        const sorted = Object.entries(peekh_userScores).sort(([, a], [, b]) => b.score - a.score).slice(0, 100);
        leaderboard.innerHTML = '';
        sorted.forEach(([name, data], index) => {
            const item = document.createElement('div');
            item.className = 'leader-item';
            const isTop3 = index < 3;
            if (isTop3) item.classList.add('top-three');
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
            const rankText = medal || `#${index + 1}`;
            const avatarHtml = this._getAvatarHtml(name, data.avatar, 'leader-avatar');
            item.innerHTML = `${avatarHtml}<span class="leader-rank ${!isTop3 ? 'numeric' : ''}">${rankText}</span><span class="leader-name">${name}</span><span class="leader-score">${data.score}</span>`;
            leaderboard.appendChild(item);
        });
        this._updateWinnersPodium();
    },

    _showGameOverScreen() {
        PeekHSound.play('gameOver');
        const existing = document.querySelector('.game-over-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';
        const allSorted = Object.entries(peekh_userScores).sort(([, a], [, b]) => b.score - a.score).slice(0, 10);
        let rankingsHtml = '<div class="leaderboard-list" style="width:100%;border:none;background:transparent;">';
        if (allSorted.length === 0) {
            rankingsHtml += '<p style="padding:20px;color:var(--text-dim);">Победителей нет...</p>';
        } else {
            allSorted.forEach(([name, data], index) => {
                const isTop3 = index < 3;
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
                const rankText = medal || `#${index + 1}`;
                const avatarHtml = this._getAvatarHtml(name, data.avatar, 'leader-avatar');
                rankingsHtml += `<div class="leader-item ${isTop3 ? 'top-three' : ''}" style="margin-bottom:5px;">${avatarHtml}<span class="leader-rank ${!isTop3 ? 'numeric' : ''}">${rankText}</span><span class="leader-name">${name}</span><span class="leader-score">${data.score}</span></div>`;
            });
        }
        rankingsHtml += '</div>';

        overlay.innerHTML = `
            <h2 style="font-size:1.5rem;margin:20px 0;color:var(--accent);text-align:center;">ИГРА ОКОНЧЕНА</h2>
            <div style="text-align:left;width:100%;display:flex;flex-direction:column;flex:1;max-width:420px;margin:0 auto;min-height:0;">
                <h3 style="color:var(--text-dim);font-size:1rem;margin-bottom:15px;padding-left:10px;">Топ-10 Игроков:</h3>
                <div class="leaderboard-block" style="background:transparent;border:none;padding:0;box-shadow:none;">
                    ${rankingsHtml}
                </div>
            </div>
            <div id="restart-countdown" style="margin:15px 0;color:var(--accent);font-weight:bold;font-size:1.1rem;text-align:center;"></div>`;

        const viewport = document.getElementById('grid-viewport');
        if (viewport) viewport.appendChild(overlay);

        let timeLeft = peekh_restartDelay;
        const countdownEl = overlay.querySelector('#restart-countdown');
        const tick = () => {
            if (!document.querySelector('.game-over-overlay')) return;
            if (timeLeft > 0) {
                countdownEl.innerText = `Пауза: ${timeLeft} сек...`;
                if (timeLeft <= 5) PeekHSound.play('tick');
                timeLeft--;
                this._gameOverTimeout = setTimeout(tick, 1000);
            } else {
                if (peekh_activeModifiers['4']) { this._regenerateAll(); }
                else {
                    peekh_waitingForStart = true;
                    countdownEl.innerHTML = `💬 <span style="color:#fff;background:var(--accent);padding:0 10px;border-radius:4px;">#Start</span> ➡️ 🚀`;
                }
            }
        };
        tick();
    },

    _regenerateAll() {
        const existingOverlay = document.querySelector('.game-over-overlay');
        if (existingOverlay) existingOverlay.remove();

        peekh_waitingForStart = false;
        peekh_userScores = {};
        peekh_recentWinners = [];
        peekh_findCount = 0;
        peekh_availableMonsters = [...MONSTER_IDS];
        this._updateGlobalLeaderboard();

        const gen = this._getGenerator(peekh_gameAvatarModule);
        const now = Date.now();

        document.querySelectorAll('.monster-card:not(.target-area):not(.empty-ghost):not(.winners-podium)').forEach((card, index) => {
            card.classList.remove('found', 'temp-avatar');
            const ah = card.querySelector('.avatar-holder');
            if (ah) { ah.innerHTML = ''; ah.classList.remove('captured'); }
            const img = card.querySelector('.monster-img');
            if (img) {
                const id = card.id.replace('monster-', '');
                const newSeed = `${id}-${now}-${index}`;
                peekh_monsterSeeds[id] = newSeed;
                img.src = (gen && gen.generate) ? gen.generate(newSeed) : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${newSeed}`;
                img.classList.remove('vanished', 'replacing', 'new-arrival');
                img.style.visibility = 'visible';
            }
        });

        peekh_targetMonsterId = this._pickNewTargetId();
        this._updateTargetDisplay();
        this._syncTargetImage();

        const targetEl = document.getElementById('monster-target');
        if (targetEl) {
            targetEl.classList.remove('found', 'celebrate-card');
            const label = targetEl.querySelector('.target-label');
            const successLabel = targetEl.querySelector('.success-label');
            if (label && successLabel) {
                label.classList.remove('hidden');
                label.innerText = TARGET_LABELS[peekh_currentLabelIndex];
                successLabel.classList.remove('visible');
            }
        }
    },

    _spawnConfetti(element) {
        const colors = ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#38bdf8', '#4ade80'];
        const rect = element.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'confetti';
            const tx = (Math.random() - 0.5) * 400;
            const ty = (Math.random() - 0.5) * 400;
            const tr = Math.random() * 720;
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);
            p.style.setProperty('--tr', `${tr}deg`);
            p.style.cssText += `position:fixed;left:${cx}px;top:${cy}px;width:6px;height:6px;z-index:2000;`;
            const d = 0.8 + Math.random() * 1.2;
            p.style.animation = `confettiBurst ${d}s cubic-bezier(0.1,0.8,0.3,1) forwards`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), d * 1000);
        }
    },

    _rotateTargetLabel() {
        if (peekh_isCelebrating) return;
        peekh_currentLabelIndex = (peekh_currentLabelIndex + 1) % TARGET_LABELS.length;
        const label = document.querySelector('.target-label');
        if (label) {
            label.style.opacity = '0';
            setTimeout(() => {
                if (!peekh_isCelebrating) {
                    label.innerText = TARGET_LABELS[peekh_currentLabelIndex];
                    label.style.opacity = '1';
                }
            }, 500);
        }
    },

    _updateGenerationPool() {
        const shapeOpts = document.querySelectorAll('#shape-selector .eye-option, #pk-shape-selector .eye-option');
        const selectedShapes = [];
        MonsterGenerator.eyeShapeStates = {};
        shapeOpts.forEach(opt => {
            const val = parseInt(opt.dataset.val);
            if (opt.classList.contains('selected-white')) { selectedShapes.push(val); MonsterGenerator.eyeShapeStates[val] = 1; }
            else if (opt.classList.contains('selected-colored')) { selectedShapes.push(val); MonsterGenerator.eyeShapeStates[val] = 2; }
        });
        const selectedPupils = [...document.querySelectorAll('#pupil-selector .eye-option.selected-white, #pk-pupil-selector .eye-option.selected-white')].map(o => parseInt(o.dataset.val));
        const selectedMouths = [...document.querySelectorAll('#mouth-selector .eye-option.selected-white, #pk-mouth-selector .eye-option.selected-white')].map(o => parseInt(o.dataset.val));
        MonsterGenerator.allowedEyeShapes = selectedShapes.length > 0 ? selectedShapes : [0];
        MonsterGenerator.allowedPupilStyles = selectedPupils;
        MonsterGenerator.allowedMouthStyles = selectedMouths.length > 0 ? selectedMouths : [0];
    },

    _updateComponentTab() {
        const gameSel = document.getElementById('pk-comp-game-ava');
        const botSel = document.getElementById('pk-comp-bot-ava');
        if (!gameSel || !botSel) return;

        const modules = window.MODUL_REGISTRY || [];
        const available = modules.filter(m => this._getGenerator(m.id));

        const optionsHtml = available.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('');
        
        gameSel.innerHTML = optionsHtml;
        botSel.innerHTML = optionsHtml;

        gameSel.value = peekh_gameAvatarModule;
        botSel.value = peekh_botAvatarModule;

        gameSel.onchange = (e) => { peekh_gameAvatarModule = e.target.value; this._regenerateAll(); };
        botSel.onchange = (e) => { peekh_botAvatarModule = e.target.value; this._updateGlobalLeaderboard(); };
    },

    _restartGame() {
        if (this._pkRestarting) return;
        this._pkRestarting = true;

        // Сразу убираем экран окончания игры, если он есть
        const existingGameOver = document.querySelector('.game-over-overlay');
        if (existingGameOver) existingGameOver.remove();
        if (this._gameOverTimeout) { clearTimeout(this._gameOverTimeout); this._gameOverTimeout = null; }

        const viewport = document.getElementById('grid-viewport');
        if (!viewport) {
            this._doActualReset();
            this._pkRestarting = false;
            return;
        }

        let overlay = document.getElementById('pk-restart-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pk-restart-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                z-index: 10000; font-family: 'Outfit', sans-serif;
                color: #fff; backdrop-filter: blur(5px);
            `;
            viewport.appendChild(overlay);
        }
        overlay.style.display = 'flex';

        // Сразу очищаем все карточки — пока идёт отсчёт
        this._clearGrid();
        
        // СРАЗУ начинаем создавать новых монстров в фоне (пока идет 5..4..3..2..1)
        // Чтобы к моменту завершения отсчета всё уже было готово
        this._doActualReset();

        if (!document.getElementById('pk-restart-styles')) {
            const style = document.createElement('style');
            style.id = 'pk-restart-styles';
            style.innerHTML = `@keyframes pk-count-in {0% { transform: scale(2); opacity: 0; filter: blur(10px); } 30% { transform: scale(1); opacity: 1; filter: blur(0px); } 100% { transform: scale(0.8); opacity: 0; }}`;
            document.head.appendChild(style);
        }

        let count = 5;
        const updateCountdown = () => {
            if (count > 0) {
                overlay.innerHTML = `
                    <div style="font-size: 1.2rem; text-transform: uppercase; letter-spacing: 4px; color: #00ffcc; margin-bottom: 20px; font-weight: bold; text-shadow: 0 0 10px rgba(0,255,204,0.3);">NEW GAME BEGINS</div>
                    <div key="${count}" style="font-size: 12rem; font-weight: 950; background: linear-gradient(to bottom, #fff, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; animation: pk-count-in 1s ease-out forwards; text-shadow: 0 0 30px rgba(59,130,246,0.3);">${count}</div>
                    <div style="margin-top: 20px; width: 200px; height: 2px; background: rgba(255,255,255,0.1); position: relative; overflow: hidden; border-radius: 1px;">
                        <div style="position: absolute; left: 0; top: 0; height: 100%; background: #3b82f6; width: ${(count/5)*100}%; transition: width 1s linear;"></div>
                    </div>
                `;
                count--;
                setTimeout(updateCountdown, 1000);
            } else {
                // К этому моменту всё уже создано в фоне, просто убираем оверлей
                overlay.remove();
                this._pkRestarting = false;
            }
        };
        updateCountdown();
    },

    _clearGrid() {
        // Мгновенно очищаем состояние и все карточки визуально
        peekh_foundMonsters = new Set();
        peekh_foundByWhom = {};
        peekh_targetMonsterId = null;
        peekh_findCount = 0;
        peekh_recentWinners = [];
        peekh_userScores = {};
        peekh_monsterSeeds = {};
        peekh_availableMonsters = [...MONSTER_IDS];
        peekh_waitingForStart = false;
        peekh_isCelebrating = false;

        // Очищаем визуал карточек — убираем аватарки и сбрасываем классы
        document.querySelectorAll('.monster-card:not(.target-area):not(.empty-ghost):not(.winners-podium)').forEach(card => {
            card.classList.remove('found', 'temp-avatar');
            const ah = card.querySelector('.avatar-holder');
            if (ah) { ah.innerHTML = ''; ah.classList.remove('captured'); }
            const img = card.querySelector('.monster-img');
            if (img) {
                img.src = '';
                img.classList.remove('vanished', 'replacing', 'new-arrival');
                img.style.visibility = 'visible';
            }
        });

        // Очищаем UI
        this._updateGlobalLeaderboard();
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = '';
        this._addChatMessage("SYSTEM", "NEW GAME STARTED");

        // Очищаем центральный монстрик (цель)
        const targetEl = document.getElementById('monster-target');
        if (targetEl) {
            targetEl.classList.remove('found', 'celebrate-card');
            const targetImg = targetEl.querySelector('.monster-img');
            if (targetImg) targetImg.src = '';
            const label = targetEl.querySelector('.target-label');
            const successLabel = targetEl.querySelector('.success-label');
            if (label) { label.classList.remove('hidden'); label.innerText = TARGET_LABELS[peekh_currentLabelIndex]; }
            if (successLabel) successLabel.classList.remove('visible');
        }
    },

    _doActualReset() {
        // Только регенерируем монстров на очищенных карточках
        const gen = this._getGenerator(peekh_gameAvatarModule);
        const now = Date.now();

        document.querySelectorAll('.monster-card:not(.target-area):not(.empty-ghost):not(.winners-podium)').forEach((card, index) => {
            const img = card.querySelector('.monster-img');
            if (img) {
                const id = card.id.replace('monster-', '');
                const newSeed = `${id}-${now}-${index}`;
                peekh_monsterSeeds[id] = newSeed;
                img.src = (gen && gen.generate) ? gen.generate(newSeed) : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${newSeed}`;
            }
        });

        peekh_targetMonsterId = this._pickNewTargetId();
        this._updateTargetDisplay();
        this._syncTargetImage();

        const targetEl = document.getElementById('monster-target');
        if (targetEl) {
            targetEl.classList.remove('found', 'celebrate-card');
            const label = targetEl.querySelector('.target-label');
            const successLabel = targetEl.querySelector('.success-label');
            if (label && successLabel) {
                label.classList.remove('hidden');
                label.innerText = TARGET_LABELS[peekh_currentLabelIndex];
                successLabel.classList.remove('visible');
            }
        }
    },

    // ─── СЛУШАТЕЛИ СОБЫТИЙ ────────────────────────────────────────────────────

    _setupGameListeners() {
        const self = this;

        // Симуляция
        const simSend = document.getElementById('sim-send');
        const simInput = document.getElementById('sim-input');
        if (simSend) simSend.addEventListener('click', () => this._processInput());
        if (simInput) simInput.addEventListener('keypress', e => { if (e.key === 'Enter') this._processInput(); });

        // Кнопка перезапуска
        const btnRestart = document.getElementById('pk-btn-restart');
        if (btnRestart) {
            btnRestart.onclick = () => this._restartGame();
            btnRestart.onmouseover = () => { btnRestart.style.background = 'var(--accent)'; btnRestart.style.color = 'black'; };
            btnRestart.onmouseout = () => { btnRestart.style.background = ''; btnRestart.style.color = ''; };
        }

        // Авто-найти
        const autoFindBtn = document.getElementById('auto-find-btn');
        if (autoFindBtn) {
            autoFindBtn.addEventListener('click', () => {
                if (!peekh_targetMonsterId) return;
                const s1 = NAME_SYLLABLES[Math.floor(Math.random() * NAME_SYLLABLES.length)];
                const s2 = NAME_SYLLABLES[Math.floor(Math.random() * NAME_SYLLABLES.length)];
                const randomName = s1 + s2;
                self._attemptFind(peekh_targetMonsterId, randomName);
                self._addChatMessage(randomName, peekh_targetMonsterId, 'twitch');
            });
        }

        // Ползунки
        const bind = (id, prop, multiplier = false) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', e => {
                const v = parseFloat(e.target.value);
                const m = (multiplier && document.body.classList.contains('obs-mode')) ? 3.3 : 1;
                document.documentElement.style.setProperty(prop, `${v * m}px`);
            });
        };
        bind('grid-gap-slider', '--card-gap', true);
        bind('number-size-slider', '--num-size', true);
        bind('radius-slider', '--card-radius', true);

        const opSlider = document.getElementById('monster-opacity-slider');
        if (opSlider) opSlider.addEventListener('input', e => document.documentElement.style.setProperty('--monster-opacity', e.target.value / 100));

        // Авто-рестарт
        const restartSlider = document.getElementById('restart-delay-slider');
        const restartVal = document.getElementById('restart-delay-val');
        if (restartSlider && restartVal) {
            restartSlider.addEventListener('input', e => {
                peekh_restartDelay = parseInt(e.target.value);
                restartVal.innerText = peekh_restartDelay;
            });
        }

        // Табы в редакторе
        document.querySelectorAll('.editor-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.editor-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const tc = document.getElementById(btn.dataset.tab);
                if (tc) tc.classList.add('active');
            });
        });

        // Режимы игры
        document.querySelectorAll('#game-mode-selector .corner-btn').forEach(btn => {
            const modeId = btn.dataset.mode;
            if (peekh_activeModifiers[modeId]) btn.classList.add('active');
            btn.addEventListener('click', () => {
                peekh_activeModifiers[modeId] = !peekh_activeModifiers[modeId];
                btn.classList.toggle('active', peekh_activeModifiers[modeId]);
                const grid = document.getElementById('monster-grid');
                if (modeId === '2' && grid) grid.classList.toggle('show-avatars', peekh_activeModifiers['2']);
            });
        });

        // Расположение №
        document.querySelectorAll('.editor-scroll-area .corner-selector:not(#game-mode-selector) .corner-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!btn.dataset.corner) return;
                const grid = document.getElementById('monster-grid');
                if (!grid) return;
                document.querySelectorAll('.editor-scroll-area .corner-selector:not(#game-mode-selector) .corner-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                grid.classList.remove('num-tl', 'num-tr', 'num-bl', 'num-br');
                grid.classList.add(`num-${btn.dataset.corner}`);
            });
        });

        // Переключатели в редакторе (ВКЛАДКИ 🛠️ 🖇️)
        const et1 = document.getElementById('pk-editor-toggle-1');
        const et2 = document.getElementById('pk-editor-toggle-2');
        const eTab1 = document.getElementById('pk-editor-tab-1');
        const eTab2 = document.getElementById('pk-editor-tab-2');

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
        const t1 = document.getElementById('pk-toggle-1');
        const t2 = document.getElementById('pk-toggle-2');
        const tabLeaderboard = document.getElementById('pk-tab-leaderboard');
        const tabChat = document.getElementById('pk-tab-chat');

        if (t1) t1.onclick = () => {
            t1.classList.add('active');
            t2?.classList.remove('active');
            if (tabLeaderboard) tabLeaderboard.style.display = 'flex';
            if (tabChat) tabChat.style.display = 'none';
        };

        if (t2) t2.onclick = () => {
            t2.classList.add('active');
            t1?.classList.remove('active');
            if (tabLeaderboard) tabLeaderboard.style.display = 'none';
            if (tabChat) tabChat.style.display = 'flex';
        };

        // Инициализация Таба Компонентов
        this._updateComponentTab();

        // Генератор — превью
        this._updateGenerationPool();
        document.querySelectorAll('.eye-option').forEach(opt => {
            const type = opt.dataset.type;
            const val = parseInt(opt.dataset.val);
            const img = opt.querySelector('img');
            if (img) img.src = MonsterGenerator.getPartPreview(type, val);

            opt.addEventListener('click', e => {
                e.preventDefault();
                if (type === 'shape') {
                    if (opt.classList.contains('selected-white')) { opt.classList.remove('selected-white'); opt.classList.add('selected-colored'); }
                    else if (opt.classList.contains('selected-colored')) { opt.classList.remove('selected-colored'); }
                    else { opt.classList.add('selected-white'); }
                } else {
                    opt.classList.toggle('selected-white');
                }
                this._updateGenerationPool();
            });
        });

        // Кнопки генератора
        const regenBtn = document.getElementById('regen-all-btn');
        const resetBtn = document.getElementById('reset-gen-btn');
        const randomBtn = document.getElementById('random-gen-btn');

        if (regenBtn) regenBtn.addEventListener('click', () => this._regenerateAll());
        if (resetBtn) resetBtn.addEventListener('click', () => {
            document.querySelectorAll('.eye-option').forEach(o => { o.classList.remove('selected-colored'); o.classList.add('selected-white'); });
            this._updateGenerationPool();
            this._regenerateAll();
        });
        if (randomBtn) randomBtn.addEventListener('click', () => {
            document.querySelectorAll('.eye-option').forEach(o => {
                o.classList.remove('selected-white', 'selected-colored');
                if (Math.random() > 0.5) o.classList.add('selected-white');
            });
            this._updateGenerationPool();
            this._regenerateAll();
        });
    },

    _setupSettingsPanelListeners() {
        // Звук в панели настроек
        const soundToggle = document.getElementById('pk-sound-toggle');
        const volSlider = document.getElementById('pk-volume-slider');
        if (soundToggle) soundToggle.addEventListener('click', () => {
            PeekHSound.enabled = !PeekHSound.enabled;
            soundToggle.textContent = PeekHSound.enabled ? '🔊' : '🔇';
        });
        if (volSlider) volSlider.addEventListener('input', e => {
            PeekHSound.volume = e.target.value / 100;
        });
    },

    _processInput() {
        const simInput = document.getElementById('sim-input');
        if (!simInput) return;
        const value = simInput.value.trim();
        simInput.value = '';
        simInput.focus();
        if (!value) return;

        if (peekh_waitingForStart && value.toLowerCase() === '#start') { this._regenerateAll(); return; }

        const parts = value.split(' ');
        const num = parts[0];
        const name = parts.slice(1).join(' ') || 'Anonymous';

        if (!isNaN(num) && parseInt(num) >= 1 && parseInt(num) <= TOTAL_MONSTERS) {
            this._attemptFind(num, name);
        }
    },

    _connectSocket() {
        try {
            const socket = (window.location.protocol === 'file:')
                ? io('http://localhost:3000')
                : io();
            this._socket = socket;
            window.gameSocket = socket;

            socket.on('connect', () => {
                console.log('[PeekH] Сокет подключён');
                this._addChatMessage('System', '✅ Подключено к серверу', 'system');
            });

            socket.on('disconnect', () => {
                console.log('[PeekH] Сокет отключён');
                this._addChatMessage('System', '❌ Отключено', 'system');
            });

            socket.on('tiktok-msg', (data) => {
                const text = data.text.trim();
                console.log(`[PeekH] Сообщение: "${text}" от ${data.user}`);

                if (peekh_waitingForStart && text.toLowerCase() === '#start') {
                    this._regenerateAll();
                    return;
                }

                const match = text.match(/\d+/);
                if (match) {
                    this._attemptFind(match[0], data.nickname || data.user, data.avatar, data.platform);
                } else {
                    this._addChatMessage(data.nickname || data.user, text, data.platform || '');
                }
            });
        } catch (e) {
            console.warn('[PeekH] Socket не подключился:', e.message);
        }
    }
};

// ─── РЕГИСТРАЦИЯ В ОБОЛОЧКЕ ──────────────────────────────────────────────────
if (typeof GameShell !== 'undefined') {
    GameShell.register('peekh', PeekHGame);
} else {
    console.error('[PeekH] GameShell не найден! Убедитесь что main_app.js загружен.');
}
