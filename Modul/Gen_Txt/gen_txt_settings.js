/**
 * Регистрация модуля в глобальном реестре
 */
(function() {
    const moduleInfo = {
        id: "Gen_Txt",
        generator: window.Gen_TxtGenerator,
        name: "Текстовые Аватары",
        icon: "🅰️",
        description: "Буква имени на цветном фоне",
        category: "Visual",
        hasPreview: true,
        settings: {
            allowDuplicates: {
                label: "Разрешить одинаковые цвета",
                type: "toggle",
                value: true,
                default: true
            }
        }
    };

    if (window.MODUL_REGISTRY) {
        window.MODUL_REGISTRY.push(moduleInfo);
    }
})();
