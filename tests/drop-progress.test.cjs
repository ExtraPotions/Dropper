"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

const { loadDropperSource } = require("./load-source.cjs");
const source = loadDropperSource();
const start = source.indexOf("  function dropProgressPercent");
const end = source.indexOf("\n  function activeDropNeedsStream", start);

assert.notEqual(start, -1, "dropProgressPercent helper is present");
assert.notEqual(end, -1, "drop progress helper block is complete");

const context = {};
vm.runInNewContext(
  `${source.slice(start, end)}\nthis.api = { dropProgressPercent, dropProgressComplete };`,
  context,
);

const { dropProgressPercent, dropProgressComplete } = context.api;

assert.equal(dropProgressPercent(359, 360), 99, "359 of 360 minutes must not display as complete");
assert.equal(
  dropProgressComplete({ currentMinutes: 359, requiredMinutes: 360, percent: 100 }),
  false,
  "rounded percentage must not override credited minutes",
);
assert.equal(dropProgressPercent(360, 360), 100, "all required minutes display as complete");
assert.equal(
  dropProgressComplete({ currentMinutes: 360, requiredMinutes: 360, percent: 99 }),
  true,
  "credited minutes are authoritative",
);
assert.equal(
  dropProgressComplete({ percent: 100 }),
  true,
  "percentage remains a fallback when Twitch omits minute totals",
);
assert.equal(
  dropProgressComplete({ isClaimed: true, currentMinutes: 0, requiredMinutes: 360 }),
  true,
  "claimed rewards remain complete",
);

const reconcileStart = source.indexOf("  function reconcileDropProgress");
const reconcileEnd = source.indexOf("\n  function resetClaimReadyTimer", reconcileStart);
assert.notEqual(reconcileStart, -1, "reconcileDropProgress helper is present");
assert.notEqual(reconcileEnd, -1, "reconcileDropProgress block is complete");

const reconcileContext = {
  lastInventoryCampaigns: [],
  lastProgressReconcile: null,
  inventorySnapshotContainsDrop: () => false,
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
};
vm.runInNewContext(
  `${source.slice(reconcileStart, reconcileEnd)}\nthis.reconcile = reconcileDropProgress;`,
  reconcileContext,
);

assert.equal(
  reconcileContext.reconcile(
    { currentMinutes: 4, requiredMinutes: 15 },
    { currentMinutes: 0, requiredMinutes: 15 },
    { inventoryLive: false },
  ),
  4,
  "catalog-shell zeros must not suppress live session minutes",
);
assert.equal(reconcileContext.lastProgressReconcile.source, "session-over-catalog-shell");

assert.equal(
  reconcileContext.reconcile(
    { currentMinutes: 4, requiredMinutes: 15 },
    { currentMinutes: 2, requiredMinutes: 15 },
    { inventoryLive: true },
  ),
  4,
  "session minutes ahead of Inventory are shown while Inventory catches up",
);
assert.equal(reconcileContext.lastProgressReconcile.source, "session-ahead-of-inventory");

assert.equal(
  reconcileContext.reconcile(
    { currentMinutes: 1, requiredMinutes: 15 },
    { currentMinutes: 6, requiredMinutes: 15 },
    { inventoryLive: true },
  ),
  6,
  "live Inventory remains authoritative when it is ahead of session",
);
assert.equal(reconcileContext.lastProgressReconcile.source, "inventory-authoritative");

assert.equal(
  reconcileContext.reconcile(
    { currentMinutes: 35, requiredMinutes: 45 },
    { currentMinutes: 34, requiredMinutes: 45 },
    {
      inventoryLive: true,
      sessionEligible: false,
      sessionRejectedReason: "different-campaign-or-drop",
    },
  ),
  34,
  "a same-game session from another campaign cannot advance the locked Inventory Drop",
);
assert.equal(
  reconcileContext.lastProgressReconcile.source,
  "inventory-authoritative-session-rejected",
  "cross-campaign session rejection remains explicit in diagnostics",
);
assert.equal(
  reconcileContext.lastProgressReconcile.observedSessionMinutes,
  35,
  "rejected session minutes remain visible for diagnostics",
);
assert.equal(reconcileContext.lastProgressReconcile.sessionMinutes, null, "rejected session minutes are not treated as eligible progress");
assert.equal(reconcileContext.lastProgressReconcile.sessionEligible, false, "diagnostics mark the mismatched session as ineligible");
assert.equal(
  reconcileContext.lastProgressReconcile.sessionRejectedReason,
  "different-campaign-or-drop",
  "diagnostics explain why the session was rejected",
);

