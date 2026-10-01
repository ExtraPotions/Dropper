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
    GQL_OPS: { inventory: { name: "Inventory", hash: BUILT_IN, variables: { fetchRewardCampaigns: true } } },
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
