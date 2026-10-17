'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadDropperSource } = require('./load-source.cjs');
const source = loadDropperSource();
const start = source.indexOf('  function campaignPriorityEntry');
const end = source.indexOf('\n  function normalizedCampaignStrategy', start);
assert.ok(start >= 0 && end > start);

function fixture(stored = new Map()) {
  const context = {
    account: 'alice', productResetting: false,
    CAMPAIGN_PRIORITY_KEY: 'legacy', CAMPAIGN_PRIORITY_ORDER_KEY: 'order',
    normalizeGameName: value => String(value || '').trim().toLowerCase(),
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
  };
  context.scopedLocalStorageKey = key => `${key}:${context.account}`;
  vm.runInNewContext(source.slice(start, end) + '\nthis.move = setCampaignPriorityPosition; this.read = readCampaignPriorityOrder;', context);
  return { context, stored, order: () => Array.from(context.read()) };
}
const games = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map(game => ({ game }));
const initial = ['inactive before', 'alpha', 'inactive middle', 'bravo', 'charlie', 'delta', 'inactive after'];

test('direct moves preserve intervening game order and inactive slots in both directions', () => {
  const { context, stored, order } = fixture();
  stored.set('order:alice', JSON.stringify(initial));
  assert.equal(context.move('Delta', 1, games), true);
  assert.deepEqual(order(), ['inactive before', 'delta', 'inactive middle', 'alpha', 'bravo', 'charlie', 'inactive after']);
  assert.equal(context.move('Delta', 4, games), true);
  assert.deepEqual(order(), initial);
  assert.equal(context.move('Bravo', 3, games), true);
  assert.deepEqual(order(), ['inactive before', 'alpha', 'inactive middle', 'charlie', 'bravo', 'delta', 'inactive after']);
});

test('invalid, unchanged and reset-time moves do not rewrite the saved ranking', () => {
  const { context, stored, order } = fixture();
  stored.set('order:alice', JSON.stringify(initial));
  for (const position of [0, -1, 5, 1.5, NaN, Infinity, '1', null, 1]) {
    assert.equal(context.move('Alpha', position, games), false);
    assert.deepEqual(order(), initial);
  }
  assert.equal(context.move('Missing', 1, games), false);
  context.productResetting = true;
  assert.equal(context.move('Delta', 1, games), false);
  assert.deepEqual(order(), initial);
});

test('a direct move persists across reloads and stays scoped to its account', () => {
  const { context, stored, order } = fixture();
  stored.set('order:alice', JSON.stringify(initial));
  assert.equal(context.move('Delta', 1, games), true);
  const saved = order();
  const reloaded = fixture(stored);
  assert.deepEqual(reloaded.order(), saved);
  reloaded.context.account = 'bob';
  assert.deepEqual(reloaded.order(), []);
  assert.equal(reloaded.context.move('Bravo', 1, games), true);
  assert.deepEqual(reloaded.order(), ['bravo', 'alpha', 'charlie', 'delta']);
  reloaded.context.account = 'alice';
  assert.deepEqual(reloaded.order(), saved);
});
