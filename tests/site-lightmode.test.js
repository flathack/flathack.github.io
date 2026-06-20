const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('assets/css/style.css', 'utf8');
const nav = fs.readFileSync('assets/js/nav.js', 'utf8');
const home = fs.readFileSync('index.html', 'utf8');
const tradeRoutes = fs.readFileSync('docs/trade-routes.html', 'utf8');
const shipDetail = fs.readFileSync('docs/ship-detail.html', 'utf8');
const repPlanner = fs.readFileSync('docs/rep-planner.html', 'utf8');
const equipmentExplorer = fs.readFileSync('docs/equipment-explorer.html', 'utf8');
const universeViewer = fs.readFileSync('docs/universe-viewer.html', 'utf8');

assert.match(css, /html\[data-theme="light"\]/);
assert.match(css, /--bg: #eef4fb/);
assert.match(css, /--text: #172033/);
assert.match(css, /--panel: rgba\(255, 255, 255, 0\.9\)/);
assert.match(css, /\.nav-theme-toggle/);
assert.match(css, /html\[data-theme="light"\] \.nav-capsule/);
assert.match(css, /html\[data-theme="light"\] input/);

assert.match(nav, /flathack-theme/);
assert.match(nav, /function applyTheme\(theme\)/);
assert.match(nav, /document\.documentElement\.dataset\.theme = currentTheme/);
assert.match(nav, /window\.matchMedia\("\(prefers-color-scheme: light\)"\)/);
assert.match(nav, /data-theme-toggle/);
assert.match(nav, /localStorage\.setItem\(THEME_STORAGE_KEY, nextTheme\)/);
assert.match(nav, /theme-change/);

assert.match(home, /html\[data-theme="light"\] \.tr-banner/);
assert.match(home, /html\[data-theme="light"\] \.hp-intro/);
assert.match(home, /html\[data-theme="light"\] \.hp-discord-tile/);
assert.match(home, /html\[data-theme="light"\] \.hp-project-card/);
assert.match(home, /html\[data-theme="light"\] \.hp-bottom-card/);
assert.match(home, /html\[data-theme="light"\] \.hp-tool-callout/);

assert.match(tradeRoutes, /html\[data-theme="light"\] \.tr-table th/);
assert.match(tradeRoutes, /html\[data-theme="light"\] \.tr-calendar-toggle/);
assert.match(tradeRoutes, /html\[data-theme="light"\] \.tr-field input\[type="number"\]/);
assert.match(tradeRoutes, /html\[data-theme="light"\] \.tr-calendar-panel/);

assert.match(shipDetail, /html\[data-theme="light"\] \.sd-hero/);
assert.match(shipDetail, /html\[data-theme="light"\] \.sd-stat/);
assert.match(shipDetail, /html\[data-theme="light"\] \.sd-equip-item/);
assert.match(shipDetail, /html\[data-theme="light"\] \.sd-dealer-table th/);

assert.match(repPlanner, /html\[data-theme="light"\] \.rp-intro/);
assert.match(repPlanner, /html\[data-theme="light"\] \.rp-config-block/);
assert.match(repPlanner, /html\[data-theme="light"\] \.rp-field input\[type="number"\]/);
assert.match(repPlanner, /html\[data-theme="light"\] \.rp-table th/);
assert.match(repPlanner, /html\[data-theme="light"\] \.rp-rep-input/);
assert.match(repPlanner, /html\[data-theme="light"\] \.rp-search/);

assert.match(equipmentExplorer, /html\[data-theme="light"\] \.ee-hero/);
assert.match(equipmentExplorer, /html\[data-theme="light"\] \.ee-toolbar/);
assert.match(equipmentExplorer, /html\[data-theme="light"\] \.ee-field input/);
assert.match(equipmentExplorer, /html\[data-theme="light"\] \.ee-table th/);
assert.match(equipmentExplorer, /html\[data-theme="light"\] \.ee-detail/);
assert.match(equipmentExplorer, /html\[data-theme="light"\] \.ee-metric/);

assert.match(universeViewer, /html\[data-theme="light"\] \.uv-controls input\[type="text"\]/);
assert.match(universeViewer, /html\[data-theme="light"\] \.uv-route-field input/);

console.log('site lightmode test passed');
