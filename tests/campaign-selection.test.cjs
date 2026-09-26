"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { loadDropperSource, loadActiveViewing } = require("./load-source.cjs");
const source = loadDropperSource();

const extractStart = source.indexOf("  function extractCampaignCatalog");
const extractEnd = source.indexOf("\n  function mergeCampaigns", extractStart);
const extractContext = {};
vm.runInNewContext(`${source.slice(extractStart, extractEnd)}\nthis.extract = extractCampaignCatalog;`, extractContext);

const dashboardPayload = {
  data: {
    currentUser: {
      dropCampaigns: [{
        id: "open-campaign",
        name: "Open Campaign",
        status: "ACTIVE",
        startAt: "2026-09-01T00:00:00Z",
        endAt: "2026-10-01T00:00:00Z",
        game: { id: "game-1", displayName: "Real Game", slug: "real-game" },
        timeBasedDrops: [{
          id: "open-drop",
          name: "Open Reward",
          requiredMinutesWatched: 60,
          self: { currentMinutesWatched: 10, isClaimed: false },
        }],
      }],
    },
  },
};

assert.equal(extractContext.extract(dashboardPayload).length, 1, "ViewerDropsDashboard campaign data is discovered recursively");

const mergeStart = source.indexOf("  function mergeCampaigns");
const mergeEnd = source.indexOf("\n  function compactCampaignCatalog", mergeStart);
const mergeContext = { campaignKey: (campaign) => String(campaign?.id || "") };
vm.runInNewContext(`${source.slice(mergeStart, mergeEnd)}\nthis.merge = mergeCampaigns;`, mergeContext);
const mergedCampaign = mergeContext.merge(dashboardPayload.data.currentUser.dropCampaigns, [{
  id: "open-campaign",
  game: { displayName: "Real Game" },
  timeBasedDrops: [{ id: "open-drop", self: { currentMinutesWatched: 20 } }],
}])[0];
assert.equal(mergedCampaign.status, "ACTIVE", "Inventory progress cannot erase the dashboard's active status");
assert.equal(mergedCampaign.game.slug, "real-game", "Inventory progress cannot erase the dashboard's canonical game slug");
assert.equal(mergedCampaign.timeBasedDrops[0].self.currentMinutesWatched, 20, "Inventory progress updates the selected dashboard campaign");

