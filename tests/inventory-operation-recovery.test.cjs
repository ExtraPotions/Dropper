'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadDropperSource } = require('./load-source.cjs');
const source = loadDropperSource();
const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const OLD_HASH = '2ccf98c1806c3aec3c44f49984d44397ff1df5644b561f887f4e159254db03be';
const CURRENT_HASH = '8337eb8541b314040b0edde0c09c5c7a2783ba1960aa9edfbf3bac16d0fec404';
const missingOperation = () => ({ errors: [{ message: "operation with name 'Inventory' not found" }] });
const inventory = () => ({ data: { currentUser: { inventory: { dropCampaignsInProgress: [] } } } });
const stream = () => ({ data: { user: { id: 'channel-id', stream: { game: { name: 'Game' } } } } });
const reads = [{ op: 'inventory' }, { op: 'streamInfo', variables: { channel: 'channel' } }];
const options = { allowInventoryFailure: true };

function load(rows, { status = 200, stored = {}, transportError } = {}) {
  const calls = [], events = [], storage = new Map(Object.entries(stored).map(([k,v]) => [k, JSON.stringify(v)]));
  const c = vm.createContext({
    Date, cleanText, CLIENT_IDS: ['fixture-client', 'fallback-client'], GQL_URL: 'https://gql.twitch.tv/gql',
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
    logActivity: (...event) => events.push(event), getToken: () => 'fixture-not-a-real-token',
    ensureClientIntegrity: async () => 'fixture-integrity', adoptCapturedIntegrity: () => '',
    beforeDropperNetworkRequest: () => {}, preferredGqlTransports: () => ['gm', 'page'],
    clearClientIntegrity: () => {}, lastIntegrityTransport: '',
    recordDropperNetworkSuccess: () => events.push(['success']),
    recordDropperNetworkFailure: e => events.push(['failure', e.message]),
    postTwitchJson: async (url, req) => {
      calls.push(JSON.parse(JSON.stringify(req)));
      if (transportError) throw transportError;
      return { status, json: typeof rows === 'function' ? rows(calls.length, c) : rows };
    },
  });
  const opsStart = source.indexOf('  const GQL_OPS = {');
  const opsEnd = source.indexOf('\n  };', opsStart) + 5;
  const registryStart = source.indexOf('  const GQL_LEARNED_OPERATIONS_KEY');
  const registryEnd = source.indexOf('\n  let clientIntegrity', registryStart);
  const networkStart = source.indexOf('  function isSoftGqlError(');
  const networkEnd = source.indexOf('\n  function requiresSubscription(', networkStart);
  vm.runInContext(source.slice(opsStart, opsEnd) + '\n' + source.slice(registryStart, registryEnd) + '\n' +
    source.slice(networkStart, networkEnd) + '\nthis.ops = GQL_OPS;', c);
  return { c, calls, events, storage };
}

test('Inventory uses the documented name, hash and required Boolean variable together', () => {
  const { c } = load([]);
  const payload = c.gqlPayload(c.ops.inventory);
  assert.equal(payload.operationName, 'Inventory');
  assert.equal(payload.extensions.persistedQuery.sha256Hash, CURRENT_HASH);
  assert.equal(payload.variables.fetchRewardCampaigns, false);
});

test('an isolated Inventory operation error does not discard a successful stream read or retry the batch', async () => {
  const rows = [missingOperation(), stream()];
  const { c, calls } = load(rows);
  const result = await c.gql(reads, options);
  assert.equal(result[0], rows[0]);
  assert.equal(result[1], rows[1]);
  assert.equal(calls.length, 1, 'another transport cannot fix a mismatched operation name');
  assert.equal(c.gqlOperationsSnapshot().Inventory.lastResult, 'operation-not-found');
});

test('strict Inventory callers still reject the same operation error without duplicate transport requests', async () => {
  const { c, calls } = load([missingOperation()]);
  await assert.rejects(c.gql([{ op: 'inventory' }]), /operation with name/);
  assert.equal(calls.length, 1);
});

