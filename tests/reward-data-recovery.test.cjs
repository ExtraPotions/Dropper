'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadDropperSource, loadActiveViewing } = require('./load-source.cjs');
const source = loadDropperSource();
const active = loadActiveViewing();
const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const clone = value => JSON.parse(JSON.stringify(value));
const now = 1000000;

function extract(name) {
  const match = new RegExp('^  (?:async )?function ' + name + '\\(', 'm').exec(source);
  assert.ok(match, `${name} exists in production source`);
  const end = source.indexOf('\n  }', match.index);
  assert.ok(end > match.index, `${name} closes`);
  return source.slice(match.index, end + 4);
}
function load(names, context = {}) {
  const c = { Date, cleanText, ...context };
  vm.createContext(c);
  vm.runInContext(names.map(extract).join('\n'), c);
  return c;
}
function reward(id, minutes, required = 480) {
  return { id, name: `Reward ${id}`, requiredMinutesWatched: required,
    self: { currentMinutesWatched: minutes, isClaimed: false } };
}
function campaign(drops = [reward('selected', 5), reward('session', 12)]) {
  return { id: 'campaign-1', name: 'Campaign', game: { id: 'game-1', name: 'Game', slug: 'game' },
    startAt: new Date(0).toISOString(), endAt: new Date(now + 86400000).toISOString(), timeBasedDrops: drops };
}
function target(minutes = 5) {
  return { id: 'selected', name: 'Selected Reward', campaignKey: 'campaign-1', campaignId: 'campaign-1',
    campaign: 'Campaign', game: 'Game', requiredMinutes: 480, currentMinutes: minutes, remainingMinutes: 480 - minutes };
}
function inventory(campaigns = [campaign()]) {
  return { data: { currentUser: { inventory: { dropCampaignsInProgress: campaigns } } } };
}
function session(id = 'session', minutes = 12) {
  return { data: { currentUser: { dropCurrentSession: { dropID: id, currentMinutesWatched: minutes } } } };
}
const invalidRows = [
  undefined, { data: null }, { data: { currentUser: null } },
  { data: { currentUser: { inventory: null } } },
  { data: { currentUser: { inventory: { dropCampaignsInProgress: null } } } },
  { data: { currentUser: { inventory: { differentField: [] } } } },
  { data: { currentUser: { inventory: { dropCampaignsInProgress: {} } } } },
  inventory([null]), inventory(['not-a-campaign']),
  { ...inventory([]), errors: [{ message: 'Service Error' }] },
];

function inventoryFixture() {
  const events = [];
  const c = load(['inventoryResponseState', 'acceptInventoryResponse'], {
    Date: { now: () => now }, lastInventoryCampaigns: [campaign()],
    inventoryResponseHealth: { valid: true, status: 'ok', at: now - 60000, lastValidAt: now - 60000 },
    inventoryClaimSweepState: {}, extractCampaignCatalog: () => [], rememberCampaignCatalog: () => {},
    nativeRewardClaimEvidence: () => ({ claimedGroups: new Set() }),
    applyInventorySnapshot: rows => { events.push('apply'); c.lastInventoryCampaigns = rows; },
    reconcileClaimHistory: () => events.push('reconcile'),
    queueInventoryClaimSweep: () => events.push('sweep'),
  });
  return { c, events };
}

