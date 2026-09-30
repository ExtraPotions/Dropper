// ==UserScript==
// @name         Dropper
// @namespace    twitch-drops-helper
// @version      3.3.34
// @description  A browser-only Twitch companion for the streams you choose to watch: track credited reward progress, manage campaigns, and collect earned rewards.
// @icon         https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-launcher.svg
// @updateURL    https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js
// @downloadURL  https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js
// @tag          Twitch
// @tag          Drops
// @tag          Rewards
// @author       ExtraPotions
// @license      PolyForm-Noncommercial-1.0.0
// @match        https://www.twitch.tv/*
// @match        https://player.twitch.tv/*
// @match        https://embed.twitch.tv/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      gql.twitch.tv
// @connect      raw.githubusercontent.com
// ==/UserScript==


// Dropper Manager Metadata
// Description: Track Twitch-credited progress, collect free earned rewards, and manage campaigns while respecting your playback and stream choices.
// Tags: Twitch, Drops, Rewards


(function twitchDropsHelper() {
  "use strict";

  // Dropper owns one top-level Twitch page. Running inside Twitch player/embed
  // frames duplicates heartbeats, update checks, DOM scans, and network work.
  if (window.top !== window.self) return;

  // BEGIN EXP CORE
// populated from pinned vendor/exp-core/exp-core.js
  // END EXP CORE

  const SETTINGS_KEY = "tdh-settings-v3";
  const ACCOUNT_SCOPE_OWNER_KEY = "dropper-account-scope-owner-v1";
  const LEGACY_LAUNCHER_TOP_KEY = "tdh-launcher-top";
  const LEGACY_LAUNCHER_GRID_DELTA_KEY = "tdh-launcher-grid-delta-v3";
  const LAUNCHER_GRID_DELTA_KEY = "exp:v3:launcher-grid-delta";
  function registerBadgeGrid(host, productId) {
    ExtraPotionsCore.registerDiagnosticsProduct(productId, APP_VERSION, host);
    ExtraPotionsCore.registerLauncher(host, { productId });
    const refreshProductChrome = () => requestAnimationFrame(() => {
      layoutChrome();
      ExtraPotionsCore.layoutFloatingNotices();
    });
    document.addEventListener("exp-core:coordination", refreshProductChrome);
    addEventListener("resize", refreshProductChrome, { passive: true });
    ExtraPotionsCore.layout();
  }
  const APP_VERSION = "3.3.34";
  ExtraPotionsCore.registerDiagnosticsProduct("dropper", APP_VERSION);
  const LAST_VERSION_KEY = "dropper-last-version-v2";
  const NOTICE_KEY_PREFIX = "exp:v3:dropper:notice:";
  const UPDATE_STATE_KEY = "dropper-update-state-v2";
  const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const UPDATE_CHECK_LEASE_MS = 30 * 1000;

  function claimNotice(changeId) {
    return ExtraPotionsCore.claimNotice("dropper", changeId);
  }

  function layoutFloatingNotices() {
    ExtraPotionsCore.layoutFloatingNotices();
  }
  const NEXT_GAME_KEY = "dropper-next-game-after-claim";
  const ROUTING_SESSION_KEY = "dropper-routing-session-v310";
  const ROUTING_SESSION_VERSION = 1;
  const ROUTING_STATES = Object.freeze({
    IDLE: "idle",
    SELECT_CAMPAIGN: "select-campaign",
    FIND_STREAM: "find-stream",
    OPEN_STREAM: "open-stream",
    VERIFY_STREAM: "verify-stream",
    EARNING: "earning",
    CLAIM: "claim",
    WAITING: "waiting",
    PAUSED: "paused",
    ERROR: "error",
  });
  const ROUTING_NAVIGATION_DEADLINE_MS = 30 * 1000;
  const ROUTING_VERIFY_DEADLINE_MS = 90 * 1000;
  const ROUTING_WAIT_RETRY_MS = 30 * 1000;
  const ROUTING_NO_CAMPAIGN_RETRY_MS = 60 * 1000;
  const ROUTING_OFFLINE_GRACE_MS = 60 * 1000;
  const ROUTING_CLAIM_FALLBACK_MS = 60 * 1000;
  const HANDOFF_STAGE_TIMEOUT_MS = 45 * 1000;
  const HEARTBEAT_INTERVAL_MS = 5000;
  const CLAIM_SCAN_MIN_INTERVAL_MS = 5000;
  const INVENTORY_CLAIM_SWEEP_LIMIT = 3;
  const BONUS_CONFIRM_SETTLE_MS = 3000;
  const STALL_RECOVERY_RECHECK_MS = 30 * 1000;
  const STARTUP_NETWORK_QUIET_MS = 12 * 1000;
  const STREAM_ROUTE_SETTLE_MS = 15 * 1000;
  const SKIP_STREAMER_ARM_MS = 3 * 1000;
  const SKIP_STREAMER_ARM_TICK_MS = 250;
  const NAVIGATION_GUARD_KEY = "dropper-auto-navigation-guard";
  const NAVIGATION_FLIGHT_KEY = "dropper-navigation-in-flight";
  const AUTO_NAVIGATION_IN_FLIGHT_MS = 20 * 1000;
  const UI_DOM_SCAN_INTERVAL_MS = 15 * 1000;
  const PROMO_STARTUP_SCAN_DELAY_MS = 8 * 1000;
  const AUTO_NAVIGATION_WINDOW_MS = 60 * 1000;
  const AUTO_NAVIGATION_LIMIT = 6;
  const AUTO_NAVIGATION_COOLDOWN_MS = 90 * 1000;
  const GQL_POLL_INTERVAL_MS = 60 * 1000;
  const GQL_RECOVERY_INTERVAL_MS = 30 * 1000;
  const GQL_MIN_GAP_MS = 15 * 1000;
  const GQL_MAX_BACKOFF_MS = 5 * 60 * 1000;
  const ACTIVITY_LOG_KEY = "dropper-activity-log";
  const RECOVERY_SNAPSHOT_KEY = "dropper-recovery-snapshot-v1";
  const RECOVERY_SNAPSHOT_VERSION = 1;
  const RECOVERY_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
  const NOTIFICATION_STATE_KEY = "dropper-notification-quiet-v1";
  const NETWORK_STATE_KEY = "dropper-network-state";
  const STANDBY_CACHE_KEY = "dropper-standby-streams";
  const CAMPAIGN_CATALOG_KEY = "dropper-campaign-catalog";
  const CAMPAIGN_PAGE_IMPORT_KEY = "dropper-campaign-page-import-v1";
  const CAMPAIGN_MEMORY_KEY = "dropper-campaign-memory-v1";
  const CAMPAIGN_MEMORY_RESET_KEY = "dropper-campaign-memory-reset-v1";
  const IGNORED_CAMPAIGN_GAMES_KEY = "dropper-ignored-campaign-games-v1";
  const CAMPAIGN_MEMORY_RESET_VERSION = "3.2.6";
  const STANDBY_REFRESH_KEY = "dropper-standby-refresh-at";
  const MUTE_PENDING_KEY = "dropper-mute-pending-v1";
  const MUTE_PENDING_MS = 45 * 1000;
  const TAB_PRESENCE_KEY = "dropper-tab-presence-v1";
  const TAB_ID_KEY = "dropper-tab-id-v1";
  const TAB_STARTED_KEY = "dropper-tab-started-v1";
  const TAB_CHANNEL_NAME = "dropper-tab-presence-v1";
  const TAB_STALE_MS = 20 * 1000;
  const TAB_PRESENCE_INTERVAL_MS = 4 * 1000;
  const STANDBY_CACHE_TTL_MS = 15 * 60 * 1000;
  const STANDBY_LIVE_FRESH_MS = 60 * 1000;
  const STANDBY_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
  const CAMPAIGN_CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const CAMPAIGN_MEMORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
  const CAMPAIGN_AUDIT_WAIT_MS = 15 * 1000;
  const PAGE_CAMPAIGN_IMPORT_MIN = 12;
  const PAGE_CAMPAIGN_IMPORT_WAIT_MS = 45 * 1000;
  const PAGE_CAMPAIGN_IMPORT_TTL_MS = 30 * 60 * 1000;
  const PAGE_CAMPAIGN_IMPORT_EMPTY_TTL_MS = 2 * 60 * 1000;
  const CAMPAIGN_PAGE_DISPLAY = Object.freeze({
    ACCORDION: "accordion",
    TEXT_BLOCK: "text-block",
    EMPTY: "empty",
    LOADING: "loading",
    TIMEOUT: "timeout",
    GQL_AUTH: "gql-auth",
    GQL_INVENTORY: "gql-inventory",
    UNKNOWN: "unknown",
  });
  const HOME_CAMPAIGN_SEARCH_WAIT_MS = 5 * 1000;
  const HOME_GAME_SEARCH_WAIT_MS = 8 * 1000;
  const FULL_SEARCH_WAIT_MS = 15 * 1000;
  const ACTIVITY_LOG_LIMIT = 40;
  const NETWORK_WINDOW_MS = 60 * 60 * 1000;
  const NETWORK_REQUEST_SOFT_BUDGET = 180;
  const NETWORK_FAILURE_THRESHOLD = 3;
  const CIRCUIT_ERROR_COOLDOWN_MS = 5 * 60 * 1000;
  const CIRCUIT_RATE_COOLDOWN_MS = 15 * 60 * 1000;
  const ACTIVE_STREAM_VERIFY_TIMEOUT_MS = 30 * 1000;
  const HANDOFF_SESSION_TTL_MS = 15 * 60 * 1000;
  const CAMPAIGN_EXPIRY_GRACE_MS = 60 * 1000;
  const CLAIM_RETRY_INTERVAL_MS = 30 * 1000;
  const CLAIM_READY_GRACE_MS = 0;
  const CAMPAIGN_WINNABLE_BUFFER_MS = 3 * 60 * 1000;
  const CAMPAIGN_SHELL_MIN_WINDOW_MS = 15 * 60 * 1000;
  const CATEGORY_MISMATCH_GRACE_MS = 15 * 1000;
  const HEALTHY_STREAM_DELAYED_MS = 5 * 60 * 1000;
  const HEALTHY_STREAM_STALLED_MS = 6 * 60 * 1000;
  const UNHEALTHY_STREAM_DELAYED_MS = 90 * 1000;
  const UNHEALTHY_STREAM_STALLED_MS = 2 * 60 * 1000;
  const FIRST_WATCH_CREDIT_GRACE_MS = 90 * 1000;
  const FOREGROUND_REVALIDATION_GRACE_MS = 30 * 1000;
  const STREAM_OFFLINE_CONFIRM_MS = 60 * 1000;
  const CATEGORY_SLUG_CACHE_KEY = "dropper-category-slugs-v3";
  const EXCLUDED_CATEGORY_SLUGS = new Set(["first-partners-collection"]);
  const EXCLUDED_CAMPAIGN_NAMES = new Set(["first partners collection"]);
  const CATEGORY_SLUG_ALIASES = Object.freeze({
    "the blood of dawnwalker": "dawnwalker",
    "delta force": "delta-force-hawk-ops",
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
  const INSTALL_URL = `https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js?v=${APP_VERSION}`;
  const RELEASES_URL = "https://github.com/ExtraPotions/Dropper/releases";
  const UPDATE_NOTICE_DURATION_MS = 30 * 1000;
  const UPDATE_RELOAD_KEY = "dropper-update-reload-pending";
  const UPDATE_RETURN_DELAY_MS = 3 * 1000;
  const UPDATE_RELOAD_FALLBACK_MS = 45 * 1000;
  const UPDATE_RELOAD_PENDING_TTL_MS = 2 * 60 * 1000;
  const MENU_INACTIVITY_DISMISS_MS = 15 * 1000;
  const RELEASE_NOTES = {
    "3.3.34": ["While the progress card is showing, menus open directly above it instead of beside the launchers, and below it when the launchers sit in the top half of the window.","Update and changelog notices stack above the open menu, or above the progress card, so nothing covers the card or a launcher.","Uses the shared exp-core notice placement, so every product places notices the same way."],
    "3.3.33": ["Opens the Dropper menu beside the launcher grid, lined up with the launcher, so it no longer opens over or behind other launchers.","Keeps every product menu clear of the Drops progress card.","Uses the shared exp-core menu placement, so Dropper menus open exactly like SHIFT, PRISMA, and WARD menus."],
    "3.3.32": ["Lets you drag the launcher to move the whole launcher group up or down the right edge; Shift+drag or Alt+Arrow keys reorder launchers.","Keeps launcher dragging working on Twitch, where the video player used to swallow the mouse movement.","Stacks all launchers in the right-hand column while the progress card is showing, so no launcher sits underneath it.","Uses the shared exp-core launcher code, so Dropper drags, positions, and resets its launcher exactly like SHIFT, PRISMA, and WARD."],
    "3.3.31": ["Updates the shared foundation to exp-core 3.4.5.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.30": ["Adds a planner line to Open Campaigns: watch time left across open campaigns, the first deadline, and how many may not finish in time.","Shows subscription rewards in each game row, for information only. Dropper never subscribes.","Adds unclaimed rewards to Claim History, with a badge and a claim soon flag.","Shortens the Drops menu by folding the eligibility checklist into its row and moving two page settings to Appearance."],
    "3.3.29": ["Updates the shared foundation to exp-core 3.4.4.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.28": ["Updates the shared foundation to exp-core 3.4.3.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.27": ["Adds a Check for Updates button in Maintenance that works on demand.","Checks GitHub release information only when you press it and never installs anything.","Reports whether an update is available, Dropper is current, or the check failed.","Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged."],
    "3.3.26": ["Shows Resume Playback once when playback is paused, instead of a second copy beside Stay On This Stream.","Keeps the other recovery actions, such as Recheck Twitch and Find Another Stream, in the same place.","Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.","Adds no new settings."],
    "3.3.25": ["Fixes the Claim History and Open Campaigns headings collapsing into a column of single letters when the status text is long.","Keeps the campaign status text on one line and shortens it when there is no room.","Simplifies the menu to a single width that follows the Dropper theme.","Removes the Menu width, Menu theme, Menu notifications, and menu arrangement controls."],
    "3.3.24": ["Updates the shared foundation to exp-core 3.4.2.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.23": ["Updates the shared foundation to exp-core 3.4.1.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.22": ["Adds account-link warnings, campaign deadline/time-remaining status, local claim history, and explainable stream-switch/recovery history.","Adds ranked campaign priorities plus priority, deadline, closest-to-completion, and shortest-remaining strategy modes.","Adds opt-in claimed, ending-campaign, stalled-progress, and stream-switch browser alerts, while keeping automatic Picture-in-Picture explicitly opt-in.","Adds bounded restart recovery, deterministic multi-tab routing ownership, and stricter fail-closed Twitch GQL handling while keeping Twitch-credited progress authoritative."],
    "3.3.21": ["Updates the shared foundation to exp-core 3.4.0.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.20": ["Updates the shared foundation to exp-core 3.3.17.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.19": ["Updates the shared foundation to exp-core 3.3.16.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.18": ["Updates the shared foundation to exp-core 3.3.15.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.17": ["Updates the shared foundation to exp-core 3.3.14.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.16": ["Updates the shared foundation to exp-core 3.3.13.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],
    "3.3.15": ["Adds the themed outer menu border shared across the ExtraPotions suite.","Keeps border colors tied to the active menu palette without changing Twitch routing behavior.","Includes the 3.3.12 through 3.3.14 fallback eligibility and allow-list diagnostic fixes."],
    "3.3.14": ["Refreshes candidate allow-list diagnostics when Twitch campaign metadata arrives after stream selection.","Keeps historical selection proof separate from the current campaign allow-list snapshot.","Updates allow-list evidence during verification and earning without changing routing decisions."],
    "3.3.13": ["Reports Drops-tagged fallback streams as Verification Pending while Twitch proof is still being checked.","Allows a non-allow-listed fallback stream to become Eligible after target-campaign GQL evidence or credited progress confirms it.","Keeps eligibility diagnostics aligned with the routing controller's verification state."],
    "3.3.12": ["Lets Drops-tagged same-game streams enter campaign verification when no campaign allow-list channel is live.","Keeps campaign allow-list matches highest priority and still requires GQL campaign evidence or credited progress before earning.","Binds successful fallback verification to the verified channel and keeps standby diagnostics aligned with routing."],
    "3.3.11": ["Lets every launcher move left, right, up, or down within the shared grid.","Persists the complete launcher order across reloads.","Adds Alt+Arrow keyboard reordering for the focused launcher."],
    "3.3.10": ["Adds raised and inset menu surfaces so controls and cards no longer blend into one flat layer.","Uses accessible link, focus, and accent-text colors while keeping every existing Dropper palette intact.","Preserves existing saved palette choices and established base colors.","Adds computed theme-role regression coverage across the live menu."],
    "3.3.9": ["Compacts System menus and keeps menu width controls together on one row.","Groups existing menu preferences consistently while preserving saved settings.","Removes automatic Settings Backup and its restore controls.","Adds a Bitcoin donation option with address copying and wallet support."],
    "3.3.8": ["Balances the four System cards with equal collapsed heights and matching padding.","Preserves two columns in Full and Compact modes and one in Narrow mode.","Lets expanded cards grow naturally while remaining inside the menu.","Checks equal card heights and expanded content at all three menu widths."],
    "3.3.7": ["Restores a full-width two-column grid for System support and recovery cards.","Keeps compatibility, backups, waiting explanations, and playback history aligned in Full and Compact modes.","Uses one column in Narrow mode and keeps expanded cards inside the menu.","Adds browser coverage for collapsed and expanded cards at each menu width."],
    "3.3.6": ["Adds left-side section handles and visibility controls under System.","Keeps long menu content within the available viewport while preserving current player and progress behavior.","Refreshes the README and feature screenshots in a horizontal gallery.","Clarifies installation and the separate code and artwork licenses."],
    "3.3.5": ["Restores an initial Twitch mini-player through its native expansion control, with a manual restore action and viewer-control safeguards.","Preserves saved settings and adds local backups, rollback, and product compatibility details.","Explains waiting states using Twitch credit and playback evidence, and shows playback/navigation history.","Adds player presentation diagnostics and regression coverage."],
    "3.3.4": ["Rechecks the saved mute preference before every mute attempt and cancels disabled requests.","Preserves player volume when muting streams.","Closes other ExtraPotions menus when opening Dropper and respects peer menus.","Adds regression coverage for mute preferences and menu coordination."],
    "3.3.3": [
      "Recognizes confirmed progress on manually selected streams while automatic routing is disabled.",
      "Keeps the initial verification deadline fixed across routine progress polls."
    ],
    "3.3.2": [
      "Makes Badge Only progress match the menu section cards by using the dock content width instead of the outer dock width.",
      "Removes the 3.3.1 padding bleed so Full, Compact, and Narrow align with Drops, Streams, Appearance, and System."
    ],
    "3.3.1": [
      "Makes Badge Only progress use the exact same Full, Compact, and Narrow width calculation as the normal progress panel and menu.",
      "Compensates for the menu side padding so Badge Only no longer renders 18 px narrower than the selected panel width."
    ],
    "3.3.0": [
      "Hardens automatic claim controls with centralized Twitch selectors and fail-closed safety checks.",
      "Separates campaign-level stream verification from exact reward identity so another Drop cannot advance the locked reward.",
      "Adds focus-aware stall recovery, bounded retries, stale-state cleanup, and expanded release-gate regression coverage."
    ],

    "3.2.31": [
      "Improves diagnostics with separate progress-card, launcher, launcher-row, menu, and notice geometry.",
      "Forces each newly installed Dropper version to perform its own fresh update check and attributes resource errors to Dropper or the page."
    ],
    "3.2.30": [
      "Unifies Update Available, Update Complete, notices, and Changelog into one Dropper menu-width card space.",
      "Keeps every Dropper notice constrained to the active Full, Compact, or Narrow width whether the menu is open or closed."
    ],
    "3.2.29": [
      "Places the Badge Only progress card above the Drops menu section instead of inside the Drops body.",
      "Keeps the Badge Only progress card matched to the active Full, Compact, or Narrow menu width."
    ],
    "3.2.28": [
      "Returns the live progress panel to the same launcher row, directly left of the Dropper launcher.",
      "Removes independent viewport positioning from the page progress card so the panel and launcher move as one unit."
    ],
    "3.2.27": [
      "Reanchors the launcher, progress panel, menu, and changelog to one measured launcher-grid geometry.",
      "Prevents opening the menu or changelog from shifting Dropper surfaces apart across the page."
    ],
    "3.2.26": [
      "Keeps the Current Version changelog card aligned to the Dropper menu instead of stretching across the page.",
      "Matches the changelog card width to the active Dropper menu width and positions it directly above the menu with a viewport-safe fallback."
    ],
    "3.2.25": [
      "Restores full theme colors, borders, and background contrast to Update and Changelog notices.",
      "Keeps floating notices inside Dropper's themed container while preserving viewport-safe positioning."
    ],
    "3.2.24": [
      "Keeps Update and Changelog notices fixed inside the visible browser window.",
      "Preserves launcher-grid anchoring and notice stacking at either grid edge."
    ],
    "3.2.23": [
      "Places the Badge Only progress card inside the Drops menu instead of above the menu.",
      "Keeps the progress card at the top of the expanded Drops controls."
    ],
    "3.2.22": [
      "Treats Dropper as an integrated ExtraPotions product in shared coordination and release provenance.",
      "Moves the live progress card above Drops inside the menu when Badge Only is enabled.",
      "Keeps only the Dropper badge visible on the page while Badge Only is active."
    ],
    "3.2.21": [
      "Shows each automatic update notice once for that version instead of on every page load.",
      "Stacks simultaneous notices beside the complete launcher grid.",
      "Moves diagnostics and recovery actions under the final System menu."
    ],
    "3.2.20": [
      "Keeps Dropper's transparent launcher row from intercepting neighboring product launchers.",
      "Preserves pointer input for the Dropper launcher and progress panel.",
      "Verifies every installed launcher remains clickable at both grid anchors."
    ],
    "3.2.19": [
      "Uses the borderless Dropper launcher artwork for the userscript-manager icon.",
      "References the shared SVG by URL instead of embedding image bytes in the userscript.",
      "Removes the superseded bordered SVG and raster badge files.",
      "Blocks future builds if embedded image data returns."
    ],
    "3.2.18": [
      "Uses compact rounded rectangles for status, progress, version, and skip controls.",
      "Keeps diagnostics and multi-product conflict reporting aligned across the active suite."
    ],
    "3.2.17": [
      "Keeps the progress panel outside the complete three-column launcher grid and flips it below a top anchor or above a bottom anchor.",
      "Preserves peer launcher alignment and inward-opening menus while the progress panel or Dropper menu changes state.",
      "Standardizes Page, Technical, Console, and Plugin diagnostics with bounded redaction and current-page product conflict observations.",
      "Embeds the canonical Dropper badge in userscript-manager metadata and replaces the bordered README image with borderless SVG artwork.",
    ],
    "3.2.16": [
      "Adds an automatically refreshed Open Campaigns checklist grouped by game.",
      "Keeps ignored games excluded from routing until their latest open campaign ends.",
      "Preserves account-scoped ignore choices across campaign refreshes and Twitch tabs.",
    ],
    "3.2.15": [
      "Moves the Dropper progress ring to the outside edge of its 40 px badge artwork.",
      "Keeps the live campaign-progress ring exclusive to Dropper.",
      "Removes decorative progress rings from sibling ExtraPotions launchers.",
      "Uses the canonical Dropper SVG as the userscript-manager icon.",
    ],
    "3.2.14": [
      "Uses 48 px launcher buttons with 40 px artwork and an 8 px launcher gap.",
      "Expands the menu-header badge artwork to the full 38 px contract.",
      "Adds a dedicated 128 px raster badge derivative.",
      "Keeps the original badge and launcher SVG files byte-for-byte unchanged.",
    ],
    "3.2.13": [
      "Packs sibling launchers into a compact right rail beside the visible progress panel.",
      "Restores the normal launcher row when Badge Only hides the progress panel.",
      "Aligns Dropper's embedded grid coordinator with the shared build-time Core.",
    ],
    "3.2.12": [
      "Updates the Pride theme browser contract to expect the approved new rainbow color.",
      "Keeps the 3.2.11 palette behavior unchanged while restoring release validation.",
    ],
    "3.2.11": [
      "Replaces the legacy menu palettes with the locked Ember, Midnight, Glacier, High Contrast, Verdant, Pride, Twitch, and Dropper Gem system.",
      "Keeps Twitch exclusive to Dropper and publishes the richer six-role palette contract for sibling products.",
      "Migrates saved Warm, Graphite, and Pine selections to Ember, Glacier, and Verdant.",
    ],
    "3.2.10": [
      "Makes the Warm charcoal depth visible beneath its gradient-border treatment in Dropper and shared menus.",
      "Keeps the amber highlight subtle and leaves other palettes unchanged.",
    ],
    "3.2.9": [
      "Gives Warm charcoal a layered dark menu surface, subtle amber edge-lighting, and quieter matte controls.",
      "Keeps accent color on the gem, active controls, and focus while preserving readable text and semantic states.",
    ],
    "3.2.8": [
      "Rebalances the chip footer specifically for Compact and Narrow widths instead of shrinking the full-width treatment.",
      "Compact shows a shorter last-checked age while keeping the labeled Skip chip; Narrow uses abbreviated status text and an icon-only Skip chip until confirmation is armed.",
      "Preserves full status and timestamp context in accessible labels and tooltips while preventing footer crowding.",
    ],
    "3.2.7": [
      "Reworks the progress-panel footer into a unified status and last-checked chip, with semantic state dots and a quieter segmented divider.",
      "Restyles Skip as a compact action chip with a fast-forward icon, restrained theme accent, and the existing arm-then-confirm safety behavior.",
      "Tightens Compact and Narrow footer sizing so status context and Skip stay aligned without competing with Drop progress.",
    ],
    "3.2.5": [
      "Performs a one-time per-account reset of persistent campaign memory so stale and duplicate historical campaign identities are discarded.",
      "Rebuilds campaign memory only from fresh campaign data while preserving the active Drop, settings, routing preferences, and other account-scoped state.",
      "Adds campaign-memory reset version and timestamp to diagnostics so the migration can be verified.",
    ],
    "3.2.4": [
      "Restyles toggle switches with matte theme surfaces, softer knobs, and restrained accent ON states instead of metallic gray and full-gradient tracks.",
      "Keeps High Contrast and forced-colors switch behavior explicit and unchanged for accessibility.",
    ],
    "3.2.3": [
      "Adds a subtle fine-grain texture and restrained inset depth to the progress card so the solid surface feels less flat.",
      "Keeps the 3.2 panel structure and solid theme surface intact without restoring the old fade behavior.",
    ],
    "3.2.2": [
      "Polishes the 3.2 progress panel with a steadier bottom row, fixed Skip button footprint, quieter status styling, and a more neutral panel border.",
      "Renames Progress & Appearance to Appearance and keeps armed Skip confirmation compact with a Confirm label plus countdown.",
    ],
    "3.2.1": [
      "Restores a real CSS border around the menu header icon while keeping the shared split-gem SVG itself border-free.",
      "Makes the menu icon frame follow the active theme instead of relying on artwork that only looked like a border.",
    ],
    "3.2.0": [
      "Redesigns the progress panel as a calmer solid utility card with streamer, category, progress, reward, and status information in one clear hierarchy.",
      "Removes the streamer avatar, reward thumbnail, stream-title/viewer/uptime clutter, panel fade behavior, and obsolete campaign-navigation collapse behavior.",
      "Uses theme color only for restrained progress, percentage, status, and control accents instead of a gradient/faded panel treatment.",
    ],
    "3.1.57": [
      "Removes the Previous, Current, and Next campaign strip from above the progress panel.",
      "Fixes Theme row overflow in Compact and Narrow widths by giving the swatches the full row while preserving the accessible Menu Theme label.",
    ],
    "3.1.56": [
      "Compacts Progress & Appearance so it stays within the normal menu height instead of being the only section to trigger a scrollbar.",
      "Tightens only that panel's control spacing, theme swatches, separator, and opacity row without changing the global menu layout.",
    ],
    "3.1.55": [
      "Uses the same split-gem icon artwork for both the launcher and the menu header.",
      "Removes the menu-only framed badge treatment so Dropper has one consistent icon identity.",
    ],
    "3.1.54": [
      "Refines the launcher with a softer frame, tighter themed progress ring, quieter update badge, and clearer open state.",
      "Adds a restrained hover treatment and subtle drag feedback while preserving the launcher's 48px footprint and behavior.",
    ],
    "3.1.53": [
      "Removes the launcher hover/focus helper tooltip so the Dropper badge stays visually clean.",
      "Keeps the launcher accessibility label and update-available indicator unchanged.",
    ],
    "3.1.52": [
      "Renames Notifications to Status Toasts so the setting clearly describes Dropper's brief in-app messages.",
      "Moves Status Toasts from Progress & Appearance into Streams, where stream and campaign status feedback is managed.",
    ],
    "3.1.51": [
      "Collapses the Active + Standby stream list by default so the Streams menu stays compact.",
      "Replaces the always-open block with a one-line ready-stream summary that expands on demand.",
    ],
    "3.1.50": [
      "Visually splits the Streams menu into Current Stream and Routing & Backup groups without adding another top-level menu.",
      "Makes routing-specific controls, skip conditions, standby list, and skipped-stream cleanup read as one full-width automation block.",
    ],
    "3.1.49": [
      "Merges Progress, Theme, and Layout controls into one Progress & Appearance menu to reduce top-level menu clutter.",
      "Keeps progress controls visually grouped above theme, width, opacity, and notification settings inside the combined panel.",
    ],
    "3.1.48": [
      "Simplifies the Drops panel by removing the permanent Twitch account/import card and leaving Drops Inventory as the primary full-width action.",
      "Only shows a compact Twitch Login Required row when authentication is missing, and moves manual campaign recovery to Diagnostics as Refresh Campaign Data.",
    ],
    "3.1.47": [
      "Changes Skip Streamer to a two-step arm-and-confirm interaction so a single accidental click cannot rotate away from a working stream.",
      "The armed skip state shows the streamer name and a 3-second countdown, then cancels automatically on timeout, stream or route changes, panel collapse, menu close, or session reset.",
    ],
    "3.1.46": [
      "Restores the soft fade at both ends of the header divider for gradient themes while preserving each theme's color treatment.",
      "Keeps the flat Twitch palette on its original faded divider behavior.",
    ],
    "3.1.45": [
      "Restores the original flat Gem look as a dedicated Twitch palette using the classic Twitch purple and dark surfaces.",
      "Keeps the newer Dropper Gem gradient theme available separately so users can choose between the original flat Twitch look and the richer Gem skin.",
    ],
    "3.1.44": [
      "Finishes the unified theme-skin rollout by removing the final Pride-only current-campaign accent rule.",
      "All themes now share the same visual treatment model; only their palette and gradient stops differ.",
    ],
    "3.1.43": [
      "Upgrades every Dropper theme to use the richer gradient-skin treatment previously reserved for Pride.",
      "Adds theme-specific gradient borders, header accents, progress fills, active controls, focus states, and update/changelog styling while keeping High Contrast monochrome.",
    ],
    "3.1.42": [
      "Makes update notifications and the current-version changelog inherit the selected Dropper theme instead of using a fixed purple palette.",
      "Adds themed update buttons, borders, text, version badges, and a Pride gradient treatment while preserving custom opacity.",
    ],
    "3.1.41": [
      "Adds optional user-controlled Dropper panel opacity in Theme & Layout with a persistent 40–100% slider.",
      "Keeps the Dropper launcher fully opaque so settings remain accessible even when panels are made translucent.",
    ],
    "3.1.40": [
      "Keeps the Panel + Menu Width control inside the Theme & Layout panel by stacking the label and selector in Narrow mode.",
      "Improves toggle visibility with a defined track border and gives the High Contrast theme distinct on/off track and knob colors.",
    ],
    "3.1.39": [
      "Prevents routine current-session GQL confirmations from rewriting the stream verification timestamp while earning.",
      "Restores verification time from the original earning-state anchor after navigation or reload so stall timing cannot be kept artificially fresh.",
    ],
    "3.1.38": [
      "Makes candidate ACL diagnostics derive from the active campaign instead of stale category-page snapshots and filters cached diagnostic candidates against that ACL.",
      "Builds one queue snapshot per diagnostics report so queue names and queue details cannot disagree when Any Eligible randomization is enabled.",
      "Anchors first-watch verification grace to the stream routing state instead of routine session refreshes and separates DOM playback, recent credited progress, and verified earning signals.",
    ],
    "3.1.37": [
      "Fixes Theme & Layout alignment in Full panel width so the width label no longer collapses into a vertical stack.",
      "Keeps the width selector and Notifications on clean full-width rows without changing the two-column layout used by other menu sections.",
    ],
    "3.1.36": [
      "Makes campaign channel allow-lists authoritative before navigation, verification, standby selection, and queueing.",
      "Stops probing Drops-tagged channels that are not allowed by the active campaign and rejects stale non-ACL verification sessions immediately.",
      "Clarifies loaded versus verified earning-stream diagnostics and removes the obsolete expanded progress width diagnostic.",
    ],
    "3.1.35": [
      "Makes verified campaign start/end dates the authoritative eligibility gate for routing, stream proof, progress merging, and standby candidates.",
      "Keeps unknown-date and closed campaigns in catalog memory for diagnostics while preventing them from becoming active routing targets.",
      "Purges expired campaign inventory and standby state before it can leak back into selection or verification.",
    ],
    "3.1.34": [
      "Prevents session progress from a different campaign or Drop in the same game from advancing the locked active Drop.",
      "Requires campaign-key or Drop-ID identity before session data can merge with active Inventory progress.",
      "Reports rejected cross-campaign session minutes in progress diagnostics without using them as verification proof.",
    ],
    "3.1.33": [
      "Unifies router and standby candidate filtering so skipped or non-routable streams cannot reappear as usable queue candidates.",
      "Separates currently visible stream candidates from cached observations and labels cache freshness explicitly.",
      "Rescans category candidates immediately while waiting and adds per-channel routability reasons to diagnostics.",
    ],
  };
  const DEFAULTS = {
    claimBonus: true,
    keepTabActive: true,
    claimDrops: true,
    progressInTitle: true,
    findNextStream: false,
    muteRestarted: true,
    backgroundEarning: false,
    autoPictureInPicture: false,
    resumeSessionOnRestart: true,
    restoreChannelPlayer: true,
    reduceMotion: false,
    collapsedPanelWidth: "compact",
    uiTheme: "dropper",
    customOpacity: false,
    opacityPercent: 85,
    badgeOnly: false,
    notifications: true,
    notifyClaimed: false,
    notifyCampaignEnding: false,
    notifyStalledProgress: false,
    notifyStreamSwitches: false,
    notifyOnlyWhenHidden: true,
    notificationCooldownMinutes: 5,
    hideTwitchSubscriptionPromos: true,
    pauseAutoSwitchMinutes: 0,
    pauseAutoSwitchUntil: 0,
    queueEnabled: true,
    queueCount: 3,
    queueOnStall: true,
    queueOnOffline: true,
    queueOnCategoryChange: true,
    queuePreference: "Any Eligible",
    campaignStrategy: "priority",
  };
  const { PRIDE_RAINBOW, UI_THEMES } = ExtraPotionsCore.reference;
  const themeRgb = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const blendThemeColor = (from, to, amount) => `#${themeRgb(from).map((part, index) => Math.round(part + (themeRgb(to)[index] - part) * amount).toString(16).padStart(2, "0")).join("")}`;
  const themeLuminance = (value) => {
    const channels = themeRgb(value).map((part) => { const channel = part / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const themeContrast = (one, two) => { const [light, dark] = [themeLuminance(one), themeLuminance(two)].sort((a, b) => b - a); return (light + 0.05) / (dark + 0.05); };
  function readableThemeColor(candidate, background, fallback) {
    if (themeContrast(candidate, background) >= 4.5) return candidate;
    for (let amount = 0.15; amount <= 1; amount += 0.05) {
      const lighter = blendThemeColor(candidate, "#ffffff", amount);
      if (themeContrast(lighter, background) >= 4.5) return lighter;
      const darker = blendThemeColor(candidate, "#000000", amount);
      if (themeContrast(darker, background) >= 4.5) return darker;
    }
    return fallback;
  }
  function semanticTheme(theme) {
    const onAccent = [theme.text, theme.bg, "#ffffff", "#000000"].sort((a, b) => themeContrast(b, theme.accent) - themeContrast(a, theme.accent))[0];
    return {
      raised: blendThemeColor(theme.panel, theme.text, 0.08),
      inset: blendThemeColor(theme.bg, "#000000", 0.18),
      link: readableThemeColor(theme.accent2, theme.panel, theme.text),
      focus: theme.accent2,
      onAccent,
    };
  }
  // Central registry for claim-related Twitch DOM assumptions. Keep selectors
  // here so Twitch UI changes have one fail-closed repair surface.
  const TWITCH_DOM_SELECTORS = Object.freeze({
    bonusClaim: 'button[aria-label="Claim Bonus"], .claimable-bonus__icon',
    bonusContainer: '.community-points-summary,[data-test-selector="community-points-summary"],[data-a-target="community-points-summary"]',
    dropClaim: [
      '[data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"]',
      'button[data-a-target="drops-claim-button"]',
    ].join(","),
    inventoryCard: '.inventory-max-width > div:not(:first-child)',
    rewardPresentation: '[role="progressbar"],[data-test-selector*="RewardPresentation"]',
    progressBar: '[role="progressbar"]',
    dropsCampaignCard: '[data-test-selector*="DropsCampaign"]',
    dropsCampaignClassCard: '[class*="drops-campaign"]',
  });
  const BONUS_SELECTOR = TWITCH_DOM_SELECTORS.bonusClaim;
  const DROP_CLAIM_SELECTOR = TWITCH_DOM_SELECTORS.dropClaim;
  const INVENTORY_URL = "https://www.twitch.tv/drops/inventory";
  const CAMPAIGNS_URL = "https://www.twitch.tv/drops/campaigns";
  const TWITCH_HOME_URL = "https://www.twitch.tv/";
  const TWITCH_LOGIN_URL = "https://www.twitch.tv/login";
  const TWITCH_CONNECTIONS_URL = "https://www.twitch.tv/settings/connections";

  const GQL_URL = "https://gql.twitch.tv/gql";
  const INTEGRITY_URL = "https://gql.twitch.tv/integrity";
  const CLIENT_INTEGRITY_KEY = "dropper-client-integrity-v1";
  const CLIENT_IDS = ["kimne78kx3ncx6brgo4mv6wki5h1ko", "kd1unb4b3q4t58fwlpcbzcbnm76a8fp"];
  const GQL_OPS = {
    inventory: {
      name: "Inventory",
      hash: "fbdc9d9857fa39ff458d3f6116b157a9481fd140266879a2508a662f5c8af6f8",
      variables: { fetchRewardCampaigns: true },
    },
    viewerDropsDashboard: {
      name: "ViewerDropsDashboard",
      hash: "69750554e0a81492f2d343558f84bdf3e324767650a2dbb6e79a3c629b4548cf",
      variables: { fetchRewardCampaigns: true },
    },
    currentDrop: {
      name: "DropCurrentSessionContext",
      hash: "4d06b702d25d652afb9ef835d2a550031f1cf762b193523a92166f40ea3d142b",
      variables: {},
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
      hash: "3b8a08f5a35dc95d7de229dea731a106a9aa9fa2e84c8f693fd159943f273e4f",
      variables: { input: { dropInstanceID: "" } },
    },
    dropCampaignDetails: {
      name: "DropCampaignDetails",
      hash: "039277bf98f3130929262cc7c6efd9c141ca3749cb6dca442fc8ead9a53f77c1",
      variables: { channelLogin: "", dropID: "" },
    },
  };
  const RESERVED = new Set([
    "directory", "downloads", "drops", "friends", "inventory", "jobs", "messages",
    "moderator", "p", "popout", "prime", "privacy", "products", "search", "settings",
    "store", "subs", "subscriptions", "turbo", "user", "videos", "wallet",
  ]);

  // BEGIN DROPPER ACTIVE VIEWING
  // Original implementation of the approved Dropper feature specification.
  // No twitch-autoclaim or TwitchDropsMiner implementation is included here.
  const DropperActiveViewing = (() => {
    const text = value => String(value ?? '').trim();
    const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    const terminal = new Set(['confirmed', 'already-claimed', 'blocked', 'unconfirmed', 'discarded']);
    const outcomes = new Set(['pending', 'retryable', ...terminal]);
    const evidenceKinds = new Set(['request', 'page-control', 'control-dismissed', 'claim-result', 'inventory', 'timeout', 'network', 'permission', 'integrity', 'unknown', 'context-change']);
    const claimKinds = new Set(['drop', 'bonus']);

    function createIntent({ now = Date.now, load = () => null, save = () => {} } = {}) {
      let state = null;
      let generation = 0;
      function persist() { try { save({ ...state }); } catch (_) {} }
      function context(account, channel, automaticArrival = false) {
        account = text(account).toLowerCase(); channel = text(channel).toLowerCase();
        if (state && state.account === account && state.channel === channel) return false;
        const sameAccount = state?.account === account;
        const previous = sameAccount ? state : null;
        let restored = null;
        try { restored = load(account); } catch (_) {}
        const saved = restored?.account === account && restored.channel === channel ? restored : null;
        state = {
          account, channel, paused: Boolean(saved?.paused),
          pauseReason: saved?.paused ? (saved.pauseReason === 'viewer' ? 'viewer' : 'unknown') : '',
          manualStream: Boolean(channel && !automaticArrival && saved?.manualStream !== false),
          playback: 'unknown', changedAt: now(),
          generation: ++generation,
          recoveryAttempts: previous?.channel === channel ? previous.recoveryAttempts || 0 : 0,
          lastRecoveryAt: 0,
        };
        persist();
        return true;
      }
      function pause(knownViewer = false) {
        if (!state?.channel) return;
        state.paused = true;
        if (knownViewer || state.pauseReason !== 'viewer') state.pauseReason = knownViewer ? 'viewer' : 'unknown';
        state.playback = 'paused'; state.changedAt = now(); persist();
      }
      function resume({ explicit = false, remounted = false } = {}) {
        if (!state) return false;
        if (state.paused && (remounted || state.pauseReason === 'viewer') && !explicit) return false;
        state.paused = false; state.pauseReason = ''; state.playback = 'playing';
        state.recoveryAttempts = 0; state.lastRecoveryAt = 0; state.changedAt = now(); persist();
        return true;
      }
      function observe(playback) {
        if (!state) return;
        const next = ['playing', 'paused', 'buffering', 'ended', 'error', 'unknown'].includes(playback) ? playback : 'unknown';
        if (next !== state.playback) { state.playback = next; state.changedAt = now(); }
      }
      function allowSwitching() {
        if (!state) return;
        state.manualStream = false; state.changedAt = now(); persist();
      }
      function navigationAllowed(explicit = false) {
        return Boolean(state && (explicit || (!state.paused && !state.manualStream)));
      }
      function takeRecovery(explicit = false) {
        if (!state?.channel) return false;
        if (!explicit && (state.paused || state.manualStream || state.playback === 'unknown')) return false;
        if (!explicit && (state.recoveryAttempts >= 3 || (state.lastRecoveryAt && now() - state.lastRecoveryAt < 30000))) return false;
        if (explicit) { state.paused = false; state.pauseReason = ''; }
        state.recoveryAttempts += 1; state.lastRecoveryAt = now(); persist();
        return true;
      }
      function snapshot() { return state ? { ...state } : { playback: 'unknown', paused: false, manualStream: false, generation }; }
      return Object.freeze({ context, pause, resume, observe, allowSwitching, navigationAllowed, takeRecovery, snapshot });
    }

    // A synchronous, per-record store is used under the caller's reward lock.
    // No asynchronous read/modify/write of a shared history array is performed.
    function createClaims({ now = Date.now, read = () => [], put = () => {}, id = () => Math.random().toString(36).slice(2), limit = 100 } = {}) {
      let records = new Map();
      function refresh() {
        try {
          for (const raw of read() || []) {
            if (!raw || !outcomes.has(raw.outcome) || !claimKinds.has(raw.kind) || !text(raw.key)) continue;
            if (text(raw.key).length > 512 || text(raw.rewardId).length > 180 || text(raw.campaignId).length > 180 || text(raw.rewardName).length > 160 || text(raw.game).length > 120) continue;
            if (/https?:|[\r\n<>]/i.test(raw.key + (raw.rewardId || '') + (raw.campaignId || '') + (raw.rewardName || '') + (raw.game || ''))) continue;
            const record = {
              key: text(raw.key), kind: raw.kind, rewardId: text(raw.rewardId), campaignId: text(raw.campaignId),
              rewardName: text(raw.rewardName).slice(0, 160), game: text(raw.game).slice(0, 120),
              attemptId: text(raw.attemptId).slice(0, 100), at: Number(raw.at) || 0,
              updatedAt: Number(raw.updatedAt) || 0, attempts: Math.max(1, Math.min(3, Number(raw.attempts) || 1)),
              outcome: raw.outcome, evidence: evidenceKinds.has(raw.evidence) ? raw.evidence : 'unknown',
              nextAttemptAt: Math.max(0, Number(raw.nextAttemptAt) || 0),
            };
            const existing = records.get(record.key);
            if (!existing || Number(record.updatedAt || 0) >= Number(existing.updatedAt || 0)) records.set(record.key, record);
          }
        } catch (_) {}
        const sorted = [...records.values()].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
        records = new Map(sorted.slice(0, limit).map(record => [record.key, record]));
      }
      function persist(record) {
        record.updatedAt = now(); records.set(record.key, record);
        try { put({ ...record }); } catch (_) {}
        return { ...record };
      }
      function expire() {
        refresh();
        for (const record of records.values()) {
          if (record.outcome === 'pending' && now() - record.at >= 45000) {
            persist({ ...record, outcome: 'unconfirmed', evidence: 'timeout' });
          }
        }
      }
      function begin({ key, rewardId = '', campaignId = '', rewardName = '', game = '', kind = 'drop', evidence = 'request' }) {
        expire();
        if (!claimKinds.has(kind) || !text(key) || key.length > 512 || /https?:|[\r\n<>]/i.test(key + rewardId + campaignId + rewardName + game)) return null;
        const prior = records.get(key);
        if (prior && (prior.outcome !== 'retryable' || prior.attempts >= 3 || now() < prior.nextAttemptAt)) return null;
        return persist({
          key, rewardId: text(rewardId).slice(0, 180), campaignId: text(campaignId).slice(0, 180),
          rewardName: text(rewardName).slice(0, 160), game: text(game).slice(0, 120), kind,
          attemptId: text(id()), at: now(), updatedAt: now(),
          attempts: (prior?.attempts || 0) + 1, outcome: 'pending', evidence: evidenceKinds.has(evidence) ? evidence : 'request', nextAttemptAt: 0,
        });
      }
      function settle(key, attemptId, outcome, evidence = 'unknown') {
        refresh();
        const record = records.get(key);
        if (!record || record.attemptId !== attemptId || !outcomes.has(outcome) || outcome === 'pending') return null;
        if (record.outcome === 'confirmed' || record.outcome === 'already-claimed' || record.outcome === 'discarded') return null;
        // Authoritative inventory may resolve an earlier timeout. Other late
        // responses must not reopen blocked/unknown records or repeat a count.
        if (record.outcome !== 'pending' && !(outcome === 'confirmed' && evidence === 'inventory')) return null;
        return persist({ ...record, outcome,
          evidence: evidenceKinds.has(evidence) ? evidence : 'unknown',
          nextAttemptAt: outcome === 'retryable' && record.attempts < 3 ? now() + 30000 * record.attempts : 0,
        });
      }
      function snapshot() { expire(); return [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(record => ({ ...record })); }
      return Object.freeze({ begin, settle, snapshot });
    }

    function claimResponse(row) {
      if (Array.isArray(row?.errors) && row.errors.length) return { outcome: 'unconfirmed', evidence: 'unknown' };
      const status = row?.data?.claimDropRewards?.status;
      if (status === 'ELIGIBLE_FOR_ALL') return { outcome: 'confirmed', evidence: 'claim-result' };
      if (status === 'DROP_INSTANCE_ALREADY_CLAIMED') return { outcome: 'already-claimed', evidence: 'claim-result' };
      return { outcome: 'unconfirmed', evidence: 'unknown' };
    }
    function claimFailure(error) {
      const message = text(error?.message || error);
      if (/integrity/i.test(message)) return { outcome: 'blocked', evidence: 'integrity' };
      if (/\b(?:401|403)\b|unauthorized|forbidden|permission/i.test(message)) return { outcome: 'blocked', evidence: 'permission' };
      if (/\b(?:429|500|502|503|504)\b|network error|failed to fetch|timed?\s*out/i.test(message)) return { outcome: 'retryable', evidence: 'network' };
      return { outcome: 'unconfirmed', evidence: 'unknown' };
    }

    function requirement(drop) {
      if (drop?.self?.isClaimed === true) return 0;
      const total = number(drop?.requiredMinutesWatched ?? drop?.requiredMinutes);
      const current = number(drop?.self?.currentMinutesWatched ?? drop?.currentMinutes);
      return total !== null && total > 0 && current !== null && current >= 0 ? Math.max(0, total - current) : null;
    }
    function planPrerequisites(drop, drops = [], timingModel = 'unknown') {
      const byId = new Map(drops.filter(item => item?.id).map(item => [String(item.id), item]));
      const visiting = new Set(); const visited = new Set(); const dependencies = [];
      let issue = ''; let blocked = false;
      function walk(node, depth) {
        const key = text(node?.id);
        if (depth > 64 || visiting.has(key)) { issue = 'cyclic-prerequisite'; return; }
        if (visited.has(key)) return;
        visiting.add(key);
        for (const dependency of node?.preconditionDrops || []) {
          const child = byId.get(text(dependency?.id));
          if (!child) { issue ||= 'missing-prerequisite'; blocked = true; continue; }
          walk(child, depth + 1);
          const claimed = child.self?.isClaimed === true;
          const remaining = requirement(child);
          const explicitCompleted = dependency?.requirement === 'completed' || dependency?.requiresClaim === false;
          const satisfied = claimed || (explicitCompleted && remaining === 0);
          if (!satisfied) blocked = true;
          if (!dependencies.some(item => item.id === text(child.id))) dependencies.push({
            id: text(child.id), remainingMinutes: remaining,
            claimed, satisfied,
            requirement: explicitCompleted ? 'completed' : dependency?.requirement === 'claimed' || dependency?.requiresClaim === true ? 'claimed' : 'not-verified',
          });
        }
        visiting.delete(key); visited.add(key);
      }
      walk(drop, 0);
      const ownRemaining = requirement(drop);
      const outstanding = dependencies.filter(item => !item.satisfied);
      const known = ownRemaining !== null && outstanding.every(item => item.remainingMinutes !== null);
      let totalRemaining = null;
      if (!outstanding.length && !issue) totalRemaining = ownRemaining;
      else if (known && !issue && timingModel === 'sequential') totalRemaining = ownRemaining + outstanding.reduce((sum, item) => sum + item.remainingMinutes, 0);
      else if (known && !issue && timingModel === 'parallel') totalRemaining = Math.max(ownRemaining, ...outstanding.map(item => item.remainingMinutes));
      return {
        ready: !issue && (!blocked || drop?.self?.hasPreconditionsMet === true),
        reason: issue || (blocked && drop?.self?.hasPreconditionsMet !== true ? 'prerequisite-required' : ''),
        ownRemainingMinutes: ownRemaining, totalRemainingMinutes: totalRemaining,
        timingModel: ['sequential', 'parallel'].includes(timingModel) ? timingModel : outstanding.length ? 'unknown' : 'single-reward',
        dependencies,
      };
    }

    function deadlineAssessment(campaign, drop, plan, now = Date.now(), bufferMinutes = 2) {
      const endMs = Date.parse(drop?.endAt || campaign?.endAt || '');
      const deadlineMs = Number.isFinite(endMs) ? endMs : null;
      const minutesUntilDeadline = deadlineMs === null ? null : Math.max(0, Math.floor((deadlineMs - now) / 60000));
      const requiredMinutes = Number.isFinite(Number(plan?.totalRemainingMinutes)) ? Math.max(0, Number(plan.totalRemainingMinutes)) : null;
      const safeBufferMinutes = Math.max(0, Number(bufferMinutes) || 0);
      const finishable = minutesUntilDeadline === null || requiredMinutes === null ? null : requiredMinutes + safeBufferMinutes <= minutesUntilDeadline;
      const marginMinutes = minutesUntilDeadline === null || requiredMinutes === null ? null : minutesUntilDeadline - requiredMinutes - safeBufferMinutes;
      const urgency = finishable === false ? 'unfinishable' : marginMinutes === null ? 'unknown' : marginMinutes <= 15 ? 'tight' : marginMinutes <= 60 ? 'soon' : 'comfortable';
      return { deadlineMs, minutesUntilDeadline, requiredMinutes, bufferMinutes: safeBufferMinutes, finishable, marginMinutes, urgency };
    }

    function campaignSequence(campaign, now = Date.now(), bufferMinutes = 2) {
      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      let remainingMinutes = 0, known = true, inProgress = false, pendingClaims = 0, watchRewards = 0;
      for (const drop of drops) {
        if (drop?.self?.isClaimed === true) continue;
        const paid = Number(drop?.requiredSubs ?? drop?.requiredSubscriptions ?? drop?.requiredSubscriptionCount ?? drop?.subscriptionRequirement?.requiredSubs ?? 0) > 0;
        if (paid) continue;
        const total = number(drop?.requiredMinutesWatched ?? drop?.requiredMinutes);
        if (total === null || total <= 0) continue;
        watchRewards += 1;
        const current = number(drop?.self?.currentMinutesWatched ?? drop?.currentMinutes);
        if (current === null || current < 0) { known = false; continue; }
        if (current > 0 && current < total) inProgress = true;
        remainingMinutes += Math.max(0, total - current);
        if (current >= total) pendingClaims += 1;
      }
      const knownRemaining = watchRewards > 0 && known ? remainingMinutes : null;
      const deadline = deadlineAssessment(campaign, null, { totalRemainingMinutes: knownRemaining }, now, bufferMinutes);
      return { watchRewards, remainingMinutes: knownRemaining, pendingClaims, inProgress, ...deadline };
    }

    function rankCampaignCandidates(candidates, { priorityOf = () => 0, now = Date.now(), activeGame = '', bufferMinutes = 2 } = {}) {
      const active = text(activeGame).toLowerCase();
      return [...(candidates || [])].map(item => {
        const rawDeadline = number(item?.endMs);
        const parsedDeadline = Date.parse(item?.campaignEndAt || item?.dropEndAt || item?.endAt || '');
        const deadlineMs = rawDeadline !== null ? rawDeadline : (Number.isFinite(parsedDeadline) ? parsedDeadline : null);
        const remaining = number(item?.sequenceRemainingMinutes ?? item?.remainingMinutes);
        const minutesUntilDeadline = deadlineMs === null ? null : Math.max(0, Math.floor((deadlineMs - now) / 60000));
        const safeBuffer = Math.max(0, Number(bufferMinutes) || 0);
        const finishable = minutesUntilDeadline === null || remaining === null ? null : remaining + safeBuffer <= minutesUntilDeadline;
        const marginMinutes = minutesUntilDeadline === null || remaining === null ? null : minutesUntilDeadline - remaining - safeBuffer;
        return {
          ...item,
          sequencePriority: Number(priorityOf(item?.game)) || 0,
          sequenceFinishable: finishable,
          sequenceMarginMinutes: marginMinutes,
          sequenceMinutesUntilDeadline: minutesUntilDeadline,
          sequenceInProgress: Boolean(Number(item?.currentMinutes) > 0 || item?.sequenceInProgress),
          sequenceActiveGame: Boolean(active && text(item?.game).toLowerCase() === active),
        };
      }).sort((a, b) => {
        const feasibility = value => value === false ? 1 : 0;
        const feasibleDelta = feasibility(a.sequenceFinishable) - feasibility(b.sequenceFinishable);
        if (feasibleDelta) return feasibleDelta;
        if (b.sequencePriority !== a.sequencePriority) return b.sequencePriority - a.sequencePriority;
        if (a.sequenceActiveGame !== b.sequenceActiveGame) return a.sequenceActiveGame ? -1 : 1;
        const endA = Number.isFinite(Number(a.endMs)) ? Number(a.endMs) : Number.MAX_SAFE_INTEGER;
        const endB = Number.isFinite(Number(b.endMs)) ? Number(b.endMs) : Number.MAX_SAFE_INTEGER;
        if (endA !== endB) return endA - endB;
        const marginA = Number.isFinite(a.sequenceMarginMinutes) ? a.sequenceMarginMinutes : Number.MAX_SAFE_INTEGER;
        const marginB = Number.isFinite(b.sequenceMarginMinutes) ? b.sequenceMarginMinutes : Number.MAX_SAFE_INTEGER;
        if (marginA !== marginB) return marginA - marginB;
        if (a.sequenceInProgress !== b.sequenceInProgress) return a.sequenceInProgress ? -1 : 1;
        const remA = number(a.sequenceRemainingMinutes ?? a.remainingMinutes);
        const remB = number(b.sequenceRemainingMinutes ?? b.remainingMinutes);
        if (remA !== null && remB !== null && remA !== remB) return remA - remB;
        return text(a.game).localeCompare(text(b.game));
      });
    }
    function eligibility(campaign, drop, context = {}) {
      const now = context.now ?? Date.now();
      const result = (code, label, detail, extra = {}) => ({ code, label, detail, ...extra });
      if (!campaign || !drop) return result('unknown', 'Eligibility Not Verified', 'Campaign or reward details are unavailable.');
      const timestamps = [campaign.startAt, campaign.endAt, drop.startAt || campaign.startAt, drop.endAt || campaign.endAt].map(value => Date.parse(value));
      if (timestamps.some(value => !Number.isFinite(value))) return result('unknown-window', 'Eligibility Not Verified', 'The campaign or reward time window is not verified.');
      const start = Math.max(timestamps[0], timestamps[2]); const end = Math.min(timestamps[1], timestamps[3]);
      if (end <= start) return result('unknown-window', 'Eligibility Not Verified', 'The campaign and reward time windows do not overlap.');
      if (now < start) return result('not-started', 'Campaign Not Started', 'This reward is not available to earn yet.');
      if (now >= end) return result('expired', 'Campaign Ended', 'This reward is no longer available to earn.');
      if (campaign.self?.isAccountConnected === false || campaign.isAccountConnected === false) return result('account-link', 'Account Link Required', 'Link the required account through Twitch or the campaign provider.');
      if (campaign.self?.isEligible === false || drop.self?.isEligible === false) return result('participation', 'Campaign Not Eligible', 'Twitch reports that this account is not eligible.');
      if (Number(drop.requiredSubs ?? drop.requiredSubscriptions ?? drop.requiredSubscriptionCount ?? drop.subscriptionRequirement?.requiredSubs ?? 0) > 0) return result('paid-requirement', 'Paid Reward Excluded', 'Dropper only assists with free watch rewards.');
      const plan = planPrerequisites(drop, campaign.timeBasedDrops || campaign.drops || []);
      const deadline = deadlineAssessment(campaign, drop, plan, now);
      const campaignPlan = campaignSequence(campaign, now);
      if (!plan.ready) return result(plan.reason, 'Previous Reward Required', plan.reason === 'prerequisite-required' ? 'Complete or claim the prerequisite shown for this reward.' : 'The prerequisite chain is incomplete or invalid.', { plan, deadline, campaignPlan });
      const game = text(campaign.game?.displayName || campaign.game?.name || campaign.game).toLowerCase();
      if (context.game && game && text(context.game).toLowerCase() !== game) return result('wrong-game', 'Stream Not Eligible', 'This stream is in a different game category.', { plan, deadline, campaignPlan });
      const allowedLogins = (context.allowedChannels || []).map(x => text(x).toLowerCase()).filter(Boolean);
      const channelLogin = text(context.channel).toLowerCase();
      const channelMismatch = Boolean(allowedLogins.length && channelLogin && !allowedLogins.includes(channelLogin));
      if (channelMismatch && context.verified !== true && context.verificationPending === true) {
        return result('verification-pending', 'Verification Pending', 'Dropper is waiting for Twitch campaign evidence or credited progress for this Drops-tagged stream.', { plan, deadline, campaignPlan });
      }
      if (channelMismatch && context.verified !== true) return result('wrong-channel', 'Stream Not Eligible', "This stream does not meet the selected campaign's channel requirements.", { plan, deadline, campaignPlan });
      if (context.verified !== true) return result('unknown', 'Eligibility Not Verified', 'Dropper does not yet have enough information to verify this stream.', { plan, deadline, campaignPlan });
      if (deadline.finishable === false) return result('deadline-risk', 'Deadline Risk', 'The verified watch requirement is longer than the remaining campaign window.', { plan, deadline, campaignPlan, deadlineMs: end, estimateMinutes: plan.totalRemainingMinutes });
      return result('eligible', 'Eligible Stream', deadline.urgency === 'tight' ? 'This stream is eligible, but the reward deadline is close.' : 'Twitch campaign or credited-progress evidence verifies this stream.', { plan, deadline, campaignPlan, deadlineMs: end, estimateMinutes: plan.totalRemainingMinutes });
    }

    function selectorHealth(entry, now = Date.now(), staleAfterMs = 15 * 60 * 1000) {
      if (!entry?.applicable) return { status: 'not-applicable', ageMs: null, matchedAgeMs: null };
      const checkedAt = number(entry.checkedAt);
      const matchedAt = number(entry.lastMatchedAt);
      const ageMs = checkedAt === null ? null : Math.max(0, now - checkedAt);
      const matchedAgeMs = matchedAt === null ? null : Math.max(0, now - matchedAt);
      if (entry.state === 'detection-failed') return { status: 'degraded', ageMs, matchedAgeMs };
      if (entry.state === 'attempted') return { status: 'action-pending', ageMs, matchedAgeMs };
      if (entry.state === 'matched') return { status: 'observed', ageMs, matchedAgeMs: 0 };
      if (matchedAgeMs !== null && matchedAgeMs > Math.max(0, staleAfterMs)) return { status: 'stale-observation', ageMs, matchedAgeMs };
      if (matchedAgeMs !== null) return { status: 'observed-recently', ageMs, matchedAgeMs };
      // No historical match is not evidence of a broken selector when there is
      // simply nothing claimable on the current page.
      return { status: 'monitoring', ageMs, matchedAgeMs: null };
    }

    function recoveryDiagnosis(health, { delayedMs = 5 * 60 * 1000, stalledMs = 6 * 60 * 1000 } = {}) {
      if (!health?.login) return { code: 'no-stream', recoverable: false };
      if (health.pauseReason === 'viewer') return { code: 'viewer-paused', recoverable: false };
      if (health.live === false) return { code: 'offline', recoverable: true };
      if (health.gameMatches === false) return { code: 'wrong-game', recoverable: true };
      if (health.playback === 'error') return { code: 'playback-error', recoverable: true };
      if ((health.playback === 'paused' || health.playback === 'ended') && health.pauseReason !== 'viewer') {
        return { code: 'playback-stopped', recoverable: true };
      }
      if (health.inVerificationGrace) return { code: 'verification-grace', recoverable: false };
      if (health.campaignVerified === false) return { code: 'eligibility-unverified', recoverable: false };
      const progressAgeMs = Math.max(0, Number(health.progressAgeMs || 0));
      const delayedThresholdMs = Math.max(0, delayedMs);
      const stalledThresholdMs = Math.max(0, stalledMs);
      if (health.backgrounded === true && progressAgeMs >= delayedThresholdMs) {
        return { code: 'credit-delayed-background', recoverable: false };
      }
      if (Number(health.foregroundGraceRemainingMs || 0) > 0 && progressAgeMs >= delayedThresholdMs) {
        return { code: 'foreground-revalidation-grace', recoverable: false };
      }
      if (progressAgeMs >= stalledThresholdMs) return { code: 'credit-stalled', recoverable: true };
      if (health.playback === 'buffering' && progressAgeMs >= delayedThresholdMs) return { code: 'buffering', recoverable: false };
      if (progressAgeMs >= delayedThresholdMs) return { code: 'credit-delayed', recoverable: false };
      return { code: 'healthy', recoverable: false };
    }

    function createLease({ now = Date.now, id = () => `${Date.now()}-${Math.random()}`, read = () => null, write = () => {}, remove = () => {}, ttlMs = 8000, settle = () => Promise.resolve() } = {}) {
      async function run(key, task) {
        const owner = text(id());
        const startedAt = now();
        let current = null;
        try { current = read(key); } catch (_) {}
        if (current && Number(current.expiresAt || 0) > startedAt && current.owner !== owner) return false;
        const token = `${owner}:${startedAt}:${Math.random().toString(36).slice(2)}`;
        const lease = { owner, token, expiresAt: startedAt + Math.max(1000, Number(ttlMs) || 8000) };
        try { write(key, lease); } catch (_) { return false; }
        try { await settle(); } catch (_) {}
        let held = null;
        try { held = read(key); } catch (_) {}
        if (!held || held.token !== token || Number(held.expiresAt || 0) <= now()) return false;
        try { return await task(); }
        finally {
          try {
            const latest = read(key);
            if (latest?.token === token) remove(key);
          } catch (_) {}
        }
      }
      return Object.freeze({ run });
    }
    function inventoryClaimCandidates(campaigns, { limit = 3, excludeRewardId = '' } = {}) {
      const excluded = text(excludeRewardId);
      const candidates = [];
      for (const campaign of campaigns || []) {
        const campaignId = text(campaign?.id);
        const campaignKey = campaignId || text(campaign?.campaignKey);
        const game = text(campaign?.game?.displayName || campaign?.game?.name || campaign?.game);
        const endAt = text(campaign?.endAt);
        const parsedEnd = endAt ? Date.parse(endAt) : NaN;
        const endMs = Number.isFinite(parsedEnd) ? parsedEnd : Number.MAX_SAFE_INTEGER;
        const drops = campaign?.timeBasedDrops || campaign?.drops || [];
        drops.forEach((drop, dropOrder) => {
          const self = drop?.self || {};
          const rewardId = text(drop?.id);
          if (excluded && rewardId && rewardId === excluded) return;
          if (self.isClaimed === true || drop?.isClaimed === true) return;
          const requiredSubs = Number(drop?.requiredSubs ?? drop?.requiredSubscriptions ?? drop?.requiredSubscriptionCount ?? drop?.subscriptionRequirement?.requiredSubs ?? 0) || 0;
          if (requiredSubs > 0) return;
          const required = number(drop?.requiredMinutesWatched ?? drop?.requiredMinutes);
          const current = number(self.currentMinutesWatched ?? drop?.currentMinutes);
          const instanceID = text(self.dropInstanceID || drop?.dropInstanceID);
          if (!instanceID || required === null || required <= 0 || current === null || current < required) return;
          candidates.push({
            id: rewardId,
            dropInstanceID: instanceID,
            isClaimed: false,
            name: text(drop?.name || drop?.benefitEdges?.[0]?.benefit?.name || 'Completed Drop'),
            game,
            campaignId,
            campaignKey,
            campaign: text(campaign?.name || game),
            campaignStartAt: text(campaign?.startAt),
            campaignEndAt: endAt,
            dropStartAt: text(drop?.startAt),
            dropEndAt: text(drop?.endAt),
            endMs,
            currentMinutes: current,
            requiredMinutes: required,
            remainingMinutes: 0,
            percent: 100,
            inventorySweep: true,
            dropOrder,
          });
        });
      }
      candidates.sort((a, b) => {
        if (a.endMs !== b.endMs) return a.endMs - b.endMs;
        if (a.campaignKey !== b.campaignKey) return a.campaignKey.localeCompare(b.campaignKey);
        return a.dropOrder - b.dropOrder;
      });
      const max = Math.max(0, Math.min(10, Number(limit) || 0));
      return max ? candidates.slice(0, max) : [];
    }
    function claimPresentation(record) {
      const outcome = record?.outcome;
      const evidence = record?.evidence;
      if (outcome === 'confirmed') return 'Reward Claimed';
      if (outcome === 'already-claimed') return 'Already Claimed';
      if (outcome === 'retryable') return 'Claim Retry Pending';
      if (outcome === 'blocked') return 'Claim Needs Attention';
      if (outcome === 'pending') return 'Claim Sent · Waiting For Twitch';
      if (outcome === 'discarded') return 'Claim Context Changed';
      if (outcome === 'unconfirmed' && evidence === 'timeout') return 'Claim Sent · Confirmation Unavailable';
      return 'Claim Not Confirmed';
    }

    return Object.freeze({ createIntent, createClaims, claimResponse, claimFailure, planPrerequisites, deadlineAssessment, campaignSequence, rankCampaignCandidates, eligibility, selectorHealth, recoveryDiagnosis, createLease, inventoryClaimCandidates, claimPresentation });
  })();
  // END DROPPER ACTIVE VIEWING

  const settings = loadSettings();
  const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const PAGE_STARTED_AT = Date.now();
  const playerPresentationRecovery = { attempted: false, viewerInteracted: false, lastResult: 'not-needed' };
  // Per-document identity prevents a newly opened Twitch tab from inheriting
  // the same controller identity through a cloned sessionStorage snapshot.
  const TAB_ID = `t${PAGE_STARTED_AT.toString(36)}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11)}`;
  const TAB_STARTED_AT = PAGE_STARTED_AT;
  let tabPresenceTimer = null;
  let tabChannel = null;
  let lastPeerCount = 0;
  let lastDeferredRoutingAt = 0;
  let lastDeferredRoutingReason = "";
  let lastSessionRecovery = null;
  let statusText = "Starting…";
  let progressLabel = "";
  let lastNativeTitle = document.title || "Twitch";
  let progressTitleObserver = null;
  let progressTitleSyncQueued = false;
  let lastBonusAt = 0;
  let lastDropAt = 0;
  let lastClaimAttemptAt = 0;
  let claimReadySince = 0;
  let claimReadySignature = "";
  let lastClaimIntegrityFallback = null;
  let inventoryClaimSweepPromise = null;
  let inventoryClaimSweepState = { at: 0, source: '', candidates: 0, selected: 0, confirmed: 0, reason: 'not-run' };
  let lastProgressReconcile = null;
  let lastSessionPoll = null;
  let twitchNetworkHookMode = "";
  let lastStreamVerification = null;
  let finalVerificationPollTarget = "";
  let finalVerificationPollAt = 0;
  let lastStreamSwitch = 0;
  let streamOfflineSince = 0;
  let categoryMismatchSince = 0;
  let categoryMismatchSignature = "";
  let categorySlugCache = loadCategorySlugCache();
  let lastProgress = readSession("tdh-progress", 0);
  let lastProgressAt = readSession("tdh-progress-at", Date.now());
  let currentDrop = readSession("tdh-drop", null);
  if (currentDrop && isDropCardMetadata(currentDrop.name) && !cleanText(currentDrop.id)) {
    currentDrop = { ...currentDrop, name: "Current drop" };
  }
  let lastPath = "";
  let watchClock = { login: "", started: 0 };
  let lastCheckedAt = 0;
  let lastCheckedLogin = "";
  let ui = null;
  let railOpen = false;
  let skipStreamerArm = { login: "", expiresAt: 0 };
  let skipStreamerArmTimer = null;
  let lastPanelId = "";
  let lastSubmenuId = "";
  let clusterTop = 0;
  let launcherGridDelta = Number(localStorage.getItem(LAUNCHER_GRID_DELTA_KEY) || 0);
  if (!Number.isFinite(launcherGridDelta)) launcherGridDelta = 0;
  localStorage.removeItem(LEGACY_LAUNCHER_TOP_KEY);
  localStorage.removeItem(LEGACY_LAUNCHER_GRID_DELTA_KEY);
  let lastUiProgressPercent = null;
  let lastUiRoutingState = "";
  let menuDismissTimer = null;
  let menuDismissAt = 0;
  let updateNoticeTimer = null;
  let updateNoticeState = null;
  let lastUpdateNoticeVersion = "";
  let updateReloadTimer = null;
  let updateFallbackTimer = null;
  let pauseAutoSwitchUntil = Number(settings.pauseAutoSwitchUntil || 0);
  let lastInventoryCampaigns = [];
  let campaignCatalogCache = loadCampaignCatalogCache();
  let lastCampaignCatalog = campaignCatalogCache.campaigns;
  let lastCampaignCatalogAt = campaignCatalogCache.at;
  let lastCampaignPageScanSignature = "";
  let lastCampaignPageImportAt = 0;
  let lastCampaignPageImportCount = 0;
  let lastCampaignPageImportDisplay = "";
  let lastCampaignPageImportSource = "";
  let lastCampaignsPageEnrichmentFinishedAt = 0;
  let lastCampaignPageDisplay = {
    mode: CAMPAIGN_PAGE_DISPLAY.UNKNOWN,
    accordionHeaders: 0,
    dateLeaves: 0,
    hasEmptyMessage: false,
    hasOpenDropSection: false,
    hasOpenRewardSection: false,
    hasClosedSection: false,
    at: 0,
  };
  {
    const savedImport = readSession(CAMPAIGN_PAGE_IMPORT_KEY, null);
    const savedAt = Number(savedImport?.at || 0);
    const savedCount = Number(savedImport?.count || 0);
    const savedFinishedAt = Number(savedImport?.finishedAt || savedAt || 0);
    const savedDisplay = cleanText(savedImport?.display || "");
    const savedSource = cleanText(savedImport?.source || "");
    const importAge = savedFinishedAt ? Date.now() - savedFinishedAt : PAGE_CAMPAIGN_IMPORT_TTL_MS + 1;
    const restoreFilled = savedCount > 0 && importAge < PAGE_CAMPAIGN_IMPORT_TTL_MS;
    const restoreEmpty = (
      savedCount <= 0 &&
      (savedDisplay === CAMPAIGN_PAGE_DISPLAY.EMPTY || savedDisplay === CAMPAIGN_PAGE_DISPLAY.TIMEOUT) &&
      importAge < PAGE_CAMPAIGN_IMPORT_EMPTY_TTL_MS
    );
    if (restoreFilled || restoreEmpty) {
      lastCampaignPageImportAt = savedAt || savedFinishedAt;
      lastCampaignPageImportCount = Math.max(0, savedCount);
      lastCampaignPageImportDisplay = savedDisplay;
      lastCampaignPageImportSource = savedSource;
      lastCampaignsPageEnrichmentFinishedAt = savedFinishedAt;
    }
  }
  let campaignMemory = loadCampaignMemory();
  let ignoredCampaignGames = loadIgnoredCampaignGames();
  // Restore a prior All Campaigns page import from the session catalog when present.
  {
    const restoredPageCount = (lastCampaignCatalog || []).filter((campaign) => (
      /^page:/i.test(String(campaign?.id || ""))
    )).length;
    if (restoredPageCount > 0 && lastCampaignCatalogAt) {
      lastCampaignPageImportCount = Math.max(lastCampaignPageImportCount, restoredPageCount);
      lastCampaignPageImportAt = Math.max(lastCampaignPageImportAt, lastCampaignCatalogAt);
      lastCampaignsPageEnrichmentFinishedAt = Math.max(
        lastCampaignsPageEnrichmentFinishedAt,
        lastCampaignCatalogAt,
      );
    }
  }
  restoreCurrentDropMetadataFromKnownCampaigns();
  repairRoutingIdentity();
  let chatWidthObserver = null;
  let chatDomObserver = null;
  let observedChatElement = null;
  let bonusClaimObserver = null;
  let dropClaimObserver = null;
  let suppressedSubscriptionPromoCount = 0;
  let lastPromoScanAt = 0;
  let lastQueueRefreshAt = 0;
  let lastStandbyRefreshAt = Number(readSession(STANDBY_REFRESH_KEY, 0)) || 0;
  let duplicateNavigationSkips = 0;
  let lastGqlPollAt = 0;
  let lastGqlSuccessAt = 0;
  let lastGqlError = "";
  let lastTwitchGqlAt = 0;
  let twitchNetworkCapture = {
    integrity: "",
    integrityExpiresAt: 0,
    clientId: "",
    deviceId: "",
    sessionId: "",
    clientVersion: "",
    auth: "",
  };
  let twitchNetworkHooksInstalled = false;
  let lastCampaignDashboardAt = 0;
  let haveSeenInventorySnapshot = false;
  let lastInProgressKeys = new Set();
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
  let lastRoutingCandidateSnapshot = {
    at: 0,
    game: "",
    gameSlug: "",
    campaignKey: "",
    allowListPresent: false,
    visible: [],
  };
  let networkState = readSession(NETWORK_STATE_KEY, {
    requestTimes: [],
    consecutiveFailures: 0,
    openUntil: 0,
    reason: "",
    lastOpenedAt: 0,
    softBudgetWarnedAt: 0,
  });
  const previousInstalledVersion = (() => {
    try { return localStorage.getItem(LAST_VERSION_KEY) || ""; } catch (_) { return ""; }
  })();
  if (
    previousInstalledVersion &&
    previousInstalledVersion !== APP_VERSION
  ) {
    removeSession(CLIENT_INTEGRITY_KEY);
    removeSession(NAVIGATION_GUARD_KEY);
    removeSession(NAVIGATION_FLIGHT_KEY);
    if (/gql|integrity/i.test(networkState.reason || "")) {
      networkState = {
        requestTimes: [],
        consecutiveFailures: 0,
        openUntil: 0,
        reason: "",
        lastOpenedAt: 0,
        softBudgetWarnedAt: 0,
      };
      writeSession(NETWORK_STATE_KEY, networkState);
    }
  }

  const VIEWING_INTENT_KEY = 'dropper-viewing-intent-v1';
  const VIEWING_NAVIGATION_KEY = 'dropper-viewing-navigation-v1';
  const MANUAL_STREAM_LOCK_KEY = 'dropper-manual-stream-lock-v1';
  const CLAIM_HISTORY_KEY = 'dropper-claim-history-v1';
  const CAMPAIGN_PRIORITY_KEY = 'dropper-campaign-priority-v1';
  const CAMPAIGN_PRIORITY_ORDER_KEY = 'dropper-campaign-priority-order-v1';
  let viewingAccount = storageAccountLogin();
  let viewingVideo = null;
  let videoMountedDuringPause = false;
  let recentPlaybackControl = { action: '', at: 0 };
  let viewingListenersInstalled = false;
  let screenWakeLock = null;
  let wakeLockPending = false;
  let claimLedgerAccount = '';
  let claimLedgerInstance = null;
  let claimScanTimer = null;
  let lastClaimScanAt = 0;
  let claimScanQueuedAt = 0;
  let claimAnonymousSequence = 0;
  const claimNodeIds = new WeakMap();
  let lastAnonymousAttemptAt = { bonus: 0, drop: 0 };
  let claimHealth = {};
  let lastViewingNavigationBlock = '';
  let explicitViewingNavigationUntil = 0;
  const viewingIntent = DropperActiveViewing.createIntent({
    load: account => {
      try { return JSON.parse(sessionStorage.getItem(scopedSessionStorageKey(VIEWING_INTENT_KEY, account)) || 'null'); }
      catch (_) { return null; }
    },
    save: state => {
      try { sessionStorage.setItem(scopedSessionStorageKey(VIEWING_INTENT_KEY, state.account), JSON.stringify(state)); }
      catch (_) { /* The in-memory pause hold remains authoritative in this tab. */ }
    },
  });

  function resetViewingAccount(account) {
    viewingAccount = account;
    viewingVideo = null;
    videoMountedDuringPause = false;
    recentPlaybackControl = { action: '', at: 0 };
    claimLedgerInstance = null;
    claimLedgerAccount = '';
    claimHealth = {};
    lastClaimScanAt = 0;
    claimScanQueuedAt = 0;
    lastAnonymousAttemptAt = { bonus: 0, drop: 0 };
    lastViewingNavigationBlock = '';
    explicitViewingNavigationUntil = 0;
    lastDropAt = 0; lastBonusAt = 0; lastClaimAttemptAt = 0;
    resetClaimReadyTimer();
    currentDrop = readSession('tdh-drop', null);
    lastProgress = readSession('tdh-progress', 0);
    lastProgressAt = readSession('tdh-progress-at', Date.now());
    lastInventoryCampaigns = [];
    haveSeenInventorySnapshot = false;
    lastInProgressKeys = new Set();
    campaignCatalogCache = loadCampaignCatalogCache();
    lastCampaignCatalog = campaignCatalogCache.campaigns;
    lastCampaignCatalogAt = campaignCatalogCache.at;
    restoreCurrentDropMetadataFromKnownCampaigns();
    campaignMemory = loadCampaignMemory();
    ignoredCampaignGames = loadIgnoredCampaignGames();
    activityLog = readSession(ACTIVITY_LOG_KEY, []);
    lastStreamVerification = null;
    lastSessionPoll = null;
    clientIntegrity = { token: '', clientId: '', expiresAt: 0, transport: '', deviceId: '' };
    watchClock = { login: '', started: 0, elapsed: 0, lastTick: 0 };
    lastPath = location.pathname;
    lastProgressReconcile = null;
    twitchNetworkCapture = { integrity: '', integrityExpiresAt: 0, clientId: '', deviceId: '', sessionId: '', clientVersion: '', auth: '' };
    nextGqlPollAt = 0;
    try { tabChannel?.close(); } catch (_) {}
    tabChannel = null;
  }

  function automaticViewingArrival(login = watchingLogin(), now = Date.now()) {
    const requested = readSession(VIEWING_NAVIGATION_KEY, null);
    return Boolean(requested && requested.channel === login && requested.until > now);
  }

  function syncViewingContext() {
    const account = storageAccountLogin();
    if (viewingAccount !== account) resetViewingAccount(account);
    const login = watchingLogin() || '';
    const automaticArrival = automaticViewingArrival(login);
    const changed = viewingIntent.context(account, login, automaticArrival);
    if (changed) {
      viewingVideo = null;
      lastViewingNavigationBlock = '';
      recentPlaybackControl = { action: '', at: 0 };
    }
    const video = login ? streamVideoElement() : null;
    if (video !== viewingVideo) {
      viewingVideo = video;
      videoMountedDuringPause = viewingIntent.snapshot().paused;
    }
    if (!video) viewingIntent.observe('unknown');
    else if (video.ended) viewingIntent.observe('ended');
    else if (video.error) viewingIntent.observe('error');
    else if (video.paused) {
      // An unrequested paused player is not permission to force playback.
      if (!automaticArrival || viewingIntent.snapshot().paused) viewingIntent.pause(false);
      else viewingIntent.observe('paused');
    } else {
      const held = viewingIntent.snapshot();
      const explicitResume = recentPlaybackControl.action === 'resume' && Date.now() - recentPlaybackControl.at < 1500;
      if (held.paused && (videoMountedDuringPause || held.pauseReason === 'viewer') && !explicitResume) {
        // Preserve a known pause through a same-channel player replacement.
        // This does not intercept or replace Twitch's media methods.
        try { video.pause(); } catch (_) {}
      } else viewingIntent.observe(video.readyState > 1 ? 'playing' : 'buffering');
    }
    return viewingIntent.snapshot();
  }

  function recoverySnapshotStorageKey(account = storageAccountLogin()) {
    return scopedLocalStorageKey(RECOVERY_SNAPSHOT_KEY, account);
  }

  function clearRecoverySnapshot(reason = '') {
    try { localStorage.removeItem(recoverySnapshotStorageKey()); } catch (_) {}
    if (reason && lastSessionRecovery) {
      logActivity('session-recovery', 'Cleared restart recovery snapshot', { reason });
    }
  }

  function compactRecoveryDrop(drop = currentDrop) {
    if (!drop) return null;
    const clean = value => cleanText(value).slice(0, 180);
    return {
      id: clean(drop.id),
      dropInstanceID: clean(drop.dropInstanceID),
      name: clean(drop.name || 'Current Drop'),
      game: clean(drop.game),
      gameSlug: clean(drop.gameSlug),
      gameId: clean(drop.gameId),
      campaignId: clean(drop.campaignId),
      campaignKey: clean(drop.campaignKey),
      campaign: clean(drop.campaign),
      campaignStartAt: clean(drop.campaignStartAt),
      campaignEndAt: clean(drop.campaignEndAt),
      dropStartAt: clean(drop.dropStartAt),
      dropEndAt: clean(drop.dropEndAt),
      percent: Number.isFinite(Number(drop.percent)) ? Math.max(0, Math.min(100, Number(drop.percent))) : null,
      currentMinutes: Number.isFinite(Number(drop.currentMinutes)) ? Math.max(0, Number(drop.currentMinutes)) : null,
      requiredMinutes: Number.isFinite(Number(drop.requiredMinutes)) ? Math.max(0, Number(drop.requiredMinutes)) : null,
      remainingMinutes: Number.isFinite(Number(drop.remainingMinutes)) ? Math.max(0, Number(drop.remainingMinutes)) : null,
      needsDropDetails: Boolean(drop.needsDropDetails),
      isClaimed: Boolean(drop.isClaimed),
    };
  }

  function loadRecoverySnapshot(now = Date.now()) {
    try {
      const parsed = JSON.parse(localStorage.getItem(recoverySnapshotStorageKey()) || 'null');
      if (!parsed || parsed.version !== RECOVERY_SNAPSHOT_VERSION || !parsed.drop || parsed.drop.isClaimed) return null;
      const at = Number(parsed.at || 0);
      const expiresAt = Number(parsed.expiresAt || 0);
      if (!at || !expiresAt || expiresAt <= now || now - at > RECOVERY_SNAPSHOT_TTL_MS) {
        localStorage.removeItem(recoverySnapshotStorageKey());
        return null;
      }
      const endMs = Date.parse(parsed.drop.dropEndAt || parsed.drop.campaignEndAt || '') || 0;
      if (endMs && endMs <= now) {
        localStorage.removeItem(recoverySnapshotStorageKey());
        return null;
      }
      if (!cleanText(parsed.drop.game) || !cleanText(parsed.drop.campaignKey || parsed.drop.campaignId)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function saveRecoverySnapshot(reason = 'state-change') {
    if (!settings.resumeSessionOnRestart || !currentDrop || isSyntheticWaitingDrop(currentDrop)) return false;
    if (currentDrop.isClaimed) {
      clearRecoverySnapshot('drop-claimed');
      return false;
    }
    const now = Date.now();
    const drop = compactRecoveryDrop(currentDrop);
    if (!drop) return false;
    const campaignEndMs = Date.parse(drop.dropEndAt || drop.campaignEndAt || '') || 0;
    const expiresAt = Math.min(now + RECOVERY_SNAPSHOT_TTL_MS, campaignEndMs > now ? campaignEndMs : now + RECOVERY_SNAPSHOT_TTL_MS);
    const routing = readRoutingControllerSession();
    const preferredStream = cleanText(routing.targetStream || watchingLogin()).toLowerCase().slice(0, 120);
    const snapshot = {
      version: RECOVERY_SNAPSHOT_VERSION,
      at: now,
      expiresAt,
      reason: cleanText(reason).slice(0, 60),
      preferredStream,
      progressAt: Number(lastProgressAt || 0),
      drop,
    };
    const signature = JSON.stringify({ preferredStream, drop, bucket: Math.floor(now / 60000) });
    if (saveRecoverySnapshot.signature === signature) return false;
    saveRecoverySnapshot.signature = signature;
    try {
      localStorage.setItem(recoverySnapshotStorageKey(), JSON.stringify(snapshot));
      return true;
    } catch (_) {
      return false;
    }
  }

