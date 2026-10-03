"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const { loadDropperSource } = require("./load-source.cjs");

const source = loadDropperSource();

const integrityStart = source.indexOf("  function integrityExpiresAt");
const integrityEnd = source.indexOf("\n  async function postTwitchJson", integrityStart);
assert.ok(integrityStart > 0 && integrityEnd > integrityStart);

const now = 1_700_000_000_000;
const integrityContext = {
  cleanText: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  Date,
};
vm.runInNewContext(
  `${source.slice(integrityStart, integrityEnd)}\nthis.expires = integrityExpiresAt;\nthis.parse = parseIntegrityPayload;`,
  integrityContext,
);

assert.equal(integrityContext.expires(now, now), now, "millisecond integrity expirations stay absolute");
assert.equal(integrityContext.expires(1_700_000_000, now), now, "second integrity expirations convert to milliseconds");
assert.equal(integrityContext.expires(0, now), now + 10 * 60 * 1000, "a missing expiration lasts ten minutes");
const parsed = integrityContext.parse({ token: "v4.local.example", expiration: now }, 200);
assert.equal(parsed.token, "v4.local.example");
assert.equal(parsed.expiresAt, now);
assert.equal(integrityContext.parse({ token: "v4.local.example" }, 401), null, "a rejected integrity response is not cached");

