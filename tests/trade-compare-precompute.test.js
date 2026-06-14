const assert = require('node:assert/strict');

const {
  compactRoute,
  createPrecomputedTradePayload,
  hydratePrecomputedRoute,
  analyzePrecomputedDatasets,
} = require('../assets/js/trade-compare-precomputed.js');

const rawRoute = {
  commodityNick: 'commodity_food',
  commodity: 'Food',
  commodityVolume: 2,
  srcSys: 'Alpha',
  srcSysNick: 'A',
  buyBase: 'Alpha Base',
  buyBaseNick: 'a_base',
  dstSys: 'Beta',
  dstSysNick: 'B',
  sellBase: 'Beta Base',
  sellBaseNick: 'b_base',
  buyPrice: 100,
  sellPrice: 150,
  profitPerUnit: 50,
  jumps: 1,
  path: ['Alpha', 'Beta'],
  pathNicks: ['A', 'B'],
  travelTime: 120,
};

const compact = compactRoute(rawRoute);
assert.deepEqual(Object.keys(compact).sort(), [
  'bb', 'bn', 'bp', 'c', 'cn', 'cv', 'db', 'dbn', 'dn', 'ds', 'j', 'p', 'pn', 'sn', 'sp', 'ss', 't',
]);

const hydrated = hydratePrecomputedRoute(compact, 275);
assert.equal(hydrated.cargoUnits, 137);
assert.equal(hydrated.totalProfit, 6850);
assert.equal(hydrated.profitPerMin, 3425);
assert.equal(hydrated.buyBaseNick, 'a_base');
assert.equal(hydrated.sellBaseNick, 'b_base');

const analysis = analyzePrecomputedDatasets({
  datasetOrder: ['day1'],
  datasets: {
    day1: { label: 'DATA1 (2026-06-15)', routes: [compact] },
  },
}, new Set(['default', 'day1']), 275, { maxJumps: 4 });

assert.equal(analysis.dayStats.length, 1);
assert.deepEqual(analysis.dsIds, ['day1']);
assert.equal(analysis.dayStats[0].bestRoute.totalProfit, 6850);
assert.equal(analysis.commodityStats[0].avgPPM, 3425);

const filtered = analyzePrecomputedDatasets({
  datasetOrder: ['day1'],
  datasets: {
    day1: { label: 'DATA1 (2026-06-15)', routes: [compact] },
  },
}, new Set(['day1']), 275, { maxJumps: 0 });

assert.equal(filtered.dayStats[0].bestRoute, null);
assert.equal(filtered.dayStats[0].topRoutes.length, 0);

const lightweightPayload = createPrecomputedTradePayload({
  modId: 'crossfire',
  datasetOrder: ['day1'],
  datasets: {
    day1: { label: 'DATA1 (2026-06-15)', routes: [compact] },
  },
});

assert.equal(lightweightPayload.id, 'crossfire');
assert.equal(lightweightPayload.default_dataset, 'day1');
assert.deepEqual(lightweightPayload.dataset_order, ['day1']);
assert.equal(lightweightPayload.datasets.day1.label, 'DATA1 (2026-06-15)');
assert.equal(lightweightPayload.datasets.day1.routes, undefined);

console.log('trade compare precompute test passed');
