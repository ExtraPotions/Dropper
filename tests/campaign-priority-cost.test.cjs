"use strict";

// The heartbeat ranks the open campaign queue several times per tick. A ranking pass must read the
// stored priority order and resolve the account (a document.cookie read) once, not once per campaign.

const assert = require("node:assert/strict");
const vm = require("node:vm");

const { loadDropperSource, loadActiveViewing } = require("./load-source.cjs");
const source = loadDropperSource();

function slice(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `source slice ${startMarker.trim()} is present`);
  return source.slice(start, end);
}

function createContext(strategy = "priority") {
  const stored = new Map();
  const counts = { getItem: 0, cookie: 0 };
  const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const context = {
    DropperActiveViewing: loadActiveViewing(),
    CAMPAIGN_PRIORITY_KEY: "dropper-campaign-priority-v1",
    CAMPAIGN_PRIORITY_ORDER_KEY: "dropper-campaign-priority-order-v1",
    productResetting: false,
    settings: { campaignStrategy: strategy },
    currentDrop: null,
    cleanText,
    normalizeGameName: (value) => cleanText(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "),
    scopedLocalStorageKey: (key) => { counts.cookie += 1; return `${key}:account:viewer`; },
    localStorage: {
      getItem: (key) => { counts.getItem += 1; return stored.has(key) ? stored.get(key) : null; },
      setItem: (key, value) => stored.set(key, String(value)),
      removeItem: (key) => stored.delete(key),
    },
  };
  vm.runInNewContext(
    slice("  function campaignPriorityEntry", "\n  function dropperPreconditionsMet")
      + "\nthis.rank = rankCampaignCandidatesForStrategy; this.writeOrder = writeCampaignPriorityOrder; this.setPriority = setCampaignPriority;",
    context,
  );
  return { context, counts, stored };
}

const DAY = 86400000;
const now = Date.UTC(2026, 9, 9, 12);
const candidates = Array.from({ length: 40 }, (_, index) => ({
  key: `campaign-${index}`,
  game: `Game ${index}`,
  endMs: now + (index + 1) * DAY,
  sequenceRemainingMinutes: 30,
}));

{
  const { context, counts } = createContext();
  context.writeOrder(["Game 7", "Game 3"]);
  context.setPriority("Game 12", 1);
  counts.getItem = 0;
  counts.cookie = 0;

  const ranked = context.rank(candidates, now);

  assert.deepEqual(
    Array.from(ranked.slice(0, 3), (item) => item.game),
    ["Game 7", "Game 3", "Game 12"],
    "Ranked games lead in rank order, then legacy high-priority games",
  );
  assert.equal(ranked[3].game, "Game 0", "Unranked games fall back to deadline order");
  assert.ok(counts.cookie <= 2, `A ranking pass resolves the account key at most twice (saw ${counts.cookie})`);
  assert.ok(
    counts.getItem <= candidates.length + 1,
    `A ranking pass reads the stored order once plus one legacy lookup per unranked game (saw ${counts.getItem})`,
  );
}

{
  const { context, counts } = createContext();
  context.writeOrder(["Game 5"]);
  assert.equal(context.rank(candidates, now)[0].game, "Game 5");
  context.writeOrder(["Game 9"]);
  counts.getItem = 0;
  assert.equal(context.rank(candidates, now)[0].game, "Game 9", "A new ranking pass sees a priority order changed since the last pass");
}

{
  const { context, counts } = createContext("deadline");
  context.writeOrder(["Game 20"]);
  counts.cookie = 0;
  const ranked = context.rank(candidates, now);
  assert.equal(ranked[0].game, "Game 0", "Ending Soonest still orders by deadline");
  assert.ok(counts.cookie <= 2, `Other strategies also resolve the account key at most twice (saw ${counts.cookie})`);
}

console.log("campaign priority cost tests passed");
