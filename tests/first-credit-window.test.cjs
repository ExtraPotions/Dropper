'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const parts = path.join(__dirname, '../src/parts');
const source = fs.readdirSync(parts).filter(name => name.endsWith('.js')).sort().map(name => fs.readFileSync(path.join(parts, name), 'utf8').replace(/\r\n/g, '\n')).join('\n');
function block(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }

const MINUTE = 60 * 1000;
const ENTERED = 1_000_000;

// Runs routingControllerVerifyStream against an in-memory routing session.
function harness({ live = true, game = '007 First Light', campaignSupported = true, minutes = null } = {}) {
  const store = new Map();
  const transitions = [];
  const context = {
    ROUTING_SESSION_VERSION: 1,
    ROUTING_STATES: { IDLE: 'idle', SELECT_CAMPAIGN:'select-campaign', FIND_STREAM: 'find-stream', OPEN_STREAM: 'open-stream', ERROR: 'error', VERIFY_STREAM: 'verify-stream', EARNING: 'earning', WAITING: 'waiting', PAUSED: 'paused' },
    ROUTING_FIRST_CREDIT_DEADLINE_MS: 6 * MINUTE,
    GQL_MIN_GAP_MS: 15 * 1000,
    STREAM_ROUTE_SETTLE_MS: 15 * 1000,
    CATEGORY_MISMATCH_GRACE_MS: 15 * 1000,
    PAGE_STARTED_AT: 0,
    currentDrop: { id: 'drop', campaignKey: 'campaign', game: '007 First Light', currentMinutes: minutes, percent: null },
    lastStreamVerification: null,
    cleanText: value => String(value ?? '').trim(),
    gameNamesMatch: (a, b) => a.toLowerCase() === b.toLowerCase(),
    watchingLogin: () => 'toly500',
    readStreamInfo: () => ({ live, game, dropsEnabled: true }),
    syncRoutingCampaignAllowListEvidence: session => session,
    readSession: key => store.get(key) ?? null,
    writeSession: (key, value) => store.set(key, value),
    removeSession: key => store.delete(key),
    requestFinalVerificationPoll: () => false,
    routingControllerAddFailedStream: (session, login) => [...(session.failedStreams || []), login],
    setManualStreamLock: () => {},
    setStatus: () => {},
    clearSkipStreamerArm: () => {},
    logActivity: () => {},
    saveRecoverySnapshot: () => {},
    pickViableCampaign: () => ({next:{id:'next'},excluded:new Set()}),
    Date: class extends Date { static now() { return context.now; } },
    now: ENTERED,
  };
  vm.runInNewContext([
    'const ROUTING_SESSION_KEY = "routing";',
    block('  function routingSessionDefaults', '\n  function writeRoutingControllerSession'),
    block('  function writeRoutingControllerSession', '\n  function routingControllerTargetFromDrop').replace(/\n  function [\s\S]*$/u, ''),
    block('  function transitionRoutingController', '\n  function routingControllerAddFailedStream').replace(/\n  function (?!transitionRoutingController)[\s\S]*$/u, ''),
    block('  function routingRewardCreditState', '\n  function routingControllerVerifyStream'),
    block('  function routingControllerVerifyStream', '\n  function routingControllerEarning'),
    block('  function routingControllerWaiting', '\n  function routingControllerDiagnostics'),
    'this.verify = routingControllerVerifyStream; this.wait = routingControllerWaiting; this.write = writeRoutingControllerSession; this.read = readRoutingControllerSession; this.transition = transitionRoutingController;',
  ].join('\n'), context);
  const original = context.transition;
  context.transition = (...args) => { transitions.push(args[0]); return original(...args); };
  context.write({
    ...context.read(), state: 'verify-stream', enteredAt: ENTERED, deadlineAt: ENTERED + 90 * 1000,
    targetGame: '007 First Light', targetStream: 'toly500', targetDropId: 'drop', targetCampaignKey: 'campaign',
    verifyBaselineMinutes: 0, verifyBaselinePercent: 0,
    candidateEvidence: { dropsTagged: true, gqlCampaignSupported: campaignSupported },
  });
  const tick = (offsetMs) => { context.now = ENTERED + offsetMs; return context.verify(context.now); };
  return { context, tick };
}

