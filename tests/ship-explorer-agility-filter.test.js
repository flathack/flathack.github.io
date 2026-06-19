const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('docs/ship-explorer.html', 'utf8');
const payload = JSON.parse(fs.readFileSync('data/trade-routes/vanilla.json', 'utf8'));
const data = (payload.datasets && payload.datasets[payload.default_dataset || 'default'])
  || (payload.datasets && payload.datasets.default)
  || payload;

const ships = data.ships || [];
const inExampleRange = ships.filter((ship) => ship.agility >= 1.2 && ship.agility <= 1.7);
assert.ok(inExampleRange.length > 0, 'fixture should contain ships in the 1.2..1.7 agility range');
assert.ok(inExampleRange.length < ships.length, 'fixture range should filter out some ships');

assert.match(html, /type="range"[^>]*id="agility-min"/);
assert.match(html, /type="range"[^>]*id="agility-max"/);
assert.match(html, /id="agility-min-value"/);
assert.match(html, /id="agility-max-value"/);
assert.match(html, /lbl_agility_min/);
assert.match(html, /lbl_agility_max/);
assert.match(html, /setupAgilityFilters/);
assert.match(html, /getAgilityBounds/);
assert.match(html, /agilityMin/);
assert.match(html, /agilityMax/);
assert.match(html, /agilityValues/);

console.log('ship explorer agility filter test passed');
