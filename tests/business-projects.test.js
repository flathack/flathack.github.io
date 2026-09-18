const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '..', 'business', 'index.html'), 'utf8');
const cards = [...page.matchAll(/<article class="business-card\b/g)];
const repoLinks = [...page.matchAll(/href="(https:\/\/github\.com\/flathack\/[^\"]+)"/g)].map(match => match[1]);

assert.equal(cards.length, 11, 'business page should list every selected project once');
assert.match(page, /<h1>Werkzeuge für den IT-Alltag\.<\/h1>/, 'page should have a visible main heading');
assert.match(page, /11 Projekte/);
assert.match(page, /11 PROJECT REPOSITORIES/);
assert.equal(repoLinks.length, cards.length);
assert.equal(new Set(repoLinks).size, cards.length, 'repository links should be unique');
assert.doesNotMatch(page, /StevensSupportApp/, 'renamed support project should use its current URL');

for (const slug of ['OmaBridge', 'flathack-servicehub', 'omarchy-otp', 'omarchy-agents-plus']) {
  assert.ok(repoLinks.includes(`https://github.com/flathack/${slug}`), `${slug} should be listed`);
}

assert.match(page, /Der App-Quellcode ist nicht öffentlich\./, 'ServiceHub pilot must not imply public source code');
console.log('business projects page test passed');
