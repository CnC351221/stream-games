/**
 * Регистрация модуля в глобальном реестре
 */
(function() {
    const moduleInfo = {
        id: "Gen_Ava",
        generator: window.RandomAvatarGenerator,
        name: "Аватар-Генератор",
        icon: "🎭",
        description: "Генератор случайных стилей для помощников",
        category: "Visual"
    };

    if (window.MODUL_REGISTRY) {
        window.MODUL_REGISTRY.push(moduleInfo);
    }
})();
