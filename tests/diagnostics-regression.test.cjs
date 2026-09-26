"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { loadDropperSource } = require("./load-source.cjs");
const source = loadDropperSource();

assert.match(source, /report: "Dropper Diagnostics"/, "diagnostic exports identify themselves clearly");
assert.match(source, /rewardImage:\s*\(\(\) => \{/u, "diagnostics report reward image resolution");
assert.match(source, /function resourceErrorDetails\(target\)/u, "resource errors include bounded attribution details");
assert.match(source, /owner: owned \? \(productId \|\| 'extrapotions'\) : 'page'/u, "resource errors distinguish Dropper-owned assets from page assets");
assert.match(source, /assetHost,/u, "resource errors retain only the asset hostname rather than a full URL");
assert.match(source, /const checkedForCurrentVersion = state\.checkedForVersion === APP_VERSION;/u, "update checks detect a newly installed version before mutating state");
assert.match(source, /if \(!checkedForCurrentVersion\) \{[\s\S]*state\.lastCheckAt = 0;[\s\S]*state\.lastRemoteVersion = "";/u, "a new installed version clears stale update-check timing and remote-version state");
assert.match(source, /progressCardRect: rectSnapshot\(card\)/u, "diagnostics report the actual progress-card geometry");
assert.match(source, /launcherRect: rectSnapshot\(launcher\)/u, "diagnostics report launcher geometry");
assert.match(source, /launcherRowRect: rectSnapshot\(launcherRow\)/u, "diagnostics report launcher-row geometry");
assert.match(source, /menuRect: rectSnapshot\(ui\?\.dock\)/u, "diagnostics report menu geometry");
assert.match(source, /noticeRect: rectSnapshot\(notice\)/u, "diagnostics report notice geometry");
assert.match(source, /progressPanelWidth: card \? Math\.round\(card\.getBoundingClientRect\(\)\.width\) : null/u, "progressPanelWidth measures the card instead of the combined launcher row");
assert.match(source, /launcherRowWidth: launcherRow \? Math\.round\(launcherRow\.getBoundingClientRect\(\)\.width\) : null/u, "diagnostics expose the combined launcher-row width separately");

assert.match(source, /source: direct \? "drop-data"/u, "diagnostics distinguish direct and fallback reward image sources");

const parserStart = source.indexOf("  function cleanText");
const parserEnd = source.indexOf("\n  function readDropFromCard", parserStart);
assert.notEqual(parserStart, -1, "Drop-card parser helpers are present");
assert.notEqual(parserEnd, -1, "Drop-card parser helper block is complete");

const context = {};
vm.runInNewContext(
  `${source.slice(parserStart, parserEnd)}\nthis.api = { cardCopy, isDropCardMetadata, reconcileDropIdentity };`,
  context,
);

const node = (text) => ({ textContent: text, getAttribute: () => "" });
const diagnosticCard = {
  querySelectorAll: () => [
    node("First Partners Collection"),
    node("End Date: Thu, Oct 1, 12:00 AM PDT"),
    node("Partner Pack Reward"),
  ],
};

assert.equal(
  context.api.isDropCardMetadata("End Date: Thu, Oct 1, 12:00 AM PDT"),
  true,
  "Twitch campaign dates are metadata, not reward names",
);
assert.deepEqual(
  { ...context.api.cardCopy(diagnosticCard) },
  { game: "First Partners Collection", name: "Partner Pack Reward" },
  "metadata between the game and reward does not displace the reward name",
);
const imageCard = {
  querySelectorAll: () => [
    node("September Week 3"),
    { textContent: "", getAttribute: (name) => name === "alt" ? "Drops Campaign Image" : "" },
    node("MARVEL Contest of Champions"),
  ],
};
assert.deepEqual(
  { ...context.api.cardCopy(imageCard) },
  { game: "September Week 3", name: "MARVEL Contest of Champions" },
  "campaign image alt text is not used as the reward name",
);
assert.equal(context.api.isDropCardMetadata("Drops Campaign Image"), true, "Twitch campaign image alt text is not a reward");
assert.equal(context.api.isDropCardMetadata("1 Hour (Sep 25)"), false, "dated duration titles can be real Twitch reward names");
assert.equal(context.api.isDropCardMetadata("60 Minutes"), true, "plain duration-only card copy remains metadata");
const repaired = context.api.reconcileDropIdentity({
  percent: 99,
  name: "Drops Campaign Image",
  game: "September Week 3",
}, [
  { key: "msf", name: "MSF | September Week 3", game: "MARVEL Strike Force", status: "open" },
  { key: "old", name: "September Week 3", game: "Expired Game", status: "expired" },
  { key: "mcoc", name: "September Week 3", game: "MARVEL Contest of Champions", status: "open" },
]);
assert.equal(repaired.game, "MARVEL Contest of Champions", "a campaign title is not used as the Twitch category");
assert.equal(repaired.campaign, "September Week 3");
assert.equal(repaired.campaignKey, "mcoc");
assert.notEqual(repaired.name, "Drops Campaign Image");

const heartbeatStart = source.indexOf("  async function heartbeat()");
const heartbeatEnd = source.indexOf("\n  function isSubscriptionPromoText", heartbeatStart);
const heartbeat = source.slice(heartbeatStart, heartbeatEnd);
const duePoll = heartbeat.indexOf('await requestGqlPoll(pendingGqlReason || "heartbeat")');
const controllerTick = heartbeat.indexOf('routingControllerTick(Date.now(), "heartbeat")');
assert.ok(duePoll >= 0, "heartbeat schedules an overdue GQL refresh");
assert.ok(
  controllerTick > duePoll,
  "data refresh completes before the routing controller evaluates navigation",
);

assert.match(source, /CAMPAIGNS_URL = "https:\/\/www\.twitch\.tv\/drops\/campaigns"/, "handoffs explicitly audit active campaigns");
assert.match(source, /variables: \{ fetchRewardCampaigns: true \}/, "inventory requests include Twitch reward campaigns");
assert.match(source, /CAMPAIGN_CATALOG_KEY = "dropper-campaign-catalog"/, "campaign catalog has cross-navigation storage");
assert.match(source, /lastCampaignCatalog = campaignCatalogCache\.campaigns/, "saved campaigns are restored after Twitch navigation");
assert.match(source, /rememberCampaignCatalog\(discoveredCampaigns, "dropper-inventory-poll"\)/, "inventory polling overlays discovered campaigns onto the dashboard catalog");
assert.match(source, /applyInventorySnapshot\(inventoryCampaigns, "dropper-in-progress-poll"\)/, "inventory polling overlays in-progress progress without replacing dashboard membership");
assert.match(source, /replaceCatalogFromDashboard\(dashboardCampaigns, "viewer-drops-dashboard"\)/, "ViewerDropsDashboard replaces campaign catalog membership");
assert.match(source, /op: "viewerDropsDashboard"/, "ViewerDropsDashboard is requested on Dropper GQL polls");
assert.match(source, /name: "ViewerDropsDashboard"/, "ViewerDropsDashboard persisted query is registered");
assert.match(source, /dashboardObservedForAudit[\s\S]*CAMPAIGN_AUDIT_WAIT_MS/, "campaign audit waits for ViewerDropsDashboard before opening Inventory");
assert.match(source, /function startHomepageCampaignSearch\(\)/, "the Twitch homepage can initiate campaign discovery");
assert.match(source, /homepageDiscovery: surface === "homepage"/, "homepage discovery is recorded in handoff state");
assert.match(source, /campaignsPageDiscovery: surface === "campaigns"/, "All Campaigns discovery is recorded in handoff state");
assert.match(source, /isCampaigns\(\) \|\| isInventory\(\)/, "campaign discovery also starts from All Campaigns and Inventory");
assert.match(source, /function openCampaignsFromMemory/, "remembered open campaigns can fill an empty GQL catalog");
assert.match(source, /function campaignMemoryDiagnosticsSample/, "diagnostics use a bounded campaign-memory sampler");
assert.doesNotMatch(source, /visible-drops-stream/, "same-game visibility alone never verifies a Drops stream");
assert.match(source, /campaignSupported[\s\S]*progressConfirmed/, "stream verification records campaign/progress proof");
assert.match(source, /if \(!campaignSupported && !progressConfirmed\) return false;/, "verification cannot complete without campaign support or credited progress");
assert.doesNotMatch(source, /source:\s*"inventory-vanished"/, "a missing Inventory row is not treated as completion proof");
assert.match(source, /campaign-inventory-missing/, "Inventory disappearance is logged as uncertain instead of completed");
assert.match(source, /percentNode\.textContent = renderedPercent == null \? "—"/, "unknown Drop progress renders as unknown instead of zero");
assert.match(source, /label = "Verifying"/, "same-game playback is labeled Verifying until campaign proof exists");
assert.match(source, /const domVideoPlaying = Boolean\(login && streamVideoIsPlaying\(\)\)/, "diagnostics do not report unrelated page video playback as active stream playback");
assert.match(source, /dropsEnabledTag: Boolean\(login && streamRoot && streamHasDropsEnabledTag\(streamRoot\)\)/, "Drops Enabled diagnostics are scoped to the active stream root");
assert.doesNotMatch(source, /temporaryCampaignSkips: loadTemporaryCampaignSkips/, "diagnostics no longer expose removed 24-hour campaign skips");
assert.match(source, /function authoritativeProgressPercent/, "all visible progress surfaces can resolve one authoritative percentage");
assert.match(source, /data-collapsed-width="compact"\] \{ width:min\(260px/, "compact mode remains exactly 260px");
assert.match(source, /data-collapsed-width="narrow"\] \{ width:min\(220px/, "narrow mode remains exactly 220px");
assert.match(source, /data-collapsed-width="full"\] \{ width:min\(var\(--dropper-width, 312px\)/, "full mode still uses the live chat-matched Dropper width");
assert.match(source, /function syncProgressSurfaces/, "panel, compact state, and launcher ring share one progress renderer");
assert.match(source, /syncProgressSurfaces\(\);\s*updateTitle\(\);/, "heartbeat keeps visible progress surfaces synchronized with the tab title");
assert.match(source, /syncProgressSurfaces\(\);\s*refreshDropCard\(\);/, "authoritative Drop updates push progress to the visible UI immediately");
assert.match(source, /Stream info refresh did not block progress rendering/, "stream-info failures cannot block progress rendering");
assert.doesNotMatch(source, /Campaign strip refresh did not block progress rendering/, "removed campaign strip is no longer in the progress render path");
assert.match(source, /state\.lastRemoteVersion && compareVersions\(state\.lastRemoteVersion, APP_VERSION\) <= 0/, "update state clears stale availability when the remote version is not newer");
assert.match(source, /sample: diagnosticMemorySample/, "diagnostics emit only the bounded campaign-memory sample");
assert.match(source, /campaignMemoryOmitted:/, "diagnostics report how many campaign-memory records were omitted");
assert.match(source, /const diagnosticActivity = activityEntries\.slice\(-12\);/, "diagnostics cap recent activity at 12 events");
assert.doesNotMatch(source, /campaigns: Object\.entries\(campaignMemory\.campaigns \|\| \{\}\)\.map/, "diagnostics no longer dump the full campaign-memory database");
assert.match(source, /function scrapeCampaignsFromPage/, "All Campaigns page rows can fill an empty GQL catalog");
assert.match(source, /Cleared failed handoff/, "failed handoffs are cleared so idle discovery can resume");
assert.match(source, /EXCLUDED_CATEGORY_SLUGS = new Set\(\["first-partners-collection"\]\)/, "the invalid First Partners Collection category is explicitly excluded");
assert.match(source, /!campaignIsExcluded\(currentDrop\)/, "the 3.1 controller refuses to continue an excluded active campaign");
assert.match(source, /campaignIsExcluded\(next\)/, "the 3.1 controller filters excluded candidates during campaign selection");
assert.match(source, /Blocked excluded Twitch category route/, "the final navigation layer also blocks the invalid category URL");
assert.doesNotMatch(source, /return normalizedGameSlug\(gameName\);\s*\n\s*}/, "unverified campaign names cannot become category URLs");
assert.match(source, /CLAIM_READY_GRACE_MS = 0;/, "completed Drops do not block the next earning target while waiting for claim");
assert.match(source, /function dropPreconditionSatisfied\(drop\)/, "completed prerequisite Drops unlock routing without requiring claim");
assert.doesNotMatch(source.slice(source.indexOf("  function pickNextOpenCampaignDrop"), source.indexOf("  function maybeAdvanceExpiredCampaign")), /return other\?\.self\?\.isClaimed;/, "campaign routing does not require prerequisite claims");
assert.match(source, /navigatedToInventory: false/, "claim integrity failures never force the viewer to leave the selected stream");
assert.match(source, /dropperPreconditionsMet\(drop, drops\)/, "routing uses explicit prerequisite evidence rather than inferring a claim from minutes");
const prerequisiteStart = source.indexOf("  function requiresSubscription");
const prerequisiteEnd = source.indexOf("\n  function campaignKey", prerequisiteStart);
const prerequisiteContext = {};
vm.runInNewContext(`${source.slice(prerequisiteStart, prerequisiteEnd)}\nthis.satisfied=dropPreconditionSatisfied;`, prerequisiteContext);
assert.equal(prerequisiteContext.satisfied({ requiredMinutesWatched: 60, self: { currentMinutesWatched: 60, isClaimed: false } }), true, "watch completion satisfies a prerequisite before claim");
assert.match(source, /<path class="fill" id="tdh-ring" d="M18 3H24/, "launcher progress starts at the top center of a rounded-square path");

const compactStart = source.indexOf("  function compactCampaignCatalog");
const compactEnd = source.indexOf("\n  function loadCampaignCatalogCache", compactStart);
assert.notEqual(compactStart, -1, "campaign catalog compactor is present");
assert.notEqual(compactEnd, -1, "campaign catalog compactor is complete");
const compactContext = {};
vm.runInNewContext(`${source.slice(compactStart, compactEnd)}\nthis.compact = compactCampaignCatalog;`, compactContext);
const compacted = compactContext.compact([{
  id: "campaign-1",
  name: "Campaign One",
  status: "ACTIVE",
  game: { id: "game-1", displayName: "Example Game", slug: "example-game", oversized: "discard" },
  oversized: "discard",
  timeBasedDrops: [{
    id: "drop-1",
    name: "Reward One",
    requiredMinutesWatched: 60,
    preconditionDrops: [{ id: "drop-0", oversized: "discard" }],
    self: { isClaimed: false, currentMinutesWatched: 12, dropInstanceID: "instance-1", oversized: "discard" },
    oversized: "discard",
  }],
}]);
assert.equal(compacted[0].game.displayName, "Example Game", "compacted campaigns preserve routing identity");
assert.equal(compacted[0].status, "ACTIVE", "compacted campaigns preserve Twitch's open-status signal");
assert.equal(compacted[0].timeBasedDrops[0].self.currentMinutesWatched, 12, "compacted campaigns preserve watch progress");
assert.equal(compacted[0].oversized, undefined, "unneeded campaign response data is not persisted");
assert.equal(compacted[0].timeBasedDrops[0].preconditionDrops[0].id, "drop-0", "drop prerequisites survive navigation");

const syntheticStart = source.indexOf("  function isPlaceholderDropName");
const syntheticEnd = source.indexOf("\n  function clearSyntheticWaitingDrop", syntheticStart);
assert.notEqual(syntheticStart, -1, "placeholder drop-name detection is present");
assert.notEqual(syntheticEnd, -1, "synthetic waiting-card detection is complete");
const syntheticContext = {
  currentDrop: null,
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
};
vm.runInNewContext(`${source.slice(syntheticStart, syntheticEnd)}\nthis.isSynthetic = isSyntheticWaitingDrop;`, syntheticContext);
assert.equal(syntheticContext.isSynthetic({ name: "Waiting for Game Drops", game: "Game", requiredMinutes: 0 }), true, "a generated waiting card cannot block homepage discovery");
assert.equal(syntheticContext.isSynthetic({ name: "Active drop", game: "", percent: 95 }), true, "an empty Active drop placeholder cannot lock routing");
assert.equal(syntheticContext.isSynthetic({ id: "drop-1", game: "Game", requiredMinutes: 60 }), false, "a real Drop remains the active routing target");

const homepageHeartbeat = source.slice(source.indexOf("  async function heartbeat()"), source.indexOf("\n  function isSubscriptionPromoText"));
assert.match(homepageHeartbeat, /routingControllerTick\(Date\.now\(\), "heartbeat"\)/, "heartbeat delegates campaign and stream decisions to the 3.1 controller");
assert.doesNotMatch(homepageHeartbeat, /startHomepageCampaignSearch|ensureActiveCampaignStream|continueToNextGame/, "legacy homepage and handoff routing are not heartbeat authorities");

const controllerOwnerStart = source.indexOf("  function isAutoRoutingController()");
const controllerOwnerEnd = source.indexOf("\n  function clearDeferredTabDropCard", controllerOwnerStart);
const controllerOwnerSource = source.slice(controllerOwnerStart, controllerOwnerEnd);
assert.match(controllerOwnerSource, /return isOldestLiveTab\(\)/u, "3.1 gives navigation authority to one deterministic tab");
assert.doesNotMatch(controllerOwnerSource, /getHandoffState|hasHandoff/u, "tab ownership no longer depends on legacy handoff state");

const presenceStart = source.indexOf("  function publishTabPresence(");
const presenceEnd = source.indexOf("\n  function clearTabPresence", presenceStart);
const presenceSource = source.slice(presenceStart, presenceEnd);
assert.match(presenceSource, /hasRouting: readRoutingControllerSession\(\)\.state !== ROUTING_STATES\.IDLE/u, "tab presence publishes 3.1 routing ownership state");
assert.match(presenceSource, /routingState: readRoutingControllerSession\(\)\.state/u, "tab presence publishes the controller state");

const clearDeferredStart = source.indexOf("  function clearDeferredTabDropCard");
const clearDeferredEnd = source.indexOf("\n  function noteDeferredAutoRouting", clearDeferredStart);
const clearDeferredSource = source.slice(clearDeferredStart, clearDeferredEnd);
assert.match(clearDeferredSource, /return false;/u, "secondary tabs remain observational");
assert.doesNotMatch(clearDeferredSource, /clearStoredCurrentDrop|currentDrop = null/u, "secondary tabs do not erase authoritative Drop state");

const noteDeferredStart = source.indexOf("  function noteDeferredAutoRouting");
const noteDeferredEnd = source.indexOf("\n  function startTabPresenceSync", noteDeferredStart);
const noteDeferredSource = source.slice(noteDeferredStart, noteDeferredEnd);
assert.match(noteDeferredSource, /Another Dropper Tab Is Managing Drops/u, "secondary tabs surface controller ownership without routing");

const exclusionStart = source.indexOf("  function campaignIsExcluded");
const exclusionEnd = source.indexOf("\n  function campaignWindow", exclusionStart);
const exclusionContext = {
  EXCLUDED_CATEGORY_SLUGS: new Set(["first-partners-collection"]),
  EXCLUDED_CAMPAIGN_NAMES: new Set(["first partners collection"]),
  normalizedGameSlug: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  normalizeGameName: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
};
vm.runInNewContext(`${source.slice(exclusionStart, exclusionEnd)}\nthis.isExcluded = campaignIsExcluded;`, exclusionContext);
assert.equal(exclusionContext.isExcluded({ game: { displayName: "First Partners Collection", slug: "first-partners-collection" } }), true, "the invalid Twitch category cannot be selected from campaign data");
assert.equal(exclusionContext.isExcluded({ game: "First Partners Collection", campaign: "Partner Pack" }), true, "an already-selected invalid target is rejected");
assert.equal(exclusionContext.isExcluded({ game: { displayName: "A Real Game", slug: "a-real-game" } }), false, "other Twitch campaign games remain eligible");

const stallTimeoutStart = source.indexOf("  function progressStallTimeoutMs");
const stalledRecoveryStart = source.indexOf("  function stalledProgressNeedsRecovery(");
const needsStreamStart = source.indexOf("  function activeDropNeedsStream()");
const needsStreamEnd = source.indexOf("\n  function ensureActiveCampaignStream", needsStreamStart);
assert.notEqual(stallTimeoutStart, -1, "progress stall timeout helper is present");
assert.notEqual(stalledRecoveryStart, -1, "stalled progress recovery decision is present");
assert.notEqual(needsStreamStart, -1, "active campaign routing decision is present");
assert.notEqual(needsStreamEnd, -1, "active campaign routing decision is complete");
const stalledRecoveryContext = {
  settings: { findNextStream: true, queueEnabled: true, queueOnStall: true },
  currentDrop: { currentMinutes: 75, requiredMinutes: 90 },
  dropProgressComplete: () => false,
  isAutoSwitchPaused: () => false,
  withinFirstWatchCreditGrace: () => false,
  lastProgressAt: 100000,
  HEALTHY_STREAM_STALLED_MS: 360000,
  UNHEALTHY_STREAM_STALLED_MS: 120000,
  streamEarningHealthSnapshot: () => ({ healthy: true, videoPlaying: true }),
  Date: { now: () => 460001 },
};
vm.runInNewContext(
  `${source.slice(stallTimeoutStart, stalledRecoveryStart)}
function stalledProgressNeedsRecovery() {
  const health = streamEarningHealthSnapshot();
  if (!settings.findNextStream || !currentDrop || dropProgressComplete(currentDrop)) return false;
  if (settings.queueEnabled && !settings.queueOnStall) return false;
  if (isAutoSwitchPaused()) return false;
  if (health.inVerificationGrace) return false;
  if (typeof withinFirstWatchCreditGrace === "function" && withinFirstWatchCreditGrace() && health.videoPlaying) return false;
  const age = Number.isFinite(Number(health.progressAgeMs)) ? Number(health.progressAgeMs) : (Date.now() - lastProgressAt);
  return age >= progressStallTimeoutMs(Boolean(health.healthy));
}
this.stalledProgressNeedsRecovery = stalledProgressNeedsRecovery;
this.progressStallTimeoutMs = progressStallTimeoutMs;`,
  stalledRecoveryContext,
);
assert.equal(stalledRecoveryContext.progressStallTimeoutMs(true), 360000, "healthy streams keep the 6-minute stall");
assert.equal(stalledRecoveryContext.progressStallTimeoutMs(false), 120000, "unhealthy streams stall after 2 minutes");
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), true, "progress beyond the healthy stall threshold enters recovery");
stalledRecoveryContext.settings.queueOnStall = false;
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, "disabled queue-on-stall prevents automatic recovery");
stalledRecoveryContext.settings.queueOnStall = true;
stalledRecoveryContext.isAutoSwitchPaused = () => true;
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, "manual auto-switch pause prevents stalled recovery");
stalledRecoveryContext.isAutoSwitchPaused = () => false;
stalledRecoveryContext.streamEarningHealthSnapshot = () => ({ healthy: false, videoPlaying: false });
stalledRecoveryContext.Date = { now: () => 220001 };
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), true, "a paused player recovers after the unhealthy 2-minute stall");
stalledRecoveryContext.Date = { now: () => 219999 };
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, "a paused player does not recover before the 2-minute stall");
stalledRecoveryContext.Date = { now: () => 220001 };
stalledRecoveryContext.withinFirstWatchCreditGrace = () => true;
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), true, "a paused player does not wait out first-watch grace");
stalledRecoveryContext.streamEarningHealthSnapshot = () => ({ healthy: false, videoPlaying: true });
assert.equal(stalledRecoveryContext.stalledProgressNeedsRecovery(), false, "an unhealthy but playing stream still honors first-watch grace");
const needsStreamContext = {
  settings: { findNextStream: true, queueEnabled: true, queueOnStall: true },
  currentDrop: { game: "Phasmophobia", currentMinutes: 91, requiredMinutes: 120, isClaimed: false },
  lastInventoryCampaigns: [],
  dropProgressComplete: () => false,
  campaignMarkedComplete: () => false,
  campaignExpirySnapshot: () => ({ ended: false }),
  stalledProgressNeedsRecovery: () => false,
  watchingLogin: () => "onlydropstv",
  readStreamInfo: () => ({ live: true, game: "Phasmophobia" }),
  gameNamesMatch: (expected, actual) => expected === actual,
};
vm.runInNewContext(
  `${source.slice(needsStreamStart, needsStreamEnd)}\nthis.activeDropNeedsStream = activeDropNeedsStream;`,
  needsStreamContext,
);
assert.equal(
  needsStreamContext.activeDropNeedsStream(),
  false,
  "a live matching earning stream is not reported as needing replacement",
);
needsStreamContext.stalledProgressNeedsRecovery = () => true;
assert.equal(
  needsStreamContext.activeDropNeedsStream(),
  true,
  "a live matching stream with stalled credited progress requires recovery",
);
needsStreamContext.stalledProgressNeedsRecovery = () => false;
needsStreamContext.readStreamInfo = () => ({ live: true, game: "Another Game" });
assert.equal(
  needsStreamContext.activeDropNeedsStream(),
  true,
  "a mismatched live stream still requires active-campaign routing",
);

