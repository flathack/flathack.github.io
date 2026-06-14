const assert = require('node:assert/strict');

const { currentCrossfireTradeDateText, resolveCycleDataset } = require('../assets/js/trade-cycle.js');

const dated = [
  { id: 'data18', date: '2026-04-23', label: 'DATA18 (2026-04-23)' },
  { id: 'data19', date: '2026-04-24', label: 'DATA19 (2026-04-24)' },
  { id: 'data20', date: '2026-04-25', label: 'DATA20 (2026-04-25)' },
  { id: 'data42', date: '2026-05-19', label: 'DATA42 (2026-05-19)' },
  { id: 'data43', date: '2026-05-20', label: 'DATA43 (2026-05-20)' },
  { id: 'data44', date: '2026-05-21', label: 'DATA44 (2026-05-21)' },
  { id: 'data68', date: '2026-06-14', label: 'DATA68 (2026-06-14)' },
];

const cycle = {
  anchorDate: '2026-04-07',
  cycleDays: 26,
};

assert.deepEqual(resolveCycleDataset('2026-06-14', dated, cycle), {
  datasetId: 'data68',
  datasetDate: '2026-06-14',
  requestedDate: '2026-06-14',
  exact: true,
  phase: 17,
});

assert.deepEqual(resolveCycleDataset('2026-06-15', dated, cycle), {
  datasetId: 'data43',
  datasetDate: '2026-05-20',
  requestedDate: '2026-06-15',
  exact: false,
  phase: 18,
});

assert.deepEqual(resolveCycleDataset('2026-06-16', dated, cycle), {
  datasetId: 'data44',
  datasetDate: '2026-05-21',
  requestedDate: '2026-06-16',
  exact: false,
  phase: 19,
});

assert.equal(resolveCycleDataset('bad-date', dated, cycle), null);

assert.equal(
  currentCrossfireTradeDateText(new Date('2026-06-14T05:59:59Z')),
  '2026-06-13',
  'before 08:00 Berlin summer reboot, Crossfire should still use previous price day'
);

assert.equal(
  currentCrossfireTradeDateText(new Date('2026-06-14T06:00:00Z')),
  '2026-06-14',
  'at 08:00 Berlin summer reboot, Crossfire should use current price day'
);

assert.equal(
  currentCrossfireTradeDateText(new Date('2026-01-10T06:59:59Z')),
  '2026-01-09',
  'before 08:00 Berlin winter reboot, Crossfire should still use previous price day'
);

assert.equal(
  currentCrossfireTradeDateText(new Date('2026-01-10T07:00:00Z')),
  '2026-01-10',
  'at 08:00 Berlin winter reboot, Crossfire should use current price day'
);

console.log('trade-cycle tests passed');