test('a stream Twitch confirms for the campaign waits for first credit instead of failing at 90 seconds', () => {
  const { context, tick } = harness();
  tick(20 * 1000);
  const session = context.read();
  assert.equal(session.state, 'verify-stream');
  assert.equal(session.firstCreditWindow, true);
  assert.equal(session.deadlineAt, ENTERED + 6 * MINUTE);
  tick(2 * MINUTE);
  assert.equal(context.read().state, 'verify-stream', 'the diagnostics case rotated here at about 96 seconds');
  assert.equal((context.read().failedStreams || []).length, 0);
});

test('first credit inside the window verifies earning', () => {
  const { context, tick } = harness();
  tick(20 * 1000);
  context.currentDrop.currentMinutes = 1;
  tick(3 * MINUTE);
  assert.equal(context.read().state, 'earning');
  assert.equal(context.lastStreamVerification.method, 'credited-progress');
});

test('no credit by the end of the window still rotates to another stream', () => {
  const { context, tick } = harness();
  tick(20 * 1000);
  tick(6 * MINUTE + 1000);
  const session = context.read();
  assert.equal(session.state, 'find-stream');
  assert.deepEqual([...session.failedStreams], ['toly500']);
  assert.equal(session.firstCreditWindow, false, 'the next stream gets its own window');
});

test('streams without campaign support keep the 90 second verification limit', () => {
  const { context, tick } = harness({ campaignSupported: false });
  tick(20 * 1000);
  assert.equal(context.read().firstCreditWindow, false);
  tick(95 * 1000);
  assert.equal(context.read().state, 'find-stream');
});

test('an offline stream or a different category never gets the longer window', () => {
  for (const options of [{ live: false }, { game: 'Fortnite' }]) {
    const { context, tick } = harness(options);
    tick(20 * 1000);
    assert.equal(context.read().firstCreditWindow, false, JSON.stringify(options));
  }
});

test('diagnostics report the first-credit window', () => {
  assert.match(source, /firstCreditTimeoutSeconds: Math\.round\(ROUTING_FIRST_CREDIT_DEADLINE_MS \/ 1000\)/u);
  assert.match(source, /firstCreditWindow: Boolean\(routingSession\.firstCreditWindow\)/u);
});

test('three completed first-credit windows defer the campaign instead of looping through streams',()=>{
 const {context,tick}=harness();
 for(let attempt=0;attempt<3;attempt++){
  const entered=ENTERED+attempt*7*MINUTE;
  context.now=entered;
  context.write({...context.read(),state:'verify-stream',enteredAt:entered,deadlineAt:entered+6*MINUTE,firstCreditWindow:true,targetStream:'toly500',candidateEvidence:{gqlCampaignSupported:true}});
  tick(attempt*7*MINUTE+6*MINUTE+1000);
 }
 const session=context.read();assert.equal(session.state,'select-campaign');
 assert.equal(session.creditVerificationAttempts.campaign.count,3);
 assert.equal(session.deferredCampaigns.campaign,context.now+15*MINUTE);
 assert.equal(context.lastStreamVerification,null,'campaign support never fabricates earning');
});

test('when no alternative campaign exists, the exhausted credit budget waits on the current stream',()=>{
 const {context,tick}=harness();context.pickViableCampaign=()=>({next:null,excluded:new Set()});
 context.write({...context.read(),creditVerificationAttempts:{campaign:{count:2,channels:['other'],expiresAt:ENTERED+30*MINUTE}}});
 tick(20*1000);tick(6*MINUTE+1000);
 const session=context.read();assert.equal(session.state,'waiting');assert.equal(session.waitReason,'reward-credit-unconfirmed');
 assert.equal(session.targetStream,'toly500');assert.equal(session.deadlineAt,context.now+15*MINUTE);
});

test('fresh credit takes precedence over an exhausted retry budget',()=>{
 const {context,tick}=harness();context.write({...context.read(),creditVerificationAttempts:{campaign:{count:3,expiresAt:ENTERED+30*MINUTE}}});
 tick(20*1000);context.currentDrop.currentMinutes=1;tick(6*MINUTE+1000);
 assert.equal(context.read().state,'earning');assert.equal(context.lastStreamVerification.method,'credited-progress');
 assert.equal(context.read().creditVerificationAttempts.campaign,undefined,'verified earning clears the retry budget');
});