const ensureStreamStart = source.indexOf("  function ensureActiveCampaignStream()");
const ensureStreamEnd = source.indexOf("\n  async function heartbeat", ensureStreamStart);
assert.notEqual(ensureStreamStart, -1, "active campaign recovery is present");
const transitions = [];
const navigations = [];
const ensureStreamContext = {
  activeDropNeedsStream: () => true,
  isAutoRoutingController: () => true,
  noteDeferredAutoRouting: () => {},
  needsCampaignPageImport: () => false,
  maybeImportOpenCampaignsFirst: () => false,
  currentDrop: {
    id: "drop-1",
    name: "Drop 1",
    game: "Phasmophobia",
    gameSlug: "phasmophobia",
    campaign: "Weekly Drops",
    campaignKey: "campaign-1",
  },
  watchingLogin: () => "onlydropstv",
  readStreamInfo: () => ({ live: true, game: "Phasmophobia" }),
  gameNamesMatch: (expected, actual) => expected === actual,
  stalledProgressNeedsRecovery: () => true,
  maybeRecoverCategoryMismatch: () => false,
  getHandoffState: () => null,
  // Mirror production: missing handoff objects default to checking-game.
  normalizedHandoffState: (pending) => pending?.state || pending?.stage || "checking-game",
  HANDOFF_STATES: { FINDING_STREAM: "finding-stream", SWITCHING: "switching", VERIFYING: "verifying", SELECTING_GAME: "selecting-game", CHECKING_GAME: "checking-game" },
  transitionHandoff: (...args) => { transitions.push(args); return args[1]; },
  setStatus: () => {},
  isTwitchHomepage: () => false,
  isTwitchSearchPage: () => false,
  continueHomepageCampaignHandoffFromDom: () => false,
  autoNavigateTwitch: (...args) => navigations.push(args),
  TWITCH_HOME_URL: "https://www.twitch.tv/",
  Date,
};
vm.runInNewContext(
  `${source.slice(ensureStreamStart, ensureStreamEnd)}\nthis.ensureActiveCampaignStream = ensureActiveCampaignStream;`,
  ensureStreamContext,
);
assert.equal(ensureStreamContext.ensureActiveCampaignStream(), true, "stalled matching progress starts a recovery handoff");
assert.equal(transitions[0][0], "finding-stream", "stalled progress enters stream discovery");
assert.equal(transitions[0][1].recoveryReason, "stalled-progress", "handoff records the stale-progress cause");
assert.match(transitions[0][2], /progress stalled/, "activity explains the stalled-progress recovery");
assert.deepEqual(navigations[0], ["https://www.twitch.tv/", "campaign-home-search"], "stalled progress restarts discovery from Twitch Home");