test('unavailable, malformed and partial Inventory responses never become valid empty snapshots', () => {
  for (const row of invalidRows) {
    const { c, events } = inventoryFixture();
    const previous = c.lastInventoryCampaigns;
    const result = c.acceptInventoryResponse(row, 'fixture');
    assert.equal(result.valid, false);
    assert.equal(result.campaigns, null);
    assert.equal(c.lastInventoryCampaigns, previous);
    assert.equal(c.inventoryResponseHealth.lastValidAt, now - 60000);
    assert.equal(c.inventoryClaimSweepState.reason, 'inventory-unavailable');
    assert.equal(c.inventoryClaimSweepState.candidates, null);
    assert.deepEqual(events, []);
  }
});
test('a valid empty inventory is applied, while a subsequent failure cannot erase its provenance', () => {
  const { c, events } = inventoryFixture();
  assert.equal(c.acceptInventoryResponse(inventory([])).status, 'empty');
  assert.deepEqual(clone(c.lastInventoryCampaigns), []);
  assert.deepEqual(events, ['apply', 'reconcile', 'sweep']);
  assert.equal(c.inventoryResponseHealth.lastValidAt, now);
  c.acceptInventoryResponse({ data: null });
  assert.equal(c.inventoryResponseHealth.valid, false);
  assert.equal(c.inventoryResponseHealth.lastValidAt, now);
});
test('a later good inventory recovers from an unavailable state', () => {
  const { c } = inventoryFixture();
  c.acceptInventoryResponse({ data: null });
  c.acceptInventoryResponse(inventory([campaign([reward('selected', 18)])]));
  assert.equal(c.inventoryResponseHealth.valid, true);
  assert.equal(c.lastInventoryCampaigns[0].timeBasedDrops[0].self.currentMinutesWatched, 18);
});
test('Inventory diagnostics retain only bounded field names, structural types and counts', () => {
  const { c } = inventoryFixture();
  const row = { data: { currentUser: { login: 'private-viewer', inventory: { token: 'private-token' } } },
    errors: [{ message: 'private-error-value' }] };
  const result = c.inventoryResponseState(row);
  assert.doesNotMatch(JSON.stringify(result.shape) + result.detail, /private-/);
  assert.equal(result.shape.errorCount, 1);
  assert.ok(result.detail.length < 160);
});

function identityFixture(extra = {}) {
  return load(['mergeCampaigns', 'dropProgressPercent', 'parseSessionDrop', 'dropIdentityMatchesTarget',
    'findActiveDropInCampaigns', 'reconcileDropProgress', 'recordRewardSessionResolution'], {
    Date: { now: () => now }, currentDrop: target(), rewardSessionResolution: null, lastProgressReconcile: null,
    campaignKey: item => cleanText(item?.id || item?.campaignKey).toLowerCase(),
    campaignKeysMatch: (a, b) => cleanText(a).toLowerCase() === cleanText(b).toLowerCase(),
    campaignRoutingState: () => ({ open: true }), campaignIsRoutingOpen: () => true,
    campaignWindow: () => ({ endMs: now + 86400000 }), watchingLogin: () => 'channel',
    normalizeGameName: value => cleanText(value).toLowerCase(), gameNamesMatch: (a, b) => a === b,
    findCampaignForDrop: (rows, drop) => rows.find(row => row.id === drop.campaignKey) || null,
    requiresSubscription: () => false, dropBenefitImage: drop => drop?.benefitEdges?.[0]?.benefit?.imageAssetURL || '',
    inventorySnapshotContainsDrop: () => false, ...extra,
  });
}
test('12 session minutes for another reward never overwrite the selected 0 of 480 minutes', () => {
  const c = identityFixture({ currentDrop: target(0) });
  const observed = c.parseSessionDrop(session(), [campaign()]);
  const identity = c.dropIdentityMatchesTarget(observed);
  assert.equal(identity.sameCampaignDifferentDrop, true);
  assert.equal(identity.matchesTarget, false);
  const minutes = c.reconcileDropProgress(observed, c.currentDrop, {
    inventoryLive: false, sessionEligible: identity.matchesTarget, sessionRejectedReason: identity.mismatchReason,
  });
  assert.equal(minutes, 0);
  assert.equal(c.lastProgressReconcile.observedSessionMinutes, 12);
  assert.equal(c.lastProgressReconcile.sessionRejectedReason, 'same-campaign-different-drop');
});
test('an exact session match can advance the selected reward while Inventory is unavailable', () => {
  const c = identityFixture();
  const observed = c.parseSessionDrop(session('selected', 12), [campaign()]);
  assert.equal(c.dropIdentityMatchesTarget(observed).matchesTarget, true);
  assert.equal(c.reconcileDropProgress(observed, c.currentDrop, { inventoryLive: false, sessionEligible: true }), 12);
});
test('a missing explicit selected ID cannot silently select another inventory reward', () => {
  const c = identityFixture();
  assert.equal(c.findActiveDropInCampaigns([campaign([reward('session', 12)])]), null);
  const match = c.findActiveDropInCampaigns([campaign()]);
  assert.equal(match.id, 'selected');
  assert.equal(match.currentMinutes, 5);
});
test('null Inventory progress is not a new zero-minute observation', () => {
  const c = identityFixture();
  assert.equal(c.findActiveDropInCampaigns([campaign([reward('selected', null)])]), null);
  assert.equal(c.findActiveDropInCampaigns([campaign([reward('selected', 0)])]).currentMinutes, 0);
});
test('session relationship resolution distinguishes prerequisites, other rewards and missing details', () => {
  const c = identityFixture();
  const observed = c.parseSessionDrop(session(), [campaign()]);
  const selected = reward('selected', 0);
  selected.preconditionDrops = [{ id: 'middle' }];
  const middle = reward('middle', 0); middle.preconditionDrops = [{ id: 'session' }];
  assert.equal(c.recordRewardSessionResolution(observed, [campaign([selected, middle, reward('session', 12)])]).relation, 'prerequisite');
  assert.equal(c.recordRewardSessionResolution(observed, [campaign()]).relation, 'other-reward');
  assert.equal(c.recordRewardSessionResolution(observed, []).relation, 'unresolved');
  assert.equal(c.currentDrop.id, 'selected');
  assert.equal(c.currentDrop.currentMinutes, 5);
});
test('cyclic prerequisite data is bounded and does not fabricate a relationship', () => {
  const c = identityFixture();
  const selected = reward('selected', 0); selected.preconditionDrops = [{ id: 'middle' }];
  const middle = reward('middle', 0); middle.preconditionDrops = [{ id: 'selected' }];
  const observed = c.parseSessionDrop(session(), [campaign()]);
  assert.equal(c.recordRewardSessionResolution(observed, [campaign([selected, middle, reward('session', 12)])]).relation, 'other-reward');
});

