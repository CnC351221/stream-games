/**
 * Gen_Ava — Модуль случайных аватаров для помощников и ботов.
 */
const RandomAvatarGenerator = {
    _styles: [
        'pixel-art', 
        'adventurer', 
        'bottts', 
        'miniavs', 
        'open-peeps', 
        'avataaars', 
        'big-smile',
        'micah',
        'lorelei'
    ],

    /**
     * Возвращает URL случайного аватара на основе имени.
     * @param {string} seed Имя или любой сид
     * @returns {string} URL изображения
     */
    generate(seed) {
        if (!seed) seed = Math.random().toString(36).substring(7);
        
        // Детерминированный выбор стиля на основе сида
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const styleIndex = Math.abs(hash) % this._styles.length;
        const style = this._styles[styleIndex];
        
        return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    }
};

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.RandomAvatarGenerator = RandomAvatarGenerator;
}