transitions.length = 0;
navigations.length = 0;
ensureStreamContext.readStreamInfo = () => ({ live: false, game: "" });
ensureStreamContext.stalledProgressNeedsRecovery = () => false;
ensureStreamContext.maybeRecoverCategoryMismatch = () => false;
ensureStreamContext.getHandoffState = () => null;
assert.equal(
  ensureStreamContext.ensureActiveCampaignStream(),
  true,
  "an idle tab with no handoff still starts Drop stream search on an offline channel",
);
assert.equal(transitions[0][0], "finding-stream", "null handoff does not masquerade as checking-game");
assert.equal(transitions[0][1].recoveryReason, "resume-active-campaign", "handoff records resume-active-campaign for unread categories");
assert.deepEqual(navigations[0], ["https://www.twitch.tv/", "campaign-home-search"], "unread-category recovery restarts from Twitch Home");

ensureStreamContext.getHandoffState = () => ({ state: "selecting-game", targetGame: "Phasmophobia" });
ensureStreamContext.normalizedHandoffState = () => "selecting-game";
transitions.length = 0;
navigations.length = 0;
assert.equal(ensureStreamContext.ensureActiveCampaignStream(), false, "selecting the next campaign is not restarted as the same stream search");
assert.equal(transitions.length, 0, "a selecting-game handoff is left intact");
assert.equal(navigations.length, 0, "selecting the next campaign does not navigate home");