assert.match(source, /headers\["Client-Integrity"\] = integrity/, "GQL calls send Twitch's client integrity token");
assert.match(source, /INTEGRITY_URL = "https:\/\/gql\.twitch\.tv\/integrity"/, "integrity tokens come from Twitch's integrity endpoint");
assert.match(source, /preferredGqlTransports\(\)/, "GQL prefers the transport that minted the integrity token");
assert.match(source, /transport === "page"/, "Dropper can send GQL through the Twitch page fetch path");
assert.match(source, /credentials:\s*"omit"/, "page GQL omits cookies so Twitch ACAO:* integrity responses are allowed");
assert.doesNotMatch(source, /credentials:\s*"include"/, "page GQL must not request cookie credentials against gql.twitch.tv");
assert.match(source, /typeof GM_xmlhttpRequest === "function"\) transports\.push\("gm"\)/, "GM is the primary GQL transport");
assert.match(source, /Twitch page integrity unavailable/, "page transport never mints integrity via CORS-blocked fetch");
assert.match(source, /saved\.transport !== transport/, "cached integrity tokens stay bound to one transport");
assert.match(source, /function verifyHandoffChannel/, "arrived streams are verified against Twitch campaign/session evidence");
assert.match(source, /campaignSupport === true \|\| sessionMatches \|\| creditedProgress/, "stream verification requires campaign support, a matching session, or credited progress");
assert.doesNotMatch(source, /visible-drops-stream/, "same-game page visibility alone cannot complete a Drops handoff");
assert.match(source, /if \(!campaignSupported && !progressConfirmed\) return false;/, "final verification refuses evidence that lacks campaign support or credited progress");
assert.match(source, /campaignKey: pending\.targetCampaignKey/, "verification proof is bound to the selected campaign");
assert.match(source, /isPageScrapedCampaignKey/, "page-scraped campaign keys are recognized");
assert.match(source, /Page campaign[\s\S]*cannot use Inventory/, "page scrapes skip Inventory completion audits");
assert.match(
  source,
  /isPageScrapedCampaignKey\(campaignKeyValue\)[\s\S]*campaign-ended/,
  "page scrapes only mark completed when their end date expires",
);assert.match(source, /clearGqlFailurePause\(`verified-stream:\$\{method\}`\)/, "verifying a live stream clears Network Pause");
assert.match(source, /failed to fetch\|network error\|timed out\|page integrity unavailable/i, "page integrity/CORS failures fall back to GM GQL");
assert.match(source, /function streamHasDropsEnabledTag/, "Drops Enabled detection covers Twitch tag variants");
assert.match(source, /const scope = root \|\| document\.querySelector\("#live-channel-stream-information"\)/, "Drops Enabled detection defaults to the active stream block rather than the whole page");
assert.match(source, /if \(!root \|\| !login\)/, "stream info fails closed when no active watched channel exists");
assert.match(source, /FIRST_WATCH_CREDIT_GRACE_MS = 90 \* 1000/, "first watch credit grace matches Twitch's ~90s window");
assert.match(source, /holdingVerifiedDropStream\(\) \|\| matchingLiveDropStream\(\)/, "empty-catalog recovery stays on a live matching stream");
assert.match(source, /STREAM_OFFLINE_CONFIRM_MS/, "offline auto-switch requires a sustained offline signal");
assert.match(source, /withinFirstWatchCreditGrace/, "stall recovery waits for the first watch credit window");
assert.match(source, /installTwitchNetworkHooks/, "Twitch page GQL traffic is intercepted for Drop progress");
assert.match(source, /__tdhTwitchNetHooked/, "GQL intercept is installed in the page world, not the userscript fetch stack");
assert.match(source, /uw\.eval\(injector\)/, "Safari can install the page hook via unsafeWindow.eval when script tags are stripped");
assert.match(source, /tdh-twitch-gql-intercept-v1/, "page-world GQL capture posts back through a Dropper event channel");
assert.doesNotMatch(source, /function dropperFetch\b|uw\.fetch = function dropperFetch/, "userscript no longer wraps page fetch directly");
assert.match(source, /Client-Session-Id/, "Dropper reuses Twitch session headers on GQL requests");
assert.match(source, /if \(!lastCampaignCatalog\.length\) return persistCampaignCatalog\(campaigns, source\)/, "an empty catalog can be filled from the All Campaigns page");
assert.match(source, /clearGqlFailurePause\("campaigns-page-scan"\)/, "page catalog recovery clears the GQL pause");
assert.match(source, /signature !== lastCampaignPageScanSignature/, "All Campaigns scan messages are not repeated every heartbeat");
assert.match(source, /maybeRecoverEmptyCatalog/, "an empty catalog after integrity failure opens All Campaigns");
assert.match(source, /isPlaceholderDropName/, "empty Active drop placeholders do not lock routing");
assert.match(source, /Do not proxy IntersectionObserver/, "Keep Tab Active does not force video IntersectionObserver remounts");
assert.match(source, /viewingIntent\.takeRecovery\(explicit\)/, "playback recovery requires intent permission and a bounded budget");
assert.doesNotMatch(source, /defineConstProp\(DocProto|tmGuardedPause|new uw\.MouseEvent/, "active viewing does not fake focus, swallow pause, or simulate input");
assert.doesNotMatch(source, /uw\.IntersectionObserver = IOProxy/, "Keep Tab Active no longer replaces IntersectionObserver");
assert.match(source, /function ensureStreamMuted/, "Mute Opened Streams applies on same-tab Dropper navigations");
assert.match(source, /function ensureStreamPlaying/, "Dropper resumes a paused player after it opens or switches streams");
assert.match(source, /authoritativeProgressPercent/, "progress UI can recover its percentage from authoritative Drop/session state");
assert.match(source, /tdh-ring/, "launcher progress remains wired to the shared progress renderer");
assert.match(source, /UNHEALTHY_STREAM_STALLED_MS = 2 \* 60 \* 1000/, "unhealthy streams recover after two minutes");
assert.match(source, /progressStallTimeoutMs\(health\.healthy\)/, "diagnostics report the stall timeout that actually applies");
assert.match(source, /requestMuteAfterNavigation/, "Mute intent survives Twitch SPA navigation");
assert.match(source, /\[role='progressbar'\] \+ div span/, "Inventory percent text is a DOM progress fallback");
assert.match(source, /function scrollLoadAndExpandCampaignsPage/, "All Campaigns scroll-loads when GQL catalog is empty");
assert.match(source, /scheduleCampaignsPageCatalogEnrichment/, "All Campaigns enrichment is scheduled without blocking heartbeat");
assert.match(
  source,
  /!integrityRejected && \/\\b401\\b\|\\b403\\b\|unauthorized\|forbidden\/i\.test\(message\)/,
  "an integrity rejection does not open the authorization pause",
);

assert.match(source, /let pageDeadEnd = false/, "GQL transport loop tracks page integrity dead-ends");
assert.match(
  source,
  /if \(transport === "page" && pageDeadEnd\) continue/,
  "page GQL is skipped after Twitch page integrity is unavailable",
);
assert.match(
  source,
  /if \(!lastError \|\| \/page integrity unavailable\/i\.test\(lastError\?\.message \|\| ""\)\)/,
  "page integrity dead-ends do not erase a prior GM GQL failure",
);
assert.doesNotMatch(
  source,
  /transports = preferredGqlTransports\(\);\s*\n\s*\}/,
  "GQL transport order is not recomputed mid-loop after a page integrity dead-end",
);

