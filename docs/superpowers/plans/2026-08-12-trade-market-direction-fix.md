# Trade Market Direction Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the trade calculator from inventing source bases for commodities that every listed base only buys.

**Architecture:** Keep the exported market schema unchanged and correct source selection once in `TradeEngine._buildCommodityRouteIndex()`. All candidate-route consumers inherit the behavior from this shared index, while `routesFromBase()` continues using its existing explicit-source check.

**Tech Stack:** Browser-compatible JavaScript, Node.js assertions, committed JSON trade datasets

---

### Task 1: Reproduce the buy-only route defect

**Files:**
- Modify: `tests/trade-engine-node.test.js:62-75`
- Test: `tests/trade-engine-node.test.js`

- [x] **Step 1: Add the failing regression assertion**

Use the existing `baseModeData.commodity_gold` fixture, whose two accessible entries are both buy-only and whose only source is the inaccessible `_miner` base. Add this assertion after the current-base checks:

```js
assert.equal(
  baseEngine.candidateRoutes(100, 0, false).some(route => route.commodity === 'Gold'),
  false,
  'candidate routes must not promote buy-only bases to commodity sources'
);
```

- [x] **Step 2: Run the focused test and verify the regression fails**

Run: `node tests/trade-engine-node.test.js`

Expected: FAIL at the new assertion because the current fallback promotes the accessible buy-only Gold entries to sources and creates a profitable route.

- [x] **Step 3: Commit the red regression test**

```powershell
git add -- tests/trade-engine-node.test.js
git commit -m "test: cover buy-only commodity routes"
```

### Task 2: Remove implicit source promotion

**Files:**
- Modify: `assets/js/trade-engine.js:78-79`
- Test: `tests/trade-engine-node.test.js`

- [x] **Step 1: Implement the minimal source-index correction**

Replace the mutable source list and fallback:

```js
let sources = accessible.filter(entry => entry.src);
if (!sources.length) sources = accessible.slice();
```

with explicit-only source selection:

```js
const sources = accessible.filter(entry => entry.src);
```

- [x] **Step 2: Run the focused test and verify it passes**

Run: `node tests/trade-engine-node.test.js`

Expected: PASS with `trade-engine node test passed`.

- [x] **Step 3: Verify the committed Discovery dataset no longer creates restock routes**

Run:

```powershell
node -e "const fs=require('fs');const TradeEngine=require('./assets/js/trade-engine.js');const root=JSON.parse(fs.readFileSync('./data/trade-routes/discovery.json','utf8'));const data=root.datasets[root.default_dataset];const engine=new TradeEngine(data);const name=data.commodities.commodity_pob_restock.name;const routes=engine.candidateRoutes(100,99,false).filter(route=>route.commodity===name);if(routes.length)throw new Error('Found '+routes.length+' artificial commodity_pob_restock routes');console.log('Discovery buy-only route check passed');"
```

Expected: PASS with `Discovery buy-only route check passed`.

- [x] **Step 4: Run every Node-based repository test**

Run:

```powershell
Get-ChildItem -LiteralPath tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Expected: Every test exits successfully with no assertion errors.

- [x] **Step 5: Check the final diff and commit the fix**

Run: `git diff --check`

Expected: no output and exit code 0.

```powershell
git add -- assets/js/trade-engine.js docs/superpowers/plans/2026-08-12-trade-market-direction-fix.md
git commit -m "fix: respect buy-only commodity markets"
```