ensureStreamContext.getHandoffState = () => null;
ensureStreamContext.normalizedHandoffState = (pending) => pending?.state || pending?.stage || "checking-game";
ensureStreamContext.isTwitchSearchPage = () => true;
ensureStreamContext.continueHomepageCampaignHandoffFromDom = () => {
  navigations.push(["search-continue"]);
  return true;
};
transitions.length = 0;
navigations.length = 0;
assert.equal(ensureStreamContext.ensureActiveCampaignStream(), true, "a leftover \/search page continues discovery instead of bouncing home");
assert.deepEqual(navigations[0], ["search-continue"], "\/search is reused for the target game query");
assert.equal(navigations.some((item) => item[1] === "campaign-home-search"), false, "\/search does not navigate back to Twitch Home");

ensureStreamContext.isTwitchSearchPage = () => false;
ensureStreamContext.continueHomepageCampaignHandoffFromDom = () => false;
ensureStreamContext.currentDrop = { ...ensureStreamContext.currentDrop, game: "Delta Force", campaign: "DF Streamer Ladder Drops" };
ensureStreamContext.getHandoffState = () => ({
  state: "finding-stream",
  targetGame: "Minecraft",
  targetCampaign: "Blue Creeper Boss Badge",
  lockActiveCampaign: true,
});
ensureStreamContext.normalizedHandoffState = () => "finding-stream";
ensureStreamContext.gameNamesMatch = (expected, actual) => String(expected || "").toLowerCase() === String(actual || "").toLowerCase();
transitions.length = 0;
navigations.length = 0;
assert.equal(
  ensureStreamContext.ensureActiveCampaignStream(),
  false,
  "Inventory snapping Working Toward back to Delta Force does not cancel a Minecraft hunt",
);
assert.equal(transitions.length, 0, "a locked sooner-campaign hunt is not reset to Delta Force");
assert.equal(navigations.length, 0, "a locked sooner-campaign hunt does not restart from Twitch Home");