assert.match(source, /Progress display follows live Inventory plus a session only when the[\s\S]*same campaign or exact Drop/u, "progress minutes use Inventory plus only identity-matched session data");
assert.match(source, /pickTimedDrop\(inventoryCampaigns, preferredGame\)/, "progress pick uses Inventory campaigns only");
assert.doesNotMatch(
  source,
  /preferredInventory = liveInventoryDrop \|\| pickTimedDrop\(campaignPool, preferredGame\)/,
  "progress pick must not use the All Campaigns catalog pool",
);
assert.match(source, /session-over-catalog-shell/, "catalog shells cannot zero out session progress");
assert.match(source, /incomingMinutes < previousMinutes/, "applyDrop ratchets credited minutes for the same Drop");
assert.match(source, /function sessionDropQueryVariables/, "session polls have an explicit channel id/login helper");
assert.match(source, /function fetchSessionDropState/, "session minutes are fetched even when streamInfo omits channel id");
assert.match(
  source,
  /sessionDropQueryVariables\(id, login\)/,
  "Safari/login-only streams still request DropCurrentSessionContext",
);
assert.match(source, /pageHook: twitchNetworkHookMode/, "diagnostics report whether the page GQL hook installed");
assert.match(source, /sessionPoll: lastSessionPoll/, "diagnostics report the last session-minute poll");
assert.match(
  source,
  /watched \? ` · \$\{watched\}`/,
  "collapsed progress extra includes live player watch time",
);

const sessionHelperStart = source.indexOf("  function sessionDropQueryVariables");
const sessionHelperEnd = source.indexOf("\n  async function fetchSessionDropState", sessionHelperStart);
assert.notEqual(sessionHelperStart, -1, "sessionDropQueryVariables is present");
assert.notEqual(sessionHelperEnd, -1, "sessionDropQueryVariables block is complete");
const sessionHelperContext = {
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
};
vm.runInNewContext(
  `${source.slice(sessionHelperStart, sessionHelperEnd)}\nthis.vars = sessionDropQueryVariables;`,
  sessionHelperContext,
);
const loginOnly = sessionHelperContext.vars("", "sammymedows_247");
assert.deepEqual(
  { ...loginOnly },
  { channelLogin: "sammymedows_247" },
  "live Drop session queries use only channelLogin",
);
const idAndLogin = sessionHelperContext.vars("12345", "sammymedows_247");
assert.deepEqual(
  { ...idAndLogin },
  { channelLogin: "sammymedows_247" },
  "a stream id never leaks channelID into DropCurrentSessionContext",
);
assert.equal(sessionHelperContext.vars("12345", ""), null, "channel id alone cannot construct the login-only session query");
assert.equal(sessionHelperContext.vars("", ""), null, "no channel login skips the session query");

const currentDropOpStart = source.indexOf("    currentDrop: {");
const currentDropOpEnd = source.indexOf("    streamInfo: {", currentDropOpStart);
const currentDropOp = source.slice(currentDropOpStart, currentDropOpEnd);
assert.match(currentDropOp, /variables:\s*\{\}/u, "DropCurrentSessionContext has no channelID default variables");
assert.doesNotMatch(currentDropOp, /channelID/u, "DropCurrentSessionContext never carries channelID");
const availableDropOpStart = source.indexOf("    availableDrops: {");
const availableDropOpEnd = source.indexOf("    claimDrop: {", availableDropOpStart);
assert.match(
  source.slice(availableDropOpStart, availableDropOpEnd),
  /variables:\s*\{\s*channelID:\s*""\s*\}/u,
  "channel availability queries keep channelID",
);
assert.match(source, /requestMode:\s*vars\?\.channelLogin \? "channel-login" : "unavailable"/u, "diagnostics expose live-session request mode");
assert.match(source, /requestVariables:\s*vars \? Object\.keys\(vars\) : \[\]/u, "diagnostics expose the exact live-session variable names");

