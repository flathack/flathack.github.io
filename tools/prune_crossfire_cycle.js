#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FILE = path.join(ROOT, 'data', 'trade-routes', 'crossfire.json');
const DEFAULT_KEEP_DAYS = 26;

function datasetDate(label) {
  const match = /\((\d{4}-\d{2}-\d{2})\)/.exec(String(label || ''));
  return match ? match[1] : '';
}

function pruneToLatestCycle(payload, options = {}) {
  const keepDays = Number(options.keepDays || DEFAULT_KEEP_DAYS);
  const datasets = payload && payload.datasets ? payload.datasets : {};
  const sourceOrder = Array.isArray(payload.dataset_order)
    ? payload.dataset_order.slice()
    : Object.keys(datasets);

  const dated = sourceOrder
    .filter(id => id !== 'default' && datasets[id])
    .map(id => ({
      id,
      date: datasetDate(datasets[id].label || ''),
    }))
    .filter(item => item.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (dated.length < keepDays) {
    throw new Error(`Need at least ${keepDays} dated datasets, found ${dated.length}`);
  }

  const kept = dated.slice(-keepDays);
  const nextDatasets = {};
  for (const item of kept) {
    nextDatasets[item.id] = datasets[item.id];
  }

  return {
    ...payload,
    default_dataset: kept[kept.length - 1].id,
    dataset_order: kept.map(item => item.id),
    datasets: nextDatasets,
    cycle: {
      anchorDate: '2026-04-07',
      cycleDays: 26,
      retainedFrom: kept[0].date,
      retainedTo: kept[kept.length - 1].date,
    },
  };
}

function pruneFile(filePath = DEFAULT_FILE, keepDays = DEFAULT_KEEP_DAYS) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const pruned = pruneToLatestCycle(payload, { keepDays });
  fs.writeFileSync(filePath, JSON.stringify(pruned, null, 0), 'utf8');
  return pruned;
}

if (require.main === module) {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE;
  const keepDays = process.argv[3] ? Number(process.argv[3]) : DEFAULT_KEEP_DAYS;
  const pruned = pruneFile(file, keepDays);
  console.log(
    `Pruned ${path.relative(ROOT, file)} to ${pruned.dataset_order.length} datasets ` +
    `(${pruned.cycle.retainedFrom}..${pruned.cycle.retainedTo})`
  );
}

module.exports = { datasetDate, pruneToLatestCycle, pruneFile };