assert.match(source, /if \(viewingListenersInstalled\) return;/, "viewing observers install once per page");
assert.match(source, /video\.readyState < 1/, "recovery does not act on an unready player");
assert.match(source, /recoveryAttempts >= 3/, "automatic playback recovery has a finite budget");
assert.match(source, /function installTwitchNetworkHooks/, "Dropper captures Twitch GQL traffic for Drop progress");
assert.match(source, /pageHook: twitchNetworkHookMode/, "diagnostics expose whether Safari installed the page GQL hook");
assert.match(source, /sessionPoll: lastSessionPoll/, "diagnostics expose the last session-minute poll");
assert.match(source, /function scopedSessionStorageKey/, "session state has an account-scoped key helper");
assert.match(source, /function scopedLocalStorageKey/, "persistent account state has an account-scoped key helper");
assert.match(source, /scopedLocalStorageKey\(CAMPAIGN_MEMORY_KEY\)/, "campaign completion memory is isolated per Twitch account");
assert.match(source, /new BroadcastChannel\(`\$\{TAB_CHANNEL_NAME\}:\$\{storageAccountSuffix\(\)\}`\)/, "multi-tab coordination is isolated per Twitch account");
assert.doesNotMatch(source, /AUTH_TOKEN_SESSION_KEY|loadScopedAuthToken|saveScopedAuthToken/, "manual token override storage is removed");
assert.doesNotMatch(source, /tdh-auth-token|tdh-save-auth-token|tdh-clear-auth-token/i, "manual token override UI is removed");
assert.doesNotMatch(source, /pastedAuthTokenPersistence|pasted-auth-token/, "manual token override diagnostics are removed");
assert.match(source, /return cookie\("auth-token"\);/, "Dropper authentication uses the active Twitch browser session");
assert.doesNotMatch(source, /localStorage\.getItem\(CAMPAIGN_MEMORY_KEY\) \|\| "\{\}"/, "campaign memory is not read directly from an unscoped key");
assert.match(source, /requestMode:\s*vars\?\.channelLogin \? "channel-login" : "unavailable"/, "session diagnostics identify login-only requests");
assert.match(source, /requestVariables:\s*vars \? Object\.keys\(vars\) : \[\]/, "session diagnostics expose request variable names");
assert.match(source, /hostname==="gql\.twitch\.tv"/, "network hooks only touch gql.twitch.tv");
assert.match(source, /ingestTwitchGqlRows/, "intercepted Inventory\/session payloads update Drop progress");
assert.match(source, /adoptCapturedIntegrity/, "Twitch's live Client-Integrity is reused for Dropper polls");
assert.match(source, /function cookie\(/, "Auth token still reads from Twitch cookies");

assert.match(source, /inventoryProgressPercents/, "Drop percent helper remains available");
assert.match(source, /\[data-test-selector='drops-list'\]/, "Drop percent reads stay scoped to Drops UI roots");
assert.match(source, /if \(isSyntheticWaitingDrop\(drop\)\) return;/, "applyDrop refuses synthetic Active drop placeholders");
assert.match(
  source,
  /!isSyntheticWaitingDrop\(drop\)\s*&&\s*isAutoRoutingController\(\)\s*\)\s*\{\s*applyDrop\(drop\);/s,
  "scanDrops refuses to apply synthetic placeholders",
);

const controllerStart = source.indexOf("  function routingSessionDefaults");
const controllerEnd = source.indexOf("\n  async function heartbeat()", controllerStart);
assert.notEqual(controllerStart, -1, "3.1 routing controller is present");
assert.notEqual(controllerEnd, -1, "3.1 routing controller block is complete");
const controllerSource = source.slice(controllerStart, controllerEnd);
assert.match(controllerSource, /ROUTING_STATES\.SELECT_CAMPAIGN/u, "controller owns campaign selection");
assert.match(controllerSource, /ROUTING_STATES\.FIND_STREAM/u, "controller owns stream discovery");
assert.match(controllerSource, /ROUTING_STATES\.VERIFY_STREAM/u, "controller owns stream verification");
assert.match(controllerSource, /ROUTING_STATES\.EARNING/u, "controller owns earning");
assert.match(controllerSource, /ROUTING_STATES\.CLAIM/u, "controller owns claiming");
assert.doesNotMatch(controllerSource, /setTimeout\(|setInterval\(/u, "routing uses deadlines rather than timer chains");

const heartbeatPollIndex = heartbeat.indexOf('await requestGqlPoll(pendingGqlReason || "heartbeat")');
const heartbeatControllerIndex = heartbeat.indexOf('routingControllerTick(Date.now(), "heartbeat")');
assert.ok(
  heartbeatPollIndex >= 0 && heartbeatControllerIndex > heartbeatPollIndex,
  "GQL data refresh completes before the routing controller evaluates navigation",
);
assert.doesNotMatch(
  heartbeat,
  /maybeAdvanceExpiredCampaign|maybeAdvanceStuckClaim|continueHomepageCampaignHandoffFromDom|continueToNextGame|ensureActiveCampaignStream|maybeRecoverCategoryMismatch/,
  "heartbeat does not invoke legacy routing loops",
);

const pollStart = source.indexOf("  async function pollGqlDrops()");
const pollEnd = source.indexOf("\n  function applyDrop(", pollStart);
const pollSource = source.slice(pollStart, pollEnd);
assert.doesNotMatch(
  pollSource,
  /verifyHandoff|transitionHandoff|HANDOFF_STATES|pendingHandoff|getHandoffState\(\)/,
  "GQL refresh is data-only and cannot invoke legacy routing",
);

const debugStart = source.indexOf("  function dropperDebugSnapshot()");
const debugEnd = source.indexOf("\n  function layoutChrome()", debugStart);
const debugSource = source.slice(debugStart, debugEnd);
assert.match(debugSource, /const routingSession = readRoutingControllerSession\(\);/u, "diagnostics read the 3.1 routing session");
assert.doesNotMatch(debugSource, /getHandoffState\(\)|legacyHandoff:/u, "diagnostics no longer depend on legacy handoff state");
assert.match(source, /removeSession\(NAVIGATION_GUARD_KEY\)/, "version upgrades clear stale reload-loop guard state");
assert.match(source, /function preferCurrentWinnableOpenDrop/, "campaign selection preserves a winnable active campaign");
assert.match(source, /dropMatchesLockedHandoff/, "Inventory progress cannot overwrite the controller-locked campaign");

const finishBeforeStart = source.indexOf("  function dropCanFinishBefore");
const finishBeforeEnd = source.indexOf("\n  function preferWinnableDrops", finishBeforeStart);
assert.notEqual(finishBeforeStart, -1, "drop finish-before helper is present");
const finishBeforeContext = {
  currentDrop: { remainingMinutes: 14 },
  CAMPAIGN_WINNABLE_BUFFER_MS: 3 * 60 * 1000,
};
vm.runInNewContext(
  `${source.slice(finishBeforeStart, finishBeforeEnd)}\nthis.canFinish = currentDropCanFinishBefore;\nthis.dropCanFinish = dropCanFinishBefore;`,
  finishBeforeContext,
);
const finishNow = Date.parse("2026-09-22T00:40:16.219Z");
assert.equal(
  finishBeforeContext.canFinish(Date.parse("2026-09-22T01:59:59.999Z"), finishNow),
  true,
  "14 minutes of Delta Force still finish before Mir Korabley ends",
);
assert.equal(
  finishBeforeContext.dropCanFinish({ remainingMinutes: 14 }, Date.parse("2026-09-22T01:59:59.999Z"), finishNow),
  true,
  "a leftover campaign pick can be tested for finish-before independently",
);
assert.equal(
  finishBeforeContext.canFinish(Date.parse("2026-09-22T00:50:00.000Z"), finishNow),
  false,
  "a campaign ending before the remaining watch time still wins the yield",
);
assert.match(source, /CAMPAIGN_WINNABLE_BUFFER_MS/, "winnable-window buffer constant is present");
assert.match(source, /function dropFitsCampaignWindow/, "winnable-window helper is present");
assert.match(source, /preferWinnableDrops/, "open and timed picks share a winnable-window preference helper");
assert.match(source, /clearStoredCurrentDrop/, "drop clears share one session helper");
assert.match(source, /HANDOFF_SESSION_TTL_MS/, "handoff expiry uses a named session TTL");
assert.doesNotMatch(source, /function isTwitchGqlUrl/, "unused outer GQL URL helper is removed");
assert.doesNotMatch(source, /function findInventoryStreamForGame/, "unused Inventory stream shortcut is removed");
assert.doesNotMatch(source, /HANDOFF_VERIFY_TIMEOUT_MS/, "unused 90s verify timeout constant is removed");

assert.match(
  source,
  /imageAssetURL: drop\?\.benefitEdges\?\.\[0\]\?\.benefit\?\.imageAssetURL \|\| ""/,
  "compacted campaign data preserves Twitch reward artwork for the visual contract",
);

console.log("Dropper diagnostic regression checks passed.");