{
  // Behavioral regression: page integrity must not mask an earlier GM failure,
  // and a recomputed ["gm","page"] list must not skip GM by re-hitting page.
  function chooseLastError(lastError, error) {
    if (!lastError || /page integrity unavailable/i.test(lastError?.message || "")) {
      return error;
    }
    if (!/page integrity unavailable/i.test(error?.message || "")) {
      return error;
    }
    return lastError;
  }

  function runTransportLoop(initialTransports, outcomes) {
    let lastError = null;
    let pageDeadEnd = false;
    const transports = initialTransports.slice();
    for (let index = 0; index < transports.length; index += 1) {
      const transport = transports[index];
      if (transport === "page" && pageDeadEnd) continue;
      const error = outcomes[`${transport}:${index}`] || outcomes[transport];
      if (!error) return { ok: true, transport };
      lastError = chooseLastError(lastError, error);
      if (/page integrity unavailable/i.test(error.message || "")) {
        pageDeadEnd = true;
      }
    }
    return { ok: false, lastError };
  }

  const gmFailure = new Error("Twitch network error (503)");
  const pageDeadEnd = new Error("Twitch page integrity unavailable");

  const gmFirst = runTransportLoop(["gm", "page"], { gm: gmFailure, page: pageDeadEnd });
  assert.equal(gmFirst.ok, false);
  assert.equal(gmFirst.lastError, gmFailure, "GM failure survives a later page integrity dead-end");

  const pageFirst = runTransportLoop(["page", "gm"], {
    "page:0": pageDeadEnd,
    gm: null,
  });
  assert.equal(pageFirst.ok, true);
  assert.equal(pageFirst.transport, "gm", "GM still runs after a page integrity dead-end");

  // Old bug: starting on ["page","gm"], mid-loop preferredGqlTransports() rebuilt
  // ["gm","page"] while index still advanced to slot 1, so page ran twice and GM never ran.
  let transports = ["page", "gm"];
  let lastError = null;
  let sawGm = false;
  for (let index = 0; index < transports.length; index += 1) {
    const transport = transports[index];
    if (transport === "gm") sawGm = true;
    if (transport === "page") {
      lastError = pageDeadEnd;
      transports = ["gm", "page"];
    }
  }
  assert.equal(sawGm, false, "recomputing transports mid-loop can skip GM entirely");
  assert.equal(lastError.message, "Twitch page integrity unavailable");
}

assert.match(source, /function isSoftGqlError/, "soft Twitch GQL integrity/service errors are classified");
assert.match(
  source,
  /hasData && errors\.every\(isSoftGqlError\)/,
  "usable GQL rows survive soft integrity errors in a batch",
);
assert.match(
  source,
  /failed integrity check\|integritycheckfailed\|service error/i,
  "IntegrityCheckFailed codes are treated as soft GQL errors",
);
assert.match(source, /clearCapture/, "integrity clears can drop rejected page-captured tokens");
assert.match(
  source,
  /clearClientIntegrity\(\{ clearCapture: true \}\)/,
  "integrity rejections clear page-captured tokens before reminting",
);
assert.match(
  source,
  /After a forced refresh, never re-adopt a rejected page-captured token/,
  "forced integrity refresh does not reuse a rejected page token",
);

{
  function isSoftGqlError(item) {
    const message = String(item?.message || "").trim();
    const code = String(item?.extensions?.code || "").trim();
    return (
      /failed integrity check|integritycheckfailed|service error/i.test(message)
      || /integritycheckfailed/i.test(code)
    );
  }
  function parseGqlRows(json, status = 200) {
    if (status < 200 || status >= 300) throw new Error(`GQL HTTP ${status}`);
    const rows = Array.isArray(json) ? json : [json];
    const hardErrors = [];
    for (const row of rows) {
      const errors = Array.isArray(row?.errors) ? row.errors : [];
      if (!errors.length) continue;
      const hasData = row?.data != null && typeof row.data === "object";
      if (hasData && errors.every(isSoftGqlError)) continue;
      hardErrors.push(...errors);
    }
    if (hardErrors.length) {
      throw new Error(hardErrors.map((item) => item.message).filter(Boolean).join(" · ") || "Twitch GQL error");
    }
    return rows;
  }

  const softBatch = parseGqlRows([
    { data: { currentUser: { inventory: { dropCampaignsInProgress: [1] } } } },
    { data: { currentUser: { dropCampaigns: null } }, errors: [{ message: "failed integrity check" }] },
  ]);
  assert.equal(softBatch[0].data.currentUser.inventory.dropCampaignsInProgress.length, 1);
  assert.equal(softBatch[1].errors[0].message, "failed integrity check");

  const coded = parseGqlRows([
    {
      data: { currentUser: { dropCampaigns: null } },
      errors: [{ message: "failed integrity check", extensions: { code: "IntegrityCheckFailed" } }],
    },
  ]);
  assert.equal(coded[0].data.currentUser.dropCampaigns, null);

  assert.throws(
    () => parseGqlRows([{ errors: [{ message: "failed integrity check" }] }]),
    /failed integrity check/,
    "integrity failure without data still fails the poll",
  );
  assert.throws(
    () => parseGqlRows([{ data: { currentUser: {} }, errors: [{ message: "PersistedQueryNotFound" }] }]),
    /PersistedQueryNotFound/,
    "hard GQL errors still fail even when data is present",
  );
}

console.log("Dropper integrity and handoff checks passed.");
