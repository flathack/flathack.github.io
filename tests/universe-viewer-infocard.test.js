const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('docs/universe-viewer.html', 'utf8');
const exporter = fs.readFileSync('tools/export_universe_data.py', 'utf8');
const tradeExporter = fs.readFileSync('tools/export_trade_data.py', 'utf8');

assert.match(exporter, /ids_info = vals\.get\("ids_info", ""\)/);
assert.match(exporter, /obj_infocard = res\.get\(ids_info\) if ids_info else ""/);
assert.match(exporter, /obj\["ids_info"\] = ids_info/);
assert.match(exporter, /obj\["infocard"\] = obj_infocard/);
assert.match(exporter, /resolve_mod_path\(data_root, "UNIVERSE\/universe\.ini"\)/);

assert.match(tradeExporter, /def resolve_mod_path/);
assert.match(tradeExporter, /RT_HTML/);
assert.match(tradeExporter, /_load_html_table/);

assert.match(html, /info_infocard/);
assert.match(html, /items \+= renderInfocardSection\(obj\)/);
assert.match(html, /function renderInfocardSection\(obj\)/);
assert.match(html, /function infocardParagraphs\(value\)/);
assert.match(html, /function decodeTextEntities\(value\)/);
assert.match(html, /uv-infocard-text/);
assert.ok(html.includes('.replace(/<[^>]+>/g, "")'));

console.log('universe viewer infocard test passed');