function detailsFixture({ failing = false, stale = false, waiting = false, incomplete = true } = {}) {
  const requests = [];
  let time = now;
  const base = campaign([reward('selected', null), reward('session', null)]);
  if (incomplete) base.timeBasedDrops[0].name = '';
  const detailed = campaign([reward('selected', 0), reward('session', 12)]);
  detailed.timeBasedDrops[0].preconditionDrops = [{ id: 'session' }];
  detailed.timeBasedDrops[0].benefitEdges = [{ benefit: { imageAssetURL: 'https://example.test/reward.png' } }];
  const c = identityFixture();
  Object.assign(c, {
    Date: { now: () => time }, campaignDetailsAttempts: new Map(), campaignDetailsMisses: new Map(),
    campaignDetailsCache: new Map(), CAMPAIGN_DETAILS_RETRY_MS: 60000, CAMPAIGN_DETAILS_MISS_TTL_MS: 900000,
    getToken: () => 'fixture', cookie: () => 'viewer', logActivity: () => {},
    pollContext: () => ({}), pollContextIsCurrent: () => !stale, isPageScrapedCampaignKey: () => false,
    ROUTING_STATES: { WAITING: 'waiting' },
    readRoutingControllerSession: () => ({ state: waiting ? 'waiting' : 'earning', waitReason: waiting ? 'campaign-details' : '', targetCampaignKey: 'campaign-1' }),
    routingCampaignPool: () => c.campaignDetailsCache.size ? [...c.campaignDetailsCache.values()] : [base],
    campaignWatchDrops: row => (row?.timeBasedDrops || []).filter(drop => drop.requiredMinutesWatched > 0),
    compactCampaignCatalog: rows => rows,
    gql: async ops => { requests.push(ops); if (failing) throw new Error('unavailable'); return [{ data: { user: { dropCampaign: detailed } } }]; },
    applyDrop: updated => { c.currentDrop = updated; },
  });
  vm.runInContext(['campaignDetailsMissedRecently', 'enrichCampaignsWithDropDetails', 'enrichRoutingTargetCampaign', 'hydrateCurrentRewardDetails'].map(extract).join('\n'), c);
  return { c, requests, detailed, advance: ms => { time += ms; } };
}
test('active earning targets with incomplete names fetch details and retain selected progress', async () => {
  const { c, requests } = detailsFixture();
  assert.equal(await c.enrichRoutingTargetCampaign(), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0].op, 'dropCampaignDetails');
  assert.equal(requests[0][0].variables.dropID, 'campaign-1');
  assert.equal(c.currentDrop.id, 'selected');
  assert.equal(c.currentDrop.currentMinutes, 5, 'metadata cannot reset credited progress to zero');
  assert.equal(c.currentDrop.name, 'Reward selected');
  assert.equal(c.currentDrop.gameId, 'game-1');
  assert.equal(c.currentDrop.needsDropDetails, false);
});
test('a same-campaign reward mismatch forces one detail lookup even when its name is known', async () => {
  const { c, requests } = detailsFixture({ incomplete: false });
  const observed = c.parseSessionDrop(session(), [campaign()]);
  assert.equal(await c.enrichRoutingTargetCampaign('fixture', observed), true);
  assert.equal(requests.length, 1);
  assert.equal(c.currentDrop.id, 'selected');
});
test('detail misses caused by transport failure are retried after cooldown, not cached as no rewards', async () => {
  const { c, requests, advance } = detailsFixture({ failing: true });
  await c.enrichRoutingTargetCampaign(); await c.enrichRoutingTargetCampaign();
  assert.equal(requests.length, 1);
  assert.equal(c.campaignDetailsMisses.size, 0);
  advance(60000); await c.enrichRoutingTargetCampaign();
  assert.equal(requests.length, 2);
});
test('late campaign details cannot change the next account or route', async () => {
  const { c } = detailsFixture({ stale: true });
  const previous = c.currentDrop;
  assert.equal(await c.enrichRoutingTargetCampaign(), false);
  assert.equal(c.currentDrop, previous);
  assert.equal(c.campaignDetailsCache.size, 0);
});
test('metadata-only enrichment never replaces an explicit target with a sibling', () => {
  const { c } = detailsFixture();
  assert.equal(c.hydrateCurrentRewardDetails(campaign([reward('session', 12)])), false);
  assert.equal(c.currentDrop.id, 'selected');
});

