/**
 * Gen_Txt — Модуль текстовых аватарок (Буква + Цветной фон).
 */
const Gen_TxtGenerator = {
    _colors: [
        '#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', 
        '#f59e0b', '#ec4899', '#06b6d4', '#4ade80',
        '#f87171', '#a78bfa', '#fb7185', '#22d3ee'
    ],

    // Текущие настройки
    _settings: {
        allowDuplicates: true
    },

    // История для контроля дубликатов
    _history: new Set(),

    /**
     * Применяет настройки из UI
     */
    applySettings(key, value) {
        if (this._settings.hasOwnProperty(key)) {
            this._settings[key] = value;
            this._history.clear();
        }
    },

    /**
     * Создаёт аватарку с первой буквой имени на цветном фоне.
     * @param {string} name Имя игрока или текст
     * @returns {string} Data URL изображения
     */
    generate(name) {
        if (!name) name = "?";
        const firstLetter = name.charAt(0).toUpperCase();
        
        // Детерминированный цвет на основе имени
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        let colorIdx = Math.abs(hash) % this._colors.length;
        let color = this._colors[colorIdx];

        // Контроль дубликатов (если выбрано)
        if (!this._settings.allowDuplicates && this._history.has(color)) {
            for (let i = 1; i < this._colors.length; i++) {
                let nextIdx = (colorIdx + i) % this._colors.length;
                if (!this._history.has(this._colors[nextIdx])) {
                    color = this._colors[nextIdx];
                    break;
                }
            }
        }

        if (!this._settings.allowDuplicates) {
            this._history.add(color);
            if (this._history.size >= this._colors.length) this._history.clear();
        }

        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // Фон
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 200, 200);

        // Текст
        ctx.fillStyle = 'white';
        // Используем шрифт Outfit если есть, иначе sans-serif
        ctx.font = 'bold 130px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Небольшая тень для объема
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        ctx.fillText(firstLetter, 100, 105);

        return canvas.toDataURL();
    }
};

// Экспорт
if (typeof window !== 'undefined') {
    window.Gen_TxtGenerator = Gen_TxtGenerator;
}
