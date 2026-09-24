/* flathack-design · theme-switch.js — Theme-Umschalter mit Persistenz
 *
 * Nutzung (vor dem CSS-Laden einbinden, um Flash zu vermeiden):
 *   <html data-theme="terminal">
 *   <script src="/design/theme-init.js"></script>  → setzt data-theme aus localStorage vor dem Paint
 *   <link rel="stylesheet" href="/design/tokens.css">
 *   <link rel="stylesheet" href="/design/base.css">
 *   ... App-HTML mit <select id="theme-select"> (optional) ...
 *   <script src="/design/theme-switch.js"></script> → verbindet das Select + Persistenz
 */

const FLATHACK_THEME_KEY = 'flathack-theme';

function flathackApplyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

/* Init: gespeichertes Theme setzen (wird auch vom theme-init-Snippet im <head> gemacht — hier nur Fallback) */
(function init() {
  const saved = localStorage.getItem(FLATHACK_THEME_KEY);
  if (saved && !document.documentElement.dataset.theme) flathackApplyTheme(saved);
})();

/* Select verbinden, falls vorhanden: <select id="theme-select"> mit Options terminal/paper/amber/ice */
(function bindSelect() {
  const select = document.getElementById('theme-select');
  if (!select) return;
  select.value = document.documentElement.dataset.theme || 'terminal';
  select.addEventListener('change', () => {
    localStorage.setItem(FLATHACK_THEME_KEY, select.value);
    flathackApplyTheme(select.value);
  });
})();
