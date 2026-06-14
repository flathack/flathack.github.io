const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const navPath = path.join(root, 'assets', 'js', 'nav.js');
const pagePath = path.join(root, 'docs', 'price-pattern.html');

const navSource = fs.readFileSync(navPath, 'utf8');

assert.ok(!fs.existsSync(pagePath), 'price-pattern page should be removed');
assert.ok(!navSource.includes('docs/price-pattern.html'), 'navigation should not link to price-pattern page');
assert.ok(!navSource.includes('Preis-Pattern'), 'navigation should not show price-pattern label');

console.log('remove price-pattern page test passed');
