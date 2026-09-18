// ==UserScript==
// @name         Dropper
// @namespace    twitch-drops-helper
// @version      2.6.27
// @description  A Twitch Drops companion for tracking watch time, monitoring progress, managing eligible streams, and redeeming rewards.
// @icon         https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-icon-1024.png
// @updateURL    https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js
// @downloadURL  https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js
// @tag          Twitch, Drops, Auto Claim, Tracker, Rewards
// @author       Dare
// @license      PolyForm-Noncommercial-1.0.0
// @match        https://www.twitch.tv/*
// @match        https://player.twitch.tv/*
// @match        https://embed.twitch.tv/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      gql.twitch.tv
// @connect      raw.githubusercontent.com
// ==/UserScript==

// Dropper Manager Metadata
// Description: Track Twitch Drop progress, monitor watch time, auto-claim rewards, manage backup streams, and keep earning in the background.
// Tags: Twitch, Drops, Auto Claim, Tracker, Rewards


(function twitchDropsHelper() {
  "use strict";

  const SETTINGS_KEY = "tdh-settings-v3";
  const LAUNCHER_TOP_KEY = "tdh-launcher-top";
  const APP_VERSION = "2.6.27";
  const LAST_VERSION_KEY = "dropper-last-version";
  const UPDATE_STATE_KEY = "dropper-update-state";
  const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const NEXT_GAME_KEY = "dropper-next-game-after-claim";
  const PROGRESS_CARD_STATE_KEY = "dropper-progress-card-collapsed";
  const HANDOFF_STAGE_TIMEOUT_MS = 45 * 1000;
  const HEARTBEAT_INTERVAL_MS = 5000;
  const STARTUP_NETWORK_QUIET_MS = 12 * 1000;
  const STREAM_ROUTE_SETTLE_MS = 15 * 1000;
  const NAVIGATION_GUARD_KEY = "dropper-auto-navigation-guard";
  const AUTO_NAVIGATION_WINDOW_MS = 60 * 1000;
  const AUTO_NAVIGATION_LIMIT = 4;
  const AUTO_NAVIGATION_COOLDOWN_MS = 90 * 1000;
  const GQL_POLL_INTERVAL_MS = 60 * 1000;
  const GQL_RECOVERY_INTERVAL_MS = 30 * 1000;
  const GQL_MIN_GAP_MS = 15 * 1000;
  const GQL_MAX_BACKOFF_MS = 5 * 60 * 1000;
  const ACTIVITY_LOG_KEY = "dropper-activity-log";
  const NETWORK_STATE_KEY = "dropper-network-state";
  const STANDBY_CACHE_KEY = "dropper-standby-streams";
  const STANDBY_CACHE_TTL_MS = 30 * 60 * 1000;
  const ACTIVITY_LOG_LIMIT = 40;
  const NETWORK_WINDOW_MS = 60 * 60 * 1000;
  const NETWORK_REQUEST_SOFT_BUDGET = 180;
  const NETWORK_FAILURE_THRESHOLD = 3;
  const CIRCUIT_ERROR_COOLDOWN_MS = 5 * 60 * 1000;
  const CIRCUIT_RATE_COOLDOWN_MS = 15 * 60 * 1000;
  const HANDOFF_VERIFY_TIMEOUT_MS = 90 * 1000;
  const ACTIVE_STREAM_VERIFY_TIMEOUT_MS = 90 * 1000;
  const CAMPAIGN_EXPIRY_GRACE_MS = 60 * 1000;
  const CLAIM_RETRY_INTERVAL_MS = 30 * 1000;
  const CLAIM_READY_GRACE_MS = 60 * 1000;
  const CATEGORY_MISMATCH_GRACE_MS = 15 * 1000;
  const HEALTHY_STREAM_DELAYED_MS = 5 * 60 * 1000;
  const HEALTHY_STREAM_STALLED_MS = 6 * 60 * 1000;
  const UNHEALTHY_STREAM_DELAYED_MS = 90 * 1000;
  const CATEGORY_SLUG_CACHE_KEY = "dropper-category-slugs";
  const CATEGORY_SLUG_ALIASES = Object.freeze({
    "the blood of dawnwalker": "dawnwalker",
  });
  const HANDOFF_STATES = Object.freeze({
    CHECKING_GAME: "checking-game",
    SELECTING_GAME: "selecting-game",
    FINDING_STREAM: "finding-stream",
    SWITCHING: "switching",
    VERIFYING: "verifying",
    COMPLETE: "complete",
    FAILED: "failed",
  });
  const UPDATE_URL = "https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js";
  const RELEASES_URL = "https://github.com/ExtraPotions/Dropper/releases";
  const UPDATE_NOTICE_DURATION_MS = 30 * 1000;
  const UPDATE_RELOAD_KEY = "dropper-update-reload-pending";
  const UPDATE_RETURN_DELAY_MS = 3 * 1000;
  const UPDATE_RELOAD_FALLBACK_MS = 45 * 1000;
  const UPDATE_RELOAD_PENDING_TTL_MS = 2 * 60 * 1000;
  const MENU_INACTIVITY_DISMISS_MS = 15 * 1000;
  const PROGRESS_EXPAND_AUTO_COLLAPSE_MS = 5 * 1000;
  const RELEASE_NOTES = {
    "2.6.27": [
      "Adds automatic Twitch refresh after starting a Dropper update install.",
      "Refreshes 3 seconds after returning to Twitch from the userscript installer.",
      "Adds a 45-second fallback refresh if the return event is missed.",
      "Expires pending update-refresh state after 2 minutes and clears it before reloading.",
    ],
    "2.6.26": [
      "Moves Hide Twitch Subscribe Promos into Appearance.",
      "Also hides Twitch collapsed highlight promo cards such as Watch for reward messages.",
      "Adds Switch On Category Change to Stream Queue.",
      "Adds clearer hover guidance for the Settings badge and collapsed progress panel.",
    ],
    "2.6.25": [
      "Makes the collapsed progress panel itself the expand control.",
      "Removes the dedicated progress expand/collapse chevron button.",
      "Adds a new Appearance menu for visual preferences.",
      "Adds Full, Compact, and Narrow collapsed-panel width options, defaulting to Compact.",
    ],
    "2.6.24": [
      "Reduces GitHub update checks from 60 minutes to 15 minutes.",
      "Keeps Twitch GQL polling cadence unchanged.",
      "Preserves per-version caching, cache-busting, and native userscript update metadata.",
    ],
    "2.6.23": [
      "Makes Settings auto-close deadline-based instead of relying only on a timeout callback.",
      "Makes progress auto-collapse deadline-based and enforced by the heartbeat.",
      "Collapses the progress card exactly 5 seconds after expansion.",
      "Adds deadline diagnostics for both auto-dismiss behaviors.",
    ],
    "2.6.22": [
      "Automatically closes the Settings menu after 15 seconds without interaction.",
      "Resets the Settings timeout when the menu is used.",
      "Automatically collapses a manually expanded progress card after 5 seconds.",
      "Closes a version-click changelog together with the Settings menu.",
    ],
    "2.6.21": [
      "Shrinks the Settings header icon to recover more vertical menu space.",
      "Tightens header spacing so more controls fit without scrolling.",
      "Opens the version-click changelog directly above the Settings menu.",
      "Keeps automatic update notices attached to the progress area.",
    ],
    "2.6.20": [
      "Hides the visible Settings menu scrollbar while preserving scrolling.",
      "Keeps mouse-wheel, trackpad, touch, and keyboard scrolling available.",
      "Removes the scrollbar gutter so the menu keeps its full usable width.",
    ],
    "2.6.19": [
      "Adds the current Dropper version number to the Settings header.",
      "Makes the version badge clickable to reopen the current version changelog.",
      "Reuses the floating changelog card above the progress badge.",
    ],
    "2.6.18": [
      "Stops healthy matching streams from being labeled Delayed after only 90 seconds.",
      "Keeps the progress card in Earning while the live player is active and on the correct game.",
      "Uses a 5-minute Delayed and 6-minute Stalled threshold for otherwise healthy streams.",
      "Aligns the progress-card warning state with Dropper's actual stream-switch threshold.",
    ],
    "2.6.17": [
      "Stops channel/category reload loops caused by stale finding-stream handoff state.",
      "Recognizes a matching channel page as a verification target instead of bouncing back to the category.",
      "Adds a hard automatic-navigation loop guard with a 90-second cooldown.",
      "Lets freshly loaded stream pages settle before Dropper can route away from them.",
    ],
    "2.6.16": [
      "Expands subscription-promo suppression beyond chat.",
      "Hides Gift a Sub and Subscribe CTAs below the player.",
      "Suppresses compact inline and header channel-subscription upsells.",
      "Keeps Follow, player controls, normal chat, and Dropper controls untouched.",
    ],
    "2.6.15": [
      "Adds a Hide Chat Subscription Promos option, enabled by default.",
      "Suppresses compact Twitch subscription upsell cards inside the chat column without hiding normal chat.",
      "Leaves the normal Subscribe controls below the player untouched.",
      "Restores suppressed cards immediately if the option is turned off.",
    ],
    "2.6.14": [
      "Reduces Twitch page-load contention during stream reloads.",
      "Waits 12 seconds before Dropper starts its own automatic GQL polling after a fresh page load.",
      "Stops cloning and parsing unrelated Twitch GraphQL responses.",
      "Keeps passive Drop updates by inspecting only Drop- and Inventory-related Twitch operations.",
    ],
    "2.6.13": [
      "Makes the changelog/update card fully opaque.",
      "Makes Twitch Inventory the authoritative Drop watch-minute source whenever Inventory data is available.",
      "Updates the Working Toward card immediately when Dropper commits to a new campaign.",
      "Prefers incomplete earnable Drops over completed-but-unclaimed rewards when choosing the next campaign.",
    ],
    "2.6.12": [
      "Removes the hard hourly request cutoff that could pause progress tracking on a compatible stream.",
      "Keeps the request count as a soft diagnostic warning instead of opening the circuit breaker.",
      "Reserves the circuit breaker for actual rate limits, authorization failures, and repeated network errors.",
      "Avoids 30-second recovery polling when the current live stream already matches the active Drop game.",
    ],
    "2.6.11": [
      "Removes the redundant Got It button from completed-update changelog notices.",
      "Keeps the close button as the single dismiss control.",
      "Preserves GitHub Release and Install Update actions where they provide distinct functionality.",
    ],
    "2.6.10": [
      "Keeps update and changelog messages fully visible for 30 seconds.",
      "Removes the transparency fade effect from update notices.",
      "Automatically dismisses the notice after the 30-second display period.",
    ],
    "2.6.9": [
      "Caches compatible category stream candidates so Standby Streams survive navigation to the active channel.",
      "Expands standby discovery across Twitch category cards and filters the active or failed channels.",
      "Moves update and changelog notices above the progress badge instead of keeping them inside Settings.",
      "Adds a GitHub Releases link and automatically fades update/changelog notices after 30 seconds.",
    ],
    "2.6.8": [
      "Treats newly credited Drop progress as definitive proof that the current stream is compatible.",
      "Stops replacing a stream once the target campaign advances on that channel.",
      "Records a progress baseline before each candidate switch instead of resetting the last-progress timestamp.",
      "Extends stream verification to 90 seconds so Twitch has time to credit a watch minute.",
    ],
    "2.6.7": [
      "Moves the progress expand/collapse tab to the top or bottom based on the card's screen position.",
      "Keeps the toggle on the inward-facing edge so it stays comfortably inside the viewport.",
      "Flips the chevron direction automatically when the toggle changes sides.",
      "Updates toggle placement live while dragging or resizing Twitch.",
    ],
    "2.6.6": [
      "Adds native Tampermonkey/Violentmonkey update metadata.",
      "Checks for updates per installed Dropper version instead of sharing one stale 6-hour timer.",
      "Shows cached update availability immediately and rechecks GitHub hourly with cache-busting.",
      "Adds a visible launcher update indicator plus a toast so available updates are not hidden inside the menu.",
    ],
    "2.6.5": [
      "Locks routing to the unfinished active campaign instead of cycling unrelated games.",
      "Automatically resumes an unfinished campaign when Twitch is opened on Inventory, Directory, or another non-stream page.",
      "Tries category-page stream candidates even when Twitch does not show a Drops tag on each card, then verifies compatibility after switching.",
      "Prevents mismatched stream-session data from replacing the active campaign's inventory progress.",
    ],
    "2.6.4": [
      "Fixes false 100% progress caused by mixing Twitch session counters with inventory watch minutes.",
      "Preserves Drop instance IDs and claim state when session and inventory data are merged.",
      "Prefers incomplete watch-time rewards over completed-but-unclaimed rewards in the progress card.",
      "Adds a 60-second Claim Ready escape hatch when Twitch never exposes a usable claim action.",
    ],
    "2.6.3": [
      "Fixes Twitch category routing when a display name does not match its real category slug.",
      "Learns canonical category slugs from Twitch's own category links and reuses them during recovery.",
      "Stops treating campaign game names as if they were guaranteed URL slugs.",
      "Adds a canonical Dawnwalker mapping so The Blood of Dawnwalker routes to /directory/category/dawnwalker.",
    ],
    "2.6.2": [
      "Detects when a live channel changes away from the active Drop campaign's game.",
      "After a 15-second category-change grace period, finds a replacement Drops stream for the same campaign.",
      "Improves category-directory stream discovery so cards do not need to repeat the game name.",
      "Adds category-mismatch state to Diagnostics and the activity log.",
    ],
    "2.6.1": [
      "Adds a 60-second campaign-expiry escape hatch when Twitch leaves rewards stuck on Claim Ready.",
      "Moves to the next open eligible watch-time campaign even when the previous campaign never finishes claiming.",
      "Uses cached campaign timing in the local heartbeat instead of adding more Twitch polling.",
      "Throttles claim retries to prevent repeated claim requests while waiting for campaign rollover.",
    ],
    "2.6.0": [
      "Adds an explicit handoff state machine for game and stream switching.",
      "Adds a rolling sanitized activity log for live-test troubleshooting.",
      "Adds a network circuit breaker with request-budget, error, and rate-limit protection.",
      "Expands Diagnostics with selector health, network safety, handoff state, and copy/reset tools.",
    ],
    "2.5.11": [
      "Replaces frequent Drop polling timers with one coordinated heartbeat.",
      "Limits normal Twitch GQL polling to once per minute with recovery polling at 30 seconds.",
      "Prevents overlapping network polls and enforces a minimum request gap.",
      "Adds automatic backoff after Twitch GQL errors.",
    ],
    "2.5.10": [
      "Adds stale-progress warnings before a Drop is considered stalled.",
      "Retries another eligible game when a Drops directory handoff times out.",
      "Remembers the progress card's manual collapsed state across navigation.",
      "Adds adaptive hover placement and expanded diagnostics.",
    ],
    "2.5.9": [
      "Matches Dropper's width to Twitch's visible chat/right column.",
      "Automatically adapts when the Twitch chat panel is resized.",
    ],
    "2.5.8": [
      "Restores expanded Drop details as a hover preview while collapsed.",
      "Changes the Chrome compatibility badge to golden-yellow.",
    ],
  };
  const DEFAULTS = {
    claimBonus: true,
    keepTabActive: true,
    claimDrops: true,
    progressInTitle: true,
    findNextStream: true,
    muteRestarted: true,
    backgroundEarning: false,
    reduceMotion: false,
    collapsedPanelWidth: "compact",
    notifications: true,
    hideTwitchSubscriptionPromos: true,
    pauseAutoSwitchMinutes: 0,
    queueEnabled: true,
    queueCount: 3,
    queueOnStall: true,
    queueOnOffline: true,
    queueOnCategoryChange: true,
    queuePreference: "Any Eligible",
  };
  const BONUS_SELECTOR = 'button[aria-label="Claim Bonus"], .claimable-bonus__icon';
  const DROP_CLAIM_SELECTOR = [
    '[data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"]',
    'button[data-a-target="drops-claim-button"]',
  ].join(",");
  const INVENTORY_URL = "https://www.twitch.tv/drops/inventory";

  const GQL_URL = "https://gql.twitch.tv/gql";
  const CLIENT_IDS = ["kimne78kx3ncx6brgo4mv6wki5h1ko", "kd1unb4b3q4t58fwlpcbzcbnm76a8fp"];
  const GQL_OPS = {
    inventory: {
      name: "Inventory",
      hash: "d86775d0ef16a63a33ad52e80eaff963b2d5b72fada7c991504a57496e1d8e4b",
      variables: { fetchRewardCampaigns: false },
    },
    currentDrop: {
      name: "DropCurrentSessionContext",
      hash: "4d06b702d25d652afb9ef835d2a550031f1cf762b193523a92166f40ea3d142b",
      variables: { channelID: "", channelLogin: "" },
    },
    streamInfo: {
      name: "VideoPlayerStreamInfoOverlayChannel",
      hash: "198492e0857f6aedead9665c81c5a06d67b25b58034649687124083ff288597d",
      variables: { channel: "" },
    },
    availableDrops: {
      name: "DropsHighlightService_AvailableDrops",
      hash: "782dad0f032942260171d2d80a654f88bdd0c5a9dddc392e9bc92218a0f42d20",
      variables: { channelID: "" },
    },
    claimDrop: {
      name: "DropsPage_ClaimDropRewards",
      hash: "a455deea71bdc9015b78eb49f4acfbce8baa7ccbedd28e549bb025bd0f751930",
      variables: { input: { dropInstanceID: "" } },
    },
  };
  const RESERVED = new Set([
    "directory", "downloads", "drops", "friends", "inventory", "jobs", "messages",
    "moderator", "p", "popout", "prime", "privacy", "products", "search", "settings",
    "store", "subs", "subscriptions", "turbo", "user", "videos", "wallet",
  ]);

  const settings = loadSettings();
  const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const PAGE_STARTED_AT = Date.now();
  let statusText = "Starting…";
  let progressLabel = "";
  let lastBonusAt = 0;
  let lastDropAt = 0;
  let lastClaimAttemptAt = 0;
  let claimReadySince = 0;
  let claimReadySignature = "";
  let lastProgressReconcile = null;
  let lastStreamVerification = null;
  let lastStreamSwitch = 0;
  let categoryMismatchSince = 0;
  let categoryMismatchSignature = "";
  let categorySlugCache = loadCategorySlugCache();
  let lastProgress = readSession("tdh-progress", 0);
  let lastProgressAt = readSession("tdh-progress-at", Date.now());
  let currentDrop = readSession("tdh-drop", null);
  let capturedToken = "";
  let capturedDevice = "";
  let lastPath = "";
  let watchClock = { login: "", started: 0 };
  let ui = null;
  let railOpen = false;
  let clusterTop = Number(localStorage.getItem(LAUNCHER_TOP_KEY) || 0);
  let progressExpandTimer = null;
  let progressCollapseAt = 0;
  let menuDismissTimer = null;
  let menuDismissAt = 0;
  let updateNoticeTimer = null;
  let updateNoticeState = null;
  let updateReloadTimer = null;
  let updateFallbackTimer = null;
  let pauseAutoSwitchUntil = 0;
  let lastInventoryCampaigns = [];
  let chatWidthObserver = null;
  let chatDomObserver = null;
  let suppressedSubscriptionPromoCount = 0;
  let subscriptionPromoObserver = null;
  let lastGqlPollAt = 0;
  let lastGqlSuccessAt = 0;
  let lastGqlError = "";
  let lastTwitchGqlAt = 0;
  let heartbeatTimer = null;
  let lastHeartbeatAt = 0;
  let startupNetworkReadyAt = 0;
  let nextGqlPollAt = 0;
  let gqlPollInFlight = false;
  let gqlErrorStreak = 0;
  let pendingGqlReason = "startup";
  let lastGqlReason = "";
  let activityLog = readSession(ACTIVITY_LOG_KEY, []);
  let standbyCache = readSession(STANDBY_CACHE_KEY, []);
  let networkState = readSession(NETWORK_STATE_KEY, {
    requestTimes: [],
    consecutiveFailures: 0,
    openUntil: 0,
    reason: "",
    lastOpenedAt: 0,
    softBudgetWarnedAt: 0,
  });

  hookAuth(page);
  if (settings.keepTabActive) installKeepTabActive(page);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    mountUi();
    if (settings.claimBonus) watchBonus();
    if (settings.claimDrops) watchDrops();
    setStatus(featureStatus());
    logActivity("lifecycle", `Dropper ${APP_VERSION} started`);
    refreshDropCard();
    watchTwitchSubscriptionPromos();
    resumeUpdateReloadPending();
    checkVersionNotice();
    scheduleUpdateCheck();
    watchDirectoryHandoff();
    startHeartbeat();

    window.addEventListener("blur", () => {
      markUpdateInstallerLeft("blur");
    }, { passive: true });
    window.addEventListener("focus", () => {
      handleUpdateInstallerReturn("focus");
      queueGqlPollSoon("focus", 0);
      heartbeat();
    }, { passive: true });
    window.addEventListener("pageshow", () => {
      handleUpdateInstallerReturn("pageshow");
      queueGqlPollSoon("pageshow", 0);
      heartbeat();
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        markUpdateInstallerLeft("hidden");
      } else {
        handleUpdateInstallerReturn("visible");
        queueGqlPollSoon("visible", 0);
        heartbeat();
      }
    });
    window.addEventListener("resize", () => {
      syncDropperWidthToChat();
      positionCollapsedPreview();
      layoutChrome();
    }, { passive: true });
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    const now = Date.now();
    lastPath = location.pathname;
    startupNetworkReadyAt = now + STARTUP_NETWORK_QUIET_MS;
    nextGqlPollAt = startupNetworkReadyAt;
    heartbeat();
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
  }

  function queueGqlPollSoon(reason = "heartbeat", delayMs = HEARTBEAT_INTERVAL_MS) {
    const requestedAt = Date.now() + Math.max(0, Number(delayMs) || 0);
    const dueAt = startupNetworkReadyAt
      ? Math.max(requestedAt, startupNetworkReadyAt)
      : requestedAt;
    if (!nextGqlPollAt || dueAt < nextGqlPollAt) nextGqlPollAt = dueAt;
    pendingGqlReason = reason;
  }

  function gqlPollInterval() {
    if (gqlErrorStreak > 0) {
      return Math.min(
        GQL_POLL_INTERVAL_MS * Math.pow(2, Math.min(gqlErrorStreak - 1, 3)),
        GQL_MAX_BACKOFF_MS,
      );
    }

    const handoff = readSession(NEXT_GAME_KEY, null);
    if (handoff || !currentDrop) return GQL_RECOVERY_INTERVAL_MS;

    const login = watchingLogin();
    if (login) {
      const info = readStreamInfo();
      const compatibleLooking = Boolean(
        info.live &&
        info.game &&
        currentDrop.game &&
        gameNamesMatch(currentDrop.game, info.game)
      );

      // A matching live stream does not need aggressive recovery polling just
      // because Twitch has not credited a new minute recently.
      if (compatibleLooking) return GQL_POLL_INTERVAL_MS;
    }

    const progressAge = Date.now() - lastProgressAt;
    if (progressAge > 90 * 1000) return GQL_RECOVERY_INTERVAL_MS;
    return GQL_POLL_INTERVAL_MS;
  }

  async function requestGqlPoll(reason = "heartbeat", urgent = false) {
    const now = Date.now();
    if (gqlPollInFlight) return false;

    if (!urgent && startupNetworkReadyAt && now < startupNetworkReadyAt) {
      nextGqlPollAt = Math.max(nextGqlPollAt || 0, startupNetworkReadyAt);
      return false;
    }

    const circuit = networkCircuitSnapshot(now);
    if (circuit.open) {
      nextGqlPollAt = Math.max(nextGqlPollAt || 0, circuit.openUntil);
      setStatus(`Network Pause · ${circuit.reason || "Protection Active"}`);
      return false;
    }

    if (!getToken()) {
      nextGqlPollAt = now + GQL_RECOVERY_INTERVAL_MS;
      return false;
    }

    const minGap = urgent ? 5000 : GQL_MIN_GAP_MS;
    if (lastGqlPollAt && now - lastGqlPollAt < minGap) {
      nextGqlPollAt = Math.max(nextGqlPollAt || 0, lastGqlPollAt + minGap);
      return false;
    }

    if (!urgent && nextGqlPollAt && now < nextGqlPollAt) return false;

    gqlPollInFlight = true;
    lastGqlReason = reason;
    try {
      await pollGqlDrops();
      if (lastGqlError) gqlErrorStreak += 1;
      else gqlErrorStreak = 0;
    } finally {
      gqlPollInFlight = false;
      nextGqlPollAt = Date.now() + gqlPollInterval();
      pendingGqlReason = "heartbeat";
    }
    return true;
  }

  function activeDropNeedsStream() {
    if (!settings.findNextStream || !currentDrop || currentDrop.isClaimed) return false;
    if (Number(currentDrop.percent || 0) >= 100) return false;
    const expiry = campaignExpirySnapshot(lastInventoryCampaigns, currentDrop);
    return !expiry?.ended;
  }

  function ensureActiveCampaignStream() {
    if (!activeDropNeedsStream()) return false;

    const targetGame = currentDrop.game || "";
    const targetSlug = resolveCategorySlug(currentDrop);
    if (!targetGame || !targetSlug) return false;

    const login = watchingLogin();
    if (login) {
      const info = readStreamInfo();
      if (info.live && info.game && gameNamesMatch(targetGame, info.game)) return false;
      return maybeRecoverCategoryMismatch();
    }

    const targetDirectory = gameDirectoryUrl(currentDrop);
    const pageSlug = currentDirectorySlug();
    const onTargetDirectory = Boolean(
      isDirectoryCategoryPage() &&
      pageSlug &&
      (pageSlug === targetSlug || pageSlug.includes(targetSlug) || targetSlug.includes(pageSlug))
    );

    let pending = getHandoffState();
    const pendingState = normalizedHandoffState(pending);
    const alreadyLocked = Boolean(
      pending &&
      pending.lockActiveCampaign &&
      pending.targetGame &&
      gameNamesMatch(pending.targetGame, targetGame) &&
      [
        HANDOFF_STATES.FINDING_STREAM,
        HANDOFF_STATES.SWITCHING,
        HANDOFF_STATES.VERIFYING,
      ].includes(pendingState)
    );

    if (!alreadyLocked) {
      pending = transitionHandoff(
        HANDOFF_STATES.FINDING_STREAM,
        {
          completedGame: targetGame,
          completedDrop: currentDrop.name || "Drop",
          completedDropId: currentDrop.id || "",
          targetGame,
          targetSlug,
          targetStream: "",
          targetCampaign: currentDrop.campaign || "",
          targetCampaignKey: currentDrop.campaignKey || currentDrop.campaignId || "",
          failedStreams: [],
          lockActiveCampaign: true,
          recoveryReason: "resume-active-campaign",
          startedAt: Date.now(),
        },
        `Resuming unfinished ${currentDrop.campaign || targetGame} campaign`,
      );
    }

    if (onTargetDirectory) {
      continueDirectoryHandoffFromDom();
      return true;
    }

    if (targetDirectory) {
      setStatus(`Resuming ${targetGame} Drops · Finding Compatible Stream`);
      autoNavigateTwitch(targetDirectory, "automatic-routing");
      return true;
    }
    return false;
  }

  function heartbeat() {
    if (!ui) return;
    const now = Date.now();
    lastHeartbeatAt = now;
    enforceUpdateReloadPending(now);
    enforceAutoDismissDeadlines(now);
    noteWatching();

    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      queueGqlPollSoon("route-change", 5000);
    }

    if (isDirectoryCategoryPage() && readSession(NEXT_GAME_KEY, null)) {
      continueDirectoryHandoffFromDom();
    }

    if (maybeAdvanceExpiredCampaign(lastInventoryCampaigns)) return;
    if (maybeAdvanceStuckClaim(lastInventoryCampaigns)) return;
    if (maybeRecoverCategoryMismatch()) return;
    if (ensureActiveCampaignStream()) return;

    if (settings.claimDrops) scanDrops();
    else refreshDropCard();

    refreshQueueList();
    suppressTwitchSubscriptionPromos();

    if (settings.queueEnabled && settings.queueOnOffline && watchingLogin() && document.readyState === "complete" && !getHandoffState()) {
      const info = readStreamInfo();
      if (!info.live && now - lastStreamSwitch > 60000 && !isAutoSwitchPaused()) findNextStream();
    }

    if (settings.progressInTitle) updateTitle();

    if (!nextGqlPollAt || now >= nextGqlPollAt) {
      requestGqlPoll(pendingGqlReason || "heartbeat");
    }

    const updateState = loadUpdateState();
    if (
      updateState.checkedForVersion !== APP_VERSION ||
      now - Number(updateState.lastCheckAt || 0) >= UPDATE_CHECK_INTERVAL_MS
    ) {
      scheduleUpdateCheck();
    }
  }

  function isSubscriptionPromoText(value) {
    const text = cleanText(value);
    if (!text || text.length > 360) return false;
    return (
      /\bgift\s+(?:a\s+)?sub\b/i.test(text) ||
      /\bsubscribe(?:\s*:|\s+for|\s+to|\s+with|\s+and|\s*$)/i.test(text) ||
      /\bsub(?:scription)?\s+benefits?\b/i.test(text) ||
      /\bsub\s+for\b/i.test(text)
    );
  }

  function subscriptionPromoStyle() {
    let style = document.getElementById("dropper-subscription-promo-style");
    if (!settings.hideTwitchSubscriptionPromos) {
      style?.remove();
      return;
    }
    if (style) return;

    style = document.createElement("style");
    style.id = "dropper-subscription-promo-style";
    style.textContent = `
      button[data-a-target="subscribe-button"],
      [data-a-target="subscribe-button"],
      button[data-a-target="gift-sub-button"],
      [data-a-target="gift-sub-button"],
      button[data-a-target="gift-a-sub-button"],
      [data-a-target="gift-a-sub-button"],
      button[data-test-selector*="subscribe-button" i],
      button[data-test-selector*="gift-sub" i],
      button[aria-label^="Subscribe" i],
      button[aria-label*="Gift a Sub" i],
      [role="button"][aria-label^="Subscribe" i],
      [role="button"][aria-label*="Gift a Sub" i],
      div.highlight.highlight__collapsed:has([data-test-selector="header-content"]) {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function restoreTwitchSubscriptionPromos() {
    document.getElementById("dropper-subscription-promo-style")?.remove();
    document.querySelectorAll('[data-dropper-sub-promo-suppressed="true"]').forEach((node) => {
      const previous = node.getAttribute("data-dropper-prev-display");
      if (previous) node.style.display = previous;
      else node.style.removeProperty("display");
      node.removeAttribute("data-dropper-sub-promo-suppressed");
      node.removeAttribute("data-dropper-prev-display");
      node.removeAttribute("data-dropper-sub-promo-scope");
    });
  }

  function suppressPromoNode(node, scope) {
    if (!(node instanceof Element)) return false;
    if (node.closest("#tdh-root")) return false;
    if (node.getAttribute("data-dropper-sub-promo-suppressed") === "true") return false;

    node.setAttribute("data-dropper-prev-display", node.style.display || "");
    node.setAttribute("data-dropper-sub-promo-suppressed", "true");
    node.setAttribute("data-dropper-sub-promo-scope", scope);
    node.style.setProperty("display", "none", "important");
    suppressedSubscriptionPromoCount += 1;
    return true;
  }

  function suppressChatSubscriptionPromos() {
    const chat = findTwitchChatColumn();
    if (!chat) return 0;

    const candidates = chat.querySelectorAll([
      "button",
      '[role="button"]',
      'a[href*="/subscriptions"]',
      'a[href*="/subscribe"]',
      '[data-a-target*="subscribe" i]',
      '[data-test-selector*="subscribe" i]',
      '[aria-label*="subscribe" i]',
      '[aria-label*="sub for" i]'
    ].join(","));

    const cards = new Set();
    candidates.forEach((candidate) => {
      let node = candidate instanceof Element ? candidate : null;
      let matched = null;

      for (let depth = 0; node && node !== chat && depth < 7; depth += 1, node = node.parentElement) {
        if (node.getAttribute?.("data-dropper-sub-promo-suppressed") === "true") {
          matched = node;
          break;
        }

        const text = cleanText(node.textContent);
        if (!isSubscriptionPromoText(text)) continue;

        const rect = node.getBoundingClientRect();
        const compactCard = rect.width >= 180 && rect.height >= 36 && rect.height <= 190;
        if (compactCard) matched = node;
      }

      if (matched) cards.add(matched);
    });

    let hidden = 0;
    cards.forEach((card) => {
      if (suppressPromoNode(card, "chat")) hidden += 1;
    });
    return hidden;
  }

  function suppressPageSubscriptionPromos() {
    const chat = findTwitchChatColumn();
    const selectors = [
      'button[data-a-target*="subscribe" i]',
      'button[data-a-target*="gift-sub" i]',
      'button[data-a-target*="gift-a-sub" i]',
      'button[data-test-selector*="subscribe" i]',
      'button[data-test-selector*="gift-sub" i]',
      'button[aria-label*="subscribe" i]',
      'button[aria-label*="gift a sub" i]',
      '[role="button"][aria-label*="subscribe" i]',
      '[role="button"][aria-label*="gift a sub" i]',
      'a[href*="/subscriptions"]',
      'a[href*="/subscribe"]'
    ].join(",");

    let hidden = 0;
    document.querySelectorAll(selectors).forEach((candidate) => {
      if (!(candidate instanceof Element)) return;
      if (candidate.closest("#tdh-root")) return;
      if (chat?.contains(candidate)) return;

      const text = cleanText(
        candidate.textContent ||
        candidate.getAttribute("aria-label") ||
        candidate.getAttribute("title") ||
        ""
      );

      const explicitSelector = Boolean(
        candidate.matches?.(
          '[data-a-target="subscribe-button"], [data-a-target="gift-sub-button"], [data-a-target="gift-a-sub-button"]'
        )
      );
      if (!explicitSelector && !isSubscriptionPromoText(text)) return;

      const rect = candidate.getBoundingClientRect();
      if (rect.height > 120 || rect.width > 420) return;

      if (suppressPromoNode(candidate, "page-cta")) hidden += 1;
    });

    return hidden;
  }

  function suppressTwitchHighlightPromos() {
    let hidden = 0;
    document.querySelectorAll("div.highlight.highlight__collapsed").forEach((candidate) => {
      if (!(candidate instanceof Element)) return;
      if (candidate.closest("#tdh-root")) return;
      if (!candidate.querySelector('[data-test-selector="header-content"]')) return;
      const text = cleanText(candidate.textContent);
      const dismissible = Boolean(candidate.querySelector('button[aria-label="Dismiss This Message"]'));
      const rewardHighlight = /\bWatch for\b/i.test(text);
      if (!dismissible && !rewardHighlight) return;
      if (suppressPromoNode(candidate, "highlight")) hidden += 1;
    });
    return hidden;
  }

  function suppressTwitchSubscriptionPromos() {
    if (!settings.hideTwitchSubscriptionPromos) {
      restoreTwitchSubscriptionPromos();
      return 0;
    }

    subscriptionPromoStyle();
    const hidden = suppressChatSubscriptionPromos() + suppressPageSubscriptionPromos() + suppressTwitchHighlightPromos();
    if (hidden) {
      logActivity(
        "twitch-ui",
        "Suppressed " + hidden + " Twitch promo" + (hidden === 1 ? "" : "s"),
        { totalSuppressed: suppressedSubscriptionPromoCount }
      );
    }
    return hidden;
  }

  function watchTwitchSubscriptionPromos() {
    subscriptionPromoStyle();
    suppressTwitchSubscriptionPromos();

    if (subscriptionPromoObserver || typeof MutationObserver !== "function") return;
    let timer = null;
    subscriptionPromoObserver = new MutationObserver(() => {
      if (!settings.hideTwitchSubscriptionPromos) return;
      clearTimeout(timer);
      timer = setTimeout(() => suppressTwitchSubscriptionPromos(), 120);
    });
    subscriptionPromoObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function findTwitchChatColumn() {
    const selectors = [
      '[data-a-target="right-column"]',
      '[data-test-selector="chat-room-component-layout"]',
      '.right-column',
      '.chat-shell',
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width >= 260 && rect.height >= 120) return node;
    }
    return null;
  }

  function syncDropperWidthToChat() {
    if (!ui?.cluster) return;
    const chat = findTwitchChatColumn();
    const measured = chat ? Math.round(chat.getBoundingClientRect().width) : 312;
    const width = Math.max(280, Math.min(measured || 312, 340));
    ui.cluster.style.setProperty("--dropper-width", `${width}px`);
  }

  function watchChatWidth() {
    if (!ui?.cluster) return;
    const attach = () => {
      syncDropperWidthToChat();
      const chat = findTwitchChatColumn();
      if (!chat || typeof ResizeObserver !== "function") return;
      chatWidthObserver?.disconnect();
      chatWidthObserver = new ResizeObserver(() => {
        syncDropperWidthToChat();
        layoutChrome();
      });
      chatWidthObserver.observe(chat);
    };

    attach();
    if (chatDomObserver || typeof MutationObserver !== "function") return;
    chatDomObserver = new MutationObserver(() => {
      const chat = findTwitchChatColumn();
      if (!chat) {
        syncDropperWidthToChat();
        return;
      }
      if (!chatWidthObserver) attach();
    });
    chatDomObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function sanitizeDiagnosticMeta(value, depth = 0) {
    if (depth > 3 || value == null) return value;
    if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitizeDiagnosticMeta(item, depth + 1));
    if (typeof value !== "object") {
      if (typeof value === "string") return value.slice(0, 240);
      return value;
    }
    const clean = {};
    Object.entries(value).slice(0, 20).forEach(([key, item]) => {
      if (/token|auth|authorization|cookie|device/i.test(key)) return;
      clean[key] = sanitizeDiagnosticMeta(item, depth + 1);
    });
    return clean;
  }

  function logActivity(type, message, meta = null) {
    const entry = {
      at: Date.now(),
      type: cleanText(type || "info").slice(0, 32),
      message: cleanText(message || "").slice(0, 240),
      meta: meta ? sanitizeDiagnosticMeta(meta) : null,
    };
    activityLog = [...(Array.isArray(activityLog) ? activityLog : []), entry].slice(-ACTIVITY_LOG_LIMIT);
    writeSession(ACTIVITY_LOG_KEY, activityLog);
    return entry;
  }

  function clearActivityLog() {
    activityLog = [];
    writeSession(ACTIVITY_LOG_KEY, activityLog);
  }

  function cleanupNetworkWindow(now = Date.now()) {
    const times = Array.isArray(networkState?.requestTimes) ? networkState.requestTimes : [];
    networkState.requestTimes = times.filter((time) => Number(time) > now - NETWORK_WINDOW_MS);
  }

  function persistNetworkState() {
    cleanupNetworkWindow();
    writeSession(NETWORK_STATE_KEY, networkState);
  }

  function openNetworkCircuit(reason, durationMs) {
    const now = Date.now();
    const until = now + Math.max(1000, Number(durationMs) || CIRCUIT_ERROR_COOLDOWN_MS);
    const changed = networkState.reason !== reason || Number(networkState.openUntil || 0) < until - 1000;
    networkState.openUntil = Math.max(Number(networkState.openUntil || 0), until);
    networkState.reason = cleanText(reason || "network protection");
    networkState.lastOpenedAt = now;
    persistNetworkState();
    nextGqlPollAt = Math.max(nextGqlPollAt || 0, networkState.openUntil);
    if (changed) {
      logActivity("network", "Circuit breaker opened", {
        reason: networkState.reason,
        cooldownSeconds: Math.ceil((networkState.openUntil - now) / 1000),
      });
    }
  }

  function networkCircuitSnapshot(now = Date.now()) {
    cleanupNetworkWindow(now);

    // 2.6.11 and earlier could open the circuit merely because a local request
    // counter reached 140. That was too aggressive and could pause valid earning.
    if (networkState.reason === "hourly request budget reached") {
      const previousReason = networkState.reason;
      networkState.openUntil = 0;
      networkState.reason = "";
      networkState.consecutiveFailures = 0;
      persistNetworkState();
      logActivity("network", "Cleared legacy hourly request pause", { previousReason });
    }

    if (Number(networkState.openUntil || 0) && now >= Number(networkState.openUntil)) {
      const previousReason = networkState.reason;
      networkState.openUntil = 0;
      networkState.reason = "";
      networkState.consecutiveFailures = 0;
      persistNetworkState();
      logActivity("network", "Circuit breaker closed", { previousReason });
    }

    return {
      open: Number(networkState.openUntil || 0) > now,
      openUntil: Number(networkState.openUntil || 0),
      reason: networkState.reason || "",
      requestsLastHour: networkState.requestTimes.length,
      softBudget: NETWORK_REQUEST_SOFT_BUDGET,
      softBudgetExceeded: networkState.requestTimes.length >= NETWORK_REQUEST_SOFT_BUDGET,
      consecutiveFailures: Number(networkState.consecutiveFailures || 0),
    };
  }

  function beforeDropperNetworkRequest() {
    const state = networkCircuitSnapshot();
    if (state.open) {
      const error = new Error(`Network protection active: ${state.reason || "cooldown"}`);
      error.circuitOpen = true;
      throw error;
    }

    const now = Date.now();
    networkState.requestTimes.push(now);
    cleanupNetworkWindow(now);

    if (
      networkState.requestTimes.length >= NETWORK_REQUEST_SOFT_BUDGET &&
      now - Number(networkState.softBudgetWarnedAt || 0) >= NETWORK_WINDOW_MS
    ) {
      networkState.softBudgetWarnedAt = now;
      logActivity("network-budget", "High Dropper GQL request volume", {
        requestsLastHour: networkState.requestTimes.length,
        softBudget: NETWORK_REQUEST_SOFT_BUDGET,
      });
    }

    persistNetworkState();
  }

  function recordDropperNetworkSuccess() {
    if (networkState.consecutiveFailures) {
      logActivity("network", "Twitch GQL recovered", { previousFailures: networkState.consecutiveFailures });
    }
    networkState.consecutiveFailures = 0;
    persistNetworkState();
  }

  function recordDropperNetworkFailure(error) {
    if (error?.circuitOpen) return;
    const message = cleanText(error?.message || String(error));
    networkState.consecutiveFailures = Number(networkState.consecutiveFailures || 0) + 1;
    persistNetworkState();

    if (/\b429\b|rate.?limit|too many requests/i.test(message)) {
      openNetworkCircuit("Twitch rate limit response", CIRCUIT_RATE_COOLDOWN_MS);
    } else if (/\b401\b|\b403\b|unauthorized|forbidden/i.test(message)) {
      openNetworkCircuit("authorization failures", 10 * 60 * 1000);
    } else if (networkState.consecutiveFailures >= NETWORK_FAILURE_THRESHOLD) {
      openNetworkCircuit("repeated Twitch GQL failures", CIRCUIT_ERROR_COOLDOWN_MS);
    }

    logActivity("network-error", "Twitch GQL request failed", {
      message,
      consecutiveFailures: networkState.consecutiveFailures,
    });
  }

  function readNavigationGuard() {
    return readSession(NAVIGATION_GUARD_KEY, {
      events: [],
      blockedUntil: 0,
      lastTarget: "",
      lastReason: "",
    });
  }

  function writeNavigationGuard(state) {
    writeSession(NAVIGATION_GUARD_KEY, state);
  }

  function navigationGuardSnapshot(now = Date.now()) {
    const state = readNavigationGuard();
    const events = (Array.isArray(state.events) ? state.events : [])
      .filter((time) => Number(time) > now - AUTO_NAVIGATION_WINDOW_MS);

    if (Number(state.blockedUntil || 0) && now >= Number(state.blockedUntil)) {
      state.blockedUntil = 0;
    }

    state.events = events;
    writeNavigationGuard(state);
    return {
      ...state,
      events,
      blocked: Number(state.blockedUntil || 0) > now,
    };
  }

  function autoNavigateTwitch(url, reason = "automatic-routing") {
    if (!url || !isTrustedTwitchUrl(url)) return false;

    let target;
    let current;
    try {
      target = new URL(url, location.href);
      current = new URL(location.href);
    } catch (_) {
      return false;
    }

    const targetKey = `${target.origin}${target.pathname}${target.search}`;
    const currentKey = `${current.origin}${current.pathname}${current.search}`;
    if (targetKey === currentKey) return false;

    const now = Date.now();
    const guard = navigationGuardSnapshot(now);
    if (guard.blocked) {
      setStatus(`Auto-Switch Paused · Reload Loop Protection ${Math.ceil((guard.blockedUntil - now) / 1000)}s`);
      return false;
    }

    if (watchingLogin() && now - PAGE_STARTED_AT < STREAM_ROUTE_SETTLE_MS) {
      return false;
    }

    const events = [...guard.events, now].filter((time) => time > now - AUTO_NAVIGATION_WINDOW_MS);
    if (events.length > AUTO_NAVIGATION_LIMIT) {
      const blockedUntil = now + AUTO_NAVIGATION_COOLDOWN_MS;
      writeNavigationGuard({
        events,
        blockedUntil,
        lastTarget: targetKey,
        lastReason: reason,
      });
      logActivity("navigation-guard", "Automatic routing paused to stop a reload loop", {
        reason,
        target: target.pathname,
        attemptsInWindow: events.length,
        cooldownSeconds: Math.round(AUTO_NAVIGATION_COOLDOWN_MS / 1000),
      });
      setStatus("Auto-Switch Paused · Reload Loop Protection");
      return false;
    }

    writeNavigationGuard({
      events,
      blockedUntil: 0,
      lastTarget: targetKey,
      lastReason: reason,
    });

    logActivity("navigation", "Automatic Twitch navigation", {
      reason,
      from: current.pathname,
      to: target.pathname,
    });
    location.assign(target.href);
    return true;
  }

  function normalizedHandoffState(pending) {
    const raw = pending?.state || pending?.stage || HANDOFF_STATES.CHECKING_GAME;
    if (raw === "directory") return HANDOFF_STATES.FINDING_STREAM;
    if (raw === "retry") return HANDOFF_STATES.SELECTING_GAME;
    return raw;
  }

  function getHandoffState() {
    return readSession(NEXT_GAME_KEY, null);
  }

  function transitionHandoff(state, patch = {}, note = "") {
    const previous = getHandoffState();
    const next = {
      ...(previous || {}),
      ...patch,
      state,
      stage: state,
      startedAt: Number(previous?.startedAt || patch.startedAt || Date.now()),
      stateStartedAt: Date.now(),
    };
    writeSession(NEXT_GAME_KEY, next);
    logActivity("handoff", note || `${normalizedHandoffState(previous)} → ${state}`, {
      from: normalizedHandoffState(previous),
      to: state,
      targetGame: next.targetGame || null,
      targetStream: next.targetStream || null,
      skippedGames: next.skippedGames || [],
    });
    return next;
  }

  function clearHandoff(reason = "Handoff finished") {
    const previous = getHandoffState();
    if (previous) {
      logActivity("handoff", reason, {
        state: normalizedHandoffState(previous),
        targetGame: previous.targetGame || null,
        targetStream: previous.targetStream || null,
      });
    }
    writeSession(NEXT_GAME_KEY, null);
  }

  const PASSIVE_GQL_OPERATIONS = new Set([
    GQL_OPS.inventory.name,
    GQL_OPS.currentDrop.name,
    GQL_OPS.availableDrops.name,
    GQL_OPS.claimDrop.name,
  ]);

  function twitchGqlOperationNames(input, init) {
    try {
      const raw = typeof init?.body === "string"
        ? init.body
        : typeof input?.body === "string"
          ? input.body
          : "";
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows
        .map((row) => cleanText(row?.operationName || ""))
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function shouldInspectTwitchGql(input, init) {
    try {
      const requestUrl = typeof input === "string" ? input : input?.url || "";
      const parsed = new URL(requestUrl, location.href);
      if (parsed.hostname.toLowerCase() !== "gql.twitch.tv") return false;

      const operations = twitchGqlOperationNames(input, init);
      if (!operations.length) return false;
      return operations.some((name) => PASSIVE_GQL_OPERATIONS.has(name));
    } catch (_) {
      return false;
    }
  }

  function hookAuth(uw) {
    const origFetch = uw.fetch.bind(uw);
    uw.fetch = function hookedFetch(input, init) {
      captureAuth(input, init);
      const inspect = shouldInspectTwitchGql(input, init);
      const responsePromise = origFetch.apply(this, arguments);
      if (inspect) {
        Promise.resolve(responsePromise)
          .then((response) => captureTwitchGqlResponse(input, response))
          .catch(() => {});
      }
      return responsePromise;
    };
  }

  function captureTwitchGqlResponse(input, response) {
    try {
      const requestUrl = typeof input === "string" ? input : input?.url || "";
      const parsed = new URL(requestUrl, location.href);
      if (parsed.hostname.toLowerCase() !== "gql.twitch.tv" || !response?.clone) return;
      response.clone().json().then(ingestTwitchGqlPayload).catch(() => {});
    } catch (_) {
      /* ignore */
    }
  }

  function ingestTwitchGqlPayload(payload) {
    lastTwitchGqlAt = Date.now();
    const rows = Array.isArray(payload) ? payload : [payload];
    let inventoryCampaigns = null;

    for (const row of rows) {
      const campaigns = row?.data?.currentUser?.inventory?.dropCampaignsInProgress;
      if (Array.isArray(campaigns)) {
        inventoryCampaigns = campaigns;
        lastInventoryCampaigns = campaigns;
      }

      const sessionDrop = parseSessionDrop(row, inventoryCampaigns || lastInventoryCampaigns);
      if (sessionDrop) applyDrop(sessionDrop);
    }

    if (!inventoryCampaigns?.length) return;
    const preferredGame = cleanText(currentDrop?.game).toLowerCase();
    const candidate = pickTimedDrop(inventoryCampaigns, currentDrop?.game || "");
    if (!candidate) return;
    if (preferredGame && cleanText(candidate.game).toLowerCase() !== preferredGame) return;
    applyDrop(candidate);
  }

  function captureAuth(input, init) {
    try {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const auth = headers.get("Authorization") || headers.get("authorization");
      if (auth && /OAuth\s+/i.test(auth)) capturedToken = auth.replace(/OAuth\s+/i, "").trim();
      const device = headers.get("X-Device-Id") || headers.get("Client-Device-Id");
      if (device) capturedDevice = device;
    } catch (_) {
      /* ignore */
    }
  }

  function cookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function getToken() {
    return capturedToken || cookie("auth-token");
  }

  function watchingLogin() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (!parts.length || RESERVED.has(parts[0].toLowerCase())) return "";
    return parts[0].toLowerCase();
  }

  function gqlPayload(op, variables) {
    return {
      operationName: op.name,
      variables: { ...op.variables, ...(variables || {}) },
      extensions: { persistedQuery: { version: 1, sha256Hash: op.hash } },
    };
  }

  async function gql(requests) {
    const token = getToken();
    if (!token) throw new Error("Not logged in");
    const body = requests.map((req) => gqlPayload(GQL_OPS[req.op], req.variables));
    const send = async (clientId) => {
      beforeDropperNetworkRequest();
      const headers = {
        "Client-ID": clientId,
        Authorization: `OAuth ${token}`,
        "X-Device-Id": capturedDevice || cookie("unique_id") || "tdh-device",
        "Content-Type": "application/json",
      };
      const payload = JSON.stringify(body);

      const parseRows = (json, status = 200) => {
        if (status < 200 || status >= 300) throw new Error(`GQL HTTP ${status}`);
        const rows = Array.isArray(json) ? json : [json];
        const fatal = rows.flatMap((row) => row?.errors || []).find((item) =>
          /PersistedQueryNotFound|Unauthorized|integrity/i.test(item?.message || ""),
        );
        if (fatal) throw new Error(fatal.message || "Twitch GQL error");
        return rows;
      };

      if (typeof GM_xmlhttpRequest === "function") {
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: GQL_URL,
            headers,
            data: payload,
            responseType: "json",
            timeout: 15000,
            onload(response) {
              try {
                let json = response.response;
                if (typeof json === "string") json = JSON.parse(json);
                if (!json && response.responseText) json = JSON.parse(response.responseText);
                resolve(parseRows(json, response.status));
              } catch (error) {
                reject(error);
              }
            },
            ontimeout() {
              reject(new Error("GQL request timed out"));
            },
            onerror(response) {
              reject(new Error(`GQL network error${response?.status ? ` (${response.status})` : ""}`));
            },
          });
        });
      }

      const response = await page.fetch(GQL_URL, {
        method: "POST",
        credentials: "include",
        headers,
        body: payload,
      });
      let json;
      try {
        json = await response.json();
      } catch (_) {
        throw new Error(`GQL HTTP ${response.status}`);
      }
      return parseRows(json, response.status);
    };
    try {
      const result = await send(CLIENT_IDS[0]);
      recordDropperNetworkSuccess();
      return result;
    } catch (error) {
      if (/401|403|integrity/i.test(error.message) && !error?.circuitOpen) {
        try {
          const fallback = await send(CLIENT_IDS[1]);
          recordDropperNetworkSuccess();
          return fallback;
        } catch (fallbackError) {
          recordDropperNetworkFailure(fallbackError);
          throw fallbackError;
        }
      }
      recordDropperNetworkFailure(error);
      throw error;
    }
  }

  function requiresSubscription(drop) {
    if (!drop) return false;
    const requiredSubs = Number(
      drop.requiredSubs ??
      drop.requiredSubscriptions ??
      drop.requiredSubscriptionCount ??
      drop.subscriptionRequirement?.requiredSubs ??
      0,
    ) || 0;
    return requiredSubs > 0;
  }

  function campaignKey(campaign) {
    const game = campaign?.game?.displayName || campaign?.game?.name || "";
    return String(campaign?.id || `${game}|${campaign?.name || ""}`).toLowerCase();
  }

  function campaignWindow(campaign, drop = null) {
    const startAt = campaign?.startAt || drop?.startAt || "";
    const endAt = campaign?.endAt || drop?.endAt || "";
    const startMs = startAt ? Date.parse(startAt) : 0;
    const endMs = endAt ? Date.parse(endAt) : 0;
    return {
      startAt,
      endAt,
      startMs: Number.isFinite(startMs) ? startMs : 0,
      endMs: Number.isFinite(endMs) ? endMs : 0,
    };
  }

  function campaignIsOpen(campaign, drop = null, now = Date.now()) {
    const window = campaignWindow(campaign, drop);
    if (window.startMs && window.startMs > now) return false;
    if (window.endMs && window.endMs <= now) return false;
    return true;
  }

  function findCampaignForDrop(campaigns, activeDrop = currentDrop) {
    if (!activeDrop) return null;
    const wantedId = String(activeDrop.campaignId || "");
    const wantedName = cleanText(activeDrop.campaign).toLowerCase();
    const wantedGame = cleanText(activeDrop.game).toLowerCase();
    const wantedDropId = String(activeDrop.id || "");

    for (const campaign of campaigns || []) {
      if (wantedId && String(campaign?.id || "") === wantedId) return campaign;
      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      if (wantedDropId && drops.some((drop) => String(drop?.id || "") === wantedDropId)) return campaign;

      const name = cleanText(campaign?.name).toLowerCase();
      const game = cleanText(campaign?.game?.displayName || campaign?.game?.name).toLowerCase();
      if (wantedName && name === wantedName && (!wantedGame || !game || game === wantedGame)) return campaign;
    }
    return null;
  }

  function campaignHasUnclaimedWatchDrops(campaign) {
    const drops = campaign?.timeBasedDrops || campaign?.drops || [];
    return drops.some((drop) => {
      const self = drop?.self || {};
      return !self.isClaimed && !requiresSubscription(drop) && Number(drop?.requiredMinutesWatched || 0) > 0;
    });
  }

  function campaignExpirySnapshot(campaigns = lastInventoryCampaigns, activeDrop = currentDrop, now = Date.now()) {
    if (!activeDrop) return null;
    const campaign = findCampaignForDrop(campaigns, activeDrop);
    const fallbackDrop = {
      endAt: activeDrop.dropEndAt || activeDrop.campaignEndAt || "",
      startAt: activeDrop.dropStartAt || activeDrop.campaignStartAt || "",
    };
    const window = campaignWindow(campaign, fallbackDrop);
    if (!window.endMs) return null;

    const hasUnclaimed = campaign
      ? campaignHasUnclaimedWatchDrops(campaign)
      : !activeDrop.isClaimed;

    const key = campaign
      ? campaignKey(campaign)
      : String(activeDrop.campaignId || `${activeDrop.game || ""}|${activeDrop.campaign || ""}`).toLowerCase();

    const graceEndsAt = window.endMs + CAMPAIGN_EXPIRY_GRACE_MS;
    return {
      campaignKey: key,
      campaignId: campaign?.id || activeDrop.campaignId || "",
      campaignName: campaign?.name || activeDrop.campaign || activeDrop.game || "Current Campaign",
      game: campaign?.game?.displayName || campaign?.game?.name || activeDrop.game || "",
      endAt: window.endAt,
      endMs: window.endMs,
      graceEndsAt,
      graceRemainingMs: Math.max(0, graceEndsAt - now),
      ended: now >= window.endMs,
      overdue: hasUnclaimed && now >= graceEndsAt,
      hasUnclaimed,
    };
  }

  function pickNextOpenCampaignDrop(campaigns, excludedCampaignKeys = [], excludedGames = []) {
    const now = Date.now();
    const excludedCampaigns = new Set((excludedCampaignKeys || []).map((key) => String(key || "").toLowerCase()).filter(Boolean));
    const excludedGameSet = new Set((excludedGames || []).map((game) => cleanText(game).toLowerCase()).filter(Boolean));
    const candidates = [];

    for (const campaign of campaigns || []) {
      const key = campaignKey(campaign);
      if (excludedCampaigns.has(key)) continue;

      const game = campaign?.game?.displayName || campaign?.game?.name || campaign?.name || "";
      if (excludedGameSet.has(cleanText(game).toLowerCase())) continue;
      if (!campaignIsOpen(campaign, null, now)) continue;

      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      for (const drop of drops) {
        const self = drop?.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop?.requiredMinutesWatched || 0);
        const current = Number(self.currentMinutesWatched || 0);
        if (required <= 0 || !campaignIsOpen(campaign, drop, now)) continue;

        const preconditionsMet = (drop.preconditionDrops || []).every((item) => {
          const other = drops.find((candidate) => candidate.id === item.id);
          return other?.self?.isClaimed;
        });
        if (!preconditionsMet) continue;

        const window = campaignWindow(campaign, drop);
        candidates.push({
          id: drop.id || "",
          dropInstanceID: self.dropInstanceID || "",
          name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop",
          game,
          gameSlug: campaign.game?.slug || "",
          gameId: campaign.game?.id || "",
          campaignId: campaign.id || "",
          campaignKey: key,
          campaign: campaign.name || game,
          campaignStartAt: campaign.startAt || "",
          campaignEndAt: campaign.endAt || drop.endAt || "",
          dropStartAt: drop.startAt || "",
          dropEndAt: drop.endAt || "",
          endMs: window.endMs || Number.MAX_SAFE_INTEGER,
          percent: Math.min(100, Math.round((current / required) * 100)),
          currentMinutes: current,
          requiredMinutes: required,
          remainingMinutes: Math.max(0, required - current),
        });
      }
    }

    const incomplete = candidates.filter((item) => Number(item.percent || 0) < 100);
    const pool = incomplete.length ? incomplete : candidates;
    pool.sort((a, b) => {
      if ((b.currentMinutes > 0) !== (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      if (a.endMs !== b.endMs) return a.endMs - b.endMs;
      return a.remainingMinutes - b.remainingMinutes;
    });
    return pool[0] || null;
  }

  function pickTimedDrop(campaigns, gameName) {
    const now = Date.now();
    const wantedGame = (gameName || "").toLowerCase();
    const options = [];
    for (const campaign of campaigns || []) {
      if (!campaignIsOpen(campaign, null, now)) continue;
      const game = campaign.game?.displayName || campaign.game?.name || campaign.name || "";
      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = Number(self.currentMinutesWatched) || 0;
        if (required <= 0 || !campaignIsOpen(campaign, drop, now)) continue;
        const pre = (drop.preconditionDrops || []).every((item) => {
          const other = drops.find((candidate) => candidate.id === item.id);
          return other?.self?.isClaimed;
        });
        if (!pre) continue;
        options.push({
          id: drop.id || "",
          dropInstanceID: self.dropInstanceID || "",
          isClaimed: Boolean(self.isClaimed),
          name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop",
          game,
          gameSlug: campaign.game?.slug || "",
          gameId: campaign.game?.id || "",
          campaignId: campaign.id || "",
          campaignKey: campaignKey(campaign),
          campaign: campaign.name || game,
          campaignStartAt: campaign.startAt || "",
          campaignEndAt: campaign.endAt || drop.endAt || "",
          dropStartAt: drop.startAt || "",
          dropEndAt: drop.endAt || "",
          percent: Math.min(100, Math.round((current / required) * 100)),
          currentMinutes: current,
          requiredMinutes: required,
          remainingMinutes: Math.max(0, required - current),
        });
      }
    }
    if (!options.length) return null;
    const matching = wantedGame
      ? options.filter((item) => item.game.toLowerCase() === wantedGame || item.campaign.toLowerCase().includes(wantedGame))
      : options;
    const pool = matching.length ? matching : options;
    const earning = pool.filter((item) => Number(item.percent || 0) < 100);
    const preferred = earning.length ? earning : pool;
    preferred.sort((a, b) => {
      if ((b.currentMinutes > 0) - (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      return a.remainingMinutes - b.remainingMinutes;
    });
    return preferred[0];
  }

  function pickRemainingGameDrop(campaigns, gameName, completedDropId = "", completedDropName = "") {
    const wantedGame = cleanText(gameName).toLowerCase();
    const completedName = cleanText(completedDropName).toLowerCase();
    const now = Date.now();
    const remaining = [];

    if (!wantedGame) return null;

    for (const campaign of campaigns || []) {
      if (!campaignIsOpen(campaign, null, now)) continue;
      const game = campaign.game?.displayName || campaign.game?.name || campaign.name || "";
      if (cleanText(game).toLowerCase() !== wantedGame) continue;

      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;

        const dropId = drop.id || "";
        const dropName = cleanText(drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop");
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = Number(self.currentMinutesWatched) || 0;

        // Ignore the just-claimed Drop while Twitch's inventory catches up.
        if (completedDropId && dropId === completedDropId) continue;
        if (!completedDropId && completedName && dropName.toLowerCase() === completedName && current >= required) continue;

        if (required <= 0 || !campaignIsOpen(campaign, drop, now)) continue;

        remaining.push({
          id: dropId,
          name: dropName,
          game,
          campaign: campaign.name || game,
          currentMinutes: current,
          requiredMinutes: required,
          remainingMinutes: Math.max(0, required - current),
        });
      }
    }

    remaining.sort((a, b) => {
      if ((b.currentMinutes > 0) !== (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      return a.remainingMinutes - b.remainingMinutes;
    });
    return remaining[0] || null;
  }

  function pickNextGameDrop(campaigns, completedGame, excludedGames = []) {
    const previous = cleanText(completedGame).toLowerCase();
    const excluded = new Set((excludedGames || []).map((game) => cleanText(game).toLowerCase()).filter(Boolean));
    const next = [];
    const now = Date.now();

    for (const campaign of campaigns || []) {
      if (!campaignIsOpen(campaign, null, now)) continue;
      const game = campaign.game?.displayName || campaign.game?.name || campaign.name || "";
      const normalizedGame = cleanText(game).toLowerCase();
      if (!game || normalizedGame === previous || excluded.has(normalizedGame)) continue;

      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = Number(self.currentMinutesWatched) || 0;
        if (required <= 0 || !campaignIsOpen(campaign, drop, now)) continue;

        const preconditionsMet = (drop.preconditionDrops || []).every((item) => {
          const other = drops.find((candidate) => candidate.id === item.id);
          return other?.self?.isClaimed;
        });
        if (!preconditionsMet) continue;

        next.push({
          id: drop.id || "",
          name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop",
          game,
          gameSlug: campaign.game?.slug || "",
          gameId: campaign.game?.id || "",
          campaignId: campaign.id || "",
          campaignKey: campaignKey(campaign),
          campaign: campaign.name || game,
          campaignStartAt: campaign.startAt || "",
          campaignEndAt: campaign.endAt || drop.endAt || "",
          dropStartAt: drop.startAt || "",
          dropEndAt: drop.endAt || "",
          currentMinutes: current,
          requiredMinutes: required,
          remainingMinutes: Math.max(0, required - current),
        });
      }
    }

    next.sort((a, b) => {
      if ((b.currentMinutes > 0) !== (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      return a.remainingMinutes - b.remainingMinutes;
    });
    return next[0] || null;
  }

  function maybeAdvanceExpiredCampaign(campaigns = lastInventoryCampaigns) {
    if (!settings.findNextStream || !currentDrop) return false;

    const expiry = campaignExpirySnapshot(campaigns, currentDrop);
    if (!expiry?.ended || !expiry.hasUnclaimed) return false;

    if (!expiry.overdue) {
      if (currentDrop.percent >= 100) {
        setStatus(`Campaign Ended · Claim Grace ${Math.ceil(expiry.graceRemainingMs / 1000)}s`);
      }
      return false;
    }

    const pending = getHandoffState();
    const state = normalizedHandoffState(pending);
    if (pending && [
      HANDOFF_STATES.SELECTING_GAME,
      HANDOFF_STATES.FINDING_STREAM,
      HANDOFF_STATES.SWITCHING,
      HANDOFF_STATES.VERIFYING,
    ].includes(state)) {
      return false;
    }

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: currentDrop.game || expiry.game,
        completedDrop: currentDrop.name || "Drop",
        completedDropId: currentDrop.id || "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: pending?.skippedGames || [],
        forceOpenCampaign: true,
        expiredCampaignKey: expiry.campaignKey,
        expiredCampaignName: expiry.campaignName,
        excludedCampaignKeys: [...new Set([...(pending?.excludedCampaignKeys || []), expiry.campaignKey].filter(Boolean))],
        startedAt: pending?.startedAt || Date.now(),
      },
      `${expiry.campaignName} ended with unclaimed rewards · advancing after 60s grace`,
    );

    logActivity("campaign-expiry", "Campaign claim grace expired · selecting next open campaign", {
      campaign: expiry.campaignName,
      game: expiry.game,
      endedAt: expiry.endAt,
      graceSeconds: Math.round(CAMPAIGN_EXPIRY_GRACE_MS / 1000),
    });
    setStatus(`${expiry.campaignName} Ended · Finding Next Open Campaign`);
    notifyUser("Campaign Ended · Moving To Next Open Drops Campaign");
    return continueToNextGame(campaigns);
  }

  function scheduleNextGameAfterClaim(drop) {
    const game = cleanText(drop?.game);
    if (!settings.findNextStream || !game) return;
    transitionHandoff(
      HANDOFF_STATES.CHECKING_GAME,
      {
        completedGame: game,
        completedDrop: drop?.name || "Drop",
        completedDropId: drop?.id || "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: [],
        startedAt: Date.now(),
      },
      `Claimed ${drop?.name || "Drop"} · checking remaining ${game} Drops`,
    );
    setStatus(`${game} Drop Claimed · Checking Remaining Drops`);
    queueGqlPollSoon("drop-claimed", 5000);
  }

  function isDirectoryCategoryPage() {
    return location.pathname.toLowerCase().startsWith("/directory/category/");
  }

  function normalizeGameName(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function gameNamesMatch(a, b) {
    const left = normalizeGameName(a);
    const right = normalizeGameName(b);
    if (!left || !right) return true;
    if (left === right) return true;
    if (left.length >= 6 && right.includes(left)) return true;
    if (right.length >= 6 && left.includes(right)) return true;
    return false;
  }

  function resetCategoryMismatch() {
    categoryMismatchSince = 0;
    categoryMismatchSignature = "";
  }

  function maybeRecoverCategoryMismatch() {
    if (!settings.findNextStream || !settings.queueOnCategoryChange || !currentDrop || currentDrop.percent >= 100) {
      resetCategoryMismatch();
      return false;
    }

    const login = watchingLogin();
    if (!login) {
      resetCategoryMismatch();
      return false;
    }

    const info = readStreamInfo();
    const expectedGame = cleanText(currentDrop.game);
    const actualGame = cleanText(info.game);

    if (!info.live || !expectedGame || !actualGame || gameNamesMatch(expectedGame, actualGame)) {
      resetCategoryMismatch();
      return false;
    }

    const signature = `${login}|${normalizeGameName(expectedGame)}|${normalizeGameName(actualGame)}`;
    const now = Date.now();
    if (categoryMismatchSignature !== signature) {
      categoryMismatchSignature = signature;
      categoryMismatchSince = now;
      logActivity("category-mismatch", "Live channel changed away from active Drop game", {
        channel: login,
        expectedGame,
        actualGame,
        campaign: currentDrop.campaign || null,
      });
    }

    const age = now - categoryMismatchSince;
    if (age < CATEGORY_MISMATCH_GRACE_MS) {
      const secondsLeft = Math.max(1, Math.ceil((CATEGORY_MISMATCH_GRACE_MS - age) / 1000));
      setStatus(`Category Changed To ${actualGame} · Replacing Stream In ${secondsLeft}s`);
      return false;
    }

    const pending = getHandoffState();
    const pendingState = normalizedHandoffState(pending);
    if (pending && [
      HANDOFF_STATES.FINDING_STREAM,
      HANDOFF_STATES.SWITCHING,
      HANDOFF_STATES.VERIFYING,
    ].includes(pendingState)) {
      return true;
    }

    transitionHandoff(
      HANDOFF_STATES.FINDING_STREAM,
      {
        completedGame: expectedGame,
        completedDrop: currentDrop.name || "Drop",
        completedDropId: currentDrop.id || "",
        targetGame: expectedGame,
        targetSlug: resolveCategorySlug(currentDrop),
        targetStream: "",
        targetCampaign: currentDrop.campaign || "",
        targetCampaignKey: currentDrop.campaignKey || "",
        recoveryReason: "category-mismatch",
        previousStream: login,
        previousStreamGame: actualGame,
        skippedGames: pending?.skippedGames || [],
        startedAt: pending?.startedAt || now,
      },
      `${login} changed from ${expectedGame} to ${actualGame} · finding replacement stream`,
    );

    logActivity("stream-recovery", "Finding replacement stream for active campaign", {
      previousChannel: login,
      expectedGame,
      actualGame,
      campaign: currentDrop.campaign || null,
    });

    setStatus(`Category Changed · Finding Another ${expectedGame} Drops Stream`);
    notifyUser(`Channel Changed Category · Finding Another ${expectedGame} Stream`);
    resetCategoryMismatch();

    const directoryUrl = gameDirectoryUrl(currentDrop);
    if (directoryUrl) {
      autoNavigateTwitch(directoryUrl, "automatic-routing");
      return true;
    }

    autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
    return true;
  }

  function loadCategorySlugCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CATEGORY_SLUG_CACHE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveCategorySlugCache() {
    try {
      localStorage.setItem(CATEGORY_SLUG_CACHE_KEY, JSON.stringify(categorySlugCache));
    } catch (_) {
      /* ignore */
    }
  }

  function categorySlugFromUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      const host = parsed.hostname.toLowerCase();
      if (
        parsed.protocol !== "https:" ||
        !(host === "twitch.tv" || host === "www.twitch.tv" || host.endsWith(".twitch.tv"))
      ) return "";
      const match = parsed.pathname.match(/^\/directory\/category\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : "";
    } catch (_) {
      return "";
    }
  }

  function rememberCategorySlug(gameName, slugOrUrl, source = "observed") {
    const gameKey = normalizeGameName(gameName);
    const slug = categorySlugFromUrl(slugOrUrl) || normalizedGameSlug(slugOrUrl);
    if (!gameKey || !slug) return "";

    if (categorySlugCache[gameKey] !== slug) {
      categorySlugCache[gameKey] = slug;
      saveCategorySlugCache();
      logActivity("category-route", `Learned category slug for ${gameName}`, {
        game: gameName,
        slug,
        source,
      });
    }
    return slug;
  }

  function findObservedCategorySlug(gameName) {
    const wanted = normalizeGameName(gameName);
    if (!wanted) return "";

    const links = [
      document.querySelector('[data-a-target="stream-game-link"]'),
      ...document.querySelectorAll('a[href*="/directory/category/"]'),
    ].filter(Boolean);

    for (const link of links) {
      const text = cleanText(
        link.textContent ||
        link.getAttribute?.("aria-label") ||
        link.getAttribute?.("title") ||
        "",
      );
      if (text && !gameNamesMatch(gameName, text)) continue;

      const slug = categorySlugFromUrl(link.href);
      if (slug) return rememberCategorySlug(gameName, slug, "twitch-link");
    }
    return "";
  }

  function resolveCategorySlug(dropOrGame) {
    const gameName = typeof dropOrGame === "string"
      ? cleanText(dropOrGame)
      : cleanText(dropOrGame?.game || "");

    if (!gameName) return "";

    const gameKey = normalizeGameName(gameName);

    const observed = findObservedCategorySlug(gameName);
    if (observed) return observed;

    const cached = cleanText(categorySlugCache[gameKey] || "");
    if (cached) return normalizedGameSlug(cached);

    const alias = cleanText(CATEGORY_SLUG_ALIASES[gameKey] || "");
    if (alias) {
      rememberCategorySlug(gameName, alias, "canonical-alias");
      return normalizedGameSlug(alias);
    }

    const supplied = typeof dropOrGame === "object"
      ? cleanText(dropOrGame?.gameSlug || "")
      : "";
    if (supplied) {
      const resolved = normalizedGameSlug(supplied);
      if (resolved) rememberCategorySlug(gameName, resolved, "twitch-gql");
      return resolved;
    }

    // Conservative last resort for games whose Twitch category slug follows
    // the ordinary lowercase/hyphen convention. Learned/aliased slugs always win.
    return normalizedGameSlug(gameName);
  }

  function gameDirectoryUrl(drop) {
    const slug = resolveCategorySlug(drop);
    if (!slug) {
      logActivity("category-route", "Could not resolve Twitch category slug", {
        game: drop?.game || null,
        campaign: drop?.campaign || null,
      });
      return "";
    }
    return `https://www.twitch.tv/directory/category/${encodeURIComponent(slug)}`;
  }

  function twitchChannelHref(url) {
    if (!isTrustedTwitchUrl(url)) return "";
    try {
      const parsed = new URL(url, location.href);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length !== 1) return "";
      const login = parts[0].toLowerCase();
      if (!login || RESERVED.has(login)) return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  function streamLoginFromUrl(url) {
    const href = twitchChannelHref(url);
    if (!href) return "";
    try {
      return new URL(href).pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
    } catch (_) {
      return "";
    }
  }

  function currentDirectorySlug() {
    const match = location.pathname.match(/^\/directory\/category\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).toLowerCase() : "";
  }

  function normalizedGameSlug(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function collectDirectoryStreamCandidates(gameName, gameSlug = "", excludedStreams = []) {
    const wantedGame = normalizeGameName(gameName);
    const wantedSlug = resolveCategorySlug({ game: gameName, gameSlug });
    const pageSlug = currentDirectorySlug();
    const pageIsTargetCategory = Boolean(
      isDirectoryCategoryPage() &&
      wantedSlug &&
      (pageSlug === wantedSlug || pageSlug.includes(wantedSlug) || wantedSlug.includes(pageSlug))
    );
    const excluded = new Set((excludedStreams || []).map((login) => cleanText(login).toLowerCase()).filter(Boolean));
    const candidates = [];
    const seen = new Set();

    const links = [
      ...document.querySelectorAll(
        'a[data-a-target="preview-card-channel-link"], a[data-test-selector*="channel-link"]',
      ),
    ];

    for (const link of links) {
      const href = twitchChannelHref(link.href);
      if (!href) continue;
      const login = streamLoginFromUrl(href);
      if (!login || excluded.has(login) || seen.has(login)) continue;
      seen.add(login);

      const card =
        link.closest(
          'article, [data-a-target="preview-card"], [data-test-selector*="preview-card"], [class*="preview-card"]',
        ) ||
        link.parentElement?.parentElement?.parentElement ||
        link.parentElement;

      const text = cleanText(card?.textContent);
      const normalizedText = normalizeGameName(text);
      const hasDropsTag = Boolean(
        card?.querySelector?.(
          'a[href*="DropsEnabled"], [data-a-target*="Drops"], [data-test-selector*="Drops"], [aria-label*="Drops"]',
        ),
      ) || /\bdrops\s*enabled\b/i.test(text);

      const gameMatches =
        pageIsTargetCategory ||
        !wantedGame ||
        !normalizedText ||
        normalizedText.includes(wantedGame);

      if (!gameMatches) continue;
      const viewerMatch = text.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
      const viewers = viewerMatch ? Number(viewerMatch[1].replace(/,/g, "")) || 0 : 0;
      candidates.push({
        login,
        href,
        label: login,
        viewers,
        dropsTagged: hasDropsTag,
        game: gameName,
        gameSlug: wantedSlug,
      });
    }

    candidates.sort((a, b) => {
      if (Boolean(b.dropsTagged) !== Boolean(a.dropsTagged)) return Number(Boolean(b.dropsTagged)) - Number(Boolean(a.dropsTagged));
      if (settings.queuePreference === "Lowest Viewers") return (a.viewers || Number.MAX_SAFE_INTEGER) - (b.viewers || Number.MAX_SAFE_INTEGER);
      if (settings.queuePreference === "Highest Viewers") return (b.viewers || 0) - (a.viewers || 0);
      return 0;
    });

    const pending = getHandoffState();
    rememberStandbyCandidates(candidates, {
      game: gameName,
      gameSlug: wantedSlug,
      campaignKey: pending?.targetCampaignKey || currentDrop?.campaignKey || "",
    });

    return candidates;
  }

  function findEligibleDirectoryStream(gameName, gameSlug = "", excludedStreams = []) {
    const candidates = collectDirectoryStreamCandidates(gameName, gameSlug, excludedStreams);
    const chosen = candidates[0] || null;
    if (chosen && !chosen.dropsTagged) {
      logActivity("stream-candidate", "Trying category stream without visible Drops badge", {
        game: gameName || null,
        stream: chosen.login || null,
        excludedStreams: excludedStreams || [],
      });
    }
    return chosen?.href || "";
  }

  function campaignMatchesTarget(campaign, pending) {
    if (!campaign || !pending) return false;
    const targetKey = String(pending.targetCampaignKey || "");
    const targetName = normalizeGameName(pending.targetCampaign || "");
    const targetGame = normalizeGameName(pending.targetGame || "");

    if (targetKey && campaignKey(campaign) === targetKey) return true;
    if (targetKey && String(campaign.id || "") === targetKey) return true;

    const campaignName = normalizeGameName(campaign.name || "");
    const campaignGame = normalizeGameName(campaign.game?.displayName || campaign.game?.name || "");
    return Boolean(
      targetName &&
      campaignName === targetName &&
      (!targetGame || !campaignGame || gameNamesMatch(targetGame, campaignGame))
    );
  }

  function channelSupportsTargetCampaign(availableCampaigns, pending) {
    if (!pending) return null;
    if (!Array.isArray(availableCampaigns) || !availableCampaigns.length) return null;
    return availableCampaigns.some((campaign) => campaignMatchesTarget(campaign, pending));
  }

  function retryLockedCampaignStream(pending, reason) {
    if (!pending?.targetGame) return false;
    const failedStreams = [...new Set([
      ...(pending.failedStreams || []),
      pending.targetStream,
    ].filter(Boolean))];

    transitionHandoff(
      HANDOFF_STATES.FINDING_STREAM,
      {
        targetGame: pending.targetGame,
        targetSlug: pending.targetSlug || resolveCategorySlug({ game: pending.targetGame }),
        targetStream: "",
        targetCampaign: pending.targetCampaign || currentDrop?.campaign || "",
        targetCampaignKey: pending.targetCampaignKey || currentDrop?.campaignKey || "",
        failedStreams,
        lockActiveCampaign: true,
        recoveryReason: pending.recoveryReason || "active-campaign",
      },
      reason || `Trying another ${pending.targetGame} Drops stream`,
    );

    const url = gameDirectoryUrl({
      game: pending.targetGame,
      gameSlug: pending.targetSlug || currentDrop?.gameSlug || "",
    });
    if (url && location.href !== url) autoNavigateTwitch(url, "automatic-routing");
    return true;
  }

  function continueDirectoryHandoffFromDom() {
    const pending = getHandoffState();
    if (!pending || normalizedHandoffState(pending) !== HANDOFF_STATES.FINDING_STREAM || !isDirectoryCategoryPage()) return false;

    const stateStartedAt = Number(pending.stateStartedAt || pending.stageStartedAt || pending.startedAt || Date.now());
    const stageAge = Date.now() - stateStartedAt;
    if (stageAge > HANDOFF_STAGE_TIMEOUT_MS) {
      if (pending.lockActiveCampaign) {
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            failedStreams: [],
            retryCount: Number(pending.retryCount || 0) + 1,
          },
          `Still searching for ${pending.targetGame || "active campaign"} streams · retrying category candidates`,
        );
        setStatus(`Waiting For A Compatible ${pending.targetGame || "Drops"} Stream`);
        queueGqlPollSoon("active-stream-search", GQL_RECOVERY_INTERVAL_MS);
        return false;
      }

      const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        {
          targetGame: "",
          targetSlug: "",
          targetStream: "",
          skippedGames,
        },
        `No Drops stream found for ${pending.targetGame || "target game"} · selecting another game`,
      );
      setStatus(`No Drops Stream Found For ${pending.targetGame || "Target Game"} · Trying Next Game`);
      notifyUser(`Skipping ${pending.targetGame || "Unavailable Game"} · Trying Next Eligible Game`);
      autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
      return true;
    }

    const href = findEligibleDirectoryStream(
      pending.targetGame || "",
      pending.targetSlug || "",
      pending.failedStreams || [],
    );
    if (!href) {
      const secondsLeft = Math.max(0, Math.ceil((HANDOFF_STAGE_TIMEOUT_MS - stageAge) / 1000));
      setStatus(`Finding A Drops Stream For ${pending.targetGame || "Next Game"} · ${secondsLeft}s`);
      return false;
    }

    const targetStream = streamLoginFromUrl(href);
    transitionHandoff(
      HANDOFF_STATES.SWITCHING,
      {
        targetStream,
        switchStartedAt: Date.now(),
        verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
        verifyBaselinePercent: Number(currentDrop?.percent || 0),
        failedStreams: pending.failedStreams || [],
      },
      `Trying stream ${targetStream || "channel"} for ${pending.targetGame || "next game"}`,
    );
    lastStreamSwitch = Date.now();
    setStatus(`Opening ${pending.targetGame || "Next Game"} Drops Stream`);
    notifyUser(`Moving To ${pending.targetGame || "Next Game"}`);
    autoNavigateTwitch(href, "automatic-routing");
    return true;
  }

  function watchDirectoryHandoff() {
    if (!isDirectoryCategoryPage()) return;
    let timer = null;
    const scan = () => {
      clearTimeout(timer);
      timer = setTimeout(() => continueDirectoryHandoffFromDom(), 180);
    };
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    scan();
  }

  function findInventoryStreamForGame(gameName) {
    const wanted = cleanText(gameName).toLowerCase();
    if (!wanted) return "";
    const cards = [
      ...document.querySelectorAll(".inventory-max-width > div:not(:first-child)"),
      ...document.querySelectorAll("[data-test-selector*='DropsCampaign']"),
      ...document.querySelectorAll("[class*='drops-campaign']"),
    ];

    for (const card of cards) {
      if (!cleanText(card.textContent).toLowerCase().includes(wanted)) continue;
      for (const link of card.querySelectorAll("a[href]")) {
        const href = twitchChannelHref(link.href);
        if (href) return href;
      }
    }
    return "";
  }

  function dropMatchesHandoffTarget(drop, pending) {
    if (!drop || !pending) return false;
    if (pending.targetGame && !gameNamesMatch(pending.targetGame, drop.game || "")) return false;

    const targetKey = String(pending.targetCampaignKey || "");
    if (
      targetKey &&
      drop.campaignKey !== targetKey &&
      drop.campaignId !== targetKey
    ) {
      const targetName = normalizeGameName(pending.targetCampaign || "");
      const dropName = normalizeGameName(drop.campaign || "");
      if (!targetName || targetName !== dropName) return false;
    }
    return true;
  }

  function creditedProgressProvesStream(drop, pending, previousDrop = null) {
    if (!dropMatchesHandoffTarget(drop, pending)) return false;

    const currentMinutes = Number(drop.currentMinutes);
    const currentPercent = Number(drop.percent);
    const baselineMinutes = Number(pending.verifyBaselineMinutes);
    const baselinePercent = Number(pending.verifyBaselinePercent);

    const minutesAdvanced = Number.isFinite(currentMinutes) && (
      (Number.isFinite(baselineMinutes) && currentMinutes > baselineMinutes) ||
      (
        previousDrop &&
        dropMatchesHandoffTarget(previousDrop, pending) &&
        currentMinutes > Number(previousDrop.currentMinutes || 0)
      )
    );

    const percentAdvanced = Number.isFinite(currentPercent) && (
      (Number.isFinite(baselinePercent) && currentPercent > baselinePercent) ||
      (
        previousDrop &&
        dropMatchesHandoffTarget(previousDrop, pending) &&
        currentPercent > Number(previousDrop.percent || 0)
      )
    );

    const switchAt = Number(pending.switchStartedAt || pending.verifyStartedAt || 0);
    const creditedAfterSwitch = Boolean(
      switchAt &&
      lastProgressAt > switchAt + 250 &&
      dropMatchesHandoffTarget(drop, pending)
    );

    return minutesAdvanced || percentAdvanced || creditedAfterSwitch;
  }

  function completeVerifiedHandoff(pending, method, details = {}) {
    if (!pending) return false;
    const channel = watchingLogin() || pending.targetStream || "";
    lastStreamVerification = {
      at: Date.now(),
      method,
      channel: channel || null,
      game: pending.targetGame || currentDrop?.game || null,
      campaign: pending.targetCampaign || currentDrop?.campaign || null,
      ...sanitizeDiagnosticMeta(details),
    };

    transitionHandoff(
      HANDOFF_STATES.COMPLETE,
      {},
      `Verified ${channel || "stream"} for ${pending.targetCampaign || pending.targetGame}`,
    );
    clearHandoff(`Active campaign stream verified for ${pending.targetGame}`);
    logActivity("stream-verified", "Compatible Drops stream verified", {
      method,
      channel: channel || null,
      game: pending.targetGame || null,
      campaign: pending.targetCampaign || null,
      ...details,
    });
    return true;
  }

  function verifyHandoffWithCreditedProgress(drop, previousDrop = null) {
    const pending = getHandoffState();
    if (!pending) return false;
    const state = normalizedHandoffState(pending);
    if (state !== HANDOFF_STATES.SWITCHING && state !== HANDOFF_STATES.VERIFYING) return false;
    if (!creditedProgressProvesStream(drop, pending, previousDrop)) return false;

    return completeVerifiedHandoff(pending, "credited-progress", {
      baselineMinutes: Number.isFinite(Number(pending.verifyBaselineMinutes)) ? Number(pending.verifyBaselineMinutes) : null,
      currentMinutes: Number.isFinite(Number(drop.currentMinutes)) ? Number(drop.currentMinutes) : null,
      baselinePercent: Number.isFinite(Number(pending.verifyBaselinePercent)) ? Number(pending.verifyBaselinePercent) : null,
      currentPercent: Number.isFinite(Number(drop.percent)) ? Number(drop.percent) : null,
    });
  }

  function verifyHandoffFromInventory(campaigns) {
    const pending = getHandoffState();
    if (!pending || !pending.lockActiveCampaign) return false;
    const state = normalizedHandoffState(pending);
    if (state !== HANDOFF_STATES.SWITCHING && state !== HANDOFF_STATES.VERIFYING) return false;

    const info = readStreamInfo();
    if (!info.live || !info.game || !gameNamesMatch(pending.targetGame || "", info.game)) return false;

    const targetDropId = pending.completedDropId || currentDrop?.id || "";
    for (const campaign of campaigns || []) {
      if (!campaignMatchesTarget(campaign, pending)) continue;
      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const raw of drops) {
        if (targetDropId && raw.id !== targetDropId) continue;
        const required = Number(raw.requiredMinutesWatched || currentDrop?.requiredMinutes || 0);
        const minutes = Number(raw.self?.currentMinutesWatched || 0);
        const percent = required ? Math.min(100, Math.round((minutes / required) * 100)) : 0;
        const proof = {
          id: raw.id || targetDropId,
          game: campaign.game?.displayName || campaign.game?.name || pending.targetGame || "",
          campaignId: campaign.id || "",
          campaignKey: campaignKey(campaign),
          campaign: campaign.name || pending.targetCampaign || "",
          currentMinutes: minutes,
          requiredMinutes: required,
          percent,
        };
        if (creditedProgressProvesStream(proof, pending, currentDrop)) {
          return completeVerifiedHandoff(pending, "inventory-progress", {
            currentMinutes: minutes,
            currentPercent: percent,
          });
        }
      }
    }
    return false;
  }

  function verifyHandoffChannel(login, streamGame, availableCampaigns, sessionDrop) {
    const pending = getHandoffState();
    if (!pending) return false;
    const state = normalizedHandoffState(pending);
    if (state !== HANDOFF_STATES.SWITCHING && state !== HANDOFF_STATES.VERIFYING) return false;

    const targetGame = pending.targetGame || "";
    const gameMatches = Boolean(targetGame && streamGame && gameNamesMatch(targetGame, streamGame));
    const campaignSupport = channelSupportsTargetCampaign(availableCampaigns, pending);
    const sessionMatches = Boolean(
      sessionDrop &&
      gameNamesMatch(targetGame, sessionDrop.game || "") &&
      (
        !pending.targetCampaignKey ||
        sessionDrop.campaignKey === pending.targetCampaignKey ||
        sessionDrop.campaignId === pending.targetCampaignKey
      )
    );
    const creditedProgress = creditedProgressProvesStream(currentDrop, pending);

    if (gameMatches && (campaignSupport === true || sessionMatches || creditedProgress)) {
      completeVerifiedHandoff(
        pending,
        creditedProgress ? "credited-progress" : sessionMatches ? "session-match" : "available-campaign",
        {
          streamGame: streamGame || null,
          campaignSupport,
        },
      );
      return false;
    }

    const startedAt = Number(
      pending.verifyStartedAt ||
      pending.switchStartedAt ||
      pending.stateStartedAt ||
      Date.now()
    );

    if (state === HANDOFF_STATES.VERIFYING && Date.now() - startedAt > ACTIVE_STREAM_VERIFY_TIMEOUT_MS) {
      if (pending.lockActiveCampaign) {
        logActivity("stream-rejected", "Stream did not verify for active campaign", {
          channel: pending.targetStream || login || null,
          targetGame: pending.targetGame || null,
          streamGame: streamGame || null,
          campaignSupport,
        });
        retryLockedCampaignStream(
          pending,
          `Rejected ${pending.targetStream || login || "stream"} · trying another ${pending.targetGame} channel`,
        );
        return true;
      }

      const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        { targetGame: "", targetSlug: "", targetStream: "", skippedGames },
        `Could not verify ${pending.targetGame || "target game"} after switching`,
      );
      autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
      return true;
    }
    return false;
  }

  function adoptSelectedTargetDrop(next, reason = "target-selected") {
    if (!next) return false;

    const previous = currentDrop;
    const required = Number(next.requiredMinutes || 0);
    const current = Math.max(0, Number(next.currentMinutes || 0));
    const percent = Number.isFinite(Number(next.percent))
      ? Math.max(0, Math.min(100, Number(next.percent)))
      : required
        ? Math.max(0, Math.min(100, Math.round((current / required) * 100)))
        : 0;

    currentDrop = {
      ...next,
      isClaimed: Boolean(next.isClaimed),
      percent,
      currentMinutes: current,
      requiredMinutes: required,
      remainingMinutes: Math.max(0, required - current),
    };

    const resolvedSlug = resolveCategorySlug(currentDrop);
    if (resolvedSlug) currentDrop.gameSlug = resolvedSlug;

    progressLabel = `${percent}%`;
    lastProgress = percent;
    lastProgressAt = Date.now();

    writeSession("tdh-drop", currentDrop);
    writeSession("tdh-progress", percent);
    writeSession("tdh-progress-at", lastProgressAt);

    resetClaimReadyTimer();
    logActivity("target-drop", `Working Toward changed to ${currentDrop.name || "next Drop"}`, {
      reason,
      fromDrop: previous?.name || null,
      fromGame: previous?.game || null,
      toDrop: currentDrop.name || null,
      toGame: currentDrop.game || null,
      campaign: currentDrop.campaign || null,
      percent,
      currentMinutes: current,
      requiredMinutes: required,
    });

    refreshDropCard();
    layoutChrome();
    return true;
  }

  function continueToNextGame(campaigns) {
    const pending = getHandoffState();
    if (!pending) return false;

    if (!pending.startedAt || Date.now() - pending.startedAt > 15 * 60 * 1000) {
      transitionHandoff(HANDOFF_STATES.FAILED, {}, "Handoff expired after 15 minutes");
      clearHandoff("Expired handoff cleared");
      return false;
    }

    let state = normalizedHandoffState(pending);

    if (state === HANDOFF_STATES.SWITCHING) {
      const login = watchingLogin();
      if (login && (!pending.targetStream || login === pending.targetStream)) {
        transitionHandoff(
          HANDOFF_STATES.VERIFYING,
          {
            verifyStartedAt: Date.now(),
            verifyBaselineMinutes: Number.isFinite(Number(pending.verifyBaselineMinutes))
              ? Number(pending.verifyBaselineMinutes)
              : Number(currentDrop?.currentMinutes || 0),
            verifyBaselinePercent: Number.isFinite(Number(pending.verifyBaselinePercent))
              ? Number(pending.verifyBaselinePercent)
              : Number(currentDrop?.percent || 0),
          },
          `Arrived at ${login} · verifying Drop eligibility`,
        );
        return false;
      }
      const switchStartedAt = Number(pending.switchStartedAt || pending.stateStartedAt || pending.startedAt || Date.now());
      if (Date.now() - switchStartedAt > ACTIVE_STREAM_VERIFY_TIMEOUT_MS) {
        if (pending.lockActiveCampaign) {
          return retryLockedCampaignStream(
            pending,
            `Stream switch timed out · trying another ${pending.targetGame} channel`,
          );
        }
        const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          { targetGame: "", targetSlug: "", targetStream: "", skippedGames },
          `Stream switch timed out for ${pending.targetGame || "target game"} · selecting another game`,
        );
        autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
        return true;
      }
      return true;
    }

    if (state === HANDOFF_STATES.VERIFYING) {
      const verifyStartedAt = Number(pending.verifyStartedAt || pending.stateStartedAt || pending.startedAt || Date.now());
      if (Date.now() - verifyStartedAt > ACTIVE_STREAM_VERIFY_TIMEOUT_MS) {
        if (pending.lockActiveCampaign) {
          return retryLockedCampaignStream(
            pending,
            `Verification timed out · trying another ${pending.targetGame} channel`,
          );
        }
        const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          { targetGame: "", targetSlug: "", targetStream: "", skippedGames },
          `Verification timed out for ${pending.targetGame || "target game"} · selecting another game`,
        );
        setStatus(`Could Not Verify ${pending.targetGame || "Target Game"} · Trying Next Game`);
        autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
        return true;
      }
      return false;
    }

    if (state === HANDOFF_STATES.FINDING_STREAM) {
      if (isDirectoryCategoryPage()) {
        continueDirectoryHandoffFromDom();
        return true;
      }

      const currentLogin = watchingLogin();
      if (currentLogin) {
        const info = readStreamInfo();

        if (info.live && info.game && gameNamesMatch(pending.targetGame || "", info.game)) {
          transitionHandoff(
            HANDOFF_STATES.VERIFYING,
            {
              targetStream: currentLogin,
              verifyStartedAt: Date.now(),
              verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
              verifyBaselinePercent: Number(currentDrop?.percent || 0),
            },
            `Found target game on ${currentLogin} · verifying current channel in place`,
          );
          return false;
        }

        if (Date.now() - PAGE_STARTED_AT < STREAM_ROUTE_SETTLE_MS || !info.game) {
          setStatus(`Loading ${pending.targetGame || "Target"} Stream Info…`);
          return false;
        }
      }

      const targetUrl = gameDirectoryUrl({
        game: pending.targetGame,
        gameSlug: pending.targetSlug,
      });
      if (targetUrl && autoNavigateTwitch(targetUrl, "find-target-category")) return true;

      transitionHandoff(HANDOFF_STATES.SELECTING_GAME, {}, "Target game directory URL unavailable");
      state = HANDOFF_STATES.SELECTING_GAME;
    }

    if (state === HANDOFF_STATES.CHECKING_GAME) {
      const remainingCurrentGameDrop = pickRemainingGameDrop(
        campaigns,
        pending.completedGame,
        pending.completedDropId || "",
        pending.completedDrop || "",
      );

      if (remainingCurrentGameDrop) {
        clearHandoff(`Continuing ${pending.completedGame} · ${remainingCurrentGameDrop.name}`);
        setStatus(`Continuing ${pending.completedGame} · ${remainingCurrentGameDrop.name}`);
        return false;
      }

      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        {},
        `${pending.completedGame} watch-time Drops complete · selecting next game`,
      );
      state = HANDOFF_STATES.SELECTING_GAME;
    }

    if (state !== HANDOFF_STATES.SELECTING_GAME) return false;

    const current = getHandoffState() || pending;
    const next = current.forceOpenCampaign
      ? pickNextOpenCampaignDrop(
          campaigns,
          current.excludedCampaignKeys || [],
          current.skippedGames || [],
        )
      : pickNextGameDrop(campaigns, current.completedGame, current.skippedGames || []);

    if (!next) {
      if (current.forceOpenCampaign) {
        setStatus("Campaign Ended · Waiting For Next Open Eligible Campaign");
        queueGqlPollSoon("waiting-open-campaign", GQL_RECOVERY_INTERVAL_MS);
        return false;
      }
      transitionHandoff(HANDOFF_STATES.COMPLETE, {}, "No more eligible watch-time games");
      setStatus("No More Eligible Games");
      notifyUser("All Eligible Watch-Time Drops Complete");
      clearHandoff("All eligible watch-time Drops complete");
      return false;
    }

    adoptSelectedTargetDrop(
      next,
      current.claimReadyFallback ? "claim-ready-fallback" :
      current.forceOpenCampaign ? "next-open-campaign" :
      "next-game",
    );

    if (isInventory()) {
      const inventoryHref = findInventoryStreamForGame(next.game);
      if (inventoryHref) {
        const targetStream = streamLoginFromUrl(inventoryHref);
        transitionHandoff(
          HANDOFF_STATES.SWITCHING,
          {
            targetGame: next.game,
            targetSlug: next.gameSlug || "",
            targetStream,
            targetCampaign: next.campaign || "",
            targetCampaignKey: next.campaignKey || "",
            switchStartedAt: Date.now(),
            verifyBaselineMinutes: Number(next.currentMinutes || 0),
            verifyBaselinePercent: Number(next.percent || 0),
          },
          `Switching directly to ${targetStream || "eligible stream"} for ${next.game}`,
        );
        lastStreamSwitch = Date.now();
        setStatus(`Moving To ${next.game}`);
        notifyUser(`${current.completedGame} Complete · Moving To ${next.game}`);
        autoNavigateTwitch(inventoryHref, "automatic-routing");
        return true;
      }
    }

    const directoryUrl = gameDirectoryUrl(next);
    if (directoryUrl) {
      transitionHandoff(
        HANDOFF_STATES.FINDING_STREAM,
        {
          targetGame: next.game,
          targetSlug: next.gameSlug || "",
          targetStream: "",
          targetCampaign: next.campaign || "",
          targetCampaignKey: next.campaignKey || "",
          skippedGames: current.skippedGames || [],
        },
        `Searching ${next.game} directory for a Drops-enabled stream`,
      );
      setStatus(`${current.completedGame} Complete · Finding ${next.game} Stream`);
      autoNavigateTwitch(directoryUrl, "automatic-routing");
      return true;
    }

    const skippedGames = [...new Set([...(current.skippedGames || []), next.game].filter(Boolean))];
    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      { skippedGames },
      `Could not build a directory URL for ${next.game} · skipping`,
    );
    queueGqlPollSoon("handoff-retry", 5000);
    return true;
  }

  function parseSessionDrop(result, campaigns) {
    const session = result?.data?.currentUser?.dropCurrentSession || result?.data?.currentUser?.dropCurrentSessionContext || {};
    const node = session.currentSession || session.drop || session;
    const dropNode = node.drop || node.currentDrop || {};
    const dropId = dropNode.id || node.dropID || session.dropID || "";
    const current = Number(
      dropNode.self?.currentMinutesWatched ??
      dropNode.currentMinutesWatched ??
      node.currentMinutesWatched ??
      session.currentMinutesWatched,
    );
    if (!dropId && !Number.isFinite(current) && !dropNode.name) return null;
    let matched = null;
    for (const campaign of campaigns || []) {
      for (const drop of campaign.timeBasedDrops || campaign.drops || []) {
        if (dropId && drop.id === dropId) {
          matched = { campaign, drop };
          break;
        }
      }
      if (matched) break;
    }
    const drop = matched?.drop || dropNode;
    const campaign = matched?.campaign;
    if (requiresSubscription(drop)) return null;
    const required = Number(
      drop.requiredMinutesWatched ??
      node.requiredMinutesWatched ??
      session.requiredMinutesWatched,
    ) || 0;
    const minutes = Number.isFinite(current) ? current : Number(drop.self?.currentMinutesWatched) || 0;
    if (!drop.name && !required && !dropId) return null;
    return {
      id: drop.id || dropId || "",
      isClaimed: Boolean(drop.self?.isClaimed),
      name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Current drop",
      game: campaign?.game?.displayName || campaign?.game?.name || drop.game?.displayName || drop.game?.name || session.game?.displayName || session.game?.name || "",
      gameSlug: campaign?.game?.slug || "",
      campaignId: campaign?.id || "",
      campaignKey: campaign ? campaignKey(campaign) : "",
      campaign: campaign?.name || "",
      campaignStartAt: campaign?.startAt || "",
      campaignEndAt: campaign?.endAt || drop.endAt || "",
      dropStartAt: drop.startAt || "",
      dropEndAt: drop.endAt || "",
      percent: required ? Math.min(100, Math.round((minutes / required) * 100)) : 0,
      currentMinutes: minutes,
      requiredMinutes: required,
      remainingMinutes: Math.max(0, required - minutes),
      dropInstanceID:
        drop.self?.dropInstanceID ||
        drop.dropInstanceID ||
        node.dropInstanceID ||
        session.dropInstanceID ||
        "",
      session: true,
    };
  }

  function parseAvailableCampaigns(result) {
    const channel = result?.data?.channel || result?.data?.user || {};
    return channel.viewerDropCampaigns || channel.dropCampaigns || [];
  }

  function reconcileDropProgress(sessionDrop, inventoryDrop) {
    const required = Number(inventoryDrop?.requiredMinutes || sessionDrop?.requiredMinutes || 0);
    const inventoryMinutes = Number(inventoryDrop?.currentMinutes);
    const sessionMinutes = Number(sessionDrop?.currentMinutes);
    const inventoryValid = Number.isFinite(inventoryMinutes) && inventoryMinutes >= 0;
    const sessionValid = Number.isFinite(sessionMinutes) && sessionMinutes >= 0;

    let chosen = 0;
    let source = "none";

    if (inventoryValid) {
      // Twitch Inventory is the canonical Drop-progress source. Session counters
      // have repeatedly represented unrelated watch/session elapsed values, so
      // they must never override a valid Inventory watch-minute value.
      chosen = inventoryMinutes;
      source = "inventory-authoritative";
    } else if (sessionValid) {
      if (required && sessionMinutes > required) {
        chosen = 0;
        source = "session-rejected-implausible";
      } else {
        chosen = sessionMinutes;
        source = "session-fallback";
      }
    }

    if (required > 0) chosen = Math.min(required, Math.max(0, chosen));

    lastProgressReconcile = {
      at: Date.now(),
      requiredMinutes: required,
      inventoryMinutes: inventoryValid ? inventoryMinutes : null,
      sessionMinutes: sessionValid ? sessionMinutes : null,
      chosenMinutes: chosen,
      source,
    };
    return chosen;
  }

  function resetClaimReadyTimer() {
    claimReadySince = 0;
    claimReadySignature = "";
  }

  function maybeAdvanceStuckClaim(campaigns = lastInventoryCampaigns) {
    if (!settings.findNextStream || !currentDrop || currentDrop.isClaimed || Number(currentDrop.percent || 0) < 100) {
      resetClaimReadyTimer();
      return false;
    }

    const signature = [
      currentDrop.campaignKey || currentDrop.campaignId || currentDrop.campaign || "",
      currentDrop.id || currentDrop.name || "",
    ].join("|");

    const now = Date.now();
    if (claimReadySignature !== signature) {
      claimReadySignature = signature;
      claimReadySince = now;
      logActivity("claim-ready", "Completed Drop is waiting to be claimed", {
        drop: currentDrop.name || null,
        game: currentDrop.game || null,
        campaign: currentDrop.campaign || null,
        dropInstanceIdAvailable: Boolean(currentDrop.dropInstanceID),
      });
    }

    const age = now - claimReadySince;
    if (age < CLAIM_READY_GRACE_MS) {
      setStatus(`Claim Ready · Waiting For Twitch ${Math.ceil((CLAIM_READY_GRACE_MS - age) / 1000)}s`);
      return false;
    }

    const pending = getHandoffState();
    const state = normalizedHandoffState(pending);
    if (pending && [
      HANDOFF_STATES.SELECTING_GAME,
      HANDOFF_STATES.FINDING_STREAM,
      HANDOFF_STATES.SWITCHING,
      HANDOFF_STATES.VERIFYING,
    ].includes(state)) {
      return true;
    }

    const campaign = findCampaignForDrop(campaigns, currentDrop);
    const expiredKey = campaign
      ? campaignKey(campaign)
      : currentDrop.campaignKey || currentDrop.campaignId || "";

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: currentDrop.game || "",
        completedDrop: currentDrop.name || "Drop",
        completedDropId: currentDrop.id || "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: pending?.skippedGames || [],
        forceOpenCampaign: true,
        claimReadyFallback: true,
        excludedCampaignKeys: [...new Set([
          ...(pending?.excludedCampaignKeys || []),
          expiredKey,
        ].filter(Boolean))],
        startedAt: pending?.startedAt || now,
      },
      `${currentDrop.name || "Completed Drop"} remained unclaimed for 60s · selecting next open campaign`,
    );

    logActivity("claim-ready-timeout", "Claim Ready grace expired · advancing", {
      drop: currentDrop.name || null,
      game: currentDrop.game || null,
      campaign: currentDrop.campaign || null,
      dropInstanceIdAvailable: Boolean(currentDrop.dropInstanceID),
      graceSeconds: Math.round(CLAIM_READY_GRACE_MS / 1000),
    });

    setStatus("Claim Stuck · Finding Next Open Drops Campaign");
    notifyUser("Claim Did Not Complete · Moving To Next Open Drops Campaign");
    resetClaimReadyTimer();
    return continueToNextGame(campaigns);
  }

  async function pollGqlDrops() {
    lastGqlPollAt = Date.now();
    try {
      if (!getToken()) {
        setStatus("Waiting for Twitch login…");
        refreshDropCard();
        return;
      }
      const login = watchingLogin();
      const requests = [{ op: "inventory" }];
      if (login) requests.push({ op: "streamInfo", variables: { channel: login } });
      const first = await gql(requests);
      lastGqlSuccessAt = Date.now();
      lastGqlError = "";
      const inventoryCampaigns = first[0]?.data?.currentUser?.inventory?.dropCampaignsInProgress || [];
      lastInventoryCampaigns = inventoryCampaigns;
      verifyHandoffFromInventory(inventoryCampaigns);
      if (maybeAdvanceExpiredCampaign(inventoryCampaigns)) return;
      if (maybeAdvanceStuckClaim(inventoryCampaigns)) return;
      if (continueToNextGame(inventoryCampaigns)) return;
      const stream = first[1]?.data?.user;
      const channelId = stream?.id ? String(stream.id) : "";
      const gameName = stream?.stream?.game?.name || stream?.stream?.game?.displayName || "";
      let sessionDrop = null;
      let available = [];
      if (channelId) {
        const extra = await gql([
          { op: "currentDrop", variables: { channelID: channelId, channelLogin: "" } },
          { op: "availableDrops", variables: { channelID: channelId } },
        ]);
        available = parseAvailableCampaigns(extra[1]);
        sessionDrop = parseSessionDrop(extra[0], [...inventoryCampaigns, ...available]);
        if (!sessionDrop && login) {
          const loginResult = await gql([
            { op: "currentDrop", variables: { channelLogin: login } },
          ]);
          sessionDrop = parseSessionDrop(loginResult[0], [...inventoryCampaigns, ...available]);
        }
      }
      const activeIncomplete = Boolean(
        currentDrop &&
        !currentDrop.isClaimed &&
        Number(currentDrop.percent || 0) < 100
      );
      const preferredGame = activeIncomplete ? currentDrop.game || "" : gameName || "";
      const streamMatchesActive = Boolean(
        !activeIncomplete ||
        !gameName ||
        gameNamesMatch(currentDrop.game || "", gameName)
      );

      if (activeIncomplete && gameName && !streamMatchesActive) {
        sessionDrop = null;
        available = [];
      }

      const fromAvailable = streamMatchesActive
        ? pickTimedDrop(available, preferredGame || gameName)
        : null;

      const preferredInventory = pickTimedDrop(inventoryCampaigns, preferredGame);
      const fromInventory = preferredInventory || (
        activeIncomplete ? null : pickTimedDrop(inventoryCampaigns, "")
      );

      let drop = activeIncomplete
        ? (fromInventory || (streamMatchesActive ? sessionDrop || fromAvailable : null) || currentDrop)
        : (sessionDrop || fromInventory || fromAvailable);

      if (sessionDrop && fromInventory && streamMatchesActive) {
        const minutes = reconcileDropProgress(sessionDrop, fromInventory);
        const requiredMinutes = fromInventory.requiredMinutes || sessionDrop.requiredMinutes || 0;
        drop = {
          ...fromInventory,
          ...sessionDrop,
          id: fromInventory.id || sessionDrop.id || "",
          name: fromInventory.name || sessionDrop.name,
          game: fromInventory.game || sessionDrop.game || gameName,
          gameSlug: fromInventory.gameSlug || sessionDrop.gameSlug || "",
          campaignId: fromInventory.campaignId || sessionDrop.campaignId || "",
          campaignKey: fromInventory.campaignKey || sessionDrop.campaignKey || "",
          campaign: fromInventory.campaign || sessionDrop.campaign || "",
          campaignStartAt: fromInventory.campaignStartAt || sessionDrop.campaignStartAt || "",
          campaignEndAt: fromInventory.campaignEndAt || sessionDrop.campaignEndAt || "",
          dropStartAt: fromInventory.dropStartAt || sessionDrop.dropStartAt || "",
          dropEndAt: fromInventory.dropEndAt || sessionDrop.dropEndAt || "",
          requiredMinutes,
          currentMinutes: minutes,
          dropInstanceID: sessionDrop.dropInstanceID || fromInventory.dropInstanceID || "",
          isClaimed: Boolean(sessionDrop.isClaimed || fromInventory.isClaimed),
        };
        drop.percent = requiredMinutes
          ? Math.min(100, Math.round((minutes / requiredMinutes) * 100))
          : drop.percent || 0;
        drop.remainingMinutes = Math.max(0, requiredMinutes - minutes);
      }

      if (verifyHandoffChannel(login, gameName, available, sessionDrop)) return;

      if (drop) {
        applyDrop(drop);
        const channelNote = login ? ` on ${login}` : "";
        setStatus(`Working toward ${drop.name}${channelNote}`);
        if (settings.findNextStream && !getHandoffState() && Date.now() - lastProgressAt > 6 * 60 * 1000 && !isAutoSwitchPaused()) {
          if (!settings.queueEnabled || settings.queueOnStall) findNextStream();
        }
      } else if (login) {
        setStatus(`Watching ${login} · no drop progress yet`);
        if (!currentDrop) {
          currentDrop = {
            name: gameName ? `Waiting for ${gameName} Drops` : "No drop progress yet",
            game: gameName,
            percent: 0,
            currentMinutes: 0,
            requiredMinutes: 0,
          };
        }
        refreshDropCard();
      } else {
        setStatus(featureStatus());
        refreshDropCard();
      }
    } catch (error) {
      lastGqlError = error?.message || String(error);
      logActivity("poll-error", "Drop state refresh failed", { message: lastGqlError, reason: lastGqlReason || null });
      setStatus(error.message === "Not logged in" ? "Waiting for Twitch login…" : `Drops update failed: ${error.message}`);
      refreshDropCard();
    }
  }

  function applyDrop(drop) {
    if (!drop) return;
    const previousDrop = currentDrop;
    const percent = drop.percent ?? (drop.requiredMinutes ? Math.round((drop.currentMinutes / drop.requiredMinutes) * 100) : 0);
    currentDrop = { ...drop, percent };
    if (currentDrop.isClaimed || Number(percent) < 100) resetClaimReadyTimer();
    const resolvedGameSlug = resolveCategorySlug(currentDrop);
    if (resolvedGameSlug) currentDrop.gameSlug = resolvedGameSlug;
    const changedDrop = previousDrop?.id !== currentDrop.id || previousDrop?.name !== currentDrop.name;
    const changedPercent = Number(previousDrop?.percent ?? -1) !== Number(percent);
    if (changedDrop || changedPercent) {
      logActivity("progress", `${currentDrop.name || "Drop"} · ${percent}%`, {
        game: currentDrop.game || null,
        currentMinutes: currentDrop.currentMinutes || 0,
        requiredMinutes: currentDrop.requiredMinutes || 0,
      });
    }
    writeSession("tdh-drop", currentDrop);
    progressLabel = `${percent}%`;
    if (percent !== lastProgress) {
      lastProgress = percent;
      lastProgressAt = Date.now();
      writeSession("tdh-progress", percent);
      writeSession("tdh-progress-at", lastProgressAt);
    }
    verifyHandoffWithCreditedProgress(currentDrop, previousDrop);
    refreshDropCard();
    layoutChrome();
    maybeClaimCurrentDrop(currentDrop);
  }

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (
        stored.hideTwitchSubscriptionPromos == null &&
        stored.hideChatSubscriptionPromos != null
      ) {
        stored.hideTwitchSubscriptionPromos = Boolean(stored.hideChatSubscriptionPromos);
      }
      delete stored.hideChatSubscriptionPromos;
      delete stored.autoHideCard;
      return { ...DEFAULTS, ...stored };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setStatus(featureStatus());
    renderSwitches();
  }

  function readSession(key, fallback) {
    try {
      const value = sessionStorage.getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function writeSession(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  function featureStatus() {
    const on = [];
    if (settings.claimBonus) on.push("bonus");
    if (settings.keepTabActive) on.push("tab");
    if (settings.claimDrops) on.push("drops");
    return on.length ? `On: ${on.join(" · ")}` : "All features off";
  }

  function setStatus(text) {
    statusText = text;
    const node = ui?.shadow?.getElementById("tdh-status");
    if (node) node.textContent = text;
  }

  function isInventory() {
    return location.href.split("?")[0] === INVENTORY_URL;
  }

  function clickMatch(root, selector) {
    const node = root.matches?.(selector) ? root : root.querySelector?.(selector);
    const button = node?.closest?.("button") || (node?.tagName === "BUTTON" ? node : null);
    if (button && !button.disabled) button.click();
    return Boolean(button);
  }

  function watchBonus() {
    const claim = (root = document) => {
      if (!settings.claimBonus) return;
      if (Date.now() - lastBonusAt < 1500) return;
      if (clickMatch(root, BONUS_SELECTOR)) {
        lastBonusAt = Date.now();
        setStatus("Claimed Bonus Chest");
        notifyUser("Bonus Chest Claimed");
      }
    };
    claim();
    new MutationObserver((mutations) => {
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (node instanceof Element) claim(node);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function isDropClaimButton(button) {
    const text = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.toLowerCase();
    return /claim|領取|领取|받기|получить/.test(text);
  }

  async function claimDropViaGql(drop) {
    const instanceID = drop?.dropInstanceID;
    if (!settings.claimDrops || !instanceID || drop?.isClaimed) return false;
    if ((drop.currentMinutes || 0) < (drop.requiredMinutes || Infinity)) return false;
    try {
      const result = await gql([{ op: "claimDrop", variables: { input: { dropInstanceID: instanceID } } }]);
      const status = result[0]?.data?.claimDropRewards?.status || "";
      if (/ELIGIBLE_FOR_ALL|DROP_INSTANCE_ALREADY_CLAIMED/i.test(status)) {
        lastDropAt = Date.now();
        resetClaimReadyTimer();
        logActivity("claim", status === "DROP_INSTANCE_ALREADY_CLAIMED" ? "Drop already claimed" : `Claimed ${drop.name || "drop"}`, { game: drop.game || null });
        setStatus(status === "DROP_INSTANCE_ALREADY_CLAIMED" ? "Drop already claimed" : `Claimed ${drop.name || "drop"}`);
        scheduleNextGameAfterClaim(drop);
        return true;
      }
    } catch (error) {
      logActivity("claim-error", "GQL claim attempt failed", {
        drop: drop?.name || null,
        game: drop?.game || null,
        message: error?.message || String(error),
      });
      // DOM claim remains the fallback.
    }
    return false;
  }

  function maybeClaimCurrentDrop(drop) {
    const now = Date.now();
    if (!drop?.dropInstanceID || now - lastDropAt < 1200) return;
    if ((drop.currentMinutes || 0) < (drop.requiredMinutes || Infinity)) return;

    const expiry = campaignExpirySnapshot(lastInventoryCampaigns, drop, now);
    if (expiry?.overdue) return;
    if (now - lastClaimAttemptAt < CLAIM_RETRY_INTERVAL_MS) return;

    lastClaimAttemptAt = now;
    claimDropViaGql(drop);
  }

  function claimDropButtons(root = document) {
    if (!settings.claimDrops) return 0;
    if (campaignExpirySnapshot(lastInventoryCampaigns, currentDrop)?.overdue) return 0;
    if (Date.now() - lastDropAt < 1200) return 0;
    let claimed = 0;
    root.querySelectorAll(DROP_CLAIM_SELECTOR).forEach((node) => {
      const button = node.closest("button") || node;
      if (button && !button.disabled) {
        button.click();
        claimed += 1;
      }
    });
    if (isInventory()) {
      document.querySelectorAll(".inventory-max-width > div:not(:first-child) button").forEach((button) => {
        if (isDropClaimButton(button) && !button.disabled) {
          button.click();
          claimed += 1;
        }
      });
    }
    if (claimed) {
      lastDropAt = Date.now();
      resetClaimReadyTimer();
      logActivity("claim", `Claimed ${claimed} Drop${claimed === 1 ? "" : "s"} via page controls`, { game: currentDrop?.game || null });
      setStatus(`Claimed ${claimed} Drop${claimed === 1 ? "" : "s"}`);
      notifyUser(`Claimed ${claimed} Drop${claimed === 1 ? "" : "s"}`);
      if (currentDrop?.percent >= 100) scheduleNextGameAfterClaim(currentDrop);
    }
    return claimed;
  }

  function watchDrops() {
    claimDropButtons();
    new MutationObserver((mutations) => {
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (node instanceof Element) claimDropButtons(node);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  function noteWatching() {
    const login = watchingLogin();
    const video = document.querySelector("video");
    const playing = Boolean(video && !video.paused && video.readyState > 1);
    if (!login || !playing) {
      if (!login) watchClock = { login: "", started: 0 };
      return;
    }
    if (watchClock.login !== login) watchClock = { login, started: Date.now() };
  }

  function playerWatchLabel() {
    if (!watchClock.started) return "";
    return `Player playing ${formatClock(Date.now() - watchClock.started)}`;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function barPercent(bar) {
    const now = Number(bar.getAttribute("aria-valuenow"));
    const max = Number(bar.getAttribute("aria-valuemax"));
    if (Number.isFinite(now) && max > 0) return Math.round((now / max) * 100);
    const span = bar.parentElement?.querySelector("span") || bar.nextElementSibling;
    const text = Number(cleanText(span?.textContent).replace("%", ""));
    return Number.isFinite(text) ? text : null;
  }

  function cardCopy(card) {
    const chunks = [...card.querySelectorAll("h3, h4, h5, p, [class*='title'], img[alt]")]
      .map((node) => cleanText(node.getAttribute?.("alt") || node.textContent))
      .filter((text) => text.length > 1 && text.length < 90)
      .filter((text, index, list) => list.indexOf(text) === index)
      .filter((text) => !/^(claim|claimed|drops|inventory|\d+%?)$/i.test(text));
    return {
      game: chunks[0] || "",
      name: chunks[1] || chunks[0] || "",
    };
  }

  function readDropFromCard(card) {
    const bars = [...card.querySelectorAll("[role='progressbar']")].map((bar) => ({
      bar,
      percent: barPercent(bar),
    })).filter((item) => Number.isFinite(item.percent));
    const active = bars.find((item) => item.percent > 0 && item.percent < 100) || bars.find((item) => item.percent < 100);
    if (!active) return null;
    const copy = cardCopy(card);
    return {
      percent: active.percent,
      name: copy.name || "Current drop",
      game: copy.game && copy.game !== copy.name ? copy.game : "",
    };
  }

  function readCurrentDrop() {
    const cards = [
      ...document.querySelectorAll(".inventory-max-width > div:not(:first-child)"),
      ...document.querySelectorAll("[data-test-selector*='DropsCampaign']"),
      ...document.querySelectorAll("[class*='drops-campaign']"),
    ];
    let best = null;
    cards.forEach((card) => {
      const drop = readDropFromCard(card);
      if (!drop) return;
      if (!best || drop.percent > best.percent) best = drop;
    });
    if (best) return best;
    const liveName = cleanText(
      document.querySelector("[data-a-target='drops-campaign-name'], [data-test-selector='drops-list'] h5, [data-test-selector='drops-list'] p")?.textContent,
    );
    const livePercent = currentProgress();
    if (liveName || livePercent) {
      return {
        percent: livePercent || currentDrop?.percent || 0,
        name: liveName || currentDrop?.name || "Active drop",
        game: currentDrop?.game || "",
      };
    }
    return currentDrop;
  }

  function currentProgress() {
    const values = [...document.querySelectorAll("[role='progressbar']")]
      .map(barPercent)
      .filter((value) => Number.isFinite(value) && value < 100);
    if (!values.length) return 0;
    return Math.max(...values);
  }


  function readStreamInfo() {
    const root = document.querySelector("#live-channel-stream-information") || document;
    const channelName = cleanText(root.querySelector("h1.tw-title, h1")?.textContent) || watchingLogin();
    const avatar = root.querySelector("img.tw-image-avatar, img[alt]")?.src || "";
    const title = cleanText(document.querySelector('[data-a-target="stream-title"]')?.textContent);
    const gameLink = document.querySelector('[data-a-target="stream-game-link"]');
    const game = cleanText(gameLink?.textContent);
    const gameCategoryUrl = gameLink?.href || "";
    const gameSlug = categorySlugFromUrl(gameCategoryUrl);
    if (game && gameSlug) rememberCategorySlug(game, gameSlug, "active-stream");
    const viewers = cleanText(document.querySelector('[data-a-target="animated-channel-viewers-count"]')?.textContent);
    const uptime = cleanText(document.querySelector('.live-time span[aria-hidden="true"]')?.textContent);
    const dropsEnabled = Boolean(document.querySelector('[data-a-target="DropsEnabled"], a[href*="/tags/DropsEnabled"]'));
    const live = Boolean(root.querySelector('.tw-channel-status-text-indicator, [class*="ChannelStatusTextIndicator"]')) || /\bLIVE\b/i.test(root.textContent || "");
    return { channelName, avatar, title, game, gameSlug, gameCategoryUrl, viewers, uptime, dropsEnabled, live };
  }

  function refreshStreamInfo() {
    if (!ui) return;
    const info = readStreamInfo();
    const box = ui.shadow.getElementById("tdh-stream-info");
    const avatar = ui.shadow.getElementById("tdh-stream-avatar");
    const channel = ui.shadow.getElementById("tdh-stream-channel");
    const live = ui.shadow.getElementById("tdh-stream-live");
    const title = ui.shadow.getElementById("tdh-stream-title");
    const game = ui.shadow.getElementById("tdh-stream-game");
    const badges = ui.shadow.getElementById("tdh-stream-badges");
    if (!box || !channel) return;

    const hasStreamInfo = Boolean(info.channelName || info.title || info.game || info.viewers || info.uptime);
    box.classList.toggle("stream-info-hidden", !hasStreamInfo);
    if (!hasStreamInfo) return;

    if (info.avatar) {
      avatar.src = info.avatar;
      avatar.alt = info.channelName || "Channel Avatar";
      avatar.hidden = false;
    } else {
      avatar.removeAttribute("src");
      avatar.hidden = true;
    }
    channel.textContent = info.channelName || "Twitch Channel";
    live.textContent = info.live ? "LIVE" : "";
    live.hidden = !info.live;
    title.textContent = info.title || "";
    title.hidden = !info.title;
    game.textContent = [info.game, info.viewers ? `${info.viewers} Viewers` : "", info.uptime ? `Live ${formatUptime(info.uptime)}` : ""].filter(Boolean).join(" · ");
    game.hidden = !game.textContent;

    badges.replaceChildren();
    if (info.dropsEnabled) {
      const badge = document.createElement("span");
      badge.className = "stream-badge drops-enabled";
      badge.textContent = "Drops Enabled";
      badges.appendChild(badge);
    }
  }

  function refreshDropCard() {
    if (!ui) return;
    refreshStreamInfo();
    const name = ui.shadow.getElementById("tdh-drop-name");
    const game = ui.shadow.getElementById("tdh-drop-game");
    const meta = ui.shadow.getElementById("tdh-drop-meta");
    const fill = ui.shadow.getElementById("tdh-drop-fill");
    const ring = ui.shadow.getElementById("tdh-ring");
    const percentNode = ui.shadow.getElementById("tdh-drop-percent");
    if (!name) return;

    if (!currentDrop) {
      name.textContent = "Waiting For Twitch To Start A Drop Session";
      game.textContent = watchingLogin() ? `Watching ${watchingLogin()}` : "Open A Drops Channel";
      meta.textContent = [playerWatchLabel(), "First Credited Minute Often Takes 1–3 Minutes"].filter(Boolean).join(" · ");
      if (fill) fill.style.width = "0%";
      if (ring) ring.setAttribute("stroke-dasharray", "0 100");
      if (percentNode) percentNode.textContent = "0%";
      syncCompactState();
      renderCompactInventory();
      return;
    }

    const percent = Math.max(0, Math.min(100, Number(currentDrop.percent) || 0));
    name.textContent = currentDrop.name || "Current Drop";
    game.textContent = [currentDrop.game, currentDrop.campaign].filter((part, index, list) => part && list.indexOf(part) === index).join(" · ");
    const minutes = currentDrop.requiredMinutes
      ? `${currentDrop.currentMinutes || 0} / ${currentDrop.requiredMinutes} Min · ${Math.max(0, currentDrop.remainingMinutes || 0)} Min Left`
      : "Twitch Has Not Credited A Minute Yet";
    const playing = playerWatchLabel().replace("Player playing", "Player");
    meta.textContent = [minutes, playing].filter(Boolean).join(" · ");
    if (fill) fill.style.width = `${percent}%`;
    if (ring) ring.setAttribute("stroke-dasharray", `${percent} 100`);
    if (percentNode) percentNode.textContent = `${percent}%`;
    applyProgressColor(percent);
    syncCompactState();
    renderCompactInventory();
  }

  function updateTitle() {
    if (!settings.progressInTitle || !progressLabel || !isInventory()) return;
    const wanted = `${progressLabel} · Twitch Drops`;
    if (document.title !== wanted) document.title = wanted;
  }

  function scanDrops() {
    claimDropButtons();
    const drop = readCurrentDrop();
    if (drop && (drop.percent || drop.name) && !currentDrop?.requiredMinutes) applyDrop(drop);
    else refreshDropCard();
    layoutChrome();
  }

  function findNextStream() {
    if (Date.now() - lastStreamSwitch < 20000) return;
    const queued = settings.queueEnabled ? discoverQueueCandidates() : [];
    const links = [
      ...document.querySelectorAll("[data-test-selector='DropsCampaignInProgressDescription-no-channels-hint-text'] a"),
      ...[...document.querySelectorAll("[data-test-selector='DropsCampaignInProgressDescription-hint-text-parent'] a")].reverse(),
    ];
    const href = queued[0]?.href || links
      .map((node) => node.href)
      .find((url) => {
        if (!url) return false;
        try {
          const parsed = new URL(url, location.href);
          const host = parsed.hostname.toLowerCase();
          return (
            parsed.protocol === "https:" &&
            (host === "twitch.tv" ||
              host === "www.twitch.tv" ||
              host === "player.twitch.tv" ||
              host === "embed.twitch.tv" ||
              host.endsWith(".twitch.tv"))
          );
        } catch (_) {
          return false;
        }
      });
    if (!href) return;
    lastStreamSwitch = Date.now();
    lastProgressAt = Date.now();
    writeSession("tdh-progress-at", lastProgressAt);
    logActivity("stream-switch", "Opening next Drops channel", { target: streamLoginFromUrl(href) || null });
    setStatus("Opening Next Drops Channel");
    if (settings.queueEnabled) {
      autoNavigateTwitch(href, "automatic-routing");
      return;
    }
    const next = window.open(href, "tdh-drops-live");
    if (settings.muteRestarted) muteWhenReady(next);
  }

  function muteWhenReady(win) {
    if (!win) return;
    const timer = setInterval(() => {
      try {
        const video = win.document?.querySelector("video");
        if (video) {
          video.muted = true;
          clearInterval(timer);
        }
      } catch (_) {
        /* cross-origin until it lands on twitch */
      }
    }, 500);
    setTimeout(() => clearInterval(timer), 15000);
  }

  function installKeepTabActive(uw) {
    let lastUserGesture = 0;
    const markGesture = () => {
      lastUserGesture = Date.now();
    };
    const gestureEvents = ["pointerdown", "mousedown", "mouseup", "touchstart", "keydown", "click", "keypress"];
    uw.addEventListener(
      "DOMContentLoaded",
      () => {
        gestureEvents.forEach((ev) => uw.addEventListener(ev, markGesture, { capture: true, passive: true }));
      },
      { once: true },
    );

    const defineConstProp = (proto, prop, val) => {
      try {
        Object.defineProperty(proto, prop, {
          configurable: true,
          enumerable: true,
          get: function tmKeepActive() {
            return val;
          },
        });
      } catch (_) {
        /* ignore */
      }
    };
    const DocProto = (uw.Document && uw.Document.prototype) || Document.prototype;
    defineConstProp(DocProto, "hidden", false);
    defineConstProp(DocProto, "webkitHidden", false);
    defineConstProp(DocProto, "visibilityState", "visible");
    try {
      Object.defineProperty(DocProto, "hasFocus", { configurable: true, value: () => true });
    } catch (_) {
      /* ignore */
    }

    ["visibilitychange", "webkitvisibilitychange", "freeze", "pagehide"].forEach((type) => {
      try {
        uw.document.addEventListener(type, (ev) => ev.stopImmediatePropagation(), true);
      } catch (_) {
        /* ignore */
      }
    });
    try {
      uw.addEventListener("blur", (ev) => ev.stopImmediatePropagation(), true);
    } catch (_) {
      /* ignore */
    }

    const HME = (uw.HTMLMediaElement || HTMLMediaElement).prototype;
    const originalPause = HME.pause;
    const originalPlay = HME.play;
    const allowPause = () => Date.now() - lastUserGesture <= 1200;
    Object.defineProperty(HME, "pause", {
      configurable: true,
      value: function tmGuardedPause() {
        if (allowPause()) return originalPause.apply(this, arguments);
        try {
          const playing = originalPlay.apply(this, []);
          if (playing && typeof playing.catch === "function") playing.catch(() => {});
        } catch (_) {
          /* ignore */
        }
      },
    });

    const resumeIfPaused = (video) => {
      try {
        if (video && video.paused && video.readyState > 2) {
          const playing = originalPlay.call(video);
          if (playing && typeof playing.catch === "function") playing.catch(() => {});
        }
      } catch (_) {
        /* ignore */
      }
    };

    new uw.MutationObserver((muts) => {
      for (const mutation of muts) {
        mutation.addedNodes.forEach((node) => {
          if (node && node.nodeType === 1) {
            if (node.tagName === "VIDEO") resumeIfPaused(node);
            node.querySelectorAll?.("video")?.forEach(resumeIfPaused);
          }
        });
      }
    }).observe(uw.document.documentElement || uw.document, { childList: true, subtree: true });

    uw.document.addEventListener(
      "pause",
      (ev) => {
        const el = ev.target;
        if (el instanceof uw.HTMLMediaElement && !allowPause()) {
          try {
            ev.stopImmediatePropagation();
          } catch (_) {
            /* ignore */
          }
          resumeIfPaused(el);
        }
      },
      true,
    );

    const NativeIO = uw.IntersectionObserver;
    if (typeof NativeIO === "function") {
      const IOProxy = function (callback, options) {
        const wrapped = function (entries, observer) {
          const patched = entries.map((entry) => {
            const target = entry.target;
            const isVideoish =
              target.tagName === "VIDEO" ||
              target.closest?.('[data-a-target="player-overlay"],[data-a-target="player-container"]');
            if (!isVideoish) return entry;
            return Object.assign({}, entry, {
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: target.getBoundingClientRect?.() || entry.boundingClientRect,
              intersectionRect: target.getBoundingClientRect?.() || entry.intersectionRect,
              rootBounds: entry.rootBounds,
            });
          });
          try {
            return callback(patched, observer);
          } catch (_) {
            /* ignore */
          }
        };
        return new NativeIO(wrapped, options);
      };
      IOProxy.prototype = NativeIO.prototype;
      uw.IntersectionObserver = IOProxy;
    }

    uw.setInterval(() => {
      try {
        uw.dispatchEvent(new uw.MouseEvent("mousemove", { bubbles: true }));
      } catch (_) {
        /* ignore */
      }
    }, 30000);

    try {
      uw.navigator.wakeLock?.request?.("screen").catch(() => {});
    } catch (_) {
      /* ignore */
    }

    let lastGateClick = 0;
    const clickGate = (selector) => {
      const now = Date.now();
      if (now - lastGateClick < 3000) return;
      const button = uw.document.querySelector(selector);
      const target = button?.matches?.("button") ? button : button?.querySelector?.("button:not([disabled])");
      if (target && !target.disabled) {
        lastGateClick = now;
        target.click();
      }
    };
    new uw.MutationObserver(() => {
      clickGate('[data-a-target="content-classification-gate-overlay-start-watching-button"]');
      clickGate('[data-a-target="player-overlay-content-gate"]');
    }).observe(uw.document.documentElement || uw.document, { childList: true, subtree: true, attributes: true });
  }

  function switchHtml(id, label, description, on) {
    const tip = String(description || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return `
      <div class="fl-switch">
        <span class="fl-switch-text has-tooltip" data-tip="${tip}" id="${id}-label">${label}</span>
        <button id="${id}" type="button" class="fl-switch-input toggleSwitch" role="switch" aria-labelledby="${id}-label" aria-checked="${on ? "true" : "false"}"></button>
      </div>`;
  }

  function css() {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .cluster {
        position: fixed; right: 12px; z-index: 2147483001;
        display: flex; flex-direction: column-reverse; align-items: flex-end;
        width: max-content; max-width: calc(100vw - 24px); gap: 8px;
        font: 13px/1.42 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #efeff1;
      }
      .cluster.open-up { flex-direction: column; }
      .progress-stack {
        width:min(var(--dropper-width, 312px), calc(100vw - 24px));
        display:flex; flex-direction:column; align-items:stretch;
        transition:.15s width;
      }
      .progress-stack.is-collapsed[data-collapsed-width="compact"] { width:min(260px, calc(100vw - 24px)); }
      .progress-stack.is-collapsed[data-collapsed-width="narrow"] { width:min(220px, calc(100vw - 24px)); }
      .badge-row { display:flex; align-items:stretch; width:100%; }
      #tdh-drop-card {
        position: relative; flex:1 1 auto; width:auto; min-width:0; max-width:none;
        background:#18181b; border:1px solid #9147ff66; border-right:0;
        border-radius:12px 0 0 12px; box-shadow:0 8px 30px #0007; overflow:hidden;
      }
      #tdh-drop-card.collapsed { width:auto; overflow:visible; cursor:pointer; }
      #tdh-drop-card.collapsed:focus-visible { outline:2px solid #9147ff; outline-offset:2px; }
      #tdh-drop-card.collapsed::before {
        content:attr(data-help); position:absolute; right:0; top:calc(100% + 7px);
        max-width:220px; padding:5px 8px; border:1px solid #3b3b44; border-radius:7px;
        background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0008;
        font-size:9px; font-weight:700; line-height:1.3; white-space:nowrap;
        opacity:0; visibility:hidden; transform:translateY(-2px); pointer-events:none; z-index:10;
        transition:.12s opacity .35s,.12s transform .35s,.12s visibility .35s;
      }
      #tdh-drop-card.collapsed:hover::before,
      #tdh-drop-card.collapsed:focus-visible::before { opacity:1; visibility:visible; transform:translateY(0); }
      #tdh-drop-card.collapsed.preview-below::before { top:auto; bottom:calc(100% + 7px); }
      #tdh-drop-card.collapsed .expanded-content {
        display:block; position:absolute; left:0; bottom:calc(100% + 8px); width:100%; min-width:240px;
        background:#18181b; border:1px solid #9147ff66; border-radius:12px; box-shadow:0 14px 36px #000a;
        overflow:hidden; opacity:0; visibility:hidden; transform:translateY(4px); pointer-events:none;
        transition:.12s opacity,.12s transform,.12s visibility; z-index:8;
      }
      #tdh-drop-card.collapsed:hover .expanded-content,
      #tdh-drop-card.collapsed:focus-within .expanded-content {
        opacity:1; visibility:visible; transform:translateY(0);
      }
      #tdh-drop-card.collapsed .expanded-content::after {
        content:""; position:absolute; left:50%; bottom:-6px; width:10px; height:10px;
        background:#18181b; border-right:1px solid #9147ff66; border-bottom:1px solid #9147ff66;
        transform:translateX(-50%) rotate(45deg);
      }
      #tdh-drop-card.collapsed.preview-below .expanded-content { top:calc(100% + 8px); bottom:auto; }
      #tdh-drop-card.collapsed.preview-below .expanded-content::after {
        top:-6px; bottom:auto; border:0; border-left:1px solid #9147ff66; border-top:1px solid #9147ff66;
      }
      #tdh-drop-card:not(.collapsed) .compact-line { display:none; }
      .compact-line { min-height:48px; padding:0 10px; display:grid; grid-template-columns:6px minmax(0,1fr) auto auto; gap:7px; align-items:center; cursor:pointer; }
      .compact-dot { width:6px; height:6px; border-radius:50%; background:#9147ff; }
      .compact-reward { font-size:10px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .compact-extra { font-size:9px; color:#b8b8c0; white-space:nowrap; }
      .state-pill { display:inline-flex; align-items:center; border:1px solid #34343a; border-radius:999px; padding:1px 5px; font-size:8px; font-weight:800; color:#d0d0d5; background:#1c1c21; white-space:nowrap; }
      .state-pill.good { color:#c8ffd7; border-color:#22c55e66; background:#22c55e18; }
      .state-pill.warn { color:#ffe5a8; border-color:#f59e0b66; background:#f59e0b18; }
      .state-pill.bad { color:#ffd1d1; border-color:#ef444466; background:#ef444418; }
      .stream-info { padding:7px 9px 6px; display:grid; grid-template-columns:32px minmax(0,1fr); gap:7px; align-items:center; }
      .stream-info-hidden { display:none; }
      .stream-avatar { width:32px; height:32px; border-radius:50%; object-fit:cover; grid-row:1 / span 2; }
      .stream-head { min-width:0; display:flex; align-items:center; gap:5px; }
      .stream-channel { font-size:11px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .stream-live { font-size:8px; font-weight:900; background:#eb0400; color:#fff; border-radius:4px; padding:1px 4px; }
      .stream-title { display:none; }
      .stream-game { font-size:9px; color:#adadb8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .stream-badges { grid-column:2; display:flex; gap:4px; flex-wrap:wrap; font-size:8px; color:#8f8f98; }
      .stream-badge { padding:1px 4px; border:1px solid #34343b; border-radius:99px; }
      .stream-badge.drops-enabled { color:#d7ffd7; border-color:#22c55e66; background:#22c55e18; }
      .stream-dot { color:#5f5f68; }
      .drop-section { padding:7px 9px 8px; border-top:1px solid #29292f; }
      .drop-kicker { font-size:8px; color:#bf94ff; font-weight:900; letter-spacing:.07em; text-transform:uppercase; margin-bottom:2px; }
      .drop-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-right:24px; }
      .drop-name { font-size:11px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .drop-game { display:none; }
      .drop-bar-row { margin-top:6px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px; align-items:center; }
      .drop-bar { height:6px; border-radius:99px; background:#2b2b31; overflow:hidden; }
      .drop-bar > span { display:block; height:100%; width:0; background:#9147ff; transition:.2s width,.2s background; }
      .drop-percent { font-size:10px; font-weight:800; color:#bf94ff; min-width:28px; text-align:right; }
      .drop-meta { font-size:8px; color:#9c9ca5; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .drop-status-row { margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:8px; color:#a7a7b0; }
      .progress-age { color:#a7a7b0; }
      .progress-age.warn { color:#f59e0b; }
      .progress-age.bad { color:#ef4444; font-weight:800; }
      #tdh-settings-launcher {
        position:relative; width:48px; min-width:48px; min-height:48px; padding:0; margin:0;
        display:grid; place-items:center; border:1px solid #9147ff77; border-radius:0 12px 12px 0;
        background:#18181b; box-shadow:0 8px 30px #0007; cursor:grab; touch-action:none; user-select:none;
      }
      #tdh-settings-launcher:hover, #tdh-settings-launcher[aria-expanded="true"] { border-color:#9147ff; background:#202026; }
      #tdh-settings-launcher::before {
        content:attr(data-help); position:absolute; right:0; bottom:calc(100% + 7px);
        max-width:220px; padding:5px 8px; border:1px solid #3b3b44; border-radius:7px;
        background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0008;
        font-size:9px; font-weight:700; line-height:1.3; white-space:nowrap;
        opacity:0; visibility:hidden; transform:translateY(2px); pointer-events:none; z-index:10;
        transition:.12s opacity .35s,.12s transform .35s,.12s visibility .35s;
      }
      #tdh-settings-launcher:hover::before,
      #tdh-settings-launcher:focus-visible::before { opacity:1; visibility:visible; transform:translateY(0); }
      #tdh-settings-launcher.update-available { border-color:#f59e0b; }
      #tdh-settings-launcher.update-available::after {
        content:"↑"; position:absolute; top:-6px; right:-6px; width:18px; height:18px; display:grid; place-items:center;
        border:2px solid #111114; border-radius:999px; background:#f59e0b; color:#111114; font-size:11px; font-weight:950;
        box-shadow:0 3px 10px #0008; z-index:4; pointer-events:none;
      }
      #tdh-settings-launcher .ring { position:absolute; top:50%; left:50%; width:40px; height:40px; transform:translate(-50%,-50%); }
      .track { fill:none; stroke:#303038; stroke-width:3; }
      .fill { fill:none; stroke:#9147ff; stroke-width:3; stroke-linecap:round; transform:rotate(-90deg); transform-origin:18px 18px; transition:.2s stroke; }
      #tdh-settings-launcher .icon { width:22px; height:22px; pointer-events:none; position:relative; z-index:1; }
      #tdh-tools-dock {
        display:none; width:min(var(--dropper-width, 312px), calc(100vw - 24px)); max-width:calc(100vw - 24px); max-height:min(72vh,560px); overflow:auto;
        padding:9px 9px 0; background:#111114; border:1px solid #2f2f35; border-radius:14px; box-shadow:0 18px 50px #0008; color-scheme:dark;
        scrollbar-width:none; -ms-overflow-style:none;
      }
      #tdh-tools-dock::-webkit-scrollbar { width:0; height:0; display:none; }
      #tdh-tools-dock.fl-rail-open { display:block; }
      .menu-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
      .header-brand { display:flex; align-items:center; gap:8px; min-width:0; }
      .header-icon { width:38px; height:38px; flex:0 0 38px; }
      .header-icon svg { width:38px; height:38px; display:block; }
      .header-copy { min-width:0; }
      .header-title-row { display:flex; align-items:center; gap:6px; min-width:0; }
      #tdh-rail-title { margin:0; font-size:15px; font-weight:800; line-height:1.1; }
      #tdh-header-version {
        min-height:18px; padding:1px 6px; border:1px solid #4a3b61; border-radius:999px;
        background:#1b1721; color:#c9a7ff; cursor:pointer; font:800 8px/1 ui-sans-serif,system-ui,sans-serif;
        white-space:nowrap;
      }
      #tdh-header-version:hover, #tdh-header-version:focus-visible {
        border-color:#9147ff; background:#251d31; color:#fff; outline:none;
      }
      #tdh-rail-subtitle { margin-top:2px; font-size:9px; color:#adadb8; white-space:nowrap; }
      #tdh-rail-close { width:30px; height:30px; border:1px solid #3a3a42; border-radius:8px; background:#151519; color:#b8b8c0; cursor:pointer; font:18px/1 Arial,sans-serif; }
      #tdh-rail-close:hover { border-color:#9147ff; color:#fff; background:#211b2b; }
      .header-divider { height:1px; width:100%; margin:5px 0; background:linear-gradient(90deg,transparent,#9147ff88 50%,transparent); }
      .update-notice {
        position:relative; display:block; width:100%; margin:0 0 8px; padding:10px;
        border:1px solid #6f42b4; border-radius:10px;
        background:linear-gradient(180deg,#251a35,#18181d 70%);
        box-shadow:0 10px 28px #0008; z-index:12;
      }
      .update-notice[hidden] { display:none; }
      .update-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding-right:22px; }
      .update-heading { min-width:0; }
      .update-kicker { margin-bottom:2px; color:#bf94ff; font-size:8px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
      .update-title { font-size:12px; line-height:1.25; font-weight:850; color:#fff; }
      .update-version { flex:none; padding:2px 6px; border:1px solid #9147ff66; border-radius:999px; background:#9147ff22; color:#d8b4fe; font-size:8px; font-weight:800; white-space:nowrap; }
      .update-text { margin-top:6px; font-size:9px; line-height:1.45; color:#c7c7d0; white-space:normal; overflow:visible; }
      .update-list { margin:7px 0 0; padding:0 0 0 15px; max-height:86px; overflow:auto; color:#d7d7df; font-size:9px; line-height:1.4; scrollbar-width:thin; }
      .update-list li + li { margin-top:3px; }
      .update-footer { display:flex; justify-content:flex-end; gap:6px; margin-top:8px; padding-top:7px; border-top:1px solid #ffffff12; }
      .update-action, .update-release, .update-dismiss, .life-btn { border:1px solid #34343b; border-radius:7px; background:#18181b; color:#efeff1; cursor:pointer; }
      .update-action, .update-release { min-height:27px; padding:0 10px; font-size:9px; font-weight:800; }
      .update-action[hidden], .update-release[hidden] { display:none; }
      .update-action { border-color:#9147ff; background:#772ce8; }
      .update-release { border-color:#4b4b55; background:#202026; }
      .update-dismiss { position:absolute; top:7px; right:7px; width:23px; height:23px; padding:0; border-color:transparent; background:transparent; color:#adadb8; font-size:15px; line-height:1; }
      .update-action:hover, .update-release:hover, .update-dismiss:hover, .life-btn:hover { border-color:#9147ff; color:#fff; }
      .toast { margin-bottom:7px; padding:6px 8px; border:1px solid #34343b; border-radius:8px; background:#18181b; color:#efeff1; font-size:9px; box-shadow:0 8px 24px #0006; }
      .toast[hidden] { display:none; }
      .fl-tool-panel { position:relative; margin-top:5px; border:1px solid #27272d; background:#19191e; border-radius:9px; overflow:visible; }
      .fl-tool-header { display:flex; justify-content:space-between; align-items:center; min-height:29px; padding:5px 8px; cursor:pointer; border-radius:8px; }
      .fl-tool-header:hover { background:#9147ff18; }
      .fl-tool-title { font-size:12px; font-weight:700; }
      .fl-tool-chevron { background:none; border:0; color:#adadb8; cursor:pointer; }
      .fl-tool-body { padding:0 10px 8px; }
      .fl-tool-hidden { display:none !important; }
      .fl-switch, .mini-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 0; }
      .fl-switch + .fl-switch, .mini-row + .mini-row { border-top:1px solid #26262b; }
      .fl-switch-text, .mini-row > span { min-width:0; font-size:11px; }
      .toggleSwitch { position:relative; flex:none; width:34px; height:20px; border:0; border-radius:20px; background:#626873; cursor:pointer; }
      .toggleSwitch::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:.15s transform; }
      .toggleSwitch[aria-checked="true"] { background:#9147ff; }
      .toggleSwitch[aria-checked="true"]::after { transform:translateX(14px); }
      .life-btn { width:100%; min-height:28px; margin-top:6px; font-size:11px; }
      .select-lite { background:#111114; color:#efeff1; border:1px solid #34343b; border-radius:6px; padding:4px 6px; font-size:10px; }
      .compact-inventory { display:none; margin-top:6px; border:1px solid #9147ff55; background:#111114; border-radius:9px; overflow:hidden; }
      .compact-inventory.open { display:block; }
      .inventory-head { padding:7px 8px; border-bottom:1px solid #2a2a30; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .inventory-head strong { font-size:11px; }
      .inventory-head span { font-size:9px; color:#adadb8; }
      .inventory-list { padding:3px 7px 6px; }
      .inventory-item { display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:7px; align-items:center; padding:6px 0; }
      .inventory-item + .inventory-item { border-top:1px solid #242429; }
      .reward-thumb { width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg,#9147ff,#5c16c5); display:grid; place-items:center; font-size:9px; font-weight:900; color:#fff; }
      .reward-copy { min-width:0; }
      .reward-name { font-size:10px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .reward-meta { margin-top:1px; font-size:8px; color:#adadb8; }
      .reward-state { font-size:8px; font-weight:800; color:#bf94ff; white-space:nowrap; }
      .queue-list { display:block; }
      .diag { display:none; margin-top:6px; padding:7px; border:1px solid #2b2b31; border-radius:7px; background:#101014; font:9px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; color:#b8b8c0; white-space:pre-wrap; }
      .diag.open { display:block; }
      .has-tooltip { position:relative; }
      .has-tooltip::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + 4px); width:190px; padding:6px 8px; border:1px solid #3b3b44; border-radius:7px; background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0007; font-size:10px; line-height:1.35; opacity:0; pointer-events:none; z-index:999; transform:translateY(-2px); transition:.12s opacity,.12s transform; }
      .has-tooltip:hover::after, .has-tooltip:focus-visible::after { opacity:1; transform:translateY(0); }
      .reduce-motion *, .reduce-motion *::before, .reduce-motion *::after { animation:none !important; transition:none !important; }
      @media (max-width:700px) {
        #tdh-tools-dock, .progress-stack { width:min(var(--dropper-width,312px),calc(100vw - 24px)); }
        .badge-row { width:100%; }
        #tdh-drop-card { flex:1 1 auto; width:auto; min-width:0; max-width:none; }
      }
    `;
  }

  function mountUi() {
    if (ui) return ui;
    const host = document.createElement("div");
    host.id = "tdh-root";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${css()}</style>
      <div class="cluster" id="tdh-cluster">
        <aside id="tdh-tools-dock" role="region" aria-labelledby="tdh-rail-title">
          <div class="menu-head">
            <div class="header-brand">
              <div class="header-icon" aria-hidden="true">
                <svg viewBox="0 0 1024 1024">
                  <defs><linearGradient id="dh-border" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B9BBC7"/><stop offset="52%" stop-color="#8A6BE8"/><stop offset="100%" stop-color="#9147FF"/></linearGradient></defs>
                  <rect x="32" y="32" width="960" height="960" rx="185" fill="#111114"/>
                  <rect x="42" y="42" width="940" height="940" rx="175" fill="none" stroke="url(#dh-border)" stroke-width="28"/>
                  <polygon points="494,210 285,500 430,590" fill="#D9B5FF"/><polygon points="494,210 430,590 494,470" fill="#9B5AF9"/><polygon points="285,500 285,685 430,590" fill="#8C39F2"/><polygon points="285,685 494,842 430,590" fill="#5417B3"/><polygon points="430,590 494,470 494,842" fill="#7428E8"/>
                  <polygon points="530,210 739,500 594,590" fill="#AEB0C2"/><polygon points="530,210 594,590 530,470" fill="#6A6E87"/><polygon points="739,500 739,685 594,590" fill="#4E5268"/><polygon points="739,685 530,842 594,590" fill="#242633"/><polygon points="594,590 530,470 530,842" fill="#3F4254"/><rect x="502" y="205" width="20" height="650" rx="10" fill="#101017"/>
                </svg>
              </div>
              <div class="header-copy">
                <div class="header-title-row">
                  <h2 id="tdh-rail-title">Dropper</h2>
                  <button type="button" id="tdh-header-version" aria-label="View Dropper v${APP_VERSION} Changelog" title="View Changelog">v${APP_VERSION}</button>
                </div>
                <div id="tdh-rail-subtitle">Twitch Drops: Track and Redeem</div>
              </div>
            </div>
            <button type="button" id="tdh-rail-close" aria-label="Close">×</button>
          </div>
          <div class="header-divider"></div>
          <div class="toast" id="tdh-toast" hidden></div>
          <div class="update-notice" id="tdh-update-notice" hidden>
            <button type="button" class="update-dismiss" id="tdh-update-dismiss" aria-label="Dismiss Update Notice">×</button>
            <div class="update-head">
              <div class="update-heading">
                <div class="update-kicker" id="tdh-update-kicker">What's New</div>
                <div class="update-title" id="tdh-update-title"></div>
              </div>
              <div class="update-version" id="tdh-update-version"></div>
            </div>
            <div class="update-text" id="tdh-update-text"></div>
            <ul class="update-list" id="tdh-update-list"></ul>
            <div class="update-footer">
              <button type="button" class="update-release" id="tdh-update-release">GitHub Release</button>
              <button type="button" class="update-action" id="tdh-update-action">View Update</button>
            </div>
          </div>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Core Dropper Controls." data-panel="tdh-features-body"><span class="fl-tool-title">Features</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-features-body">
            ${switchHtml("tdh-claim-bonus", "Auto-Claim Bonus Chests", "Clicks Claim Bonus When The Chest Appears.", settings.claimBonus)}
            ${switchHtml("tdh-keep-tab", "Keep Tab Active", "Keeps Twitch From Pausing Or Throttling In The Background. Reload After Changing.", settings.keepTabActive)}
            ${switchHtml("tdh-claim-drops", "Auto-Claim Drops", "Claims Completed Twitch Drops When Twitch Reports Them As Claimable.", settings.claimDrops)}
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Optional Progress And Inventory Tools." data-panel="tdh-drops-body"><span class="fl-tool-title">Drops Extras</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-drops-body">
            ${switchHtml("tdh-find-next", "Find Next Drops Stream", "Switches To Another Eligible Stream If Progress Stalls.", settings.findNextStream)}
            ${switchHtml("tdh-mute-next", "Mute Opened Streams", "Mutes Any Separate Stream Window Opened By Dropper.", settings.muteRestarted)}
            <button type="button" class="life-btn" id="tdh-toggle-inventory">Show Drops Inventory</button>
            <div class="compact-inventory" id="tdh-compact-inventory"><div class="inventory-head"><div><strong>Campaign Drops</strong><span id="tdh-inventory-game"></span></div></div><div class="inventory-list" id="tdh-inventory-list"></div></div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Progress Panel Size And Visual Preferences." data-panel="tdh-appearance-body"><span class="fl-tool-title">Appearance</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-appearance-body">
            ${switchHtml("tdh-progress-title", "Show Progress In Tab", "Shows Current Drop Progress In The Browser Tab Title.", settings.progressInTitle)}
            ${switchHtml("tdh-reduce-motion", "Reduce Motion", "Disables Dropper Interface Animations.", settings.reduceMotion)}
            ${switchHtml("tdh-hide-sub-promos", "Hide Twitch Subscribe Promos", "Hides Twitch Subscribe CTAs And Promotional Highlight Cards.", settings.hideTwitchSubscriptionPromos)}
            <div class="mini-row"><span>Collapsed Panel Width</span><select class="select-lite" id="tdh-collapsed-width"><option value="full">Full</option><option value="compact">Compact</option><option value="narrow">Narrow</option></select></div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Maintain Backup Drops Channels Without Opening Extra Tabs." data-panel="tdh-queue-body"><span class="fl-tool-title">Stream Queue</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-queue-body">
            ${switchHtml("tdh-queue-enabled", "Maintain Backup Streams", "Keeps A Short List Of Eligible Backup Drops Channels Ready.", settings.queueEnabled)}
            <div class="mini-row"><span>Standby Streams</span><select class="select-lite" id="tdh-queue-count"><option value="1">1</option><option value="3">3</option><option value="5">5</option></select></div>
            ${switchHtml("tdh-queue-stall", "Switch On Stall", "Switches The Current Tab When Credited Progress Stalls.", settings.queueOnStall)}
            ${switchHtml("tdh-queue-offline", "Switch On Offline", "Switches The Current Tab When The Active Stream Goes Offline.", settings.queueOnOffline)}
            ${switchHtml("tdh-queue-category", "Switch On Category Change", "Finds A Replacement Stream If The Current Channel Changes Away From The Active Drop Game.", settings.queueOnCategoryChange)}
            <div class="mini-row"><span>Channel Preference</span><select class="select-lite" id="tdh-queue-preference"><option>Any Eligible</option><option>Lowest Viewers</option><option>Highest Viewers</option></select></div>
            <div class="compact-inventory open queue-list"><div class="inventory-head"><div><strong>Active + Standby</strong><span id="tdh-queue-summary"></span></div></div><div class="inventory-list" id="tdh-queue-list"></div></div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Background Earning, Interface Preferences, Notifications, Diagnostics, And Shortcuts." data-panel="tdh-advanced-body"><span class="fl-tool-title">Advanced</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-advanced-body">
            ${switchHtml("tdh-background-earning", "Background Earning Mode", "Monitors Twitch-Credited Minutes While The Stream Is In The Background.", settings.backgroundEarning)}
            ${switchHtml("tdh-notifications", "Notifications", "Shows Brief Dropper Notices For Important State Changes.", settings.notifications)}
            <div class="mini-row"><span>Pause Auto-Switch</span><select class="select-lite" id="tdh-pause-switch"><option value="0">Off</option><option value="30">30 Min</option><option value="60">1 Hour</option></select></div>
            <button type="button" class="life-btn" id="tdh-refresh-now">Refresh Drop State</button>
            <button type="button" class="life-btn" id="tdh-diagnostics-toggle">Show Diagnostics</button>
            <button type="button" class="life-btn" id="tdh-copy-diagnostics">Copy Diagnostics</button>
            <button type="button" class="life-btn" id="tdh-clear-activity">Clear Activity Log</button>
            <button type="button" class="life-btn" id="tdh-reset-session">Reset Session State</button>
            <div class="diag" id="tdh-diagnostics"></div>
          </div></section>
        </aside>
        <div class="progress-stack">
          <div class="badge-row">
          <section id="tdh-drop-card" aria-live="polite" data-help="Click To Expand · Hover To Preview">
            <div class="compact-line" id="tdh-compact-line"><span class="compact-dot" id="tdh-compact-dot"></span><span class="compact-reward" id="tdh-compact-reward">Waiting For Drop</span><span class="compact-extra" id="tdh-compact-extra"></span><span class="state-pill" id="tdh-compact-state">Idle</span></div>
            <div class="expanded-content">
              <div class="stream-info stream-info-hidden" id="tdh-stream-info"><img class="stream-avatar" id="tdh-stream-avatar" alt="" hidden><div><div class="stream-head"><div class="stream-channel" id="tdh-stream-channel"></div><span class="stream-live" id="tdh-stream-live" hidden>LIVE</span></div><div class="stream-game" id="tdh-stream-game" hidden></div><div class="stream-badges" id="tdh-stream-badges"></div></div><div class="stream-title" id="tdh-stream-title" hidden></div></div>
              <div class="drop-section"><div class="drop-kicker">Working Toward</div><div class="drop-head"><div class="drop-name" id="tdh-drop-name">Looking For An Active Drop…</div></div><div class="drop-game" id="tdh-drop-game"></div><div class="drop-bar-row"><div class="drop-bar"><span id="tdh-drop-fill"></span></div><div class="drop-percent" id="tdh-drop-percent">0%</div></div><div class="drop-meta" id="tdh-drop-meta"></div><div class="drop-status-row"><span class="state-pill" id="tdh-drop-state">Idle</span><span id="tdh-updated-ago"></span></div></div>
            </div>
          </section>
          <button type="button" id="tdh-settings-launcher" aria-controls="tdh-tools-dock" aria-expanded="false" aria-label="Open Dropper Settings" data-help="Click To Open Settings" data-userscript-launcher="userscript-launcher-v1" data-launcher-id="dropper" data-launcher-preferred-position="right-bottom">
            <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="track" cx="18" cy="18" r="15"></circle><circle class="fill" id="tdh-ring" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="0 100"></circle></svg>
            <svg class="icon" viewBox="0 0 1024 1024" aria-hidden="true"><polygon points="494,210 285,500 430,590" fill="#D9B5FF"/><polygon points="494,210 430,590 494,470" fill="#9B5AF9"/><polygon points="285,500 285,685 430,590" fill="#8C39F2"/><polygon points="285,685 494,842 430,590" fill="#5417B3"/><polygon points="430,590 494,470 494,842" fill="#7428E8"/><polygon points="530,210 739,500 594,590" fill="#AEB0C2"/><polygon points="530,210 594,590 530,470" fill="#6A6E87"/><polygon points="739,500 739,685 594,590" fill="#4E5268"/><polygon points="739,685 530,842 594,590" fill="#242633"/><polygon points="594,590 530,470 530,842" fill="#3F4254"/><rect x="502" y="205" width="20" height="650" rx="10" fill="#101017"/></svg>
          </button>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(host);
    ui = { host, shadow, cluster: shadow.getElementById("tdh-cluster"), launcher: shadow.getElementById("tdh-settings-launcher"), dock: shadow.getElementById("tdh-tools-dock") };
    const updateNotice = shadow.getElementById("tdh-update-notice");
    const progressStack = shadow.querySelector(".progress-stack");
    if (updateNotice && progressStack) progressStack.prepend(updateNotice);
    if (!clusterTop) clusterTop = window.innerHeight - 88;
    bindDrag();
    bindSwitches();
    bindPanels();
    bindMenuInactivity();
    bindDropperControls();
    setProgressCardCollapsed(localStorage.getItem(PROGRESS_CARD_STATE_KEY) === "true", false);
    renderSwitches();
    applyMotionSetting();
    applyAppearanceSettings();
    refreshDropCard();
    refreshQueueList();
    watchChatWidth();
    syncDropperWidthToChat();
    layoutChrome();
    ui.launcher.addEventListener("click", () => setRailOpen(!railOpen));
    shadow.getElementById("tdh-header-version")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!railOpen) setRailOpen(true);
      showCurrentChangelog();
      scheduleMenuDismiss();
    });
    shadow.getElementById("tdh-rail-close").addEventListener("click", () => setRailOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.altKey && (event.key === "g" || event.key === "G") && !event.repeat) { event.preventDefault(); setRailOpen(!railOpen, true); }
      if (event.key === "Escape" && railOpen) setRailOpen(false, true);
      if (!event.altKey && (event.key === "r" || event.key === "R") && railOpen) requestGqlPoll("keyboard-refresh", true);
    });
    document.addEventListener("pointerdown", (event) => { if (railOpen && !event.composedPath().includes(host)) setRailOpen(false); });
    return ui;
  }


  function formatUptime(value) {
    const match = String(value || "").match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!match) return value || "";
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function isTrustedTwitchUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      const host = parsed.hostname.toLowerCase();
      return parsed.protocol === "https:" && (host === "twitch.tv" || host === "www.twitch.tv" || host === "player.twitch.tv" || host === "embed.twitch.tv" || host.endsWith(".twitch.tv"));
    } catch (_) {
      return false;
    }
  }

  function pruneStandbyCache(now = Date.now()) {
    const source = Array.isArray(standbyCache) ? standbyCache : [];
    standbyCache = source.filter((item) =>
      item &&
      item.login &&
      Number(item.seenAt || 0) > now - STANDBY_CACHE_TTL_MS
    ).slice(-60);
    writeSession(STANDBY_CACHE_KEY, standbyCache);
    return standbyCache;
  }

  function rememberStandbyCandidates(candidates, context = {}) {
    if (!Array.isArray(candidates) || !candidates.length) return;
    const now = Date.now();
    const existing = pruneStandbyCache(now);
    const byLogin = new Map(existing.map((item) => [item.login, item]));

    for (const candidate of candidates) {
      const login = cleanText(candidate?.login).toLowerCase();
      const href = twitchChannelHref(candidate?.href);
      if (!login || !href) continue;
      byLogin.set(login, {
        ...(byLogin.get(login) || {}),
        login,
        href,
        label: cleanText(candidate.label || login),
        viewers: Number(candidate.viewers || 0),
        dropsTagged: Boolean(candidate.dropsTagged),
        game: cleanText(context.game || candidate.game || ""),
        gameSlug: cleanText(context.gameSlug || candidate.gameSlug || ""),
        campaignKey: cleanText(context.campaignKey || candidate.campaignKey || ""),
        seenAt: now,
      });
    }

    standbyCache = [...byLogin.values()]
      .sort((a, b) => Number(a.seenAt || 0) - Number(b.seenAt || 0))
      .slice(-60);
    writeSession(STANDBY_CACHE_KEY, standbyCache);
  }

  function cachedStandbyCandidates(gameName = currentDrop?.game || "", campaignKeyValue = currentDrop?.campaignKey || "") {
    const active = watchingLogin();
    const failed = new Set((getHandoffState()?.failedStreams || []).map((login) => cleanText(login).toLowerCase()));
    const wantedGame = normalizeGameName(gameName);
    const wantedCampaign = cleanText(campaignKeyValue);

    const items = pruneStandbyCache().filter((item) => {
      if (!item?.login || item.login === active || failed.has(item.login)) return false;
      if (wantedGame && item.game && !gameNamesMatch(wantedGame, item.game)) return false;
      if (wantedCampaign && item.campaignKey && item.campaignKey !== wantedCampaign) return false;
      return true;
    });

    items.sort((a, b) => {
      if (Boolean(b.dropsTagged) !== Boolean(a.dropsTagged)) return Number(Boolean(b.dropsTagged)) - Number(Boolean(a.dropsTagged));
      if (settings.queuePreference === "Lowest Viewers") return (a.viewers || Number.MAX_SAFE_INTEGER) - (b.viewers || Number.MAX_SAFE_INTEGER);
      if (settings.queuePreference === "Highest Viewers") return (b.viewers || 0) - (a.viewers || 0);
      return Number(b.seenAt || 0) - Number(a.seenAt || 0);
    });
    return items;
  }

  function discoverQueueCandidates() {
    const seen = new Set();
    const items = [];
    const active = watchingLogin();
    const pending = getHandoffState();
    const targetGame = pending?.targetGame || currentDrop?.game || "";
    const targetCampaignKey = pending?.targetCampaignKey || currentDrop?.campaignKey || "";

    const add = (href, label = "", metadata = {}) => {
      const channelHref = twitchChannelHref(href);
      if (!channelHref) return;
      try {
        const parsed = new URL(channelHref);
        const login = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
        if (!login || login.length < 2 || seen.has(login) || login === active) return;
        seen.add(login);
        const cleanLabel = cleanText(label) || login;
        const viewerMatch = cleanLabel.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
        const viewers = Number(metadata.viewers || (viewerMatch ? Number(viewerMatch[1].replace(/,/g, "")) : 0)) || 0;
        items.push({
          login,
          href: channelHref,
          label: metadata.label || cleanLabel || login,
          viewers,
          dropsTagged: Boolean(metadata.dropsTagged),
          source: metadata.source || "dom",
        });
      } catch (_) { /* ignore */ }
    };

    cachedStandbyCandidates(targetGame, targetCampaignKey).forEach((item) =>
      add(item.href, item.label, { ...item, source: "cache" })
    );

    document.querySelectorAll(
      "[data-test-selector='DropsCampaignInProgressDescription-hint-text-parent'] a, " +
      "[data-test-selector='DropsCampaignInProgressDescription-no-channels-hint-text'] a"
    ).forEach((node) => add(node.href, node.textContent, { dropsTagged: true, source: "campaign-hint" }));

    if (isDirectoryCategoryPage()) {
      document.querySelectorAll(
        "a[data-a-target='preview-card-channel-link'], a[data-test-selector*='channel-link']"
      ).forEach((node) => {
        const card =
          node.closest(
            'article, [data-a-target="preview-card"], [data-test-selector*="preview-card"], [class*="preview-card"]'
          ) || node.parentElement?.parentElement?.parentElement || node.parentElement;
        const text = cleanText(card?.textContent);
        const dropsTagged = Boolean(
          card?.querySelector?.(
            'a[href*="DropsEnabled"], [data-a-target*="Drops"], [data-test-selector*="Drops"], [aria-label*="Drops"]'
          )
        ) || /\bdrops\s*enabled\b/i.test(text);
        add(node.href, text || node.textContent, { dropsTagged, source: "category-card" });
      });
    }

    items.sort((a, b) => {
      if (Boolean(b.dropsTagged) !== Boolean(a.dropsTagged)) return Number(Boolean(b.dropsTagged)) - Number(Boolean(a.dropsTagged));
      if (settings.queuePreference === "Lowest Viewers") return (a.viewers || Number.MAX_SAFE_INTEGER) - (b.viewers || Number.MAX_SAFE_INTEGER);
      if (settings.queuePreference === "Highest Viewers") return (b.viewers || 0) - (a.viewers || 0);
      return 0;
    });

    return items.slice(0, Number(settings.queueCount) || 3);
  }

  function refreshQueueList() {
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-queue-list");
    const summary = ui.shadow.getElementById("tdh-queue-summary");
    if (!list) return;
    list.replaceChildren();
    const active = watchingLogin();
    if (active) appendQueueItem(list, active, "Active", currentDrop ? `${currentDrop.percent || 0}%` : "Watching", true);
    const candidates = settings.queueEnabled ? discoverQueueCandidates() : [];
    candidates.forEach((item, index) => appendQueueItem(
      list,
      item.label,
      item.viewers ? `Standby ${index + 1} · ${item.viewers} Viewers` : `Standby ${index + 1}`,
      item.dropsTagged ? "Drops" : "Standby",
      false,
    ));
    if (!active && !candidates.length) appendQueueItem(list, "No Eligible Streams Found", "Open Drops Inventory To Discover Channels", "Idle", false);
    if (summary) summary.textContent = settings.queueEnabled ? ` · ${candidates.length} Standby` : " · Off";
  }

  function appendQueueItem(list, name, meta, state, active) {
    const row = document.createElement("div");
    row.className = `inventory-item${active ? " current" : ""}`;
    const thumb = document.createElement("div"); thumb.className = "reward-thumb"; thumb.textContent = active ? "▶" : "•";
    const copy = document.createElement("div"); copy.className = "reward-copy";
    const title = document.createElement("div"); title.className = "reward-name"; title.textContent = name;
    const sub = document.createElement("div"); sub.className = "reward-meta"; sub.textContent = meta;
    copy.append(title, sub);
    const badge = document.createElement("div"); badge.className = "reward-state"; badge.textContent = state;
    row.append(thumb, copy, badge); list.appendChild(row);
  }

  function renderCompactInventory() {
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-inventory-list");
    const game = ui.shadow.getElementById("tdh-inventory-game");
    if (!list) return;
    list.replaceChildren();
    if (game) game.textContent = currentDrop?.game ? ` · ${currentDrop.game}` : "";
    if (!currentDrop) {
      appendInventoryItem(list, "No Active Drop", "Waiting For Twitch", "Idle");
      return;
    }
    const current = Number(currentDrop.currentMinutes) || 0;
    const required = Number(currentDrop.requiredMinutes) || 0;
    const state = currentDrop.isClaimed ? "Claimed" : currentDrop.percent >= 100 ? "Claim Ready" : `${currentDrop.percent || 0}%`;
    appendInventoryItem(list, currentDrop.name || "Current Drop", required ? `${current} / ${required} Min` : "Progress Pending", state);
  }

  function appendInventoryItem(list, name, meta, state) {
    const row = document.createElement("div"); row.className = "inventory-item current";
    const thumb = document.createElement("div"); thumb.className = "reward-thumb"; thumb.textContent = "◆";
    const copy = document.createElement("div"); copy.className = "reward-copy";
    const title = document.createElement("div"); title.className = "reward-name"; title.textContent = name;
    const sub = document.createElement("div"); sub.className = "reward-meta"; sub.textContent = meta;
    copy.append(title, sub);
    const badge = document.createElement("div"); badge.className = "reward-state"; badge.textContent = state;
    row.append(thumb, copy, badge); list.appendChild(row);
  }

  function applyProgressColor(percent) {
    if (!ui) return;
    const fill = ui.shadow.getElementById("tdh-drop-fill");
    const pct = ui.shadow.getElementById("tdh-drop-percent");
    const ring = ui.shadow.getElementById("tdh-ring");
    let main = "#dc2626", soft = "#fb7185";
    if (percent >= 90) { main = "#16a34a"; soft = "#4ade80"; }
    else if (percent >= 70) { main = "#65a30d"; soft = "#a3e635"; }
    else if (percent >= 50) { main = "#ca8a04"; soft = "#facc15"; }
    else if (percent >= 25) { main = "#ea580c"; soft = "#fb923c"; }
    if (fill) fill.style.background = `linear-gradient(90deg, ${main}, ${soft})`;
    if (pct) pct.style.color = soft;
    if (ring) ring.style.stroke = main;
  }

  function streamEarningHealthSnapshot() {
    const login = watchingLogin();
    const video = document.querySelector("video");
    const info = login ? readStreamInfo() : {
      live: false,
      game: "",
      dropsEnabled: false,
    };

    const videoPlaying = Boolean(
      video &&
      !video.paused &&
      !video.ended &&
      video.readyState > 1
    );

    const gameMatches = Boolean(
      currentDrop?.game &&
      info.game &&
      gameNamesMatch(currentDrop.game, info.game)
    );

    const healthy = Boolean(
      login &&
      currentDrop &&
      info.live &&
      videoPlaying &&
      gameMatches
    );

    return {
      login: login || null,
      live: Boolean(info.live),
      videoPlaying,
      expectedGame: currentDrop?.game || null,
      streamGame: info.game || null,
      gameMatches,
      dropsTagVisible: Boolean(info.dropsEnabled),
      healthy,
      progressAgeMs: Math.max(0, Date.now() - lastProgressAt),
    };
  }

  function syncCompactState() {
    if (!ui) return;
    const reward = ui.shadow.getElementById("tdh-compact-reward");
    const extra = ui.shadow.getElementById("tdh-compact-extra");
    const state = ui.shadow.getElementById("tdh-compact-state");
    const detail = ui.shadow.getElementById("tdh-drop-state");
    const updated = ui.shadow.getElementById("tdh-updated-ago");
    const health = streamEarningHealthSnapshot();
    const staleMs = health.progressAgeMs;

    let label = "Idle", cls = "state-pill";
    let ageClass = "";

    if (!getToken()) {
      label = "Login Required";
      cls += " warn";
    } else if (currentDrop?.percent >= 100) {
      label = currentDrop.isClaimed ? "Claimed ✓" : "Claim Ready";
      cls += " good";
    } else if (currentDrop && health.healthy) {
      if (staleMs >= HEALTHY_STREAM_STALLED_MS) {
        label = "Stalled";
        cls += " bad";
        ageClass = "bad";
      } else if (staleMs >= HEALTHY_STREAM_DELAYED_MS) {
        label = "Delayed";
        cls += " warn";
        ageClass = "warn";
      } else if (settings.backgroundEarning) {
        label = "BG Earning";
        cls += " good";
      } else {
        label = "Earning";
        cls += " good";
      }
    } else if (currentDrop && staleMs >= HEALTHY_STREAM_STALLED_MS) {
      label = "Stalled";
      cls += " bad";
      ageClass = "bad";
    } else if (currentDrop && staleMs >= UNHEALTHY_STREAM_DELAYED_MS) {
      label = "Delayed";
      cls += " warn";
      ageClass = "warn";
    } else if (currentDrop && settings.backgroundEarning) {
      label = "BG Earning";
      cls += " good";
    } else if (currentDrop) {
      label = "Earning";
      cls += " good";
    }

    if (reward) reward.textContent = currentDrop?.name || "Waiting For Drop";
    if (extra) extra.textContent = currentDrop
      ? `${currentDrop.percent || 0}% · ${Math.max(0, currentDrop.remainingMinutes || 0)}m`
      : "";

    if (state) {
      state.textContent = label;
      state.className = cls;
    }
    if (detail) {
      detail.textContent = label;
      detail.className = cls;
    }

    if (updated) {
      const ageSeconds = Math.max(0, Math.floor(staleMs / 1000));
      updated.textContent = currentDrop
        ? `Updated ${ageSeconds}s Ago`
        : "";
      updated.className = "progress-age";
      if (ageClass) updated.classList.add(ageClass);
    }

    const dot = ui.shadow.getElementById("tdh-compact-dot");
    if (dot) {
      dot.style.background =
        label === "Stalled" ? "#ef4444" :
        label === "Delayed" ? "#f59e0b" :
        label.includes("Earning") || label.includes("Claim") ? "#22c55e" :
        "#9147ff";
    }
  }

  function applyMotionSetting() {
    ui?.cluster?.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
  }

  function normalizedCollapsedPanelWidth(value = settings.collapsedPanelWidth) {
    const normalized = cleanText(value).toLowerCase();
    return ["full", "compact", "narrow"].includes(normalized) ? normalized : "compact";
  }

  function applyAppearanceSettings() {
    if (!ui) return;
    const stack = ui.shadow.querySelector(".progress-stack");
    if (!stack) return;
    const width = normalizedCollapsedPanelWidth();
    stack.dataset.collapsedWidth = width;
    const select = ui.shadow.getElementById("tdh-collapsed-width");
    if (select && select.value !== width) select.value = width;
    requestAnimationFrame(layoutChrome);
  }

  function clearProgressExpandTimer() {
    clearTimeout(progressExpandTimer);
    progressExpandTimer = null;
    progressCollapseAt = 0;
  }

  function scheduleProgressExpandCollapse() {
    clearTimeout(progressExpandTimer);
    progressExpandTimer = null;
    if (!ui) return;

    const card = ui.shadow.getElementById("tdh-drop-card");
    if (!card || card.classList.contains("collapsed")) {
      progressCollapseAt = 0;
      return;
    }

    progressCollapseAt = Date.now() + PROGRESS_EXPAND_AUTO_COLLAPSE_MS;
    progressExpandTimer = setTimeout(() => {
      enforceAutoDismissDeadlines(Date.now());
    }, PROGRESS_EXPAND_AUTO_COLLAPSE_MS + 20);
  }

  function setProgressCardCollapsed(collapsed, persist = false) {
    if (!ui) return;
    const card = ui.shadow.getElementById("tdh-drop-card");
    const stack = ui.shadow.querySelector(".progress-stack");
    if (!card || !stack) return;
    const isCollapsed = Boolean(collapsed);
    card.classList.toggle("collapsed", isCollapsed);
    stack.classList.toggle("is-collapsed", isCollapsed);
    stack.dataset.collapsedWidth = normalizedCollapsedPanelWidth();
    card.setAttribute("aria-expanded", String(!isCollapsed));
    card.setAttribute("aria-label", isCollapsed ? "Expand Dropper Progress Panel" : "Dropper Progress Panel");
    card.tabIndex = isCollapsed ? 0 : -1;
    card.removeAttribute("title");
    if (isCollapsed) clearProgressExpandTimer();
    else scheduleProgressExpandCollapse();
    if (persist) localStorage.setItem(PROGRESS_CARD_STATE_KEY, String(isCollapsed));
    requestAnimationFrame(layoutChrome);
  }

  function positionCollapsedPreview() {
    if (!ui) return;
    const card = ui.shadow.getElementById("tdh-drop-card");
    const preview = card?.querySelector(".expanded-content");
    if (!card?.classList.contains("collapsed") || !preview) return;
    const rect = card.getBoundingClientRect();
    const previewHeight = preview.offsetHeight || 120;
    const spaceAbove = rect.top - 8;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    card.classList.toggle("preview-below", spaceAbove < previewHeight + 12 && spaceBelow > spaceAbove);
  }

  function isAutoSwitchPaused() { return pauseAutoSwitchUntil > Date.now(); }

  function bindDropperControls() {
    const s = ui.shadow;
    const inventory = s.getElementById("tdh-compact-inventory");
    s.getElementById("tdh-toggle-inventory")?.addEventListener("click", (event) => {
      const open = inventory.classList.toggle("open");
      event.currentTarget.textContent = open ? "Hide Drops Inventory" : "Show Drops Inventory";
      renderCompactInventory();
      requestAnimationFrame(layoutChrome);
    });
    const progressCard = s.getElementById("tdh-drop-card");
    const expandCollapsedCard = () => {
      if (!progressCard?.classList.contains("collapsed")) return false;
      setProgressCardCollapsed(false, true);
      return true;
    };
    progressCard?.addEventListener("click", () => expandCollapsedCard());
    progressCard?.addEventListener("keydown", (event) => {
      if (!progressCard.classList.contains("collapsed")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      expandCollapsedCard();
    });
    s.getElementById("tdh-refresh-now")?.addEventListener("click", () => requestGqlPoll("manual-refresh", true));
    const diag = s.getElementById("tdh-diagnostics");
    s.getElementById("tdh-diagnostics-toggle")?.addEventListener("click", (event) => {
      diag.classList.toggle("open");
      event.currentTarget.textContent = diag.classList.contains("open") ? "Hide Diagnostics" : "Show Diagnostics";
      diag.textContent = diagnosticsText();
      requestAnimationFrame(layoutChrome);
    });
    s.getElementById("tdh-copy-diagnostics")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(diagnosticsText());
        button.textContent = "Diagnostics Copied";
        logActivity("diagnostics", "Diagnostics copied to clipboard");
      } catch (_) {
        button.textContent = "Copy Failed";
      }
      setTimeout(() => { button.textContent = "Copy Diagnostics"; }, 1600);
    });
    s.getElementById("tdh-clear-activity")?.addEventListener("click", (event) => {
      clearActivityLog();
      event.currentTarget.textContent = "Activity Cleared";
      if (diag.classList.contains("open")) diag.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Clear Activity Log"; }, 1600);
    });
    s.getElementById("tdh-reset-session")?.addEventListener("click", (event) => {
      resetTransientSessionState();
      event.currentTarget.textContent = "Session Reset";
      if (diag.classList.contains("open")) diag.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Reset Session State"; }, 1600);
    });
    const queueCount = s.getElementById("tdh-queue-count"); queueCount.value = String(settings.queueCount); queueCount.addEventListener("change", () => { settings.queueCount = Number(queueCount.value); saveSettings(); refreshQueueList(); });
    const pref = s.getElementById("tdh-queue-preference"); pref.value = settings.queuePreference; pref.addEventListener("change", () => { settings.queuePreference = pref.value; saveSettings(); refreshQueueList(); });
    const pause = s.getElementById("tdh-pause-switch"); pause.value = String(settings.pauseAutoSwitchMinutes || 0); pause.addEventListener("change", () => { settings.pauseAutoSwitchMinutes = Number(pause.value); pauseAutoSwitchUntil = settings.pauseAutoSwitchMinutes ? Date.now() + settings.pauseAutoSwitchMinutes * 60000 : 0; saveSettings(); });
    const collapsedWidth = s.getElementById("tdh-collapsed-width");
    collapsedWidth.value = normalizedCollapsedPanelWidth();
    collapsedWidth.addEventListener("change", () => {
      settings.collapsedPanelWidth = normalizedCollapsedPanelWidth(collapsedWidth.value);
      saveSettings();
      applyAppearanceSettings();
    });
    const card = s.getElementById("tdh-drop-card");
    card.addEventListener("mouseenter", positionCollapsedPreview);
    card.addEventListener("focusin", positionCollapsedPreview);
    s.getElementById("tdh-update-dismiss")?.addEventListener("click", hideUpdateNotice);
  }

  function notifyUser(text) {
    if (!settings.notifications || !ui) return;
    const toast = ui.shadow.getElementById("tdh-toast");
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(notifyUser.timer);
    notifyUser.timer = setTimeout(() => { toast.hidden = true; }, 3000);
    requestAnimationFrame(layoutChrome);
  }

  function loadUpdateReloadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(UPDATE_RELOAD_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveUpdateReloadState(state) {
    try {
      localStorage.setItem(UPDATE_RELOAD_KEY, JSON.stringify(state || {}));
    } catch (_) {
      /* ignore */
    }
  }

  function clearUpdateReloadState(reason = "") {
    clearTimeout(updateReloadTimer);
    clearTimeout(updateFallbackTimer);
    updateReloadTimer = null;
    updateFallbackTimer = null;
    try { localStorage.removeItem(UPDATE_RELOAD_KEY); } catch (_) { /* ignore */ }
    if (reason) logActivity("update-reload", reason);
  }

  function validUpdateReloadState(now = Date.now()) {
    const state = loadUpdateReloadState();
    if (!state?.startedAt || !state?.targetVersion) return null;

    if (Number(state.expiresAt || 0) <= now) {
      clearUpdateReloadState("Pending update refresh expired");
      return null;
    }

    if (compareVersions(APP_VERSION, state.targetVersion) >= 0) {
      clearUpdateReloadState(`Installed v${APP_VERSION} already satisfies pending update v${state.targetVersion}`);
      return null;
    }

    return state;
  }

  function performUpdateReload(reason) {
    const state = validUpdateReloadState();
    if (!state) return false;

    clearUpdateReloadState(`Refreshing Twitch after update install · ${reason}`);
    setStatus("Update Install Started · Refreshing Twitch");
    location.reload();
    return true;
  }

  function scheduleUpdateReload(delayMs = UPDATE_RETURN_DELAY_MS, reason = "return") {
    const state = validUpdateReloadState();
    if (!state) return false;

    const now = Date.now();
    const reloadAt = now + Math.max(0, Number(delayMs) || 0);
    const existingReloadAt = Number(state.reloadAt || 0);

    // Keep an already-sooner refresh instead of extending it because focus and
    // visibility events often arrive together.
    if (existingReloadAt && existingReloadAt <= reloadAt) return true;

    state.reloadAt = reloadAt;
    state.reloadReason = reason;
    saveUpdateReloadState(state);

    clearTimeout(updateReloadTimer);
    updateReloadTimer = setTimeout(() => {
      performUpdateReload(reason);
    }, Math.max(0, reloadAt - Date.now()));

    setStatus(`Update Install Started · Refreshing In ${Math.max(1, Math.ceil(delayMs / 1000))}s`);
    return true;
  }

  function markUpdateInstallerLeft(reason = "blur") {
    const state = validUpdateReloadState();
    if (!state || state.leftAt) return false;
    state.leftAt = Date.now();
    state.leftReason = reason;
    saveUpdateReloadState(state);
    logActivity("update-reload", "Left Twitch for userscript installer", {
      targetVersion: state.targetVersion,
      reason,
    });
    return true;
  }

  function handleUpdateInstallerReturn(reason = "focus") {
    const state = validUpdateReloadState();
    if (!state) return false;

    if (state.leftAt) {
      return scheduleUpdateReload(UPDATE_RETURN_DELAY_MS, `returned-via-${reason}`);
    }

    // If the browser never reported blur/hidden, the fallback deadline can
    // still safely trigger a refresh while Twitch is visible.
    if (Date.now() >= Number(state.fallbackAt || 0)) {
      return scheduleUpdateReload(UPDATE_RETURN_DELAY_MS, `fallback-via-${reason}`);
    }
    return false;
  }

  function enforceUpdateReloadPending(now = Date.now()) {
    const state = validUpdateReloadState(now);
    if (!state) return false;

    if (state.reloadAt && now >= Number(state.reloadAt)) {
      return performUpdateReload(state.reloadReason || "scheduled");
    }

    if (now < Number(state.fallbackAt || 0)) return false;

    if (document.visibilityState === "visible") {
      return scheduleUpdateReload(UPDATE_RETURN_DELAY_MS, "45-second-fallback");
    }
    return false;
  }

  function scheduleUpdateReloadFallback() {
    const state = validUpdateReloadState();
    if (!state) return;

    clearTimeout(updateFallbackTimer);
    const delay = Math.max(0, Number(state.fallbackAt || 0) - Date.now());
    updateFallbackTimer = setTimeout(() => {
      enforceUpdateReloadPending(Date.now());
    }, delay + 20);
  }

  function beginUpdateInstall(targetVersion) {
    const version = cleanText(targetVersion);
    if (!version || compareVersions(version, APP_VERSION) <= 0) {
      window.open(UPDATE_URL, "_blank", "noopener");
      return;
    }

    const now = Date.now();
    clearTimeout(updateReloadTimer);
    clearTimeout(updateFallbackTimer);
    updateReloadTimer = null;
    updateFallbackTimer = null;

    saveUpdateReloadState({
      sourceVersion: APP_VERSION,
      targetVersion: version,
      startedAt: now,
      leftAt: 0,
      fallbackAt: now + UPDATE_RELOAD_FALLBACK_MS,
      expiresAt: now + UPDATE_RELOAD_PENDING_TTL_MS,
      reloadAt: 0,
      reloadReason: "",
    });

    logActivity("update-reload", `Started install for Dropper v${version}`, {
      fallbackSeconds: Math.round(UPDATE_RELOAD_FALLBACK_MS / 1000),
      expiresSeconds: Math.round(UPDATE_RELOAD_PENDING_TTL_MS / 1000),
    });

    scheduleUpdateReloadFallback();
    setStatus("Update Installer Opened · Return To Twitch After Reinstalling");
    window.open(UPDATE_URL, "_blank", "noopener");
  }

  function resumeUpdateReloadPending() {
    const state = validUpdateReloadState();
    if (!state) return;
    scheduleUpdateReloadFallback();
    enforceUpdateReloadPending(Date.now());
  }

  function showCurrentChangelog() {
    showUpdateNotice(
      "Dropper Changelog",
      `What\'s new in v${APP_VERSION}.`,
      "",
      null,
      {
        kicker: "Current Version",
        version: APP_VERSION,
        details: RELEASE_NOTES[APP_VERSION] || [],
        releaseUrl: RELEASES_URL,
        placement: "menu",
      },
    );
  }

  function placeUpdateNotice(placement = "progress") {
    if (!ui) return;
    const notice = ui.shadow.getElementById("tdh-update-notice");
    const progressStack = ui.shadow.querySelector(".progress-stack");
    if (!notice || !progressStack) return;

    notice.dataset.placement = placement === "menu" ? "menu" : "progress";
    if (notice.dataset.placement === "progress") {
      progressStack.prepend(notice);
    } else if (notice.parentElement !== ui.cluster) {
      ui.cluster.appendChild(notice);
    }
  }

  function positionMenuUpdateNotice(openUp) {
    if (!ui) return;
    const notice = ui.shadow.getElementById("tdh-update-notice");
    const progressStack = ui.shadow.querySelector(".progress-stack");
    if (
      !notice ||
      !progressStack ||
      notice.hidden ||
      notice.dataset.placement !== "menu" ||
      notice.parentElement !== ui.cluster
    ) return;

    if (openUp) {
      ui.cluster.insertBefore(notice, ui.dock);
    } else {
      ui.cluster.insertBefore(notice, progressStack);
    }
  }

  function showUpdateNotice(title, text, actionText = "View Update", action = null, options = {}) {
    const details = Array.isArray(options.details) ? options.details.slice(0, 4) : [];
    const state = {
      title,
      text,
      actionText,
      action,
      kicker: options.kicker || "What's New",
      version: options.version || APP_VERSION,
      details,
      releaseUrl: options.releaseUrl || RELEASES_URL,
      placement: options.placement === "menu" ? "menu" : "progress",
    };
    if (!ui) { updateNoticeState = state; return; }

    clearTimeout(updateNoticeTimer);
    placeUpdateNotice(state.placement);
    const notice = ui.shadow.getElementById("tdh-update-notice");
    const list = ui.shadow.getElementById("tdh-update-list");
    ui.shadow.getElementById("tdh-update-kicker").textContent = state.kicker;
    ui.shadow.getElementById("tdh-update-title").textContent = title;
    ui.shadow.getElementById("tdh-update-version").textContent = state.version ? `v${state.version}` : "";
    ui.shadow.getElementById("tdh-update-text").textContent = text || "";

    list.replaceChildren();
    details.forEach((detail) => {
      const item = document.createElement("li");
      item.textContent = detail;
      list.appendChild(item);
    });
    list.hidden = details.length === 0;

    const releaseButton = ui.shadow.getElementById("tdh-update-release");
    releaseButton.hidden = !state.releaseUrl;
    releaseButton.onclick = state.releaseUrl
      ? () => window.open(state.releaseUrl, "_blank", "noopener")
      : null;

    const button = ui.shadow.getElementById("tdh-update-action");
    const hasDistinctAction = Boolean(action && action !== hideUpdateNotice);
    button.hidden = !hasDistinctAction;
    button.textContent = actionText;
    button.onclick = hasDistinctAction ? action : null;

    notice.hidden = false;
    updateNoticeState = state;
    requestAnimationFrame(layoutChrome);

    updateNoticeTimer = setTimeout(() => {
      if (!notice.hidden) hideUpdateNotice();
    }, UPDATE_NOTICE_DURATION_MS);
  }

  function hideUpdateNotice() {
    clearTimeout(updateNoticeTimer);
    updateNoticeTimer = null;
    const notice = ui?.shadow?.getElementById("tdh-update-notice");
    if (notice) notice.hidden = true;
    updateNoticeState = null;
    requestAnimationFrame(layoutChrome);
  }

  function loadUpdateState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(UPDATE_STATE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveUpdateState(state) {
    try {
      localStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(state || {}));
    } catch (_) {
      /* ignore */
    }
  }

  function markUpdateAvailable(version) {
    if (!ui || !version || compareVersions(version, APP_VERSION) <= 0) return;

    ui.launcher?.classList.add("update-available");
    if (ui.launcher) {
      ui.launcher.dataset.help = `Click To Open Settings · Update v${version} Available`;
      ui.launcher.removeAttribute("title");
      ui.launcher.setAttribute("aria-label", `Open Dropper Settings · Update v${version} Available`);
    }

    showUpdateNotice(
      "New Dropper Version Available",
      `v${version} is ready to install.`,
      "Install Update",
      () => beginUpdateInstall(version),
      {
        kicker: "Update Available",
        version,
        details: [
          "A newer Dropper build is available.",
          "Install the latest userscript to get the newest fixes and improvements.",
          "After reinstalling, return to Twitch and Dropper will refresh this page automatically.",
        ],
      },
    );

    notifyUser(`Dropper v${version} Update Available`);
  }

  function clearUpdateAvailableIndicator() {
    ui?.launcher?.classList.remove("update-available");
    if (ui?.launcher) {
      ui.launcher.dataset.help = "Click To Open Settings";
      ui.launcher.removeAttribute("title");
      ui.launcher.setAttribute("aria-label", "Open Dropper Settings");
    }
  }

  function checkCachedUpdateNotice() {
    const state = loadUpdateState();
    const available = cleanText(state.availableVersion || "");
    if (available && compareVersions(available, APP_VERSION) > 0) {
      markUpdateAvailable(available);
      return true;
    }
    if (available && compareVersions(available, APP_VERSION) <= 0) {
      state.availableVersion = "";
      state.availableAt = 0;
      saveUpdateState(state);
    }
    clearUpdateAvailableIndicator();
    return false;
  }

  function checkVersionNotice() {
    const state = loadUpdateState();
    if (state.availableVersion && compareVersions(state.availableVersion, APP_VERSION) <= 0) {
      state.availableVersion = "";
      state.availableAt = 0;
      saveUpdateState(state);
    }
    clearUpdateAvailableIndicator();

    const previous = localStorage.getItem(LAST_VERSION_KEY);
    if (previous && previous !== APP_VERSION) {
      showUpdateNotice(
        "Dropper Updated",
        `Updated from v${previous} to v${APP_VERSION}.`,
        "",
        null,
        { kicker: "Update Complete", version: APP_VERSION, details: RELEASE_NOTES[APP_VERSION] || [] },
      );
    }
    localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
    checkCachedUpdateNotice();
  }

  function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) { const diff = (pa[i] || 0) - (pb[i] || 0); if (diff) return diff; }
    return 0;
  }

  function scheduleUpdateCheck(force = false) {
    if (typeof GM_xmlhttpRequest !== "function") return;

    const now = Date.now();
    const state = loadUpdateState();

    // An installed version should always get at least one fresh check of its own.
    // This prevents a check from an older version suppressing update discovery.
    const checkedForCurrentVersion = state.checkedForVersion === APP_VERSION;
    const lastCheckAt = Number(state.lastCheckAt || 0);
    if (!force && checkedForCurrentVersion && now - lastCheckAt < UPDATE_CHECK_INTERVAL_MS) {
      checkCachedUpdateNotice();
      return;
    }

    state.checkedForVersion = APP_VERSION;
    state.lastCheckAt = now;
    state.lastError = "";
    saveUpdateState(state);

    const cacheBucket = Math.floor(now / UPDATE_CHECK_INTERVAL_MS);
    const checkUrl = `${UPDATE_URL}?dropper_check=${encodeURIComponent(APP_VERSION)}&t=${cacheBucket}`;

    GM_xmlhttpRequest({
      method: "GET",
      url: checkUrl,
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      timeout: 12000,
      onload(response) {
        const nextState = loadUpdateState();
        const remote = String(response.responseText || "");
        const match = remote.match(/^\/\/ @version\s+([^\s]+)/m);
        const remoteVersion = cleanText(match?.[1] || "");

        nextState.checkedForVersion = APP_VERSION;
        nextState.lastCheckAt = Date.now();
        nextState.lastHttpStatus = Number(response.status || 0);
        nextState.lastRemoteVersion = remoteVersion || "";
        nextState.lastError = "";

        if (remoteVersion && compareVersions(remoteVersion, APP_VERSION) > 0) {
          nextState.availableVersion = remoteVersion;
          nextState.availableAt = Date.now();
          saveUpdateState(nextState);
          logActivity("update", `Dropper v${remoteVersion} is available`, {
            installedVersion: APP_VERSION,
            remoteVersion,
          });
          markUpdateAvailable(remoteVersion);
          return;
        }

        if (remoteVersion && compareVersions(remoteVersion, APP_VERSION) <= 0) {
          nextState.availableVersion = "";
          nextState.availableAt = 0;
          clearUpdateAvailableIndicator();
        }

        saveUpdateState(nextState);
      },
      onerror(response) {
        const nextState = loadUpdateState();
        nextState.lastError = `Update check network error${response?.status ? ` (${response.status})` : ""}`;
        nextState.lastCheckAt = Date.now();
        saveUpdateState(nextState);
        logActivity("update-error", nextState.lastError);
      },
      ontimeout() {
        const nextState = loadUpdateState();
        nextState.lastError = "Update check timed out";
        nextState.lastCheckAt = Date.now();
        saveUpdateState(nextState);
        logActivity("update-error", nextState.lastError);
      },
    });
  }

  function selectorHealthSnapshot() {
    return {
      video: Boolean(document.querySelector("video")),
      streamInfo: Boolean(document.querySelector("#live-channel-stream-information")),
      dropsEnabledTag: Boolean(document.querySelector('[data-a-target="DropsEnabled"], a[href*="/tags/DropsEnabled"]')),
      inventoryCampaignCards: document.querySelectorAll(
        ".inventory-max-width > div:not(:first-child), [data-test-selector*='DropsCampaign'], [class*='drops-campaign']",
      ).length,
      directoryChannelLinks: document.querySelectorAll(
        'a[data-a-target="preview-card-channel-link"], a[data-test-selector*="channel-link"]',
      ).length,
      claimButtons: document.querySelectorAll(DROP_CLAIM_SELECTOR).length,
      chatColumn: Boolean(findTwitchChatColumn()),
      uiMounted: Boolean(ui?.host?.isConnected),
    };
  }

  function resetTransientSessionState() {
    [NEXT_GAME_KEY, "tdh-drop", "tdh-progress", "tdh-progress-at"].forEach((key) => {
      try { sessionStorage.removeItem(key); } catch (_) { /* ignore */ }
    });
    currentDrop = null;
    lastProgress = 0;
    lastProgressAt = Date.now();
    progressLabel = "";
    logActivity("diagnostics", "Transient Dropper session state reset");
    refreshDropCard();
    queueGqlPollSoon("session-reset", GQL_MIN_GAP_MS);
  }

  function diagnosticsText() {
    return JSON.stringify(dropperDebugSnapshot(), null, 2);
  }

  function dropperDebugSnapshot() {
    const now = Date.now();
    const handoff = getHandoffState();
    const card = ui?.shadow?.getElementById("tdh-drop-card");
    const chat = findTwitchChatColumn();
    const circuit = networkCircuitSnapshot(now);
    return {
      version: APP_VERSION,
      headerVersionControl: Boolean(ui?.shadow?.getElementById("tdh-header-version")),
      autoDismiss: {
        menuSeconds: Math.round(MENU_INACTIVITY_DISMISS_MS / 1000),
        progressExpandSeconds: Math.round(PROGRESS_EXPAND_AUTO_COLLAPSE_MS / 1000),
        menuTimerActive: Boolean(menuDismissTimer),
        progressTimerActive: Boolean(progressExpandTimer),
        menuDismissAt: menuDismissAt ? new Date(menuDismissAt).toISOString() : null,
        progressCollapseAt: progressCollapseAt ? new Date(progressCollapseAt).toISOString() : null,
        menuRemainingSeconds: menuDismissAt ? Math.max(0, Math.ceil((menuDismissAt - now) / 1000)) : null,
        progressRemainingSeconds: progressCollapseAt ? Math.max(0, Math.ceil((progressCollapseAt - now) / 1000)) : null,
      },
      updateNoticePlacement: ui?.shadow?.getElementById("tdh-update-notice")?.dataset?.placement || null,
      generatedAt: new Date(now).toISOString(),
      tokenCaptured: Boolean(getToken()),
      deviceCaptured: Boolean(capturedDevice || cookie("unique_id")),
      watchingLogin: watchingLogin(),
      currentDrop,
      progressReconciliation: lastProgressReconcile ? {
        ...lastProgressReconcile,
        at: new Date(lastProgressReconcile.at).toISOString(),
      } : null,
      claimReadyFallback: {
        active: Boolean(claimReadySince),
        ageSeconds: claimReadySince ? Math.floor((now - claimReadySince) / 1000) : 0,
        graceSeconds: Math.round(CLAIM_READY_GRACE_MS / 1000),
        signature: claimReadySignature || null,
        dropInstanceIdAvailable: Boolean(currentDrop?.dropInstanceID),
      },
      progressAgeSeconds: Math.max(0, Math.floor((now - lastProgressAt) / 1000)),
      lastProgress,
      lastProgressAt: new Date(lastProgressAt).toISOString(),
      navigationGuard: (() => {
        const guard = navigationGuardSnapshot(now);
        return {
          blocked: guard.blocked,
          blockedUntil: guard.blockedUntil ? new Date(guard.blockedUntil).toISOString() : null,
          attemptsLastMinute: guard.events.length,
          limitPerMinute: AUTO_NAVIGATION_LIMIT,
          lastTarget: guard.lastTarget || null,
          lastReason: guard.lastReason || null,
          streamRouteSettleSeconds: Math.round(STREAM_ROUTE_SETTLE_MS / 1000),
          pageAgeSeconds: Math.floor((now - PAGE_STARTED_AT) / 1000),
        };
      })(),
      heartbeat: {
        intervalMs: HEARTBEAT_INTERVAL_MS,
        lastAt: lastHeartbeatAt ? new Date(lastHeartbeatAt).toISOString() : null,
        startupNetworkQuietMs: STARTUP_NETWORK_QUIET_MS,
        startupNetworkReadyAt: startupNetworkReadyAt ? new Date(startupNetworkReadyAt).toISOString() : null,
      },
      gql: {
        normalIntervalMs: GQL_POLL_INTERVAL_MS,
        recoveryIntervalMs: GQL_RECOVERY_INTERVAL_MS,
        minimumGapMs: GQL_MIN_GAP_MS,
        nextPollAt: nextGqlPollAt ? new Date(nextGqlPollAt).toISOString() : null,
        inFlight: gqlPollInFlight,
        errorStreak: gqlErrorStreak,
        lastReason: lastGqlReason || null,
        pendingReason: pendingGqlReason || null,
        lastPollAt: lastGqlPollAt ? new Date(lastGqlPollAt).toISOString() : null,
        lastSuccessAt: lastGqlSuccessAt ? new Date(lastGqlSuccessAt).toISOString() : null,
        lastInterceptedTwitchResponseAt: lastTwitchGqlAt ? new Date(lastTwitchGqlAt).toISOString() : null,
        lastError: lastGqlError || null,
      },
      updateCheck: (() => {
        const state = loadUpdateState();
        return {
          intervalMinutes: Math.round(UPDATE_CHECK_INTERVAL_MS / 60000),
          checkedForVersion: state.checkedForVersion || null,
          lastCheckAt: state.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : null,
          lastRemoteVersion: state.lastRemoteVersion || null,
          availableVersion: state.availableVersion || null,
          availableAt: state.availableAt ? new Date(state.availableAt).toISOString() : null,
          lastHttpStatus: Number(state.lastHttpStatus || 0) || null,
          lastError: state.lastError || null,
          pendingRefresh: (() => {
            const pending = loadUpdateReloadState();
            if (!pending?.startedAt || !pending?.targetVersion) return null;
            return {
              sourceVersion: pending.sourceVersion || null,
              targetVersion: pending.targetVersion,
              ageSeconds: Math.max(0, Math.floor((now - Number(pending.startedAt)) / 1000)),
              leftInstallerAt: pending.leftAt ? new Date(pending.leftAt).toISOString() : null,
              fallbackAt: pending.fallbackAt ? new Date(pending.fallbackAt).toISOString() : null,
              expiresAt: pending.expiresAt ? new Date(pending.expiresAt).toISOString() : null,
              reloadAt: pending.reloadAt ? new Date(pending.reloadAt).toISOString() : null,
              reloadReason: pending.reloadReason || null,
            };
          })(),
        };
      })(),
      networkSafety: {
        circuitOpen: circuit.open,
        circuitReason: circuit.reason || null,
        circuitOpenUntil: circuit.openUntil ? new Date(circuit.openUntil).toISOString() : null,
        requestsLastHour: circuit.requestsLastHour,
        softRequestBudgetPerHour: circuit.softBudget,
        softBudgetExceeded: circuit.softBudgetExceeded,
        circuitTriggers: ["429/rate limit", "authorization failures", "repeated GQL failures"],
        consecutiveFailures: circuit.consecutiveFailures,
      },
      streamVerification: {
        timeoutSeconds: Math.round(ACTIVE_STREAM_VERIFY_TIMEOUT_MS / 1000),
        lastVerified: lastStreamVerification ? {
          ...lastStreamVerification,
          at: new Date(lastStreamVerification.at).toISOString(),
        } : null,
        baselineMinutes: Number.isFinite(Number(handoff?.verifyBaselineMinutes)) ? Number(handoff.verifyBaselineMinutes) : null,
        baselinePercent: Number.isFinite(Number(handoff?.verifyBaselinePercent)) ? Number(handoff.verifyBaselinePercent) : null,
      },
      activeCampaignRouting: {
        needsStream: activeDropNeedsStream(),
        watchingLogin: watchingLogin() || null,
        locked: Boolean(getHandoffState()?.lockActiveCampaign),
        failedStreams: getHandoffState()?.failedStreams || [],
        targetGame: getHandoffState()?.targetGame || currentDrop?.game || null,
        targetCampaign: getHandoffState()?.targetCampaign || currentDrop?.campaign || null,
      },
      categoryRouting: {
        activeGame: currentDrop?.game || null,
        suppliedSlug: currentDrop?.gameSlug || null,
        resolvedSlug: currentDrop?.game ? resolveCategorySlug(currentDrop) : null,
        resolvedUrl: currentDrop?.game ? gameDirectoryUrl(currentDrop) : null,
        learnedSlugCount: Object.keys(categorySlugCache || {}).length,
        learnedSlug: currentDrop?.game ? categorySlugCache[normalizeGameName(currentDrop.game)] || null : null,
        canonicalAlias: currentDrop?.game ? CATEGORY_SLUG_ALIASES[normalizeGameName(currentDrop.game)] || null : null,
      },
      earningHealth: (() => {
        const health = streamEarningHealthSnapshot();
        return {
          login: health.login,
          live: health.live,
          videoPlaying: health.videoPlaying,
          expectedGame: health.expectedGame,
          streamGame: health.streamGame,
          gameMatches: health.gameMatches,
          dropsTagVisible: health.dropsTagVisible,
          healthy: health.healthy,
          progressAgeSeconds: Math.floor(health.progressAgeMs / 1000),
          delayedAfterSeconds: Math.round(
            (health.healthy ? HEALTHY_STREAM_DELAYED_MS : UNHEALTHY_STREAM_DELAYED_MS) / 1000
          ),
          stalledAfterSeconds: Math.round(HEALTHY_STREAM_STALLED_MS / 1000),
        };
      })(),
      categoryMatch: (() => {
        const info = readStreamInfo();
        const expectedGame = currentDrop?.game || "";
        const actualGame = info.game || "";
        return {
          expectedGame: expectedGame || null,
          streamGame: actualGame || null,
          matches: expectedGame && actualGame ? gameNamesMatch(expectedGame, actualGame) : null,
          mismatchActive: Boolean(categoryMismatchSince),
          mismatchAgeSeconds: categoryMismatchSince ? Math.floor((now - categoryMismatchSince) / 1000) : 0,
          graceSeconds: Math.round(CATEGORY_MISMATCH_GRACE_MS / 1000),
        };
      })(),
      campaignExpiry: (() => {
        const expiry = campaignExpirySnapshot(lastInventoryCampaigns, currentDrop, now);
        return expiry ? {
          campaign: expiry.campaignName,
          game: expiry.game,
          endAt: expiry.endAt || null,
          ended: expiry.ended,
          overdue: expiry.overdue,
          hasUnclaimed: expiry.hasUnclaimed,
          graceRemainingSeconds: Math.ceil(expiry.graceRemainingMs / 1000),
          graceSeconds: Math.round(CAMPAIGN_EXPIRY_GRACE_MS / 1000),
          lastClaimAttemptAt: lastClaimAttemptAt ? new Date(lastClaimAttemptAt).toISOString() : null,
          claimRetryIntervalSeconds: Math.round(CLAIM_RETRY_INTERVAL_MS / 1000),
        } : null;
      })(),
      handoff: handoff ? {
        state: normalizedHandoffState(handoff),
        targetGame: handoff.targetGame || null,
        targetStream: handoff.targetStream || null,
        completedGame: handoff.completedGame || null,
        skippedGames: handoff.skippedGames || [],
        ageSeconds: Math.max(0, Math.floor((now - Number(handoff.startedAt || now)) / 1000)),
        stateAgeSeconds: Math.max(0, Math.floor((now - Number(handoff.stateStartedAt || handoff.startedAt || now)) / 1000)),
      } : { state: "idle" },
      selectors: selectorHealthSnapshot(),
      subscriptionPromoSuppression: {
        enabled: Boolean(settings.hideTwitchSubscriptionPromos),
        totalSuppressed: suppressedSubscriptionPromoCount,
        currentlyHidden: document.querySelectorAll('[data-dropper-sub-promo-suppressed="true"]').length,
        hiddenChat: document.querySelectorAll('[data-dropper-sub-promo-scope="chat"]').length,
        hiddenPageCtas: document.querySelectorAll('[data-dropper-sub-promo-scope="page-cta"]').length,
        hiddenHighlights: document.querySelectorAll('[data-dropper-sub-promo-scope="highlight"]').length,
        cssSuppressionActive: Boolean(document.getElementById("dropper-subscription-promo-style")),
      },
      queueEnabled: settings.queueEnabled,
      queueOnCategoryChange: settings.queueOnCategoryChange,
      standbyCache: {
        total: pruneStandbyCache().length,
        matchingActiveCampaign: cachedStandbyCandidates(
          getHandoffState()?.targetGame || currentDrop?.game || "",
          getHandoffState()?.targetCampaignKey || currentDrop?.campaignKey || "",
        ).map((item) => ({
          login: item.login,
          viewers: item.viewers || 0,
          dropsTagged: Boolean(item.dropsTagged),
          seenAt: item.seenAt ? new Date(item.seenAt).toISOString() : null,
        })),
      },
      queueCandidates: discoverQueueCandidates().map((item) => item.login),
      autoSwitchPaused: isAutoSwitchPaused(),
      progressCardCollapsed: Boolean(card?.classList.contains("collapsed")),
      collapsedPanelWidth: normalizedCollapsedPanelWidth(),
      chatWidth: chat ? Math.round(chat.getBoundingClientRect().width) : null,
      recentActivity: (Array.isArray(activityLog) ? activityLog : []).slice(-20).map((entry) => ({
        at: new Date(entry.at).toISOString(),
        type: entry.type,
        message: entry.message,
        meta: entry.meta || null,
      })),
      statusText,
    };
  }

  function layoutChrome() {
    if (!ui?.cluster) return;
    syncDropperWidthToChat();

    const row = ui.shadow.querySelector(".progress-stack") || ui.shadow.querySelector(".badge-row");
    const rowHeight = row?.offsetHeight || 56;
    const notice = ui.shadow.getElementById("tdh-update-notice");
    const menuNoticeVisible = Boolean(
      notice &&
      !notice.hidden &&
      notice.dataset.placement === "menu"
    );
    const noticeHeight = menuNoticeVisible ? notice.offsetHeight || notice.scrollHeight || 0 : 0;
    const noticeGap = menuNoticeVisible && noticeHeight ? 8 : 0;

    const menuHeight = railOpen ? ui.dock.scrollHeight || ui.dock.offsetHeight || 280 : 0;
    const gap = railOpen ? 8 : 0;
    const menuBlockHeight = menuHeight + noticeHeight + noticeGap;
    const spaceBelow = window.innerHeight - clusterTop - rowHeight - 8;
    const spaceAbove = clusterTop - 8;
    const openUp = railOpen && menuHeight > 0 && spaceBelow < menuBlockHeight + 12 && spaceAbove >= spaceBelow;

    ui.cluster.classList.toggle("open-up", openUp);
    positionMenuUpdateNotice(openUp);

    const clusterHeight =
      rowHeight +
      gap +
      (railOpen ? menuHeight : 0) +
      noticeHeight +
      noticeGap;

    let top = openUp
      ? clusterTop - menuHeight - gap - noticeHeight - noticeGap
      : clusterTop;

    top = Math.max(8, Math.min(window.innerHeight - clusterHeight - 8, top));
    ui.cluster.style.top = `${top}px`;
    ui.cluster.style.right = "12px";
  }

  function bindDrag() {
    let startY = 0;
    let startTop = 0;
    let didDrag = false;
    ui.launcher.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      startY = event.clientY;
      startTop = ui.cluster.querySelector(".badge-row").getBoundingClientRect().top;
      didDrag = false;
      ui.launcher.setPointerCapture(event.pointerId);
    });
    ui.launcher.addEventListener("pointermove", (event) => {
      if (!ui.launcher.hasPointerCapture(event.pointerId)) return;
      const delta = event.clientY - startY;
      if (Math.abs(delta) > 4) didDrag = true;
      if (!didDrag) return;
      clusterTop = startTop + delta;
      localStorage.setItem(LAUNCHER_TOP_KEY, String(clusterTop));
      layoutChrome();
    });
    ui.launcher.addEventListener("click", (event) => {
      if (!didDrag) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      didDrag = false;
    }, true);
  }

  function clearMenuDismissTimer() {
    clearTimeout(menuDismissTimer);
    menuDismissTimer = null;
    menuDismissAt = 0;
  }

  function scheduleMenuDismiss() {
    clearTimeout(menuDismissTimer);
    menuDismissTimer = null;
    if (!railOpen || !ui) {
      menuDismissAt = 0;
      return;
    }

    menuDismissAt = Date.now() + MENU_INACTIVITY_DISMISS_MS;
    menuDismissTimer = setTimeout(() => {
      enforceAutoDismissDeadlines(Date.now());
    }, MENU_INACTIVITY_DISMISS_MS + 20);
  }

  function enforceAutoDismissDeadlines(now = Date.now()) {
    if (railOpen && menuDismissAt && now >= menuDismissAt) {
      setRailOpen(false);
    }

    const card = ui?.shadow?.getElementById("tdh-drop-card");
    if (
      card &&
      !card.classList.contains("collapsed") &&
      progressCollapseAt &&
      now >= progressCollapseAt
    ) {
      setProgressCardCollapsed(true, true);
    }
  }

  function bindMenuInactivity() {
    if (!ui?.dock) return;
    const reset = () => {
      if (railOpen) scheduleMenuDismiss();
    };

    ["pointerdown", "click", "wheel", "keydown", "input", "change"].forEach((type) => {
      ui.dock.addEventListener(type, reset, { passive: type === "wheel" });
    });
  }

  function setRailOpen(open, focus) {
    railOpen = open;
    ui.dock.classList.toggle("fl-rail-open", open);
    ui.launcher.setAttribute("aria-expanded", String(open));

    if (open) {
      scheduleMenuDismiss();
    } else {
      clearMenuDismissTimer();
      const notice = ui.shadow.getElementById("tdh-update-notice");
      if (
        notice &&
        !notice.hidden &&
        notice.dataset.placement === "menu"
      ) {
        hideUpdateNotice();
      }
    }

    layoutChrome();
    requestAnimationFrame(layoutChrome);
    if (focus && open) ui.dock.querySelector("button")?.focus();
    if (focus && !open) ui.launcher.focus();
  }

  function bindPanels() {
    ui.shadow.querySelectorAll(".fl-tool-header").forEach((header) => {
      header.addEventListener("click", () => {
        const target = ui.shadow.getElementById(header.dataset.panel);
        const willOpen = target.classList.contains("fl-tool-hidden");
        ui.shadow.querySelectorAll(".fl-tool-header").forEach((other) => {
          const body = ui.shadow.getElementById(other.dataset.panel);
          const open = other === header && willOpen;
          body.classList.toggle("fl-tool-hidden", !open);
          other.querySelector(".fl-tool-chevron").textContent = open ? "▾" : "▸";
          other.querySelector(".fl-tool-chevron").setAttribute("aria-expanded", String(open));
        });
        requestAnimationFrame(layoutChrome);
      });
    });
  }

  function bindSwitches() {
    const map = {
      "tdh-claim-bonus": "claimBonus", "tdh-keep-tab": "keepTabActive", "tdh-claim-drops": "claimDrops",
      "tdh-progress-title": "progressInTitle", "tdh-find-next": "findNextStream", "tdh-mute-next": "muteRestarted",
      "tdh-background-earning": "backgroundEarning", "tdh-reduce-motion": "reduceMotion", "tdh-notifications": "notifications",
      "tdh-hide-sub-promos": "hideTwitchSubscriptionPromos",
      "tdh-queue-enabled": "queueEnabled", "tdh-queue-stall": "queueOnStall", "tdh-queue-offline": "queueOnOffline", "tdh-queue-category": "queueOnCategoryChange",
    };
    Object.entries(map).forEach(([id, key]) => {
      ui.shadow.getElementById(id)?.addEventListener("click", () => {
        settings[key] = !settings[key];
        saveSettings();
        if (key === "keepTabActive") setStatus("Reload The Page To Apply Keep Tab Active.");
        if (key === "backgroundEarning" && settings.backgroundEarning && !settings.keepTabActive) {
          settings.keepTabActive = true;
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
          renderSwitches();
          notifyUser("Keep Tab Active Enabled. Reload Twitch To Apply Background Earning.");
        }
        if (key === "reduceMotion") applyMotionSetting();
        if (key === "hideTwitchSubscriptionPromos") {
          if (settings.hideTwitchSubscriptionPromos) suppressTwitchSubscriptionPromos();
          else restoreTwitchSubscriptionPromos();
        }
        if (key.startsWith("queue")) refreshQueueList();
        syncCompactState();
      });
    });
  }

  function renderSwitches() {
    if (!ui) return;
    const map = {
      "tdh-claim-bonus": settings.claimBonus, "tdh-keep-tab": settings.keepTabActive, "tdh-claim-drops": settings.claimDrops,
      "tdh-progress-title": settings.progressInTitle, "tdh-find-next": settings.findNextStream, "tdh-mute-next": settings.muteRestarted,
      "tdh-background-earning": settings.backgroundEarning, "tdh-reduce-motion": settings.reduceMotion, "tdh-notifications": settings.notifications,
      "tdh-hide-sub-promos": settings.hideTwitchSubscriptionPromos,
      "tdh-queue-enabled": settings.queueEnabled, "tdh-queue-stall": settings.queueOnStall, "tdh-queue-offline": settings.queueOnOffline, "tdh-queue-category": settings.queueOnCategoryChange,
    };
    Object.entries(map).forEach(([id, on]) => ui.shadow.getElementById(id)?.setAttribute("aria-checked", String(Boolean(on))));
  }

  window.dropperDebug = function dropperDebug() { return dropperDebugSnapshot(); };
  window.tdhDebug = window.dropperDebug;

  window.dropperShow = function dropperShow() {
    mountUi();
    setRailOpen(true, true);
  };
  window.tdhShow = window.dropperShow;
})();