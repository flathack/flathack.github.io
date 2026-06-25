const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const themeDir = path.join('docs', 'swat-portal-themes');
const userStyleFiles = fs
  .readdirSync(themeDir)
  .filter((file) => file.endsWith('.user.css'))
  .sort();

assert.ok(userStyleFiles.length > 0, 'SWAT userstyle installers should exist');

for (const file of userStyleFiles) {
  const source = fs.readFileSync(path.join(themeDir, file), 'utf8');
  const body = source.replace(/^[\s\S]*?==\/UserStyle== \*\/\s*/, '');

  assert.match(
    body,
    /@-moz-document\s+url-prefix\("https:\/\/swat-portal\.com\/"\),\s*url-prefix\("https:\/\/www\.swat-portal\.com\/"\)\s*\{/,
    `${file} should expose SWAT Portal as the Stylus applies-to target`
  );
  assert.doesNotMatch(
    body,
    /^\s*@import\b/m,
    `${file} should not rely on a global top-level import for the style body`
  );
}

console.log('swat userstyle targets test passed');
