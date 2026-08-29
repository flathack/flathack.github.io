const assert = require('node:assert/strict');
const fs = require('node:fs');

const repositoryUrl = 'https://github.com/flathack/Freelancer-2D';
const home = fs.readFileSync('index.html', 'utf8');
const nav = fs.readFileSync('assets/js/nav.js', 'utf8');

assert.equal(fs.existsSync('freelancer2d'), false, 'Freelancer 2D must not be bundled in this repository');
assert.equal(fs.existsSync('assets/js/home-freelancer2d-tile.js'), false, 'the local game preview must be removed');

assert.match(home, new RegExp(`href="${repositoryUrl}" target="_blank" rel="noopener"`));
assert.match(nav, new RegExp(`href: "${repositoryUrl}", external: true`));
assert.doesNotMatch(home, /href=["']freelancer2d\//i);
assert.doesNotMatch(nav, /freelancer2d\/data\//i);

const sharedShipAssets = [...nav.matchAll(/assets\/img\/ships\/([a-z0-9_-]+\.png)/gi)]
  .map(match => match[1]);
assert.ok(sharedShipAssets.length >= 5, 'navigation must reference the relocated shared ship assets');
for (const filename of sharedShipAssets) {
  assert.ok(fs.existsSync(`assets/img/ships/${filename}`), `missing shared ship asset: ${filename}`);
}

console.log('Freelancer 2D external link test passed');