const overlayStart = source.indexOf("  function overlayCurrentDropProgressOnCampaigns");
const overlayEnd = source.indexOf("\n  function routingCampaignPool", overlayStart);
assert.notEqual(overlayStart, -1, "live-progress campaign overlay helper is present");
assert.notEqual(overlayEnd, -1, "live-progress campaign overlay helper is complete");
const overlayContext = {
  currentDrop: null,
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  campaignKey: (campaign) => String(campaign?.id || "").toLowerCase(),
};
vm.runInNewContext(
  `${source.slice(overlayStart, overlayEnd)}\nthis.overlay = overlayCurrentDropProgressOnCampaigns;`,
  overlayContext,
);
const staleCampaign = [{
  id: "campaign-1",
  timeBasedDrops: [{
    id: "drop-1",
    name: "Reward One",
    requiredMinutesWatched: 60,
    self: { currentMinutesWatched: 59, isClaimed: false },
  }],
}];
const liveComplete = {
  id: "drop-1",
  name: "Reward One",
  campaignId: "campaign-1",
  campaignKey: "campaign-1",
  currentMinutes: 60,
  requiredMinutes: 60,
  isClaimed: false,
};
const overlaidCampaign = overlayContext.overlay(staleCampaign, liveComplete)[0];
assert.equal(
  overlaidCampaign.timeBasedDrops[0].self.currentMinutesWatched,
  60,
  "live 100% session progress overrides a one-minute-behind Inventory snapshot for routing",
);