const catalogStart = source.indexOf("  function isPageCatalogSource");
const catalogEnd = source.indexOf("\n  function cookie", catalogStart);
const completedKeys = new Set();
const catalogStore = { value: null };
const catalogContext = {
  PAGE_STARTED_AT: 0,
  lastCampaignCatalog: [],
  lastCampaignCatalogAt: 0,
  lastInventoryCampaigns: [],
  campaignCatalogCache: { at: 0, campaigns: [] },
  haveSeenInventorySnapshot: false,
  lastInProgressKeys: new Set(),
  CAMPAIGN_CATALOG_KEY: "test-catalog",
  compactCampaignCatalog: (campaigns) => campaigns || [],
  mergeCampaigns: mergeContext.merge,
  campaignKey: (campaign) => String(campaign?.id || "").toLowerCase(),
  campaignTitleKey: (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase(),
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  rememberCategorySlug: () => {},
  writeSession: (key, value) => { catalogStore.value = value; },
  rememberCampaignStates: () => {},
  logActivity: () => {},
  markCampaignCompleted: (key) => completedKeys.add(key),
  campaignMarkedComplete: (key) => completedKeys.has(typeof key === "string" ? key : String(key?.id || "")),
  campaignRoutingState: (campaign, now = Date.now()) => {
    const startAt = campaign?.startAt || campaign?.campaignStartAt || "";
    const endAt = campaign?.endAt || campaign?.campaignEndAt || "";
    const startMs = Date.parse(startAt) || 0;
    const endMs = Date.parse(endAt) || 0;
    const key = String(campaign?.id || campaign?.campaignKey || campaign?.campaignId || "").toLowerCase();
    let reason = "open";
    if (!startMs || !endMs || endMs <= startMs) reason = "campaign-dates-unknown";
    else if (startMs > now) reason = "not-started";
    else if (endMs <= now) reason = "expired";
    return { key, startAt, endAt, startMs, endMs, windowKnown: Boolean(startMs && endMs && endMs > startMs), open: reason === "open", reason };
  },
  isPageScrapedCampaignKey: (key) => /^page:/i.test(String(key || "")),
};
vm.runInNewContext(
  `${source.slice(catalogStart, catalogEnd)}\nthis.replace=replaceCatalogFromDashboard;this.overlay=overlayKnownCampaignProgress;this.apply=applyInventorySnapshot;this.remember=rememberCampaignCatalog;`,
  catalogContext,
);
const dashboardOnly = dashboardPayload.data.currentUser.dropCampaigns;
const stale = {
  id: "stale-campaign",
  name: "Stale Campaign",
  status: "ACTIVE",
  game: { displayName: "Old Game", slug: "old-game" },
  timeBasedDrops: [{ id: "stale-drop", name: "Stale Reward", requiredMinutesWatched: 60, self: { currentMinutesWatched: 5 } }],
};
catalogContext.lastCampaignCatalog = [...dashboardOnly, stale];
catalogContext.replace(dashboardOnly);
assert.deepEqual(
  [...catalogContext.lastCampaignCatalog.map((campaign) => campaign.id)],
  ["open-campaign"],
  "the dashboard list replaces catalog membership instead of unioning stale campaigns",
);
catalogContext.lastInventoryCampaigns = [{
  id: "open-campaign",
  timeBasedDrops: [{ id: "open-drop", self: { currentMinutesWatched: 20 } }],
}];
catalogContext.replace(dashboardOnly);
assert.equal(
  catalogContext.lastCampaignCatalog[0].timeBasedDrops[0].self.currentMinutesWatched,
  20,
  "dashboard membership keeps Inventory progress for campaigns still on the dashboard",
);
catalogContext.lastCampaignCatalog = [];
catalogContext.lastCampaignCatalogAt = 0;
catalogContext.remember([{
  id: "page:marvel-rivals",
  name: "Marvel Rivals",
  status: "ACTIVE",
  game: { displayName: "Marvel Rivals", name: "Marvel Rivals", slug: "" },
  timeBasedDrops: [{ id: "page:marvel-rivals:drop", requiredMinutesWatched: 60, self: { currentMinutesWatched: 0 } }],
}]);
assert.equal(
  catalogContext.lastCampaignCatalog[0]?.id,
  "page:marvel-rivals",
  "an empty catalog can be filled from the All Campaigns page scrape",
);
catalogContext.replace(dashboardOnly);
assert.equal(
  catalogContext.lastCampaignCatalog.some((campaign) => campaign.id === "page:marvel-rivals"),
  true,
  "dashboard replace keeps All Campaigns page rows for games the dashboard omitted",
);
assert.equal(
  catalogContext.lastCampaignCatalog.some((campaign) => campaign.id === "open-campaign"),
  true,
  "dashboard replace still installs ViewerDropsDashboard membership",
);
catalogContext.remember([{
  id: "page:nba-2k27",
  name: "NBA 2K27",
  status: "ACTIVE",
  game: { displayName: "NBA 2K27", name: "NBA 2K27", slug: "" },
  timeBasedDrops: [{ id: "page:nba-2k27:drop", requiredMinutesWatched: 60, self: { currentMinutesWatched: 0 } }],
}], "campaigns-page-scroll");
assert.equal(
  catalogContext.lastCampaignCatalog.some((campaign) => campaign.id === "page:nba-2k27"),
  true,
  "All Campaigns page scrapes union new open campaigns into an existing catalog",
);
catalogContext.remember([{
  id: "inventory-only",
  name: "Not On Dashboard",
  status: "ACTIVE",
  game: { displayName: "Other Game" },
  timeBasedDrops: [{ id: "other-drop", requiredMinutesWatched: 15 }],
}]);
assert.equal(
  catalogContext.lastCampaignCatalog.some((campaign) => campaign.id === "inventory-only"),
  false,
  "recursive discovery cannot add campaigns that are not on the dashboard",
);

const catalogBeforeFallback = catalogContext.lastCampaignCatalog.map((campaign) => campaign.id);
catalogContext.remember([{
  id: "open-campaign",
  name: "Open Campaign",
  status: "ACTIVE",
  game: { displayName: "Real Game" },
  timeBasedDrops: [{ id: "open-drop", self: { currentMinutesWatched: 35 } }],
}], "campaign-auth-import-inventory-fallback");
assert.deepEqual(
  [...catalogContext.lastCampaignCatalog.map((campaign) => campaign.id)],
  catalogBeforeFallback,
  "Inventory fallback overlays known progress without shrinking dashboard or All Campaigns membership",
);
assert.equal(
  catalogContext.lastCampaignCatalog.find((campaign) => campaign.id === "open-campaign")?.timeBasedDrops?.[0]?.self?.currentMinutesWatched,
  35,
  "Inventory fallback still updates authoritative progress for matching catalog campaigns",
);
const catalogBeforeEmptyInventory = catalogContext.lastCampaignCatalog;
catalogContext.apply([]);
assert.equal(catalogContext.lastCampaignCatalog, catalogBeforeEmptyInventory, "an empty Inventory snapshot cannot wipe dashboard-only campaigns");
catalogContext.apply([{
  id: "open-campaign",
  name: "Open Campaign",
  status: "ACTIVE",
  startAt: "2026-09-01T00:00:00Z",
  endAt: "2026-10-01T00:00:00Z",
  game: { displayName: "Real Game" },
  timeBasedDrops: [{ id: "open-drop", self: { currentMinutesWatched: 30 } }],
}]);
catalogContext.apply([]);
assert.equal(completedKeys.has("open-campaign"), false, "a campaign leaving one Inventory snapshot is not treated as completion proof");

const pickerStart = source.indexOf("  function requiresSubscription");
const pickerEnd = source.indexOf("\n  function maybeAdvanceExpiredCampaign", pickerStart);
const activeViewing = loadActiveViewing();
const pickerContext = {
  DropperActiveViewing: activeViewing,
  dropperPreconditionsMet: (drop, drops) => activeViewing.planPrerequisites(drop, drops).ready,
  campaignPriority: () => 0,
  EXCLUDED_CATEGORY_SLUGS: new Set(["first-partners-collection"]),
  EXCLUDED_CAMPAIGN_NAMES: new Set(["first partners collection"]),
  CAMPAIGN_WINNABLE_BUFFER_MS: 3 * 60 * 1000,
  CAMPAIGN_SHELL_MIN_WINDOW_MS: 15 * 60 * 1000,
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  normalizeGameName: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  normalizedGameSlug: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  dropProgressPercent: (current, required) => required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0,
  dropProgressComplete: (drop) => {
    if (!drop) return false;
    if (drop.needsDropDetails) return false;
    if (drop.isClaimed) return true;
    const current = Number(drop.currentMinutes);
    const required = Number(drop.requiredMinutes);
    if (Number.isFinite(current) && Number.isFinite(required) && required > 0) {
      return current >= required;
    }
    return Number(drop.percent || 0) >= 100;
  },
  currentDrop: null,
  isSyntheticWaitingDrop: () => false,
  lastInventoryCampaigns: [],
  campaignMarkedComplete: () => false,
  campaignGameIsIgnored: () => false,
  normalizeExcludedCampaignKeys: (keys = []) => [...new Set((keys || []).map((key) => String(key || "").toLowerCase()).filter(Boolean))],
  campaignWatchDrops: (campaign) => (campaign?.timeBasedDrops || campaign?.drops || []).filter((drop) => (
    !(Number(drop?.requiredSubs || 0) > 0) && Number(drop?.requiredMinutesWatched || 0) > 0
  )),
  campaignWatchDropsComplete: (campaign) => {
    const drops = (campaign?.timeBasedDrops || campaign?.drops || []).filter((drop) => (
      !(Number(drop?.requiredSubs || 0) > 0) && Number(drop?.requiredMinutesWatched || 0) > 0
    ));
    return Boolean(drops.length && drops.every((drop) => {
      const required = Number(drop?.requiredMinutesWatched || 0);
      const current = Number(drop?.self?.currentMinutesWatched || 0);
      return Boolean(drop?.self?.isClaimed) || current >= required;
    }));
  },
  markCampaignCompleted: () => false,
  markCampaignCompleteIfWatchDone: (campaign) => {
    const drops = (campaign?.timeBasedDrops || campaign?.drops || []).filter((drop) => (
      !(Number(drop?.requiredSubs || 0) > 0) && Number(drop?.requiredMinutesWatched || 0) > 0
    ));
    if (!drops.length) return false;
    const complete = drops.every((drop) => {
      const required = Number(drop?.requiredMinutesWatched || 0);
      const current = Number(drop?.self?.currentMinutesWatched || 0);
      return Boolean(drop?.self?.isClaimed) || current >= required;
    });
    return complete;
  },
};
vm.runInNewContext(
  `${source.slice(pickerStart, pickerEnd)}\nthis.pick = pickNextOpenCampaignDrop;this.isOpen = campaignIsOpen;this.isRoutingOpen = campaignIsRoutingOpen;this.routingState = campaignRoutingState;this.pickRemaining = pickRemainingGameDrop;this.pickTimed = pickTimedDrop;this.fitsWindow = dropFitsCampaignWindow;this.findCampaign = findCampaignForDrop;`,
  pickerContext,
);

const open = dashboardPayload.data.currentUser.dropCampaigns[0];
const expiredStatus = { ...open, id: "expired", name: "Expired", status: "EXPIRED" };
const subscription = {
  ...open,
  id: "subscription",
  name: "Subscription",
  timeBasedDrops: [{ ...open.timeBasedDrops[0], id: "sub-drop", requiredSubs: 1 }],
};
const invalidCategory = {
  ...open,
  id: "invalid-category",
  name: "First Partners Collection",
  game: { displayName: "First Partners Collection", slug: "first-partners-collection" },
};
const completed = {
  ...open,
  id: "completed",
  name: "Completed Campaign",
  timeBasedDrops: [{
    ...open.timeBasedDrops[0],
    id: "completed-drop",
    self: { currentMinutesWatched: 60, isClaimed: false },
  }],
};

const memoryStart = source.indexOf("  function loadCampaignMemory");
const memoryEnd = source.indexOf("\n  function rememberCampaignCatalog", memoryStart);
const memoryStore = new Map();
const memoryContext = {
  CAMPAIGN_MEMORY_KEY: "test-campaign-memory",
  CAMPAIGN_MEMORY_RETENTION_MS: 90 * 24 * 60 * 60 * 1000,
  localStorage: {
    getItem: (key) => memoryStore.get(key) || null,
    setItem: (key, value) => memoryStore.set(key, value),
  },
  campaignMemory: { updatedAt: 0, campaigns: {} },
  campaignKey: (campaign) => String(campaign?.id || ""),
  campaignTitleKey: (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase(),
  campaignIsOpen: () => true,
  requiresSubscription: (drop) => Number(drop?.requiredSubs || 0) > 0,
  cleanText: (value) => String(value || "").trim(),
  logActivity: () => {},
  isPageScrapedCampaignKey: (key) => /^page:/i.test(String(key || "")),
};
vm.runInNewContext(`${source.slice(memoryStart, memoryEnd)}\nthis.rememberStates=rememberCampaignStates;this.marked=campaignMarkedComplete;`, memoryContext);
memoryContext.rememberStates([open], "test-open");
assert.equal(memoryContext.campaignMemory.campaigns["open-campaign"].startAt, open.startAt, "campaign memory keeps the active start date");
assert.equal(memoryContext.campaignMemory.campaigns["open-campaign"].endAt, open.endAt, "campaign memory keeps the active end date");
assert.equal(memoryContext.marked(open), false, "unfinished campaign memory remains open");
memoryContext.rememberStates([{ ...open, timeBasedDrops: [{ ...open.timeBasedDrops[0], self: { currentMinutesWatched: 60, isClaimed: false } }] }], "test-complete");
assert.equal(memoryContext.marked(open), true, "earning every watch-time drop permanently marks the campaign complete");

assert.equal(pickerContext.isOpen(open, null, Date.parse("2026-09-19T00:00:00Z")), true, "ACTIVE campaigns inside their date window are open");
assert.equal(pickerContext.isOpen(expiredStatus, null, Date.parse("2026-09-19T00:00:00Z")), false, "Twitch EXPIRED campaigns are not open even if their dates overlap");
assert.equal(
  pickerContext.isRoutingOpen(open, Date.parse("2026-09-19T00:00:00Z")),
  true,
  "routing accepts a campaign only while its verified campaign date window is open",
);
assert.equal(
  pickerContext.isRoutingOpen({ ...open, id: "undated", startAt: "", endAt: "" }, Date.parse("2026-09-19T00:00:00Z")),
  false,
  "routing rejects campaigns whose campaign dates are unknown",
);
assert.equal(
  pickerContext.routingState({ ...open, id: "undated", startAt: "", endAt: "" }, Date.parse("2026-09-19T00:00:00Z")).reason,
  "campaign-dates-unknown",
  "unknown campaign dates have an explicit routing rejection reason",
);
assert.equal(
  pickerContext.routingState({ ...open, id: "future", startAt: "2026-10-02T00:00:00Z", endAt: "2026-10-03T00:00:00Z" }, Date.parse("2026-09-19T00:00:00Z")).reason,
  "not-started",
  "future campaigns cannot route before their start date",
);
assert.equal(
  pickerContext.routingState({ ...open, id: "memory-open", status: "OPEN" }, Date.parse("2026-09-19T00:00:00Z")).open,
  true,
  "persisted campaign-memory OPEN status remains routable while its dates are active",
);
assert.equal(
  pickerContext.routingState({ ...open, id: "ended-by-date", startAt: "2026-09-01T00:00:00Z", endAt: "2026-09-18T23:59:59Z" }, Date.parse("2026-09-19T00:00:00Z")).reason,
  "expired",
  "campaigns cannot route after their campaign end date",
);
const selected = pickerContext.pick([expiredStatus, subscription, invalidCategory, completed, open]);
assert.equal(selected?.campaignId, "open-campaign", "selection chooses the open unfinished watch-time campaign");
assert.equal(selected?.gameSlug, "real-game", "selection keeps Twitch's canonical game slug for stream routing");
assert.equal(pickerContext.pick([completed]), null, "completed-but-unclaimed rewards are not selected as watch targets");

const soonShellEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
const laterDetailedEnd = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
const soonShell = {
  id: "soon-shell",
  name: "Ending Soon Shell",
  status: "ACTIVE",
  startAt: "2026-09-20T00:00:00Z",
  endAt: soonShellEnd,
  game: { id: "soon", displayName: "Soon Game", slug: "soon-game" },
  timeBasedDrops: [],
};
const laterDetailed = {
  ...open,
  id: "later-detailed",
  name: "Later Detailed",
  startAt: "2026-09-20T00:00:00Z",
  endAt: laterDetailedEnd,
  game: { id: "later", displayName: "Later Game", slug: "later-game" },
};
const shellPick = pickerContext.pick([laterDetailed, soonShell]);
assert.equal(shellPick?.campaignId, "soon-shell", "ending-soonest shell campaigns beat later detailed Inventory rows");
assert.equal(shellPick?.needsDropDetails, true, "shell campaigns are marked as needing drop details");
assert.equal(shellPick?.game, "Soon Game", "shell campaign selection keeps the game name for stream search");
assert.ok(Number(shellPick?.endMs) < Number.MAX_SAFE_INTEGER, "open campaign picks expose endMs for sooner-campaign handoff");

pickerContext.isPageScrapedCampaignKey = (key) => /^page:/i.test(String(key || ""));
vm.runInNewContext(
  `${source.slice(pickerStart, pickerEnd)}\nthis.queue = listOpenCampaignQueue;this.pickRemaining = pickRemainingGameDrop;`,
  pickerContext,
);
const queueNow = Date.now();
const undatedPage = {
  id: "page:pokemon",
  name: "Pokémon",
  status: "ACTIVE",
  game: { displayName: "Pokémon", slug: "pokemon" },
  startAt: "",
  endAt: "",
  timeBasedDrops: [{ id: "page:pokemon:drop", requiredMinutesWatched: 60, self: { currentMinutesWatched: 0 } }],
};
const datedPage = {
  id: "page:minecraft",
  name: "Blue Creeper Boss Badge",
  status: "ACTIVE",
  startAt: "2026-09-17T18:00:00Z",
  endAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  game: { displayName: "Minecraft", slug: "minecraft" },
  timeBasedDrops: [{ id: "page:minecraft:drop", requiredMinutesWatched: 60, self: { currentMinutesWatched: 0 } }],
};
const openQueue = pickerContext.queue([laterDetailed, undatedPage, datedPage, soonShell], queueNow);
assert.equal(
  openQueue.some((item) => item.key === "page:pokemon"),
  false,
  "undated page scrapes are excluded from the open campaign queue",
);
assert.equal(
  openQueue.some((item) => item.key === "page:minecraft"),
  true,
  "dated page scrapes remain eligible for ending-soonest ordering",
);
assert.equal(openQueue[0]?.key, "soon-shell", "open queue still orders by ending soonest after filtering undated page scrapes");

const laterEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
const soonerEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const dawnwalkerRemaining = {
  ...open,
  id: "dawnwalker-launch",
  name: "Dawnwalker Launch",
  startAt: "2026-09-03T00:00:00Z",
  endAt: laterEnd,
  game: { id: "dawn", displayName: "The Blood of Dawnwalker", slug: "dawnwalker" },
  timeBasedDrops: [
    {
      id: "dawn-drop-1",
      name: "Drop",
      requiredMinutesWatched: 60,
      self: { currentMinutesWatched: 60, isClaimed: false },
    },
    {
      id: "dawn-drop-2",
      name: "Drop 2",
      requiredMinutesWatched: 60,
      self: { currentMinutesWatched: 0, isClaimed: false },
    },
  ],
};
const eternalSoon = {
  id: "eternal-return-0921",
  name: "MID SEASON DROPS [0921]",
  status: "ACTIVE",
  startAt: "2026-09-20T20:00:00Z",
  endAt: soonerEnd,
  game: { id: "er", displayName: "Eternal Return", slug: "eternal-return" },
  timeBasedDrops: [{
    id: "er-drop",
    name: "Season Badge",
    requiredMinutesWatched: 60,
    self: { currentMinutesWatched: 0, isClaimed: false },
  }],
};
const remainingDawn = pickerContext.pickRemaining(
  [dawnwalkerRemaining, eternalSoon],
  "The Blood of Dawnwalker",
  "dawn-drop-1",
  "Drop",
);
const soonestOverall = pickerContext.pick([dawnwalkerRemaining, eternalSoon]);
assert.equal(remainingDawn?.campaignId, "dawnwalker-launch", "same-game continuation still finds the next Dawnwalker Drop");
assert.ok(Number(remainingDawn?.endMs) > Number(soonestOverall?.endMs), "remaining same-game Drop keeps a later endMs than ending-soonest");
assert.equal(soonestOverall?.campaignId, "eternal-return-0921", "global ending-soonest prefers Eternal Return over remaining Dawnwalker");

const mirSoonEnd = new Date(Date.now() + 72 * 60 * 1000).toISOString();
const deltaLaterEnd = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
const mirKorableySoon = {
  id: "lestakorabli-26-9-8",
  name: "Lestakorabli - 26.9 #8",
  status: "ACTIVE",
  startAt: "2026-09-21T14:00:00Z",
  endAt: mirSoonEnd,
  game: { id: "mir", displayName: "Mir Korabley", slug: "world-of-warships" },
  timeBasedDrops: [{
    id: "mir-drop",
    name: "Drop",
    requiredMinutesWatched: 60,
    self: { currentMinutesWatched: 0, isClaimed: false },
  }],
};
const deltaForceInProgress = {
  id: "df-streamer-ladder",
  name: "DF Streamer Ladder Drops",
  status: "ACTIVE",
  startAt: "2026-09-22T00:00:00Z",
  endAt: deltaLaterEnd,
  game: { id: "1282866981", displayName: "Delta Force", slug: "delta-force-hawk-ops" },
  timeBasedDrops: [{
    id: "armament-voucher",
    name: "Armament Voucher",
    requiredMinutesWatched: 15,
    self: { currentMinutesWatched: 1, isClaimed: false },
  }],
};
assert.equal(
  pickerContext.pick([mirKorableySoon, deltaForceInProgress])?.campaignId,
  "lestakorabli-26-9-8",
  "without a current Drop, ending-soonest Mir Korabley still wins campaign-audit",
);
pickerContext.currentDrop = {
  id: "armament-voucher",
  campaignId: "df-streamer-ladder",
  campaignKey: "df-streamer-ladder",
  campaign: "DF Streamer Ladder Drops",
  game: "Delta Force",
  currentMinutes: 1,
  requiredMinutes: 15,
  remainingMinutes: 14,
  percent: 7,
  isClaimed: false,
  campaignEndAt: deltaLaterEnd,
};
assert.equal(
  pickerContext.pick([mirKorableySoon, deltaForceInProgress])?.campaignId,
  "df-streamer-ladder",
  "a winnable in-progress campaign stays selected until its watch-time Drops are finished",
);
const yesterdayDf = {
  id: "df-yesterday",
  name: "DF Streamer Ladder Drops",
  status: "ACTIVE",
  startAt: "2026-09-21T00:00:00Z",
  endAt: "2026-09-21T23:59:59.999Z",
  game: { displayName: "Delta Force" },
};
const todayDf = {
  id: "d8710c01-432e-463c-b132-b9078567f2f5",
  name: "DF Streamer Ladder Drops",
  status: "ACTIVE",
  startAt: "2026-09-22T00:00:00Z",
  endAt: "2026-09-22T23:59:59.999Z",
  game: { displayName: "Delta Force" },
};
assert.equal(
  pickerContext.findCampaign([yesterdayDf, todayDf], {
    campaignId: "d8710c01-432e-463c-b132-b9078567f2f5",
    campaign: "DF Streamer Ladder Drops",
    game: "Delta Force",
    campaignEndAt: "2026-09-22T23:59:59.999Z",
  })?.id,
  "d8710c01-432e-463c-b132-b9078567f2f5",
  "expiry matches today's repeating campaign by id, not yesterday's same name",
);
assert.equal(
  pickerContext.findCampaign([yesterdayDf], {
    campaignId: "d8710c01-432e-463c-b132-b9078567f2f5",
    campaign: "DF Streamer Ladder Drops",
    game: "Delta Force",
    campaignEndAt: "2026-09-22T23:59:59.999Z",
  }),
  null,
  "an expired same-name campaign does not mark today's live Drop as ended",
);
pickerContext.currentDrop = null;

const unwinnableEnd = new Date(Date.now() + 19 * 60 * 1000).toISOString();
const winnableLaterEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const msfUnwinnable = {
  id: "msf-unwinnable",
  name: "Marvel Strike Force Ends Soon",
  status: "ACTIVE",
  startAt: "2026-09-20T00:00:00Z",
  endAt: unwinnableEnd,
  game: { id: "msf", displayName: "MARVEL STRIKE FORCE", slug: "marvel-strike-force" },
  timeBasedDrops: [{
    id: "msf-drop",
    name: "MSF Badge",
    requiredMinutesWatched: 60,
    self: { currentMinutesWatched: 5, isClaimed: false },
  }],
};
const phasmoWinnable = {
  id: "phasmo-winnable",
  name: "Phasmophobia Weekend",
  status: "ACTIVE",
  startAt: "2026-09-20T00:00:00Z",
  endAt: winnableLaterEnd,
  game: { id: "phasmo", displayName: "Phasmophobia", slug: "phasmophobia" },
  timeBasedDrops: [{
    id: "phasmo-drop",
    name: "Ghost Badge",
    requiredMinutesWatched: 30,
    self: { currentMinutesWatched: 10, isClaimed: false },
  }],
};
const winnablePick = pickerContext.pick([msfUnwinnable, phasmoWinnable]);
assert.equal(winnablePick?.campaignId, "phasmo-winnable", "open-campaign pick skips drops that cannot finish before campaign end");
assert.equal(
  pickerContext.fitsWindow({
    remainingMinutes: 55,
    endMs: Date.now() + 19 * 60 * 1000,
  }),
  false,
  "55 minutes remaining does not fit a 19-minute campaign window with buffer",
);
assert.equal(
  pickerContext.fitsWindow({
    remainingMinutes: 20,
    endMs: Date.now() + 2 * 60 * 60 * 1000,
  }),
  true,
  "20 minutes remaining fits a multi-hour campaign window",
);
assert.equal(
  pickerContext.pickTimed([msfUnwinnable, phasmoWinnable], "")?.campaignId,
  "phasmo-winnable",
  "pickTimedDrop prefers winnable open campaigns",
);
assert.equal(
  pickerContext.pickTimed([msfUnwinnable], "MARVEL STRIKE FORCE")?.campaignId,
  "msf-unwinnable",
  "same-game timed pick still returns the only option when nothing else is winnable",
);

const tightShellEnd = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const tightShell = {
  id: "tight-shell",
  name: "Tight Shell",
  status: "ACTIVE",
  startAt: "2026-09-20T00:00:00Z",
  endAt: tightShellEnd,
  game: { id: "tight", displayName: "Tight Game", slug: "tight-game" },
  timeBasedDrops: [],
};
assert.equal(
  pickerContext.pick([tightShell, phasmoWinnable])?.campaignId,
  "phasmo-winnable",
  "catalog shells with under 15 minutes left yield to winnable detailed campaigns",
);

assert.match(source, /maybeAbandonUnwinnableActiveDrop/, "active drops that cannot finish before end are abandoned");
assert.match(source, /remainingUnwinnable/, "CHECKING_GAME yields same-game continuation when remaining work cannot finish in time");
assert.match(source, /Cannot Finish In Time/, "unwinnable routing surfaces a Cannot Finish In Time status");
assert.match(source, /maybeYieldToSoonerOpenCampaign/, "active campaigns yield to a different campaign that ends sooner");
assert.match(source, /yieldedToSoonerCampaign/, "sooner-campaign yield is labeled on the handoff session");
assert.match(source, /markCampaignCompleteIfWatchDone/, "finished watch-time progress marks campaigns complete for routing");
assert.match(source, /claim-ready-progress/, "claim-ready advances mark finished campaigns complete without claiming");
assert.match(source, /watch-progress-complete/, "campaigns with finished watch-time drops are marked complete while unclaimed");
assert.doesNotMatch(source, /ROUTING_EXCLUDE_KEY/, "durable skip-this-game routing exclusions are not used");
assert.doesNotMatch(source, /rememberRoutingExcludedCampaigns/, "routing does not persist a hardcoded game skip list");

pickerContext.campaignMarkedComplete = (campaign) => campaign.id === "open-campaign";
assert.equal(pickerContext.pick([open]), null, "persistently completed campaigns are never selected again");

const sameGameCampaign = {
  ...open,
  id: "mcoc-campaign",
  name: "September Week 3",
  game: { id: "mcoc", displayName: "MARVEL Contest of Champions", slug: "marvel-contest-of-champions" },
  timeBasedDrops: [
    {
      id: "drop-done",
      name: "Finished Badge",
      requiredMinutesWatched: 30,
      self: { currentMinutesWatched: 30, isClaimed: false },
    },
    {
      id: "drop-next",
      name: "Drop 1 - PRG Gated Signature Stones",
      requiredMinutesWatched: 30,
      preconditionDrops: [{ id: "drop-done", requiresClaim: false }],
      self: { currentMinutesWatched: 0, isClaimed: false },
    },
  ],
};
const remainingSameGame = pickerContext.pickRemaining(
  [sameGameCampaign],
  "MARVEL Contest of Champions",
  "drop-done",
  "Finished Badge",
);
assert.equal(remainingSameGame?.id, "drop-next", "same-game continuation honors an explicit completed prerequisite requirement");
assert.equal(remainingSameGame?.campaignKey || remainingSameGame?.campaignId, "mcoc-campaign", "same-game continuation keeps campaign identity");
assert.equal(remainingSameGame?.requiredMinutes, 30, "same-game continuation preserves watch requirements");
assert.equal(
  pickerContext.pickRemaining([sameGameCampaign], "MARVEL Contest of Champions", "drop-done", "Finished Badge",)?.game,
  "MARVEL Contest of Champions",
  "same-game continuation stays on the completed Drop's game",
);
const competingSameGameCampaign = {
  ...sameGameCampaign,
  id: "mcoc-other-campaign",
  name: "Another MCOC Campaign",
  timeBasedDrops: [{
    id: "other-drop",
    name: "Other Campaign Reward",
    requiredMinutesWatched: 5,
    self: { currentMinutesWatched: 0, isClaimed: false },
  }],
};
const campaignScopedRemaining = pickerContext.pickRemaining(
  [competingSameGameCampaign, sameGameCampaign],
  "MARVEL Contest of Champions",
  "drop-done",
  "Finished Badge",
  "mcoc-campaign",
);
assert.equal(
  campaignScopedRemaining?.campaignKey || campaignScopedRemaining?.campaignId,
  "mcoc-campaign",
  "remaining-Drop selection stays inside the current campaign even when another campaign uses the same game",
);
assert.match(source, /if \(isCampaigns\(\) \|\| isInventory\(\)\) return true;/, "Drops pages request ViewerDropsDashboard on Dropper polls");
assert.match(source, /lastCampaignDashboardAt >= auditStartedAt/, "campaign audit waits for ViewerDropsDashboard");
assert.match(source, /replaceCatalogFromDashboard\(dashboardCampaigns, "viewer-drops-dashboard"\)/, "Dropper polls replace catalog membership from ViewerDropsDashboard");
assert.match(source, /op: "viewerDropsDashboard"/, "campaign dashboard is fetched by Dropper instead of page fetch intercept");
assert.match(source, /status !== "ACTIVE" && status !== "TEST"/, "campaign selection follows Twitch's active-status contract");

const slugFallbackStart = source.indexOf("  function campaignGameSlugFallback");
const slugFallbackEnd = source.indexOf("\n  function rememberCategorySlug", slugFallbackStart);
const slugFallbackContext = {
  EXCLUDED_CATEGORY_SLUGS: new Set(["first-partners-collection"]),
  EXCLUDED_CAMPAIGN_NAMES: new Set(["first partners collection"]),
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  normalizeGameName: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  normalizedGameSlug: (value) => String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
};
vm.runInNewContext(`${source.slice(slugFallbackStart, slugFallbackEnd)}\nthis.fallback = campaignGameSlugFallback;`, slugFallbackContext);
assert.equal(
  slugFallbackContext.fallback({ gameId: "1813168901", game: "LEGO Batman: Legacy of the Dark Knight" }),
  "lego-batman-legacy-of-the-dark-knight",
  "a Twitch campaign game ID authorizes a normalized category fallback",
);
assert.equal(slugFallbackContext.fallback({ game: "LEGO Batman: Legacy of the Dark Knight" }), "", "an unverified game name cannot create a route");
assert.equal(slugFallbackContext.fallback({ gameId: "bad", game: "First Partners Collection" }), "", "the explicit invalid category remains blocked even with an ID");

const slugMatchStart = source.indexOf("  function expectedCategorySlugCandidates");
const slugMatchEnd = source.indexOf("\n  function campaignGameSlugFallback", slugMatchStart);
assert.notEqual(slugMatchStart, -1, "category slug candidate helper is present");
assert.notEqual(slugMatchEnd, -1, "category slug match helpers are complete");
const slugMatchContext = {
  CATEGORY_SLUG_ALIASES: {
    "the blood of dawnwalker": "dawnwalker",
    "delta force": "delta-force-hawk-ops",
  },
  categorySlugCache: {},
  categorySlugFromUrl: () => "",
  normalizeGameName: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  normalizedGameSlug: (value) => String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
};
vm.runInNewContext(
  `${source.slice(slugMatchStart, slugMatchEnd)}\nthis.covers = categorySlugCoversGame;\nthis.matches = suppliedCategorySlugMatchesGame;`,
  slugMatchContext,
);
assert.equal(slugMatchContext.covers("Delta Force", "delta-force-hawk-ops"), true, "Twitch's Delta Force slug is accepted");
assert.equal(slugMatchContext.matches("Delta Force", "delta-force-hawk-ops"), true, "GQL-supplied hawk-ops matches Delta Force");
assert.equal(slugMatchContext.covers("Phasmophobia", "delta-force-hawk-ops"), false, "another game cannot claim the Delta Force slug");
assert.equal(slugMatchContext.covers("Minecraft", "minecraft"), true, "Minecraft's own slug covers the game name");
assert.match(source, /"delta force": "delta-force-hawk-ops"/, "Delta Force keeps a canonical Twitch category alias");
assert.match(source, /"twitch-gql"/, "Twitch GQL category slugs are trusted observations");
assert.match(source, /source === "twitch-campaign-game-id"/, "derived game-name slugs do not overwrite a more specific Twitch slug");

const handoffStart = source.indexOf("  function continueToNextGame");
const handoffEnd = source.indexOf("\n  function parseSessionDrop", handoffStart);
const handoffSource = source.slice(handoffStart, handoffEnd);
const campaignAudit = handoffSource.indexOf('auditStage: "campaigns"');
const openCampaignPick = handoffSource.indexOf("const selectedOpenDrop = pickNextOpenCampaignDrop");
const inventoryAudit = handoffSource.indexOf('auditStage: "inventory"');
const pageCampaignSkip = handoffSource.indexOf("Page campaign");
const homepageRoute = handoffSource.indexOf('autoNavigateTwitch(TWITCH_HOME_URL, "campaign-home-search")');
const inventoryConfirmedHome = handoffSource.indexOf("Inventory confirmed");
assert.ok(campaignAudit >= 0 && campaignAudit < openCampaignPick, "the campaign catalog loads before an open campaign is picked");
assert.ok(openCampaignPick >= 0 && openCampaignPick < inventoryAudit, "an open campaign is picked before reviewing Inventory");
assert.ok(pageCampaignSkip >= 0 && pageCampaignSkip < inventoryAudit, "page scrapes skip Inventory before the Inventory audit stage");
assert.ok(inventoryAudit >= 0 && inventoryConfirmedHome > inventoryAudit, "Inventory review completes before the Twitch Home visit for real campaigns");
assert.ok(homepageRoute >= 0, "Twitch Home remains the stream-search entry point");
assert.match(handoffSource, /is complete in Inventory · picking next open campaign/, "a completed campaign restarts the open-campaign cycle");
assert.doesNotMatch(handoffSource, /findInventoryStreamForGame\(next\.game\)/, "Inventory cannot shortcut directly to a stream");
assert.doesNotMatch(handoffSource, /gameDirectoryUrl\(next\)/, "campaign selection cannot shortcut to a category directory");
assert.match(source, /function maybeAbandonCompletedActiveDrop/, "completed active campaigns are abandoned so open All Campaigns rows can be selected");
assert.match(source, /function unionCampaignCatalog/, "All Campaigns scrapes union into the saved catalog");
assert.match(source, /preservedPageCampaigns/, "ViewerDropsDashboard replace preserves page-scraped open campaigns");
assert.match(source, /function maybeImportOpenCampaignsFirst/, "Dropper imports All Campaigns before earning");
assert.match(source, /Importing every open All Campaigns row before earning/, "campaign audit still imports when no fresh catalog exists");
assert.match(source, /const importReady = hasFreshCampaignPageImport\(\)/, "campaign audit checks for a fresh import before waiting on scroll");
assert.match(
  source,
  /Using fresh campaign import \(\$\{importedOpenCampaignCount\(\)\} open\)/,
  "campaign audit selects immediately when GQL\/page import is already fresh",
);
assert.doesNotMatch(
  handoffSource,
  /auditAge < PAGE_CAMPAIGN_IMPORT_WAIT_MS \|\| campaignsPageEnrichmentPromise/,
  "campaign audit no longer blocks forever on a running accordion scroll promise",
);
assert.match(source, /PAGE_CAMPAIGN_IMPORT_MIN/, "page import requires a full open-campaign scrape threshold");
assert.match(source, /function detectCampaignsPageDisplay/, "All Campaigns display mode is detected before scraping");
assert.match(source, /CAMPAIGN_PAGE_DISPLAY/, "campaign page display modes are enumerated");
assert.match(source, /PAGE_CAMPAIGN_IMPORT_EMPTY_TTL_MS/, "empty All Campaigns views use a short import TTL");
assert.match(source, /pageImportDisplay/, "diagnostics expose which All Campaigns display was imported");
assert.match(source, /pageDisplay:/, "diagnostics expose the live All Campaigns display probe");
assert.match(source, /function importOpenCampaignsViaAuth/, "authenticated GQL imports open campaigns per account");
assert.match(source, /tdh-refresh-campaign-data/, "Diagnostics can trigger an authenticated campaign refresh");
assert.match(source, /Refresh Campaign Data/, "manual campaign recovery lives in Diagnostics");
assert.match(source, /tdh-twitch-login/, "Drops settings can open Twitch login when the session is missing");
assert.match(source, /Twitch Login Required/, "signed-out users see a compact login-required row");
assert.doesNotMatch(source, /tdh-import-campaigns-auth/, "Drops no longer shows a permanent campaign-import card");
assert.doesNotMatch(source, /Import Open Campaigns/, "primary Drops action is Inventory, not campaign import");
assert.match(source, /TWITCH_LOGIN_URL/, "Twitch login page is linked for signed-out users");
assert.match(source, /DropCampaignDetails/, "campaign details enrichment uses Twitch DropCampaignDetails");
assert.match(source, /CAMPAIGN_PAGE_DISPLAY\.GQL_AUTH/, "GQL auth imports are tracked as a display mode");
assert.match(source, /CAMPAIGN_PAGE_DISPLAY\.GQL_INVENTORY/, "Inventory fallback imports are tracked as a display mode");
assert.doesNotMatch(source, /replaceCatalogFromDashboard\(open, \x60\$\{source\}-inventory-fallback\x60\)/, "Inventory fallback never replaces broad catalog membership");
assert.match(source, /rememberCampaignCatalog\(open, \x60\$\{source\}-inventory-fallback\x60\)/, "Inventory fallback overlays the existing catalog instead");
assert.match(source, /lastCampaignAuthImportError/, "failed campaign imports keep the Twitch error for the UI");
assert.match(source, /Campaign import failed/, "failed campaign imports surface an actionable status");
assert.match(source, /Inventory fallback/, "integrity-blocked All Campaigns imports fall back to Inventory");
assert.match(source, /69750554e0a81492f2d343558f84bdf3e324767650a2dbb6e79a3c629b4548cf/, "ViewerDropsDashboard hash matches live Twitch");
assert.match(source, /fbdc9d9857fa39ff458d3f6116b157a9481fd140266879a2508a662f5c8af6f8/, "Inventory hash matches live Twitch");
assert.match(source, /function listOpenCampaignQueue/, "open campaigns remain queued internally for selection");
assert.match(source, /function campaignQueueTriplet/, "campaign triplet helper remains available internally");
assert.doesNotMatch(source, /tdh-campaign-topmenu/, "progress UI no longer includes the open-campaign top menu");
assert.match(source, /Ending Sooner/, "open campaign selection prioritizes ending soonest");
assert.match(source, /needsDropDetails:\s*true/, "open campaigns without drop rows stay selectable by end date");
assert.match(
  source,
  /const memoryState = campaignMemoryRoutingState\(key, now, options\);\s*if \(!memoryState\.open\) continue;/u,
  "campaign memory rebuild requires a dated-open campaign lifecycle state",
);
assert.match(
  source,
  /isPageScrapedCampaignKey\(key\) && !window\.endMs/,
  "undated page scrapes are skipped from the Previous\/Current\/Next queue",
);
assert.match(source, /const soonerCampaignElsewhere = false;/, "same-game continuation is not preempted by an ending-sooner campaign");
assert.match(source, /function preferCurrentWinnableOpenDrop/, "campaign selection has an explicit sticky-current-campaign preference");
assert.match(source, /return preferCurrentWinnableOpenDrop\(pool\) \|\| pool\[0\] \|\| null;/, "open-campaign selection keeps the current winnable campaign before ending-soonest fallback");
assert.match(source, /function twitchSearchTerm/, "search pages expose the current Twitch search term");
assert.match(source, /Search was for/, "a leftover search term is corrected to the target game");
assert.match(source, /isTwitchHomepage\(\) \|\| isTwitchSearchPage\(\)/, "an active \/search page is not bounced back to Twitch Home");
assert.match(source, /dropMatchesLockedHandoff/, "Inventory cannot overwrite a locked handoff target game");
assert.match(source, /normalized-name/, "obvious category slugs can be derived from the game name");
assert.match(source, /function startDropper/, "Dropper boot is deferred until init finishes");
assert.match(source, /Start only after every binding in this IIFE is initialized/, "SPA boot no longer runs inside a TDZ");
assert.match(source, /function expireEndedOpenCampaigns/, "campaigns past end date are expired");
assert.match(source, /source: "campaign-ended"/, "expired campaigns are marked complete by end date");
assert.doesNotMatch(source, /NBA 2K27|injectCampaign|hardcodedCampaigns/i, "open campaigns are never hardcoded from one account's list");

const homepageHandoffStart = source.indexOf("  function continueHomepageCampaignHandoffFromDom");
const homepageHandoffEnd = source.indexOf("\n  function collectDirectoryStreamCandidates", homepageHandoffStart);
const homepageHandoffSource = source.slice(homepageHandoffStart, homepageHandoffEnd);
const gameFirstSearch = homepageHandoffSource.indexOf('usingGame ? "game-home-results" : "campaign-home-results"');
const activeStreamSelection = homepageHandoffSource.indexOf("const homeCandidates = collectHomepageSearchStreamCandidates(pending)");
const campaignTitleFallback = homepageHandoffSource.indexOf("searching for campaign");
const switchToStream = homepageHandoffSource.indexOf("HANDOFF_STATES.SWITCHING");
assert.ok(gameFirstSearch >= 0 && gameFirstSearch < activeStreamSelection, "Twitch searches the original game name before inspecting streams");
assert.ok(activeStreamSelection >= 0 && activeStreamSelection < switchToStream, "an active search result is selected before stream verification");
assert.ok(campaignTitleFallback > gameFirstSearch, "a campaign title is only a search fallback when no game name exists");
assert.match(homepageHandoffSource, /twitchSearchTerm\(\)/, "full search reads the live query before hunting streams");
assert.match(homepageHandoffSource, /homeLikeStage/, "visit-home on \/search is normalized so the full-search timeout can fire");
assert.match(homepageHandoffSource, /Search was for \$\{pageTerm \|\| "a different term"\}/, "wrong leftover search terms navigate to the target game");
assert.doesNotMatch(homepageHandoffSource, /search-results[^\n]*main/u, "homepage discovery does not treat unrelated recommended streams as search results");
assert.match(source, /function firstStreamSearchQuery/, "stream search prefers the original game name");
assert.match(source, /Always try the original game name first/, "campaign titles are not the first Twitch search term");

const searchQueryStart = source.indexOf("  function firstStreamSearchQuery");
const searchQueryEnd = source.indexOf("\n  function setTwitchHomepageSearchQuery", searchQueryStart);
const searchQueryContext = {
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
};
vm.runInNewContext(
  `${source.slice(searchQueryStart, searchQueryEnd)}\nthis.query=firstStreamSearchQuery;this.usesGame=firstStreamSearchUsesGame;`,
  searchQueryContext,
);
assert.equal(
  searchQueryContext.query({ targetGame: "Delta Force", targetCampaign: "DF Streamer Ladder Drops" }),
  "Delta Force",
  "Delta Force is searched before the campaign title",
);
assert.equal(
  searchQueryContext.usesGame({ targetGame: "Delta Force", targetCampaign: "DF Streamer Ladder Drops" }),
  true,
  "a known game name is the first search",
);
assert.equal(
  searchQueryContext.query({ targetGame: "", targetCampaign: "DF Streamer Ladder Drops" }),
  "DF Streamer Ladder Drops",
  "campaign title is used only when no game name exists",
);

const searchTermStart = source.indexOf("  function twitchSearchTerm");
const searchTermEnd = source.indexOf("\n  function firstStreamSearchQuery", searchTermStart);
assert.notEqual(searchTermStart, -1, "search-term helper is present");
const searchTermContext = {
  location: { href: "https://www.twitch.tv/search?term=Mir%20Korabley" },
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  URL,
};
vm.runInNewContext(
  `${source.slice(searchTermStart, searchTermEnd)}\nthis.term=twitchSearchTerm;this.match=searchTermsMatch;`,
  searchTermContext,
);
assert.equal(searchTermContext.term(), "Mir Korabley", "\/search exposes the leftover Twitch query");
assert.equal(searchTermContext.match("Mir Korabley", "Delta Force"), false, "Mir Korabley is not a Delta Force search");
assert.equal(searchTermContext.match("Delta Force", "Delta Force"), true, "matching search terms compare case-insensitively");

const searchStart = source.indexOf("  function extractCardGameName");
const searchEnd = source.indexOf("\n  function resetCategoryMismatch", searchStart);
const searchContext = {
  settings: { queuePreference: "Any Eligible" },
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  Math,
};
vm.runInNewContext(
  `${source.slice(searchStart, searchEnd)}\nthis.extract=extractCardGameName;this.sort=sortStreamCandidates;this.shuffle=shuffleInPlace;`,
  searchContext,
);
assert.equal(
  searchContext.extract(
    { querySelector: () => ({ getAttribute: () => "/directory/category/real-game", textContent: "Real Game", href: "/directory/category/real-game" }) },
    "alice live 12 viewers",
    "",
  ),
  "Real Game",
  "search cards expose the category name before a stream is opened",
);
assert.equal(
  searchContext.extract({ querySelector: () => null }, "alice live 12 viewers", "Live channel"),
  "",
  "a live card without a category is not treated as a verified campaign match",
);
const shuffled = searchContext.sort([
  { login: "one", dropsTagged: true, viewers: 5 },
  { login: "two", dropsTagged: true, viewers: 9 },
  { login: "three", dropsTagged: false, viewers: 1 },
]);
assert.equal(shuffled.at(-1).login, "three", "Any Eligible keeps Drops-tagged streams ahead of untagged results");
assert.deepEqual([...shuffled.map((item) => item.login)].sort(), ["one", "three", "two"], "Any Eligible shuffles among verified live matches");

assert.match(source, /a\[data-a-target="preview-card-channel-link"\]\[href\]/, "homepage search recognizes Twitch preview-card channel links");
assert.match(source, /const categoryMatches = Boolean\(/, "homepage search can verify a stream candidate from category metadata");
assert.match(source, /previewChannelLink && searchTermMatchesTarget/, "full-game search can keep a preview-card candidate when Twitch omits the card game label");
assert.match(source, /campaignKey: cleanText\(pending\?\.targetCampaignKey \|\| ""\)/, "search candidates retain the active campaign key for standby verification");
assert.match(source, /queuePreference === "Any Eligible"/, "Any Eligible uses a shuffled verified pool");

assert.match(source, /STANDBY_CACHE_TTL_MS = 15 \* 60 \* 1000/u, "standby streams expire every 15 minutes");
assert.match(source, /if \(wantedCampaign && item\.campaignKey !== wantedCampaign\) return false;/u, "standby streams must belong to the active campaign");
assert.match(source, /CAMPAIGN_MEMORY_KEY = "dropper-campaign-memory-v1"/u, "campaign dates and completion are persisted across browser sessions");
assert.match(source, /if \(campaignMarkedComplete\(campaign\)\) continue;/u, "completed campaigns are excluded before drop selection");
assert.match(source, /function suppressPageCampaignsWithAuthoritativeMatches/, "routing can suppress page shells when Twitch provides a real campaign for the same game");
assert.doesNotMatch(source, /TEMP_CAMPAIGN_SKIP_KEY|TEMP_CAMPAIGN_SKIP_MS|function loadTemporaryCampaignSkips|function skipCurrentCampaign/, "24-hour campaign skip state and actions are removed");
assert.doesNotMatch(source, /function navigateCampaignQueue\(direction\)/, "manual Previous and Next campaign-strip navigation is removed");
assert.doesNotMatch(source, /manual-previous-campaign/, "Previous campaign-strip navigation is removed");
assert.doesNotMatch(source, /manual-next-campaign/, "Next campaign-strip navigation is removed");
assert.doesNotMatch(source, /document\.createElement\(interactive \? "button" : "div"\)/, "campaign-strip cards are no longer rendered");
assert.doesNotMatch(
  source.slice(source.indexOf("  function openCampaignsFromMemory"), source.indexOf("\n  function parseCampaignDateRange")),
  /requiredMinutesWatched:\s*60/,
  "remembered campaigns never invent a 60-minute Drop",
);
assert.match(source, /function streamViewerCount/, "stream viewer counts preserve an explicit unknown state");
assert.match(source, /viewers: viewerMatch \? streamViewerCount\([\s\S]*?\) : null/, "search candidates use null when Twitch does not expose a viewer count");
assert.match(source, /compareKnownViewerCounts/, "viewer sorting keeps unknown counts separate from numeric zero");
assert.match(source, /function reconcilePageCurrentDropWithAuthoritativeCampaign/, "an already-active page shell can be replaced when real Drop details arrive");
assert.match(source, /reconcilePageCurrentDropWithAuthoritativeCampaign\(campaignPool\)/, "GQL polling reconciles synthetic page targets before progress selection");
const pageScrapeStart = source.indexOf("  function scrapeCampaignsFromPage");
const pageScrapeEnd = source.indexOf("\n  function scrollLoadAndExpandCampaignsPage", pageScrapeStart);
const pageScrapeSource = source.slice(pageScrapeStart, pageScrapeEnd);
assert.match(pageScrapeSource, /timeBasedDrops: \[\]/, "page campaign rows remain discovery shells");
assert.doesNotMatch(pageScrapeSource, /requiredMinutesWatched:\s*60/, "page campaign rows never invent a 60-minute Drop");

assert.doesNotMatch(source, /campaign-top-mark/, "removed campaign navigation cards stay gone");
assert.doesNotMatch(source, /kicker\.textContent = slot\.label/u, "Previous, Current, and Next campaign cards are removed");
assert.doesNotMatch(source, /campaign-top-earned/u, "campaign-strip earned counts are removed");
assert.doesNotMatch(source, /campaign-top-dates/u, "campaign-strip dates are removed");

console.log("Dropper campaign selection checks passed.");

assert.match(source, /ROUTING_SESSION_KEY = "dropper-routing-session-v310"/u, "3.1 routing has one versioned session");
assert.match(source, /ROUTING_VERIFY_DEADLINE_MS = 90 \* 1000;/u, "stream verification uses one controller deadline");
assert.match(source, /function routingControllerFindStream\(/u, "3.1 owns stream discovery in the routing controller");
assert.match(source, /function classifyRoutingCandidates\(/u, "automatic discovery uses one shared stream classifier");
assert.match(source, /const campaignCompatible = !allowListPresent \|\| allowListMatch;/u, "allow-list campaigns only treat exact allowed channels as compatible");
assert.match(source, /const routable = Boolean\(!temporarilySkipped && campaignCompatible\)/u, "temporary streamer skips are enforced by the shared classifier");
assert.match(source, /function routingControllerVerifyStream\(/u, "candidate verification is owned by the routing controller");
assert.match(source, /requestGqlPoll\("routing-stream-arrival", true\)/u, "candidate streams trigger immediate data refresh");
assert.match(source, /function routingControllerNavigate\(/u, "3.1 exposes one controller navigation path");
const heartbeatStartV31 = source.indexOf("  async function heartbeat()");
const heartbeatEndV31 = source.indexOf("\n  function isSubscriptionPromoText", heartbeatStartV31);
const heartbeatV31 = source.slice(heartbeatStartV31, heartbeatEndV31);
assert.doesNotMatch(heartbeatV31, /continueHomepageCampaignHandoffFromDom|continueToNextGame|ensureActiveCampaignStream|maybeRecoverCategoryMismatch|findNextStream/u, "heartbeat no longer invokes legacy routing loops");
assert.doesNotMatch(source, /TEMP_STREAM_SKIP_KEY|TEMP_STREAM_SKIP_MS/u, "temporary streamer-skip storage is removed");
assert.doesNotMatch(source, /id="tdh-skip-stream"/u, "Streams no longer exposes the old manual skip button");
assert.match(source, /function skipCurrentStreamer\(\)[\s\S]*transitionRoutingController\([\s\S]*ROUTING_STATES\.FIND_STREAM/u, "Skip Streamer dispatches into the 3.1 controller");
assert.match(source, /failedStreams/u, "failed-stream exclusion remains available");
assert.doesNotMatch(source, /ROUTING_EXCLUDE_KEY = "dropper-routing-exclude-v1"/u, "routing exclusions no longer use durable session state");


assert.match(source, /function streamCandidateHasDropsProof\(candidate\)/u, "automatic routing has an explicit Drops-proof gate");
assert.match(source, /if \(pending\?\.lockActiveCampaign\) \{\s+return pool\.find\(streamCandidateHasDropsProof\) \|\| null;/u, "locked campaigns reject untagged automatic stream candidates");
assert.match(source, /const cachedNext = pickAutomaticStreamCandidate\(cached, pending\);/u, "cached retries use the Drops-proof gate");
assert.match(source, /const homeChosen = pickAutomaticStreamCandidate\(homeCandidates, pending\);/u, "homepage retries use the Drops-proof gate");
assert.match(source, /const chosen = pickAutomaticStreamCandidate\(candidates, pending\);/u, "full search and directory routing use the Drops-proof gate");
assert.match(source, /discoveryMode: directoryUrl \? "directory" : "homepage-search"/u, "failed locked streams return to the target directory instead of restarting the full search loop");


assert.match(source, /function campaignRoutingState\(campaignOrDrop, now = Date\.now\(\), options = \{\}\)/u, "campaign routing has one authoritative date-window state helper");
assert.match(source, /const datedOpen = preferred\.filter\(\(campaign\) => campaignIsRoutingOpen\(campaign, now\)\)/u, "routing pool contains only dated open campaigns");
assert.match(source, /const datedOpenCampaigns = campaigns\.filter\(\(campaign\) => \{/u, "Inventory snapshots are filtered through campaign routing dates");
assert.match(source, /lastInventoryCampaigns = datedOpenCampaigns/u, "closed or expired Inventory campaigns cannot remain active progress sources");
assert.match(source, /function activeCampaignAllowedChannels\(\)[\s\S]*campaignIsRoutingOpen\(currentDrop\)/u, "campaign allow lists are ignored once the active campaign is no longer dated-open");
assert.match(source, /function channelSupportsTargetCampaign\([\s\S]*campaignIsRoutingOpen\(campaign, now\)/u, "channel campaign proof only accepts dated-open campaigns");
assert.match(source, /function dropIdentityMatchesTarget\([\s\S]*targetCampaignOpen:[\s\S]*matchesTarget: Boolean\(targetRoutingState\.open/u, "session identity cannot match a closed or expired target");
assert.match(source, /function pruneStandbyCache\([\s\S]*campaignMemoryRoutingState/u, "standby cache purges entries whose campaign window is no longer open");
assert.match(source, /activeCampaignRouting: \{\s*lifecycle: currentDrop \? campaignRoutingState\(currentDrop, now\) : null/u, "diagnostics expose the active campaign lifecycle decision");
