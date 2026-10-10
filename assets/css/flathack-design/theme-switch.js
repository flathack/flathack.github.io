/* Optional selector, programmatic API, persistence, and theme change event. */
const FLATHACK_THEME_KEY = 'flathack-theme';
const FLATHACK_THEMES = Object.freeze(['terminal', 'paper', 'amber', 'ice', 'slate', 'ocean', 'cloud', 'bloom', 'matrix', 'guildwars2']);

function flathackApplyTheme(theme) {
  if (!FLATHACK_THEMES.includes(theme)) return false;
  document.documentElement.dataset.theme = theme;
  const select = document.getElementById('theme-select');
  if (select) select.value = theme;
  try { localStorage.setItem(FLATHACK_THEME_KEY, theme); } catch { /* In-memory switching still works. */ }
  document.dispatchEvent(new CustomEvent('flathack:themechange', { detail: { theme } }));
  return true;
}

(() => {
  let saved;
  try { saved = localStorage.getItem(FLATHACK_THEME_KEY); } catch { /* Storage is optional. */ }
  const current = document.documentElement.dataset.theme;
  flathackApplyTheme(FLATHACK_THEMES.includes(current) ? current : FLATHACK_THEMES.includes(saved) ? saved : 'terminal');
  const select = document.getElementById('theme-select');
  if (select) select.addEventListener('change', () => flathackApplyTheme(select.value));
})();
