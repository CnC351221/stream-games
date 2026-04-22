/**
 * Регистрация модуля Флагов в глобальном реестре
 */
(function() {
    const moduleInfo = {
        id: "Gen_Flag",
        generator: window.Gen_FlagGenerator,
        name: "Флаг-Генератор",
        icon: "🚩",
        description: "Отображение флагов стран по коду или случайно",
        category: "Visual",
        hasPreview: true,
        settings: {
            allowDuplicates: {
                label: "Разрешить одинаковые флаги",
                type: "toggle",
                value: false,
                default: false
            },
            activeCodes: {
                label: "Активные флаги (компактный список)",
                type: "part-grid",
                partType: "flag",
                count: window.Gen_FlagGenerator ? window.Gen_FlagGenerator.getAvailableCodes().length : 104,
                selected: Array.from({length: 104}, (_, i) => i),
                default: Array.from({length: 104}, (_, i) => i)
            }
        }
    };

    if (window.MODUL_REGISTRY) {
        window.MODUL_REGISTRY.push(moduleInfo);
    }
})();