test('credit cooldown holds the current stream and fresh credit can end the cooldown early',()=>{
 const {context,tick}=harness();context.pickViableCampaign=()=>({next:null,excluded:new Set()});
 context.write({...context.read(),creditVerificationAttempts:{campaign:{count:2,expiresAt:ENTERED+30*MINUTE}}});
 tick(20*1000);tick(6*MINUTE+1000);context.now+=MINUTE;
 context.wait(context.now);assert.equal(context.read().state,'waiting');
 context.currentDrop.currentMinutes=1;context.wait(context.now);
 assert.equal(context.read().state,'earning');
 assert.equal(context.read().deferredCampaigns.campaign,undefined,'fresh earning clears the campaign deferral');
});

test('reward-session diagnostics distinguish unidentified identity from an identified session waiting for credit',()=>{
 const context={cleanText:value=>String(value??'').trim(),lastSessionPoll:{at:1000,channelLogin:'channel',responseStatus:'unidentified',identityLevel:'none'}};
 const code=block('  function routingRewardCreditState', '\n  function routingControllerCreditDeadline');
 vm.runInNewContext(code+'\nthis.state=routingRewardCreditState;',context);
 const session={targetStream:'channel'};
 assert.equal(context.state(session,2000).code,'session-unidentified');
 context.lastSessionPoll.responseStatus='absent';assert.equal(context.state(session,2000).code,'session-absent');
 context.lastSessionPoll.responseStatus='ok';context.lastSessionPoll.identityLevel='exact-drop';assert.equal(context.state(session,2000).code,'session-identified');
 assert.equal(context.state(session,100000).code,'session-check-pending','stale observations cannot describe the current stream');
});

test('expired attempt budgets start fresh and unknown first observations do not fabricate credit',()=>{
 const {context,tick}=harness();context.pickViableCampaign=()=>({next:null,excluded:new Set()});
 context.write({...context.read(),creditVerificationAttempts:{campaign:{count:3,expiresAt:ENTERED-1}}});
 tick(20*1000);tick(6*MINUTE+1000);
 assert.equal(context.read().state,'find-stream');assert.equal(context.read().creditVerificationAttempts.campaign.count,1);
 context.write({...context.read(),state:'waiting',targetStream:'toly500',waitReason:'reward-credit-unconfirmed',deadlineAt:context.now+15*MINUTE,verifyBaselineMinutes:null,verifyBaselinePercent:null});
 context.currentDrop.currentMinutes=20;context.wait(context.now);
 assert.equal(context.read().state,'waiting','the first known value may be historical');
 context.currentDrop.currentMinutes=21;context.wait(context.now);assert.equal(context.read().state,'earning');
});