const pollApplyIndex = source.indexOf("if (drop) applyDrop(drop);");
const heartbeatStartForProgress = source.indexOf("  async function heartbeat()");
const heartbeatEndForProgress = source.indexOf("\n  function isSubscriptionPromoText", heartbeatStartForProgress);
const heartbeatForProgress = source.slice(heartbeatStartForProgress, heartbeatEndForProgress);
assert.ok(pollApplyIndex >= 0, "fresh Drop progress is applied during GQL refresh");
assert.match(
  heartbeatForProgress,
  /await requestGqlPoll\(pendingGqlReason \|\| "heartbeat"\)[\s\S]*routingControllerTick\(Date\.now\(\), "heartbeat"\)/u,
  "fresh Drop progress is applied before the 3.1 controller evaluates claim or routing state",
);
assert.doesNotMatch(source, /if \(maybeYieldToSoonerOpenCampaign\(/u, "automatic routing never preempts an unfinished campaign just because another ends sooner");

const interceptStart = source.indexOf("  function ingestTwitchGqlRows");
const interceptEnd = source.indexOf("\n  function handleInterceptedTwitchPayload", interceptStart);
const interceptSource = source.slice(interceptStart, interceptEnd);
assert.match(interceptSource, /const sessionDrop =/, "intercepted Twitch session progress is parsed");
assert.doesNotMatch(interceptSource, /verifyHandoffFromInventory|verifyHandoffChannel|transitionHandoff/u, "intercepted Twitch data does not make routing decisions");

assert.match(
  source,
  /const creditedMinuteAdvanced = Boolean\([\s\S]*sameDrop[\s\S]*currentMinutes > previousMinutes/,
  "only genuine same-Drop minute advancement counts as fresh credited progress",
);
assert.match(
  source,
  /if \(creditedMinuteAdvanced\) \{[\s\S]*lastStreamVerification = \{[\s\S]*method: "credited-progress"/,
  "credited progress refreshes stream verification outside handoff-only verification",
);
assert.match(
  source,
  /const FIRST_WATCH_CREDIT_GRACE_MS = 90 \* 1000/,
  "first-watch grace remains a named 90-second constant",
);
assert.match(
  source,
  /verificationProof\.progressConfirmed[\s\S]*FIRST_WATCH_CREDIT_GRACE_MS|FIRST_WATCH_CREDIT_GRACE_MS[\s\S]*graceRemainingMs/,
  "fresh credited progress still informs first-watch grace and earning health",
);

assert.match(source, /function rewardImageFromDrop/, "progress panel can resolve Twitch reward artwork");
assert.match(source, /benefitEdges:[\s\S]*imageAssetURL/, "campaign compaction preserves reward image URLs");

assert.match(source, /function dropBenefitImage\(drop\)/u, "Drop image lookup normalizes Twitch image fields");
assert.match(source, /function rewardImageFromCard\(card, progressBar = null\)/u, "Inventory DOM can supply reward artwork when GQL omits it");
assert.match(source, /rewardImage: dropBenefitImage\(drop\)/u, "selected Drop candidates carry reward artwork");
assert.match(source, /rewardImage: rewardImageFromCard\(card, active\.bar\)/u, "DOM-parsed Drop progress captures reward artwork");
assert.match(source, /previousDrop\?\.rewardImage[\s\S]*rewardImage: previousDrop\.rewardImage/u, "same-Drop progress snapshots cannot erase known reward artwork");
assert.match(source, /currentDrop = \{ \.\.\.currentDrop, rewardImage: resolved \}/u, "resolved reward artwork persists with the current Drop");

console.log("Drop progress regression checks passed.");

assert.doesNotMatch(source, /id="tdh-drop-reward-image"/u, "3.0.70 visible progress layout is restored without the later reward-image surface");
assert.match(source, /function rewardImageFromDrop/u, "reward image plumbing remains available internally");

assert.match(source, /function skipCurrentStreamer\(\)/u, "manual streamer skip control is wired");
assert.match(source, /function skipCurrentStreamer\(\)[\s\S]*ROUTING_STATES\.FIND_STREAM[\s\S]*routingControllerAddFailedStream/u, "manual skip keeps the active campaign and excludes the skipped streamer through the 3.1 controller");
assert.match(source, /checkedAgeLabel/u, "progress footer reports last checked age");
assert.match(source, /id="tdh-updated-ago"/u, "progress footer keeps a last-checked surface");
assert.doesNotMatch(source, /campaignEarnedSummary/u, "campaign strip earned summaries were removed with the navigation strip");


const inventorySyncIndex = source.indexOf("const authoritativeInventoryDrop = currentDrop");
const inventorySyncApplyIndex = source.indexOf("if (authoritativeInventoryDrop) applyDrop(authoritativeInventoryDrop);", inventorySyncIndex);
const sessionFetchIndex = source.indexOf("const sessionState = await fetchSessionDropState", inventorySyncIndex);
assert.ok(inventorySyncIndex >= 0, "live Inventory has an explicit active-Drop synchronization step");
assert.ok(inventorySyncApplyIndex > inventorySyncIndex, "authoritative Inventory progress is applied to currentDrop");
assert.ok(sessionFetchIndex > inventorySyncApplyIndex, "Inventory progress is applied before stream-session verification data is fetched");
assert.match(
  source,
  /Live Inventory is authoritative for credited watch minutes/,
  "source documents Inventory as the authoritative baseline for cross-page progress",
);


assert.match(
  source,
  /const campaign = findCampaignForDrop\(campaigns, active\);/,
  "active Inventory matching reuses the conservative campaign identity matcher",
);
assert.match(
  source,
  /const preserveLockedCampaignIdentity = Boolean\([\s\S]*campaignHasTargetDrop \|\| sameCampaignNameAndGame/,
  "Inventory rows with alternate campaign-key shapes retain the locked campaign identity",
);
assert.match(
  source,
  /activeUnclaimed \? null : pickTimedDrop\(inventoryCampaigns, preferredGame\)/,
  "an active locked Drop never borrows progress from another same-game campaign",
);
assert.match(
  source,
  /else if \(liveInventoryDrop \|\| fromInventory\) \{[\s\S]*const minutes = reconcileDropProgress[\s\S]*currentMinutes: minutes[\s\S]*percent: dropProgressPercent/,
  "reconciled Inventory minutes are written back into the Drop that will be applied",
);
assert.doesNotMatch(
  source,
  /else if \(sessionDrop \|\| liveInventoryDrop \|\| fromInventory\) \{\s*reconcileDropProgress\(/u,
  "progress reconciliation cannot be diagnostic-only when Inventory progress exists",
);


assert.match(
  source,
  /function dropIdentityMatchesTarget\(drop, target = currentDrop\)/u,
  "session progress has a shared campaign/drop identity gate",
);
assert.match(
  source,
  /const matchingSessionDrop = sessionIdentity\.matchesTarget \? sessionDrop : null/u,
  "normal GQL polling only merges session fields when campaign or Drop identity matches",
);
assert.match(
  interceptSource,
  /const matchingSession = sessionIdentity\.matchesTarget \? sessionDrop : null/u,
  "intercepted Twitch GQL only merges session fields when campaign or Drop identity matches",
);
assert.match(
  source,
  /sessionRejectedReason: sessionDrop && !sessionEligible[\s\S]*"different-campaign-or-drop"/u,
  "normal polling records rejected cross-campaign session progress",
);
assert.match(
  interceptSource,
  /sessionRejectedReason: sessionDrop && !sessionIdentity\.matchesTarget[\s\S]*"different-campaign-or-drop"/u,
  "page interception records rejected cross-campaign session progress",
);
assert.doesNotMatch(
  interceptSource,
  /sessionDrop && \(!currentDrop\?\.game \|\| gameNamesMatch/u,
  "same-game alone is not sufficient for intercepted session progress",
);
