const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('assets/css/style.css', 'utf8');
const consoleCss = fs.readFileSync('assets/css/console-refresh.css', 'utf8');
const homeCss = fs.readFileSync('assets/css/home-refresh.css', 'utf8');
const businessCss = fs.readFileSync('assets/css/business.css', 'utf8');
const tokens = fs.readFileSync('assets/css/flathack-design/tokens.css', 'utf8');
const nav = fs.readFileSync('assets/js/nav.js', 'utf8');
const business = fs.readFileSync('business/index.html', 'utf8');

for (const theme of ['terminal', 'paper', 'amber', 'ice']) {
  assert.match(tokens, new RegExp(`data-theme=['"]${theme}['"]`));
  assert.match(nav, new RegExp(`<option value="${theme}">`, 'i'));
}

assert.match(tokens, /--accent: #6ce5be/);
assert.match(tokens, /--accent: #f05a35/);
assert.match(tokens, /--accent: #f2c879/);
assert.match(tokens, /--accent: #7cc7f2/);
assert.match(css, /@import url\("flathack-design\/tokens\.css"\)/);
assert.match(css, /@import url\("flathack-design\/base\.css"\)/);
assert.match(css, /\.nav-theme-select/);

assert.match(nav, /const THEMES = \["terminal", "paper", "amber", "ice"\]/);
assert.match(nav, /if \(stored === "light"\) return "paper"/);
assert.match(nav, /if \(stored === "dark"\) return "terminal"/);
assert.match(nav, /data-theme-select/);
assert.match(nav, /localStorage\.setItem\(THEME_STORAGE_KEY, nextTheme\)/);
assert.match(nav, /theme-change/);

for (const theme of ['paper', 'amber', 'ice']) {
  assert.match(consoleCss, new RegExp(`html\\[data-theme="${theme}"\\]`));
  assert.match(homeCss, new RegExp(`html\\[data-theme="${theme}"\\]`));
}

assert.match(businessCss, /@import url\("flathack-design\/tokens\.css"\)/);
assert.match(business, /id="theme-select"/);
assert.match(business, /flathack-design\/theme-switch\.js/);

const htmlFiles = [
  'index.html',
  'business/index.html',
  'about/index.html',
  ...fs.readdirSync('docs').filter((name) => name.endsWith('.html')).map((name) => `docs/${name}`),
  ...fs.readdirSync('help').filter((name) => name.endsWith('.html')).map((name) => `help/${name}`),
  'guides/firmenwagenrechner/index.html',
  'guides/firmenwagenrechner/firmenwagenrechner-standalone.html',
];

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /flathack-design\/theme-init\.js/, `${file} must initialize the saved theme before CSS`);
}

console.log('Flathack theme system test passed');