test('a missing Inventory hash is an isolated read failure only for opted-in polling', async () => {
  const { c, calls } = load([{ errors: [{ message: 'PersistedQueryNotFound' }] }, stream()]);
  const result = await c.gql(reads, options);
  assert.equal(result[1].data.user.id, 'channel-id');
  assert.equal(calls.length, 1);
  assert.equal(c.gqlOperationsSnapshot().Inventory.lastResult, 'hash-not-found');
});

test('a rejected learned operation is removed, and the next request uses the corrected built-in pair', async () => {
  const stored = { 'dropper-gql-operations-v1': { Inventory: { hash: OLD_HASH, variableKeys: [], learnedAt: 1 } } };
  const { c, calls } = load(n => n === 1 ? [missingOperation(), stream()] : [inventory(), stream()], { stored });
  await c.gql(reads, options);
  await c.gql(reads, options);
  assert.equal(calls[0].body[0].extensions.persistedQuery.sha256Hash, OLD_HASH);
  assert.equal(calls[1].body[0].extensions.persistedQuery.sha256Hash, CURRENT_HASH);
  assert.equal(calls[1].body[0].variables.fetchRewardCampaigns, false);
  assert.equal(c.gqlOperationsSnapshot().Inventory.source, 'built-in');
});

test('a response for an older payload cannot erase a newer validated page-learned hash', async () => {
  const newerHash = 'f'.repeat(64);
  const { c } = load((n, ctx) => {
    ctx.learnGqlOperationsFromPage([{ name: 'Inventory', hash: newerHash, variableKeys: [] }], [inventory()]);
    return [missingOperation(), stream()];
  });
  await c.gql(reads, options);
  assert.equal(c.gqlPayload(c.ops.inventory).extensions.persistedQuery.sha256Hash, newerHash);
});

test('a page-observed Boolean variable remains supplied when the learned Inventory needs it', () => {
  const { c } = load([]);
  c.learnGqlOperationsFromPage([{ name: 'Inventory', hash: 'f'.repeat(64), variableKeys: ['fetchRewardCampaigns'] }], [inventory()]);
  assert.equal(c.gqlPayload(c.ops.inventory).variables.fetchRewardCampaigns, false);
});

for (const failure of [
  { message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } },
  { message: 'Rate limit exceeded', extensions: { code: 'TOO_MANY_REQUESTS' } },
  { message: 'failed integrity check' },
  { message: 'Service Error' },
]) {
  test(`poll isolation does not swallow ${failure.message}`, async () => {
    const { c } = load([{ errors: [failure] }, stream()]);
    await assert.rejects(c.gql(reads, options));
  });
}

test('data plus an error is not treated as an empty successful Inventory', async () => {
  const row = inventory(); row.errors = missingOperation().errors;
  const { c } = load([row, stream()]);
  await assert.rejects(c.gql(reads, options));
});

test('the opt-in cannot suppress errors in mutation-containing batches', async () => {
  const { c } = load([missingOperation(), { data: { claimDropRewards: { status: 'ELIGIBLE_FOR_ALL' } } }]);
  await assert.rejects(c.gql([{ op: 'inventory' }, { op: 'claimDrop' }], options), /operation with name/);
});

test('a non-Inventory operation failure still rejects opted-in polling', async () => {
  const { c } = load([inventory(), { errors: [{ message: "operation with name 'VideoPlayerStreamInfoOverlayChannel' not found" }] }]);
  await assert.rejects(c.gql(reads, options), /VideoPlayer/);
});

test('missing or surplus rows cannot shift a different response into the Inventory position', async () => {
  for (const rows of [[stream()], [inventory(), stream(), stream()]]) {
    const { c } = load(rows);
    await assert.rejects(c.gql(reads, options), /response count/);
  }
});

test('the Inventory row remains attached to strict batch failures for sanitized diagnostics', async () => {
  const rows = [missingOperation(), stream()];
  const { c } = load(rows);
  await assert.rejects(c.gql(reads), error => error.inventoryRow === rows[0]);
});

test('HTTP authorization failures are not converted into partial successful reads', async () => {
  const { c } = load([missingOperation(), stream()], { status: 403 });
  await assert.rejects(c.gql(reads, options), /HTTP 403/);
});