test('unknown and invalid watch requirements remain unknown in reward and campaign deadlines', () => {
  const value = campaign();
  for (const totalRemainingMinutes of [null, undefined, '', '  ', false, true, NaN, Infinity, -1]) {
    const result = active.deadlineAssessment(value, null, { totalRemainingMinutes }, now);
    assert.equal(result.requiredMinutes, null);
    assert.equal(result.finishable, null);
    assert.equal(result.marginMinutes, null);
    assert.equal(result.urgency, 'unknown');
  }
  const result = active.campaignSequence(campaign([reward('selected', null)]), now);
  assert.equal(result.remainingMinutes, null);
  assert.equal(result.finishable, null);
  assert.equal(active.deadlineAssessment(value, null, { totalRemainingMinutes: 0 }, now).finishable, true);
});

test('user-facing earning status requires recent proof for the exact selected reward', () => {
  const c = load(['hasConfirmedRewardProgress', 'rewardCreditStatus'], {
    Date: { now: () => now }, currentDrop: target(), watchingLogin: () => 'channel', rewardSessionResolution: null,
    inventoryResponseHealth: { valid: false }, HEALTHY_STREAM_DELAYED_MS: 300000,
    hasVerifiedRewardSession: () => false, campaignKeysMatch: (a, b) => a === b, lastStreamVerification: {
      at: now - 1000, dropId: 'selected', campaignKey: 'campaign-1', channel: 'channel', proof: { progressConfirmed: false },
    },
  });
  assert.match(c.rewardCreditStatus(), /Eligible stream.*inventory unavailable/);
  c.lastStreamVerification.proof.progressConfirmed = true;
  assert.match(c.rewardCreditStatus(), /^Earning Selected Reward/);
  c.lastStreamVerification.dropId = 'session';
  assert.equal(c.hasConfirmedRewardProgress(), false);
  c.lastStreamVerification.dropId = 'selected'; c.lastStreamVerification.at = now - 300001;
  assert.equal(c.hasConfirmedRewardProgress(), false);
  c.rewardSessionResolution = { at: now, channel: 'channel', campaignKey: 'campaign-1', targetDropId: 'selected',
    relation: 'prerequisite', sessionName: 'Earlier Reward', sessionMinutes: 12 };
  assert.match(c.rewardCreditStatus(), /prerequisite: Earlier Reward \(12 min\).*Selected: Selected Reward/);
});

