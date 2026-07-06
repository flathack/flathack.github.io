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

const baseModeData = {
  systems: { A: 'Alpha' },
  bases: {
    a_base: { name: 'Alpha Base', sys: 'A', pos: [0, 0] },
    a_near: { name: 'Alpha Near Market', sys: 'A', pos: [3000, 0] },
    a_far: { name: 'Alpha Far Market', sys: 'A', pos: [30000, 0] },
    a_buyer_only: { name: 'Alpha Buyer Only', sys: 'A', pos: [1000, 0] },
    a_miner: { name: 'Alpha Miner', sys: 'A', pos: [500, 0] },
  },
  adjacency: { A: [] },
  commodities: {
    commodity_food: { name: 'Food', price: 100, volume: 1 },
    commodity_gold: { name: 'Gold', price: 1000, volume: 1 },
  },
  markets: {
    commodity_food: [
      { base: 'a_base', sys: 'A', price: 100, src: true },
      { base: 'a_near', sys: 'A', price: 120 },
      { base: 'a_far', sys: 'A', price: 300 },
      { base: 'a_miner', sys: 'A', price: 1000 },
    ],
    commodity_gold: [
      { base: 'a_base', sys: 'A', price: 1000 },
      { base: 'a_buyer_only', sys: 'A', price: 1500 },
      { base: 'a_miner', sys: 'A', price: 10, src: true },
    ],
  },
  travel: {},
};

const baseEngine = new TradeEngine(baseModeData);
const baseRoutes = baseEngine.routesFromBase(100, 'a_base', 0, false);
assert.equal(baseRoutes.length, 2);
assert.deepEqual(baseRoutes.map(route => route.commodity), ['Food', 'Food']);
assert.deepEqual(baseRoutes.map(route => route.sellBaseNick), ['a_far', 'a_near']);
assert.equal(baseRoutes.some(route => route.sellBaseNick.includes('_miner')), false);
assert.deepEqual(baseEngine.routesFromBase(100, 'a_miner', 0, false), []);
assert(baseRoutes[0].profitPerMin > baseRoutes[1].profitPerMin);
assert.equal(
  baseRoutes.some(route => route.commodity === 'Gold'),
  false,
  'current-base mode must only include commodities sold by the selected base'
);

console.log('trade-engine node test passed');
