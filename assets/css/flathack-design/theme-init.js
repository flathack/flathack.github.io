/* Load before CSS. Storage can be unavailable in private or sandboxed contexts. */
(() => {
  const themes = ['terminal', 'paper', 'amber', 'ice', 'slate', 'ocean', 'cloud', 'bloom', 'matrix', 'guildwars2'];
  let saved;
  try { saved = localStorage.getItem('flathack-theme'); } catch { /* Use declared theme. */ }
  const declared = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = themes.includes(saved) ? saved : themes.includes(declared) ? declared : 'terminal';
})();
