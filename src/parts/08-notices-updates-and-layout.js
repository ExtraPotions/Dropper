  function notifyUser(text) {
    if (!ui) return;
    const toast = ui.shadow.getElementById("tdh-toast");
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(notifyUser.timer);
    notifyUser.timer = setTimeout(() => { toast.hidden = true; }, 3000);
    requestAnimationFrame(layoutChrome);
  }

  function browserNotificationApi() {
    return globalThis.Notification || page?.Notification || null;
  }

  async function requestBrowserNotificationPermission() {
    const Api = browserNotificationApi();
    if (!Api) return 'unsupported';
    if (Api.permission === 'granted' || Api.permission === 'denied') return Api.permission;
    try { return await Api.requestPermission(); } catch (_) { return 'denied'; }
  }

  function notificationQuietState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(scopedLocalStorageKey(NOTIFICATION_STATE_KEY)) || '{"events":{}}');
      const events = parsed && typeof parsed.events === 'object' && !Array.isArray(parsed.events) ? parsed.events : {};
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      return { events: Object.fromEntries(Object.entries(events).filter(([, at]) => Number(at || 0) >= cutoff).slice(-50)) };
    } catch (_) {
      return { events: {} };
    }
  }

  function saveNotificationQuietState(state) {
    if (typeof productResetting !== 'undefined' && productResetting) return;
    try { localStorage.setItem(scopedLocalStorageKey(NOTIFICATION_STATE_KEY), JSON.stringify(state)); } catch (_) {}
  }

  function sendBrowserNotification(kind, title, body, { tag = kind, cooldownMs = 0 } = {}) {
    const enabled = kind === 'claimed'
      ? settings.notifyClaimed
      : kind === 'ending'
        ? settings.notifyCampaignEnding
        : kind === 'stalled'
          ? settings.notifyStalledProgress
          : kind === 'switch'
            ? settings.notifyStreamSwitches
            : false;
    if (!enabled || ExtraPotionsCore.suiteSitePaused?.() || interruptionRuleReason()==='Quiet Hours') return false;
    if (settings.notifyOnlyWhenHidden && !document.hidden) return false;
    const Api = browserNotificationApi();
    if (!Api || Api.permission !== 'granted') return false;
    const now = Date.now();
    const key = `${kind}:${tag}`;
    const quiet = notificationQuietState();
    const last = Number(quiet.events[key] || 0);
    const configuredCooldownMs = Math.max(0, Number(settings.notificationCooldownMinutes || 0)) * 60 * 1000;
    const effectiveCooldownMs = Math.max(Math.max(0, Number(cooldownMs) || 0), configuredCooldownMs);
    if (effectiveCooldownMs && now - last < effectiveCooldownMs) return false;
    try {
      const notice = new Api(title, {
        body: cleanText(body).slice(0, 220),
        tag: `dropper-${tag}`,
        renotify: false,
        silent: false,
      });
      quiet.events[key] = now;
      saveNotificationQuietState(quiet);
      setTimeout(() => { try { notice.close(); } catch (_) {} }, 12000);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function syncAutoPictureInPicture(reason = '') {
    const video = streamVideoElement();
    const active = document.pictureInPictureElement;
    const owns = Boolean(syncAutoPictureInPicture.owns);
    if (ExtraPotionsCore.suiteSitePaused?.() || !settings.autoPictureInPicture || !document.hidden) {
      if (owns && active && typeof document.exitPictureInPicture === 'function') {
        try { await document.exitPictureInPicture(); } catch (_) {}
      }
      syncAutoPictureInPicture.owns = false;
      return false;
    }
    if (!video || typeof video.requestPictureInPicture !== 'function' || document.pictureInPictureEnabled === false) return false;
    if (active === video) return true;
    try {
      await video.requestPictureInPicture();
      syncAutoPictureInPicture.owns = true;
      syncAutoPictureInPicture.lastError = '';
      logActivity('picture-in-picture', 'Entered Picture-in-Picture because the Twitch tab became hidden', { reason: reason || 'hidden' });
      return true;
    } catch (error) {
      const message = cleanText(error?.message || error || 'Picture-in-Picture unavailable');
      if (message !== syncAutoPictureInPicture.lastError) {
        syncAutoPictureInPicture.lastError = message;
        logActivity('picture-in-picture', 'Automatic Picture-in-Picture was unavailable', { reason: reason || 'hidden', message });
      }
      return false;
    }
  }

  function checkCampaignDeadlineNotification(now = Date.now()) {
    if (!settings.notifyCampaignEnding || !currentDrop) return false;
    const state = activeRewardEligibility();
    const minutes = Number(state?.deadline?.minutesUntilDeadline);
    if (!Number.isFinite(minutes) || minutes > 30 || minutes < 0) return false;
    const bucket = minutes <= 10 ? '10' : '30';
    const campaign = cleanText(currentDrop.campaignKey || currentDrop.campaignId || currentDrop.campaign || currentDrop.game || 'campaign');
    const signature = `${campaign}:${bucket}`;
    if (checkCampaignDeadlineNotification.signature === signature) return false;
    const required = Number(state?.deadline?.requiredMinutes);
    const sent = sendBrowserNotification(
      'ending',
      `Dropper · Campaign ending in ${Math.max(0, Math.round(minutes))} min`,
      Number.isFinite(required)
        ? `${currentDrop.game || currentDrop.campaign || 'Current campaign'} · ${Math.max(0, Math.round(required))} min watch remaining`
        : `${currentDrop.game || currentDrop.campaign || 'Current campaign'} is close to its deadline.`,
      { tag: `ending-${signature}` },
    );
    if (sent) checkCampaignDeadlineNotification.signature = signature;
    return sent;
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
    if (typeof productResetting !== 'undefined' && productResetting) return;
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

    if (!state.leftAt) {
      clearUpdateReloadState("Update installer was not detected; automatic refresh cancelled");
      setStatus("Update Refresh Cancelled · Reload Twitch After Installing");
      return false;
    }

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
    if (!version || compareVersions(version, APP_VERSION) <= 0) return false;

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
      installUrl: updateChecker.INSTALL_URL,
      fallbackSeconds: Math.round(UPDATE_RELOAD_FALLBACK_MS / 1000),
      expiresSeconds: Math.round(UPDATE_RELOAD_PENDING_TTL_MS / 1000),
    });

    scheduleUpdateReloadFallback();
    setStatus("Update Installer Opened · Return To Twitch After Reinstalling");
    return true;
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

  function placeUpdateNotice() {
    if (!ui) return;
    const notice = ui.shadow.getElementById("tdh-update-notice");
    if (!notice) return;
    notice.dataset.placement = "menu";
    delete notice.dataset.expFloatingNotice;
    for (const property of ["left", "right", "top", "bottom", "width"]) {
      notice.style.removeProperty(property);
    }
    if (notice.parentElement !== ui.cluster) ui.cluster.appendChild(notice);
  }

  function noticePanelWidth() {
    return ExtraPotionsCore.menuWidth();
  }

  function positionMenuUpdateNotice() {
    if (!ui) return;
    const notice = ui.shadow.getElementById("tdh-update-notice");
    if (!notice || notice.hidden) return;
    const width = Math.min(noticePanelWidth(), Math.max(0, window.innerWidth - 24));
    notice.style.setProperty("width", `${width}px`, "important");
    // exp-core owns notice placement: beyond an open menu, above the progress card, or beside the launchers.
    ExtraPotionsCore.placeNotice(ui.host, notice, railOpen ? ui.dock : null);
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
      actionUrl: options.actionUrl || "",
      placement: "menu",
    };
    if (!ui) { updateNoticeState = state; return; }

    clearTimeout(updateNoticeTimer);
    placeUpdateNotice();
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
    if (hasDistinctAction && state.actionUrl) {
      button.href = state.actionUrl;
      button.target = "_blank";
      button.rel = "noopener noreferrer";
    } else {
      button.removeAttribute("href");
    }
    button.onclick = hasDistinctAction
      ? (event) => {
          if (!state.actionUrl) event.preventDefault();
          action(event);
        }
      : null;

    notice.hidden = false;
    updateNoticeState = state;
    requestAnimationFrame(() => { layoutChrome(); });

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
    requestAnimationFrame(() => { layoutChrome(); });
  }

  // Update checks come from exp-core, like every other ExtraPotions product: a small lookup of the latest
  // GitHub release (and its highlights) instead of downloading the whole script from the main branch.
  const updateChecker = ExtraPotionsCore.createReleaseUpdateChecker({
    productId: "dropper",
    repository: "ExtraPotions/Dropper",
    currentVersion: APP_VERSION,
  });

  // The checker's cached result under the names the rest of Dropper already reads.
  function loadUpdateState() {
    const status = updateChecker.status();
    return {
      checkedForVersion: status.checkedForVersion || "",
      lastCheckAt: Number(status.checkedAt || 0),
      lastRemoteVersion: status.lastRemoteVersion || "",
      lastHttpStatus: Number(status.lastHttpStatus || 0),
      lastError: status.lastError || "",
      availableVersion: status.available ? status.latest : "",
      availableAt: status.available ? Number(status.checkedAt || 0) : 0,
    };
  }

  function markUpdateAvailable(version, details = []) {
    if (!ui || !version || compareVersions(version, APP_VERSION) <= 0) return;

    const alreadyAnnounced = lastUpdateNoticeVersion === version;
    ui.launcher?.classList.add("update-available");
    if (ui.launcher) {
      ui.launcher.removeAttribute("title");
      ui.launcher.setAttribute("aria-label", `Open Dropper Settings · Update v${version} Available`);
    }

    if (alreadyAnnounced) return;
    lastUpdateNoticeVersion = version;
    if (!claimNotice(`available:${version}`)) return;

    showUpdateNotice(
      "New Dropper Version Available",
      `v${version} is ready to install.`,
      "Install Update",
      () => beginUpdateInstall(version),
      {
        kicker: "Update Available",
        version,
        details: details.length ? details.slice(0, 4) : [
          "A newer Dropper build is available.",
          "Install the latest userscript to get the newest fixes and improvements.",
          "After reinstalling, return to Twitch and Dropper will refresh this page automatically.",
        ],
        actionUrl: updateChecker.INSTALL_URL,
        placement: "menu",
      },
    );

    notifyUser(`Dropper v${version} Update Available`);
  }

  function clearUpdateAvailableIndicator() {
    lastUpdateNoticeVersion = "";
    ui?.launcher?.classList.remove("update-available");
    if (ui?.launcher) {
      ui.launcher.removeAttribute("title");
      ui.launcher.setAttribute("aria-label", "Open Dropper Settings");
    }
  }

  function checkCachedUpdateNotice() {
    const status = updateChecker.status();
    if (status.available && status.latest) {
      markUpdateAvailable(status.latest, status.details);
      return true;
    }
    clearUpdateAvailableIndicator();
    return false;
  }

  function checkVersionNotice() {
    clearUpdateAvailableIndicator();

    const previous = localStorage.getItem(LAST_VERSION_KEY);
    if (previous && previous !== APP_VERSION && claimNotice(`updated:${APP_VERSION}`)) {
      showUpdateNotice(
        "Dropper Updated",
        `Updated from v${previous} to v${APP_VERSION}.`,
        "",
        null,
        { kicker: "Update Complete", version: APP_VERSION, details: RELEASE_NOTES[APP_VERSION] || [], placement: "menu" },
      );
    }
    localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
    // Older builds kept their own copy of the update state; exp-core owns it now.
    try { localStorage.removeItem("dropper-update-state-v2"); } catch (_) { /* ignore */ }
    checkCachedUpdateNotice();
  }

  const compareVersions = (a, b) => ExtraPotionsCore.compareVersions(a, b);

  function scheduleUpdateCheck(force = false) {
    if (typeof GM_xmlhttpRequest !== "function") return;
    updateChecker.check(force).then((result) => {
      if (result.available && result.latest) {
        if (lastUpdateNoticeVersion !== result.latest) {
          logActivity("update", `Dropper v${result.latest} is available`, {
            installedVersion: APP_VERSION,
            remoteVersion: result.latest,
          });
        }
        markUpdateAvailable(result.latest, result.details);
      } else if (result.latest) {
        clearUpdateAvailableIndicator();
      } else if (result.state === "failed" && result.lastError) {
        logActivity("update-error", result.lastError);
      }
    }).catch((error) => logActivity("update-error", cleanText(error?.message || "Update check failed")));
  }

  function selectorHealthSnapshot() {
    const streamRoot = document.querySelector("#live-channel-stream-information");
    const login = watchingLogin();
    return {
      video: Boolean(login && document.querySelector("video")),
      streamInfo: Boolean(streamRoot),
      dropsEnabledTag: Boolean(login && streamRoot && streamHasDropsEnabledTag(streamRoot)),
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
    clearSkipStreamerArm("session-reset");
    [
      NEXT_GAME_KEY,
      ROUTING_SESSION_KEY,
      NAVIGATION_GUARD_KEY,
      NAVIGATION_FLIGHT_KEY,
      STANDBY_CACHE_KEY,
      STANDBY_REFRESH_KEY,
      STANDBY_MAINTENANCE_KEY,
      VIEWING_SELECTION_KEY,
      MUTE_PENDING_KEY,
      CAMPAIGN_CATALOG_KEY,
      CAMPAIGN_PAGE_IMPORT_KEY,
      "tdh-drop",
      "tdh-progress",
      "tdh-progress-at",
      "dropper-credited-progress-at-v1",
    ].forEach((key) => {
      removeSession(key);
    });

    currentDrop = null;
    clearRecoverySnapshot('manual-session-reset');
    lastSessionRecovery = null;
    campaignCatalogCache = { at: 0, campaigns: [] };
    lastCampaignCatalog = [];
    lastCampaignCatalogAt = 0;
    lastInventoryCampaigns = [];
    inventoryResponseHealth = { valid: false, status: 'not-seen', at: 0, lastValidAt: 0, source: '', shape: null };
    rewardSessionResolution = null;
    campaignDetailsAttempts.clear();
    campaignDetailsMisses.clear();
    campaignDetailsCache.clear();
    lastInProgressKeys = new Set();
    haveSeenInventorySnapshot = false;

    standbyCache = [];
    lastStandbyRefreshAt = 0;
    lastStandbyMaintenanceAt = 0;
    lastStandbyMaintenance = null;
    lastRoutingCandidateSnapshot = {
      at: 0,
      game: "",
      gameSlug: "",
      campaignKey: "",
      allowListPresent: false,
      visible: [],
    };

    lastProgress = 0;
    lastProgressAt = 0;
    progressLabel = "";
    lastProgressReconcile = null;

    lastStreamVerification = null;
    finalVerificationPollTarget = "";
    finalVerificationPollAt = 0;
    lastStreamSwitch = 0;
    streamOfflineSince = 0;
    categoryMismatchSince = 0;
    categoryMismatchSignature = "";

    lastCheckedAt = 0;
    lastCheckedLogin = "";
    watchClock = { login: "", started: 0 };

    duplicateNavigationSkips = 0;
    lastGqlPollAt = 0;
    nextGqlPollAt = 0;
    pendingGqlReason = "session-reset";

    resetClaimReadyTimer();

    logActivity("diagnostics", "Transient Dropper session and routing state reset");
    setStatus("Session Reset · Rebuilding Drop State");
    refreshDropCard();
    queueGqlPollSoon("session-reset", GQL_MIN_GAP_MS);
  }

  function campaignMemoryDiagnosticsSample(now = Date.now(), limit = 12) {
    const entries = Object.entries(campaignMemory?.campaigns || {});
    const sample = [];
    const seen = new Set();
    const summarize = ([key, item]) => ({
      key,
      name: item?.name || null,
      game: item?.game || null,
      startAt: item?.startAt || null,
      endAt: item?.endAt || null,
      status: item?.status || null,
      completedAt: item?.completedAt ? new Date(item.completedAt).toISOString() : null,
    });
    const add = (entry) => {
      if (!entry || sample.length >= limit) return;
      const key = entry[0];
      if (!key || seen.has(key)) return;
      seen.add(key);
      sample.push(summarize(entry));
    };

    const activeKey = cleanText(currentDrop?.campaignKey || currentDrop?.campaignId || "").toLowerCase();
    const activeGame = campaignTitleKey(currentDrop?.game || "");
    if (activeKey) add(entries.find(([key]) => cleanText(key).toLowerCase() === activeKey));
    if (activeGame) {
      entries
        .filter(([, item]) => !item?.completedAt && campaignTitleKey(item?.game || "") === activeGame)
        .sort((a, b) => (Date.parse(a[1]?.endAt || "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b[1]?.endAt || "") || Number.MAX_SAFE_INTEGER))
        .slice(0, 3)
        .forEach(add);
    }

    entries
      .filter(([, item]) => {
        if (!item || item.completedAt) return false;
        const endMs = Date.parse(item.endAt || "") || 0;
        return !endMs || endMs > now;
      })
      .sort((a, b) => (Date.parse(a[1]?.endAt || "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b[1]?.endAt || "") || Number.MAX_SAFE_INTEGER))
      .forEach(add);

    entries
      .filter(([, item]) => Boolean(item?.completedAt))
      .sort((a, b) => Number(b[1]?.completedAt || 0) - Number(a[1]?.completedAt || 0))
      .slice(0, 4)
      .forEach(add);

    return sample.slice(0, limit);
  }

  function diagnosticsText() {
    return JSON.stringify(ExtraPotionsCore.createDiagnosticsReport("Dropper", { ...dropperDebugSnapshot(), host: ui?.host, shadow: ui?.shadow }), null, 2);
  }

  function dropperDebugSnapshot() {
    const now = Date.now();
    pruneIgnoredCampaignGames(now);
    const routingSession = readRoutingControllerSession();
    const card = ui?.shadow?.getElementById("tdh-drop-card");
    const launcher = ui?.launcher || null;
    const launcherRow = ui?.shadow?.querySelector(".badge-row") || null;
    const notice = ui?.shadow?.getElementById("tdh-update-notice") || null;
    const rectSnapshot = (node) => {
      if (!node?.getBoundingClientRect) return null;
      const rect = node.getBoundingClientRect();
      if (!rect.width && !rect.height) return null;
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    };
    const chat = findTwitchChatColumn();
    const circuit = networkCircuitSnapshot(now);
    const memoryEntries = Object.entries(campaignMemory?.campaigns || {});
    const diagnosticMemorySample = campaignMemoryDiagnosticsSample(now, 12);
    const activityEntries = Array.isArray(activityLog) ? activityLog : [];
    const diagnosticActivity = activityEntries.slice(-12);
    const diagnosticQueueCandidates = discoverQueueCandidates(now);
    return {
      report: "Dropper Diagnostics",
      progressTimeline:progressTimelineSnapshot(),
      recoveryNavigation:recoveryNavigationState(),
      build: "reward-data-r2",
      version: APP_VERSION,
      accountScope: {
        login: twitchSessionLogin() || null,
        storageSuffix: storageAccountSuffix(),
        sessionScoped: true,
        campaignMemoryScoped: true,
        ignoredCampaignGamesScoped: true,
        tabCoordinationScoped: true,
      },
      topLevelContext: window.top === window.self,
      playerPresentation: playerPresentationSnapshot(),
      headerVersionControl: Boolean(ui?.shadow?.getElementById("tdh-header-version")),
      launcherGrid: {
        slot: ui?.host?.dataset?.launcherSlot || null,
        offset: ui?.host ? getComputedStyle(ui.host).getPropertyValue("--exp-launcher-offset").trim() : null,
        manualDelta: launcherGridDelta,
      },
      autoDismiss: {
        menuSeconds: Math.round((ui?.menuController?.idleTimeoutMs || 15000) / 1000),
        menuTimerActive: Boolean(ui?.menuController?.timerActive),
        menuDismissAt: ui?.menuController?.dismissAt ? new Date(ui.menuController.dismissAt).toISOString() : null,
        menuRemainingSeconds: ui?.menuController?.dismissAt ? Math.max(0, Math.ceil((ui.menuController.dismissAt - now) / 1000)) : null,
      },
      updateNoticePlacement: ui?.shadow?.getElementById("tdh-update-notice")?.dataset?.placement || null,
      generatedAt: new Date(now).toISOString(),
      tokenCaptured: Boolean(getToken()),
      tokenSource: tokenSourceLabel(),
      twitchLogin: twitchSessionLogin() || null,
      deviceCaptured: Boolean(cookie("unique_id")),
      watchingLogin: watchingLogin(),
      currentDrop,
      viewing: { ...viewingIntent.snapshot(), screenWakeLock: Boolean(screenWakeLock), navigationBlocked: lastViewingNavigationBlock || null },
      claims: { history: claimLedger().snapshot(), selectors: claimSelectorHealthSnapshot(now), crossTabLock: navigator.locks?.request ? 'web-locks' : 'local-storage-lease', scanMinimumMs: CLAIM_SCAN_MIN_INTERVAL_MS, lastScanAt: lastClaimScanAt ? new Date(lastClaimScanAt).toISOString() : null, inventorySweep: { ...inventoryClaimSweepState, at: inventoryClaimSweepState.at ? new Date(inventoryClaimSweepState.at).toISOString() : null, limit: INVENTORY_CLAIM_SWEEP_LIMIT }, limit: 100 },
      restartRecovery: {
        enabled: Boolean(settings.resumeSessionOnRestart),
        restored: lastSessionRecovery,
        snapshot: (() => {
          const snapshot = loadRecoverySnapshot(now);
          return snapshot ? {
            ageSeconds: Math.max(0, Math.floor((now - Number(snapshot.at || now)) / 1000)),
            expiresAt: new Date(snapshot.expiresAt).toISOString(),
            preferredStream: snapshot.preferredStream || null,
            drop: snapshot.drop?.name || null,
            game: snapshot.drop?.game || null,
          } : null;
        })(),
      },
      notifications: {
        claimed: Boolean(settings.notifyClaimed),
        campaignEnding: Boolean(settings.notifyCampaignEnding),
        stalledProgress: Boolean(settings.notifyStalledProgress),
        streamSwitches: Boolean(settings.notifyStreamSwitches),
        onlyWhenHidden: Boolean(settings.notifyOnlyWhenHidden),
        cooldownMinutes: Math.max(0, Number(settings.notificationCooldownMinutes || 0)),
        permission: browserNotificationApi()?.permission || 'unsupported',
      },
      rewardEligibility: activeRewardEligibility(),
      rewardImage: (() => {
        const direct = dropBenefitImage(currentDrop);
        const resolved = rewardImageFromDrop(currentDrop);
        let host = null;
        try { host = resolved ? new URL(resolved, location.href).hostname : null; } catch (_) { host = null; }
        return {
          direct: Boolean(direct),
          resolved: Boolean(resolved),
          source: direct ? "drop-data" : (resolved ? "inventory-dom-or-catalog" : "missing"),
          host,
        };
      })(),
      campaignCatalog: {
        campaigns: lastCampaignCatalog.length,
        inProgressCampaigns: lastInventoryCampaigns.length,
        pageScrapedCampaigns: pageScrapedCampaignsFromCatalog().length,
        pageImportCount: lastCampaignPageImportCount,
        pageImportAt: lastCampaignPageImportAt ? new Date(lastCampaignPageImportAt).toISOString() : null,
        pageImportFresh: hasFreshCampaignPageImport(now),
        pageImportDisplay: lastCampaignPageImportDisplay || null,
        pageDisplay: lastCampaignPageDisplay,
        capturedAt: lastCampaignCatalogAt ? new Date(lastCampaignCatalogAt).toISOString() : null,
        ageSeconds: lastCampaignCatalogAt ? Math.max(0, Math.floor((now - lastCampaignCatalogAt) / 1000)) : null,
        persistedAcrossNavigation: Boolean(campaignCatalogCache.at && campaignCatalogCache.campaigns?.length),
        priorities: listOpenCampaignGames(openCampaignManagementPool(now), now).map(item => ({ game: item.game, ...campaignPriorityRank(item.game) })).filter(item => item.explicit),
        ignoredGames: Object.entries(ignoredCampaignGames.games || {}).map(([key, item]) => ({
          key,
          game: item?.game || key,
          expiresAt: item?.expiresAt ? new Date(item.expiresAt).toISOString() : null,
        })),
        strategy: normalizedCampaignStrategy(),
        strategyLabel: campaignStrategyLabel(),
        queue: (() => {
          const triplet = campaignQueueTriplet(routingCampaignPool(), currentDrop, now);
          const summarize = (item) => item ? {
            game: item.game,
            name: item.name,
            endAt: item.endAt || null,
            endMs: item.endMs || null,
            priority: item.sequencePriority ?? campaignPriority(item.game),
            priorityRank: campaignPriorityRank(item.game).rank,
            prioritySource: campaignPriorityRank(item.game).source,
            finishable: item.sequenceFinishable ?? null,
            remainingMinutes: item.sequenceRemainingMinutes ?? item.remainingMinutes ?? null,
            marginMinutes: item.sequenceMarginMinutes ?? null,
            inProgress: Boolean(item.sequenceInProgress),
          } : null;
          return {
            count: triplet.queue.length,
            previous: summarize(triplet.previous),
            current: summarize(triplet.current),
            next: summarize(triplet.next),
            endingSoonest: triplet.queue.slice(0, 8).map(summarize),
          };
        })(),
      },
      campaignMemory: {
        stored: memoryEntries.length,
        open: memoryEntries.filter(([, item]) => item?.status === "open" && !item?.completedAt).length,
        completed: memoryEntries.filter(([, item]) => Boolean(item?.completedAt)).length,
        updatedAt: campaignMemory.updatedAt ? new Date(campaignMemory.updatedAt).toISOString() : null,
        reset: (() => {
          const marker = campaignMemoryResetMarker();
          return {
            targetVersion: CAMPAIGN_MEMORY_RESET_VERSION,
            appliedVersion: marker.version,
            appliedAt: marker.at ? new Date(marker.at).toISOString() : null,
          };
        })(),
        sample: diagnosticMemorySample,
        sampleCount: diagnosticMemorySample.length,
        omitted: Math.max(0, memoryEntries.length - diagnosticMemorySample.length),
      },
      diagnosticSize: {
        campaignMemoryRecords: memoryEntries.length,
        campaignMemoryIncluded: diagnosticMemorySample.length,
        campaignMemoryOmitted: Math.max(0, memoryEntries.length - diagnosticMemorySample.length),
        activityEvents: activityEntries.length,
        activityEventsIncluded: diagnosticActivity.length,
        activityEventsOmitted: Math.max(0, activityEntries.length - diagnosticActivity.length),
      },
      inventoryResponse: { ...inventoryResponseHealth,
        at: inventoryResponseHealth.at ? new Date(inventoryResponseHealth.at).toISOString() : null,
        lastValidAt: inventoryResponseHealth.lastValidAt ? new Date(inventoryResponseHealth.lastValidAt).toISOString() : null },
      rewardResolution: rewardSessionResolution ? { ...rewardSessionResolution, at: new Date(rewardSessionResolution.at).toISOString() } : null,
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
      claimIntegrityFallback: lastClaimIntegrityFallback
        ? {
            at: new Date(lastClaimIntegrityFallback.at).toISOString(),
            drop: lastClaimIntegrityFallback.drop,
            game: lastClaimIntegrityFallback.game,
            alreadyOnInventory: lastClaimIntegrityFallback.alreadyOnInventory,
            navigatedToInventory: lastClaimIntegrityFallback.navigatedToInventory,
          }
        : null,
      progressAgeSeconds: lastProgressAt
        ? Math.max(0, Math.floor((now - lastProgressAt) / 1000))
        : null,
      progressFreshnessBasis: "credited-minutes-or-percent",
      lastProgress,
      lastProgressAt: lastProgressAt ? new Date(lastProgressAt).toISOString() : null,
      navigationInFlight: (() => {
        const flight = navigationFlightSnapshot(now);
        return flight ? {
          target: flight.targetKey || null,
          reason: flight.reason || null,
          ageSeconds: Math.max(0, Math.floor((now - Number(flight.startedAt || now)) / 1000)),
          remainingSeconds: Math.max(0, Math.ceil((Number(flight.expiresAt || now) - now) / 1000)),
          duplicateSkips: duplicateNavigationSkips,
        } : {
          target: null,
          reason: null,
          ageSeconds: 0,
          remainingSeconds: 0,
          duplicateSkips: duplicateNavigationSkips,
        };
      })(),
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
      performance: {
        uiDomScanIntervalSeconds: Math.round(UI_DOM_SCAN_INTERVAL_MS / 1000),
        promoStartupDelaySeconds: Math.round(PROMO_STARTUP_SCAN_DELAY_MS / 1000),
        globalPromoMutationObserver: false,
        keepTabFullDomMutationObservers: 0,
        lastPromoScanAt: lastPromoScanAt ? new Date(lastPromoScanAt).toISOString() : null,
        lastQueueRefreshAt: lastQueueRefreshAt ? new Date(lastQueueRefreshAt).toISOString() : null,
      },
      heartbeat: {
        intervalMs: HEARTBEAT_INTERVAL_MS,
        lastAt: lastHeartbeatAt ? new Date(lastHeartbeatAt).toISOString() : null,
        startupNetworkQuietMs: STARTUP_NETWORK_QUIET_MS,
        startupNetworkReadyAt: startupNetworkReadyAt ? new Date(startupNetworkReadyAt).toISOString() : null,
      },
      tabPresence: (() => {
        publishTabPresence();
        const peers = liveTabPeers(now);
        return {
          tabId: TAB_ID,
          startedAt: new Date(TAB_STARTED_AT).toISOString(),
          autoRoutingController: isAutoRoutingController(),
          peerCount: peers.length,
          peers: peers.slice(0, 8).map((peer) => ({
            id: peer.id,
            path: peer.path || "/",
            hidden: Boolean(peer.hidden),
            hasHandoff: Boolean(peer.hasHandoff),
            hasDrop: Boolean(peer.hasDrop),
            ageSeconds: Math.max(0, Math.floor((now - Number(peer.at || now)) / 1000)),
          })),
        };
      })(),
      gql: {
        normalIntervalMs: GQL_POLL_INTERVAL_MS,
        recoveryIntervalMs: GQL_RECOVERY_INTERVAL_MS,
        minimumGapMs: GQL_MIN_GAP_MS,
        nextPollAt: nextGqlPollAt ? new Date(nextGqlPollAt).toISOString() : null,
        inFlight: gqlPollInFlight,
        errorStreak: gqlErrorStreak,
        inventoryDegraded: inventoryResponseHealth.valid === false,
        lastReason: lastGqlReason || null,
        pendingReason: pendingGqlReason || null,
        lastPollAt: lastGqlPollAt ? new Date(lastGqlPollAt).toISOString() : null,
        lastSuccessAt: lastGqlSuccessAt ? new Date(lastGqlSuccessAt).toISOString() : null,
        lastInterceptedTwitchResponseAt: lastTwitchGqlAt ? new Date(lastTwitchGqlAt).toISOString() : null,
        lastCampaignDashboardAt: lastCampaignDashboardAt ? new Date(lastCampaignDashboardAt).toISOString() : null,
        lastError: lastGqlError || null,
        pageHook: twitchNetworkHookMode || null,
        operations: gqlOperationsSnapshot(),
        sessionPoll: lastSessionPoll ? {
          ...lastSessionPoll,
          at: new Date(lastSessionPoll.at).toISOString(),
        } : null,
        clientIntegrity: clientIntegritySnapshot(now),
      },
      updateCheck: (() => {
        const state = loadUpdateState();
        return {
          intervalMinutes: Math.round(updateChecker.CHECK_INTERVAL / 60000),
          endpoint: updateChecker.ENDPOINT,
          checkedForVersion: state.checkedForVersion || null,
          lastCheckAt: state.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : null,
          lastRemoteVersion: state.lastRemoteVersion || null,
          availableVersion: state.availableVersion || null,
          availableAt: state.availableAt ? new Date(state.availableAt).toISOString() : null,
          lastHttpStatus: Number(state.lastHttpStatus || 0) || null,
          lastError: state.lastError || null,
          noticeVersionThisPage: lastUpdateNoticeVersion || null,
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
        timeoutSeconds: Math.round(ROUTING_VERIFY_DEADLINE_MS / 1000),
        finalPollWindowSeconds: Math.round(GQL_MIN_GAP_MS / 1000),
        finalPollTarget: finalVerificationPollTarget || null,
        finalPollAt: finalVerificationPollAt ? new Date(finalVerificationPollAt).toISOString() : null,
        lastVerified: lastStreamVerification ? {
          ...lastStreamVerification,
          at: new Date(lastStreamVerification.at).toISOString(),
        } : null,
        baselineMinutes: Number.isFinite(Number(routingSession.verifyBaselineMinutes)) ? Number(routingSession.verifyBaselineMinutes) : null,
        baselinePercent: Number.isFinite(Number(routingSession.verifyBaselinePercent)) ? Number(routingSession.verifyBaselinePercent) : null,
      },
      routingController: routingControllerDiagnostics(now),
      activeCampaignRouting: {
        lifecycle: currentDrop ? campaignRoutingState(currentDrop, now) : null,
        hasStreamLoaded: Boolean(watchingLogin()),
        hasEligibleStream: Boolean(
          readRoutingControllerSession().state === ROUTING_STATES.EARNING &&
          matchingLiveDropStream()
        ),
        hasVerifiedEarningStream: streamEarningHealthSnapshot().earningVerified,
        needsEarningStream: activeDropNeedsStream(),
        allowedChannels: activeCampaignAllowedChannels().slice(0, 50),
        watchingLogin: watchingLogin() || null,
        locked: [
          ROUTING_STATES.FIND_STREAM,
          ROUTING_STATES.OPEN_STREAM,
          ROUTING_STATES.VERIFY_STREAM,
          ROUTING_STATES.EARNING,
          ROUTING_STATES.CLAIM,
        ].includes(readRoutingControllerSession().state),
        failedStreams: readRoutingControllerSession().failedStreams || [],
        targetGame: readRoutingControllerSession().targetGame || currentDrop?.game || null,
        targetCampaign: readRoutingControllerSession().targetCampaign || currentDrop?.campaign || null,
      },
      categoryRouting: {
        excludedCategorySlugs: [...EXCLUDED_CATEGORY_SLUGS],
        excludedCampaignNames: [...EXCLUDED_CAMPAIGN_NAMES],
        activeGame: currentDrop?.game || null,
        suppliedSlug: currentDrop?.gameSlug || null,
        suppliedSlugMatchesGame: currentDrop?.game
          ? suppliedCategorySlugMatchesGame(currentDrop.game, currentDrop.gameSlug || "")
          : null,
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
          domVideoPlaying: health.domVideoPlaying,
          domVideoPlayingAuthoritative: health.domVideoPlayingAuthoritative,
          creditedRecently: health.creditedRecently,
          exactSessionVerified: health.exactSessionVerified,
          streamEligible: health.streamEligible,
          earningVerified: health.earningVerified,
          expectedGame: health.expectedGame,
          streamGame: health.streamGame,
          gameMatches: health.gameMatches,
          dropsTagVisible: health.dropsTagVisible,
          healthy: health.healthy,
          recoveryDiagnosis: health.recovery?.code || null,
          recoveryRecommended: Boolean(health.recovery?.recoverable),
          playback: health.playback || null,
          visibilityState: health.visibilityState,
          documentFocused: health.documentFocused,
          backgrounded: health.backgrounded,
          backgroundSince: health.backgroundSince ? new Date(health.backgroundSince).toISOString() : null,
          foregroundRestoredAt: health.foregroundRestoredAt ? new Date(health.foregroundRestoredAt).toISOString() : null,
          foregroundGraceRemainingSeconds: Math.ceil(health.foregroundGraceRemainingMs / 1000),
          progressAgeSeconds: Math.floor(health.progressAgeMs / 1000),
          creditedProgressAgeSeconds: Math.floor(health.creditedProgressAgeMs / 1000),
          verificationGraceRemainingSeconds: Math.ceil(health.graceRemainingMs / 1000),
          verificationGraceAnchorAt: health.graceAnchorAt ? new Date(health.graceAnchorAt).toISOString() : null,
          verificationGraceAnchorSource: health.graceAnchorSource,
          inVerificationGrace: health.inVerificationGrace,
          delayedAfterSeconds: Math.round(
            (health.healthy ? HEALTHY_STREAM_DELAYED_MS : UNHEALTHY_STREAM_DELAYED_MS) / 1000
          ),
          stalledAfterSeconds: Math.round(progressStallTimeoutMs(health.healthy) / 1000),
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
        const expiry = campaignExpirySnapshot(
          mergeCampaigns(lastInventoryCampaigns, lastCampaignCatalog),
          currentDrop,
          now,
        );
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
      selectors: selectorHealthSnapshot(),
      subscriptionPromoSuppression: {
        enabled: Boolean(settings.hideTwitchSubscriptionPromos),
        totalSuppressed: suppressedSubscriptionPromoCount,
        currentlyHidden: document.querySelectorAll('[data-dropper-sub-promo-suppressed="true"]').length,
        hiddenChat: document.querySelectorAll('[data-dropper-sub-promo-scope="chat"]').length,
        hiddenPageCtas: document.querySelectorAll('[data-dropper-sub-promo-scope="page-cta"]').length,
        hiddenHighlights: document.querySelectorAll('[data-dropper-sub-promo-scope="highlight"]').length,
        hiddenCommunityHighlights: document.querySelectorAll('[data-dropper-sub-promo-scope="community-highlight"]').length,
        hiddenCommunityHighlightBacklog: document.querySelectorAll('[data-dropper-sub-promo-scope="community-highlight-backlog"]').length,
        hiddenPinnedHighlights: document.querySelectorAll('[data-dropper-sub-promo-scope="pinned-highlight"]').length,
        cssSuppressionActive: Boolean(document.getElementById("dropper-subscription-promo-style")),
      },
      queueEnabled: settings.queueEnabled,
      queueOnCategoryChange: settings.queueOnCategoryChange,
      streamCandidates: routingCandidateDiagnosticsSnapshot(now),
      standbyCache: {
        refreshIntervalMinutes: Math.round(STANDBY_REFRESH_INTERVAL_MS / 60000),
        lastObservedAt: lastStandbyRefreshAt ? new Date(lastStandbyRefreshAt).toISOString() : null,
        lastMaintenanceAt: lastStandbyMaintenanceAt ? new Date(lastStandbyMaintenanceAt).toISOString() : null,
        maintenance: lastStandbyMaintenance,
        total: pruneStandbyCache().length,
        matchingActiveCampaign: cachedStandbyCandidates(
          readRoutingControllerSession().targetGame || currentDrop?.game || "",
          readRoutingControllerSession().targetCampaignKey || currentDrop?.campaignKey || "",
        ).map((item) => ({
          login: item.login,
          viewers: streamViewerCount(item.viewers),
          dropsTagged: Boolean(item.dropsTagged),
          allowListMatch: Boolean(item.allowListMatch),
          seenAt: item.seenAt ? new Date(item.seenAt).toISOString() : null,
          ageSeconds: item.seenAt ? Math.max(0, Math.floor((now - Number(item.seenAt)) / 1000)) : null,
          freshForStandby: item.seenAt ? now - Number(item.seenAt) <= STANDBY_LIVE_FRESH_MS : false,
          temporarilySkipped: routingControllerFailedSet(routingSession).has(cleanText(item.login).toLowerCase()),
        })),
      },
      queueCandidates: diagnosticQueueCandidates.map((item) => item.login),
      queueCandidateDetails: diagnosticQueueCandidates.map((item) => ({
        login: item.login,
        availability: item.availability,
        source: item.source,
        dropsTagged: Boolean(item.dropsTagged),
        allowListMatch: Boolean(item.allowListMatch),
        evidenceRank: item.evidenceRank ?? null,
        evidenceLabel: item.evidenceLabel || null,
        cacheAgeSeconds: item.cacheAgeSeconds,
        freshCached: Boolean(item.freshCached),
      })),
      autoSwitchPaused: isAutoSwitchPaused(),
      autoSwitchPause: {
        selectedMinutes: Number(settings.pauseAutoSwitchMinutes || 0),
        until: pauseAutoSwitchUntil ? new Date(pauseAutoSwitchUntil).toISOString() : null,
        remainingMinutes: pauseAutoSwitchUntil
          ? Math.max(0, Math.ceil((pauseAutoSwitchUntil - now) / 60000))
          : 0,
      },
      badgeOnly: Boolean(settings.badgeOnly),
      progressInTitle: {
        enabled: Boolean(settings.progressInTitle),
        label: progressLabel || null,
        nativeTitle: lastNativeTitle || null,
        renderedTitle: document.title || null,
        titleObserverActive: Boolean(progressTitleObserver),
      },
      menuSizing: 'viewport-clamped',
      skipStreamerConfirmation: (() => {
        const armed = skipStreamerArmSnapshot(now);
        return {
          mode: "arm-then-confirm",
          windowSeconds: Math.round(SKIP_STREAMER_ARM_MS / 1000),
          armed: Boolean(armed),
          login: armed?.login || null,
          remainingSeconds: armed?.remainingSeconds || 0,
        };
      })(),
      interfaceTheme: {
        id: settings.uiTheme,
        skin: ui?.cluster?.dataset?.themeSkin || "gradient",
      },
      interfaceOpacity: {
        enabled: Boolean(settings.customOpacity),
        percent: normalizedOpacityPercent(),
        applied: settings.customOpacity ? normalizedOpacityPercent() / 100 : 1,
        launcherRemainsOpaque: true,
      },
      menuLayout: {
        renderedHeight: ui?.dock ? Math.round(ui.dock.getBoundingClientRect().height) : null,
        scrollHeight: ui?.dock ? Math.round(ui.dock.scrollHeight) : null,
        maxHeight: ui?.dock ? getComputedStyle(ui.dock).maxHeight : null,
        overflow: ui?.dock ? getComputedStyle(ui.dock).overflow : null,
      },
      uiGeometry: {
        progressCardRect: rectSnapshot(card),
        launcherRect: rectSnapshot(launcher),
        launcherRowRect: rectSnapshot(launcherRow),
        menuRect: rectSnapshot(ui?.dock),
        noticeRect: rectSnapshot(notice),
      },
      progressPanelWidth: card ? Math.round(card.getBoundingClientRect().width) : null,
      launcherRowWidth: launcherRow ? Math.round(launcherRow.getBoundingClientRect().width) : null,
      menuWidth: ui?.dock ? Math.round(ui.dock.getBoundingClientRect().width) : null,
      noticeWidth: notice && !notice.hidden ? Math.round(notice.getBoundingClientRect().width) : null,
      chatWidth: chat ? Math.round(chat.getBoundingClientRect().width) : null,
      recentActivity: diagnosticActivity.map((entry) => ({
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
    syncMenuSizing();

    const badgeRow = ui.shadow.querySelector(".badge-row");
    const progressStack = ui.shadow.querySelector(".progress-stack");
    const progressCard = ui.shadow.getElementById("tdh-drop-card");
    const rowHeight = settings.badgeOnly ? 48 : Math.max(112, progressCard?.offsetHeight || 112);
    const panelWidth = ExtraPotionsCore.menuWidth();
    const menuPanelWidth = Math.min(panelWidth, Math.max(0, window.innerWidth - 24));
    const launcherWidth = 48;
    const rowGap = settings.badgeOnly ? 0 : 8;
    const rowWidth = settings.badgeOnly ? launcherWidth : panelWidth + rowGap + launcherWidth;

    const reservedRows = 1;
    if (ui.host.dataset.launcherReservedRows !== String(reservedRows)) {
      ui.host.dataset.launcherReservedRows = String(reservedRows);
      document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "launcher-reservation", productId: "dropper", rows: reservedRows } }));
    }

    // exp-core owns launcher coordinates. With the launchers anchored at the bottom the launcher sits at the
    // bottom of Dropper's row and the card rises above it; anchored at the top the launcher sits at the top of
    // the row and the card hangs below it, so the card is never pushed off the edge of the window.
    const placement = ExtraPotionsCore.launcherPlacement(ui.host);
    launcherGridDelta = placement.delta;
    const anchor = placement.anchor;
    ui.cluster.dataset.launcherAnchor = anchor;
    clusterTop = anchor === "top" ? placement.top : placement.top - (rowHeight - 48);

    if (badgeRow) {
      badgeRow.style.setProperty("width", `${Math.min(rowWidth, window.innerWidth - 24)}px`, "important");
      badgeRow.style.setProperty("right", "12px", "important");
      badgeRow.style.setProperty("left", "auto", "important");
      badgeRow.style.setProperty("top", `${Math.max(8, Math.min(window.innerHeight - rowHeight - 8, clusterTop))}px`, "important");
      badgeRow.style.setProperty("bottom", "auto", "important");
      badgeRow.style.setProperty("gap", `${rowGap}px`, "important");
      badgeRow.style.setProperty("min-height", `${rowHeight}px`, "important");
    }

    if (progressStack) {
      progressStack.style.width = `${Math.min(rowWidth, window.innerWidth - 24)}px`;
      progressStack.style.minHeight = `${rowHeight}px`;
    }

    const badgeOnlySlot = ui.shadow.getElementById("tdh-badge-only-progress-slot");
    // Tells exp-core the progress card is showing beside the launchers, so menus and notices open above it
    // instead of over it. In Badge Only the card lives in the menu and reserves nothing.
    if (progressCard) {
      if (progressCard.dataset.presentation === "page-card") progressCard.dataset.expReserved = "1";
      else delete progressCard.dataset.expReserved;
    }
    if (progressCard?.dataset.presentation === "page-card") {
      progressCard.style.setProperty("width", `${Math.min(panelWidth, Math.max(0, window.innerWidth - 80))}px`, "important");
      progressCard.style.setProperty("max-width", `calc(100vw - 80px)`, "important");
      for (const property of ["left", "right", "top", "bottom"]) progressCard.style.removeProperty(property);
    } else if (progressCard?.dataset.presentation === "menu-card" && badgeOnlySlot) {
      // Inside the menu, match the same inner content width used by every
      // .fl-tool-panel. Core owns the viewport-clamped outer menu width.
      badgeOnlySlot.style.setProperty("width", "100%", "important");
      badgeOnlySlot.style.setProperty("margin-left", "0", "important");
      badgeOnlySlot.style.setProperty("margin-right", "0", "important");
      progressCard.style.setProperty("width", "100%", "important");
      progressCard.style.setProperty("max-width", "100%", "important");
      for (const property of ["left", "right", "top", "bottom"]) progressCard.style.removeProperty(property);
    }

    if (railOpen) {
      // exp-core owns menu placement: beside the launcher grid, lined up with this launcher.
      ui.dock.style.overflowY = "auto";
      const safeMenuTop = ExtraPotionsCore.placeMenu(ui.host, ui.dock, menuPanelWidth)?.top ?? 8;

      document.documentElement.dataset.expDropperMenuOpen = "1";
      const previousTop = document.documentElement.style.getPropertyValue("--exp-dropper-menu-top");
      const nextTop = `${Math.round(safeMenuTop)}px`;
      document.documentElement.style.setProperty("--exp-dropper-menu-top", nextTop);
      if (previousTop !== nextTop) {
        document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "dropper-menu-position", productId: "dropper" } }));
      }
    } else {
      ui.dock.style.overflowY = "";
      for (const property of ["top", "bottom", "left", "right", "width", "max-height"]) ui.dock.style.removeProperty(property);
    }

    ui.cluster.classList.remove("open-up");
    ui.cluster.style.top = "0px";
    ui.cluster.style.right = "0px";
    ui.cluster.style.gap = "0px";
    ui.cluster.style.zIndex = railOpen ? "2147483647" : "2147483600";

    positionMenuUpdateNotice();
  }

  // Launcher dragging is shared suite behavior owned by exp-core.
  function bindDrag() {
    ExtraPotionsCore.bindLauncherDrag(ui.launcher, "dropper", { layout: layoutChrome });
  }

  // Core owns inactivity, native-select protection and suite menu exclusivity.
  function clearMenuDismissTimer() {
    ui?.menuController?.cancelDismiss();
  }

  function scheduleMenuDismiss() {
    ui?.menuController?.scheduleDismiss();
  }

  function enforceAutoDismissDeadlines(now = Date.now()) {
    ui?.menuController?.enforceDeadline(now);
  }

  function setRailOpen(open, focus) {
    if(open)ui.healthControl?.refresh();
    railOpen = open;
    if (open) {
      collapseToolPanels();
      collapseNestedPanels();
    }
    ui.menuController.state(open);
    ui.launcher.setAttribute("aria-expanded", String(open));

    if (open) {
      document.documentElement.dataset.expDropperMenuOpen = "1";
      scheduleMenuDismiss();
      refreshTwitchAuthStatus();
    } else {
      clearSkipStreamerArm("menu-closed");
      delete document.documentElement.dataset.expDropperMenuOpen;
      document.documentElement.style.removeProperty("--exp-dropper-menu-top");
      document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "dropper-menu-closed", productId: "dropper" } }));
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
    if (focus && open && !globalThis.ExtraPotionsCore?.focusMenuSurface?.(ui.dock)) {
      ui.dock.tabIndex = -1;
      ui.dock.focus({ preventScroll: true });
    }
    if (focus && !open) ui.launcher.focus();
  }

  function collapseToolPanels() {
    ui.shadow.querySelectorAll(".fl-tool-header").forEach((header) => {
      const body = ui.shadow.getElementById(header.dataset.panel);
      body.classList.add("fl-tool-hidden");
      header.classList.toggle("last-opened", header.dataset.panel === lastPanelId);
      const chevron = header.querySelector(".fl-tool-chevron");
      chevron.textContent = "▸";
      chevron.setAttribute("aria-expanded", "false");
    });
  }

  function collapseNestedPanels() {
    const inventory = ui.shadow.getElementById("tdh-compact-inventory");
    const inventoryButton = ui.shadow.getElementById("tdh-toggle-inventory");
    inventory?.classList.remove("open");
    if (inventoryButton) {
      inventoryButton.textContent = "Show Drops Inventory";
      inventoryButton.classList.toggle("last-opened", lastSubmenuId === "inventory");
    }
    const diagnostics = ui.shadow.getElementById("tdh-diagnostics");
    const diagnosticsButton = ui.shadow.getElementById("tdh-diagnostics-toggle");
    diagnostics?.classList.remove("open");
    if (diagnostics) diagnostics.hidden = true;
    if (diagnosticsButton) {
      diagnosticsButton.textContent = "Show Diagnostics";
      diagnosticsButton.setAttribute("aria-expanded", "false");
      diagnosticsButton.classList.toggle("last-opened", lastSubmenuId === "diagnostics");
    }
  }

  function bindPanels() {
    ui.shadow.querySelectorAll(".fl-tool-header").forEach((header) => {
      header.addEventListener("click", () => {
        const target = ui.shadow.getElementById(header.dataset.panel);
        const willOpen = target.classList.contains("fl-tool-hidden");
        if (willOpen) {
          lastPanelId = header.dataset.panel;
          collapseNestedPanels();
        }
        ui.shadow.querySelectorAll(".fl-tool-header").forEach((other) => {
          const body = ui.shadow.getElementById(other.dataset.panel);
          const open = other === header && willOpen;
          body.classList.toggle("fl-tool-hidden", !open);
          other.querySelector(".fl-tool-chevron").textContent = open ? "▾" : "▸";
          other.querySelector(".fl-tool-chevron").setAttribute("aria-expanded", String(open));
          other.classList.toggle("last-opened", other.dataset.panel === lastPanelId);
        });
        requestAnimationFrame(layoutChrome);
      });
    });
  }

  function bindSwitches() {
    const map = {
      "tdh-quiet-hours": "quietHoursEnabled",
      "tdh-claim-bonus": "claimBonus", "tdh-keep-tab": "keepTabActive", "tdh-claim-drops": "claimDrops",
      "tdh-progress-title": "progressInTitle", "tdh-find-next": "findNextStream", "tdh-mute-next": "muteRestarted",
      "tdh-background-earning": "backgroundEarning", "tdh-auto-pip": "autoPictureInPicture", "tdh-resume-session": "resumeSessionOnRestart", "tdh-badge-only": "badgeOnly", "tdh-reduce-motion": "reduceMotion", "tdh-notify-claimed": "notifyClaimed", "tdh-notify-ending": "notifyCampaignEnding", "tdh-notify-stalled": "notifyStalledProgress", "tdh-notify-switch": "notifyStreamSwitches", "tdh-notify-hidden": "notifyOnlyWhenHidden", "tdh-custom-opacity": "customOpacity",
      "tdh-hide-sub-promos": "hideTwitchSubscriptionPromos",
      "tdh-restore-channel-player": "restoreChannelPlayer",
      "tdh-queue-enabled": "queueEnabled", "tdh-queue-stall": "queueOnStall", "tdh-queue-offline": "queueOnOffline", "tdh-queue-category": "queueOnCategoryChange",
    };
    Object.entries(map).forEach(([id, key]) => {
      ui.shadow.getElementById(id)?.addEventListener("click", () => {
        settings[key] = !settings[key];
        saveSettings();
        if (key === "claimBonus" || key === "claimDrops") syncClaimWatchers();
        if (key === "keepTabActive") void syncScreenWakeLock();
        if (key === "autoPictureInPicture") void syncAutoPictureInPicture("setting-changed");
        if (key === "resumeSessionOnRestart") {
          if (settings.resumeSessionOnRestart) saveRecoverySnapshot('setting-enabled');
          else clearRecoverySnapshot('setting-disabled');
        }
        if (key === "findNextStream" && settings.findNextStream) { syncViewingContext(); viewingIntent.allowSwitching(); }
        if (["notifyClaimed","notifyCampaignEnding","notifyStalledProgress","notifyStreamSwitches"].includes(key) && settings[key]) {
          void requestBrowserNotificationPermission().then((permission) => {
            if (permission === 'granted') {
              notifyUser('Browser notifications enabled');
              return;
            }
            settings[key] = false;
            saveSettings();
            notifyUser(permission === 'unsupported' ? 'Browser notifications are not supported here' : 'Browser notification permission was not granted');
          });
        }
        refreshViewingControls();
        if (key === "progressInTitle") updateTitle();
        if (key === "badgeOnly" || key === "customOpacity") applyAppearanceSettings();
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
      "tdh-quiet-hours": settings.quietHoursEnabled,
      "tdh-claim-bonus": settings.claimBonus, "tdh-keep-tab": settings.keepTabActive, "tdh-claim-drops": settings.claimDrops,
      "tdh-progress-title": settings.progressInTitle, "tdh-find-next": settings.findNextStream, "tdh-mute-next": settings.muteRestarted,
      "tdh-background-earning": settings.backgroundEarning, "tdh-auto-pip": settings.autoPictureInPicture, "tdh-resume-session": settings.resumeSessionOnRestart, "tdh-badge-only": settings.badgeOnly, "tdh-reduce-motion": settings.reduceMotion, "tdh-notify-claimed": settings.notifyClaimed, "tdh-notify-ending": settings.notifyCampaignEnding, "tdh-notify-stalled": settings.notifyStalledProgress, "tdh-notify-switch": settings.notifyStreamSwitches, "tdh-notify-hidden": settings.notifyOnlyWhenHidden, "tdh-custom-opacity": settings.customOpacity,
      "tdh-hide-sub-promos": settings.hideTwitchSubscriptionPromos,
      "tdh-restore-channel-player": settings.restoreChannelPlayer,
      "tdh-queue-enabled": settings.queueEnabled, "tdh-queue-stall": settings.queueOnStall, "tdh-queue-offline": settings.queueOnOffline, "tdh-queue-category": settings.queueOnCategoryChange,
    };
    Object.entries(map).forEach(([id, on]) => ui.shadow.getElementById(id)?.setAttribute("aria-checked", String(Boolean(on))));
  }

  window.dropperDebug = function dropperDebug() { return dropperDebugSnapshot(); };
  window.tdhDebug = window.dropperDebug;
  window.dropperScrapeCampaignsPage = function dropperScrapeCampaignsPage() {
    const display = isCampaigns() ? detectCampaignsPageDisplay() : {
      mode: CAMPAIGN_PAGE_DISPLAY.UNKNOWN,
      accordionHeaders: 0,
      dateLeaves: 0,
      hasEmptyMessage: false,
      hasOpenDropSection: false,
      hasOpenRewardSection: false,
      hasClosedSection: false,
      at: Date.now(),
      offCampaignsPage: true,
    };
    const campaigns = scrapeCampaignsFromPage();
    return {
      display,
      count: campaigns.length,
      games: campaigns.map((item) => item.game?.displayName || item.name || ""),
    };
  };
  window.tdhScrapeCampaignsPage = window.dropperScrapeCampaignsPage;
  window.dropperImportCampaignsViaAuth = function dropperImportCampaignsViaAuth() {
    return importOpenCampaignsViaAuth("console-auth-import");
  };
  window.tdhImportCampaignsViaAuth = window.dropperImportCampaignsViaAuth;

  window.dropperShow = function dropperShow() {
    mountUi();
    setRailOpen(true, true);
  };
  window.tdhShow = window.dropperShow;

  // Start only after every binding in this IIFE is initialized (avoids SPA TDZ GQL crashes).
  startDropper();
})();
