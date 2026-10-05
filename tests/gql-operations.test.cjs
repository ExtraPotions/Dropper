"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const { loadDropperSource } = require("./load-source.cjs");
const source = loadDropperSource();

const BUILT_IN = "a".repeat(64);
const TWITCH_NEW = "b".repeat(64);

function loadOperations(stored = {}) {
  const start = source.indexOf("  const GQL_LEARNED_OPERATIONS_KEY");
  const end = source.indexOf("\n  let clientIntegrity", start);
  const checkStart = source.indexOf("  const GQL_EXPECTED_SHAPES");
  const checkEnd = source.indexOf("\n  async function gql(", checkStart);
  const storage = new Map(Object.entries(stored).map(([key, value]) => [key, JSON.stringify(value)]));
  const activity = [];
  const context = {
    productResetting: false,
    GQL_OPS: {
      inventory: { name: "Inventory", hash: BUILT_IN, variables: { fetchRewardCampaigns: true } },
      availableDrops: { name: "ChannelDropsCampaigns", hash: BUILT_IN, variables: { channelID: "" } },
      currentDrop: { name: "DropCurrentSessionContext", hash: BUILT_IN, variables: {} },
    },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    cleanText: (value) => String(value ?? "").replace(/\s+/g, " ").trim(),
    logActivity: (type, message) => activity.push(message),
  };
  vm.runInNewContext(
    `${source.slice(start, end)}\n${source.slice(checkStart, checkEnd)}\n` +
    "this.learn = learnGqlOperationsFromPage; this.payload = gqlPayload; this.check = checkGqlOperationResults; this.snapshot = gqlOperationsSnapshot;",
    context,
  );
  return { ...context, storage, activity };
}

const okRow = { data: { currentUser: { inventory: { dropCampaignsInProgress: [] } } } };

test('session operation reports absence separately and cannot learn a hash from an unrecognized envelope', () => {
  const ops = loadOperations();
  const changed = { data: { currentUser: {} } };
  ops.check([{op:'currentDrop'}], [changed], 200);
  assert.equal(ops.snapshot().DropCurrentSessionContext.lastResult, 'shape-changed');
  ops.learn([{name:'DropCurrentSessionContext',hash:TWITCH_NEW,variableKeys:['channelLogin']}], [changed]);
  assert.equal(ops.snapshot().DropCurrentSessionContext.source, 'built-in');
  ops.check([{op:'currentDrop'}], [{data:{currentUser:{dropCurrentSession:null}}}], 200);
  assert.equal(ops.snapshot().DropCurrentSessionContext.lastResult, 'absent');
});

test('current channel campaign query validates native data and rejects the obsolete response', () => {
  const ops = loadOperations();
  ops.check([{ op: 'availableDrops' }], [{ data: { channel: { viewerDropCampaigns: null } } }], 200);
  assert.equal(ops.snapshot().ChannelDropsCampaigns.lastResult, 'shape-changed');
  ops.check([{ op: 'availableDrops' }], [{ data: { channelDropCampaigns: [] } }], 200);
  assert.equal(ops.snapshot().ChannelDropsCampaigns.lastResult, 'ok');
  ops.learn([{ name: 'ChannelDropsCampaigns', hash: TWITCH_NEW, variableKeys: ['channelID'] }], [{ data: { channelDropCampaigns: null } }]);
  assert.equal(ops.snapshot().ChannelDropsCampaigns.source, 'built-in');
  ops.learn([{ name: 'ChannelDropsCampaigns', hash: TWITCH_NEW, variableKeys: ['channelID'] }], [{ data: { channelDropCampaigns: [] } }]);
  const payload = ops.payload(ops.GQL_OPS.availableDrops, { channelID: 'fixture-channel' });
  assert.equal(payload.operationName, 'ChannelDropsCampaigns');
  assert.equal(payload.extensions.persistedQuery.sha256Hash, TWITCH_NEW);
  assert.equal(payload.variables.channelID, 'fixture-channel');
});

