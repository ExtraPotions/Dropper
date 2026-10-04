'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadDropperSource, loadActiveViewing } = require('./load-source.cjs');
const source = loadDropperSource(), active = loadActiveViewing();
const plain = value => JSON.parse(JSON.stringify(value));
function extract(name) {
  const start = source.search(new RegExp('^  (?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, name + ' exists');
  const rest = source.slice(start), next = rest.slice(4).search(/^  (?:async )?function \w+\(/m);
  return next < 0 ? rest : rest.slice(0, next + 4);
}
const now = Date.parse('2026-10-01T20:03:19Z');
const reward = (id, total, minutes, extra = {}) => ({ id, requiredMinutesWatched: total, self: { currentMinutesWatched: minutes, isClaimed: false }, ...extra });
const campaign = drops => ({ startAt: '2026-09-28T16:00:00Z', endAt: '2026-10-05T06:59:59.999Z', timeBasedDrops: drops });

test('campaign milestones use the longest outstanding bar, without copying credit between IDs', () => {
  const c = campaign([reward('one', 60, 60, { self: { currentMinutesWatched: 60, isClaimed: true } }), reward('two', 120, 89), reward('four', 240, 89), reward('eight', 480, 89)]);
  const before = plain(c), result = active.campaignSequence(c, now);
  assert.equal(result.remainingMinutes, 391);
  assert.equal(result.watchRewards, 3);
  assert.equal(result.timingModel, 'parallel');
  assert.deepEqual(c, before);
  c.timeBasedDrops[2].self.currentMinutesWatched = 10;
  assert.equal(active.campaignSequence(c, now).remainingMinutes, 391, 'each bar retains its own credit');
});
test('parallel timing also corrects the earlier four-reward diagnostic total', () => {
  const c = campaign([60, 120, 240, 480].map((m, i) => reward(String(i), m, 36)));
  assert.equal(active.campaignSequence(c, now).remainingMinutes, 444);
});
test('unknown duration, unknown progress, future windows and differing windows stay unknown', () => {
  for (const drop of [reward('missing-duration', null, 0), reward('missing-credit', 120, null), reward('future', 120, 0, { startAt: '2026-10-03T00:00:00Z' })]) {
    const result = active.campaignSequence(campaign([reward('known', 60, 5), drop]), now);
    assert.equal(result.remainingMinutes, null);
    assert.equal(result.finishable, null);
    assert.equal(result.timingModel, 'unknown');
    assert.ok(result.estimateReason);
  }
  assert.equal(active.campaignSequence(campaign([reward('a', 60, 0), reward('b', 120, 0, { endAt: '2026-10-04T00:00:00Z' })]), now).estimateReason, 'different-reward-windows');
});
test('unverified or cyclic dependencies are not assumed to accrue in parallel', () => {
  const a = reward('a', 60, 10), b = reward('b', 120, 0, { preconditionDrops: [{ id: 'a' }] });
  assert.equal(active.campaignSequence(campaign([a, b]), now).remainingMinutes, null);
  a.preconditionDrops = [{ id: 'b' }];
  assert.equal(active.campaignSequence({ ...campaign([a, b]), timingModel: 'parallel' }, now).remainingMinutes, null);
  delete a.preconditionDrops;
  assert.equal(active.campaignSequence({ ...campaign([a, b]), timingModel: 'sequential' }, now).remainingMinutes, 170);
});
test('pending claims remain visible and paid rewards never add watch time', () => {
  const result = active.campaignSequence(campaign([reward('ready', 60, 60), reward('pending', 120, 89), reward('paid', null, null, { requiredSubs: 1 })]), now);
  assert.equal(result.pendingClaims, 1);
  assert.equal(result.watchRewards, 2);
  assert.equal(result.remainingMinutes, 31);
});
test('unknown arrivals remain protected and report uncertainty rather than inventing a viewer click', () => {
  const intent = active.createIntent();
  intent.context('alice', 'newchannel');
  assert.equal(intent.snapshot().arrivalSource, 'unclassified-arrival');
  assert.equal(intent.navigationAllowed(), false);
  intent.allowSwitching();
  assert.equal(intent.snapshot().arrivalSource, 'viewer-enabled-switching');
  assert.equal(intent.navigationAllowed(), true);
});
test('an explicit viewer link wins over previously automatic saved context and preserves pause', () => {
  const saved = { account: 'alice', channel: 'newchannel', manualStream: false, paused: true, pauseReason: 'viewer' };
  const intent = active.createIntent({ load: () => saved });
  intent.context('alice', 'newchannel', false, 'viewer-link');
  assert.equal(intent.snapshot().manualStream, true);
  assert.equal(intent.snapshot().arrivalSource, 'viewer-link');
  assert.equal(intent.snapshot().paused, true);
  assert.equal(intent.navigationAllowed(), false);
  assert.equal(intent.takeRecovery(), false);
});
test('viewer provenance only records trusted same-tab Twitch channel clicks', () => {
  const writes = [], c = { URL, RESERVED: new Set(['directory', 'drops', 'inventory']), location: { href: 'https://www.twitch.tv/oldchannel' }, Date: { now: () => now }, VIEWING_SELECTION_KEY: 'selection', writeSession: (key, value) => writes.push([key, value]), cleanText: v => String(v || '').trim() };
  vm.createContext(c);
  vm.runInContext(extract('isTrustedTwitchUrl') + extract('twitchChannelHref') + extract('streamLoginFromUrl') + extract('recordViewerChannelSelection'), c);
  const anchor = { href: 'https://www.twitch.tv/newchannel', target: '', hasAttribute: () => false };
  const event = { isTrusted: true, button: 0, composedPath: () => [], target: { closest: () => anchor } };
  c.recordViewerChannelSelection(event);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1].channel, 'newchannel');
  for (const patch of [{ isTrusted: false }, { defaultPrevented: true }, { button: 1 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { composedPath: () => [{ id: 'tdh-root' }] }]) c.recordViewerChannelSelection({ ...event, ...patch });
  anchor.target = '_blank'; c.recordViewerChannelSelection(event);
  anchor.target = ''; anchor.href = 'https://evil.example/newchannel'; c.recordViewerChannelSelection(event);
  anchor.href = 'https://www.twitch.tv/directory/category/game'; c.recordViewerChannelSelection(event);
  assert.equal(writes.length, 1);
});
test('blocked routing clears stale earning evidence but keeps the campaign, reward and credit', () => {
  for (const paused of [false, true]) {
    let session = { state: 'earning', targetStream: 'oldchannel', targetGame: 'Heroes of the Storm', targetCampaignKey: 'campaign', targetDropId: 'two', candidateEvidence: { campaignVerified: true }, deadlineAt: now + 90000 };
    let transitions = 0;
    const currentDrop = reward('two', 120, 89);
    const c = { Date, settings: { findNextStream: true }, currentDrop, ROUTING_STATES: { PAUSED: 'paused' }, routingControllerResetLegacyHandoff() {}, recoveryNavigationState:()=>({suspended:false}), isAutoRoutingController: () => true, viewingNavigationAllowed: () => false, readRoutingControllerSession: () => session, viewingIntent: { snapshot: () => ({ paused, manualStream: !paused }) }, lastViewingNavigationBlock: paused ? 'Playback Paused' : 'Automatic Switching Needs Approval', refreshViewingControls() {}, transitionRoutingController: (state, patch) => { transitions++; return session = { ...session, ...patch, state }; } };
    vm.createContext(c); vm.runInContext(extract('routingControllerTick'), c);
    assert.equal(c.routingControllerTick(now), false);
    assert.equal(session.state, 'paused');
    assert.equal(session.waitReason, paused ? 'viewer-paused' : 'manual-stream');
    assert.equal(session.targetStream, ''); assert.equal(session.candidateEvidence, null); assert.equal(session.deadlineAt, 0);
    assert.equal(session.targetDropId, 'two'); assert.equal(session.targetCampaignKey, 'campaign');
    assert.equal(currentDrop.self.currentMinutesWatched, 89);
    c.routingControllerTick(now + 5000);
    assert.equal(transitions, 1, 'held heartbeat does not repeatedly rewrite or log the same state');
  }
});
test('resuming on the wrong game requests fresh category discovery instead of stale cached stream', () => {
  let session, navigation;
  const c = { Date: { now: () => now }, settings: { findNextStream: true }, currentDrop: { id: 'two', game: 'Heroes of the Storm', gameSlug: 'heroes-of-the-storm', currentMinutes: 89, requiredMinutes: 120 }, ROUTING_STATES: { FIND_STREAM: 'find-stream', VERIFY_STREAM: 'verify-stream' }, ROUTING_NAVIGATION_DEADLINE_MS: 30000, routingControllerResetLegacyHandoff() {}, campaignMarkedComplete: () => false, campaignIsRoutingOpen: () => true, dropProgressComplete: () => false, watchingLogin: () => 'unrelated', readStreamInfo: () => ({ live: true, game: 'Just Chatting' }), gameNamesMatch: (a,b) => a === b, routingControllerTargetFromDrop: d => ({ targetGame: d.game, targetSlug: d.gameSlug }), transitionRoutingController: (state, patch) => session = { ...session, ...patch, state }, readRoutingControllerSession: () => session, cleanText: s => s, resolveCategorySlug: o => o.gameSlug, isDirectoryCategoryPage: () => false, routingControllerNavigate: (url, reason) => { navigation = { url, reason }; } };
  vm.createContext(c); vm.runInContext(extract('routingControllerBootstrap') + extract('routingControllerFindStream'), c);
  c.routingControllerBootstrap(); assert.equal(session.state, 'find-stream'); assert.equal(session.targetStream, ''); assert.equal(session.candidateEvidence, null);
  c.routingControllerFindStream(now);
  assert.equal(navigation.url, 'https://www.twitch.tv/directory/category/heroes-of-the-storm');
});
test('standby cache maintenance never refreshes observation age or pretends inventory is discovery', () => {
  const stale = { login: 'standby', campaignKey: 'campaign', seenAt: now - 300000 };
  const c = { Date, standbyCache: [stale], currentDrop: { game: 'Heroes of the Storm', campaignKey: 'campaign' }, readRoutingControllerSession: () => ({}), pruneStandbyCache() {}, cachedStandbyCandidates: () => c.standbyCache, STANDBY_CACHE_KEY: 'cache', STANDBY_MAINTENANCE_KEY: 'maintenance', STANDBY_LIVE_FRESH_MS: 60000, STANDBY_REFRESH_INTERVAL_MS: 900000, lastStandbyRefreshAt: stale.seenAt, lastStandbyMaintenanceAt: 0, lastStandbyMaintenance: null, writeSession() {}, logActivity() {}, queueGqlPollSoon() { throw new Error('Inventory is not stream discovery'); }, autoNavigateTwitch() { throw new Error('Maintenance cannot interrupt the viewer'); } };
  vm.createContext(c); vm.runInContext(extract('refreshStandbyCampaignCache'), c);
  c.refreshStandbyCampaignCache(now);
  assert.equal(c.lastStandbyRefreshAt, stale.seenAt); assert.equal(c.standbyCache[0].seenAt, stale.seenAt);
  assert.equal(c.lastStandbyMaintenanceAt, now); assert.equal(c.lastStandbyMaintenance.rediscoveryNeeded, true); assert.equal(c.lastStandbyMaintenance.freshCandidates, 0);
  c.standbyCache.push({ login: 'fresh', campaignKey: 'campaign', seenAt: now - 1000 });
  c.refreshStandbyCampaignCache(now);
  assert.equal(c.lastStandbyMaintenance.freshCandidates, 1);
  assert.equal(c.lastStandbyMaintenance.rediscoveryNeeded, false);
});

test('a matching later session replaces stale campaign-only identity without inventing watch credit', () => {
  let routing = { state: 'earning', targetStream: 'same', candidateEvidence: { gqlSessionIdentityLevel: 'campaign-only-different-drop' }, enteredAt: now - 1000 };
  const c = { Date: { now: () => now }, currentDrop: { id: 'two', game: 'Game', campaignKey: 'campaign', currentMinutes: 67, requiredMinutes: 120, percent: 56 }, ROUTING_STATES: { EARNING: 'earning' }, readRoutingControllerSession: () => routing, cleanText: v => String(v || '').trim(), gameNamesMatch: (a,b) => a === b, routingControllerTargetFromDrop: d => ({ targetDropId: d.id }), writeRoutingControllerSession: r => { routing = r; }, lastStreamVerification: { channel: 'same', campaignKey: 'campaign', game: 'Game' } };
  vm.createContext(c); vm.runInContext(extract('restoreVerifiedEarningFromSession'), c);
  assert.equal(c.restoreVerifiedEarningFromSession('same', { id: 'two', campaignKey: 'campaign', game: 'Game' }), true);
  assert.equal(routing.candidateEvidence.gqlSessionIdentityLevel, 'exact-drop');
  assert.equal(routing.candidateEvidence.gqlSessionDropMatched, true);
  assert.notEqual(routing.candidateEvidence.creditedProgressVerified, true);
  assert.equal(c.currentDrop.currentMinutes, 67);
  assert.equal(c.restoreVerifiedEarningFromSession('other', { id: 'two', campaignKey: 'campaign', game: 'Game' }), false);
  assert.equal(c.restoreVerifiedEarningFromSession('same', { id: 'different', campaignKey: 'campaign', game: 'Game' }), false);
});

test('Dropper discards only retired width preferences and preserves saved behavior', () => {
  for (const value of ['full', 'compact', 'narrow']) {
    let stored = JSON.stringify({ collapsedPanelWidth: value, menuWidth: value, muteRestarted: false, findNextStream: false, opacityPercent: 73, gamePriorities: ['Game'] });
    const c = { SETTINGS_KEY: 'settings', DEFAULTS: { muteRestarted: true, findNextStream: true }, localStorage: { getItem: () => stored, setItem: (key, text) => { stored = text; } } };
    vm.createContext(c); vm.runInContext(extract('loadSettings'), c);
    const loaded = plain(c.loadSettings()), persisted = JSON.parse(stored);
    assert.equal(Object.hasOwn(loaded, 'collapsedPanelWidth'), false);
    assert.equal(Object.hasOwn(loaded, 'menuWidth'), false);
    assert.deepEqual(loaded, { muteRestarted: false, findNextStream: false, opacityPercent: 73, gamePriorities: ['Game'] });
    assert.deepEqual(persisted, loaded);
  }
});

test('routing wait reasons clear after pause verification resumes earning', () => {
  class FixedDate extends Date { static now() { return now; } }
  let session = {
    version: 1,
    state: 'earning',
    enteredAt: now - 5000,
    updatedAt: now - 5000,
    deadlineAt: 0,
    targetGame: 'Heroes of the Storm',
    targetCampaignKey: 'campaign',
    targetDropId: 'four',
    targetStream: 'junhots_',
    failedStreams: [],
    waitReason: '',
    lastReason: 'Verified junhots_',
  };
  const states = { WAITING: 'waiting', PAUSED: 'paused', VERIFY_STREAM: 'verify-stream', EARNING: 'earning' };
  const c = {
    Date: FixedDate,
    ROUTING_SESSION_VERSION: 1,
    ROUTING_SESSION_KEY: 'routing',
    ROUTING_STATES: states,
    readRoutingControllerSession: () => session,
    writeSession: (_key, value) => { session = value; },
    cleanText: value => String(value || '').trim(),
    clearSkipStreamerArm() {},
    logActivity() {},
    saveRecoverySnapshot() {},
  };
  vm.createContext(c);
  vm.runInContext(extract('transitionRoutingController'), c);

  session = c.transitionRoutingController(states.PAUSED, { waitReason: 'viewer-paused', targetStream: '' }, 'Playback Paused');
  assert.equal(session.waitReason, 'viewer-paused');

  session = c.transitionRoutingController(states.VERIFY_STREAM, { targetStream: 'junhots_' }, 'heartbeat · verifying current same-game channel');
  assert.equal(session.waitReason, '', 'verification cannot inherit a stale pause reason');

  session = c.transitionRoutingController(states.EARNING, { targetStream: 'junhots_', deadlineAt: 0 }, 'Verified junhots_ for Xal\'atath Launch');
  assert.equal(session.waitReason, '', 'earning cannot report viewer-paused after playback resumed');

  session = c.transitionRoutingController(states.WAITING, { waitReason: 'no-category-stream' }, 'Waiting for live streams');
  assert.equal(session.waitReason, 'no-category-stream');
  session = c.transitionRoutingController(states.WAITING, {}, 'Still waiting');
  assert.equal(session.waitReason, 'no-category-stream', 'held states retain their active wait reason');
});

test('credited progress refreshes routing candidate evidence for the exact earning target', () => {
  let routing = {
    state: 'earning',
    targetStream: 't0ru_wa',
    targetDropId: 'four',
    targetCampaignKey: 'campaign',
    candidateEvidence: {
      campaignVerified: true,
      verifiedChannel: 't0ru_wa',
      creditedProgressVerified: false,
      verifiedAt: now - 5000,
    },
  };
  const c = {
    Date: { now: () => now },
    ROUTING_STATES: { EARNING: 'earning' },
    currentDrop: { id: 'four', campaignKey: 'campaign' },
    watchingLogin: () => 't0ru_wa',
    readRoutingControllerSession: () => routing,
    writeRoutingControllerSession: value => { routing = value; },
    cleanText: value => String(value || '').trim(),
  };
  vm.createContext(c);
  vm.runInContext(extract('markRoutingCreditedProgressVerified'), c);
  assert.equal(c.markRoutingCreditedProgressVerified(now), true);
  assert.equal(routing.candidateEvidence.creditedProgressVerified, true);
  assert.equal(routing.candidateEvidence.creditedProgressVerifiedAt, now);
  assert.equal(routing.candidateEvidence.verifiedAt, now - 5000, 'original stream-verification timestamp is preserved');

  routing.targetDropId = 'different';
  routing.candidateEvidence.creditedProgressVerified = false;
  assert.equal(c.markRoutingCreditedProgressVerified(now + 1), false);
  assert.equal(routing.candidateEvidence.creditedProgressVerified, false, 'credit cannot be transferred to another reward');
});
