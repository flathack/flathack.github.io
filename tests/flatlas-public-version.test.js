const assert = require('node:assert/strict');
const fs = require('node:fs');

const home = fs.readFileSync('index.html', 'utf8');
const devStatus = JSON.parse(fs.readFileSync('flatlas/devstatus.json', 'utf8'));
const releaseLabel = devStatus.sections
  .flatMap(section => section.items || [])
  .map(item => item.label)
  .find(label => label.startsWith('FLAtlas V2 v'));

assert.match(home, /<span class="hp-version">v0\.8\.5<\/span>/);
assert.match(home, /v0\.8\.5 veröffentlicht - v0\.9\.0 in Arbeit/);
assert.match(home, /v0\.8\.5 released - v0\.9\.0 in progress/);
assert.equal(releaseLabel, 'FLAtlas V2 v0.8.5');

console.log('FLAtlas public version test passed');
