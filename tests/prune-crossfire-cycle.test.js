const assert = require('node:assert/strict');

const { pruneToLatestCycle } = require('../tools/prune_crossfire_cycle.js');

const payload = {
  id: 'crossfire',
  name: 'Crossfire 2.0',
  default_dataset: 'data30',
  dataset_order: ['default', ...Array.from({ length: 30 }, (_, index) => 'data' + (index + 1))],
  datasets: {
    default: { label: 'Default' },
    ...Object.fromEntries(Array.from({ length: 30 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return ['data' + (index + 1), { label: 'DATA' + (index + 1) + ' (2026-05-' + day + ')' }];
    })),
  },
};

const pruned = pruneToLatestCycle(payload, { keepDays: 26 });

assert.equal(pruned.dataset_order.length, 26);
assert.equal(pruned.dataset_order[0], 'data5');
assert.equal(pruned.dataset_order[25], 'data30');
assert.equal(pruned.default_dataset, 'data30');
assert.equal(pruned.datasets.default, undefined);
assert.deepEqual(Object.keys(pruned.datasets), pruned.dataset_order);

console.log('prune crossfire cycle test passed');
