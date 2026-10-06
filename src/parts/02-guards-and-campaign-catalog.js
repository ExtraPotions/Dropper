  async function heartbeat() {
    if (!ui) return;
    if(ExtraPotionsCore.suiteSitePaused()){refreshViewingControls();return;}
    const now = Date.now();
    syncViewingContext();
    restoreCurrentDropMetadataFromKnownCampaigns();
    restorePersistedRoutingVerification(now);
    lastHeartbeatAt = now;
    publishTabPresence();
    enforceUpdateReloadPending(now);
    enforceAutoDismissDeadlines(now);
    noteWatching();
    watchProgressTitle();
    restoreChannelPlayer();
    ensureStreamMuted();
    ensureStreamPlaying();
    void syncScreenWakeLock();
    refreshViewingControls();
    renderClaimHistory();
    refreshEligibilityControls();
    refreshStreamHealthSummary();
    refreshMultiTabStatus();
    refreshSessionRecoveryStatus();
    checkCampaignDeadlineNotification(now);
    queueClaimScan();

    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      queueGqlPollSoon("route-change", 5000);
    }

    if (!nextGqlPollAt || now >= nextGqlPollAt) {
      await requestGqlPoll(pendingGqlReason || "heartbeat");
    }

    if (settings.claimDrops) scanDrops();
    else refreshDropCard();

    if (now - lastQueueRefreshAt >= UI_DOM_SCAN_INTERVAL_MS) refreshQueueList();
    if (now - lastPromoScanAt >= UI_DOM_SCAN_INTERVAL_MS) suppressTwitchSubscriptionPromos();
    if (now - lastStandbyMaintenanceAt >= STANDBY_REFRESH_INTERVAL_MS) refreshStandbyCampaignCache(now);

    routingControllerTick(Date.now(), "heartbeat");

    syncProgressSurfaces();
    updateTitle();

    const updateState = loadUpdateState();
    if (
      updateState.checkedForVersion !== APP_VERSION ||
      now - Number(updateState.lastCheckAt || 0) >= updateChecker.CHECK_INTERVAL
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
      div.community-highlight,
      div.community-highlight-stack__backlog-card,
      div.pinned-chat__highlight-card,
      div.pinned-chat__highlight-card__collapsed,
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
    const targets = new Set();

    document.querySelectorAll(
      "div.community-highlight, div.community-highlight-stack__backlog-card, div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed, div.highlight.highlight__collapsed"
    ).forEach((candidate) => {
      if (!(candidate instanceof Element)) return;
      if (candidate.closest("#tdh-root")) return;

      const outerCommunity = candidate.matches("div.community-highlight")
        ? candidate
        : candidate.closest("div.community-highlight");
      const backlogCard = candidate.matches("div.community-highlight-stack__backlog-card")
        ? candidate
        : candidate.closest("div.community-highlight-stack__backlog-card");
      const pinnedCard = candidate.matches("div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed")
        ? candidate
        : candidate.closest("div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed");
      const highlight = candidate.matches("div.highlight.highlight__collapsed")
        ? candidate
        : candidate.querySelector?.("div.highlight.highlight__collapsed");

      const target = outerCommunity || backlogCard || pinnedCard || highlight || candidate;
      if (target) targets.add(target);
    });

    targets.forEach((target) => {
      const scope = target.matches?.("div.community-highlight")
        ? "community-highlight"
        : target.matches?.("div.community-highlight-stack__backlog-card")
          ? "community-highlight-backlog"
          : target.matches?.("div.pinned-chat__highlight-card, div.pinned-chat__highlight-card__collapsed")
            ? "pinned-highlight"
            : "highlight";
      if (suppressPromoNode(target, scope)) hidden += 1;
    });

    return hidden;
  }

  function suppressTwitchSubscriptionPromos() {
    if (ExtraPotionsCore.suiteSitePaused?.()) return;
    lastPromoScanAt = Date.now();
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
    // Exact selectors are hidden immediately by CSS. Delay the broader DOM
    // fallback scan until Twitch has had time to render its initial page.
    subscriptionPromoStyle();
    setTimeout(() => {
      if (settings.hideTwitchSubscriptionPromos) suppressTwitchSubscriptionPromos();
    }, PROMO_STARTUP_SCAN_DELAY_MS);
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

  function syncMenuSizing() {
    if (!ui?.cluster) return;
    ui.cluster.style.setProperty("--exp-menu-width", `${ExtraPotionsCore.menuWidth()}px`);
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
    if(/progress|verification|navigation|recovery-paused|recovery-resumed/.test(entry.type))recordProgressTimeline(entry.type,{...(entry.meta||{}),message:entry.message});
    renderRoutingHistory();
    return entry;
  }

  function clearActivityLog() {
    activityLog = [];
    writeSession(ACTIVITY_LOG_KEY, activityLog);
    renderRoutingHistory();
  }
  // Plain-language names for automatic navigation reasons shown in System.
  const NAVIGATION_REASON_TEXT = Object.freeze({
    'routing-find-category': 'Looking for a stream in the game category',
    'routing-open-drops-verification-stream': 'Opening a Drops stream to check eligibility',
    'routing-open-campaign-acl-stream': 'Opening a stream listed by the campaign',
    'routing-open-probationary-stream': 'Trying a same-game stream',
    'routing-final-verification': 'Final eligibility check',
    'routing-campaign-details': 'Loading campaign details',
    'routing-wait-retry': 'Retrying after a wait',
  });
  function navigationReasonText(code) {
    const value=cleanText(code);
    if(NAVIGATION_REASON_TEXT[value])return NAVIGATION_REASON_TEXT[value];
    const words=value.replace(/^routing-/,'').replace(/-/g,' ').trim();
    return words?words.charAt(0).toUpperCase()+words.slice(1):'Automatic navigation';
  }
  function recordProgressTimeline(type, details = {}) {
    const minutes=Number(details.currentMinutes);
    const kind=cleanText(type).slice(0,40);
    const reason=kind==='navigation'&&details.reason?navigationReasonText(details.reason):cleanText(details.reason||details.message);
    const row={at:Date.now(),type:kind,reason:reason.slice(0,180),minutes:Number.isFinite(minutes)&&minutes>=0?minutes:null};
    const rows=progressTimelineSnapshot();
    // Status checks alternate with other events, so a repeat among the last few rows
    // within ten minutes adds nothing new.
    if(rows.slice(-4).some(last=>last.type===row.type&&last.reason===row.reason&&last.minutes===row.minutes&&row.at-last.at<10*60*1000))return;
    writeSession('dropper-progress-timeline-v1',[...rows,row].slice(-30));
  }
  function progressTimelineSnapshot() {
    const rows=readSession('dropper-progress-timeline-v1',[]);
    return Array.isArray(rows)?rows.slice(-30).filter(row=>row&&Number.isFinite(row.at)).map(row=>({at:row.at,type:cleanText(row.type).slice(0,40),reason:cleanText(row.reason).slice(0,180),minutes:Number.isFinite(row.minutes)?row.minutes:null})):[];
  }
  function recoveryNavigationState() {
    const value=readSession('dropper-recovery-loop-v1',{events:[],suspended:false}),now=Date.now();
    return {events:(Array.isArray(value.events)?value.events:[]).filter(at=>Number.isFinite(at)&&at>now-300000).slice(-3),suspended:Boolean(value.suspended)};
  }
  function recoveryNavigationAllowed(reason) {
    if(/manual|update-install/i.test(reason))return true;
    const state=recoveryNavigationState();
    if(state.suspended){setStatus('Recovery Paused · Resume from System');return false;}
    const recovery=/recover|retry|fallback|restart|stall/i.test(reason)||(readRoutingControllerSession().failedStreams||[]).length>0;
    if(!recovery)return true;
    if(state.events.length>=3){writeSession('dropper-recovery-loop-v1',{...state,suspended:true});logActivity('recovery-paused','Recovery paused after three navigations within five minutes');setStatus('Recovery Paused · Resume from System');return false;}
    writeSession('dropper-recovery-loop-v1',{events:[...state.events,Date.now()],suspended:false});return true;
  }
  function resumeRecoveryNavigation() {
    if(ExtraPotionsCore.suiteSitePaused()||viewingIntent.snapshot().paused)return false;
    writeSession('dropper-recovery-loop-v1',{events:[],suspended:false});logActivity('recovery-resumed','Recovery resumed from System');return true;
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

    const integrityRejected = /integrity/i.test(message);
    if (/\b429\b|rate.?limit|too many requests/i.test(message)) {
      openNetworkCircuit("Twitch rate limit response", CIRCUIT_RATE_COOLDOWN_MS);
    } else if (!integrityRejected && /\b401\b|\b403\b|unauthorized|forbidden/i.test(message)) {
      openNetworkCircuit("authorization failures", 10 * 60 * 1000);
    } else if (networkState.consecutiveFailures >= NETWORK_FAILURE_THRESHOLD) {
      openNetworkCircuit("repeated Twitch GQL failures", CIRCUIT_ERROR_COOLDOWN_MS);
    }

    logActivity("network-error", "Twitch GQL request failed", {
      message,
      consecutiveFailures: networkState.consecutiveFailures,
    });
  }

  function navigationLocationKey(url = location.href) {
    try {
      const parsed = new URL(url, location.href);
      return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch (_) {
      return "";
    }
  }

  function clearNavigationFlight() {
    removeSession(NAVIGATION_FLIGHT_KEY);
  }

  function navigationFlightSnapshot(now = Date.now()) {
    const state = readSession(NAVIGATION_FLIGHT_KEY, null);
    if (!state?.targetKey || !state?.expiresAt) return null;

    const currentKey = navigationLocationKey();
    if (currentKey === state.targetKey || Number(state.expiresAt) <= now) {
      clearNavigationFlight();
      return null;
    }
    return state;
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
    if (!viewingNavigationAllowed(reason)) return false;
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting(reason || "automatic-routing");
      return false;
    }

    let target;
    let current;
    try {
      target = new URL(url, location.href);
      current = new URL(location.href);
    } catch (_) {
      return false;
    }

    const targetCategorySlug = categorySlugFromUrl(target.href);
    if (targetCategorySlug && EXCLUDED_CATEGORY_SLUGS.has(targetCategorySlug)) {
      logActivity("navigation-rejected", "Blocked excluded Twitch category route", {
        reason,
        slug: targetCategorySlug,
      });
      return false;
    }

    const targetKey = navigationLocationKey(target.href);
    const currentKey = navigationLocationKey(current.href);
    if (!targetKey || targetKey === currentKey) return false;

    const now = Date.now();
    const flight = navigationFlightSnapshot(now);
    if (flight) {
      duplicateNavigationSkips += 1;
      return false;
    }

    const guard = navigationGuardSnapshot(now);
    if (guard.blocked) {
      setStatus(`Auto-Switch Paused · Reload Loop Protection ${Math.ceil((guard.blockedUntil - now) / 1000)}s`);
      return false;
    }

    const bypassStreamSettle = reason === "campaign-stream-retry" || reason === "manual-stream-skip";
    if (!bypassStreamSettle && watchingLogin() && now - PAGE_STARTED_AT < STREAM_ROUTE_SETTLE_MS) {
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

    if(!recoveryNavigationAllowed(reason))return false;
    writeNavigationGuard({
      events,
      blockedUntil: 0,
      lastTarget: targetKey,
      lastReason: reason,
    });

    clearSkipStreamerArm("navigation");
    logActivity("navigation", "Automatic Twitch navigation", {
      reason,
      from: current.pathname,
      to: target.pathname,
    });
    writeSession(NAVIGATION_FLIGHT_KEY, {
      targetKey,
      fromKey: currentKey,
      reason,
      startedAt: now,
      expiresAt: now + AUTO_NAVIGATION_IN_FLIGHT_MS,
    });
    const targetLogin = streamLoginFromUrl(target.href);
    if (settings.muteRestarted && targetLogin) {
      requestMuteAfterNavigation(reason);
    }
    if (targetLogin && reason !== "manual-stream-skip") {
      const game = cleanText(currentDrop?.game || currentDrop?.campaign || "");
      sendBrowserNotification(
        'switch',
        'Dropper · Switching stream',
        `Moving to ${targetLogin}${game ? ` for ${game}` : ''}.`,
        { tag: `switch-${targetLogin}`, cooldownMs: 30000 },
      );
    }
    noteRequestedViewingNavigation(target.href);
    explicitViewingNavigationUntil = 0;
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
    const pending = readSession(NEXT_GAME_KEY, null);
    if (!pending) return null;
    const state = normalizedHandoffState(pending);
    const startedAt = Number(pending.startedAt || 0);
    if (state === HANDOFF_STATES.FAILED) {
      logActivity("handoff", "Cleared failed handoff", {
        state,
        targetGame: pending.targetGame || null,
        targetStream: pending.targetStream || null,
      });
      writeSession(NEXT_GAME_KEY, null);
      return null;
    }
    if (startedAt && Date.now() - startedAt > HANDOFF_SESSION_TTL_MS) {
      logActivity("handoff", "Cleared expired handoff", {
        state,
        targetGame: pending.targetGame || null,
        targetStream: pending.targetStream || null,
      });
      writeSession(NEXT_GAME_KEY, null);
      return null;
    }
    return pending;
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

  function extractCampaignCatalog(payload) {
    const found = [];
    const seen = new Set();
    const visit = (value, depth = 0) => {
      if (!value || depth > 12) return;
      if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
      if (typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      const drops = value.timeBasedDrops || value.drops;
      if (Array.isArray(drops) && drops.length && (value.id || value.name) && value.game) found.push(value);
      Object.values(value).forEach((item) => visit(item, depth + 1));
    };
    visit(payload);
    return found;
  }

  function mergeCampaigns(catalog, inventory) {
    const merged = new Map();
    const add = (campaign) => {
      const key = String(campaign?.id || campaignKey(campaign) || "").toLowerCase();
      if (!key) return;
      const prior = merged.get(key);
      if (!prior) { merged.set(key, campaign); return; }
      const drops = new Map((prior.timeBasedDrops || prior.drops || []).map((drop) => [String(drop?.id || drop?.name || ""), drop]));
      for (const drop of campaign.timeBasedDrops || campaign.drops || []) {
        const dropKey = String(drop?.id || drop?.name || "");
        drops.set(dropKey, { ...(drops.get(dropKey) || {}), ...drop, self: { ...(drops.get(dropKey)?.self || {}), ...(drop?.self || {}) } });
      }
      merged.set(key, {
        ...prior,
        ...campaign,
        // Empty enabled summaries are incomplete; only explicit unrestricted
        // data or a new channel list replaces known campaign restrictions.
        allow: campaign?.allow?.isEnabled === false || campaign?.allow?.channels?.length
          ? campaign.allow
          : prior.allow || campaign.allow,
        status: campaign?.status || prior?.status || "",
        game: { ...(prior?.game || {}), ...(campaign?.game || {}) },
        timeBasedDrops: [...drops.values()],
      });
    };
    (catalog || []).forEach(add);
    (inventory || []).forEach(add);
    return [...merged.values()];
  }

  function compactCampaignCatalog(campaigns) {
    return (campaigns || []).slice(0, 250).map((campaign) => ({
      id: campaign?.id || "",
      name: campaign?.name || "",
      status: campaign?.status || "",
      startAt: campaign?.startAt || "",
      endAt: campaign?.endAt || "",
      game: {
        id: campaign?.game?.id || "",
        name: campaign?.game?.name || "",
        displayName: campaign?.game?.displayName || "",
        slug: campaign?.game?.slug || "",
      },
      ...(typeof campaign?.isAccountConnected === 'boolean' ? { isAccountConnected: campaign.isAccountConnected } : {}),
      self: {
        ...(typeof campaign?.self?.isAccountConnected === 'boolean' ? { isAccountConnected: campaign.self.isAccountConnected } : {}),
        ...(typeof campaign?.self?.isEligible === 'boolean' ? { isEligible: campaign.self.isEligible } : {}),
      },
      allow: {
        isEnabled: campaign?.allow?.isEnabled !== false,
        channels: (campaign?.allow?.channels || []).slice(0, 250).map((channel) => ({
          id: channel?.id || "",
          name: channel?.name || channel?.login || "",
          login: channel?.login || channel?.name || "",
          displayName: channel?.displayName || "",
        })),
      },
      timeBasedDrops: (campaign?.timeBasedDrops || campaign?.drops || []).slice(0, 100).map((drop) => ({
        id: drop?.id || "",
        name: drop?.name || drop?.benefitEdges?.[0]?.benefit?.name || "",
        startAt: drop?.startAt || "",
        endAt: drop?.endAt || "",
        requiredMinutesWatched: Number(drop?.requiredMinutesWatched || 0),
        requiredSubs: Number(
          drop?.requiredSubs ??
          drop?.requiredSubscriptions ??
          drop?.requiredSubscriptionCount ??
          drop?.subscriptionRequirement?.requiredSubs ??
          0
        ) || 0,
        preconditionDrops: (drop?.preconditionDrops || []).map((item) => ({
          id: item?.id || "",
          ...(['claimed', 'completed'].includes(item?.requirement) ? { requirement: item.requirement } : {}),
          ...(typeof item?.requiresClaim === 'boolean' ? { requiresClaim: item.requiresClaim } : {}),
        })),
        benefitEdges: [{ benefit: {
          name: drop?.benefitEdges?.[0]?.benefit?.name || drop?.name || "",
          imageAssetURL: drop?.benefitEdges?.[0]?.benefit?.imageAssetURL || "",
        } }],
        self: {
          isClaimed: Boolean(drop?.self?.isClaimed),
          ...(typeof drop?.self?.hasPreconditionsMet === 'boolean' ? { hasPreconditionsMet: drop.self.hasPreconditionsMet } : {}),
          ...(typeof drop?.self?.isEligible === 'boolean' ? { isEligible: drop.self.isEligible } : {}),
          currentMinutesWatched: drop?.self?.currentMinutesWatched == null ? null : Number(drop.self.currentMinutesWatched),
          dropInstanceID: drop?.self?.dropInstanceID || "",
        },
      })),
    }));
  }

  function loadCampaignCatalogCache() {
    const saved = readSession(CAMPAIGN_CATALOG_KEY, null);
    const at = Number(saved?.at || 0);
    if (!at || Date.now() - at > CAMPAIGN_CATALOG_TTL_MS || !Array.isArray(saved?.campaigns)) {
      return { at: 0, campaigns: [] };
    }
    return { at, campaigns: saved.campaigns };
  }

  function loadCampaignMemory() {
    if (typeof productResetting !== 'undefined' && productResetting) return { updatedAt: 0, campaigns: {} };
    try {
      const scopedKey = scopedLocalStorageKey(CAMPAIGN_MEMORY_KEY);
      const resetKey = scopedLocalStorageKey(CAMPAIGN_MEMORY_RESET_KEY);
      let resetMarker = {};
      try { resetMarker = JSON.parse(localStorage.getItem(resetKey) || "{}"); } catch (_) { resetMarker = {}; }
      if (cleanText(resetMarker?.version) !== CAMPAIGN_MEMORY_RESET_VERSION) {
        const resetAt = Date.now();
        localStorage.removeItem(scopedKey);
        if (legacyStateBelongsToCurrentAccount()) localStorage.removeItem(CAMPAIGN_MEMORY_KEY);
        localStorage.setItem(resetKey, JSON.stringify({
          version: CAMPAIGN_MEMORY_RESET_VERSION,
          at: resetAt,
        }));
        return { updatedAt: resetAt, campaigns: {} };
      }

      let raw = localStorage.getItem(scopedKey);
      if (raw == null && legacyStateBelongsToCurrentAccount()) {
        const legacy = localStorage.getItem(CAMPAIGN_MEMORY_KEY);
        if (legacy != null) {
          localStorage.setItem(scopedKey, legacy);
          localStorage.removeItem(CAMPAIGN_MEMORY_KEY);
          raw = legacy;
        }
      }
      const saved = JSON.parse(raw || "{}");
      const loaded = saved && typeof saved === "object" && saved.campaigns && typeof saved.campaigns === "object"
        ? saved
        : { updatedAt: 0, campaigns: {} };
      return reopenPageScrapedCampaignMemory(loaded);
    } catch (_) {
      return { updatedAt: 0, campaigns: {} };
    }
  }

  function isPageScrapedCampaignKey(key) {
    return /^page:/i.test(cleanText(key));
  }

  function reopenPageScrapedCampaignMemory(memory = campaignMemory) {
    const records = memory?.campaigns;
    if (!records || typeof records !== "object") return memory || { updatedAt: 0, campaigns: {} };
    let changed = false;
    for (const [key, record] of Object.entries(records)) {
      if (!isPageScrapedCampaignKey(key) || !record) continue;
      if (!record.completedAt && cleanText(record.status).toLowerCase() !== "completed") continue;
      records[key] = {
        ...record,
        status: "open",
        completedAt: null,
        source: record.source || "page-scrape-reopen",
      };
      changed = true;
    }
    if (changed) {
      memory.updatedAt = Date.now();
      try { localStorage.setItem(scopedLocalStorageKey(CAMPAIGN_MEMORY_KEY), JSON.stringify(memory)); } catch (_) { /* ignore */ }
    }
    return memory;
  }

  function saveCampaignMemory() {
    if (typeof productResetting !== 'undefined' && productResetting) return;
    campaignMemory.updatedAt = Date.now();
    try { localStorage.setItem(scopedLocalStorageKey(CAMPAIGN_MEMORY_KEY), JSON.stringify(campaignMemory)); } catch (_) { /* ignore storage quota failures */ }
  }

  function campaignGameName(campaignOrDrop) {
    if (!campaignOrDrop || typeof campaignOrDrop !== "object") return "";
    if (typeof campaignOrDrop.game === "string") return cleanText(campaignOrDrop.game);
    return cleanText(campaignOrDrop.game?.displayName || campaignOrDrop.game?.name || "");
  }

  function ignoredCampaignGameKey(value) {
    return normalizeGameName(value);
  }

  function loadIgnoredCampaignGames(now = Date.now()) {
    try {
      const saved = JSON.parse(localStorage.getItem(scopedLocalStorageKey(IGNORED_CAMPAIGN_GAMES_KEY)) || "{}");
      const games = saved?.games && typeof saved.games === "object" ? saved.games : {};
      const retained = {};
      for (const [storedKey, record] of Object.entries(games)) {
        const game = cleanText(record?.game || storedKey);
        const key = ignoredCampaignGameKey(game || storedKey);
        const expiresAt = Number(record?.expiresAt || 0);
        if (!key || !Number.isFinite(expiresAt) || expiresAt <= now) continue;
        retained[key] = {
          game: game || storedKey,
          expiresAt,
          ignoredAt: Number(record?.ignoredAt || saved?.updatedAt || now),
        };
      }
      return { updatedAt: Number(saved?.updatedAt || 0), games: retained };
    } catch (_) {
      return { updatedAt: 0, games: {} };
    }
  }

  function saveIgnoredCampaignGames() {
    if (typeof productResetting !== 'undefined' && productResetting) return;
    ignoredCampaignGames.updatedAt = Date.now();
    try {
      localStorage.setItem(
        scopedLocalStorageKey(IGNORED_CAMPAIGN_GAMES_KEY),
        JSON.stringify(ignoredCampaignGames),
      );
    } catch (_) { /* ignore storage quota failures */ }
  }

  function pruneIgnoredCampaignGames(now = Date.now()) {
    let changed = false;
    ignoredCampaignGames.games = ignoredCampaignGames.games || {};
    for (const [key, record] of Object.entries(ignoredCampaignGames.games)) {
      const expiresAt = Number(record?.expiresAt || 0);
      if (Number.isFinite(expiresAt) && expiresAt > now) continue;
      delete ignoredCampaignGames.games[key];
      changed = true;
    }
    if (changed) saveIgnoredCampaignGames();
    return changed;
  }

  function campaignGameIsIgnored(campaignOrDrop, now = Date.now()) {
    pruneIgnoredCampaignGames(now);
    const key = ignoredCampaignGameKey(campaignGameName(campaignOrDrop));
    if (!key) return false;
    return Number(ignoredCampaignGames.games?.[key]?.expiresAt || 0) > now;
  }

  function setCampaignGameIgnored(game, expiresAt, ignored, now = Date.now()) {
    const label = cleanText(game);
    const key = ignoredCampaignGameKey(label);
    if (!key) return false;
    pruneIgnoredCampaignGames(now);
    ignoredCampaignGames.games = ignoredCampaignGames.games || {};
    if (!ignored) {
      if (!ignoredCampaignGames.games[key]) return false;
      delete ignoredCampaignGames.games[key];
      saveIgnoredCampaignGames();
      return true;
    }

    const endMs = Number(expiresAt || 0);
    if (!Number.isFinite(endMs) || endMs <= now) return false;
    const prior = ignoredCampaignGames.games[key];
    ignoredCampaignGames.games[key] = {
      game: label,
      expiresAt: Math.max(endMs, Number(prior?.expiresAt || 0)),
      ignoredAt: Number(prior?.ignoredAt || now),
    };
    saveIgnoredCampaignGames();
    return true;
  }

  function campaignMemoryResetMarker() {
    try {
      const parsed = JSON.parse(localStorage.getItem(scopedLocalStorageKey(CAMPAIGN_MEMORY_RESET_KEY)) || "{}");
      return {
        version: cleanText(parsed?.version) || null,
        at: Number(parsed?.at || 0),
      };
    } catch (_) {
      return { version: null, at: 0 };
    }
  }

  function campaignWatchDrops(campaign) {
    return (campaign?.timeBasedDrops || campaign?.drops || []).filter((drop) => (
      !requiresSubscription(drop) && Number(drop?.requiredMinutesWatched || 0) > 0
    ));
  }

  function campaignWatchDropsComplete(campaign) {
    const drops = campaignWatchDrops(campaign);
    return Boolean(drops.length && drops.every((drop) => {
      const required = Number(drop?.requiredMinutesWatched || 0);
      const current = Number(drop?.self?.currentMinutesWatched || 0);
      return Boolean(drop?.self?.isClaimed) || current >= required;
    }));
  }

  function campaignMarkedComplete(campaignOrKey) {
    const key = typeof campaignOrKey === "string" ? campaignOrKey : campaignKey(campaignOrKey);
    if (!key) return false;
    if (!isPageScrapedCampaignKey(key)) {
      return Boolean(campaignMemory.campaigns?.[key]?.completedAt);
    }
    const campaign = typeof campaignOrKey === "object" && campaignOrKey ? campaignOrKey : null;
    const game = campaignTitleKey(campaign?.game?.displayName || campaign?.game?.name || "");
    return Boolean(game && gameHasCompletedCampaignMemory(game));
  }

  function gameHasCompletedCampaignMemory(gameName) {
    const wanted = campaignTitleKey(gameName);
    if (!wanted) return false;
    for (const record of Object.values(campaignMemory?.campaigns || {})) {
      if (!record?.completedAt) continue;
      if (campaignTitleKey(record.game) === wanted) return true;
    }
    return false;
  }

  function rememberCampaignStates(campaigns, source = "unknown") {
    const now = Date.now();
    const records = campaignMemory.campaigns || {};
    let changed = false;

    for (const [key, record] of Object.entries(records)) {
      const endMs = Date.parse(record?.endAt || "") || 0;
      if (endMs && now - endMs > CAMPAIGN_MEMORY_RETENTION_MS) {
        delete records[key];
        changed = true;
      }
    }

    for (const campaign of campaigns || []) {
      const key = campaignKey(campaign);
      if (!key) continue;
      const prior = records[key] || {};
      const drops = campaignWatchDrops(campaign);
      const pageScraped = isPageScrapedCampaignKey(key);
      const completeNow = !pageScraped && campaignWatchDropsComplete(campaign);
      const completedAt = pageScraped ? 0 : (prior.completedAt || (completeNow ? now : 0));
      const next = {
        id: campaign?.id || prior.id || "",
        name: campaign?.name || prior.name || "",
        game: campaign?.game?.displayName || campaign?.game?.name || prior.game || "",
        startAt: campaign?.startAt || prior.startAt || "",
        endAt: campaign?.endAt || prior.endAt || "",
        status: completedAt ? "completed" : (campaignIsOpen(campaign, null, now) ? "open" : cleanText(campaign?.status).toLowerCase() || "seen"),
        completedAt,
        seenAt: now,
        watchDrops: drops.length,
        completedWatchDrops: drops.filter((drop) => {
          const required = Number(drop?.requiredMinutesWatched || 0);
          return Boolean(drop?.self?.isClaimed) || Number(drop?.self?.currentMinutesWatched || 0) >= required;
        }).length,
        source,
      };
      if (JSON.stringify(prior) !== JSON.stringify(next)) {
        records[key] = next;
        changed = true;
      }
      if (completeNow && !prior.completedAt) {
        logActivity("campaign-complete", `Remembered completed campaign ${next.name || next.game}`, {
          campaignKey: key,
          game: next.game || null,
          endAt: next.endAt || null,
        });
      }
    }

    campaignMemory.campaigns = records;
    if (changed) saveCampaignMemory();
    return records;
  }

  function markCampaignCompleted(key, details = {}) {
    const campaignKeyValue = cleanText(key);
    if (!campaignKeyValue) return false;
    // Page-scraped rows may expire by end date; other completion paths still skip them.
    if (
      isPageScrapedCampaignKey(campaignKeyValue) &&
      cleanText(details.source).toLowerCase() !== "campaign-ended"
    ) {
      return false;
    }
    const now = Date.now();
    const prior = campaignMemory.campaigns?.[campaignKeyValue] || {};
    if (prior.completedAt) return true;
    campaignMemory.campaigns = campaignMemory.campaigns || {};
    campaignMemory.campaigns[campaignKeyValue] = {
      ...prior,
      id: details.id || prior.id || "",
      name: details.name || prior.name || "",
      game: details.game || prior.game || "",
      startAt: details.startAt || prior.startAt || "",
      endAt: details.endAt || prior.endAt || "",
      status: cleanText(details.status).toLowerCase() || "completed",
      completedAt: now,
      seenAt: now,
      source: details.source || "inventory-audit",
    };
    saveCampaignMemory();
    return true;
  }

  function markCampaignCompleteIfWatchDone(campaign, source = "watch-progress-complete") {
    if (!campaign || !campaignWatchDrops(campaign).length || !campaignWatchDropsComplete(campaign)) return false;
    const key = campaignKey(campaign);
    const game = campaign?.game?.displayName || campaign?.game?.name || "";
    return markCampaignCompleted(key, {
      id: campaign?.id || "",
      name: campaign?.name || game,
      game,
      startAt: campaign?.startAt || "",
      endAt: campaign?.endAt || "",
      source,
    });
  }

  function openCampaignsFromMemory(now = Date.now(), options = {}) {
    const campaigns = [];
    for (const [key, record] of Object.entries(campaignMemory?.campaigns || {})) {
      if (!record || record.completedAt) continue;
      const status = cleanText(record.status).toLowerCase();
      if (status === "expired" || status === "completed" || status === "closed") continue;
      const game = cleanText(record.game);
      if (!game || campaignIsExcluded({ game, campaign: record.name || "", gameSlug: "" })) continue;
      const memoryState = campaignMemoryRoutingState(key, now, options);
      if (!memoryState.open) continue;
      const watchDrops = Math.max(1, Number(record.watchDrops || 1));
      const completedWatchDrops = Math.max(0, Number(record.completedWatchDrops || 0));
      if (completedWatchDrops >= watchDrops) continue;
      // Campaign memory proves prior identity/window state only. It does not
      // prove the current Drop duration or credited minutes.
      const drops = [];
      campaigns.push({
        id: record.id || key,
        name: cleanText(record.name) || game,
        status: "ACTIVE",
        startAt: record.startAt || "",
        endAt: record.endAt || "",
        game: {
          id: "",
          displayName: game,
          name: game,
          slug: "",
        },
        timeBasedDrops: drops,
      });
    }
    return campaigns;
  }

  function parseCampaignDateRange(text) {
    const match = cleanText(text).match(
      /([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i,
    );
    if (!match) return { startAt: "", endAt: "" };
    const now = Date.now();
    const year = new Date(now).getFullYear();
    const candidates = [];
    for (const startYear of [year - 1, year, year + 1]) {
      const startMs = Date.parse(`${match[1]} ${startYear}`);
      let endMs = Date.parse(`${match[2]} ${startYear}`);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      // Twitch omits the year; ranges that cross New Year need the end bumped forward.
      if (endMs < startMs) endMs = Date.parse(`${match[2]} ${startYear + 1}`);
      if (!Number.isFinite(endMs) || endMs <= startMs) continue;
      candidates.push({ startMs, endMs });
    }
    if (!candidates.length) return { startAt: "", endAt: "" };
    // Prefer the range containing now. Otherwise choose the nearest upcoming
    // range, then the most recently ended range. Section membership remains
    // authoritative; this only resolves Twitch's omitted year safely.
    const containing = candidates
      .filter((item) => item.startMs <= now && item.endMs > now)
      .sort((a, b) => a.endMs - b.endMs)[0];
    const upcoming = candidates
      .filter((item) => item.startMs > now)
      .sort((a, b) => a.startMs - b.startMs)[0];
    const recent = candidates
      .filter((item) => item.endMs <= now)
      .sort((a, b) => b.endMs - a.endMs)[0];
    const selected = containing || upcoming || recent;
    return {
      startAt: selected ? new Date(selected.startMs).toISOString() : "",
      endAt: selected ? new Date(selected.endMs).toISOString() : "",
    };
  }

  function campaignsPageMainRoot() {
    return (
      document.querySelector("main.twilight-main .drops-root__content") ||
      document.querySelector("main.twilight-main") ||
      document.querySelector("main") ||
      document
    );
  }

  function findCampaignsSectionMarker(main, section) {
    const pattern = section === "open"
      ? /^open\s+(?:drop|reward)\s+campaigns$/i
      : /^closed\s+(?:drop|reward)\s+campaigns$/i;
    return [...main.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], div, span, p')].find((el) => (
      pattern.test(cleanText(el.textContent || ""))
    )) || null;
  }

  function findCampaignsOpenMarker(main = campaignsPageMainRoot()) {
    return findCampaignsSectionMarker(main, "open");
  }

  function findCampaignsClosedMarker(main = campaignsPageMainRoot()) {
    return findCampaignsSectionMarker(main, "closed");
  }

  function nodeIsWithinOpenCampaignSection(node, main = campaignsPageMainRoot()) {
    if (!node) return false;
    const openMarker = findCampaignsOpenMarker(main);
    if (!openMarker) return false;
    const afterOpen = Boolean(openMarker.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!afterOpen) return false;
    const closedMarker = findCampaignsClosedMarker(main);
    if (!closedMarker) {
      // If Twitch says a Closed section exists but its boundary cannot be
      // located, fail closed rather than treating the rest of the page as open.
      const pageText = cleanText(main.innerText || main.textContent || "");
      return !/closed\s+(?:drop|reward)\s+campaigns/i.test(pageText);
    }
    return Boolean(node.compareDocumentPosition(closedMarker) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function openCampaignAccordionHeadings(main = campaignsPageMainRoot()) {
    return [...main.querySelectorAll(
      '.accordion-header[role="heading"][aria-level="3"], .accordion-header[role="heading"], [role="heading"][aria-level="3"]',
    )].filter((heading) => {
      if (!main.contains(heading)) return false;
      if (!heading.querySelector("button[aria-expanded]")) return false;
      return nodeIsWithinOpenCampaignSection(heading, main);
    });
  }

  function openCampaignAccordionButtons(main = campaignsPageMainRoot()) {
    return openCampaignAccordionHeadings(main).map((heading) => {
      const button = heading.querySelector(":scope > button[aria-expanded]") || heading.querySelector("button[aria-expanded]");
      return button ? { heading, button } : null;
    }).filter(Boolean);
  }

  function campaignDateLeafNodes(main = campaignsPageMainRoot()) {
    return [...main.querySelectorAll("div, span, p")].filter((node) => {
      if (!node || node.children.length > 0) return false;
      if (!nodeIsWithinOpenCampaignSection(node, main)) return false;
      const text = cleanText(node.textContent);
      return /\w+,\s+\w+\s+\d/.test(text) && /[-–]/.test(text) && /\b(?:AM|PM)\b/i.test(text);
    });
  }

  function detectCampaignsPageDisplay(main = campaignsPageMainRoot()) {
    const pageText = main.innerText || "";
    const hasOpenDropSection = /Open Drop Campaigns/i.test(pageText);
    const hasOpenRewardSection = /Open Reward Campaigns/i.test(pageText);
    const hasClosedSection = /Closed\s+(?:Drop|Reward)\s+Campaigns/i.test(pageText);
    const hasEmptyMessage = /There are no Drops campaigns available currently/i.test(pageText);
    const accordionHeaders = openCampaignAccordionHeadings(main).length;
    const dateLeaves = campaignDateLeafNodes(main).length;
    let mode = CAMPAIGN_PAGE_DISPLAY.UNKNOWN;
    if (accordionHeaders > 0) {
      mode = CAMPAIGN_PAGE_DISPLAY.ACCORDION;
    } else if (dateLeaves > 0 || (hasOpenDropSection && !hasEmptyMessage && /[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d/.test(pageText))) {
      mode = CAMPAIGN_PAGE_DISPLAY.TEXT_BLOCK;
    } else if (hasEmptyMessage && accordionHeaders === 0 && dateLeaves === 0) {
      mode = CAMPAIGN_PAGE_DISPLAY.EMPTY;
    } else if (!hasOpenDropSection && !hasOpenRewardSection && !hasClosedSection && !hasEmptyMessage) {
      mode = CAMPAIGN_PAGE_DISPLAY.LOADING;
    }
    lastCampaignPageDisplay = {
      mode,
      accordionHeaders,
      dateLeaves,
      hasEmptyMessage,
      hasOpenDropSection,
      hasOpenRewardSection,
      hasClosedSection,
      at: Date.now(),
    };
    return lastCampaignPageDisplay;
  }

  function scrapeCampaignsFromPage() {
    if (!isCampaigns()) return [];
    const campaigns = [];
    const seen = new Set();
    const main = campaignsPageMainRoot();
    const display = detectCampaignsPageDisplay(main);

    const pushCampaign = (game, dateText = "") => {
      const title = cleanText(game);
      if (!title || campaignIsExcluded({ game: title, campaign: title, gameSlug: "" })) return;
      if (/^(inventory|all campaigns|open drop campaigns|open reward campaigns|closed drop campaigns|closed reward campaigns|social media badge|drops?|campaign)$/i.test(title)) return;
      const key = campaignTitleKey(title);
      if (!key || seen.has(key)) return;
      const { startAt, endAt } = parseCampaignDateRange(dateText);
      const startMs = Date.parse(startAt || "") || 0;
      const endMs = Date.parse(endAt || "") || 0;
      // Page-derived campaigns are routing hints, so unknown or malformed
      // windows must never be promoted to ACTIVE.
      if (!startMs || !endMs || endMs <= startMs || endMs <= Date.now()) return;
      seen.add(key);
      campaigns.push({
        id: `page:${key}`,
        name: title,
        status: "ACTIVE",
        startAt,
        endAt,
        game: {
          id: "",
          displayName: title,
          name: title,
          slug: "",
        },
        // The All Campaigns page proves membership and dates, not the actual
        // reward duration. Keep this as a shell until Twitch supplies Drop details.
        timeBasedDrops: [],
      });
    };

    const readGameFromCampaignRoot = (root, dateText = "") => {
      if (!root) return "";
      const image = root.querySelector?.("img.tw-image, img[alt]");
      let game = cleanText(image?.getAttribute("alt") || "");
      if (!game || /drops?|campaign|image|logo/i.test(game)) {
        const lines = cleanText(root.textContent || "")
          .split(/\n+/)
          .map((line) => cleanText(line))
          .filter(Boolean);
        game = lines.find((line) => (
          line.length > 1 &&
          line.length < 80 &&
          line !== dateText &&
          !/\b(?:AM|PM)\b/i.test(line) &&
          !/^\w+,\s+\w+\s+\d/i.test(line) &&
          !/^(inventory|all campaigns|open drop campaigns|open reward campaigns|social media badge)$/i.test(line)
        )) || "";
      }
      return game;
    };

    const readDateFromRoot = (root) => {
      if (!root) return "";
      for (const node of root.querySelectorAll?.("div, span, p") || []) {
        const text = cleanText(node.textContent);
        if (node.children.length === 0 && /\w+,\s+\w+\s+\d/.test(text) && /[-–]/.test(text)) {
          return text;
        }
      }
      const headingText = cleanText(root.textContent || "");
      const range = headingText.match(/\w+,\s+\w+\s+\d[\s\S]{0,40}[-–][\s\S]{0,40}\d:\d{2}\s*(?:AM|PM)/i);
      return cleanText(range?.[0] || "");
    };

    // Accordion display: Twitch lists each open campaign as an expandable heading row.
    if (
      display.mode === CAMPAIGN_PAGE_DISPLAY.ACCORDION ||
      display.mode === CAMPAIGN_PAGE_DISPLAY.UNKNOWN ||
      display.accordionHeaders > 0
    ) {
      for (const { heading, button } of openCampaignAccordionButtons(main)) {
        const dateText = readDateFromRoot(button) || readDateFromRoot(heading);
        const game = readGameFromCampaignRoot(button, dateText) || readGameFromCampaignRoot(heading, dateText);
        pushCampaign(game, dateText);
      }
    }

    // Date-leaf / text-row display: campaign windows appear without accordion buttons.
    if (
      campaigns.length < PAGE_CAMPAIGN_IMPORT_MIN &&
      (
        display.mode === CAMPAIGN_PAGE_DISPLAY.TEXT_BLOCK ||
        display.mode === CAMPAIGN_PAGE_DISPLAY.UNKNOWN ||
        display.dateLeaves > 0
      )
    ) {
      for (const dateNode of campaignDateLeafNodes(main)) {
        const dateText = cleanText(dateNode.textContent);
        let root = dateNode.parentElement;
        for (let depth = 0; depth < 6 && root; depth += 1) {
          const game = readGameFromCampaignRoot(root, dateText);
          if (game) {
            pushCampaign(game, dateText);
            break;
          }
          root = root.parentElement;
        }
      }
    }

    // Plain Open Drop Campaigns text block: game / publisher / date range triples.
    if (
      campaigns.length < PAGE_CAMPAIGN_IMPORT_MIN &&
      display.mode !== CAMPAIGN_PAGE_DISPLAY.EMPTY
    ) {
      const pageText = main.innerText || "";
      const openIdx = pageText.search(/Open (?:Drop|Reward) Campaigns/i);
      if (openIdx >= 0) {
        let section = pageText.slice(openIdx);
        const closedIdx = section.search(/\nClosed\s+(?:Drop|Reward)\s+Campaigns/i);
        if (closedIdx >= 0) section = section.slice(0, closedIdx);
        if (!/There are no Drops campaigns available currently/i.test(section)) {
          const blockRe = /^([^\n]{2,80})\n([^\n]{2,80})\n((?:[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(?:[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))[^\n]*)$/gm;
          let match;
          while ((match = blockRe.exec(section))) {
            const game = cleanText(match[1]);
            const publisher = cleanText(match[2]);
            const dateText = cleanText(match[3]);
            if (/^(open (?:drop|reward) campaigns|some drops campaigns|to include drops|learn more|rewards are limited)/i.test(game)) continue;
            if (/\b(?:AM|PM)\b/i.test(game) || /\b(?:AM|PM)\b/i.test(publisher)) continue;
            pushCampaign(game, dateText);
          }
        }
      }
    }

    if (campaigns.length) {
      const signature = `${display.mode}:${campaigns.length}:${campaigns.slice(0, 8).map((item) => item.game?.displayName || item.name).join("|")}`;
      if (signature !== lastCampaignPageScanSignature) {
        lastCampaignPageScanSignature = signature;
        logActivity("campaign-page-scan", `Read ${campaigns.length} open campaigns from All Campaigns (${display.mode})`, {
          display: display.mode,
          accordionHeaders: display.accordionHeaders,
          dateLeaves: display.dateLeaves,
          games: campaigns.slice(0, 8).map((item) => item.game?.displayName || item.name),
        });
      }
    } else if (display.mode === CAMPAIGN_PAGE_DISPLAY.EMPTY) {
      const signature = `empty:${display.hasEmptyMessage ? 1 : 0}`;
      if (signature !== lastCampaignPageScanSignature) {
        lastCampaignPageScanSignature = signature;
        logActivity("campaign-page-scan", "All Campaigns page reports no open Drop campaigns in this view", {
          display: display.mode,
        });
      }
    }
    return campaigns;
  }

  let campaignsPageEnrichmentPromise = null;

  function campaignsPageScroller() {
    return document.querySelector('[data-a-target="root-scroller"]') || document.scrollingElement || document.documentElement;
  }

  async function scrollLoadAndExpandCampaignsPage() {
    if (!isCampaigns()) return scrapeCampaignsFromPage();
    const scrollable = campaignsPageScroller();
    if (!scrollable) return scrapeCampaignsFromPage();
    const originalTop = Number(scrollable.scrollTop || 0);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const main = campaignsPageMainRoot();
    const headingButtons = () => openCampaignAccordionButtons(main);

    try {
      scrollable.scrollTop = 0;
      scrollable.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(300);
      let stableBottomPasses = 0;
      let previousTop = -1;
      for (let pass = 0; pass < 120 && stableBottomPasses < 3; pass += 1) {
        for (const { button } of headingButtons()) {
          if (button.getAttribute("aria-expanded") === "true") continue;
          try { button.click(); } catch (_) { /* ignore */ }
          await sleep(40);
          if (button.getAttribute("aria-expanded") === "true") {
            try { button.click(); } catch (_) { /* ignore */ }
          }
        }
        const maxTop = Math.max(0, (scrollable.scrollHeight || 0) - (scrollable.clientHeight || 0));
        const atBottom = scrollable.scrollTop >= maxTop - 4;
        if (atBottom) {
          stableBottomPasses += 1;
          await sleep(280);
        } else {
          stableBottomPasses = 0;
          const step = Math.max(240, Math.floor((scrollable.clientHeight || 600) * 0.72));
          const nextTop = Math.min(maxTop, scrollable.scrollTop + step);
          if (nextTop === previousTop) stableBottomPasses += 1;
          previousTop = scrollable.scrollTop;
          scrollable.scrollTop = nextTop;
          scrollable.dispatchEvent(new Event("scroll", { bubbles: true }));
          await sleep(220);
        }
      }
    } finally {
      try {
        scrollable.scrollTop = originalTop;
        scrollable.dispatchEvent(new Event("scroll", { bubbles: true }));
      } catch (_) { /* ignore */ }
    }
    return scrapeCampaignsFromPage();
  }

  function markCampaignPageImport(count, source = "campaigns-page", display = "") {
    const total = Math.max(0, Number(count) || 0);
    const mode = cleanText(display) || lastCampaignPageDisplay.mode || CAMPAIGN_PAGE_DISPLAY.UNKNOWN;
    lastCampaignPageImportCount = total;
    lastCampaignPageImportAt = Date.now();
    lastCampaignsPageEnrichmentFinishedAt = lastCampaignPageImportAt;
    lastCampaignPageImportDisplay = mode;
    lastCampaignPageImportSource = cleanText(source) || "campaigns-page";
    try {
      writeSession(CAMPAIGN_PAGE_IMPORT_KEY, {
        at: lastCampaignPageImportAt,
        finishedAt: lastCampaignsPageEnrichmentFinishedAt,
        count: total,
        source: lastCampaignPageImportSource,
        display: mode,
      });
    } catch (_) { /* ignore */ }
    logActivity("campaign-page-import", `Imported ${total} open All Campaigns rows into memory`, {
      source: lastCampaignPageImportSource,
      display: mode,
      pageScraped: pageScrapedCampaignsFromCatalog().length,
      memoryOpen: openCampaignsFromMemory().length,
    });
  }

  function importedOpenCampaignCount() {
    const now = Date.now();
    const pageCount = pageScrapedCampaignsFromCatalog().length;
    const memoryPageCount = Object.entries(campaignMemory?.campaigns || {}).filter(([key, record]) => (
      (() => {
        if (!record || record.completedAt || cleanText(record.status).toLowerCase() !== "open") return false;
        if (!isPageScrapedCampaignKey(key) && !isPageScrapedCampaignKey(record.id || "")) return false;
        const startMs = Date.parse(record.startAt || "") || 0;
        const endMs = Date.parse(record.endAt || "") || 0;
        return Boolean(startMs && endMs && endMs > startMs && startMs <= now && endMs > now);
      })()
    )).length;
    return Math.max(pageCount, memoryPageCount, lastCampaignPageImportCount);
  }

  function hasFreshCampaignPageImport(now = Date.now()) {
    const count = importedOpenCampaignCount();
    if (!lastCampaignsPageEnrichmentFinishedAt) return false;
    const age = now - lastCampaignsPageEnrichmentFinishedAt;
    if (age < 0) return false;
    // A large campaign-memory cache is not proof that the current All Campaigns
    // page was audited recently. Every positive import must still be fresh.
    if (count > 0 && age < PAGE_CAMPAIGN_IMPORT_TTL_MS) return true;
    // Empty or timed-out zero imports are only briefly "done" so Dropper retries soon
    // instead of treating a region-empty DOM as a 30-minute successful scrape.
    if (
      count <= 0 &&
      age < PAGE_CAMPAIGN_IMPORT_EMPTY_TTL_MS &&
      (
        lastCampaignPageImportDisplay === CAMPAIGN_PAGE_DISPLAY.EMPTY ||
        lastCampaignPageImportDisplay === CAMPAIGN_PAGE_DISPLAY.TIMEOUT ||
        /timeout/i.test(lastCampaignPageImportSource)
      )
    ) {
      return true;
    }
    return false;
  }

  function needsCampaignPageImport(now = Date.now()) {
    return !hasFreshCampaignPageImport(now);
  }

  function scheduleCampaignsPageCatalogEnrichment(source = "campaigns-page-scroll") {
    if (!isCampaigns() || campaignsPageEnrichmentPromise) return campaignsPageEnrichmentPromise;
    campaignsPageEnrichmentPromise = scrollLoadAndExpandCampaignsPage()
      .then(async (campaigns) => {
        const pageList = Array.isArray(campaigns) ? campaigns : [];
        let list = pageList;
        let display = detectCampaignsPageDisplay();
        const authoritativePageDisplay = [
          CAMPAIGN_PAGE_DISPLAY.ACCORDION,
          CAMPAIGN_PAGE_DISPLAY.TEXT_BLOCK,
          CAMPAIGN_PAGE_DISPLAY.EMPTY,
        ].includes(display.mode);
        if (authoritativePageDisplay) {
          // The completed scroll is the authoritative membership snapshot for
          // synthetic page rows. Replace that subset so rows moved to Closed
          // Campaigns cannot survive forever through catalog unioning.
          replacePageScrapedCampaignCatalog(pageList, `${source}-final`);
          if (pageList.length) clearGqlFailurePause(source);
        } else if (pageList.length) {
          rememberCampaignCatalog(pageList, source);
          clearGqlFailurePause(source);
        }
        // DOM can be region-empty while authenticated GQL still returns this account's open list.
        if (list.length < PAGE_CAMPAIGN_IMPORT_MIN && getToken()) {
          try {
            const authList = await importOpenCampaignsViaAuth(`${source}-auth`);
            if (Array.isArray(authList) && authList.length > list.length) {
              list = authList;
              display = { ...display, mode: CAMPAIGN_PAGE_DISPLAY.GQL_AUTH };
            }
          } catch (_) { /* auth import logs its own failure */ }
        }
        markCampaignPageImport(
          Math.max(list.length, pageScrapedCampaignsFromCatalog().length, lastCampaignPageImportCount),
          source,
          display.mode === CAMPAIGN_PAGE_DISPLAY.EMPTY && list.length
            ? CAMPAIGN_PAGE_DISPLAY.GQL_AUTH
            : display.mode,
        );
        return list;
      })
      .catch(() => {
        lastCampaignsPageEnrichmentFinishedAt = Date.now();
        return [];
      })
      .finally(() => {
        campaignsPageEnrichmentPromise = null;
      });
    return campaignsPageEnrichmentPromise;
  }

  function overlayCurrentDropProgressOnCampaigns(campaigns = [], active = currentDrop) {
    if (!Array.isArray(campaigns) || !active) return campaigns || [];
    const activeKey = cleanText(active.campaignKey || active.campaignId).toLowerCase();
    const activeCampaignId = cleanText(active.campaignId);
    const activeCampaignName = cleanText(active.campaign).toLowerCase();
    const activeGame = cleanText(active.game).toLowerCase();
    const activeDropId = cleanText(active.id);
    const activeDropName = cleanText(active.name).toLowerCase();
    const activeMinutes = Number(active.currentMinutes);
    const activeRequired = Number(active.requiredMinutes);
    if (!activeKey && !activeCampaignId && !activeCampaignName) return campaigns;
    if (!activeDropId && !activeDropName) return campaigns;
    if (!Number.isFinite(activeMinutes) && !active.isClaimed) return campaigns;

    return campaigns.map((campaign) => {
      const key = campaignKey(campaign);
      const campaignName = cleanText(campaign?.name).toLowerCase();
      const campaignGame = cleanText(campaign?.game?.displayName || campaign?.game?.name).toLowerCase();
      const campaignMatches = Boolean(
        (activeKey && key === activeKey) ||
        (activeCampaignId && cleanText(campaign?.id) === activeCampaignId) ||
        (
          activeCampaignName &&
          campaignName === activeCampaignName &&
          (!activeGame || !campaignGame || campaignGame === activeGame)
        )
      );
      if (!campaignMatches) return campaign;

      const sourceDrops = campaign?.timeBasedDrops || campaign?.drops || [];
      let changed = false;
      const drops = sourceDrops.map((drop) => {
        const dropId = cleanText(drop?.id);
        const dropName = cleanText(drop?.name || drop?.benefitEdges?.[0]?.benefit?.name || "").toLowerCase();
        const matches = Boolean(
          (activeDropId && dropId && activeDropId === dropId) ||
          (activeDropName && dropName && activeDropName === dropName)
        );
        if (!matches) return drop;

        const previousMinutes = Number(drop?.self?.currentMinutesWatched || 0);
        const nextMinutes = Number.isFinite(activeMinutes)
          ? Math.max(previousMinutes, activeMinutes)
          : previousMinutes;
        const nextClaimed = Boolean(drop?.self?.isClaimed || active.isClaimed);
        const previousRequired = Number(drop?.requiredMinutesWatched || 0);
        const nextRequired = previousRequired > 0
          ? previousRequired
          : (Number.isFinite(activeRequired) && activeRequired > 0 ? activeRequired : previousRequired);

        if (
          nextMinutes === previousMinutes &&
          nextClaimed === Boolean(drop?.self?.isClaimed) &&
          nextRequired === previousRequired
        ) {
          return drop;
        }

        changed = true;
        return {
          ...drop,
          requiredMinutesWatched: nextRequired,
          self: {
            ...(drop?.self || {}),
            currentMinutesWatched: nextMinutes,
            isClaimed: nextClaimed,
            dropInstanceID: drop?.self?.dropInstanceID || active.dropInstanceID || "",
          },
        };
      });

      if (!changed) return campaign;
      return {
        ...campaign,
        timeBasedDrops: drops,
        drops,
      };
    });
  }

  function suppressPageCampaignsWithAuthoritativeMatches(campaigns = [], now = Date.now()) {
    const authoritativeGames = new Set();
    for (const campaign of campaigns || []) {
      const key = campaignKey(campaign);
      if (!key || isPageScrapedCampaignKey(key)) continue;
      if (campaignMarkedComplete(campaign) || !campaignIsRoutingOpen(campaign, now)) continue;
      const game = campaignTitleKey(campaign?.game?.displayName || campaign?.game?.name || "");
      if (game) authoritativeGames.add(game);
    }
    if (!authoritativeGames.size) return campaigns || [];
    return (campaigns || []).filter((campaign) => {
      const key = campaignKey(campaign);
      if (!isPageScrapedCampaignKey(key)) return true;
      const game = campaignTitleKey(campaign?.game?.displayName || campaign?.game?.name || "");
      return !game || !authoritativeGames.has(game);
    });
  }

  function reconcilePageCurrentDropWithAuthoritativeCampaign(campaigns = []) {
    const activeKey = cleanText(currentDrop?.campaignKey || currentDrop?.campaignId || "");
    if (!currentDrop || !isPageScrapedCampaignKey(activeKey)) return false;
    const game = cleanText(currentDrop.game || "");
    if (!game) return false;

    const authoritative = (campaigns || []).filter((campaign) => {
      const key = campaignKey(campaign);
      if (!key || isPageScrapedCampaignKey(key)) return false;
      if (campaignMarkedComplete(campaign) || !campaignIsOpen(campaign)) return false;
      const campaignGame = campaign?.game?.displayName || campaign?.game?.name || "";
      return Boolean(campaignGame && gameNamesMatch(game, campaignGame));
    });
    if (!authoritative.length) return false;

    const replacement = pickTimedDrop(authoritative, game);
    if (!replacement || Number(replacement.requiredMinutes || 0) <= 0) return false;

    const previousKey = activeKey;
    adoptSelectedTargetDrop(replacement, "page-campaign-reconciled");

    const pending = getHandoffState();
    if (pending && (!pending.targetGame || gameNamesMatch(pending.targetGame, replacement.game || game))) {
      writeSession(NEXT_GAME_KEY, {
        ...pending,
        targetGame: replacement.game || pending.targetGame || game,
        targetSlug: replacement.gameSlug || pending.targetSlug || "",
        targetCampaign: replacement.campaign || pending.targetCampaign || replacement.game || game,
        targetCampaignKey: replacement.campaignKey || replacement.campaignId || "",
        selectedCampaignKey: replacement.campaignKey || replacement.campaignId || pending.selectedCampaignKey || "",
        selectedCampaignName: replacement.campaign || pending.selectedCampaignName || "",
        selectedCampaignGame: replacement.game || pending.selectedCampaignGame || "",
        selectedDropId: replacement.id || pending.selectedDropId || "",
        needsDropDetails: false,
      });
    }

    logActivity("campaign-reconcile", "Replaced page campaign shell with Twitch Drop details", {
      previousCampaignKey: previousKey,
      campaignKey: replacement.campaignKey || replacement.campaignId || null,
      campaign: replacement.campaign || null,
      game: replacement.game || game,
      drop: replacement.name || null,
      requiredMinutes: replacement.requiredMinutes,
    });
    return true;
  }

  // Rows fetched with DropCampaignDetails for routing, by campaign key. The
  // dashboard poll rebuilds the catalog from its own rows, so these are kept
  // apart and merged under live Inventory progress.
  const campaignDetailsCache = new Map();

  function routingCampaignPool(extra = [], now = Date.now()) {
    const merged = mergeCampaigns(
      mergeCampaigns(mergeCampaigns(lastCampaignCatalog, [...campaignDetailsCache.values()]), lastInventoryCampaigns),
      mergeCampaigns(openCampaignsFromMemory(now), mergeCampaigns(scrapeCampaignsFromPage(), extra)),
    );
    const preferred = suppressPageCampaignsWithAuthoritativeMatches(merged);
    const datedOpen = preferred.filter((campaign) => campaignIsRoutingOpen(campaign, now));
    return overlayCurrentDropProgressOnCampaigns(datedOpen, currentDrop);
  }
  function isPageCatalogSource(source = "") {
    return /campaigns-page|page-scrape|campaign-audit|integrity-fallback/i.test(cleanText(source));
  }

  function pageScrapedCampaignHasValidWindow(campaign, now = Date.now()) {
    const key = campaignKey(campaign);
    if (!isPageScrapedCampaignKey(key)) return false;
    const startMs = Date.parse(campaign?.startAt || "") || 0;
    const endMs = Date.parse(campaign?.endAt || "") || 0;
    return Boolean(startMs && endMs && endMs > startMs && endMs > now);
  }

  function replacePageScrapedCampaignCatalog(campaigns, source = "campaigns-page-final") {
    const now = Date.now();
    const pageCampaigns = (campaigns || []).filter((campaign) => pageScrapedCampaignHasValidWindow(campaign, now));
    const openKeys = new Set(pageCampaigns.map((campaign) => campaignKey(campaign)).filter(Boolean));
    const retained = (lastCampaignCatalog || []).filter((campaign) => !isPageScrapedCampaignKey(campaignKey(campaign)));

    let memoryChanged = false;
    campaignMemory.campaigns = campaignMemory.campaigns || {};
    for (const key of Object.keys(campaignMemory.campaigns)) {
      if (!isPageScrapedCampaignKey(key) || openKeys.has(key)) continue;
      delete campaignMemory.campaigns[key];
      memoryChanged = true;
    }
    if (memoryChanged) saveCampaignMemory();

    return persistCampaignCatalog(
      mergeCampaigns(retained, pageCampaigns),
      source,
    );
  }

  function rememberCampaignCatalog(campaigns, source = "unknown") {
    if (!Array.isArray(campaigns) || !campaigns.length) return lastCampaignCatalog;
    if (!lastCampaignCatalog.length) return persistCampaignCatalog(campaigns, source);
    // Partial All Campaigns scans grow the catalog while lazy loading. Once the
    // full page enrichment finishes, replacePageScrapedCampaignCatalog() prunes
    // page rows that Twitch moved into Closed Campaigns.
    if (isPageCatalogSource(source) || campaigns.some((item) => isPageScrapedCampaignKey(campaignKey(item)))) {
      return unionCampaignCatalog(campaigns, source);
    }
    return overlayKnownCampaignProgress(campaigns, source);
  }

  function persistCampaignCatalog(campaigns, source = "unknown") {
    if (typeof productResetting !== 'undefined' && productResetting) return lastCampaignCatalog;
    const previousCount = lastCampaignCatalog.length;
    const firstCaptureThisPage = lastCampaignCatalogAt < PAGE_STARTED_AT;
    lastCampaignCatalog = compactCampaignCatalog(campaigns || []);
    for (const campaign of lastCampaignCatalog) {
      const gameName = campaign?.game?.displayName || campaign?.game?.name || "";
      const gameSlug = campaign?.game?.slug || "";
      if (gameName && gameSlug) rememberCategorySlug(gameName, gameSlug, "twitch-gql");
    }
    lastCampaignCatalogAt = Date.now();
    campaignCatalogCache = { at: lastCampaignCatalogAt, campaigns: lastCampaignCatalog };
    try { writeSession(CAMPAIGN_CATALOG_KEY, campaignCatalogCache); } catch (_) { /* ignore storage quota failures */ }
    rememberCampaignStates(lastCampaignCatalog, source);
    if (firstCaptureThisPage || previousCount !== lastCampaignCatalog.length) {
      logActivity("campaign-catalog", `Saved ${lastCampaignCatalog.length} Twitch Drops campaigns`, { source });
    }
    return lastCampaignCatalog;
  }

  function overlayKnownCampaignProgress(campaigns, source = "unknown") {
    if (!Array.isArray(campaigns) || !campaigns.length) return lastCampaignCatalog;
    if (!lastCampaignCatalog.length) return persistCampaignCatalog(campaigns, source);
    const overlaid = lastCampaignCatalog.map((campaign) => {
      const key = campaignKey(campaign);
      const match = campaigns.find((item) => campaignKey(item) === key);
      return match ? mergeCampaigns([campaign], [match])[0] : campaign;
    });
    return persistCampaignCatalog(overlaid, source);
  }

  function unionCampaignCatalog(campaigns, source = "unknown") {
    if (!Array.isArray(campaigns) || !campaigns.length) return lastCampaignCatalog;
    if (!lastCampaignCatalog.length) return persistCampaignCatalog(campaigns, source);
    const merged = mergeCampaigns(lastCampaignCatalog, campaigns);
    return persistCampaignCatalog(merged, source);
  }

  function pageScrapedCampaignsFromCatalog(catalog = lastCampaignCatalog) {
    return (catalog || []).filter((campaign) => isPageScrapedCampaignKey(campaignKey(campaign)));
  }

  // ViewerDropsDashboard rows carry no rewards or allow list. Keep what an
  // earlier DropCampaignDetails request supplied instead of erasing it on every poll.
  function withKnownCampaignDetails(campaign, key = campaignKey(campaign)) {
    if ((campaign?.timeBasedDrops || campaign?.drops || []).length) return campaign;
    const prior = lastCampaignCatalog.find((item) => campaignKey(item) === key);
    if (!(prior?.timeBasedDrops || []).length) return campaign;
    return {
      ...campaign,
      timeBasedDrops: prior.timeBasedDrops,
      allow: campaign?.allow?.channels?.length ? campaign.allow : prior.allow,
    };
  }

  // A full campaign list from Twitch is authoritative for what is open. Close
  // memory records it no longer lists so routing stops picking them; a record
  // reopens when Twitch lists it again, because rememberCampaignStates
  // recomputes its status. Short lists are not trusted to be complete.
  function retireUnlistedMemoryCampaigns(campaigns, source = "viewer-drops-dashboard") {
    if (!Array.isArray(campaigns) || campaigns.length < PAGE_CAMPAIGN_IMPORT_MIN) return 0;
    const listed = new Set(campaigns.map((campaign) => campaignKey(campaign)).filter(Boolean));
    for (const campaign of lastInventoryCampaigns || []) listed.add(campaignKey(campaign));
    const active = cleanText(currentDrop?.campaignKey || currentDrop?.campaignId || "").toLowerCase();
    if (active) listed.add(active);
    const now = Date.now();
    const retired = [];
    for (const [key, record] of Object.entries(campaignMemory?.campaigns || {})) {
      if (!record || record.completedAt || listed.has(key) || isPageScrapedCampaignKey(key)) continue;
      if (["expired", "completed", "closed"].includes(cleanText(record.status).toLowerCase())) continue;
      campaignMemory.campaigns[key] = { ...record, status: "closed", closedAt: now, source };
      retired.push(record.name || key);
    }
    if (!retired.length) return 0;
    saveCampaignMemory();
    logActivity("campaign-memory", `Closed ${retired.length} remembered campaign${retired.length === 1 ? "" : "s"} Twitch no longer lists`, {
      source,
      listed: campaigns.length,
      campaigns: retired.slice(0, 8),
    });
    return retired.length;
  }

  function replaceCatalogFromDashboard(campaigns, source = "viewer-drops-dashboard") {
    if (!Array.isArray(campaigns)) return lastCampaignCatalog;
    retireUnlistedMemoryCampaigns(campaigns, source);
    const replaced = campaigns.map((campaign) => {
      const key = campaignKey(campaign);
      const known = withKnownCampaignDetails(campaign, key);
      const progress = (lastInventoryCampaigns || []).find((item) => campaignKey(item) === key);
      return progress ? mergeCampaigns([known], [progress])[0] : known;
    });
    // ViewerDropsDashboard is often a short inventory-linked subset. Keep All Campaigns
    // page rows for games the dashboard did not return so open campaigns stay selectable.
    const dashboardGames = new Set(
      replaced
        .map((campaign) => campaignTitleKey(campaign?.game?.displayName || campaign?.game?.name || ""))
        .filter(Boolean),
    );
    const preservedPageCampaigns = pageScrapedCampaignsFromCatalog().filter((campaign) => {
      const game = campaignTitleKey(campaign?.game?.displayName || campaign?.game?.name || "");
      return Boolean(game) && !dashboardGames.has(game);
    });
    if (!preservedPageCampaigns.length) return persistCampaignCatalog(replaced, source);
    return persistCampaignCatalog(mergeCampaigns(replaced, preservedPageCampaigns), source);
  }

  function applyInventorySnapshot(campaigns, source = "inventory-response") {
    if (!Array.isArray(campaigns)) return lastCampaignCatalog;
    const now = Date.now();
    const datedOpenCampaigns = campaigns.filter((campaign) => {
      const state = campaignRoutingState(campaign, now);
      if (state.open) return true;
      if (state.reason === "expired" && state.key && !campaignMarkedComplete(state.key)) {
        markCampaignCompleted(state.key, {
          id: campaign?.id || "",
          name: campaign?.name || "",
          game: campaign?.game?.displayName || campaign?.game?.name || "",
          startAt: state.startAt || campaign?.startAt || "",
          endAt: state.endAt || campaign?.endAt || "",
          source: "inventory-campaign-ended",
          status: "expired",
        });
      }
      return false;
    });
    const nextKeys = new Set();
    for (const campaign of datedOpenCampaigns) {
      const key = campaignKey(campaign);
      if (key) nextKeys.add(key);
    }
    if (haveSeenInventorySnapshot) {
      for (const key of lastInProgressKeys) {
        if (nextKeys.has(key)) continue;
        if (isPageScrapedCampaignKey(key)) continue;
        const prior = lastCampaignCatalog.find((item) => campaignKey(item) === key) || {};
        logActivity("campaign-inventory-missing", "Campaign disappeared from the current Inventory snapshot without completion proof", {
          campaignKey: key,
          campaign: prior?.name || null,
          game: prior?.game?.displayName || prior?.game?.name || null,
          source,
        });
      }
    }
    haveSeenInventorySnapshot = true;
    lastInProgressKeys = nextKeys;
    lastInventoryCampaigns = datedOpenCampaigns;
    if (!datedOpenCampaigns.length) return lastCampaignCatalog;
    return overlayKnownCampaignProgress(datedOpenCampaigns, source);
  }

  function cookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function getToken() {
    return cookie("auth-token");
  }

  function twitchSessionLogin() {
    return cleanText(cookie("login") || cookie("name") || "").replace(/^@/, "").toLowerCase();
  }

  function tokenSourceLabel() {
    return cookie("auth-token") ? "twitch-cookie" : "none";
  }

  function isTwitchLoggedIn() {
    return Boolean(getToken());
  }

  function openDashboardCampaigns(campaigns = []) {
    return (campaigns || []).filter((campaign) => {
      if (!campaignIsOpen(campaign)) return false;
      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      if (!drops.length) return true;
      return drops.some((drop) => (
        !requiresSubscription(drop) &&
        Number(drop?.requiredMinutesWatched || 0) >= 0
      ));
    });
  }

  async function enrichCampaignsWithDropDetails(campaigns, source = "drop-campaign-details", { force = false } = {}) {
    const list = Array.isArray(campaigns) ? campaigns.filter(Boolean) : [];
    if (!list.length || !getToken()) return list;
    const login = cleanText(
      cookie("login") ||
      cookie("name") ||
      ""
    ).toLowerCase() || watchingLogin();
    const needsDetails = list.filter((campaign) => {
      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      return Boolean(campaign?.id) && (force || drops.length === 0);
    }).slice(0, 40);
    if (!needsDetails.length) return list;
    const byId = new Map(list.map((campaign) => [String(campaign.id || ""), campaign]));
    for (let index = 0; index < needsDetails.length; index += 8) {
      const batch = needsDetails.slice(index, index + 8);
      try {
        const rows = await gql(batch.map((campaign) => ({
          op: "dropCampaignDetails",
          variables: {
            dropID: String(campaign.id),
            channelLogin: login || "",
          },
        })));
        for (const row of rows || []) {
          const detailed = row?.data?.user?.dropCampaign || row?.data?.dropCampaign || null;
          if (!detailed?.id || (Array.isArray(row?.errors) && row.errors.length)) continue;
          if (!batch.some(campaign => String(campaign.id) === String(detailed.id))) continue;
          byId.set(String(detailed.id), detailed);
        }
      } catch (error) {
        logActivity("campaign-auth-import", "DropCampaignDetails enrichment skipped", {
          source,
          message: cleanText(error?.message || error),
          remaining: needsDetails.length - index,
        });
        break;
      }
    }
    return list.map((campaign) => byId.get(String(campaign.id || "")) || campaign);
  }

  // Campaign keys whose DropCampaignDetails came back without a watch-time
  // reward, so routing stops waiting on them. key -> checked-at ms.
  const campaignDetailsMisses = new Map();
  const campaignDetailsAttempts = new Map();
  const CAMPAIGN_DETAILS_RETRY_MS = 60 * 1000;
  const CAMPAIGN_DETAILS_MISS_TTL_MS = 15 * 60 * 1000;

  function campaignDetailsMissedRecently(key, now = Date.now()) {
    const at = campaignDetailsMisses.get(cleanText(key).toLowerCase()) || 0;
    return Boolean(at && now - at < CAMPAIGN_DETAILS_MISS_TTL_MS);
  }

  // Resolve waiting catalog shells and incomplete active rewards through the
  // same detail path. Requests are account/context guarded and rate-limited;
  // a session on another reward does not replace the selected reward.
  async function enrichRoutingTargetCampaign(source = "routing-campaign-details", sessionDrop = null) {
    const requestContext = pollContext();
    const routing = readRoutingControllerSession();
    const waiting = routing.state === ROUTING_STATES.WAITING && routing.waitReason === "campaign-details";
    const active = currentDrop && !currentDrop.isClaimed ? currentDrop : null;
    const key = cleanText(waiting ? routing.targetCampaignKey : active?.campaignKey || active?.campaignId).toLowerCase();
    if (!key || isPageScrapedCampaignKey(key) || campaignDetailsMissedRecently(key)) return false;
    const target = routingCampaignPool().find(campaign => campaignKey(campaign) === key);
    if (!target?.id) return false;
    const drops = target.timeBasedDrops || target.drops || [];
    const record = drops.find(drop => String(drop?.id) === String(active?.id));
    const name = cleanText(record?.name || record?.benefitEdges?.[0]?.benefit?.name);
    const mismatch = sessionDrop && active && dropIdentityMatchesTarget(sessionDrop, active).sameCampaignDifferentDrop;
    const incomplete = Boolean(active && (active.needsDropDetails || !record || !name || name === "Drop" ||
      !(Number(record.requiredMinutesWatched) > 0)));
    if (!waiting && !incomplete && !mismatch) return false;
    if (waiting && drops.length && !campaignWatchDrops(target).length) {
      campaignDetailsMisses.set(key, Date.now());
      return false;
    }
    const now = Date.now();
    const lastAttempt = campaignDetailsAttempts.get(key);
    if (lastAttempt != null && now - lastAttempt < CAMPAIGN_DETAILS_RETRY_MS) return false;
    // Once resolved, a different session reward is not a reason to refetch the
    // same metadata every minute. Keep its progress separate from the selection.
    if (!incomplete && campaignDetailsCache.has(key)) return false;
    campaignDetailsAttempts.set(key, now);
    const [detailed] = await enrichCampaignsWithDropDetails([target], source, { force: true });
    if (!pollContextIsCurrent(requestContext)) return false;
    // Returning the input means the request failed or returned no matching data.
    if (!detailed || detailed === target) return false;
    const detailedDrops = detailed.timeBasedDrops || detailed.drops;
    if (!Array.isArray(detailedDrops)) return false;
    const merged = mergeCampaigns([target], [detailed])[0];
    const found = detailedDrops.length > 0;
    if (found) {
      campaignDetailsCache.set(key, compactCampaignCatalog([merged])[0]);
      hydrateCurrentRewardDetails(merged);
    }
    if (!found || !campaignWatchDrops(detailed).length) campaignDetailsMisses.set(key, Date.now());
    logActivity("campaign-details", found
      ? `Loaded reward details for ${target.name || key}`
      : `No reward details returned for ${target.name || key}`, {
      source, campaignKey: key, watchDrops: found ? campaignWatchDrops(detailed).length : 0,
    });
    return found;
  }

  function hydrateCurrentRewardDetails(campaign) {
    const active = currentDrop;
    if (!active?.id || !campaignKeysMatch(campaignKey(campaign), active.campaignKey || active.campaignId)) return false;
    const record = (campaign.timeBasedDrops || campaign.drops || []).find(drop => cleanText(drop?.id) === cleanText(active.id));
    if (!record || requiresSubscription(record)) return false;
    const name = cleanText(record.name || record.benefitEdges?.[0]?.benefit?.name);
    const required = Number(record.requiredMinutesWatched);
    // This is metadata enrichment, not a fresh inventory or an invitation to
    // select a sibling reward. Preserve the exact target's credited minutes.
    const updated = { ...active, name: name || active.name,
      rewardImage: dropBenefitImage(record) || active.rewardImage || "",
      game: campaign.game?.displayName || campaign.game?.name || active.game,
      gameId: campaign.game?.id || active.gameId || "", gameSlug: campaign.game?.slug || active.gameSlug || "",
      campaign: campaign.name || active.campaign, campaignStartAt: campaign.startAt || active.campaignStartAt,
      campaignEndAt: campaign.endAt || active.campaignEndAt, dropStartAt: record.startAt || active.dropStartAt,
      dropEndAt: record.endAt || active.dropEndAt,
      requiredMinutes: Number.isFinite(required) && required > 0 ? required : active.requiredMinutes,
      needsDropDetails: !(name && Number.isFinite(required) && required > 0) };
    updated.remainingMinutes = updated.currentMinutes == null || updated.requiredMinutes == null
      ? null : Math.max(0, updated.requiredMinutes - updated.currentMinutes);
    applyDrop(updated);
    return true;
  }

  let campaignAuthImportPromise = null;
  let lastCampaignAuthImportError = "";

  function campaignRowIntegrityBlocked(row) {
    const errors = Array.isArray(row?.errors) ? row.errors : [];
    return errors.some((item) => {
      const message = cleanText(item?.message || "");
      const code = cleanText(item?.extensions?.code || "");
      return /integrity/i.test(message) || /integrity/i.test(code);
    });
  }

  async function importOpenCampaignsViaAuth(source = "campaign-auth-import") {
    if (!getToken()) return [];
    if (campaignAuthImportPromise) return campaignAuthImportPromise;
    campaignAuthImportPromise = (async () => {
      lastCampaignAuthImportError = "";
      setStatus("Importing Open Campaigns With Twitch Auth…");

      const fetchDashboard = async ({ refreshIntegrity = false } = {}) => {
        if (refreshIntegrity) {
          clearClientIntegrity({ clearCapture: true });
          lastIntegrityTransport = "gm";
        }
        try {
          const rows = await gql([{ op: "viewerDropsDashboard" }]);
          const row = rows?.[0] || null;
          const dashboard = row?.data?.currentUser?.dropCampaigns;
          const integrityBlocked = campaignRowIntegrityBlocked(row);
          return { row, dashboard, integrityBlocked, error: null };
        } catch (error) {
          const message = cleanText(error?.message || error);
          return {
            row: null,
            dashboard: null,
            integrityBlocked: /integrity/i.test(message),
            error,
          };
        }
      };

      let result = await fetchDashboard({ refreshIntegrity: true });
      if ((!Array.isArray(result.dashboard) || result.integrityBlocked) && result.integrityBlocked) {
        logActivity("campaign-auth-import", "Retrying campaign import after integrity rejection", {
          source,
          tokenSource: tokenSourceLabel(),
          message: cleanText(result.error?.message || "IntegrityCheckFailed"),
        });
        result = await fetchDashboard({ refreshIntegrity: true });
      }

      if (Array.isArray(result.dashboard) && !result.integrityBlocked) {
        lastCampaignDashboardAt = Date.now();
        let open = openDashboardCampaigns(result.dashboard);
        open = await enrichCampaignsWithDropDetails(open, source);
        open = openDashboardCampaigns(open);
        if (open.length) {
          replaceCatalogFromDashboard(open, source);
          clearGqlFailurePause(source);
        }
        markCampaignPageImport(open.length, source, CAMPAIGN_PAGE_DISPLAY.GQL_AUTH);
        logActivity("campaign-auth-import", `Imported ${open.length} open campaigns via Twitch auth`, {
          source,
          tokenSource: tokenSourceLabel(),
          dashboardTotal: result.dashboard.length,
          games: open.slice(0, 8).map((item) => item.game?.displayName || item.game?.name || item.name),
        });
        setStatus(open.length ? `Imported ${open.length} open campaigns` : "No open campaigns returned");
        return open;
      }

      // Twitch often integrity-blocks dropCampaigns while Inventory still returns in-progress rows.
      try {
        if (result.integrityBlocked || result.error) {
          clearClientIntegrity({ clearCapture: true });
          lastIntegrityTransport = "gm";
        }
        const invRows = await gql([{ op: "inventory" }]);
        const inventory = invRows?.[0]?.data?.currentUser?.inventory?.dropCampaignsInProgress;
        if (Array.isArray(inventory) && inventory.length) {
          let open = openDashboardCampaigns(inventory);
          open = await enrichCampaignsWithDropDetails(open, `${source}-inventory`);
          open = openDashboardCampaigns(open);
          if (open.length) {
            rememberCampaignCatalog(open, `${source}-inventory-fallback`);
            clearGqlFailurePause(source);
            markCampaignPageImport(open.length, `${source}-inventory`, CAMPAIGN_PAGE_DISPLAY.GQL_INVENTORY);
            lastCampaignAuthImportError = "";
            setStatus(`Imported ${open.length} open campaigns from Inventory`);
            logActivity("campaign-auth-import", `Imported ${open.length} open campaigns via Inventory fallback`, {
              source,
              tokenSource: tokenSourceLabel(),
              inventoryTotal: inventory.length,
              reason: cleanText(
                result.error?.message
                || (result.integrityBlocked ? "IntegrityCheckFailed" : "dashboard-empty"),
              ),
              games: open.slice(0, 8).map((item) => item.game?.displayName || item.game?.name || item.name),
            });
            return open;
          }
        }
      } catch (invError) {
        logActivity("campaign-auth-import", "Inventory fallback for campaign import failed", {
          source,
          message: cleanText(invError?.message || invError),
        });
      }

      const message = cleanText(
        result.error?.message
        || (result.integrityBlocked
          ? "Twitch integrity blocked the campaign list"
          : "ViewerDropsDashboard returned no campaign list"),
      );
      lastCampaignAuthImportError = message;
      setStatus(`Campaign import failed · ${message}`);
      logActivity("campaign-auth-import", "Authenticated campaign import failed", {
        source,
        tokenSource: tokenSourceLabel(),
        message,
        integrityBlocked: Boolean(result.integrityBlocked),
      });
      return [];
    })()
      .finally(() => {
        campaignAuthImportPromise = null;
      });
    return campaignAuthImportPromise;
  }
