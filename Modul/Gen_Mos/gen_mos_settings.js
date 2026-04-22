/**
 * Gen_Mos — Генератор Монстриков
 * Модуль сам регистрирует себя в глобальном реестре.
 * Удали эту папку + убери <script> в index.html → модуль исчезнет.
 */
window.MODUL_REGISTRY.push({
    id: 'Gen_Mos',
    generator: window.MonsterGenerator,
    name: 'Генератор Монстриков',
    icon: '👾',
    description: 'Универсальный генератор тел и лиц монстров',
    hasPreview: true,
    settings: {
        eyeShapes: {
            label: 'Форма глаз',
            type: 'part-grid',
            partType: 'shape',
            count: 8,
            selected: [0, 1, 2, 3, 4, 5, 6, 7],
            default: [0, 1, 2, 3, 4, 5, 6, 7]
        },
        pupils: {
            label: 'Зрачки',
            type: 'part-grid',
            partType: 'pupil',
            count: 8,
            selected: [0, 1, 2, 3, 4, 5, 6, 7],
            default: [0, 1, 2, 3, 4, 5, 6, 7]
        },
        mouths: {
            label: 'Мимика',
            type: 'part-grid',
            partType: 'mouth',
            count: 8,
            selected: [0, 1, 2, 3, 4, 5, 6, 7],
            default: [0, 1, 2, 3, 4, 5, 6, 7]
        },
        colorfulEyes: {
            label: 'Цветные глаза',
            type: 'toggle',
            value: false,
            default: false
        },
        doubleEyes: {
            label: 'Количество глаз',
            type: 'btn-group',
            options: [
                { value: 1, label: '1' },
                { value: 2, label: '2' }
            ],
            selected: [1, 2],
            default: [1, 2]
        }
    }
});
