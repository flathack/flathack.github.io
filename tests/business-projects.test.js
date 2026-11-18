const assert = require('node:assert/strict');
const fs = require('node:fs');

assert.equal(fs.existsSync('business/index.html'), false, 'the business directory must be retired');
for (const file of ['index.html', 'assets/js/nav.js']) {
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /business\//i, file);
}