test("learns Twitch's current hash and variable names from the page's own request", () => {
  const ops = loadOperations();
  ops.learn([{ name: "Inventory", hash: TWITCH_NEW, variableKeys: [] }], [okRow]);
  const payload = ops.payload(ops.GQL_OPS.inventory, {});
  assert.equal(payload.extensions.persistedQuery.sha256Hash, TWITCH_NEW);
  assert.deepEqual({ ...payload.variables }, {}, "built-in variables the current query does not declare are left out");
  assert.equal(ops.snapshot().Inventory.source, "learned-from-twitch");
  assert.ok(JSON.parse(ops.storage.get("dropper-gql-operations-v1")).Inventory, "the learned hash survives reloads");
});

test("ignores Dropper's own built-in hash, failed responses, unknown operations and malformed hashes", () => {
  const ops = loadOperations();
  ops.learn([{ name: "Inventory", hash: BUILT_IN, variableKeys: [] }], [okRow]);
  ops.learn([{ name: "Inventory", hash: TWITCH_NEW, variableKeys: [] }], [{ errors: [{ message: "PersistedQueryNotFound" }] }]);
  ops.learn([{ name: "SomethingElse", hash: TWITCH_NEW, variableKeys: [] }], [okRow]);
  ops.learn([{ name: "Inventory", hash: "not-a-hash", variableKeys: [] }], [okRow]);
  const payload = ops.payload(ops.GQL_OPS.inventory, {});
  assert.equal(payload.extensions.persistedQuery.sha256Hash, BUILT_IN);
  assert.equal(payload.variables.fetchRewardCampaigns, true);
});

test("a learned hash Twitch rejects is dropped and the built-in one is used again", () => {
  const ops = loadOperations({ "dropper-gql-operations-v1": { Inventory: { hash: TWITCH_NEW, variableKeys: [], learnedAt: 1 } } });
  assert.equal(ops.payload(ops.GQL_OPS.inventory, {}).extensions.persistedQuery.sha256Hash, TWITCH_NEW);
  ops.check([{ op: "inventory" }], [{ errors: [{ message: "PersistedQueryNotFound" }] }], 200);
  assert.equal(ops.payload(ops.GQL_OPS.inventory, {}).extensions.persistedQuery.sha256Hash, BUILT_IN);
  assert.equal(ops.snapshot().Inventory.lastResult, "hash-not-found");
});

test("a response without the expected fields is reported as a shape change", () => {
  const ops = loadOperations();
  ops.check([{ op: "inventory" }], [{ data: { currentUser: { inventory: { somethingNew: [] } } } }], 200);
  assert.equal(ops.snapshot().Inventory.lastResult, "shape-changed");
  ops.check([{ op: "inventory" }], [okRow], 200);
  assert.equal(ops.snapshot().Inventory.lastResult, "ok");
});

test('unavailable and partial inventory have explicit outcomes instead of ok or valid-empty', () => {
  const ops = loadOperations();
  ops.check([{ op: 'inventory' }], [{ data: { currentUser: { inventory: null } } }], 200);
  assert.equal(ops.snapshot().Inventory.lastResult, 'unavailable');
  ops.check([{ op: 'inventory' }], [{ ...okRow, errors: [{ message: 'Service Error' }] }], 200);
  assert.equal(ops.snapshot().Inventory.lastResult, 'partial-response');
});
test('the page cannot teach an Inventory hash from an unusable response shape', () => {
  const ops = loadOperations();
  ops.learn([{ name: 'Inventory', hash: TWITCH_NEW, variableKeys: [] }], [{ data: { currentUser: { inventory: null } } }]);
  assert.equal(ops.snapshot().Inventory.source, 'built-in');
  ops.learn([{ name: 'Inventory', hash: TWITCH_NEW, variableKeys: [] }], [{ data: { currentUser: { inventory: { changed: [] } } } }]);
  assert.equal(ops.snapshot().Inventory.source, 'built-in');
  ops.learn([{ name: 'Inventory', hash: TWITCH_NEW, variableKeys: [] }], [okRow]);
  assert.equal(ops.snapshot().Inventory.source, 'learned-from-twitch');
});
