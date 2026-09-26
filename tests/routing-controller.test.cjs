'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadDropperSource } = require('./load-source.cjs');
const root = path.resolve(__dirname, '..');
const source = loadDropperSource(root);

test('3.1 uses one routing controller session and explicit states', () => {
  assert.match(source, /ROUTING_SESSION_KEY = "dropper-routing-session-v310"/u);
  for (const state of ['select-campaign','find-stream','open-stream','verify-stream','earning','claim','waiting','paused','error']) {
    assert.match(source, new RegExp(`"${state}"`, 'u'));
  }
  assert.match(source, /function routingControllerTick\(/u);
  assert.match(source, /function transitionRoutingController\(/u);
});

test('heartbeat has one routing authority', () => {
  const start = source.indexOf('  async function heartbeat() {');
  const end = source.indexOf('\n  function isSubscriptionPromoText', start);
  const heartbeat = source.slice(start, end);
  assert.match(heartbeat, /routingControllerTick\(Date\.now\(\), "heartbeat"\)/u);
  assert.doesNotMatch(heartbeat, /continueHomepageCampaignHandoffFromDom|continueToNextGame|ensureActiveCampaignStream|maybeRecoverCategoryMismatch|findNextStream/u);
});

test('stream discovery is category-only and uses shared candidate classification', () => {
  const start = source.indexOf('  function routingControllerFindStream');
  const end = source.indexOf('\n  function routingControllerOpenStream', start);
  const body = source.slice(start, end);
  assert.match(body, /directory\/category/u);
  assert.match(body, /classifyRoutingCandidates\(targetGame, targetSlug, session, now\)/u);
  assert.match(body, /candidate\.dropsTagged === true/u);
  assert.doesNotMatch(body, /twitchSearchUrl|TWITCH_HOME_URL/u);

  const classifierStart = source.indexOf('  function classifyRoutingCandidates');
  const classifierEnd = source.indexOf('\n  function routingCandidateDiagnosticsSnapshot', classifierStart);
  const classifier = source.slice(classifierStart, classifierEnd);
  assert.match(classifier, /collectDirectoryStreamCandidates\(targetGame, targetSlug, \[\]\)/u);
});

test('routing timers are controller deadlines, not routing-specific timeout chains', () => {
  assert.match(source, /ROUTING_VERIFY_DEADLINE_MS = 90 \* 1000/u);
  assert.match(source, /deadlineAt/u);
  const controllerStart = source.indexOf('  function routingSessionDefaults');
  const controllerEnd = source.indexOf('\n  async function heartbeat()', controllerStart);
  const controller = source.slice(controllerStart, controllerEnd);
  assert.doesNotMatch(controller, /setTimeout\(|setInterval\(/u);
});

test('manual skip and post-claim progression dispatch into controller', () => {
  const skipStart = source.indexOf('  function skipCurrentStreamer()');
  const skipEnd = source.indexOf('\n  function pruneStandbyCache', skipStart);
  const skip = source.slice(skipStart, skipEnd);
  assert.match(skip, /transitionRoutingController\(/u);
  assert.match(skip, /ROUTING_STATES\.FIND_STREAM/u);
  assert.doesNotMatch(skip, /continueHomepageCampaignHandoffFromDom|TWITCH_HOME_URL/u);

  const claimStart = source.indexOf('  function scheduleNextGameAfterClaim');
  const claimEnd = source.indexOf('\n  function isDirectoryCategoryPage', claimStart);
  const claim = source.slice(claimStart, claimEnd);
  assert.match(claim, /transitionRoutingController\(/u);
  assert.match(claim, /ROUTING_STATES\.SELECT_CAMPAIGN/u);
  assert.doesNotMatch(claim, /transitionHandoff/u);
});

test('GQL refresh updates data without legacy routing decisions', () => {
  assert.doesNotMatch(source, /if \(verifyHandoffChannel\(login, gameName, available, sessionDrop\)\) return;/u);
  assert.doesNotMatch(source, /if \(routingController\) verifyHandoffFromInventory/u);
  assert.doesNotMatch(source, /verifyHandoffWithCreditedProgress\(currentDrop, previousDrop\);/u);
  assert.match(source, /GQL refresh updates data only\. The routing controller decides what happens next/u);
});

test('GQL poll contains no legacy handoff routing', () => {
  const start = source.indexOf('  async function pollGqlDrops()');
  const end = source.indexOf('\n  function applyDrop(', start);
  const poll = source.slice(start, end);
  assert.doesNotMatch(poll, /verifyHandoff|transitionHandoff|HANDOFF_STATES|pendingHandoff/u);
  assert.doesNotMatch(poll, /readRoutingControllerSession|routingControllerTick|transitionRoutingController/u);
  assert.match(poll, /GQL refresh updates data only\. The routing controller decides what happens next/u);
});

test('current same-game channel must pass verification before earning', () => {
  const start = source.indexOf('  function routingControllerBootstrap');
  const end = source.indexOf('\n  function routingControllerSelectCampaign', start);
  const body = source.slice(start, end);
  assert.match(body, /ROUTING_STATES\.VERIFY_STREAM/u);
  assert.match(body, /dropsTagged: Boolean\(info\.dropsEnabled\)/u);
  assert.doesNotMatch(body, /ROUTING_STATES\.EARNING/u);
});

test('verification proof is baseline advancement, not a freshness timestamp', () => {
  const start = source.indexOf('  function routingControllerVerifyStream');
  const end = source.indexOf('\n  function routingControllerEarning', start);
  const body = source.slice(start, end);
  assert.match(body, /const progressProof = minutesAdvanced \|\| percentAdvanced;/u);
  assert.doesNotMatch(body, /lastProgressAt > Number\(session\.enteredAt/u);
});

test('legacy handoff cannot gate 3.1 Drop updates', () => {
  const start = source.indexOf('  function dropMatchesLockedHandoff');
  const end = source.indexOf('\n  function handoffIsBusyRouting', start);
  const body = source.slice(start, end);
  assert.match(body, /readRoutingControllerSession\(\)/u);
  assert.doesNotMatch(body, /getHandoffState|HANDOFF_STATES|handoffIsBusyRouting/u);
});

test('legacy handoff is cleared before the first heartbeat network cycle', () => {
  const start = source.indexOf('  function startHeartbeat()');
  const end = source.indexOf('\n  function queueGqlPollSoon', start);
  assert.match(source.slice(start, end), /routingControllerResetLegacyHandoff\(\);/u);
});
console.log('Dropper 3.1 routing controller checks passed.');


test('3.1 multi-tab ownership no longer depends on legacy handoff state', () => {
  const start = source.indexOf('  function isAutoRoutingController()');
  const end = source.indexOf('\n  function clearDeferredTabDropCard', start);
  const owner = source.slice(start, end);
  assert.match(owner, /return isOldestLiveTab\(\)/u);
  assert.doesNotMatch(owner, /getHandoffState|hasHandoff/u);
  assert.match(source, /hasRouting: readRoutingControllerSession\(\)\.state !== ROUTING_STATES\.IDLE/u);
});

test('secondary tabs remain observational instead of clearing Drop state', () => {
  const start = source.indexOf('  function clearDeferredTabDropCard');
  const end = source.indexOf('\n  function noteDeferredAutoRouting', start);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /clearStoredCurrentDrop/u);
  assert.match(body, /return false;/u);
});


test('diagnostics are controller-native', () => {
  const start = source.indexOf('  function dropperDebugSnapshot()');
  const end = source.indexOf('\n  function layoutChrome()', start);
  const body = source.slice(start, end);
  assert.match(body, /const routingSession = readRoutingControllerSession\(\);/u);
  assert.match(body, /routingController: routingControllerDiagnostics\(now\)/u);
  assert.doesNotMatch(body, /getHandoffState\(\)|legacyHandoff:/u);
});


test('stale expired targets are evicted before state dispatch', () => {
  const reconcileStart = source.indexOf('  function routingControllerReconcileActiveTarget');
  const reconcileEnd = source.indexOf('\n  function routingControllerTick', reconcileStart);
  const reconcile = source.slice(reconcileStart, reconcileEnd);
  assert.match(reconcile, /campaignMarkedComplete\(key\)/u);
  assert.match(reconcile, /expiry\?\.ended/u);
  assert.match(reconcile, /dropFitsCampaignWindow\(currentDrop, now\)/u);
  assert.match(reconcile, /clearStoredCurrentDrop\(\)/u);
  assert.match(reconcile, /ROUTING_STATES\.SELECT_CAMPAIGN/u);
  assert.match(reconcile, /routing-target-evicted/u);

  const tickStart = source.indexOf('  function routingControllerTick');
  const tickEnd = source.indexOf('\n  async function heartbeat', tickStart);
  const tick = source.slice(tickStart, tickEnd);
  const expireIndex = tick.indexOf('expireEndedOpenCampaigns(now)');
  const reconcileIndex = tick.indexOf('routingControllerReconcileActiveTarget(now)');
  const switchIndex = tick.indexOf('switch (session.state)');
  assert.ok(expireIndex >= 0 && reconcileIndex > expireIndex, 'campaign expiry is recorded before target reconciliation');
  assert.ok(switchIndex > reconcileIndex, 'stale target reconciliation runs before state dispatch');
});


test('promoted and sponsored placements are rejected before routing', () => {
  assert.match(source, /function streamCandidateIsPromoted\(card, link = null\)/u);
  assert.match(source, /side-nav-card__link--promoted-followed/u);
  assert.match(source, /\^\(\?:sponsored\|promoted\|advertisement\|ad\)\$/u);

  const directoryStart = source.indexOf('  function collectDirectoryStreamCandidates');
  const directoryEnd = source.indexOf('\n  function streamCandidateHasDropsProof', directoryStart);
  const directory = source.slice(directoryStart, directoryEnd);
  assert.match(directory, /if \(streamCandidateIsPromoted\(card, link\)\)/u);
  assert.match(directory, /stream-candidate-rejected/u);

  const searchStart = source.indexOf('  function collectHomepageSearchStreamCandidates');
  const searchEnd = source.indexOf('\n  function continueHomepageCampaignHandoffFromDom', searchStart);
  const search = source.slice(searchStart, searchEnd);
  assert.match(search, /if \(streamCandidateIsPromoted\(card, link\)\) continue;/u);
});


test('category cards without Drops badges use probationary verification', () => {
  const findStart = source.indexOf('  function routingControllerFindStream');
  const findEnd = source.indexOf('\n  function routingControllerOpenStream', findStart);
  const find = source.slice(findStart, findEnd);
  assert.match(source, /function streamCandidateEvidence\(/u);
  assert.match(source, /live-drops-tagged/u);
  assert.match(source, /live-same-game/u);
  assert.match(find, /let candidate = candidates\[0\] \|\| null/u);
  assert.match(find, /probationary: !\(visibleDropsProof \|\| campaignAclProof\)/u);
  assert.match(find, /probationary-stream/u);

  const verifyStart = source.indexOf('  function routingControllerVerifyStream');
  const verifyEnd = source.indexOf('\n  function routingControllerEarning', verifyStart);
  const verify = source.slice(verifyStart, verifyEnd);
  assert.match(verify, /const liveDropsVisible = Boolean\(info\.dropsEnabled\)/u);
  assert.match(verify, /campaignProof \|\|\s*progressProof/u);
  assert.match(verify, /gql-campaign\+game/u);
});


test('category render wakes waiting discovery before retry deadline', () => {
  const start = source.indexOf('  function routingControllerWaiting');
  const end = source.indexOf('\n  function routingControllerDiagnostics', start);
  const waiting = source.slice(start, end);
  assert.match(waiting, /session\.waitReason === "no-category-stream"/u);
  assert.match(waiting, /session\.waitReason === "no-live-allowed-channel"/u);
  assert.match(waiting, /classifyRoutingCandidates\(targetGame, targetSlug, session, now\)/u);
  assert.match(waiting, /if \(snapshot\.candidates\.length\)/u);
  assert.match(waiting, /return routingControllerFindStream\(now\);/u);
  const candidateCheck = waiting.indexOf('if (snapshot.candidates.length)');
  const deadlineCheck = waiting.indexOf('if (!session.deadlineAt || now < session.deadlineAt)');
  assert.ok(candidateCheck >= 0 && deadlineCheck > candidateCheck, 'rendered candidates are checked before the retry deadline');
});


test('positive GQL campaign support verifies probationary streams', () => {
  assert.match(source, /function updateRoutingCampaignSupportEvidence\(channelLogin, availableCampaigns, sessionDrop = null\)/u);
  assert.match(source, /channelSupportsTargetCampaign\(availableCampaigns, session\)/u);
  assert.match(source, /gqlCampaignSupported: true/u);
  assert.match(source, /Twitch GQL confirmed target campaign support/u);

  const verifyStart = source.indexOf('  function routingControllerVerifyStream');
  const verifyEnd = source.indexOf('\n  function routingControllerEarning', verifyStart);
  const verify = source.slice(verifyStart, verifyEnd);
  assert.match(verify, /const gqlCampaignProof = Boolean\(session\.candidateEvidence\?\.gqlCampaignSupported\)/u);
  assert.match(verify, /campaignProof \|\|\s*progressProof/u);
  assert.match(verify, /gql-campaign\+game/u);

  const pollStart = source.indexOf('  async function pollGqlDrops()');
  const pollEnd = source.indexOf('\n  function applyDrop(', pollStart);
  const poll = source.slice(pollStart, pollEnd);
  assert.match(poll, /updateRoutingCampaignSupportEvidence\(login, available, sessionDrop\)/u);
  assert.doesNotMatch(poll, /transitionRoutingController\(/u);
});


test('generic Drops tags do not verify campaign-restricted streams', () => {
  const start = source.indexOf('  function routingControllerVerifyStream');
  const end = source.indexOf('\n  function routingControllerEarning', start);
  const verify = source.slice(start, end);

  assert.match(verify, /const liveDropsVisible = Boolean\(info\.dropsEnabled\)/u);
  assert.match(verify, /const directoryDropsVisible = Boolean\(session\.candidateEvidence\?\.dropsTagged\)/u);
  assert.match(verify, /const gqlCampaignProof = Boolean\(session\.candidateEvidence\?\.gqlCampaignSupported\)/u);

  const acceptance = verify.slice(
    verify.indexOf('if (\n      info.live'),
    verify.indexOf('lastStreamVerification =', verify.indexOf('if (\n      info.live')),
  );
  assert.match(acceptance, /campaignProof \|\|\s*progressProof/u);
  assert.doesNotMatch(acceptance, /liveDropsVisible|directoryDropsVisible/u);

  assert.match(verify, /method: progressProof\s*\? "credited-progress"\s*:\s*"gql-campaign\+game"/u);
  assert.match(verify, /directoryDropsVisible,/u);
  assert.match(verify, /liveDropsVisible,/u);
});


test('failed streamers are temporary rotation exclusions and cannot deadlock discovery', () => {
  const start = source.indexOf('  function routingControllerFindStream');
  const end = source.indexOf('\n  function routingControllerOpenStream', start);
  const body = source.slice(start, end);
  assert.match(body, /const snapshot = classifyRoutingCandidates\(targetGame, targetSlug, session, now\)/u);
  assert.match(body, /const exhaustedTemporaryRotation = Boolean\(/u);
  assert.match(body, /failedStreams: \[\]/u);
  assert.match(body, /waitReason: "stream-cycle-reset"/u);
  assert.match(body, /All visible eligible streamers were tried; clearing temporary rotation/u);

  const classifierStart = source.indexOf('  function classifyRoutingCandidates');
  const classifierEnd = source.indexOf('\n  function routingCandidateDiagnosticsSnapshot', classifierStart);
  const classifier = source.slice(classifierStart, classifierEnd);
  assert.match(classifier, /const skipped = routingControllerFailedSet\(session\)/u);
  assert.match(classifier, /temporarilySkipped/u);
});

test('skipped streamer rotation can be manually cleared and resumed', () => {
  assert.match(source, /function clearSkippedStreamers\(reason = "manual-clear", resumeRouting = false\)/u);
  assert.match(source, /id="tdh-clear-skipped-streamers"/u);
  assert.match(source, /clearSkippedStreamers\("manual-clear-skipped-streamers", true\)/u);
  assert.match(source, /streamSkipPolicy: "temporary-rotation"/u);
});


test('allow-list campaigns stay on permitted channels without Drops-tag probing', () => {
  const start = source.indexOf('  function routingControllerFindStream');
  const end = source.indexOf('\n  function routingControllerOpenStream', start);
  const find = source.slice(start, end);
  const classifierStart = source.indexOf('  function classifyRoutingCandidates');
  const classifierEnd = source.indexOf('\n  function routingCandidateDiagnosticsSnapshot', classifierStart);
  const classifier = source.slice(classifierStart, classifierEnd);

  assert.match(classifier, /const campaignCompatible = !allowListPresent \|\| allowListMatch;/u);
  assert.match(classifier, /reason = "campaign-allow-list-match"/u);
  assert.match(classifier, /reason = "campaign-allow-list-mismatch"/u);
  assert.match(source, /live-campaign-allowed/u);
  assert.doesNotMatch(classifier, /drops-tagged-campaign-probe/u);
  assert.match(find, /source: ['"]campaign-acl['"]/u);
  assert.match(find, /navigationReason: campaignAclProof \? "campaign-acl-stream"/u);
  assert.doesNotMatch(find, /campaign-drops-probe/u);

  const verifyStart = source.indexOf('  function routingControllerVerifyStream');
  const verifyEnd = source.indexOf('\n  function routingControllerEarning', verifyStart);
  const verify = source.slice(verifyStart, verifyEnd);
  assert.match(verify, /campaignProof \|\|\s*progressProof/u);
  assert.match(verify, /not allowed by/u);
});

test('allow-list wait state retries stream discovery instead of abandoning the active campaign', () => {
  const start = source.indexOf('  function routingControllerWaiting');
  const end = source.indexOf('\n  function routingControllerDiagnostics', start);
  const waiting = source.slice(start, end);
  assert.match(waiting, /session\.waitReason === "no-live-allowed-channel"/u);
  assert.match(waiting, /classifyRoutingCandidates\(targetGame, targetSlug, session, now\)/u);
  assert.match(waiting, /ROUTING_STATES\.FIND_STREAM/u);
});


test('router and standby queue share temporary-skip exclusions and live candidate classification', () => {
  const classifierStart = source.indexOf('  function classifyRoutingCandidates');
  const classifierEnd = source.indexOf('\n  function routingCandidateDiagnosticsSnapshot', classifierStart);
  const classifier = source.slice(classifierStart, classifierEnd);
  assert.match(classifier, /temporarilySkipped = Boolean\(login && skipped\.has\(login\)\)/u);
  assert.match(classifier, /const routable = Boolean\(!temporarilySkipped && campaignCompatible\)/u);

  const queueStart = source.indexOf('  function discoverQueueCandidates');
  const queueEnd = source.indexOf('\n  function refreshQueueList', queueStart);
  const queue = source.slice(queueStart, queueEnd);
  assert.match(queue, /const failed = routingControllerFailedSet\(routing\)/u);
  assert.match(queue, /failed\.has\(login\)/u);
  assert.match(queue, /classifyRoutingCandidates\(targetGame, targetSlug, routing, now\)/u);
  assert.match(queue, /availability: "live"/u);
  assert.match(queue, /availability: "cached"/u);
});

test('candidate diagnostics explain live and cached routability', () => {
  const start = source.indexOf('  function routingCandidateDiagnosticsSnapshot');
  const end = source.indexOf('\n  function streamCandidateHasDropsProof', start);
  const body = source.slice(start, end);
  assert.match(body, /"temporary-skip"/u);
  assert.match(body, /"recent-cache-not-live-proof"/u);
  assert.match(body, /"cached-not-currently-visible"/u);
  assert.match(source, /streamCandidates: routingCandidateDiagnosticsSnapshot\(now\)/u);
  assert.match(source, /queueCandidateDetails:/u);
});