function pollFixture(row = inventory(), { id = 'session', minutes = 12, requestFails = false, productionTransport = false } = {}) {
  const calls = [];
  const c = identityFixture();
  const observedRow = session(id, minutes);
  Object.assign(c, {
    inventoryResponseHealth: { valid: true, at: now - 60000, lastValidAt: now - 60000 },
    inventoryClaimSweepState: {}, lastInventoryCampaigns: [campaign()], lastCampaignCatalog: [campaign()],
    lastTwitchGqlAt: 0, lastGqlReason: 'fixture',
    pollContext: () => ({}), pollContextIsCurrent: () => true, getToken: () => 'fixture',
    shouldFetchViewerDropsDashboard: () => false, gql: async () => {
      if (requestFails) throw new Error('GQL HTTP 503');
      return [row, { data: { user: { id: '123', stream: { game: { name: 'Game' } } } } }];
    },
    extractCampaignCatalog: () => [], rememberCampaignCatalog: () => {},
    nativeRewardClaimEvidence: () => ({ claimedGroups: new Set() }),
    applyInventorySnapshot: rows => { calls.push('inventory-apply'); c.lastInventoryCampaigns = rows; },
    reconcileClaimHistory: () => calls.push('claims-reconcile'), queueInventoryClaimSweep: () => calls.push('claims-sweep'),
    enrichRoutingTargetCampaign: async () => { calls.push('details-check'); return false; },
    suppressPageCampaignsWithAuthoritativeMatches: rows => rows, reconcilePageCurrentDropWithAuthoritativeCampaign: () => {},
    routingCampaignPool: () => c.lastCampaignCatalog,
    fetchSessionDropState: async () => { calls.push('session-fetch'); return { sessionDrop: c.parseSessionDrop(observedRow, [campaign()]), available: [], sessionRow: observedRow }; },
    updateRoutingCampaignSupportEvidence: () => {}, applyDrop: drop => { c.currentDrop = drop; },
    reconcileRoutingTargetWithCurrentDrop: () => {}, restoreVerifiedEarningFromSession: () => {},
    setStatus: value => { c.statusText = value; }, dropActivityStatus: () => 'fixture', refreshDropCard: () => {}, logActivity: () => {},
    matchingLiveDropStream: () => false, holdingVerifiedDropStream: () => false,
  });
  vm.runInContext(['inventoryResponseState', 'acceptInventoryResponse', 'pollGqlDrops'].map(extract).join('\n'), c);
  if (productionTransport) {
    Object.assign(c, {
      CLIENT_IDS: ['fixture-client'], GQL_URL: 'https://gql.twitch.tv/gql',
      GQL_OPS: { inventory: { name: 'Inventory' }, streamInfo: { name: 'Stream' } },
      gqlPayload: (op, variables) => ({ operationName: op.name, variables }),
      ensureClientIntegrity: async () => 'fixture-integrity', adoptCapturedIntegrity: () => '',
      beforeDropperNetworkRequest: () => {}, preferredGqlTransports: () => ['gm', 'page'],
      checkGqlOperationResults: () => {}, clearClientIntegrity: () => {},
      recordDropperNetworkSuccess: () => calls.push('network-success'),
      recordDropperNetworkFailure: () => calls.push('network-failure'),
      postTwitchJson: async () => {
        calls.push('transport');
        return { status: 200, json: [row, { data: { user: { id: '123', stream: { game: { name: 'Game' } } } } }] };
      },
    });
    vm.runInContext(['isSoftGqlError', 'gqlOperationFailureKind', 'parseGqlRows', 'gql'].map(extract).join('\n'), c);
  }
  return { c, calls };
}
test('production polling preserves last valid inventory and rejects mismatched session minutes', async () => {
  const { c, calls } = pollFixture({ data: { currentUser: { inventory: { unknown: [] } } } });
  const previous = c.lastInventoryCampaigns;
  await c.pollGqlDrops();
  assert.equal(c.lastInventoryCampaigns, previous);
  assert.equal(c.inventoryResponseHealth.valid, false);
  assert.equal(c.inventoryClaimSweepState.reason, 'inventory-unavailable');
  assert.equal(c.currentDrop.id, 'selected');
  assert.equal(c.currentDrop.currentMinutes, 5);
  assert.equal(c.lastProgressReconcile.sessionEligible, false);
  assert.equal(c.rewardSessionResolution.relation, 'other-reward');
  assert.ok(calls.includes('details-check'), 'details lookup is considered even without dashboard polling');
  assert.ok(!calls.includes('claims-sweep'));
});
test('production polling advances exact session credit without treating failed inventory as fresh', async () => {
  const { c } = pollFixture({ data: null }, { id: 'selected' });
  await c.pollGqlDrops();
  assert.equal(c.currentDrop.currentMinutes, 12);
  assert.equal(c.lastProgressReconcile.inventoryLive, false);
  assert.equal(c.rewardSessionResolution.relation, 'selected-reward');
});
test('a failed inventory request marks availability unknown but keeps the last good snapshot', async () => {
  const { c } = pollFixture(undefined, { requestFails: true });
  const previous = c.lastInventoryCampaigns;
  await c.pollGqlDrops();
  assert.equal(c.lastInventoryCampaigns, previous);
  assert.equal(c.inventoryResponseHealth.valid, false);
  assert.equal(c.inventoryResponseHealth.source, 'inventory-request-failed');
});
test('production polling applies actual empty inventory and restores normal claim checking', async () => {
  const { c, calls } = pollFixture(inventory([]));
  await c.pollGqlDrops();
  assert.deepEqual(clone(c.lastInventoryCampaigns), []);
  assert.equal(c.inventoryResponseHealth.status, 'empty');
  assert.ok(calls.includes('claims-sweep'));
});