test('cooldown expiry resumes campaign selection without permanently excluding the campaign',()=>{
 const {context,tick}=harness();context.pickViableCampaign=()=>({next:null,excluded:new Set()});
 context.write({...context.read(),creditVerificationAttempts:{campaign:{count:2,expiresAt:ENTERED+30*MINUTE}}});
 tick(20*1000);tick(6*MINUTE+1000);context.now=context.read().deadlineAt;
 context.wait(context.now);assert.equal(context.read().state,'select-campaign');assert.equal(context.read().excludedCampaignKeys.length,0);
});
function fullRoutingHarness({ alternative = false } = {}) {
  const { context, tick } = harness();
  const next = { id: 'other-drop', campaignKey: 'other-campaign', game: 'Other Game', requiredMinutes: 60 };
  Object.assign(context, {
    settings: { findNextStream: true },
    routingControllerResetLegacyHandoff: () => {},
    recoveryNavigationState: () => ({ suspended: false }),
    isAutoRoutingController: () => true,
    viewingNavigationAllowed: () => true,
    clearSyntheticWaitingDrop: () => {}, expireEndedOpenCampaigns: () => {},
    routingControllerNavigationInFlight: () => false,
    dropProgressComplete: () => false, campaignMarkedComplete: () => false,
    campaignIsExcluded: () => false, campaignIsRoutingOpen: () => true,
    dropFitsCampaignWindow: () => true,
    campaignRoutingState: () => ({ open: true }),
    campaignExpirySnapshot: () => null, mergeCampaigns: () => [],
    lastInventoryCampaigns: [], lastCampaignCatalog: [],
    routingCampaignPool: () => [], campaignDetailsMissedRecently: () => false,
    pickNextOpenCampaignDrop: (_pool, excluded) => {
      if (!excluded.includes('campaign')) return { ...context.currentDrop, requiredMinutes: 60 };
      return alternative && !excluded.includes(next.campaignKey) ? next : null;
    },
    routingControllerTargetFromDrop: drop => ({ targetCampaignKey: drop.campaignKey, targetDropId: drop.id, targetGame: drop.game }),
    adoptSelectedTargetDrop: drop => { context.currentDrop = drop; },
    clearStoredCurrentDrop: () => { context.currentDrop = null; },
    routingControllerFindStream: () => { throw Error('Deferred campaign reached stream discovery'); },
    routingControllerOpenStream: () => { throw Error('Deferred campaign opened another stream'); },
    ROUTING_VERIFY_DEADLINE_MS: 90 * 1000,
  });
  vm.runInNewContext([
    block('  function routingControllerBootstrap', '\n  function routingControllerFindStream'),
    block('  function routingControllerReconcileActiveTarget', '\n  // The viewer changed Campaign Order'),
    fs.readFileSync(path.join(parts, '01-claims-recovery-and-routing.js'), 'utf8').split(/(?=  function routingControllerTick\()/u).at(-1),
    'this.select = routingControllerSelectCampaign; this.bootstrap = routingControllerBootstrap; this.controllerTick = routingControllerTick;',
  ].join('\n'), context);
  return { context, tick };
}

test('full routing tick chooses an alternative after three uncredited attempts instead of resuming the deferred target', () => {
  const { context, tick } = fullRoutingHarness({ alternative: true });
  context.write({ ...context.read(), creditVerificationAttempts: { campaign: { count: 2, expiresAt: ENTERED + 30 * MINUTE } } });
  tick(20 * 1000); tick(6 * MINUTE + 1000);
  assert.equal(context.read().state, 'select-campaign');
  context.controllerTick(context.now);
  assert.equal(context.read().targetCampaignKey, 'other-campaign');
  assert.equal(context.currentDrop.campaignKey, 'other-campaign');
  assert.ok(context.read().deferredCampaigns.campaign > context.now);
});

test('restart states and direct bootstrap hold a deferred target without restarting stream discovery', () => {
  for (const state of ['idle', 'paused', 'error', 'select-campaign', 'find-stream', 'open-stream', 'verify-stream']) {
    const { context } = fullRoutingHarness();
    const deadline = ENTERED + 15 * MINUTE;
    context.write({ ...context.read(), state, creditVerificationAttempts: { campaign: { count: 3 } }, deferredCampaigns: { campaign: deadline } });
    context.controllerTick(ENTERED);
    assert.equal(context.read().state, 'waiting', state);
    assert.equal(context.read().waitReason, 'reward-credit-unconfirmed', state);
    assert.equal(context.read().deadlineAt, deadline, 'the cooldown must not extend');
    context.controllerTick(ENTERED + MINUTE);
    assert.equal(context.read().state, 'waiting');
  }
  const { context } = fullRoutingHarness();
  context.write({ ...context.read(), creditVerificationAttempts: { campaign: { count: 3 } }, deferredCampaigns: { campaign: ENTERED + 15 * MINUTE } });
  context.bootstrap();
  assert.equal(context.read().state, 'waiting');
});

test('full routing tick accepts fresh credit during cooldown and resumes normal selection after expiry', () => {
  const { context } = fullRoutingHarness();
  context.write({ ...context.read(), state: 'find-stream', creditVerificationAttempts: { campaign: { count: 3 } }, deferredCampaigns: { campaign: ENTERED + 15 * MINUTE } });
  context.controllerTick(ENTERED);
  context.currentDrop.currentMinutes = 1;
  context.controllerTick(ENTERED + MINUTE);
  assert.equal(context.read().state, 'earning');
  assert.equal(context.read().deferredCampaigns.campaign, undefined);
  const other = fullRoutingHarness().context;
  other.write({ ...other.read(), state: 'select-campaign', deferredCampaigns: { campaign: ENTERED - 1 } });
  other.controllerTick(ENTERED);
  assert.equal(other.read().state, 'find-stream');
  assert.equal(other.read().targetCampaignKey, 'campaign');
});
