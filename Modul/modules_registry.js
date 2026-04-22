/**
 * Инициализатор реестра модулей.
 * Каждый модуль сам добавляет себя через свой settings.js:
 *   window.MODUL_REGISTRY.push({ id, name, icon, ... })
 *
 * Удалил модуль → удали <script> его settings.js в index.html → всё.
 */
window.MODUL_REGISTRY = [];
