#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const TradeEngine = require('../assets/js/trade-engine.js');
const { compactRoute } = require('../assets/js/trade-compare-precomputed.js');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'trade-routes');
const DEFAULT_INPUT = path.join(DATA_DIR, 'crossfire.json');
const DEFAULT_OUTPUT = path.join(DATA_DIR, 'crossfire-compare.json');

const CONFIG = {
  version: 1,
  modId: 'crossfire',
  cargo: 275,
  maxJumps: 4,
  tlOnly: false,
  includeReturnTrip: false,
  topRoutesPerDataset: 150,
  cycle: {
    anchorDate: '2026-04-07',
    cycleDays: 26,
  },
};

function datasetDate(label) {
  const match = /\((\d{4}-\d{2}-\d{2})\)/.exec(String(label || ''));
  return match ? match[1] : '';
}

function enrichRoute(route, dataset) {
  const nick = route.commodityNick || '';
  const commodity = dataset.commodities && dataset.commodities[nick];
  return {
    ...route,
    commodityVolume: commodity && commodity.volume ? commodity.volume : route.commodityVolume,
  };
}

function routeKey(route) {
  return [
    route.commodityNick || route.commodity || '',
    route.buyBaseNick || '',
    route.sellBaseNick || '',
    Array.isArray(route.pathNicks) ? route.pathNicks.join('|') : '',
  ].join('::');
}

function selectCompareRoutes(routes) {
  const selected = new Map();
  const sorted = routes.slice().sort((a, b) =>
    (b.profitPerMin || 0) - (a.profitPerMin || 0) ||
    b.totalProfit - a.totalProfit ||
    b.profitPerUnit - a.profitPerUnit
  );

  for (const route of sorted.slice(0, CONFIG.topRoutesPerDataset)) {
    selected.set(routeKey(route), route);
  }

  const bestByCommodity = new Map();
  for (const route of sorted) {
    const nick = route.commodityNick || route.commodity || '';
    if (!nick || bestByCommodity.has(nick)) continue;
    bestByCommodity.set(nick, route);
    selected.set(routeKey(route), route);
  }

  return Array.from(selected.values());
}

function precompute(inputPath, outputPath) {
  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const order = Array.isArray(payload.dataset_order)
    ? payload.dataset_order.filter(id => id !== 'default')
    : Object.keys(payload.datasets || {}).filter(id => id !== 'default');

  const datasets = {};
  let totalRoutes = 0;

  for (const dsId of order) {
    const dataset = payload.datasets && payload.datasets[dsId];
    if (!dataset) continue;

    const engine = new TradeEngine(dataset);
    const routes = engine.candidateRoutes(CONFIG.cargo, CONFIG.maxJumps, CONFIG.tlOnly);
    engine._applyTravelMetrics(routes, CONFIG.includeReturnTrip);

    const usableRoutes = routes
      .filter(route => route && route.profitPerUnit > 0)
      .map(route => enrichRoute(route, dataset));
    const compactRoutes = selectCompareRoutes(usableRoutes)
      .map(route => compactRoute(route));

    datasets[dsId] = {
      label: dataset.label || dsId,
      date: datasetDate(dataset.label || ''),
      routes: compactRoutes,
      routeCount: compactRoutes.length,
      sourceRouteCount: usableRoutes.length,
    };
    totalRoutes += compactRoutes.length;
  }

  const output = {
    version: CONFIG.version,
    modId: CONFIG.modId,
    source: path.basename(inputPath),
    generatedAt: new Date().toISOString(),
    defaults: {
      cargo: CONFIG.cargo,
      maxJumps: CONFIG.maxJumps,
      tlOnly: CONFIG.tlOnly,
      includeReturnTrip: CONFIG.includeReturnTrip,
    },
    cycle: CONFIG.cycle,
    datasetOrder: order.filter(id => datasets[id]),
    datasets,
    summary: {
      datasetCount: Object.keys(datasets).length,
      routeCount: totalRoutes,
      sourceRouteCount: Object.values(datasets).reduce((sum, dataset) => sum + dataset.sourceRouteCount, 0),
      topRoutesPerDataset: CONFIG.topRoutesPerDataset,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 0), 'utf8');
  return output;
}

if (require.main === module) {
  const input = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT;
  const output = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT;
  const result = precompute(input, output);
  console.log(`Wrote ${path.relative(ROOT, output)} (${result.summary.datasetCount} datasets, ${result.summary.routeCount} routes)`);
}

module.exports = { precompute, datasetDate };
