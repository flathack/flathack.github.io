/* flathack-design · theme-init.js — Flash-freies Theme-Init für den <head>
 * Einbinden VOR dem CSS:  <script src="/design/theme-init.js"></script>
 */
document.documentElement.dataset.theme = localStorage.getItem('flathack-theme') || 'terminal';
