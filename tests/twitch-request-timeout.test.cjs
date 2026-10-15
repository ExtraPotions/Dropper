'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/parts/03-twitch-requests-and-campaign-queue.js'), 'utf8');
const transport = source.slice(source.indexOf('  async function postTwitchJson('), source.indexOf('  function preferredGqlTransports('));
const routing = fs.readFileSync(path.join(__dirname, '../src/parts/01-claims-recovery-and-routing.js'), 'utf8');
const poll = routing.slice(routing.indexOf('  async function requestGqlPoll('), routing.indexOf('  function dropProgressPercent('));

function harness(fetch) {
  let expire;
  let cleared = 0;
  const context = vm.createContext({
    AbortController, page: { fetch }, twitchDeviceId: () => 'fixture', twitchNetworkCapture: {},
    setTimeout: (callback, delay) => { assert.equal(delay, 15000); expire = callback; return 1; },
    clearTimeout: () => { cleared++; },
    ExtraPotionsCore: {}, startupNetworkReadyAt: 0, gqlPollInFlight: false,
    networkCircuitSnapshot: () => ({ open: false }), getToken: () => 'fixture',
    lastGqlPollAt: 0, nextGqlPollAt: 0, lastGqlError: null, gqlErrorStreak: 0,
    gqlPollInterval: () => 60000,
  });
  vm.runInContext(transport + poll, context);
  return { context, expire: () => expire(), cleared: () => cleared };
}

for (const stage of ['fetch', 'body']) {
  test(`page request bounds hung ${stage} and lets the next poll proceed`, async () => {
    let signal;
    const h = harness((_, options) => {
      signal = options.signal;
      return stage === 'fetch' ? new Promise(() => {}) : Promise.resolve({ status: 200, json: () => new Promise(() => {}) });
    });
    h.context.pollGqlDrops = () => h.context.postTwitchJson('fixture', { auth: 'fixture' });
    const pending = h.context.requestGqlPoll('fixture', true);
    await Promise.resolve();
    h.expire();
    await assert.rejects(pending, /Twitch request timed out/);
    assert.equal(signal.aborted, true);
    assert.equal(h.cleared(), 1);
    assert.equal(h.context.gqlPollInFlight, false);
    h.context.page.fetch = async () => ({ status: 200, json: async () => ({ ok: true }) });
    h.context.lastGqlPollAt = 0;
    assert.equal(await h.context.requestGqlPoll('retry', true), true);
    assert.equal(h.cleared(), 2);
    assert.equal(h.context.gqlPollInFlight, false);
  });
}
