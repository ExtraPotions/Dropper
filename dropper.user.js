// ==UserScript==
// @name         Dropper
// @namespace    twitch-drops-helper
// @version      2.5.0
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
  const APP_VERSION = "2.5.0";
  const LAST_VERSION_KEY = "dropper-last-version";
  const UPDATE_CHECK_KEY = "dropper-update-check-at";
  const UPDATE_URL = "https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js";
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

  function pickTimedDrop(campaigns, gameName) {
    const now = Date.now();
    const wantedGame = (gameName || "").toLowerCase();
    const options = [];
    for (const campaign of campaigns || []) {
      const game = campaign.game?.displayName || campaign.game?.name || campaign.name || "";
      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed) continue;
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