'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadDropperSource, loadActiveViewing } = require('./load-source.cjs');
const active = loadActiveViewing();
const source = loadDropperSource();
const normalize = value => JSON.parse(JSON.stringify(value));

function intentFixture() {
  let time = 100000; const saved = new Map();
  const options = { now: () => time, load: account => saved.get(account), save: state => saved.set(state.account, state) };
  return { intent: active.createIntent(options), restore: () => active.createIntent(options), advance: ms => { time += ms; }, saved };
}
function ledgerFixture() {
  let time = 100000, sequence = 0; const store = new Map();
  const options = { now: () => time, read: () => [...store.values()], put: value => store.set(value.key, value), id: () => `attempt-${++sequence}` };
  return { ledger: active.createClaims(options), restore: () => active.createClaims(options), advance: ms => { time += ms; }, store };
}
function reward(id, minutes = 0, dependencies = []) {
  return { id, name: id, requiredMinutesWatched: 60, self: { currentMinutesWatched: minutes, isClaimed: false }, preconditionDrops: dependencies };
}
function extract(name) {
  const start = source.search(new RegExp('^  (?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, name + ' exists');
  const rest = source.slice(start);
  const next = rest.slice(4).search(/^  (?:async )?function \w+\(/m);
  return next < 0 ? rest : rest.slice(0, next + 4);
}

test('the shipped original feature module exactly matches its source module', () => {
  const module = fs.readFileSync(path.join(__dirname, '../src/active-viewing.js'), 'utf8');
  assert.ok(source.includes(module));
  assert.doesNotMatch(source, /tmGuardedPause|defineConstProp\(DocProto|new uw\.MouseEvent|Object\.defineProperty\(HME, "pause"/);
  assert.doesNotMatch(extract('ensureStreamPlaying'), /clickTwitchPlayerGate|playButton\.click/);
  assert.doesNotMatch(extract('pickRemainingGameDrop'), /isClaimed:\s*true/);
});
test('viewer pause survives timeouts, repeated observations, and a same-route reload', () => {
  const f = intentFixture(); f.intent.context('alice', 'channel'); f.intent.allowSwitching(); f.intent.pause(true);
  f.advance(24 * 60 * 60 * 1000); f.intent.observe('buffering');
  assert.equal(f.intent.navigationAllowed(), false);
  assert.equal(f.intent.takeRecovery(), false);
  assert.equal(f.intent.resume({ explicit: false }), false);
  const restored = f.restore(); restored.context('alice', 'channel');
  assert.equal(restored.snapshot().pauseReason, 'viewer');
  assert.equal(restored.navigationAllowed(), false);
  assert.equal(restored.resume({ remounted: true }), false);
  assert.equal(restored.resume({ explicit: true, remounted: true }), true);
});
test('unknown pauses require attention, and manual selections stay protected after resume', () => {
  const f = intentFixture(); f.intent.context('alice', 'channel'); f.intent.pause();
  assert.equal(f.intent.snapshot().pauseReason, 'unknown');
  assert.equal(f.intent.navigationAllowed(), false);
  assert.equal(f.intent.takeRecovery(), false);
  assert.equal(f.intent.resume({ explicit: true }), true);
  assert.equal(f.intent.navigationAllowed(), false, 'resume does not authorize channel switching');
  f.intent.allowSwitching(); assert.equal(f.intent.navigationAllowed(), true);
});
test('explicit Skip is allowed without granting lasting automatic permission', () => {
  const f = intentFixture(); f.intent.context('alice', 'channel'); f.intent.pause(true);
  assert.equal(f.intent.navigationAllowed(true), true);
  assert.equal(f.intent.navigationAllowed(), false);
  f.intent.context('alice', 'requested-channel', true);
  assert.equal(f.intent.snapshot().manualStream, false);
  assert.equal(f.intent.snapshot().paused, false);
  f.intent.context('alice', 'manually-selected-channel');
  assert.equal(f.intent.navigationAllowed(), false);
});
test('pause holds and explicit permissions do not transfer across accounts', () => {
  const f = intentFixture(); f.intent.context('alice', 'channel'); f.intent.pause(true); f.intent.allowSwitching();
  const generation = f.intent.snapshot().generation;
  f.intent.context('bob', 'channel');
  assert.equal(f.intent.snapshot().paused, false);
  assert.equal(f.intent.snapshot().manualStream, true);
  assert.ok(f.intent.snapshot().generation > generation);
  f.intent.context('alice', 'channel'); assert.equal(f.intent.snapshot().paused, true);
});
test('authorized recovery is bounded and does not convert missing state into permission', () => {
  const f = intentFixture(); f.intent.context('alice', 'channel', true);
  assert.equal(f.intent.takeRecovery(), false);
  f.intent.observe('buffering');
  for (let n = 0; n < 3; n++) {
    assert.equal(f.intent.takeRecovery(), true); assert.equal(f.intent.takeRecovery(), false); f.advance(30000);
  }
  assert.equal(f.intent.takeRecovery(), false);
  assert.equal(f.intent.takeRecovery(true), true, 'explicit user action remains available');
});
test('claim results accept only exact recognized success statuses', () => {
  const result = status => active.claimResponse({ data: { claimDropRewards: { status } } });
  assert.equal(result('ELIGIBLE_FOR_ALL').outcome, 'confirmed');
  assert.equal(result('DROP_INSTANCE_ALREADY_CLAIMED').outcome, 'already-claimed');
  for (const status of ['NOT_ELIGIBLE_FOR_ALL', 'eligible_for_all', '', null, 'UNKNOWN']) assert.equal(result(status).outcome, 'unconfirmed');
  assert.equal(active.claimResponse({ errors: [{ message: 'error' }], data: { claimDropRewards: { status: 'ELIGIBLE_FOR_ALL' } } }).outcome, 'unconfirmed');
});
test('claim attempts, timeouts, and already-claimed outcomes never count as newly confirmed', () => {
  const f = ledgerFixture(); const first = f.ledger.begin({ key: 'drop:c:r', rewardId: 'r', campaignId: 'c' });
  assert.equal(first.outcome, 'pending'); assert.equal(f.ledger.begin({ key: first.key }), null);
  f.ledger.settle(first.key, first.attemptId, 'already-claimed', 'claim-result');
  assert.equal(f.ledger.snapshot().filter(x => x.outcome === 'confirmed').length, 0);
  assert.equal(f.ledger.settle(first.key, first.attemptId, 'confirmed', 'inventory'), null);
  const second = f.ledger.begin({ key: 'drop:c:r2', rewardId: 'r2', campaignId: 'c', evidence: 'page-control' });
  f.advance(45001); assert.equal(f.ledger.snapshot()[0].outcome, 'unconfirmed');
  assert.equal(f.ledger.begin({ key: second.key }), null, 'a timeout alone is not a safe retry condition');
  assert.equal(f.ledger.settle(second.key, second.attemptId, 'confirmed', 'inventory').outcome, 'confirmed');
  assert.equal(f.ledger.settle(second.key, second.attemptId, 'confirmed', 'inventory'), null);
});
test('retryable claims keep their delay and three-attempt ceiling after reload', () => {
  const f = ledgerFixture(); let ledger = f.ledger;
  for (let i = 1; i <= 3; i++) {
    const attempt = ledger.begin({ key: 'drop:c:r', rewardId: 'r', campaignId: 'c' }); assert.ok(attempt);
    assert.equal(attempt.attempts, i);
    ledger.settle(attempt.key, attempt.attemptId, 'retryable', 'network');
    assert.equal(ledger.begin({ key: attempt.key }), null);
    f.advance(30000 * i); ledger = f.restore();
  }
  assert.equal(ledger.begin({ key: 'drop:c:r' }), null);
});
test('late responses cannot settle another attempt or reopen discarded context', () => {
  const f = ledgerFixture(); const first = f.ledger.begin({ key: 'drop:c:r' });
  f.ledger.settle(first.key, first.attemptId, 'retryable', 'network'); f.advance(30001);
  const second = f.ledger.begin({ key: first.key });
  assert.equal(f.ledger.settle(first.key, first.attemptId, 'confirmed', 'claim-result'), null);
  f.ledger.settle(second.key, second.attemptId, 'discarded', 'context-change');
  assert.equal(f.ledger.settle(second.key, second.attemptId, 'confirmed', 'inventory'), null);
});
test('history is bounded and persisted records cannot inject arbitrary fields or URLs', () => {
  const f = ledgerFixture();
  for (let i = 0; i < 120; i++) { f.advance(1); f.ledger.begin({ key: `drop:c:r${i}` }); }
  assert.equal(f.ledger.snapshot().length, 100);
  assert.equal(f.ledger.begin({ key: 'https://example.test/?token=secret' }), null);
  const a = f.ledger.snapshot()[0]; f.store.set(a.key, { ...a, updatedAt: a.updatedAt + 1, url: 'secret', cookie: 'secret', pageText: 'secret' });
  const restored = f.restore().snapshot();
  assert.equal(restored.length, 100); assert.ok(restored.every(item => !('url' in item) && !('cookie' in item) && !('pageText' in item)));
});
test('integrity, permission, unknown errors do not receive the retry policy for known transient errors', () => {
  assert.equal(active.claimFailure(new Error('failed integrity check')).outcome, 'blocked');
  assert.equal(active.claimFailure(new Error('HTTP 403')).outcome, 'blocked');
  assert.equal(active.claimFailure(new Error('HTTP 429')).outcome, 'retryable');
  assert.equal(active.claimFailure(new Error('Twitch network error (503)')).outcome, 'retryable');
  assert.equal(active.claimFailure(new Error('unrecognized payload')).outcome, 'unconfirmed');
});
test('claim-only GQL performs one mutation transport even when it fails', async () => {
  let sent = 0; const context = {
    GQL_URL: 'https://gql.twitch.tv/gql', getToken: () => 'fixture', CLIENT_IDS: ['first', 'fallback'], GQL_OPS: { claimDrop: {} },
    gqlPayload: (op, variables) => variables,
    ensureClientIntegrity: async () => 'fixture-integrity', adoptCapturedIntegrity: () => '',
    beforeDropperNetworkRequest: () => {}, preferredGqlTransports: () => ['gm', 'page'],
    postTwitchJson: async () => { sent++; throw new Error('failed integrity check'); },
    parseGqlRows: () => [], recordDropperNetworkSuccess: () => {}, recordDropperNetworkFailure: () => {},
  };
  vm.runInNewContext(extract('gql') + '\nthis.run = gql;', context);
  await assert.rejects(context.run([{ op: 'claimDrop', variables: {} }]), /integrity/);
  assert.equal(sent, 1);
});
test('prerequisites distinguish a reported completed requirement from a required claim', () => {
  const a = reward('a', 60); const b = reward('b', 0, [{ id: 'a' }]);
  assert.equal(active.planPrerequisites(b, [a, b]).ready, false);
  b.preconditionDrops[0].requiresClaim = false; assert.equal(active.planPrerequisites(b, [a, b]).ready, true);
  b.preconditionDrops[0].requiresClaim = true; assert.equal(active.planPrerequisites(b, [a, b]).ready, false);
  a.self.isClaimed = true; assert.equal(active.planPrerequisites(b, [a, b]).ready, true);
});
test('cyclic and missing prerequisite data fails closed even when a completion flag is present', () => {
  const a = reward('a', 0, [{ id: 'b' }]); const b = reward('b', 0, [{ id: 'a' }]); a.self.hasPreconditionsMet = true;
  assert.equal(active.planPrerequisites(a, [a, b]).reason, 'cyclic-prerequisite');
  const missing = reward('c', 0, [{ id: 'missing' }]);
  assert.equal(active.planPrerequisites(missing, [missing]).reason, 'missing-prerequisite');
});
test('unknown sequence timing stays unknown, with no duplicated shared prerequisites', () => {
  const a = reward('a', 30), b = reward('b', 0, [{ id: 'a' }]), c = reward('c', 0, [{ id: 'a' }]);
  const d = reward('d', 0, [{ id: 'b' }, { id: 'c' }]);
  const unknown = active.planPrerequisites(d, [a, b, c, d]);
  assert.equal(unknown.dependencies.length, 3);
  assert.equal(unknown.totalRemainingMinutes, null);
  assert.equal(active.planPrerequisites(d, [a, b, c, d], 'sequential').totalRemainingMinutes, 210);
  assert.equal(active.planPrerequisites(d, [a, b, c, d], 'parallel').totalRemainingMinutes, 60);
  assert.equal(active.planPrerequisites({ id: 'unknown', requiredMinutesWatched: 60 }, []).totalRemainingMinutes, null);
});
test('eligibility reports explicit blocking evidence and does not infer stream support from visibility', () => {
  const now = Date.parse('2026-09-25T12:00:00Z'); const r = reward('r', 15);
  const c = { id: 'c', startAt: '2026-09-01', endAt: '2026-10-01', game: { name: 'Game' }, timeBasedDrops: [r] };
  const ctx = { now, channel: 'chosen', game: 'Game', allowedChannels: ['chosen'], verified: true };
  assert.equal(active.eligibility(c, r, ctx).code, 'eligible');
  assert.equal(active.eligibility(c, r, { ...ctx, verified: false }).code, 'unknown');
  assert.equal(active.eligibility(c, r, { ...ctx, game: 'Other' }).code, 'wrong-game');
  assert.equal(active.eligibility(c, r, { ...ctx, channel: 'other' }).code, 'wrong-channel');
  assert.equal(active.eligibility({ ...c, self: { isAccountConnected: false } }, r, ctx).code, 'account-link');
  assert.equal(active.eligibility(c, { ...r, requiredSubscriptionCount: 1 }, ctx).code, 'paid-requirement');
  assert.equal(active.eligibility({ ...c, endAt: '2026-09-24' }, r, ctx).code, 'expired');
  assert.equal(active.eligibility({ ...c, endAt: null }, r, ctx).code, 'unknown-window');
});
test('poll scope rejects old-account, old-route, and old-generation replies', () => {
  let account = 'alice'; const location = { pathname: '/a' }; let generation = 1;
  const c = { storageAccountLogin: () => account, location, viewingIntent: { snapshot: () => ({ generation }) } };
  vm.runInNewContext(extract('pollContextIsCurrent') + '\nthis.valid = pollContextIsCurrent;', c);
  const request = { account, path: '/a', generation };
  assert.equal(c.valid(request), true);
  account = 'bob'; assert.equal(c.valid(request), false);
  account = 'alice'; location.pathname = '/b'; assert.equal(c.valid(request), false);
  location.pathname = '/a'; generation++; assert.equal(c.valid(request), false);
});
test('donation wording and licenses are not feature gates', () => {
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  assert.match(readme, /Donations are optional/);
  assert.match(readme, /All features remain available without donating/);
  assert.match(source, /@license\s+PolyForm-Noncommercial-1.0.0/);
  assert.doesNotMatch(source, /donorEntitlement|premiumFeature|paywallEnabled/);
  assert.match(source, /tdh-support-note/);
});


test('deadline assessment stays explicit about safe, tight, impossible, and unknown windows', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const campaign = { endAt: '2026-09-25T13:00:00Z' };
  assert.equal(active.deadlineAssessment(campaign, null, { totalRemainingMinutes: 30 }, now).urgency, 'soon');
  const tight = active.deadlineAssessment(campaign, null, { totalRemainingMinutes: 45 }, now);
  assert.equal(tight.finishable, true);
  assert.equal(tight.urgency, 'tight');
  const impossible = active.deadlineAssessment(campaign, null, { totalRemainingMinutes: 59 }, now);
  assert.equal(impossible.finishable, false);
  assert.equal(impossible.urgency, 'unfinishable');
  assert.equal(active.deadlineAssessment({}, null, { totalRemainingMinutes: 20 }, now).finishable, null);
});

test('campaign sequence sums free watch work and keeps claim-ready rewards visible', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const campaign = {
    endAt: '2026-09-25T15:00:00Z',
    timeBasedDrops: [
      { id: 'a', requiredMinutesWatched: 60, self: { currentMinutesWatched: 30, isClaimed: false } },
      { id: 'b', requiredMinutesWatched: 60, self: { currentMinutesWatched: 60, isClaimed: false } },
      { id: 'c', requiredMinutesWatched: 60, self: { currentMinutesWatched: 0, isClaimed: true } },
      { id: 'paid', requiredMinutesWatched: 60, requiredSubscriptionCount: 1, self: { currentMinutesWatched: 0, isClaimed: false } },
    ],
  };
  const plan = active.campaignSequence(campaign, now);
  assert.equal(plan.remainingMinutes, 30);
  assert.equal(plan.pendingClaims, 1);
  assert.equal(plan.inProgress, true);
  assert.equal(plan.finishable, true);
});

test('campaign ranking rejects known impossible work before applying personal priority and urgency', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const ranked = active.rankCampaignCandidates([
    { game: 'Impossible High', endMs: now + 30 * 60000, remainingMinutes: 60 },
    { game: 'Normal Soon', endMs: now + 50 * 60000, remainingMinutes: 20 },
    { game: 'High Later', endMs: now + 120 * 60000, remainingMinutes: 40 },
  ], {
    now,
    priorityOf: game => game.includes('High') ? 1 : 0,
  });
  assert.equal(ranked[0].game, 'High Later');
  assert.equal(ranked[1].game, 'Normal Soon');
  assert.equal(ranked[2].game, 'Impossible High');
  assert.equal(ranked[2].sequenceFinishable, false);
});

test('claim presentation distinguishes a sent claim without confirmation from a failure', () => {
  assert.equal(active.claimPresentation({ outcome: 'unconfirmed', evidence: 'timeout' }), 'Claim Sent · Confirmation Unavailable');
  assert.equal(active.claimPresentation({ outcome: 'blocked', evidence: 'integrity' }), 'Claim Needs Attention');
  assert.equal(active.claimPresentation({ outcome: 'confirmed', evidence: 'inventory' }), 'Reward Claimed');
});

test('eligibility reports deadline risk without fabricating credited progress', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const drop = { id: 'r', requiredMinutesWatched: 60, self: { currentMinutesWatched: 5, isClaimed: false } };
  const campaign = { id: 'c', startAt: '2026-09-25T11:00:00Z', endAt: '2026-09-25T12:30:00Z', game: { name: 'Game' }, timeBasedDrops: [drop] };
  const result = active.eligibility(campaign, drop, { now, channel: 'chosen', game: 'Game', allowedChannels: ['chosen'], verified: true });
  assert.equal(result.code, 'deadline-risk');
  assert.equal(result.deadline.finishable, false);
  assert.equal(result.plan.totalRemainingMinutes, 55);
});

test('Dropper routing consumes shared deadline-aware ranking and timeout wording', () => {
  assert.match(extract('pickNextOpenCampaignDrop'), /rankCampaignCandidates/);
  assert.match(source, /Claim Sent · Confirmation Unavailable/);
  assert.match(source, /campaignSupported,/);
});


test('selector health distinguishes monitoring from actual detection failure', () => {
  const now = 1_000_000;
  assert.equal(active.selectorHealth({ applicable: false }, now).status, 'not-applicable');
  assert.equal(active.selectorHealth({ applicable: true, state: 'no-claimable-reward', checkedAt: now - 1000 }, now).status, 'monitoring');
  assert.equal(active.selectorHealth({ applicable: true, state: 'matched', checkedAt: now }, now).status, 'observed');
  assert.equal(active.selectorHealth({ applicable: true, state: 'no-claimable-reward', checkedAt: now, lastMatchedAt: now - 1000 }, now).status, 'observed-recently');
  assert.equal(active.selectorHealth({ applicable: true, state: 'no-claimable-reward', checkedAt: now, lastMatchedAt: now - 100_000 }, now, 50_000).status, 'stale-observation');
  assert.equal(active.selectorHealth({ applicable: true, state: 'detection-failed', checkedAt: now }, now).status, 'degraded');
});

test('recovery diagnosis separates viewer intent, offline, eligibility, delay, and real stalls', () => {
  const base = { login: 'streamer', live: true, gameMatches: true, campaignVerified: true, playback: 'playing', progressAgeMs: 10_000 };
  const expectDiagnosis = (health, expected, options) => {
    const actual = active.recoveryDiagnosis(health, options);
    assert.equal(actual.code, expected.code);
    assert.equal(actual.recoverable, expected.recoverable);
  };
  expectDiagnosis(base, { code: 'healthy', recoverable: false });
  expectDiagnosis({ ...base, paused: true, pauseReason: 'viewer' }, { code: 'viewer-paused', recoverable: false });
  expectDiagnosis({ ...base, live: false }, { code: 'offline', recoverable: true });
  expectDiagnosis({ ...base, gameMatches: false }, { code: 'wrong-game', recoverable: true });
  expectDiagnosis({ ...base, campaignVerified: false }, { code: 'eligibility-unverified', recoverable: false });
  expectDiagnosis({ ...base, progressAgeMs: 6 * 60 * 1000 }, { code: 'credit-stalled', recoverable: true }, { delayedMs: 5 * 60 * 1000, stalledMs: 6 * 60 * 1000 });
  expectDiagnosis({ ...base, progressAgeMs: 5 * 60 * 1000 }, { code: 'credit-delayed', recoverable: false }, { delayedMs: 5 * 60 * 1000, stalledMs: 6 * 60 * 1000 });
});

test('fallback lease prevents a second tab from running the same claim and releases afterward', async () => {
  const store = new Map();
  let clock = 1000;
  const read = key => store.get(key) || null;
  const write = (key, value) => store.set(key, value);
  const remove = key => store.delete(key);
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const first = active.createLease({ now: () => clock, id: () => 'tab-a', read, write, remove, ttlMs: 8000 });
  const second = active.createLease({ now: () => clock, id: () => 'tab-b', read, write, remove, ttlMs: 8000 });
  const held = first.run('claim:reward', async () => { await gate; return 'first'; });
  await Promise.resolve();
  assert.equal(await second.run('claim:reward', async () => 'second'), false);
  unblock();
  assert.equal(await held, 'first');
  clock += 1;
  assert.equal(await second.run('claim:reward', async () => 'second'), 'second');
  assert.equal(store.has('claim:reward'), false);
});

test('distribution reports local-storage lease and interpreted selector/recovery health', () => {
  assert.match(source, /crossTabLock: navigator\.locks\?\.request \? 'web-locks' : 'local-storage-lease'/);
  assert.match(source, /claimSelectorHealthSnapshot/);
  assert.match(source, /recoveryDiagnosis: health\.recovery\?\.code/);
  assert.match(source, /fallbackClaimLease\.run/);
});


test('control-dismissed evidence can confirm a pending bonus', () => {
  const f = ledgerFixture();
  const attempt = f.ledger.begin({ key: 'bonus:test', kind: 'bonus', evidence: 'page-control' });
  const settled = f.ledger.settle(attempt.key, attempt.attemptId, 'confirmed', 'control-dismissed');
  assert.equal(settled.outcome, 'confirmed');
  assert.equal(settled.evidence, 'control-dismissed');
});

test('Dropper throttles mutation-driven claim scans and uses bounded stall rechecks', () => {
  assert.match(source, /const CLAIM_SCAN_MIN_INTERVAL_MS = 5000/);
  assert.match(source, /new MutationObserver\(\(\) => queueClaimScan\('mutation'\)\)/);
  assert.match(source, /Credit Stalled · Rechecking Twitch Before Switching/);
  assert.match(source, /Credit Still Stalled · Final Twitch Check/);
  assert.match(source, /after two Twitch rechecks/);
});

test('normal campaign priority removes explicit storage instead of persisting a fake preference', () => {
  assert.match(source, /if \(priority === 0\) localStorage\.removeItem\(entry\.key\)/);
  assert.match(source, /prioritySource: campaignPriorityEntry\(item\.game\)\.explicit \? 'saved' : 'default'/);
});


test('stream routing ranks campaign evidence before viewer preference', () => {
  assert.match(source, /function streamCandidateEvidence\(/);
  assert.match(source, /live-campaign-allowed/);
  assert.match(source, /live-drops-tagged/);
  assert.match(source, /live-same-game/);
  assert.match(extract('routingControllerFindStream'), /let candidate = candidates\[0\] \|\| null/);
  assert.match(extract('discoverQueueCandidates'), /rankStreamCandidatesByEvidence/);
});

test('routing diagnostics retain evidence rank and label for the chosen stream', () => {
  assert.match(source, /evidenceRank: candidate\.evidenceRank/);
  assert.match(source, /evidenceLabel: candidate\.evidenceLabel/);
  assert.match(source, /evidenceLabel: item\.evidenceLabel/);
});
