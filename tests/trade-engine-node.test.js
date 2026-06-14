const assert = require('node:assert/strict');

const TradeEngine = require('../assets/js/trade-engine.js');

const sampleData = {
  systems: { A: 'Alpha', B: 'Beta' },
  bases: {
    a_base: { name: 'Alpha Base', sys: 'A' },
    b_base: { name: 'Beta Base', sys: 'B' },
  },
  adjacency: { A: ['B'], B: ['A'] },
  commodities: {
    commodity_food: { name: 'Food', price: 100, volume: 1 },
  },
  markets: {
    commodity_food: [
      { base: 'a_base', sys: 'A', price: 100, src: true },
      { base: 'b_base', sys: 'B', price: 150 },
    ],
  },
  travel: {},
};

const engine = new TradeEngine(sampleData);
const routes = engine.candidateRoutes(275, 4, false);

assert.equal(routes.length, 1);
assert.equal(routes[0].commodity, 'Food');
assert.equal(routes[0].buyBaseNick, 'a_base');
assert.equal(routes[0].sellBaseNick, 'b_base');

console.log('trade-engine node test passed');
