const assert = require('node:assert/strict');
const fs = require('node:fs');

const home = fs.readFileSync('index.html', 'utf8');
const devStatus = JSON.parse(fs.readFileSync('flatlas/devstatus.json', 'utf8'));
const atlasCardMatch = home.match(/<!-- FL Atlas V2 -->([\s\S]*?)<!-- FL Atlas Savegame Editor -->/);
assert.ok(atlasCardMatch, 'FLAtlas V2 project card must exist');
const atlasCard = atlasCardMatch[1];

const currentSection = devStatus.sections.find(section => section.title === 'Aktuell');
assert.ok(currentSection, 'current development-status section must exist');
const releaseItem = currentSection.items.find(item =>
  item.status === 'done' && item.label.startsWith('FLAtlas V2 v')
);

assert.match(atlasCard, /<span class="hp-version">v0\.8\.7<\/span>/);
assert.match(home, /v0\.8\.7 veröffentlicht - v0\.9\.0 in Arbeit/);
assert.match(home, /v0\.8\.7 released - v0\.9\.0 in progress/);
assert.equal(releaseItem.label, 'FLAtlas V2 v0.8.7');
assert.doesNotMatch(home, /v?0\.8\.6/);
assert.doesNotMatch(JSON.stringify(devStatus), /v?0\.8\.6/);

console.log('FLAtlas public version test passed');
