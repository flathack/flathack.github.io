const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('docs/universe-viewer.html', 'utf8');

assert.match(html, /var baseViewBox = \{ x: 0, y: 0, w: 1000, h: 800 \}/);
assert.match(html, /var maxZoomScale = 12/);
assert.match(html, /function resetViewBox\(w, h\)/);
assert.match(html, /function minimumViewBoxSize\(\)/);
assert.match(html, /function clampViewBox\(\)/);
assert.match(html, /if \(newW >= baseViewBox\.w \|\| newH >= baseViewBox\.h\)/);
assert.match(html, /if \(newW <= minSize\.w \|\| newH <= minSize\.h\)/);
assert.match(html, /viewBox\.w = baseViewBox\.w/);
assert.match(html, /baseViewBox\.w \/ maxZoomScale/);
assert.match(html, /viewBox\.x = Math\.max\(minX, Math\.min\(maxX, viewBox\.x\)\)/);
assert.match(html, /viewBox\.y = Math\.max\(minY, Math\.min\(maxY, viewBox\.y\)\)/);
assert.match(html, /resetViewBox\(w, h\)/);

console.log('universe viewer zoom test passed');
