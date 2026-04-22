/**
 * STREAM GAMES — ГЛАВНАЯ ЛОГИКА ОБОЛОЧКИ
 * Управляет: панелью настроек, выбором игры, темами, видимостью окон.
 * НЕ знает о деталях конкретных игр — каждая игра регистрирует себя сама.
 */

'use strict';

// ─── РЕЕСТР ИГР ──────────────────────────────────────────────────────────────
// Каждая игра вызывает GameShell.register(...) при загрузке.
// Это позволяет добавлять/удалять игры без изменения этого файла.
const GameShell = {
    _games: {},       // { gameId: GameModule }
    _currentGame: null,
    _currentId: null,

    /**
     * Регистрирует игровой модуль.
     * @param {string} id         — уникальный ID игры ('peekh', 'maph')
     * @param {object} module     — объект с методами init(), destroy(), getSettings()
     */
    register(id, module) {
        this._games[id] = module;
        console.log(`[GameShell] Зарегистрирована игра: ${id}`);
    },

    /**
     * Загружает и активирует игру по ID.
     */
    activateGame(id) {
        if (this._currentId === id) return; // уже активна

        // 1. Уничтожаем предыдущую игру
        if (this._currentGame && typeof this._currentGame.destroy === 'function') {
            this._currentGame.destroy();
        }

        this._currentGame = null;
        this._currentId = id;

        // 2. Очищаем окна
        UI.clearWindows();

        // 3. Убираем настройки предыдущей игры из панели
        const slot = document.getElementById('game-settings-slot');

        if (id === 'none') {
            slot.innerHTML = '<div class="no-game-hint">← Выберите игру выше,<br>чтобы увидеть её настройки</div>';
            return;
        }

        slot.innerHTML = '<div class="no-game-hint">Загрузка...</div>';

        // 4. Загружаем скрипты игры динамически
        this._loadGame(id, () => {
            const game = this._games[id];
            if (!game) {
                console.error(`[GameShell] Игра '${id}' не нашлась в реестре!`);
                slot.innerHTML = '<div class="no-game-hint">⚠️ Ошибка загрузки игры</div>';
                return;
            }

            this._currentGame = game;

            // 5. Инициализируем игру — она заполняет 3 окна
            game.init({
                winEditor: document.getElementById('win-editor'),
                winStream: document.getElementById('win-stream'),
                winInfo: document.getElementById('win-info'),
            });

            // 6. Вставляем игровые настройки в панель
            const gameSettings = (typeof game.getSettings === 'function')
                ? game.getSettings()
                : null;

            if (gameSettings) {
                slot.innerHTML = '';
                slot.appendChild(gameSettings);
            } else {
                slot.innerHTML = '';
            }
        });
    },

    /**
     * Динамически загружает CSS и JS игры (один раз).
     */
    _loadGame(id, callback) {
        let folder = id.charAt(0).toUpperCase() + id.slice(1);
        if (id === 'peekh') folder = 'PeekH';
        if (id === 'maph') folder = 'MapH';
        if (id === 'kalmaph') folder = 'KalmapH';

        const basePath = `../Games/${folder}`;
        const cssId = `style-${id}`;

        const jsFile = `${id}_game.js`;
        const cssFile = `${id}_style.css`;

        // Удаляем CSS предыдущей игры
        const oldCss = document.querySelector('[data-game-style]');
        if (oldCss) oldCss.remove();

        // Загружаем CSS игры
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${basePath}/${cssFile}`;
        link.setAttribute('data-game-style', id);
        link.id = cssId;
        document.head.appendChild(link);

        // Если JS уже загружен и игра зарегистрирована — сразу callback
        if (this._games[id]) {
            callback();
            return;
        }

        // Загружаем JS игры
        const script = document.createElement('script');
        script.src = `${basePath}/${jsFile}`;
        script.onload = () => {
            console.log(`[GameShell] Скрипт игры '${id}' загружен.`);
            callback();
        };
        script.onerror = () => {
            console.error(`[GameShell] Ошибка загрузки скрипта: ${basePath}/${jsFile}`);
            callback(); // callback в любом случае, чтобы не зависнуть
        };
        document.body.appendChild(script);
    }
};

// ─── UI — УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ─────────────────────────────────────────────
const UI = {
    // Очищает 3 окна, возвращая заглушки
    clearWindows() {
        const wins = ['win-editor', 'win-stream', 'win-info'];
        wins.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.cssText = ''; // Сбрасываем инлайн-стили (например, padding от MapH)
                el.classList.remove('hidden'); // На случай если были скрыты
            }
        });

        document.getElementById('win-editor').innerHTML = `
            <div class="win-placeholder">
                <div class="placeholder-icon">🎮</div>
                <div class="placeholder-text">EDITOR</div>
                <div class="placeholder-sub">Выберите игру в настройках ⚙️</div>
            </div>`;
        document.getElementById('win-stream').innerHTML = `
            <div class="win-placeholder">
                <div class="placeholder-logo">STREAM<br>GAMES</div>
                <div class="placeholder-games">
                    <button class="placeholder-game-btn" onclick="document.getElementById('select-peekh').click()">👀 PeekH</button>
                    <button class="placeholder-game-btn" onclick="document.getElementById('select-maph').click()">🗺️ MapH</button>
                </div>
            </div>`;
        document.getElementById('win-info').innerHTML = `
            <div class="win-placeholder">
                <div class="placeholder-icon">📊</div>
                <div class="placeholder-text">INFO</div>
                <div class="placeholder-sub">Чат и статистика появятся здесь</div>
            </div>`;
    }
};

// ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // 1. Панель настроек — открыть/закрыть
    const toggle = document.getElementById('settings-toggle');
    const panel = document.getElementById('settings-panel');

    toggle.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        toggle.classList.toggle('open', isOpen);
    });

    // Закрыть панель при клике вне её
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== toggle) {
            panel.classList.remove('open');
            toggle.classList.remove('open');
        }
    });

    // 2. Вкладки в настройках
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // 3. Кнопки выбора игры
    document.querySelectorAll('.game-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const gameId = btn.dataset.game;

            // Обновляем активный класс кнопок
            document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Активируем игру
            GameShell.activateGame(gameId);

            // Сохраняем выбор
            localStorage.setItem('sg-last-game', gameId);

            // Закрываем панель через секунду если выбрана игра
            if (gameId !== 'none') {
                setTimeout(() => {
                    panel.classList.remove('open');
                    toggle.classList.remove('open');
                }, 800);
            }
        });
    });

    // 4. Режим стрима
    document.getElementById('stream-mode-btn').addEventListener('click', () => {
        const isObs = document.body.classList.toggle('obs-mode');
        document.getElementById('stream-mode-btn').textContent = isObs ? '🖥️ ОБЫЧНЫЙ РЕЖИМ' : '📺 РЕЖИМ СТРИМА';

        // Сохраняем состояние
        localStorage.setItem('sg-stream-mode', isObs);

        // 🟢 МАСШТАБИРОВАНИЕ (x3.3 для стрима)
        const multiplier = isObs ? 3.3 : 1;
        document.documentElement.style.setProperty('--win-w', `${420 * multiplier}px`);
        document.documentElement.style.setProperty('--win-h', `${747 * multiplier}px`);

        // Принудительно обновляем переменные, если есть слайдеры (gap, radius, etc)
        const updateVar = (id, prop) => {
            const el = document.getElementById(id);
            if (el) document.documentElement.style.setProperty(prop, `${parseFloat(el.value) * multiplier}px`);
        };
        updateVar('win-pad-slider', '--win-pad');
        updateVar('grid-gap-slider', '--card-gap');
        updateVar('radius-slider', '--card-radius');
        updateVar('number-size-slider', '--num-size');

        // Закрываем панель в OBS
        if (isObs) {
            panel.classList.remove('open');
            toggle.classList.remove('open');
        }
    });

    // Выход из режима стрима по клавише ESC
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('obs-mode')) {
            document.getElementById('stream-mode-btn').click();
        }
    });

    // 5. Переключение видимости боковых окон
    let win1Visible = true;
    let win2Visible = true;

    document.getElementById('toggle-win-1').addEventListener('click', () => {
        win1Visible = !win1Visible;
        document.getElementById('win-editor').classList.toggle('hidden', !win1Visible);
    });

    document.getElementById('toggle-win-2').addEventListener('click', () => {
        win2Visible = !win2Visible;
        document.getElementById('win-info').classList.toggle('hidden', !win2Visible);
    });

    // 6. Ползунок отступов окон
    const winPadBtn = document.getElementById('toggle-win-pad');
    const winPadContainer = document.getElementById('win-pad-container');
    const winPadSlider = document.getElementById('win-pad-slider');

    winPadBtn.addEventListener('click', () => {
        const visible = winPadContainer.style.display === 'none' || !winPadContainer.style.display;
        winPadContainer.style.display = visible ? 'flex' : 'none';
        winPadBtn.classList.toggle('active', visible);
    });

    winPadSlider.addEventListener('input', () => {
        document.documentElement.style.setProperty('--win-pad', winPadSlider.value + 'px');
    });

    // 7. Звуковые эффекты
    const soundToggle = document.getElementById('sound-toggle');
    const volumeSlider = document.getElementById('volume-slider');

    let soundEnabled = localStorage.getItem('sg-sound-enabled') !== 'false';
    let volume = parseInt(localStorage.getItem('sg-volume') || '30');

    const updateSoundUI = () => {
        if (soundToggle) {
            soundToggle.textContent = soundEnabled ? '🔊' : '🔈';
            soundToggle.style.opacity = soundEnabled ? '1' : '0.5';
        }
        if (volumeSlider) {
            volumeSlider.value = volume;
        }
    };

    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('sg-sound-enabled', soundEnabled);
            updateSoundUI();
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            volume = volumeSlider.value;
            localStorage.setItem('sg-volume', volume);
        });
    }

    updateSoundUI();

    // 7.5 Масштабирование (Zoom)
    const zoomMinus = document.getElementById('zoom-minus');
    const zoomPlus = document.getElementById('zoom-plus');
    const zoomInput = document.getElementById('zoom-input');

    const setZoom = (val) => {
        val = Math.max(10, Math.min(500, val));
        if (zoomInput) zoomInput.value = val;
        
        // Применяем масштаб ко ВСЕЙ странице (как браузерный зум)
        document.body.style.zoom = val / 100;
    };

    if (zoomMinus && zoomPlus && zoomInput) {
        zoomMinus.addEventListener('click', () => setZoom(parseInt(zoomInput.value) - 10));
        zoomPlus.addEventListener('click', () => setZoom(parseInt(zoomInput.value) + 10));
        zoomInput.addEventListener('change', () => setZoom(zoomInput.value));
        
        // Плавная прокрутка колесиком над инпутом
        zoomInput.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = e.deltaY < 0 ? 5 : -5;
            setZoom(parseInt(zoomInput.value) + step);
        }, { passive: false });
    }

    // Всегда начинаем с 100% (не сохраняем масштаб между перезагрузками)
    setZoom(100);

    // 8. Выбор темы
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const theme = opt.dataset.theme;
            document.body.setAttribute('data-theme', theme);
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            localStorage.setItem('sg-theme', theme);
        });
    });

    // Восстанавливаем тему из localStorage
    const savedTheme = localStorage.getItem('sg-theme') || 'midnight';
    document.body.setAttribute('data-theme', savedTheme);
    const savedThemeEl = document.querySelector(`.theme-option[data-theme="${savedTheme}"]`);
    if (savedThemeEl) {
        document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        savedThemeEl.classList.add('active');
    }

    // 9. Восстанавливаем последнюю игру из localStorage
    // 9. Начинаем с главной (как выбрал пользователь)
    const lastGame = 'none';
    const gameBtn = document.querySelector(`.game-btn[data-game="${lastGame}"]`);
    if (gameBtn) {
        document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
        gameBtn.classList.add('active');
        // Для главной (none) GameShell.activateGame не нужен, так как UI.clearWindows отработает
    }

    // 9.5 Принудительно включаем режим стрима при запуске
    if (!document.body.classList.contains('obs-mode')) {
        document.getElementById('stream-mode-btn').click();
    }

    // 10. Модули
    const modulesList = document.getElementById('modules-list');
    const moduleSettings = document.getElementById('module-settings');
    const moduleSettingsTitle = document.getElementById('module-settings-title');
    const moduleSettingsContent = document.getElementById('module-settings-content');

    // 10.5 Platforms Connection
    const ttInput = document.getElementById('tiktok-user-input');
    const ttConnectBtn = document.getElementById('tiktok-connect-btn');
    const ttStatus = document.getElementById('tiktok-status-label');

    const ytInput = document.getElementById('youtube-user-input');
    const ytConnectBtn = document.getElementById('youtube-connect-btn');
    const ytStatus = document.getElementById('youtube-status-label');

    const twInput = document.getElementById('twitch-user-input');
    const twConnectBtn = document.getElementById('twitch-connect-btn');
    const twStatus = document.getElementById('twitch-status-label');

    if (ttConnectBtn && ttInput) {
        ttConnectBtn.addEventListener('click', () => {
            const username = ttInput.value.trim().replace('@', '');
            if (!username) { ttStatus.textContent = 'Статус: введите ник!'; return; }
            if (window.mainSocket) {
                window.mainSocket.emit('set-tiktok-user', username);
                localStorage.setItem('sg-tiktok-user', username);
                ttStatus.textContent = `Статус: запрос к @${username}...`;
            }
        });
    }

    if (ytConnectBtn && ytInput) {
        ytConnectBtn.addEventListener('click', () => {
            const channelId = ytInput.value.trim();
            if (!channelId) { ytStatus.textContent = 'Статус: введите ID!'; return; }
            if (window.mainSocket) {
                window.mainSocket.emit('set-youtube-user', channelId);
                localStorage.setItem('sg-youtube-user', channelId);
                ytStatus.textContent = `Статус: запрос к ${channelId}...`;
            }
        });
    }

    if (twConnectBtn && twInput) {
        twConnectBtn.addEventListener('click', () => {
            const channel = twInput.value.trim();
            if (!channel) { twStatus.textContent = 'Статус: введите ник!'; return; }
            if (window.mainSocket) {
                window.mainSocket.emit('set-twitch-user', channel);
                localStorage.setItem('sg-twitch-user', channel);
                twStatus.textContent = `Статус: запрос к ${channel}...`;
            }
        });
    }

    const renderModulesList = () => {
        if (!modulesList) return;

        const registry = window.MODUL_REGISTRY || [];
        if (registry.length === 0) {
            modulesList.innerHTML = '<div class="module-empty">Модули отсутствуют</div>';
            return;
        }

        modulesList.innerHTML = '';
        registry.forEach(mod => {
            const item = document.createElement('div');
            item.className = 'module-item';
            item.innerHTML = `
                <div class="module-item-icon">${mod.icon || '🧩'}</div>
                <div class="module-item-info">
                    <div class="module-item-name">${mod.name}</div>
                    <div class="module-item-desc">${mod.description || ''}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                showModuleSettings(mod);
            });
            modulesList.appendChild(item);
        });
    };

    const showModuleSettings = (mod) => {
        moduleSettings.style.display = 'block';
        moduleSettingsTitle.textContent = `Настройки: ${mod.id}`;
        moduleSettingsContent.innerHTML = '';

        // Добавляем панель действий (Сброс / Выбор)
        const actionsBar = document.createElement('div');
        actionsBar.className = 'module-actions-bar';

        const btnReset = document.createElement('button');
        btnReset.className = 'action-tool-btn btn-reset';
        btnReset.innerHTML = '<span>🗑️</span> Сброс';

        const btnSelect = document.createElement('button');
        btnSelect.className = 'action-tool-btn btn-select';
        btnSelect.innerHTML = '<span>🎲</span> Выбор';

        const generator = window[mod.id + 'Generator'] || window.MonsterGenerator;

        const updateAllParts = () => {
            if (generator && typeof generator.applySettings === 'function') {
                Object.entries(mod.settings).forEach(([key, cfg]) => {
                    if (cfg.type === 'part-grid') {
                        generator.applySettings(key, cfg.selected);
                    } else if (cfg.type === 'range' || cfg.type === 'toggle') {
                        generator.applySettings(key, cfg.value);
                    }
                });
            }
            showModuleSettings(mod); // Перерисовываем
        };

        btnReset.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Сбросить настройки модуля ${mod.id}?`)) {
                Object.values(mod.settings).forEach(cfg => {
                    if (cfg.type === 'part-grid') {
                        // Если это флаги — снимаем всё, иначе сбрасываем в дефолт
                        if (mod.id === 'Gen_Flag') {
                            cfg.selected = [];
                        } else {
                            cfg.selected = cfg.default ? [...cfg.default] : [];
                        }
                    } else if (cfg.type === 'range' || cfg.type === 'toggle') {
                        cfg.value = cfg.default !== undefined ? cfg.default : cfg.value;
                    }
                });
                updateAllParts();
            }
        });

        btnSelect.addEventListener('click', (e) => {
            e.stopPropagation();
            Object.values(mod.settings).forEach(cfg => {
                if (cfg.type === 'part-grid') {
                    if (!cfg.selected) cfg.selected = [];
                    const available = [];
                    for (let i = 0; i < cfg.count; i++) {
                        if (!cfg.selected.includes(i)) available.push(i);
                    }
                    if (available.length > 0) {
                        const rndIdx = available[Math.floor(Math.random() * available.length)];
                        cfg.selected.push(rndIdx);
                    }
                } else if (cfg.type === 'range') {
                    const steps = (cfg.max - cfg.min) / (cfg.step || 1);
                    const rndStep = Math.floor(Math.random() * (steps + 1));
                    cfg.value = cfg.min + rndStep * (cfg.step || 1);
                    // Округляем для красоты, если step дробный
                    if (cfg.step < 1) cfg.value = parseFloat(cfg.value.toFixed(2));
                } else if (cfg.type === 'toggle') {
                    cfg.value = Math.random() > 0.5;
                } else if (cfg.type === 'btn-group') {
                    if (cfg.options && cfg.options.length > 0) {
                        cfg.selected = cfg.options
                            .filter(() => Math.random() > 0.5)
                            .map(o => o.value);
                        if (cfg.selected.length === 0) {
                            cfg.selected = [cfg.options[Math.floor(Math.random() * cfg.options.length)].value];
                        }
                    }
                }
            });
            updateAllParts();
        });

        actionsBar.appendChild(btnReset);
        actionsBar.appendChild(btnSelect);
        moduleSettingsContent.appendChild(actionsBar);

        if (mod.settings) {
            let rowWrapper = null;

            Object.entries(mod.settings).forEach(([key, cfg]) => {
                const isSmall = cfg.type === 'toggle' || cfg.type === 'btn-group';

                if (isSmall) {
                    if (!rowWrapper) {
                        rowWrapper = document.createElement('div');
                        rowWrapper.style.display = 'flex';
                        rowWrapper.style.gap = '8px';
                        moduleSettingsContent.appendChild(rowWrapper);
                    }
                } else {
                    rowWrapper = null;
                }

                const group = document.createElement('div');
                group.className = 'control-group';
                if (isSmall) {
                    group.style.flex = '1';
                    group.style.padding = '6px 8px';
                }
                group.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <span class="hint" style="font-size: 0.65rem; opacity: 0.7;">${cfg.label}</span>
                        ${cfg.type === 'part-grid' ? `
                            <div style="display:flex; gap:8px; font-size:0.6rem;">
                                <span class="grid-action-link" id="link-select-all-${key}" style="color:var(--accent); cursor:pointer;">Выделить всё</span>
                                <span class="grid-action-link" id="link-clear-all-${key}" style="color:#f87171; cursor:pointer;">Снять всё</span>
                            </div>
                        ` : ''}
                    </div>
                `;

                if (cfg.type === 'part-grid') {
                    const grid = document.createElement('div');
                    grid.className = 'eye-grid';
                    for (let i = 0; i < cfg.count; i++) {
                        const isSelected = cfg.selected ? cfg.selected.includes(i) : false;
                        const label = document.createElement('label');
                        label.className = `eye-option ${isSelected ? 'selected-white' : ''}`;
                        label.dataset.type = cfg.partType;
                        label.dataset.val = i;

                        const preview = (generator && typeof generator.getPartPreview === 'function')
                            ? generator.getPartPreview(cfg.partType, i)
                            : '';

                        label.innerHTML = `
                            <input type="checkbox" value="${i}" ${isSelected ? 'checked' : ''} style="display:none;">
                            ${preview ? `<img src="${preview}">` : `<span>${i}</span>`}
                        `;

                        label.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const cb = label.querySelector('input');
                            cb.checked = !cb.checked;
                            label.classList.toggle('selected-white', cb.checked);

                            if (!cfg.selected) cfg.selected = [];
                            if (cb.checked) {
                                if (!cfg.selected.includes(i)) cfg.selected.push(i);
                            } else {
                                cfg.selected = cfg.selected.filter(v => v !== i);
                            }

                            if (generator && typeof generator.applySettings === 'function') {
                                generator.applySettings(key, cfg.selected);
                            }
                        });
                        grid.appendChild(label);
                    }
                    group.appendChild(grid);

                    // Обработчики для ссылок Выделить/Снять
                    setTimeout(() => {
                        const sAll = group.querySelector(`#link-select-all-${key}`);
                        const cAll = group.querySelector(`#link-clear-all-${key}`);
                        if (sAll) {
                            sAll.onclick = () => {
                                cfg.selected = Array.from({length: cfg.count}, (_, i) => i);
                                grid.querySelectorAll('.eye-option').forEach(opt => opt.classList.add('selected-white'));
                                grid.querySelectorAll('input').forEach(cb => cb.checked = true);
                                if (generator && typeof generator.applySettings === 'function') generator.applySettings(key, cfg.selected);
                                // Обновляем превью если нужно
                                if (typeof generateAndShow === 'function') generateAndShow(false);
                            };
                        }
                        if (cAll) {
                            cAll.onclick = () => {
                                cfg.selected = [];
                                grid.querySelectorAll('.eye-option').forEach(opt => opt.classList.remove('selected-white'));
                                grid.querySelectorAll('input').forEach(cb => cb.checked = false);
                                if (generator && typeof generator.applySettings === 'function') generator.applySettings(key, cfg.selected);
                                if (typeof generateAndShow === 'function') generateAndShow(false);
                            };
                        }
                    }, 0);
                } else if (cfg.type === 'toggle') {
                    const btn = document.createElement('button');
                    btn.className = `action-btn ${cfg.value ? 'active' : ''}`;
                    btn.textContent = cfg.value ? 'ВКЛ' : 'ВЫКЛ';
                    btn.style.width = '100%';
                    btn.style.padding = '4px';
                    btn.style.fontSize = '0.7rem';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        cfg.value = !cfg.value;
                        btn.classList.toggle('active', cfg.value);
                        btn.textContent = cfg.value ? 'ВКЛ' : 'ВЫКЛ';
                        if (generator && typeof generator.applySettings === 'function') {
                            generator.applySettings(key, cfg.value);
                        }
                    });
                    group.appendChild(btn);
                } else if (cfg.type === 'btn-group') {
                    const wrap = document.createElement('div');
                    wrap.className = 'corner-selector';
                    wrap.style.gap = '4px';
                    cfg.options.forEach(opt => {
                        const isSelected = cfg.selected ? cfg.selected.includes(opt.value) : false;
                        const btn = document.createElement('button');
                        btn.className = `corner-btn ${isSelected ? 'active' : ''}`;
                        btn.style.padding = '4px 8px';
                        btn.style.fontSize = '0.7rem';
                        btn.style.minWidth = '24px';
                        btn.textContent = opt.label;
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (!cfg.selected) cfg.selected = [];
                            if (cfg.selected.includes(opt.value)) {
                                cfg.selected = cfg.selected.filter(v => v !== opt.value);
                                btn.classList.remove('active');
                            } else {
                                cfg.selected.push(opt.value);
                                btn.classList.add('active');
                            }
                            if (generator && typeof generator.applySettings === 'function') {
                                generator.applySettings(key, cfg.selected);
                            }
                        });
                        wrap.appendChild(btn);
                    });
                    group.appendChild(wrap);
                } else if (cfg.type === 'range') {
                    const slider = document.createElement('input');
                    slider.type = 'range';
                    slider.min = cfg.min || 0;
                    slider.max = cfg.max || 100;
                    slider.step = cfg.step || 1;
                    slider.value = cfg.value;
                    slider.style.width = '100%';
                    slider.className = 'size-slider';

                    const valLab = document.createElement('div');
                    valLab.style.fontSize = '0.65rem';
                    valLab.style.textAlign = 'right';
                    valLab.style.opacity = '0.5';
                    valLab.textContent = cfg.value;

                    slider.addEventListener('input', () => {
                        cfg.value = parseFloat(slider.value);
                        valLab.textContent = cfg.value;
                        if (generator && typeof generator.applySettings === 'function') {
                            generator.applySettings(key, cfg.value);
                        }
                    });
                    group.appendChild(slider);
                    group.appendChild(valLab);
                }

                if (isSmall && rowWrapper) {
                    rowWrapper.appendChild(group);
                } else {
                    moduleSettingsContent.appendChild(group);
                }
            });
        }

        // 11. Добавляем блок прямого превью (без iframe)
        if (mod.hasPreview) {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'module-preview-direct';

            const img = document.createElement('img');
            img.id = 'monster-preview-img';

            const seedLabel = document.createElement('span');
            seedLabel.className = 'seed-label';

            const genBtn = document.createElement('button');
            genBtn.className = 'gen-btn';
            genBtn.textContent = '🎲 Генерировать';

            let currentSeed = mod.id === 'Gen_Grb' ? Math.floor(Math.random() * 1000000) : 'p_' + Math.random().toString(36).substr(2, 8);

            const generateAndShow = (newSeed = false) => {
                if (newSeed) {
                    currentSeed = mod.id === 'Gen_Grb' ? Math.floor(Math.random() * 1000000) : 'p_' + Math.random().toString(36).substr(2, 8);
                }
                if (generator && typeof generator.generate === 'function') {
                    img.src = generator.generate(currentSeed);
                }
                seedLabel.textContent = currentSeed;
            };

            // Обновляем обработчики слайдеров, чтобы они вызывали превью
            const originalUpdateAllParts = updateAllParts;
            const enhancedUpdateAllParts = () => {
                originalUpdateAllParts();
                generateAndShow(false);
            };

            // Переопределяем логику для всех контролов в этой сессии
            const inputs = moduleSettingsContent.querySelectorAll('input, button.action-btn, button.corner-btn, .eye-option');
            inputs.forEach(input => {
                input.addEventListener('change', () => generateAndShow(false));
                input.addEventListener('input', () => {
                    if (input.type === 'range') generateAndShow(false);
                });
                // Для кнопок и кликабельных дивов (сетка частей)
                input.addEventListener('click', () => {
                    // Небольшая задержка, чтобы внутренний обработчик успел изменить стейт
                    setTimeout(() => generateAndShow(false), 50);
                });
            });

            genBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                generateAndShow(true);
            });

            previewContainer.appendChild(img);
            
            if (!mod.hidePreviewControls) {
                previewContainer.appendChild(seedLabel);
                previewContainer.appendChild(genBtn);
            }

            moduleSettingsContent.appendChild(previewContainer);

            // Начальная генерация
            generateAndShow();
        }
    };

    // Обновляем список при переключении на вкладку модулей
    document.querySelector('.tab-btn[data-tab="tab-modules"]').addEventListener('click', renderModulesList);

    // ─── УДАЛЕННОЕ УПРАВЛЕНИЕ (ЧИТ КОДЫ) ──────────────────────────────────────
    try {
        // Если открыто через сервер (http), используем авто-подключение, иначе жестко localhost:3000
        const socket = (window.location.protocol === 'file:')
            ? io('http://localhost:3000')
            : io();
        
        window.mainSocket = socket;

        let autoConnectDone = false;
        socket.on('connect', () => {
            console.log('[Main] Socket connected (id: ' + socket.id + ')');

            // Восстанавливаем значения полей из localStorage (без авто-подключения)
            if (autoConnectDone) return;
            autoConnectDone = true;

            const savedTT = localStorage.getItem('sg-tiktok-user');
            if (savedTT && ttInput && ttStatus) {
                ttInput.value = savedTT;
                ttStatus.textContent = `Сохранён: @${savedTT}`;
            }

            const savedYT = localStorage.getItem('sg-youtube-user');
            if (savedYT && ytInput && ytStatus) {
                ytInput.value = savedYT;
                ytStatus.textContent = `Сохранён: ${savedYT}`;
            }

            const savedTW = localStorage.getItem('sg-twitch-user');
            if (savedTW && twInput && twStatus) {
                twInput.value = savedTW;
                twStatus.textContent = `Сохранён: ${savedTW}`;
            }
        });

        socket.on('tiktok-status', (data) => {
            if (!ttStatus) return;
            if (data.status === 'connected') {
                ttStatus.style.color = '#4ade80';
                ttStatus.textContent = `Статус: ✅ Подключено (@${data.user})`;
            } else if (data.status === 'error') {
                ttStatus.style.color = '#f87171';
                ttStatus.textContent = `Ошибка: ${data.message}`;
            }
        });

        socket.on('youtube-status', (data) => {
            if (!ytStatus) return;
            if (data.status === 'connected') {
                ytStatus.style.color = '#4ade80';
                ytStatus.textContent = `Статус: ✅ Подключено (${data.user})`;
            } else if (data.status === 'error') {
                ytStatus.style.color = '#f87171';
                ytStatus.textContent = `Ошибка: ${data.message}`;
            }
        });

        socket.on('twitch-status', (data) => {
            if (!twStatus) return;
            if (data.status === 'connected') {
                twStatus.style.color = '#4ade80';
                twStatus.textContent = `Статус: ✅ Подключено (${data.user})`;
            } else if (data.status === 'error') {
                twStatus.style.color = '#f87171';
                twStatus.textContent = `Ошибка: ${data.message}`;
            }
        });

        socket.on('tiktok-msg', (data) => {
            const text = data.text.trim().toLowerCase();
            console.log(`[Remote] Получено сообщение: "${text}" от ${data.user} (isAuthor: ${data.isAuthor})`);

            if (!data.isAuthor) return;

            if (text.includes('#peekh')) {
                console.log('[Remote] Переключение на PeekH');
                const btn = document.getElementById('select-peekh');
                if (btn) btn.click();
            } else if (text.includes('#maph')) {
                console.log('[Remote] Переключение на MapH');
                const btn = document.getElementById('select-maph');
                if (btn) btn.click();
            } else if (text.includes('#kalma')) {
                console.log('[Remote] Переключение на KalmapH');
                const btn = document.getElementById('select-kalmaph');
                if (btn) btn.click();
            } else if (text.includes('#bot')) {
                console.log('[Remote] Команда #bot (авто-нажатие)');
                const currentId = GameShell._currentId;
                let btn = null;
                if (currentId === 'peekh') {
                    btn = document.getElementById('auto-find-btn');
                } else if (currentId === 'maph') {
                    btn = document.getElementById('mh-info-random');
                } else if (currentId === 'kalmaph') {
                    btn = document.getElementById('kal-btn-bot');
                }
                if (btn) btn.click();
            }
        });
    } catch (e) {
        console.warn('[GameShell] Не удалось подключить удаленное управление');
    }

    console.log('[GameShell] Оболочка инициализирована.');
});