test('an explicit claim for the exact selected inventory reward remains completion evidence', () => {
  const c = identityFixture();
  const claimed = reward('selected', null); claimed.self.isClaimed = true;
  const result = c.findActiveDropInCampaigns([campaign([claimed, reward('session', 12)])]);
  assert.equal(result.id, 'selected');
  assert.equal(result.isClaimed, true);
  assert.equal(result.currentMinutes, 480);
});
test('passive page interception preserves inventory when Twitch sends null data for that operation', () => {
  const { c, events } = inventoryFixture();
  Object.assign(c, {
    currentDrop: null, lastCampaignCatalog: [], networkState: {}, lastTwitchGqlAt: 0, lastGqlSuccessAt: 0,
    clearGqlFailurePause: () => {}, persistNetworkState: () => {}, mergeCampaigns: (a, b) => [...a, ...b],
    routingCampaignPool: () => [], isAutoRoutingController: () => true, refreshDropCard: () => {},
  });
  vm.runInContext(extract('ingestTwitchGqlRows'), c);
  const previous = c.lastInventoryCampaigns;
  assert.equal(c.ingestTwitchGqlRows([{ data: null }], 'page', [{ name: 'Inventory' }]), true);
  assert.equal(c.lastInventoryCampaigns, previous);
  assert.equal(c.inventoryResponseHealth.status, 'unavailable');
  assert.deepEqual(events, []);
});
test('the passive and polling paths share validation, and active details are not dashboard-gated', () => {
  const page = extract('ingestTwitchGqlRows');
  const poll = extract('pollGqlDrops');
  assert.match(page, /acceptInventoryResponse\(inventoryRow, source\)/);
  assert.match(poll, /acceptInventoryResponse\(inventoryRow, "inventory-poll"\)/);
  assert.match(poll, /const streamRow =[^\n]+\n\s*await enrichRoutingTargetCampaign/);
  assert.doesNotMatch(page, /const liveInventoryDrop = findActiveDropInCampaigns/);
});


