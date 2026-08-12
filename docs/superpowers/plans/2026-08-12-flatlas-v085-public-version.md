# FLAtlas v0.8.5 Public Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show FLAtlas v0.8.5 consistently on the public homepage and in the public development-status JSON.

**Architecture:** Add one focused content regression test that reads the two public files and asserts the current release plus bilingual status. Then update only the four stale v0.8.3 strings; no layout, progress, feature, or link changes are needed.

**Tech Stack:** Static HTML, JSON, Node.js built-in test assertions

---

### Task 1: Cover the public FLAtlas version

**Files:**
- Create: `tests/flatlas-public-version.test.js`
- Test: `tests/flatlas-public-version.test.js`

- [x] **Step 1: Write the failing content test**

Create the test with this complete content:

```js
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
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node tests/flatlas-public-version.test.js`

Expected: FAIL because `index.html` and `flatlas/devstatus.json` still contain v0.8.3.

- [x] **Step 3: Commit the red test**

```powershell
git add -- tests/flatlas-public-version.test.js
git commit -m "test: cover public FLAtlas version"
```

### Task 2: Publish the v0.8.5 version text

**Files:**
- Modify: `index.html:825,830,992,1051`
- Modify: `flatlas/devstatus.json:11`
- Test: `tests/flatlas-public-version.test.js`

- [x] **Step 1: Update the homepage card and translations**

Change the four homepage values to:

```html
<span class="hp-version">v0.8.5</span>
<span data-i18n="atlas_status">v0.8.5 veröffentlicht - v0.9.0 in Arbeit</span>
```

```js
atlas_status: 'v0.8.5 veröffentlicht - v0.9.0 in Arbeit',
atlas_status: 'v0.8.5 released - v0.9.0 in progress',
```

- [x] **Step 2: Update the development-status release label**

Change the JSON label to:

```json
"label": "FLAtlas V2 v0.8.5"
```

- [x] **Step 3: Run the focused version test**

Run: `node tests/flatlas-public-version.test.js`

Expected: PASS with `FLAtlas public version test passed`.

- [x] **Step 4: Confirm stale version strings are gone**

Run:

```powershell
rg -n 'v?0\.8\.3' . --glob '!docs/superpowers/**' --glob '!**/.git/**'
```

Expected: no matches and ripgrep exit code 1.

- [x] **Step 5: Run the homepage test and complete Node suite**

Run: `node tests/site-lightmode.test.js`

Expected: PASS with `site lightmode test passed`.

Run:

```powershell
Get-ChildItem -LiteralPath tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Expected: every Node test exits successfully.

- [x] **Step 6: Inspect and commit the public update**

Run: `git diff --check`

Expected: no output and exit code 0.

```powershell
git add -- index.html flatlas/devstatus.json docs/superpowers/plans/2026-08-12-flatlas-v085-public-version.md
git commit -m "docs: publish FLAtlas v0.8.5 version"
```

- [ ] **Step 7: Push and verify the public source**

Run: `git push origin main`

Expected: push succeeds.

Run:

```powershell
$page = Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/flathack/flathack.github.io/main/index.html'
if ($page.Content -notmatch 'v0\.8\.5 veröffentlicht - v0\.9\.0 in Arbeit') { throw 'Published homepage still lacks FLAtlas v0.8.5' }
```

Expected: command exits successfully.
