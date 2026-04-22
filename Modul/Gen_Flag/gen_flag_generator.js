/**
 * Gen_Flag — Модуль для получения флагов стран.
 */
const Gen_FlagGenerator = {
    // Список доступных кодов стран (ISO 3166-1 alpha-2)
    _allCodes: [
        'ru', 'us', 'gb', 'de', 'fr', 'it', 'es', 'cn', 'jp', 'kr', 
        'br', 'ca', 'au', 'kz', 'by', 'ua', 'tr', 'in', 'mx', 'ar',
        'pl', 'nl', 'se', 'no', 'fi', 'dk', 'at', 'ch', 'pt', 'cz',
        'be', 'hu', 'gr', 'ro', 'bg', 'rs', 'sk', 'hr', 'si', 'ee', 
        'lv', 'lt', 'ie', 'nz', 'za', 'il', 'sa', 'ae', 'eg', 'ma', 
        'dz', 'tn', 'ng', 'gh', 'ke', 'et', 'vn', 'th', 'id', 'my', 
        'ph', 'sg', 'pk', 'bd', 'ir', 'iq', 'qa', 'kw', 'om', 'cy',
        'is', 'mt', 'lu', 'ge', 'il', 'jo', 'lb', 'ps', 'az', 'am',
        'uz', 'tj', 'kg', 'tm', 'af', 'np', 'lk', 'mm', 'kh', 'la',
        'mn', 'kp', 'tw', 'cu', 'pr', 'do', 'cr', 'pa', 'ni', 'hn',
        'sv', 'gt', 'jm', 'tt', 'bb', 'bs', 'co', 've', 'cl', 'pe',
        'ec', 'bo', 'py', 'uy'
    ],

    // Текущие настройки
    _settings: {
        allowDuplicates: false,
        activeCodes: Array.from({length: 120}, (_, i) => i)
    },

    // История выданных флагов для контроля дубликатов
    _history: new Set(),
    // Закрепленные за игроками флаги (seed -> code)
    _assignments: new Map(),

    /**
     * Очистка истории и закреплений (вызывается при старте новой игры)
     */
    reset() {
        this._history.clear();
        this._assignments.clear();
    },

    /**
     * Применяет настройки из UI
     */
    applySettings(key, value) {
        if (this._settings.hasOwnProperty(key)) {
            this._settings[key] = value;
            // При изменении настроек — очищаем историю и закрепления
            this.reset();
        }
    },

    /**
     * Возвращает URL флага.
     */
    generate(seed) {
        const activeIndices = this._settings.activeCodes || [];
        if (activeIndices.length === 0) return `https://flagcdn.com/w160/ru.png`;

        // Получаем список только активных кодов
        const pool = activeIndices.map(idx => this._allCodes[idx]);
        
        // Если для этого игрока уже закреплен флаг — возвращаем его
        if (seed && this._assignments.has(seed)) {
            const assignedCode = this._assignments.get(seed);
            // Если он всё еще в пуле — ок. Если нет (настройки поменялись) — пойдем дальше
            if (activeIndices.some(idx => this._allCodes[idx] === assignedCode)) {
                return `https://flagcdn.com/w160/${assignedCode}.png`;
            }
        }

        let code = '';
        
        // Режим без дубликатов
        if (!this._settings.allowDuplicates) {
            // ДЕТЕКЦИЯ ПРЕВЬЮ: Если сид начинается на p_, это превью в настройках.
            // Мы генерируем для него флаг, но не добавляем в историю, чтобы не "воровать" флаги у реальных игроков.
            const isPreview = typeof seed === 'string' && seed.startsWith('p_');

            // Ищем неиспользованные коды из пула
            const unusedPool = pool.filter(c => !this._history.has(c));
            
            if (unusedPool.length > 0) {
                // Выбираем из неиспользованных
                let hash = 0;
                if (seed) {
                    if (typeof seed === 'string') {
                        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
                    } else {
                        hash = Number(seed);
                    }
                } else {
                    hash = Math.floor(Math.random() * 1000000);
                }
                code = unusedPool[Math.abs(hash) % unusedPool.length];
                
                if (!isPreview) {
                    this._history.add(code);
                    if (seed) this._assignments.set(seed, code);
                }
            } else {
                // Если всё использовано — берем любой из пула (сброс истории?)
                if (!isPreview) this._history.clear();
                
                let hash = 0;
                if (seed) {
                    if (typeof seed === 'string') {
                        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
                    } else {
                        hash = Number(seed);
                    }
                } else {
                    hash = Math.floor(Math.random() * 1000000);
                }
                code = pool[Math.abs(hash) % pool.length];
                
                if (!isPreview) {
                    this._history.add(code);
                    if (seed) this._assignments.set(seed, code);
                }
            }
        } else {
            // Обычный сид-генератор
            let hash = 0;
            if (seed) {
                for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
            } else {
                hash = Math.floor(Math.random() * 1000000);
            }
            code = pool[Math.abs(hash) % pool.length];
        }
        
        return `https://flagcdn.com/w160/${code}.png`;
    },

    /**
     * Превью для сетки выбора (используется main_app.js)
     */
    getPartPreview(type, index) {
        const code = this._allCodes[index];
        return `https://flagcdn.com/w40/${code}.png`;
    },

    getAvailableCodes() {
        return this._allCodes;
    }
};

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.Gen_FlagGenerator = Gen_FlagGenerator;
}