test('actual transport operation rejection still refreshes the session for another reward', async () => {
  const row = { errors: [{ message: "operation with name 'Inventory' not found" }] };
  const { c, calls } = pollFixture(row, { minutes: 14, productionTransport: true });
  const previous = c.lastInventoryCampaigns;
  await c.pollGqlDrops();
  assert.ok(calls.includes('session-fetch'), 'the session read is not starved by Inventory');
  assert.equal(calls.filter(v => v === 'transport').length, 1);
  assert.equal(c.rewardSessionResolution.sessionMinutes, 14);
  assert.equal(c.rewardSessionResolution.relation, 'other-reward');
  assert.equal(c.currentDrop.currentMinutes, 5, 'other reward minutes must not overwrite the selected reward');
  assert.equal(c.lastInventoryCampaigns, previous);
  assert.equal(c.inventoryResponseHealth.shape.errorCount, 1);
  assert.equal(c.inventoryClaimSweepState.candidates, null);
  assert.ok(!calls.includes('claims-sweep'));
});

test('actual transport operation rejection still accepts exact selected reward session credit', async () => {
  const row = { errors: [{ message: "operation with name 'Inventory' not found" }] };
  const { c, calls } = pollFixture(row, { id: 'selected', minutes: 14, productionTransport: true });
  await c.pollGqlDrops();
  assert.ok(calls.includes('session-fetch'));
  assert.equal(c.currentDrop.currentMinutes, 14);
  assert.equal(c.lastProgressReconcile.inventoryLive, false);
  assert.equal(c.rewardSessionResolution.relation, 'selected-reward');
});

test('fatal Inventory errors retain the original error count without proceeding to session polling', async () => {
  const { c, calls } = pollFixture({ errors: [{ message: 'Service Error' }] }, { productionTransport: true });
  await c.pollGqlDrops();
  assert.equal(c.inventoryResponseHealth.shape.errorCount, 1);
  assert.equal(c.inventoryResponseHealth.source, 'inventory-request-failed');
  assert.ok(!calls.includes('session-fetch'));
});

test('passive error-only Inventory traffic cannot clear an existing failure pause or success timestamp', () => {
  const { c, events } = inventoryFixture();
  let clears = 0;
  Object.assign(c, {
    currentDrop: null, lastCampaignCatalog: [], networkState: { consecutiveFailures: 3 },
    lastTwitchGqlAt: 123, lastGqlSuccessAt: 123, lastGqlError: 'previous failure',
    clearGqlFailurePause: () => { clears += 1; }, persistNetworkState: () => {},
    mergeCampaigns: (a, b) => [...a, ...b], routingCampaignPool: () => [],
    isAutoRoutingController: () => true, refreshDropCard: () => {},
  });
  vm.runInContext(extract('ingestTwitchGqlRows'), c);
  c.ingestTwitchGqlRows([{ errors: [{ message: "operation with name 'Inventory' not found" }] }], 'page', [{ name: 'Inventory' }]);
  assert.equal(clears, 0);
  assert.equal(c.lastGqlSuccessAt, 123);
  assert.equal(c.lastTwitchGqlAt, 123);
  assert.equal(c.networkState.consecutiveFailures, 3);
  assert.equal(c.lastGqlError, 'previous failure');
  assert.equal(c.inventoryResponseHealth.shape.errorCount, 1);
  assert.deepEqual(events, []);
});
