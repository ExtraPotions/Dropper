// ==UserScript==
// @name         Dropper
// @namespace    twitch-drops-helper
// @version      2.5.4
// @description  A Twitch Drops companion for tracking watch time, monitoring progress, managing eligible streams, and redeeming rewards.
// @icon         https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-icon-1024.png
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
  const APP_VERSION = "2.5.4";
  const LAST_VERSION_KEY = "dropper-last-version";
  const UPDATE_CHECK_KEY = "dropper-update-check-at";
  const NEXT_GAME_KEY = "dropper-next-game-after-claim";
  const UPDATE_URL = "https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js";
  const CURRENT_CHANGELOG = [
    "Finishes all watch-time Drops for a game before switching games.",
    "Skips subscription-only Drops when deciding what to earn next.",
    "Improves Stream Queue handoff between completed games.",
    "Expands update notices with a concise, readable changelog.",
  ];
  const DEFAULTS = {
    claimBonus: true,
    keepTabActive: true,
    claimDrops: true,
    progressInTitle: true,
    findNextStream: true,
    muteRestarted: true,
    backgroundEarning: false,
    autoHideCard: false,
    reduceMotion: false,
    notifications: true,
    pauseAutoSwitchMinutes: 0,
    queueEnabled: true,
    queueCount: 3,
    queueOnStall: true,
    queueOnOffline: true,
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
  let statusText = "Starting…";
  let progressLabel = "";
  let lastBonusAt = 0;
  let lastDropAt = 0;
  let lastStreamSwitch = 0;
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
  let autoHideTimer = null;
  let updateNoticeState = null;
  let pauseAutoSwitchUntil = 0;
  let lastInventoryCampaigns = [];

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
    refreshDropCard();
    checkVersionNotice();
    scheduleUpdateCheck();
    pollGqlDrops();
    setTimeout(pollGqlDrops, 2500);
    setTimeout(pollGqlDrops, 8000);
    setInterval(() => {
      const credited = currentDrop?.currentMinutes || 0;
      if (credited === 0) pollGqlDrops();
    }, 8000);
    setInterval(pollGqlDrops, 20000);
    setInterval(() => {
      noteWatching();
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        pollGqlDrops();
      }
      if (settings.claimDrops) scanDrops();
      else refreshDropCard();
      refreshQueueList();
      if (settings.queueEnabled && settings.queueOnOffline && watchingLogin() && document.readyState === "complete") {
        const info = readStreamInfo();
        if (!info.live && Date.now() - lastStreamSwitch > 60000 && !isAutoSwitchPaused()) findNextStream();
      }
      if (settings.progressInTitle) updateTitle();
    }, 4000);
    setInterval(() => {
      noteWatching();
      refreshDropCard();
    }, 1000);
    window.addEventListener("resize", layoutChrome, { passive: true });
  }

  function hookAuth(uw) {
    const origFetch = uw.fetch.bind(uw);
    uw.fetch = function hookedFetch(input, init) {
      captureAuth(input, init);
      return origFetch.apply(this, arguments);
    };
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
      return await send(CLIENT_IDS[0]);
    } catch (error) {
      if (/401|403|integrity/i.test(error.message)) return send(CLIENT_IDS[1]);
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

  function pickTimedDrop(campaigns, gameName) {
    const now = Date.now();
    const wantedGame = (gameName || "").toLowerCase();
    const options = [];
    for (const campaign of campaigns || []) {
      const game = campaign.game?.displayName || campaign.game?.name || campaign.name || "";
      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = Number(self.currentMinutesWatched) || 0;
        if (required <= 0) continue;
        if (drop.startAt && Date.parse(drop.startAt) > now) continue;
        if (drop.endAt && Date.parse(drop.endAt) <= now) continue;
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
          gameSlug: campaign.game?.slug || campaign.game?.name || "",
          gameId: campaign.game?.id || "",
          campaign: campaign.name || game,
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
    pool.sort((a, b) => {
      if ((b.currentMinutes > 0) - (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      return a.remainingMinutes - b.remainingMinutes;
    });
    return pool[0];
  }

  function pickRemainingGameDrop(campaigns, gameName, completedDropId = "", completedDropName = "") {
    const wantedGame = cleanText(gameName).toLowerCase();
    const completedName = cleanText(completedDropName).toLowerCase();
    const now = Date.now();
    const remaining = [];

    if (!wantedGame) return null;

    for (const campaign of campaigns || []) {
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

        if (required <= 0) continue;
        if (drop.startAt && Date.parse(drop.startAt) > now) continue;
        if (drop.endAt && Date.parse(drop.endAt) <= now) continue;

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

  function pickNextGameDrop(campaigns, completedGame) {
    const previous = cleanText(completedGame).toLowerCase();
    const next = [];
    const now = Date.now();

    for (const campaign of campaigns || []) {
      const game = campaign.game?.displayName || campaign.game?.name || campaign.name || "";
      if (!game || game.toLowerCase() === previous) continue;

      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = Number(self.currentMinutesWatched) || 0;
        if (required <= 0) continue;
        if (drop.startAt && Date.parse(drop.startAt) > now) continue;
        if (drop.endAt && Date.parse(drop.endAt) <= now) continue;

        const preconditionsMet = (drop.preconditionDrops || []).every((item) => {
          const other = drops.find((candidate) => candidate.id === item.id);
          return other?.self?.isClaimed;
        });
        if (!preconditionsMet) continue;

        next.push({
          id: drop.id || "",
          name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop",
          game,
          gameSlug: campaign.game?.slug || campaign.game?.name || "",
          gameId: campaign.game?.id || "",
          campaign: campaign.name || game,
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

  function scheduleNextGameAfterClaim(drop) {
    const game = cleanText(drop?.game);
    if (!settings.findNextStream || !game) return;
    writeSession(NEXT_GAME_KEY, {
      completedGame: game,
      completedDrop: drop?.name || "Drop",
      completedDropId: drop?.id || "",
      startedAt: Date.now(),
    });
    setStatus(`${game} Drop Claimed · Checking Remaining Drops`);
    setTimeout(pollGqlDrops, 1400);
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
        if (!isTrustedTwitchUrl(link.href)) continue;
        try {
          const parsed = new URL(link.href, location.href);
          const login = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
          if (login && !RESERVED.has(login)) return parsed.href;
        } catch (_) {
          /* ignore */
        }
      }
    }
    return "";
  }

  function continueToNextGame(campaigns) {
    const pending = readSession(NEXT_GAME_KEY, null);
    if (!pending) return false;

    if (!pending.startedAt || Date.now() - pending.startedAt > 15 * 60 * 1000) {
      writeSession(NEXT_GAME_KEY, null);
      return false;
    }

    // Stay on the current game until every non-subscription watch-time Drop is done.
    const remainingCurrentGameDrop = pickRemainingGameDrop(
      campaigns,
      pending.completedGame,
      pending.completedDropId || "",
      pending.completedDrop || "",
    );

    if (remainingCurrentGameDrop) {
      writeSession(NEXT_GAME_KEY, null);
      setStatus(`Continuing ${pending.completedGame} · ${remainingCurrentGameDrop.name}`);
      return false;
    }

    // No normal watch-time Drops remain for this game. Subscription-only leftovers
    // are intentionally ignored, so it is safe to advance to the next game.
    const next = pickNextGameDrop(campaigns, pending.completedGame);
    if (!next) {
      writeSession(NEXT_GAME_KEY, null);
      setStatus("No More Eligible Games");
      notifyUser("All Eligible Watch-Time Drops Complete");
      return false;
    }

    if (!isInventory()) {
      setStatus(`${pending.completedGame} Complete · Moving To Next Game`);
      location.href = INVENTORY_URL;
      return true;
    }

    const href = findInventoryStreamForGame(next.game);
    if (!href) {
      setStatus(`Next Game: ${next.game} · Waiting For Eligible Stream`);
      return true;
    }

    writeSession(NEXT_GAME_KEY, null);
    lastStreamSwitch = Date.now();
    lastProgressAt = Date.now();
    writeSession("tdh-progress-at", lastProgressAt);
    setStatus(`Moving To ${next.game}`);
    notifyUser(`${pending.completedGame} Complete · Moving To ${next.game}`);
    location.href = href;
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
      name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Current drop",
      game: campaign?.game?.displayName || campaign?.game?.name || drop.game?.displayName || drop.game?.name || session.game?.displayName || session.game?.name || "",
      campaign: campaign?.name || "",
      percent: required ? Math.min(100, Math.round((minutes / required) * 100)) : 0,
      currentMinutes: minutes,
      requiredMinutes: required,
      remainingMinutes: Math.max(0, required - minutes),
      dropInstanceID: drop.self?.dropInstanceID || "",
      session: true,
    };
  }

  function parseAvailableCampaigns(result) {
    const channel = result?.data?.channel || result?.data?.user || {};
    return channel.viewerDropCampaigns || channel.dropCampaigns || [];
  }

  async function pollGqlDrops() {
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
      const inventoryCampaigns = first[0]?.data?.currentUser?.inventory?.dropCampaignsInProgress || [];
      lastInventoryCampaigns = inventoryCampaigns;
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
      const fromAvailable = pickTimedDrop(available, gameName);
      const fromInventory = pickTimedDrop(inventoryCampaigns, gameName) || pickTimedDrop(inventoryCampaigns, "");
      let drop = sessionDrop || fromInventory || fromAvailable;
      if (sessionDrop && fromInventory) {
        const minutes = Math.max(sessionDrop.currentMinutes || 0, fromInventory.currentMinutes || 0);
        drop = {
          ...fromInventory,
          ...sessionDrop,
          name: fromInventory.name || sessionDrop.name,
          game: fromInventory.game || sessionDrop.game || gameName,
          requiredMinutes: fromInventory.requiredMinutes || sessionDrop.requiredMinutes,
          currentMinutes: minutes,
        };
        drop.percent = drop.requiredMinutes
          ? Math.min(100, Math.round((drop.currentMinutes / drop.requiredMinutes) * 100))
          : drop.percent || 0;
        drop.remainingMinutes = Math.max(0, (drop.requiredMinutes || 0) - drop.currentMinutes);
      }
      if (drop) {
        applyDrop(drop);
        const channelNote = login ? ` on ${login}` : "";
        setStatus(`Working toward ${drop.name}${channelNote}`);
        if (settings.findNextStream && Date.now() - lastProgressAt > 6 * 60 * 1000 && !isAutoSwitchPaused()) {
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
      setStatus(error.message === "Not logged in" ? "Waiting for Twitch login…" : `Drops update failed: ${error.message}`);
      refreshDropCard();
    }
  }

  function applyDrop(drop) {
    if (!drop) return;
    const percent = drop.percent ?? (drop.requiredMinutes ? Math.round((drop.currentMinutes / drop.requiredMinutes) * 100) : 0);
    currentDrop = { ...drop, percent };
    writeSession("tdh-drop", currentDrop);
    if (percent) {
      progressLabel = `${percent}%`;
      if (percent !== lastProgress) {
        lastProgress = percent;
        lastProgressAt = Date.now();
        writeSession("tdh-progress", percent);
        writeSession("tdh-progress-at", lastProgressAt);
      }
    }
    refreshDropCard();
    layoutChrome();
    maybeClaimCurrentDrop(currentDrop);
  }

  function loadSettings() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
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
        setStatus(status === "DROP_INSTANCE_ALREADY_CLAIMED" ? "Drop already claimed" : `Claimed ${drop.name || "drop"}`);
        scheduleNextGameAfterClaim(drop);
        setTimeout(pollGqlDrops, 1200);
        return true;
      }
    } catch (_) {
      // DOM claim remains the fallback.
    }
    return false;
  }

  function maybeClaimCurrentDrop(drop) {
    if (!drop?.dropInstanceID || Date.now() - lastDropAt < 1200) return;
    if ((drop.currentMinutes || 0) < (drop.requiredMinutes || Infinity)) return;
    claimDropViaGql(drop);
  }

  function claimDropButtons(root = document) {
    if (!settings.claimDrops) return 0;
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
    const game = cleanText(document.querySelector('[data-a-target="stream-game-link"]')?.textContent);
    const viewers = cleanText(document.querySelector('[data-a-target="animated-channel-viewers-count"]')?.textContent);
    const uptime = cleanText(document.querySelector('.live-time span[aria-hidden="true"]')?.textContent);
    const dropsEnabled = Boolean(document.querySelector('[data-a-target="DropsEnabled"], a[href*="/tags/DropsEnabled"]'));
    const live = Boolean(root.querySelector('.tw-channel-status-text-indicator, [class*="ChannelStatusTextIndicator"]')) || /\bLIVE\b/i.test(root.textContent || "");
    return { channelName, avatar, title, game, viewers, uptime, dropsEnabled, live };
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
    scheduleAutoHide();
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
    setStatus("Opening Next Drops Channel");
    if (settings.queueEnabled) {
      location.href = href;
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
      .badge-row { display:flex; align-items:stretch; width:max-content; }
      #tdh-drop-card {
        position: relative; width: 292px; max-width: min(292px, calc(100vw - 76px));
        background:#18181b; border:1px solid #9147ff66; border-right:0;
        border-radius:12px 0 0 12px; box-shadow:0 8px 30px #0007; overflow:hidden;
      }
      #tdh-drop-card.collapsed { width: 270px; }
      #tdh-drop-card.collapsed .expanded-content { display:none; }
      #tdh-drop-card:not(.collapsed) .compact-line { display:none; }
      .compact-line { min-height:48px; padding:0 10px; display:grid; grid-template-columns:6px minmax(0,1fr) auto auto; gap:7px; align-items:center; }
      .compact-dot { width:6px; height:6px; border-radius:50%; background:#9147ff; }
      .compact-reward { font-size:10px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .compact-extra { font-size:9px; color:#b8b8c0; white-space:nowrap; }
      .state-pill { display:inline-flex; align-items:center; border:1px solid #34343a; border-radius:999px; padding:1px 5px; font-size:8px; font-weight:800; color:#d0d0d5; background:#1c1c21; white-space:nowrap; }
      .state-pill.good { color:#c8ffd7; border-color:#22c55e66; background:#22c55e18; }
      .state-pill.warn { color:#ffe5a8; border-color:#f59e0b66; background:#f59e0b18; }
      .state-pill.bad { color:#ffd1d1; border-color:#ef444466; background:#ef444418; }
      .card-collapse { position:absolute; top:4px; right:5px; width:22px; height:22px; border:1px solid #34343b; border-radius:6px; background:#151519; color:#adadb8; cursor:pointer; z-index:3; }
      .card-collapse:hover { border-color:#9147ff; color:#fff; }
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
      #tdh-settings-launcher {
        position:relative; width:48px; min-width:48px; min-height:48px; padding:0; margin:0;
        display:grid; place-items:center; border:1px solid #9147ff77; border-radius:0 12px 12px 0;
        background:#18181b; box-shadow:0 8px 30px #0007; cursor:grab; touch-action:none; user-select:none;
      }
      #tdh-settings-launcher:hover, #tdh-settings-launcher[aria-expanded="true"] { border-color:#9147ff; background:#202026; }
      #tdh-settings-launcher .ring { position:absolute; top:50%; left:50%; width:40px; height:40px; transform:translate(-50%,-50%); }
      .track { fill:none; stroke:#303038; stroke-width:3; }
      .fill { fill:none; stroke:#9147ff; stroke-width:3; stroke-linecap:round; transform:rotate(-90deg); transform-origin:18px 18px; transition:.2s stroke; }
      #tdh-settings-launcher .icon { width:22px; height:22px; pointer-events:none; position:relative; z-index:1; }
      #tdh-tools-dock {
        display:none; width:292px; max-width:calc(100vw - 24px); max-height:min(72vh,560px); overflow:auto;
        padding:9px; background:#111114; border:1px solid #2f2f35; border-radius:14px; box-shadow:0 18px 50px #0008; color-scheme:dark;
      }
      #tdh-tools-dock.fl-rail-open { display:block; }
      .menu-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
      .header-brand { display:flex; align-items:center; gap:9px; min-width:0; }
      .header-icon { width:48px; height:48px; flex:0 0 48px; }
      .header-icon svg { width:48px; height:48px; display:block; }
      .header-copy { min-width:0; }
      #tdh-rail-title { margin:0; font-size:15px; font-weight:800; line-height:1.1; }
      #tdh-rail-subtitle { margin-top:2px; font-size:9px; color:#adadb8; white-space:nowrap; }
      #tdh-rail-close { width:30px; height:30px; border:1px solid #3a3a42; border-radius:8px; background:#151519; color:#b8b8c0; cursor:pointer; font:18px/1 Arial,sans-serif; }
      #tdh-rail-close:hover { border-color:#9147ff; color:#fff; background:#211b2b; }
      .header-divider { height:1px; width:100%; margin:7px 0; background:linear-gradient(90deg,transparent,#9147ff88 50%,transparent); }
      .update-notice { position:relative; display:block; margin-bottom:8px; padding:10px; border:1px solid #9147ff70; border-radius:10px; background:linear-gradient(180deg,#9147ff1f,#18181d); box-shadow:0 8px 22px #0003; }
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
      .update-action, .update-dismiss, .life-btn { border:1px solid #34343b; border-radius:7px; background:#18181b; color:#efeff1; cursor:pointer; }
      .update-action { min-height:27px; padding:0 10px; border-color:#9147ff; background:#772ce8; font-size:9px; font-weight:800; }
      .update-dismiss { position:absolute; top:7px; right:7px; width:23px; height:23px; padding:0; border-color:transparent; background:transparent; color:#adadb8; font-size:15px; line-height:1; }
      .update-action:hover, .update-dismiss:hover, .life-btn:hover { border-color:#9147ff; color:#fff; }
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
      @media (max-width:700px) { #tdh-tools-dock { width:min(292px,calc(100vw - 24px)); } #tdh-drop-card { width:min(292px,calc(100vw - 76px)); } }
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
              <div class="header-copy"><h2 id="tdh-rail-title">Dropper</h2><div id="tdh-rail-subtitle">Twitch Drops: Track and Redeem</div></div>
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
              <button type="button" class="update-action" id="tdh-update-action">View Update</button>
            </div>
          </div>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Core Dropper Controls." data-panel="tdh-features-body"><span class="fl-tool-title">Features</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-features-body">
            ${switchHtml("tdh-claim-bonus", "Auto-Claim Bonus Chests", "Clicks Claim Bonus When The Chest Appears.", settings.claimBonus)}
            ${switchHtml("tdh-keep-tab", "Keep Tab Active", "Keeps Twitch From Pausing Or Throttling In The Background. Reload After Changing.", settings.keepTabActive)}
            ${switchHtml("tdh-claim-drops", "Auto-Claim Drops", "Claims Completed Twitch Drops When Twitch Reports Them As Claimable.", settings.claimDrops)}
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Optional Progress And Inventory Tools." data-panel="tdh-drops-body"><span class="fl-tool-title">Drops Extras</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-drops-body">
            ${switchHtml("tdh-progress-title", "Show Progress In Tab", "Shows Current Drop Progress In The Browser Tab Title.", settings.progressInTitle)}
            ${switchHtml("tdh-find-next", "Find Next Drops Stream", "Switches To Another Eligible Stream If Progress Stalls.", settings.findNextStream)}
            ${switchHtml("tdh-mute-next", "Mute Opened Streams", "Mutes Any Separate Stream Window Opened By Dropper.", settings.muteRestarted)}
            <button type="button" class="life-btn" id="tdh-toggle-inventory">Show Drops Inventory</button>
            <div class="compact-inventory" id="tdh-compact-inventory"><div class="inventory-head"><div><strong>Campaign Drops</strong><span id="tdh-inventory-game"></span></div></div><div class="inventory-list" id="tdh-inventory-list"></div></div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Maintain Backup Drops Channels Without Opening Extra Tabs." data-panel="tdh-queue-body"><span class="fl-tool-title">Stream Queue</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-queue-body">
            ${switchHtml("tdh-queue-enabled", "Maintain Backup Streams", "Keeps A Short List Of Eligible Backup Drops Channels Ready.", settings.queueEnabled)}
            <div class="mini-row"><span>Standby Streams</span><select class="select-lite" id="tdh-queue-count"><option value="1">1</option><option value="3">3</option><option value="5">5</option></select></div>
            ${switchHtml("tdh-queue-stall", "Switch On Stall", "Switches The Current Tab When Credited Progress Stalls.", settings.queueOnStall)}
            ${switchHtml("tdh-queue-offline", "Switch On Offline", "Switches The Current Tab When The Active Stream Goes Offline.", settings.queueOnOffline)}
            <div class="mini-row"><span>Channel Preference</span><select class="select-lite" id="tdh-queue-preference"><option>Any Eligible</option><option>Lowest Viewers</option><option>Highest Viewers</option></select></div>
            <div class="compact-inventory open queue-list"><div class="inventory-head"><div><strong>Active + Standby</strong><span id="tdh-queue-summary"></span></div></div><div class="inventory-list" id="tdh-queue-list"></div></div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header has-tooltip" data-tip="Background Earning, Interface Preferences, Notifications, Diagnostics, And Shortcuts." data-panel="tdh-advanced-body"><span class="fl-tool-title">Advanced</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-advanced-body">
            ${switchHtml("tdh-background-earning", "Background Earning Mode", "Monitors Twitch-Credited Minutes While The Stream Is In The Background.", settings.backgroundEarning)}
            ${switchHtml("tdh-auto-hide", "Auto-Hide Card", "Collapses The Progress Card After A Short Delay.", settings.autoHideCard)}
            ${switchHtml("tdh-reduce-motion", "Reduce Motion", "Disables Dropper Interface Animations.", settings.reduceMotion)}
            ${switchHtml("tdh-notifications", "Notifications", "Shows Brief Dropper Notices For Important State Changes.", settings.notifications)}
            <div class="mini-row"><span>Pause Auto-Switch</span><select class="select-lite" id="tdh-pause-switch"><option value="0">Off</option><option value="30">30 Min</option><option value="60">1 Hour</option></select></div>
            <button type="button" class="life-btn" id="tdh-refresh-now">Refresh Drop State</button>
            <button type="button" class="life-btn" id="tdh-diagnostics-toggle">Show Diagnostics</button><div class="diag" id="tdh-diagnostics"></div>
          </div></section>
        </aside>
        <div class="badge-row">
          <section id="tdh-drop-card" aria-live="polite">
            <button type="button" class="card-collapse" id="tdh-card-collapse" aria-label="Collapse Progress Card">−</button>
            <div class="compact-line" id="tdh-compact-line"><span class="compact-dot" id="tdh-compact-dot"></span><span class="compact-reward" id="tdh-compact-reward">Waiting For Drop</span><span class="compact-extra" id="tdh-compact-extra"></span><span class="state-pill" id="tdh-compact-state">Idle</span></div>
            <div class="expanded-content">
              <div class="stream-info stream-info-hidden" id="tdh-stream-info"><img class="stream-avatar" id="tdh-stream-avatar" alt="" hidden><div><div class="stream-head"><div class="stream-channel" id="tdh-stream-channel"></div><span class="stream-live" id="tdh-stream-live" hidden>LIVE</span></div><div class="stream-game" id="tdh-stream-game" hidden></div><div class="stream-badges" id="tdh-stream-badges"></div></div><div class="stream-title" id="tdh-stream-title" hidden></div></div>
              <div class="drop-section"><div class="drop-kicker">Working Toward</div><div class="drop-head"><div class="drop-name" id="tdh-drop-name">Looking For An Active Drop…</div></div><div class="drop-game" id="tdh-drop-game"></div><div class="drop-bar-row"><div class="drop-bar"><span id="tdh-drop-fill"></span></div><div class="drop-percent" id="tdh-drop-percent">0%</div></div><div class="drop-meta" id="tdh-drop-meta"></div><div class="drop-status-row"><span class="state-pill" id="tdh-drop-state">Idle</span><span id="tdh-updated-ago"></span></div></div>
            </div>
          </section>
          <button type="button" id="tdh-settings-launcher" aria-controls="tdh-tools-dock" aria-expanded="false" aria-label="Open Dropper Settings" data-userscript-launcher="userscript-launcher-v1" data-launcher-id="dropper" data-launcher-preferred-position="right-bottom">
            <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="track" cx="18" cy="18" r="15"></circle><circle class="fill" id="tdh-ring" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="0 100"></circle></svg>
            <svg class="icon" viewBox="0 0 1024 1024" aria-hidden="true"><polygon points="494,210 285,500 430,590" fill="#D9B5FF"/><polygon points="494,210 430,590 494,470" fill="#9B5AF9"/><polygon points="285,500 285,685 430,590" fill="#8C39F2"/><polygon points="285,685 494,842 430,590" fill="#5417B3"/><polygon points="430,590 494,470 494,842" fill="#7428E8"/><polygon points="530,210 739,500 594,590" fill="#AEB0C2"/><polygon points="530,210 594,590 530,470" fill="#6A6E87"/><polygon points="739,500 739,685 594,590" fill="#4E5268"/><polygon points="739,685 530,842 594,590" fill="#242633"/><polygon points="594,590 530,470 530,842" fill="#3F4254"/><rect x="502" y="205" width="20" height="650" rx="10" fill="#101017"/></svg>
          </button>
        </div>
      </div>`;
    document.documentElement.appendChild(host);
    ui = { host, shadow, cluster: shadow.getElementById("tdh-cluster"), launcher: shadow.getElementById("tdh-settings-launcher"), dock: shadow.getElementById("tdh-tools-dock") };
    if (!clusterTop) clusterTop = window.innerHeight - 88;
    bindDrag();
    bindSwitches();
    bindPanels();
    bindDropperControls();
    renderSwitches();
    applyMotionSetting();
    refreshDropCard();
    refreshQueueList();
    layoutChrome();
    ui.launcher.addEventListener("click", () => setRailOpen(!railOpen));
    shadow.getElementById("tdh-rail-close").addEventListener("click", () => setRailOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.altKey && (event.key === "g" || event.key === "G") && !event.repeat) { event.preventDefault(); setRailOpen(!railOpen, true); }
      if (event.key === "Escape" && railOpen) setRailOpen(false, true);
      if (!event.altKey && (event.key === "r" || event.key === "R") && railOpen) pollGqlDrops();
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

  function discoverQueueCandidates() {
    const seen = new Set();
    const items = [];
    const add = (href, label = "") => {
      if (!href || !isTrustedTwitchUrl(href)) return;
      try {
        const parsed = new URL(href, location.href);
        const login = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
        if (!login || RESERVED.has(login) || seen.has(login) || login === watchingLogin()) return;
        seen.add(login);
        const cleanLabel = cleanText(label) || login;
        const viewerMatch = cleanLabel.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
        const viewers = viewerMatch ? Number(viewerMatch[1].replace(/,/g, "")) || 0 : 0;
        items.push({ login, href: parsed.href, label: cleanLabel, viewers });
      } catch (_) { /* ignore */ }
    };
    document.querySelectorAll("[data-test-selector='DropsCampaignInProgressDescription-hint-text-parent'] a, [data-test-selector='DropsCampaignInProgressDescription-no-channels-hint-text'] a, a[href*='twitch.tv/']").forEach((node) => add(node.href, node.textContent));
    if (settings.queuePreference === "Lowest Viewers") items.sort((a, b) => (a.viewers || Number.MAX_SAFE_INTEGER) - (b.viewers || Number.MAX_SAFE_INTEGER));
    if (settings.queuePreference === "Highest Viewers") items.sort((a, b) => (b.viewers || 0) - (a.viewers || 0));
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
    candidates.forEach((item, index) => appendQueueItem(list, item.label, item.viewers ? `Standby ${index + 1} · ${item.viewers} Viewers` : `Standby ${index + 1}`, "Eligible", false));
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

  function syncCompactState() {
    if (!ui) return;
    const reward = ui.shadow.getElementById("tdh-compact-reward");
    const extra = ui.shadow.getElementById("tdh-compact-extra");
    const state = ui.shadow.getElementById("tdh-compact-state");
    const detail = ui.shadow.getElementById("tdh-drop-state");
    const updated = ui.shadow.getElementById("tdh-updated-ago");
    const staleMs = Date.now() - lastProgressAt;
    let label = "Idle", cls = "state-pill";
    if (!getToken()) { label = "Login Required"; cls += " warn"; }
    else if (currentDrop?.percent >= 100) { label = currentDrop.isClaimed ? "Claimed ✓" : "Claim Ready"; cls += " good"; }
    else if (currentDrop && staleMs > 5 * 60 * 1000) { label = "Stalled"; cls += " warn"; }
    else if (currentDrop && settings.backgroundEarning) { label = "BG Earning"; cls += " good"; }
    else if (currentDrop) { label = "Earning"; cls += " good"; }
    if (reward) reward.textContent = currentDrop?.name || "Waiting For Drop";
    if (extra) extra.textContent = currentDrop ? `${currentDrop.percent || 0}% · ${Math.max(0, currentDrop.remainingMinutes || 0)}m` : "";
    if (state) { state.textContent = label; state.className = cls; }
    if (detail) { detail.textContent = label; detail.className = cls; }
    if (updated) updated.textContent = currentDrop ? `Updated ${Math.max(0, Math.floor(staleMs / 1000))}s Ago` : "";
    const dot = ui.shadow.getElementById("tdh-compact-dot");
    if (dot) dot.style.background = label === "Stalled" ? "#f59e0b" : label.includes("Earning") || label.includes("Claim") ? "#22c55e" : "#9147ff";
  }

  function applyMotionSetting() {
    ui?.cluster?.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
  }

  function scheduleAutoHide() {
    clearTimeout(autoHideTimer);
    if (!settings.autoHideCard || !ui) return;
    autoHideTimer = setTimeout(() => ui.shadow.getElementById("tdh-drop-card")?.classList.add("collapsed"), 6000);
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
    s.getElementById("tdh-card-collapse")?.addEventListener("click", () => {
      const card = s.getElementById("tdh-drop-card");
      const collapsed = card.classList.toggle("collapsed");
      s.getElementById("tdh-card-collapse").textContent = collapsed ? "+" : "−";
      requestAnimationFrame(layoutChrome);
    });
    s.getElementById("tdh-refresh-now")?.addEventListener("click", () => pollGqlDrops());
    const diag = s.getElementById("tdh-diagnostics");
    s.getElementById("tdh-diagnostics-toggle")?.addEventListener("click", (event) => {
      diag.classList.toggle("open");
      event.currentTarget.textContent = diag.classList.contains("open") ? "Hide Diagnostics" : "Show Diagnostics";
      diag.textContent = JSON.stringify(dropperDebugSnapshot(), null, 2);
      requestAnimationFrame(layoutChrome);
    });
    const queueCount = s.getElementById("tdh-queue-count"); queueCount.value = String(settings.queueCount); queueCount.addEventListener("change", () => { settings.queueCount = Number(queueCount.value); saveSettings(); refreshQueueList(); });
    const pref = s.getElementById("tdh-queue-preference"); pref.value = settings.queuePreference; pref.addEventListener("change", () => { settings.queuePreference = pref.value; saveSettings(); refreshQueueList(); });
    const pause = s.getElementById("tdh-pause-switch"); pause.value = String(settings.pauseAutoSwitchMinutes || 0); pause.addEventListener("change", () => { settings.pauseAutoSwitchMinutes = Number(pause.value); pauseAutoSwitchUntil = settings.pauseAutoSwitchMinutes ? Date.now() + settings.pauseAutoSwitchMinutes * 60000 : 0; saveSettings(); });
    const card = s.getElementById("tdh-drop-card"); card.addEventListener("mouseenter", () => { if (settings.autoHideCard) card.classList.remove("collapsed"); clearTimeout(autoHideTimer); }); card.addEventListener("mouseleave", scheduleAutoHide);
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
    };
    if (!ui) { updateNoticeState = state; return; }

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

    const button = ui.shadow.getElementById("tdh-update-action");
    button.textContent = actionText;
    button.onclick = action || hideUpdateNotice;
    notice.hidden = false;
    updateNoticeState = state;
    requestAnimationFrame(layoutChrome);
  }

  function hideUpdateNotice() {
    const notice = ui?.shadow?.getElementById("tdh-update-notice"); if (notice) notice.hidden = true;
    updateNoticeState = null;
  }

  function checkVersionNotice() {
    const previous = localStorage.getItem(LAST_VERSION_KEY);
    if (previous && previous !== APP_VERSION) {
      showUpdateNotice(
        "Dropper Updated",
        `Updated from v${previous} to v${APP_VERSION}.`,
        "Got It",
        hideUpdateNotice,
        { kicker: "Update Complete", version: APP_VERSION, details: CURRENT_CHANGELOG },
      );
    }
    localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
  }

  function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) { const diff = (pa[i] || 0) - (pb[i] || 0); if (diff) return diff; }
    return 0;
  }

  function scheduleUpdateCheck() {
    const last = Number(localStorage.getItem(UPDATE_CHECK_KEY) || 0);
    if (Date.now() - last < 6 * 60 * 60 * 1000 || typeof GM_xmlhttpRequest !== "function") return;
    localStorage.setItem(UPDATE_CHECK_KEY, String(Date.now()));
    GM_xmlhttpRequest({ method:"GET", url:UPDATE_URL, timeout:12000, onload(response) {
      const remote = String(response.responseText || "");
      const match = remote.match(/^\/\/ @version\s+([^\s]+)/m);
      if (match && compareVersions(match[1], APP_VERSION) > 0) {
        showUpdateNotice(
          "New Dropper Version Available",
          `v${match[1]} is ready to install.`,
          "Open Update",
          () => window.open("https://github.com/ExtraPotions/Dropper", "_blank", "noopener"),
          {
            kicker: "Update Available",
            version: match[1],
            details: [
              "A newer Dropper build is available.",
              "Open the update page to review and install the latest version.",
            ],
          },
        );
      }
    }, onerror() {}, ontimeout() {} });
  }

  function dropperDebugSnapshot() {
    return { version:APP_VERSION, tokenCaptured:Boolean(getToken()), deviceCaptured:Boolean(capturedDevice || cookie("unique_id")), watchingLogin:watchingLogin(), currentDrop, lastProgress, lastProgressAt:new Date(lastProgressAt).toISOString(), queueEnabled:settings.queueEnabled, queueCandidates:discoverQueueCandidates().map((item) => item.login), autoSwitchPaused:isAutoSwitchPaused(), statusText };
  }

  function layoutChrome() {
    if (!ui?.cluster) return;
    const row = ui.cluster.querySelector(".badge-row");
    const rowHeight = row?.offsetHeight || 56;
    const menuHeight = railOpen ? ui.dock.scrollHeight || ui.dock.offsetHeight || 280 : 0;
    const gap = railOpen ? 8 : 0;
    const spaceBelow = window.innerHeight - clusterTop - rowHeight - 8;
    const spaceAbove = clusterTop - 8;
    const openUp = railOpen && menuHeight > 0 && spaceBelow < menuHeight + 12 && spaceAbove >= spaceBelow;
    ui.cluster.classList.toggle("open-up", openUp);
    const clusterHeight = rowHeight + gap + (railOpen ? menuHeight : 0);
    let top = openUp ? clusterTop - menuHeight - gap : clusterTop;
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

  function setRailOpen(open, focus) {
    railOpen = open;
    ui.dock.classList.toggle("fl-rail-open", open);
    ui.launcher.setAttribute("aria-expanded", String(open));
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
      "tdh-background-earning": "backgroundEarning", "tdh-auto-hide": "autoHideCard", "tdh-reduce-motion": "reduceMotion", "tdh-notifications": "notifications",
      "tdh-queue-enabled": "queueEnabled", "tdh-queue-stall": "queueOnStall", "tdh-queue-offline": "queueOnOffline",
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
        if (key === "autoHideCard") scheduleAutoHide();
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
      "tdh-background-earning": settings.backgroundEarning, "tdh-auto-hide": settings.autoHideCard, "tdh-reduce-motion": settings.reduceMotion, "tdh-notifications": settings.notifications,
      "tdh-queue-enabled": settings.queueEnabled, "tdh-queue-stall": settings.queueOnStall, "tdh-queue-offline": settings.queueOnOffline,
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