  function storageAccountLogin() {
    return twitchSessionLogin() || "signed-out";
  }

  function storageAccountSuffix(login = storageAccountLogin()) {
    return encodeURIComponent(cleanText(login).toLowerCase() || "signed-out");
  }

  function scopedSessionStorageKey(key, login = storageAccountLogin()) {
    return `${key}:account:${storageAccountSuffix(login)}`;
  }

  function scopedLocalStorageKey(key, login = storageAccountLogin()) {
    return `${key}:account:${storageAccountSuffix(login)}`;
  }

  function legacyStateBelongsToCurrentAccount() {
    const login = twitchSessionLogin();
    if (!login) return false;
    try {
      const owner = cleanText(localStorage.getItem(ACCOUNT_SCOPE_OWNER_KEY) || "").toLowerCase();
      if (!owner) {
        localStorage.setItem(ACCOUNT_SCOPE_OWNER_KEY, login);
        return true;
      }
      return owner === login;
    } catch (_) {
      return false;
    }
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
      delete stored.authToken;
      delete stored.hideChatSubscriptionPromos;
      delete stored.autoHideCard;
      delete stored.collapsedPanelWidth;
      delete stored.menuWidth;
      for (const name of ['protectedChannels','excludedChannels']) if (Object.hasOwn(stored,name)) stored[name] = Array.isArray(stored[name]) ? [...new Set(stored[name].filter(value=>typeof value==='string').map(value=>value.trim().toLowerCase()).filter(value=>/^[a-z0-9_]{1,25}$/.test(value)))].slice(0,100) : [];
      for (const name of ['quietHoursStart','quietHoursEnd']) if (Object.hasOwn(stored,name) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(stored[name] || '')) stored[name] = DEFAULTS[name];
      if (Object.hasOwn(stored,'quietHoursEnabled')) stored.quietHoursEnabled = stored.quietHoursEnabled === true;
      if (Object.hasOwn(stored,'switchPolicy') && !['normal','stopped-earning'].includes(stored.switchPolicy)) stored.switchPolicy = DEFAULTS.switchPolicy;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(stored)); } catch (_) { /* ignore */ }
      return { ...DEFAULTS, ...stored };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function persistSettingsSnapshot() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function saveSettings() {
    persistSettingsSnapshot();
    if (!settings.muteRestarted) writeSession(MUTE_PENDING_KEY, null);
    setStatus(featureStatus());
    renderSwitches();
  }

  function readSession(key, fallback) {
    try {
      const scopedKey = scopedSessionStorageKey(key);
      let value = sessionStorage.getItem(scopedKey);
      if (value == null && legacyStateBelongsToCurrentAccount()) {
        const legacy = sessionStorage.getItem(key);
        if (legacy != null) {
          sessionStorage.setItem(scopedKey, legacy);
          sessionStorage.removeItem(key);
          value = legacy;
        }
      }
      return value == null ? fallback : JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function writeSession(key, value) {
    sessionStorage.setItem(scopedSessionStorageKey(key), JSON.stringify(value));
  }

  function removeSession(key) {
    try {
      sessionStorage.removeItem(scopedSessionStorageKey(key));
      if (legacyStateBelongsToCurrentAccount()) sessionStorage.removeItem(key);
    } catch (_) {
      /* ignore */
    }
  }

  function featureStatus() {
    const on = [];
    if (settings.claimBonus) on.push("bonus");
    if (settings.keepTabActive) on.push("screen");
    if (settings.claimDrops) on.push("drops");
    return on.length ? `On: ${on.join(" · ")}` : "All features off";
  }

  function hasConfirmedRewardProgress(drop = currentDrop, login = watchingLogin(), now = Date.now()) {
    const proof = lastStreamVerification;
    return Boolean(drop?.id && proof?.proof?.progressConfirmed === true &&
      cleanText(proof.dropId) === cleanText(drop.id) && cleanText(proof.channel).toLowerCase() === cleanText(login).toLowerCase() &&
      cleanText(proof.campaignKey).toLowerCase() === cleanText(drop.campaignKey || drop.campaignId).toLowerCase() &&
      now >= Number(proof.at) && now - Number(proof.at) < HEALTHY_STREAM_DELAYED_MS);
  }

  function rewardCreditStatus(drop = currentDrop, login = watchingLogin()) {
    const resolution = rewardSessionResolution;
    const sameTarget = resolution && resolution.channel === login &&
      resolution.targetDropId === cleanText(drop?.id) &&
      campaignKeysMatch(resolution.campaignKey, drop?.campaignKey || drop?.campaignId) &&
      Date.now() - resolution.at < HEALTHY_STREAM_DELAYED_MS;
    if (sameTarget && ["prerequisite", "other-reward", "unresolved"].includes(resolution.relation)) {
      const subject = resolution.relation === "prerequisite" ? "prerequisite" : "another reward";
      const minutes = resolution.sessionMinutes == null ? "" : ` (${resolution.sessionMinutes} min)`;
      return `Twitch reports ${subject}: ${resolution.sessionName}${minutes} · Selected: ${drop.name || "Drop"}`;
    }
    if (hasConfirmedRewardProgress(drop, login)) return `Earning ${drop.name || "Drop"} On ${login}`;
    return inventoryResponseHealth.valid
      ? "Eligible stream · syncing reward progress"
      : "Eligible stream · inventory unavailable, syncing reward progress";
  }

  function dropActivityStatus(drop = currentDrop, login = watchingLogin()) {
    if (!drop) return featureStatus();
    const reward = cleanText(drop.name || "Drop");
    if (login) {
      if (readRoutingControllerSession().state === ROUTING_STATES.EARNING) return rewardCreditStatus(drop, login);
      return `Working toward ${reward} on ${login}`;
    }

    const current = Number(drop.currentMinutes);
    const required = Number(drop.requiredMinutes);
    const progress = Number.isFinite(current) && Number.isFinite(required) && required > 0
      ? `${Math.max(0, current)} / ${required} min`
      : Number.isFinite(Number(drop.percent))
        ? `${Math.max(0, Math.min(100, Number(drop.percent)))}%`
        : "progress pending";
    const subject = cleanText(drop.game || reward || "Drop");
    const routing = readRoutingControllerSession();

    if (!settings.findNextStream || routing.state === ROUTING_STATES.PAUSED) {
      return `${subject} · ${progress} · Automatic switching off`;
    }
    if (routing.state === ROUTING_STATES.FIND_STREAM) return `Finding an eligible ${subject} stream · ${progress}`;
    if (routing.state === ROUTING_STATES.OPEN_STREAM) return `Opening an eligible ${subject} stream · ${progress}`;
    if (routing.state === ROUTING_STATES.VERIFY_STREAM) return `Verifying an eligible ${subject} stream · ${progress}`;
    if (routing.state === ROUTING_STATES.WAITING) return `Waiting for an eligible ${subject} stream · ${progress}`;
    return `${subject} · ${progress} · Choose an eligible stream`;
  }

  function setStatus(text) {
    text = viewingStatus()?.label || text;
    statusText = text;
    const node = ui?.shadow?.getElementById("tdh-status");
    if (node) node.textContent = text;
  }

  function isInventory() {
    return location.href.split("?")[0] === INVENTORY_URL;
  }

  function isCampaigns() {
    return location.href.split("?")[0] === CAMPAIGNS_URL;
  }

  function clickMatch(root, selector) {
    const node = root.matches?.(selector) ? root : root.querySelector?.(selector);
    const button = node?.closest?.("button") || (node?.tagName === "BUTTON" ? node : null);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }

  function watchBonus() { syncClaimWatchers(); }

  function isDropClaimButton(button) {
    const text = cleanText(button.getAttribute("aria-label") || button.textContent || "");
    return /^(?:claim(?: (?:now|drop|reward))?|領取|领取|받기|получить)$/i.test(text);
  }

  async function claimDropViaGql(drop) {
    const instanceID = drop?.dropInstanceID;
    if (!settings.claimDrops || !instanceID || drop?.isClaimed || !dropProgressComplete(drop)) return false;
    const context = claimContext();
    if (context.account === 'signed-out') return false;
    const key = claimRecordKey(drop);
    if (!key) return false;
    try {
      return await withClaimLock(key, context, async () => {
        const ledger = claimLedger();
        // An unidentified page attempt must settle before a second path sends
        // a mutation for a possibly identical reward.
        if (ledger.snapshot().some(record => record.kind === 'drop' && !record.rewardId && record.outcome === 'pending')) return false;
        const attempt = ledger.begin({
          key, rewardId: drop.id || '', campaignId: drop.campaignId || drop.campaignKey || '',
          rewardName: cleanText(drop.name || drop.benefitEdges?.[0]?.benefit?.name || 'Drop'),
          game: cleanText(drop.game || ''), kind: 'drop'
        });
        if (!attempt) return false;
        logActivity('claim-attempt', 'Claim Sent', { rewardId: attempt.rewardId, evidence: 'request' });
        try {
          const result = await gql([{ op: "claimDrop", variables: { input: { dropInstanceID: instanceID } } }]);
          if (!claimContextIsCurrent(context)) { ledger.settle(key, attempt.attemptId, 'discarded', 'context-change'); return false; }
          const outcome = DropperActiveViewing.claimResponse(result[0]);
          recordClaimOutcome(ledger, attempt, outcome.outcome, outcome.evidence);
          queueGqlPollSoon('claim-confirmation', 1500);
          return outcome.outcome === 'confirmed' || outcome.outcome === 'already-claimed';
        } catch (error) {
          if (!claimContextIsCurrent(context)) { ledger.settle(key, attempt.attemptId, 'discarded', 'context-change'); return false; }
          const outcome = DropperActiveViewing.claimFailure(error);
          recordClaimOutcome(ledger, attempt, outcome.outcome, outcome.evidence);
          if (outcome.evidence === 'integrity') {
            lastClaimIntegrityFallback = { at: Date.now(), drop: drop.name || null, game: drop.game || null, alreadyOnInventory: isInventory(), navigatedToInventory: false };
            setStatus('Claim Needs Attention · Use Twitch Claim Control');
          }
          return false;
        }
      });
    } catch (_) { return false; }
  }

  async function sweepClaimReadyInventory(campaigns, source = 'inventory') {
    const state = { at: Date.now(), source, candidates: 0, selected: 0, confirmed: 0, reason: '' };
    if (!settings.claimDrops) { state.reason = 'disabled'; inventoryClaimSweepState = state; return 0; }
    if (storageAccountLogin() === 'signed-out') { state.reason = 'signed-out'; inventoryClaimSweepState = state; return 0; }
    if (!isAutoRoutingController()) { state.reason = 'secondary-tab'; inventoryClaimSweepState = state; return 0; }
    const candidates = DropperActiveViewing.inventoryClaimCandidates(campaigns, {
      limit: INVENTORY_CLAIM_SWEEP_LIMIT,
      excludeRewardId: currentDrop?.id || '',
    });
    state.candidates = candidates.length;
    if (!candidates.length) { state.reason = 'none-ready'; inventoryClaimSweepState = state; return 0; }
    for (const drop of candidates) {
      if (storageAccountLogin() === 'signed-out' || !isAutoRoutingController()) { state.reason = 'context-changed'; break; }
      state.selected += 1;
      const accepted = await claimDropViaGql(drop);
      if (accepted) state.confirmed += 1;
    }
    state.at = Date.now();
    if (!state.reason) state.reason = state.confirmed ? 'claimed' : 'checked';
    inventoryClaimSweepState = state;
    logActivity('inventory-claim-sweep', `Checked ${state.selected} completed inventory reward${state.selected === 1 ? '' : 's'}`, {
      source, candidates: state.candidates, selected: state.selected, confirmed: state.confirmed, limit: INVENTORY_CLAIM_SWEEP_LIMIT,
    });
    return state.confirmed;
  }

  function queueInventoryClaimSweep(campaigns, source = 'inventory') {
    if (inventoryClaimSweepPromise) return inventoryClaimSweepPromise;
    if (!Array.isArray(campaigns)) {
      inventoryClaimSweepState = { at: Date.now(), source, candidates: null, selected: 0, confirmed: 0, reason: 'inventory-unavailable' };
      return Promise.resolve(0);
    }
    const snapshot = campaigns;
    inventoryClaimSweepPromise = Promise.resolve()
      .then(() => sweepClaimReadyInventory(snapshot, source))
      .catch(() => 0)
      .finally(() => { inventoryClaimSweepPromise = null; });
    return inventoryClaimSweepPromise;
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
    return scanClaimGroups(root, 'drop');
  }

  function watchDrops() { syncClaimWatchers(); }

  function syncClaimWatchers() {
    // One observer and one ledger own bonus and Drop page actions.
    if (bonusClaimObserver) { bonusClaimObserver.disconnect(); bonusClaimObserver = null; }
    if (ExtraPotionsCore.suiteSitePaused?.() || (!settings.claimBonus && !settings.claimDrops)) {
      dropClaimObserver?.disconnect(); dropClaimObserver = null;
      clearTimeout(claimScanTimer); claimScanTimer = null;
      return;
    }
    if (!dropClaimObserver && document.documentElement) {
      dropClaimObserver = new MutationObserver(() => queueClaimScan('mutation'));
      dropClaimObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    queueClaimScan('watcher-sync', true);
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  function resetLastCheckedForStream(login = watchingLogin()) {
    const normalized = cleanText(login).toLowerCase();
    if (!normalized) {
      lastCheckedLogin = "";
      lastCheckedAt = 0;
      return false;
    }
    if (lastCheckedLogin === normalized) return false;
    lastCheckedLogin = normalized;
    lastCheckedAt = Date.now();
    return true;
  }

  function noteWatching() {
    const login = watchingLogin();
    resetLastCheckedForStream(login);
    const now = Date.now();
    if (watchClock.login !== login) watchClock = { login, started: now, elapsed: 0, lastTick: 0 };
    if (!login || !streamVideoIsPlaying() || viewingIntent.snapshot().paused) { watchClock.lastTick = 0; return; }
    if (watchClock.lastTick) watchClock.elapsed = (watchClock.elapsed || 0) + Math.min(HEARTBEAT_INTERVAL_MS * 2, now - watchClock.lastTick);
    watchClock.lastTick = now;
  }

  function playerWatchLabel() {
    if (!watchClock.login || !watchClock.elapsed) return "";
    return `Player playing ${formatClock(watchClock.elapsed)}`;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isPlaceholderDropLabel(value) {
    const text = cleanText(value);
    return /^(?:drops?\s+)?campaign\s+image$/i.test(text) ||
      /^(?:drop|reward|campaign)\s+(?:image|art)$/i.test(text);
  }

  function isDropCardMetadata(value) {
    const text = cleanText(value);
    return isPlaceholderDropLabel(text) ||
      /^(?:start|end) date\s*:/i.test(text) ||
      /^(?:starts?|ends?|expires?)(?:\s+in|\s*:)/i.test(text) ||
      /^(?:watch|watched)\s+\d+/i.test(text) ||
      /^\d+\s*(?:minutes?|hours?)(?:\s+(?:watched|required|remaining))?$/i.test(text) ||
      /^(?:participating live channels?|go to a participating channel|connection required)\b/i.test(text);
  }

  function barPercent(bar) {
    const now = Number(bar.getAttribute("aria-valuenow"));
    const max = Number(bar.getAttribute("aria-valuemax"));
    if (Number.isFinite(now) && max > 0) return Math.round((now / max) * 100);
    // Twitch Inventory often puts the live percent in a sibling: [role=progressbar] + div span
    const sibling = bar.nextElementSibling;
    const siblingSpan = sibling?.matches?.("span")
      ? sibling
      : sibling?.querySelector?.("span");
    const nearbySpan =
      siblingSpan ||
      bar.parentElement?.querySelector(":scope > div span, :scope + div span") ||
      bar.parentElement?.querySelector("span");
    const text = Number(cleanText(nearbySpan?.textContent).replace(/%/g, ""));
    return Number.isFinite(text) ? text : null;
  }

  function inventoryProgressPercents() {
    const roots = document.querySelectorAll(
      ".inventory-max-width, [data-test-selector*='DropsCampaign'], [class*='drops-campaign'], [data-test-selector='drops-list'], [data-a-target='drops-list']",
    );
    if (!roots.length) return [];
    const values = [];
    for (const root of roots) {
      for (const bar of root.querySelectorAll("[role='progressbar']")) {
        const percent = barPercent(bar);
        if (Number.isFinite(percent) && percent < 100) values.push(percent);
      }
      for (const span of root.querySelectorAll("[role='progressbar'] + div span")) {
        const percent = Number(cleanText(span.textContent).replace(/%/g, ""));
        if (Number.isFinite(percent) && percent >= 0 && percent < 100) values.push(percent);
      }
    }
    return values;
  }

  function cardCopy(card) {
    const chunks = [...card.querySelectorAll("h3, h4, h5, p, [class*='title'], [data-test-selector*='reward' i], img[alt]")]
      .map((node) => cleanText(node.getAttribute?.("alt") || node.textContent))
      .filter((text) => text.length > 1 && text.length < 90)
      .filter((text, index, list) => list.indexOf(text) === index)
      .filter((text) => !/^(claim|claimed|drops|inventory|\d+%?)$/i.test(text))
      .filter((text) => !isDropCardMetadata(text));
    return {
      game: chunks[0] || "",
      name: chunks[1] || "",
    };
  }

  function campaignTitleKey(value) {
    return cleanText(value).toLowerCase();
  }

  function campaignMemoryRecords() {
    return Object.entries(campaignMemory?.campaigns || {}).map(([key, record]) => ({ key, ...(record || {}) }));
  }

  function openCampaignForTitle(title, records) {
    const wanted = campaignTitleKey(title);
    if (!wanted) return null;
    const open = (records || []).filter((record) => {
      if (!record) return false;
      const status = cleanText(record.status).toLowerCase();
      if (status === "expired" || status === "completed" || status === "closed" || record.completedAt) return false;
      return campaignTitleKey(record.name) === wanted;
    });
    if (!open.length) return null;
    return open.find((record) => campaignTitleKey(record.game) && campaignTitleKey(record.game) !== wanted) || open[0];
  }

  function reconcileDropIdentity(drop, records = campaignMemoryRecords()) {
    if (!drop) return drop;
    const placeholderName = isPlaceholderDropLabel(drop.name);
    const name = placeholderName ? "" : cleanText(drop.name);
    const record = openCampaignForTitle(drop.game, records) ||
      openCampaignForTitle(drop.campaign, records) ||
      openCampaignForTitle(name, records);
    if (!record) return placeholderName ? { ...drop, name } : drop;
    const recordGame = cleanText(record.game);
    const recordName = cleanText(record.name);
    const title = cleanText(drop.game);
    if (!recordGame || campaignTitleKey(title) === campaignTitleKey(recordGame)) {
      return {
        ...drop,
        name: name || drop.name,
        campaign: drop.campaign || recordName,
        campaignKey: drop.campaignKey || record.key || "",
      };
    }
    const rewardName = name && campaignTitleKey(name) !== campaignTitleKey(recordName) ? name : recordName;
    return {
      ...drop,
      name: rewardName,
      game: recordGame,
      campaign: recordName,
      campaignKey: drop.campaignKey || record.key || "",
      campaignId: drop.campaignId || record.id || "",
      campaignStartAt: drop.campaignStartAt || record.startAt || "",
      campaignEndAt: drop.campaignEndAt || record.endAt || "",
    };
  }

  function repairRoutingIdentity() {
    if (currentDrop) {
      const repaired = reconcileDropIdentity(currentDrop);
      if (
        repaired &&
        (
          repaired.game !== currentDrop.game ||
          repaired.name !== currentDrop.name ||
          repaired.campaign !== currentDrop.campaign ||
          repaired.campaignKey !== currentDrop.campaignKey
        )
      ) {
        currentDrop = repaired;
        writeSession("tdh-drop", currentDrop);
      }
    }

    const pending = getHandoffState();
    if (!pending?.targetGame) return;
    const probe = reconcileDropIdentity({
      name: pending.targetCampaign || "",
      game: pending.targetGame || "",
      campaign: pending.targetCampaign || "",
      campaignKey: pending.targetCampaignKey || "",
    });
    if (!probe?.game || probe.game === pending.targetGame) return;
    const state = normalizedHandoffState(pending);
    transitionHandoff(
      state || HANDOFF_STATES.FINDING_STREAM,
      {
        targetGame: probe.game,
        targetSlug: "",
        targetCampaign: probe.campaign || pending.targetCampaign || "",
        targetCampaignKey: probe.campaignKey || pending.targetCampaignKey || "",
        completedGame: probe.game,
      },
      `Campaign ${probe.campaign || pending.targetGame} belongs to ${probe.game}, not a Twitch category named ${pending.targetGame}`,
    );
  }

  function readDropFromCard(card) {
    const bars = [...card.querySelectorAll(TWITCH_DOM_SELECTORS.progressBar)].map((bar) => ({
      bar,
      percent: barPercent(bar),
    })).filter((item) => Number.isFinite(item.percent));
    const active = bars.find((item) => item.percent > 0 && item.percent < 100) || bars.find((item) => item.percent < 100);
    if (!active) return null;
    const copy = cardCopy(card);
    return reconcileDropIdentity({
      percent: active.percent,
      name: copy.name || currentDrop?.name || "Current drop",
      game: copy.game && copy.game !== copy.name ? copy.game : "",
      rewardImage: rewardImageFromCard(card, active.bar) || currentDrop?.rewardImage || "",
    });
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
    if (!liveName && !livePercent) return currentDrop;
    const name = liveName || currentDrop?.name || "";
    const game = cleanText(currentDrop?.game || "");
    if (!liveName && !game) return currentDrop;
    if (isPlaceholderDropName(name) && !game) return currentDrop;
    return {
      percent: livePercent || currentDrop?.percent || 0,
      name: name || "Active drop",
      game,
    };
  }

  function currentProgress() {
    const values = inventoryProgressPercents();
    if (!values.length) return 0;
    return Math.max(...values);
  }

  function normalizeDropsMarkerText(value) {
    const text = cleanText(value);
    if (!text) return "";
    try {
      return text
        .normalize("NFKD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    } catch (_) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }
  }

  function textLooksLikeDropsMarker(value) {
    const normalized = normalizeDropsMarkerText(value);
    if (!normalized || normalized.length > 48) return false;
    // "Drops" is Twitch's product name in localized UI. The status word after it
    // may be translated, so accept one or two short words after Drop/Drops.
    return /^drops?(?:\s+[\p{L}\p{N}-]+){0,2}$/u.test(normalized);
  }

  function elementLooksLikeDropsMarker(node) {
    if (!node || node.nodeType !== 1) return false;
    const attrs = [
      node.getAttribute?.("data-a-target"),
      node.getAttribute?.("data-test-selector"),
      node.getAttribute?.("aria-label"),
      node.getAttribute?.("href"),
    ].filter(Boolean).join(" ");
    if (/drop/i.test(attrs)) return true;

    const text = cleanText(node.textContent);
    if (!textLooksLikeDropsMarker(text)) return false;

    const tagName = String(node.tagName || "").toLowerCase();
    if (tagName === "a" || tagName === "button") return true;
    if (node.getAttribute?.("role") === "button" || node.getAttribute?.("role") === "link") return true;

    const markerAncestor = node.closest?.(
      'a[href*="/tags/" i], a[href*="/directory/all/tags/" i], [data-a-target*="tag" i], [data-test-selector*="tag" i], [aria-label*="tag" i]',
    );
    if (markerAncestor) return true;

    // Twitch sometimes renders tags as simple leaf spans/divs with no stable tag
    // attribute. Only allow the short, standalone label itself, never card/title text.
    return !node.children?.length && text.length <= 48;
  }

  function streamHasDropsEnabledTag(root = null) {
    const scope = root || document.querySelector("#live-channel-stream-information");
    if (!scope) return false;
    if (scope.querySelector?.(
      '[data-a-target*="drop" i], [data-test-selector*="drop" i], [aria-label*="drop" i], a[href*="/tags/" i][href*="drop" i], a[href*="/directory/all/tags/" i][href*="drop" i]',
    )) return true;
    for (const node of scope.querySelectorAll?.("a, span, p, div, button, [role='button'], [role='link']") || []) {
      if (elementLooksLikeDropsMarker(node)) return true;
    }
    return false;
  }

  const STREAMING_TOGETHER_LABEL = /^stream(?:ing)?\s+together\b/i;

  function readStreamInfo() {
    const root = document.querySelector("#live-channel-stream-information");
    const login = watchingLogin();
    if (!root || !login) {
      return {
        channelName: login || "",
        title: "",
        game: "",
        gameSlug: "",
        gameCategoryUrl: "",
        viewers: "",
        uptime: "",
        dropsEnabled: false,
        live: false,
      };
    }
    const channelName = cleanText(root.querySelector("h1.tw-title, h1")?.textContent) || login;
    const title = cleanText(document.querySelector('[data-a-target="stream-title"]')?.textContent);
    // A Streaming Together session can show the collaboration label and every
    // participant's category. The label is not a game, and the stream belongs
    // to the target game when any shown category matches it.
    const gameLinks = [...new Set([
      ...document.querySelectorAll('[data-a-target="stream-game-link"]'),
      ...root.querySelectorAll('a[href*="/directory/category/"], a[href*="/directory/game/"]'),
    ])]
      .map((link) => ({ name: cleanText(link.textContent), href: link.href || "" }))
      .filter((link) => link.name && !STREAMING_TOGETHER_LABEL.test(link.name));
    const wantedGame = cleanText(readRoutingControllerSession()?.targetGame || currentDrop?.game || "");
    const gameLink = (wantedGame && gameLinks.find((link) => gameNamesMatch(wantedGame, link.name))) || gameLinks[0] || null;
    const game = gameLink?.name || "";
    const games = [...new Set(gameLinks.map((link) => link.name))];
    const gameCategoryUrl = gameLink?.href || "";
    const gameSlug = categorySlugFromUrl(gameCategoryUrl);
    if (game && gameSlug) rememberCategorySlug(game, gameSlug, "active-stream");
    const viewers = cleanText(document.querySelector('[data-a-target="animated-channel-viewers-count"]')?.textContent);
    const uptime = cleanText(document.querySelector('.live-time span[aria-hidden="true"]')?.textContent);
    const dropsEnabled = streamHasDropsEnabledTag(root);
    const live = Boolean(root.querySelector('.tw-channel-status-text-indicator, [class*="ChannelStatusTextIndicator"]')) || /\bLIVE\b/i.test(root.textContent || "");
    return { channelName, title, game, games, gameSlug, gameCategoryUrl, viewers, uptime, dropsEnabled, live };
  }

  function refreshStreamInfo() {
    if (!ui) return;
    const info = readStreamInfo();
    const box = ui.shadow.getElementById("tdh-stream-info");
    const channel = ui.shadow.getElementById("tdh-stream-channel");
    const game = ui.shadow.getElementById("tdh-stream-game");
    if (!box || !channel || !game) return;
    box.classList.remove("stream-info-hidden");
    channel.textContent = info.channelName || watchingLogin() || "Finding Stream…";
    game.textContent = info.game || currentDrop?.game || "Waiting For Category";
  }

  function authoritativeProgressPercent() {
    if (!currentDrop || currentDrop.needsDropDetails) return null;
    const percent = Number(currentDrop.percent);
    if (Number.isFinite(percent)) return Math.max(0, Math.min(100, percent));
    const current = Number(currentDrop.currentMinutes);
    const required = Number(currentDrop.requiredMinutes);
    if (Number.isFinite(current) && Number.isFinite(required) && required > 0) {
      return dropProgressPercent(current, required);
    }
    const stored = Number(readSession("tdh-progress", NaN));
    return Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : null;
  }

  function rememberResolvedRewardImage(drop, image) {
    const resolved = cleanText(image);
    if (!resolved || !drop || !currentDrop) return resolved;

    const sameDrop = Boolean(
      drop === currentDrop ||
      (drop.id && currentDrop.id && drop.id === currentDrop.id) ||
      (
        cleanText(drop.campaignKey || drop.campaignId) &&
        cleanText(drop.campaignKey || drop.campaignId) === cleanText(currentDrop.campaignKey || currentDrop.campaignId) &&
        cleanText(drop.name).toLowerCase() === cleanText(currentDrop.name).toLowerCase()
      )
    );

    if (sameDrop && !dropBenefitImage(currentDrop)) {
      currentDrop = { ...currentDrop, rewardImage: resolved };
      writeSession("tdh-drop", currentDrop);
    }
    return resolved;
  }

  function rewardImageFromDrop(drop = currentDrop) {
    if (!drop) return "";
    const direct = dropBenefitImage(drop);
    if (direct) return rememberResolvedRewardImage(drop, direct);

    const wantedId = cleanText(drop.id);
    const wantedKey = cleanText(drop.campaignKey || drop.campaignId).toLowerCase();
    const wantedName = cleanText(drop.name).toLowerCase();

    for (const campaign of mergeCampaigns(lastInventoryCampaigns, lastCampaignCatalog)) {
      const key = campaignKey(campaign);
      if (wantedKey && key && key !== wantedKey) continue;
      for (const item of campaign?.timeBasedDrops || campaign?.drops || []) {
        const itemId = cleanText(item?.id);
        const itemName = cleanText(item?.name || item?.benefitEdges?.[0]?.benefit?.name || "").toLowerCase();
        if ((wantedId && itemId === wantedId) || (!wantedId && wantedName && itemName === wantedName)) {
          const image = dropBenefitImage(item);
          if (image) return rememberResolvedRewardImage(drop, image);
        }
      }
    }

    return rememberResolvedRewardImage(drop, rewardImageFromInventoryDom(drop));
  }

  function relativeCampaignEndLabel(drop = currentDrop, now = Date.now()) {
    const endMs = Number(drop?.endMs || Date.parse(drop?.dropEndAt || drop?.campaignEndAt || "") || 0);
    if (!endMs) return "";
    const remaining = endMs - now;
    if (remaining <= 0) return "Ended";
    const totalMinutes = Math.max(1, Math.ceil(remaining / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `Ends in ${days}d ${hours}h`;
    if (hours > 0) return `Ends in ${hours}h ${minutes}m`;
    return `Ends in ${minutes}m`;
  }

  function syncProgressSurfaces() {
    if (!ui?.shadow) return false;
    const name = ui.shadow.getElementById("tdh-drop-name");
    const meta = ui.shadow.getElementById("tdh-drop-meta");
    const fill = ui.shadow.getElementById("tdh-drop-fill");
    const ring = ui.shadow.getElementById("tdh-ring");
    const percentNode = ui.shadow.getElementById("tdh-drop-percent");
    if (!name) return false;

    if (!currentDrop) {
      name.textContent = "Waiting For Twitch To Start A Drop Session";
      meta.textContent = "0 / 0 min";
      if (fill) fill.style.width = "0%";
      if (ring) ring.setAttribute("stroke-dasharray", "0 100");
      if (percentNode) percentNode.textContent = "—";
      syncCompactState();
      renderCompactInventory();
      return true;
    }

    const progressUnknown = Boolean(currentDrop.needsDropDetails);
    const percent = authoritativeProgressPercent();
    if (!progressUnknown && percent != null && Number(currentDrop.percent) !== percent) {
      currentDrop = { ...currentDrop, percent };
      writeSession("tdh-drop", currentDrop);
    }
    if (!progressUnknown && percent != null) {
      const wantedLabel = `${percent}%`;
      if (progressLabel !== wantedLabel) progressLabel = wantedLabel;
    }

    name.textContent = currentDrop.name || "Current Drop";
    const minutes = progressUnknown
      ? "Loading Drop Details"
      : currentDrop.requiredMinutes
        ? `${currentDrop.currentMinutes || 0} / ${currentDrop.requiredMinutes} min`
        : "Waiting For First Credited Minute";
    meta.textContent = minutes;

    const renderedPercent = progressUnknown || percent == null ? null : percent;
    if (fill) fill.style.width = renderedPercent == null ? "0%" : `${renderedPercent}%`;
    if (ring) ring.setAttribute("stroke-dasharray", renderedPercent == null ? "0 100" : `${renderedPercent} 100`);
    if (percentNode) percentNode.textContent = renderedPercent == null ? "—" : `${renderedPercent}%`;
    if (renderedPercent != null) {
      applyProgressColor(renderedPercent);
      lastUiProgressPercent = renderedPercent;
    } else {
      lastUiProgressPercent = null;
    }

    syncCompactState();
    renderCompactInventory();
    return true;
  }

  function refreshDropCard() {
    if (!ui) return;
    syncProgressSurfaces();
    try { refreshStreamInfo(); } catch (error) {
      logActivity("ui-sync", "Stream info refresh did not block progress rendering", {
        message: cleanText(error?.message || error),
      });
    }
    lastUiRoutingState = readRoutingControllerSession().state || "";
    globalThis.ExtraPotionsCore?.publishSuiteState?.("dropper", "dropper.state-changed", {
      activeReward: Boolean(currentDrop),
      progressPercent: lastUiProgressPercent == null ? null : Number(lastUiProgressPercent),
      routingState: lastUiRoutingState || "unknown",
    });
    refreshOpenCampaignList();
  }

  function queueProgressTitleSync() {
    if (progressTitleSyncQueued) return;
    progressTitleSyncQueued = true;
    queueMicrotask(() => {
      progressTitleSyncQueued = false;
      updateTitle();
    });
  }

  function watchProgressTitle() {
    if (typeof MutationObserver !== "function") return;
    const title = document.querySelector("title");
    if (!title) return;

    if (progressTitleObserver && progressTitleObserver._dropperTitleNode === title) return;
    progressTitleObserver?.disconnect?.();
    progressTitleObserver = new MutationObserver(() => queueProgressTitleSync());
    progressTitleObserver.observe(title, { childList: true, subtree: true, characterData: true });
    progressTitleObserver._dropperTitleNode = title;
  }

  function updateTitle() {
    const dropperPrefix = /^\[\d{1,3}%\]\s+/;
    const currentTitle = cleanText(document.title);

    if (!dropperPrefix.test(currentTitle) && currentTitle) {
      lastNativeTitle = currentTitle;
    }

    if (!settings.progressInTitle) {
      if (dropperPrefix.test(currentTitle) && lastNativeTitle) {
        document.title = lastNativeTitle;
      }
      return;
    }

    if (!progressLabel) {
      if (dropperPrefix.test(currentTitle) && lastNativeTitle) document.title = lastNativeTitle;
      return;
    }

    const baseTitle = lastNativeTitle || currentTitle.replace(dropperPrefix, "") || "Twitch";
    const wanted = `[${progressLabel}] ${baseTitle}`;
    if (document.title !== wanted) document.title = wanted;
  }

  function scanDrops() {
    claimDropButtons();

    // Once GQL has supplied authoritative minute requirements, the Twitch DOM
    // no longer needs to be searched for Drop cards every heartbeat.
    if (!currentDrop?.requiredMinutes) {
      const drop = readCurrentDrop();
      if (
        drop &&
        (drop.percent || drop.name) &&
        !isSyntheticWaitingDrop(drop) &&
        isAutoRoutingController()
      ) {
        applyDrop(drop);
      }
      else refreshDropCard();
      return;
    }

    refreshDropCard();
  }

  function findNextStream() {
    if (!viewingNavigationAllowed("automatic-routing")) return;
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("find-next-stream");
      return;
    }
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
      if (settings.muteRestarted) requestMuteAfterNavigation("automatic-routing");
      autoNavigateTwitch(href, "automatic-routing");
      return;
    }
    autoNavigateTwitch(href, "automatic-routing");
  }

  function muteOpenedStreamsEnabled() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (typeof stored.muteRestarted === 'boolean') settings.muteRestarted = stored.muteRestarted;
    } catch (_) { /* keep the current preference when storage is unavailable */ }
    if (!settings.muteRestarted) writeSession(MUTE_PENDING_KEY, null);
    return Boolean(settings.muteRestarted);
  }

  function requestMuteAfterNavigation(reason = "automatic-routing") {
    if (!muteOpenedStreamsEnabled()) return;
    writeSession(MUTE_PENDING_KEY, {
      at: Date.now(),
      reason: String(reason || ""),
      expiresAt: Date.now() + MUTE_PENDING_MS,
    });
  }

  function mutePendingSnapshot(now = Date.now()) {
    const pending = readSession(MUTE_PENDING_KEY, null);
    if (!pending) return null;
    if (Number(pending.expiresAt || 0) <= now) {
      writeSession(MUTE_PENDING_KEY, null);
      return null;
    }
    return pending;
  }

  function twitchMuteControl() {
    return document.querySelector(
      '[data-a-target="player-mute-unmute-button"], button[aria-label^="Mute"], button[aria-label^="Unmute"]',
    );
  }

  function streamVideoElement() {
    return document.querySelector("video");
  }

  function playerPresentationSnapshot() {
    const video = streamVideoElement();
    const root = video?.closest('[data-a-player-state="mini"]');
    const bounds = video?.getBoundingClientRect();
    return { mode: document.fullscreenElement ? 'fullscreen' : document.pictureInPictureElement ? 'browser-pip' : root ? 'twitch-mini' : video ? 'channel' : 'missing',
      width: Math.round(bounds?.width || 0), height: Math.round(bounds?.height || 0),
      expandControl: Boolean(root?.querySelector('button[aria-label="Expand Player"]')),
      recovery: {...playerPresentationRecovery} };
  }
  function restoreChannelPlayer(explicit = false) {
    const login = watchingLogin();
    if (!login || location.pathname.toLowerCase().replace(/\/$/, '') !== '/' + login.toLowerCase()) return false;
    if (document.fullscreenElement || document.pictureInPictureElement) return false;
    if (!explicit && (!settings.restoreChannelPlayer || playerPresentationRecovery.attempted || playerPresentationRecovery.viewerInteracted || Date.now() - PAGE_STARTED_AT > 30000 || document.hidden || viewingIntent.snapshot().paused)) return false;
    const mini = streamVideoElement()?.closest('[data-a-player-state="mini"]');
    if (!mini) return false;
    // Observed in Twitch's public player UI: this control restores the anchored player.
    // It is deliberately scoped to the mini-player, not a generic expand/fullscreen button.
    const expand = mini.querySelector('button[aria-label="Expand Player"]');
    if (!expand || expand.disabled || !expand.getClientRects().length) {playerPresentationRecovery.lastResult='expand-control-unavailable';return false;}
    playerPresentationRecovery.attempted = true;
    try { expand.click(); playerPresentationRecovery.lastResult='expand-requested';
      logActivity('playback','Requested normal channel player',{reason:explicit?'user-restore-channel-player':'mini-player-on-arrival'});return true;
    } catch (_) {playerPresentationRecovery.lastResult='expand-failed';return false;}
  }

  function streamVideoIsPlaying(video = streamVideoElement()) {
    return Boolean(video && !video.paused && !video.ended && video.readyState > 1);
  }

  function twitchPlayControl() {
    return document.querySelector(
      '[data-a-target="player-overlay-play-button"], [data-a-target="player-play-pause-button"], button[aria-label^="Play"], button[aria-label^="Start Watching"]',
    );
  }

  function clickTwitchPlayerGate(selector) {
    const button = document.querySelector(selector);
    const target = button?.matches?.("button") ? button : button?.querySelector?.("button:not([disabled])");
    if (!target || target.disabled) return false;
    try {
      target.click();
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureStreamPlaying(explicit = false) {
    if (ExtraPotionsCore.suiteSitePaused?.()) return;
    if (!watchingLogin()) return false;
    syncViewingContext();
    const video = streamVideoElement();
    if (!video || streamVideoIsPlaying(video) || video.ended || video.error || video.readyState < 1) return false;
    // Gates remain Twitch/user decisions. A paused or unknown player is never
    // interpreted as authorization to start playback or open another stream.
    if (!viewingIntent.takeRecovery(explicit)) return false;
    if (explicit) {
      videoMountedDuringPause = false;
      recentPlaybackControl = { action: 'resume', at: Date.now() };
    }
    try {
      const playing = video.play();
      logActivity('playback', 'Requested playback resume', { reason: explicit ? 'user-resume' : 'authorized-recovery' });
      if (playing && typeof playing.catch === 'function') playing.catch(() => {
        viewingIntent.pause(false);
        logActivity('playback', 'Playback resume was blocked', { reason: 'player-rejected' });
        setStatus('Playback Needs Attention');
        refreshViewingControls();
      });
      return true;
    } catch (_) {
      viewingIntent.pause(false);
      refreshViewingControls();
      return false;
    }
  }

  function ensureStreamMuted() {
    if (ExtraPotionsCore.suiteSitePaused?.()) return;
    if (!muteOpenedStreamsEnabled()) return false;
    const pending = mutePendingSnapshot();
    if (!pending) return false;
    if (!watchingLogin()) return false;

    const video = document.querySelector("video");
    let changed = false;
    if (video && !video.muted) {
      try {
        video.muted = true;
        changed = true;
      } catch (_) { /* ignore */ }
    }

    const button = twitchMuteControl();
    const label = cleanText(button?.getAttribute("aria-label") || button?.textContent || "").toLowerCase();
    // Twitch labels the control for the action it will take: "Mute" means currently unmuted.
    if (button && /^mute\b/.test(label)) {
      try {
        button.click();
        changed = true;
      } catch (_) { /* ignore */ }
    }

    if (video?.muted) {
      // Keep the pending window briefly so Twitch's autoplay unmute can be re-applied.
      if (Date.now() - Number(pending.at || 0) > 12000) writeSession(MUTE_PENDING_KEY, null);
    }
    if (changed) logActivity('playback', 'Muted a Dropper-opened stream', { reason: 'mute-opened-streams-enabled' });
    return changed;
  }

  function muteWhenReady(win) {
    if (!win || !muteOpenedStreamsEnabled()) return;
    requestMuteAfterNavigation("popup-stream");
    const timer = setInterval(() => {
      if (!muteOpenedStreamsEnabled()) { clearInterval(timer); return; }
      try {
        const video = win.document?.querySelector("video");
        if (video) {
          video.muted = true;
          const button = win.document.querySelector(
            '[data-a-target="player-mute-unmute-button"], button[aria-label^="Mute"], button[aria-label^="Unmute"]',
          );
          const label = cleanText(button?.getAttribute("aria-label") || button?.textContent || "").toLowerCase();
          if (button && /^mute\b/.test(label)) button.click();
          clearInterval(timer);
        }
      } catch (_) {
        /* cross-origin until it lands on twitch */
      }
    }, 500);
    setTimeout(() => clearInterval(timer), 20000);
  }

  function installKeepTabActive() {
    // Compatibility entry point for the saved keepTabActive preference.
    // Do not proxy IntersectionObserver, visibility, focus, or media methods.
    installViewingIntent();
    void syncScreenWakeLock();
  }

  function switchHtml(id, label, description, on) {
    const tip = String(description || "").trim().replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const labelClass = tip ? "fl-switch-text has-tooltip" : "fl-switch-text";
    const tipAttr = tip ? ` data-tip="${tip}"` : "";
    return `
      <div class="fl-switch">
        <span class="${labelClass}"${tipAttr} id="${id}-label">${label}</span>
        <button id="${id}" type="button" class="fl-switch-input toggleSwitch" role="switch" aria-labelledby="${id}-label" aria-checked="${on ? "true" : "false"}"></button>
      </div>`;
  }

  function css() {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .cluster {
        position: fixed; right: 12px; z-index: 2147483600;
        display: flex; flex-direction: column-reverse; align-items: flex-end;
        width: max-content; max-width: calc(100vw - 24px); gap: 8px;
        --theme-bg:#111114; --theme-panel:#19191e; --theme-raised:#2a2a31; --theme-inset:#0e0e10; --theme-line:#34343b; --theme-text:#efeff1; --theme-muted:#adadb8; --theme-accent:#9147ff; --theme-accent2:#bf94ff; --theme-link:#c6a4ff; --theme-focus:#bf94ff; --theme-onAccent:#111114; --theme-skin:linear-gradient(135deg,#d9b5ff,#9b5af9,#7428e8); --theme-skin-vertical:linear-gradient(180deg,#d9b5ff,#9b5af9,#7428e8); --exp-ui-opacity:1; --exp-menu-width:260px; --dropper-ui-opacity:1;
        font: 13px/1.42 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: var(--theme-text);
      }
      .cluster.open-up { flex-direction: column; }
      #tdh-tools-dock,
      #tdh-drop-card,
      .update-notice {
        opacity:var(--exp-ui-opacity,var(--dropper-ui-opacity,1));
        transition:opacity .15s ease;
      }
      .progress-stack {
        width:min(var(--exp-menu-width,260px), calc(100vw - 24px));
        display:flex; flex-direction:column; align-items:stretch;
        transition:.15s width;
        gap:6px;
      }

      .cluster #tdh-tools-dock,
      .cluster > .update-notice[data-placement="menu"] {
        width:min(var(--exp-menu-width,260px), calc(100vw - 24px));
      }

      .progress-stack.badge-only .badge-row { justify-content:flex-end; min-height:48px!important; }
      .progress-stack.badge-only #tdh-settings-launcher {
        border-radius:12px;
        border-left:1px solid color-mix(in srgb, var(--theme-accent) 47%, transparent);
      }
      .badge-only-progress-slot{display:block;width:100%;margin:0 0 5px;min-width:0}
      .badge-only-progress-slot[hidden]{display:none!important}
      .badge-only-progress-slot #tdh-drop-card{position:relative!important;inset:auto!important;display:block!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important}
      .compact-line { height:auto; min-height:48px; padding:6px 10px; display:grid; grid-template-columns:6px minmax(0,1fr) auto auto; gap:7px; align-items:center; cursor:pointer; }
      .compact-dot { width:6px; height:6px; border-radius:2px; background:#9147ff; }
      .compact-reward { font-size:var(--exp-font-size-small,11px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .compact-extra { font-size:var(--exp-font-size-small,11px); color:#b8b8c0; white-space:nowrap; }
      .state-pill { display:inline-flex; align-items:center; border:1px solid #34343a; border-radius:5px; padding:1px 5px; font-size:var(--exp-font-size-small,11px); font-weight:800; color:#d0d0d5; background:#1c1c21; white-space:nowrap; }
      .state-pill.good { color:#c8ffd7; border-color:#22c55e66; background:#22c55e18; }
      .state-pill.warn { color:#ffe5a8; border-color:#f59e0b66; background:#f59e0b18; }
      .state-pill.bad { color:#ffd1d1; border-color:#ef444466; background:#ef444418; }
      .stream-info { padding:7px 9px 6px; display:grid; grid-template-columns:32px minmax(0,1fr); gap:7px; align-items:center; }
      .stream-info-hidden { display:none; }
      .stream-head { min-width:0; display:flex; align-items:center; gap:5px; }
      .stream-channel { font-size:var(--exp-font-size-body,13px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .stream-live { font-size:var(--exp-font-size-small,11px); font-weight:900; background:#eb0400; color:#fff; border-radius:4px; padding:1px 4px; }
      .stream-title { display:none; }
      .stream-game { font-size:var(--exp-font-size-small,11px); color:#adadb8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .stream-badges { display:flex; gap:4px; flex-wrap:nowrap; align-items:center; justify-self:end; font-size:var(--exp-font-size-small,11px); color:#8f8f98; }
      .stream-badges[hidden] { display:none !important; }
      .stream-badge { padding:1px 4px; border:1px solid #34343b; border-radius:99px; }
      .stream-badge.drops-enabled { color:#d7ffd7; border-color:#22c55e66; background:#22c55e18; }
      .stream-dot { color:#5f5f68; }
      .drop-section { padding:7px 9px 8px; border-top:1px solid #29292f; }
      .drop-kicker { font-size:var(--exp-font-size-small,11px); color:#bf94ff; font-weight:900; letter-spacing:.07em; text-transform:uppercase; margin-bottom:2px; }
      .drop-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-right:24px; }
      .drop-name { font-size:var(--exp-font-size-body,13px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .drop-game { display:none; }
      .drop-bar-row { margin-top:6px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px; align-items:center; }
      .drop-bar { height:6px; border-radius:99px; background:#2b2b31; overflow:hidden; }
      .drop-bar > span { display:block; height:100%; width:0; background:#9147ff; transition:.2s width,.2s background; }
      .drop-percent { font-size:var(--exp-font-size-small,11px); font-weight:800; color:#bf94ff; min-width:28px; text-align:right; }
      .drop-meta { font-size:var(--exp-font-size-small,11px); color:#9c9ca5; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .drop-status-row { margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:var(--exp-font-size-small,11px); color:#a7a7b0; }
      .progress-age { color:#a7a7b0; }
      .progress-age.warn { color:#f59e0b; }
      .progress-age.bad { color:#ef4444; font-weight:800; }
      /* 3.2.0 progress panel */
      .cluster{pointer-events:none!important}
      .cluster :is(#tdh-tools-dock,.update-notice,#tdh-drop-card,#tdh-settings-launcher){pointer-events:auto!important}
      .cluster .progress-stack{height:auto;min-height:48px;pointer-events:none!important}
      .cluster .badge-row{position:fixed!important;min-height:112px!important;height:auto!important;justify-content:flex-end!important;align-items:center!important;pointer-events:none!important}
      .cluster[data-launcher-anchor="top"] #tdh-settings-launcher{align-self:flex-start!important}
      .cluster #tdh-drop-card[data-presentation="page-card"]{position:relative!important;inset:auto!important;right:auto!important;left:auto!important;top:auto!important;bottom:auto!important;flex:0 0 auto!important;margin:0!important}
      .cluster .badge-only-progress-slot #tdh-drop-card[data-presentation="menu-card"]{position:relative!important;inset:auto!important;right:auto!important;left:auto!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important}

      .badge-row {display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:112px!important;height:auto!important;position:relative!important}
      #tdh-drop-card {position:relative!important;order:0!important;flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important;min-height:112px!important;margin:0!important;overflow:hidden!important;isolation:isolate!important;cursor:default!important;background:var(--theme-panel)!important;border:1px solid color-mix(in srgb,var(--theme-line) 94%,var(--theme-accent) 6%)!important;border-radius:12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),inset 0 0 18px rgba(255,255,255,.012),0 8px 28px #0006!important;opacity:1!important;transition:border-color .16s ease,box-shadow .16s ease!important}
      #tdh-drop-card:focus-within{border-color:color-mix(in srgb,var(--theme-line) 72%,var(--theme-accent) 28%)!important}
      #tdh-drop-card::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background-image:radial-gradient(circle,rgba(255,255,255,.045) .6px,transparent .7px);background-size:4px 4px;opacity:.18;mix-blend-mode:soft-light}
      #tdh-drop-card::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background:linear-gradient(to bottom,rgba(255,255,255,.018),rgba(255,255,255,.004) 28%,transparent 55%);opacity:1}
      #tdh-drop-card .expanded-content{position:relative!important;z-index:1!important;display:block!important}
      #tdh-drop-card .compact-line{display:none!important}
      .stream-info,.stream-info-hidden{min-height:110px!important;padding:10px 11px!important;display:block!important}
      .progress-copy{width:100%!important;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"head head" "category category" "bar bar" "reward reward" "status status"!important;column-gap:10px!important;row-gap:7px!important}
      .progress-head{grid-area:head!important;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:10px!important;align-items:center!important}
      .stream-channel{min-width:0!important;color:var(--theme-text)!important;font-size:var(--exp-font-size-body,13px)!important;font-weight:850!important;line-height:1.15!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .progress-head .drop-percent{min-width:38px!important;color:var(--theme-accent2)!important;font-size:var(--exp-font-size-body,13px)!important;font-weight:900!important;line-height:1!important;text-align:right!important;white-space:nowrap!important}
      .progress-category{grid-area:category!important;min-width:0!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;line-height:1.15!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .drop-bar{grid-area:bar!important;height:7px!important;margin:1px 0 0!important;border-radius:3px!important;background:color-mix(in srgb,var(--theme-line) 62%,transparent)!important;overflow:hidden!important}
      .drop-bar>span{display:block!important;height:100%!important;width:0;border-radius:inherit!important;background:var(--theme-accent)!important}
      .progress-reward-row{grid-area:reward!important;min-width:0!important;display:flex!important;align-items:center!important;gap:6px!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;line-height:1.15!important}
      .progress-reward-row .drop-meta{margin:0!important;flex:0 0 auto!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;white-space:nowrap!important}
      .progress-dot{flex:0 0 auto!important;color:color-mix(in srgb,var(--theme-muted) 78%,transparent)!important}
      .progress-reward-row .drop-name{min-width:0!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:650!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .drop-status-row{grid-area:status!important;min-width:0!important;margin:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;line-height:1!important}
      .status-meta-chip{box-sizing:border-box!important;min-width:0!important;height:24px!important;display:flex!important;align-items:center!important;overflow:hidden!important;border:1px solid color-mix(in srgb,var(--theme-line) 88%,var(--theme-accent) 12%)!important;border-radius:6px!important;background:color-mix(in srgb,var(--theme-bg) 94%,var(--theme-panel) 6%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important}
      .drop-status-row .state-pill{box-sizing:border-box!important;min-width:0!important;min-height:0!important;height:22px!important;display:inline-flex!important;align-items:center!important;gap:5px!important;padding:0 8px!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important}
      .drop-status-row .state-pill::before{content:""!important;flex:0 0 auto!important;width:6px!important;height:6px!important;border-radius:2px!important;background:currentColor!important;box-shadow:0 0 7px color-mix(in srgb,currentColor 42%,transparent)!important}
      .drop-status-row .state-pill.good{color:#8fd7a0!important}
      .drop-status-row .state-pill.warn{color:#e4bd6c!important}
      .drop-status-row .state-pill.bad{color:#dc9393!important}
      .status-chip-divider{flex:0 0 auto!important;width:1px!important;height:12px!important;background:color-mix(in srgb,var(--theme-line) 82%,transparent)!important}
      .status-clock-icon{flex:0 0 auto!important;width:10px!important;height:10px!important;margin-left:7px!important;color:color-mix(in srgb,var(--theme-muted) 86%,var(--theme-text) 14%)!important}
      #tdh-updated-ago{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;padding:0 8px 0 4px!important;border:0!important;color:var(--theme-muted)!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:600!important;font-variant-numeric:tabular-nums!important;line-height:1!important;text-align:left!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .skip-streamer-chip{appearance:none!important;box-sizing:border-box!important;height:24px!important;min-height:24px!important;min-width:64px!important;max-width:82px!important;padding:0 9px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;border:1px solid color-mix(in srgb,var(--theme-line) 72%,var(--theme-accent) 28%)!important;border-radius:6px!important;background:color-mix(in srgb,var(--theme-bg) 95%,var(--theme-accent) 5%)!important;color:color-mix(in srgb,var(--theme-text) 84%,var(--theme-accent) 16%)!important;font:800 var(--exp-font-size-small,11px)/1 ui-sans-serif,system-ui,sans-serif!important;cursor:pointer!important;white-space:nowrap!important;overflow:hidden!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important;transition:border-color .14s ease,background .14s ease,color .14s ease,box-shadow .14s ease!important}
      .skip-streamer-chip:hover,.skip-streamer-chip:focus-visible{border-color:color-mix(in srgb,var(--theme-accent) 72%,var(--theme-line) 28%)!important;background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%)!important;color:var(--theme-accent2)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-accent) 16%,transparent)!important;outline:none!important}
      .skip-streamer-chip:disabled{opacity:.36!important;cursor:default!important;box-shadow:none!important}
      .skip-streamer-chip .skip-icon{flex:0 0 auto!important;width:10px!important;height:10px!important;fill:currentColor!important}
      .skip-streamer-chip .skip-label{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .skip-streamer-chip .skip-countdown{display:inline-grid!important;place-items:center!important;min-width:18px!important;height:16px!important;margin-left:1px!important;padding:0 4px!important;border-radius:4px!important;background:#ef4444!important;color:#fff!important;font-size:var(--exp-font-size-small,11px)!important;font-weight:900!important;line-height:1!important}
      .skip-streamer-chip .skip-countdown[hidden]{display:none!important}
      .skip-streamer-chip.is-armed{min-width:94px!important;max-width:104px!important;border-color:color-mix(in srgb,#ef4444 62%,var(--theme-line))!important;background:color-mix(in srgb,var(--theme-panel) 90%,#ef4444 10%)!important;color:#efb0b0!important}
      .skip-streamer-chip.is-armed .skip-icon{display:none!important}
      .progress-stack .stream-info {padding:9px 10px!important}
      .progress-stack .progress-copy {row-gap:6px!important}
      .progress-stack .stream-channel,
      .progress-stack .progress-head .drop-percent {font-size:var(--exp-font-size-body,13px)!important}
      .progress-stack .progress-category,
      .progress-stack .progress-reward-row,
      .progress-stack .progress-reward-row .drop-meta,
      .progress-stack .progress-reward-row .drop-name {font-size:var(--exp-font-size-small,11px)!important}
      .progress-stack .drop-status-row {grid-template-columns:minmax(0,1fr) auto!important;gap:5px!important}
      .progress-stack .status-meta-chip {height:22px!important}
      .progress-stack .drop-status-row .state-pill {height:20px!important;gap:4px!important;padding-inline:6px!important;font-size:var(--exp-font-size-small,11px)!important}
      .progress-stack .drop-status-row .state-pill::before {width:5px!important;height:5px!important}
      .progress-stack .status-chip-divider {height:10px!important}
      .progress-stack .status-clock-icon {width:8.5px!important;height:8.5px!important;margin-left:5px!important}
      .progress-stack #tdh-updated-ago {padding:0 6px 0 3px!important;font-size:var(--exp-font-size-small,11px)!important}
      .progress-stack .skip-streamer-chip {height:22px!important;min-height:22px!important;min-width:49px!important;max-width:56px!important;padding-inline:7px!important;gap:4px!important;font-size:var(--exp-font-size-small,11px)!important}
      .progress-stack .skip-streamer-chip .skip-icon {width:9px!important;height:9px!important}
      .progress-stack .skip-streamer-chip.is-armed {min-width:94px!important;max-width:104px!important;padding-inline:6px!important}

      #tdh-settings-launcher {
        position:relative; width:48px; min-width:48px; height:48px; min-height:48px; align-self:flex-end; padding:0; margin:0;
        display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--theme-accent) 30%,transparent); border-radius:10px;
        background:var(--theme-panel,#18181b); box-shadow:0 6px 22px #0006; cursor:grab; touch-action:none; user-select:none;
        transition:.14s border-color,.14s box-shadow,.14s background,.14s transform;
      }
      .action-pair{display:grid;grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}
      #tdh-clear-activity{grid-column:1/-1}
      .action-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:8px 0 0}
      .mini-row:has(#tdh-queue-preference){grid-column:1/-1}
      #tdh-queue-preference{width:124px;min-width:124px;max-width:124px;flex:0 0 124px}
      .action-pair>.life-btn{min-width:0;margin:0;white-space:normal}
      .stream-subsection-label{grid-column:1/-1;min-width:0;margin:1px 0 2px;color:var(--theme-accent2);font-size:var(--exp-font-size-small,11px);font-weight:900;line-height:1.2;letter-spacing:.08em;text-transform:uppercase}
      .stream-subsection-label.with-divider{margin-top:7px;padding-top:8px;border-top:1px solid var(--theme-line,#34343b)}
      #tdh-streams-body>.queue-switches,
      #tdh-streams-body>.queue-collapsible,
      #tdh-clear-skipped-streamers{grid-column:1/-1}
      .queue-switches{display:grid;grid-template-columns:minmax(58px,.7fr) minmax(0,1.3fr);column-gap:10px;row-gap:0;min-width:0;margin:6px 0;padding:2px 0;border:0;align-items:stretch}
      .queue-switches-label{grid-column:1;grid-row:1/span 3;display:flex;align-items:center;min-width:0;font-size:var(--exp-font-size-body,13px);font-weight:700;line-height:1.2;color:var(--theme-text,#efeff1)}
      .queue-switches>.fl-switch{grid-column:2;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:10px;min-width:0;padding:5px 0!important;text-align:left!important}
      .queue-switches>.fl-switch>span:first-child{display:block;flex:1 1 auto;width:auto!important;min-width:0!important;min-height:0!important;white-space:normal!important;word-break:normal!important;overflow-wrap:normal!important;line-height:1.25;text-align:left}
      .queue-switches>.fl-switch>.toggleSwitch{flex:0 0 34px;margin-left:auto}
      #tdh-progress-body{padding-bottom:5px}
      #tdh-progress-body>.fl-switch,
      #tdh-progress-body>.mini-row{padding:4px 0}
      #tdh-progress-body>.theme-row{min-height:22px;padding:3px 0;gap:6px}
      #tdh-progress-body .exp-theme-swatches{gap:3px;flex-wrap:nowrap;min-width:0}
      #tdh-progress-body .exp-theme-swatch{flex:0 0 18px!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;border-radius:4px!important}
      .cluster #tdh-progress-body>.theme-row>span {display:none}
      .cluster #tdh-progress-body>.theme-row {gap:0}
      .cluster #tdh-progress-body .exp-theme-swatches {width:100%;justify-content:space-between}

      .appearance-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:3px 0 1px}
      .opacity-row{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(72px,1fr) auto;align-items:center;gap:6px;min-width:0;padding:4px 0;border-top:1px solid #26262b}
      .opacity-row[hidden]{display:none!important}
      .opacity-row>span{font-size:var(--exp-font-size-body,13px);line-height:1.25;white-space:nowrap}
      #tdh-opacity-range{width:100%;min-width:0;accent-color:var(--theme-accent)}
      #tdh-opacity-value{min-width:34px;text-align:right;font-size:var(--exp-font-size-small,11px);font-weight:800;color:var(--theme-muted)}

      #tdh-refresh-now,#tdh-reset-session{border-color:#cb6868!important;background:#402020!important;color:#ffd7d7!important}
      #tdh-settings-launcher:hover {
        border-color:color-mix(in srgb,var(--theme-accent) 58%,transparent);
        background:color-mix(in srgb,var(--theme-panel,#18181b) 96%,var(--theme-accent) 4%);
        box-shadow:0 8px 24px #0007; transform:scale(1.015);
      }
      #tdh-settings-launcher[aria-expanded="true"] {
        border-color:color-mix(in srgb,var(--theme-accent) 72%,transparent);
        background:var(--theme-panel,#18181b);
        box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-accent) 22%,transparent),0 8px 26px #0008;
        transform:scale(1.01);
      }
      #tdh-settings-launcher.is-dragging {
        cursor:grabbing; transform:scale(1.03); box-shadow:0 10px 28px #0009;
      }
      #tdh-settings-launcher.update-available::after {
        content:"↑"; position:absolute; top:-4px; right:-4px; width:14px; height:14px; display:grid; place-items:center;
        border:2px solid var(--theme-panel,#18181b); border-radius:4px; background:#f59e0b; color:#111114; font-size:var(--exp-font-size-small,11px); font-weight:950;
        box-shadow:0 2px 6px #0007; z-index:4; pointer-events:none;
      }
      #tdh-settings-launcher .ring { position:absolute; top:50%; left:50%; width:44px; height:44px; pointer-events:none; transform:translate(-50%,-50%); }
      #tdh-settings-launcher .track { fill:none; stroke:color-mix(in srgb,var(--theme-line,#34343b) 72%,transparent); stroke-width:2.5; }
      #tdh-settings-launcher .fill { fill:none; stroke:var(--theme-accent,#9147ff); stroke-width:2.5; stroke-linecap:round; transition:.2s stroke; }
      #tdh-settings-launcher .icon { position:absolute; top:50%; left:50%; width:40px; height:40px; pointer-events:none; z-index:1; transform:translate(-50%,-50%); }
      #tdh-tools-dock {
        position:fixed; right:12px; top:auto; bottom:auto;
        display:none; width:min(var(--exp-menu-width,260px), calc(100vw - 24px)); max-width:calc(100vw - 24px);
        height:max-content; min-height:0; max-height:none; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; flex:0 0 auto;
        transition:.15s width;
        padding:9px 9px 4px; background:var(--theme-bg); border:1px solid var(--theme-line); border-radius:14px; box-shadow:0 18px 50px #0008; color-scheme:dark;
      }
      #tdh-tools-dock.fl-rail-open { display:block; height:max-content; min-height:0; max-height:none; }
      #tdh-tools-dock:focus { outline:none; }
      #tdh-tools-dock :is(.fl-tool-body,.row,.group,.section,.fl-tool-title) { min-width:0; max-width:100%; overflow-wrap:anywhere; }
      #tdh-tools-dock :is(input,select,textarea) { min-width:0; max-width:100%; }
      .menu-head {
        position:relative;
        display:grid; grid-template-columns:minmax(0,1fr) auto;
        align-items:start; gap:8px; width:100%;
      }
      .header-actions { display:flex; align-items:flex-start; gap:5px; position:static; }
      #tdh-rail-close {
        width:30px; height:30px; min-width:30px; padding:0;
        border:1px solid #3a3a42; border-radius:8px; background:#151519; color:#b8b8c0;
        cursor:pointer;
      }
      .header-brand {
        display:grid; grid-template-columns:38px minmax(0,1fr);
        align-items:center; gap:8px; min-width:0; width:100%;
      }
      .header-icon {
        box-sizing:border-box; width:38px; height:38px; display:grid; place-items:center;
        border:1px solid color-mix(in srgb,var(--theme-accent) 48%,var(--theme-line));
        border-radius:9px; background:var(--theme-panel);
        box-shadow:inset 0 0 0 1px color-mix(in srgb,#000 22%,transparent);
      }
      .header-icon .menu-icon { width:38px; height:38px; display:block; }
      .header-copy { min-width:0; overflow:hidden; }
      .header-title-row { display:flex; align-items:center; gap:6px; min-width:0; flex-wrap:wrap; }
      #tdh-rail-title { margin:0; font-size:15px; font-weight:800; line-height:1.1; }
      #tdh-header-version {
        min-height:18px; padding:1px 6px; border:1px solid #4a3b61; border-radius:5px;
        background:#1b1721; color:#c9a7ff; cursor:pointer; font:800 var(--exp-font-size-small,11px)/1 ui-sans-serif,system-ui,sans-serif;
        white-space:nowrap;
      }
      #tdh-header-version:hover, #tdh-header-version:focus-visible {
        border-color:#9147ff; background:#251d31; color:#fff; outline:none;
      }
      #tdh-rail-subtitle {
        margin-top:2px; font-size:var(--exp-font-size-small,11px); line-height:1.2; color:#adadb8;
        white-space:normal; overflow-wrap:anywhere;
      }
      #tdh-rail-close { font:18px/1 Arial,sans-serif; }
      #tdh-rail-close:hover, #tdh-rail-close:focus-visible { border-color:#9147ff; color:#fff; background:#211b2b; outline:none; }
      .header-divider { height:1px; width:100%; margin:5px 0; background:linear-gradient(90deg,transparent,#9147ff88 50%,transparent); }
      .update-notice {
        position:fixed; display:block; width:100%; max-width:calc(100vw - 24px); margin:0; padding:10px;
        box-sizing:border-box;
        border:1px solid color-mix(in srgb,var(--theme-accent) 62%,var(--theme-line)); border-radius:10px;
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%),
            var(--theme-bg) 76%
          );
        color:var(--theme-text);
        box-shadow:0 10px 28px #0008; z-index:12;
      }
      .update-notice[hidden] { display:none; }
      .update-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding-right:22px; }
      .update-heading { min-width:0; }
      .update-kicker { margin-bottom:2px; color:var(--theme-accent2); font-size:var(--exp-font-size-small,11px); font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
      .update-title { font-size:var(--exp-font-size-body,13px); line-height:1.25; font-weight:850; color:var(--theme-text); }
      .update-version {
        flex:none; padding:2px 6px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 62%,var(--theme-line));
        border-radius:5px;
        background:color-mix(in srgb,var(--theme-panel) 82%,var(--theme-accent) 18%);
        color:var(--theme-text);
        font-size:var(--exp-font-size-small,11px); font-weight:800; white-space:nowrap;
      }
      .update-text { margin-top:6px; font-size:var(--exp-font-size-small,11px); line-height:1.45; color:var(--theme-muted); white-space:normal; overflow:visible; }
      .update-list { margin:7px 0 0; padding:0 0 0 15px; max-height:86px; overflow:auto; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); line-height:1.4; scrollbar-width:thin; }
      .update-list li::marker { color:var(--theme-accent); }
      .update-list li + li { margin-top:3px; }
      .update-footer { display:flex; justify-content:flex-end; gap:6px; margin-top:8px; padding-top:7px; border-top:1px solid var(--theme-line); }
      .update-action, .update-release, .update-dismiss, .life-btn {
        border:1px solid var(--theme-line); border-radius:7px;
        background:var(--theme-bg); color:var(--theme-text); cursor:pointer;
      }
      .update-action, .update-release { min-height:27px; padding:0 10px; font-size:var(--exp-font-size-small,11px); font-weight:800; }
      .update-action { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
      .update-action[hidden], .update-release[hidden] { display:none; }
      .update-action {
        border-color:var(--theme-accent);
        background:color-mix(in srgb,var(--theme-panel) 68%,var(--theme-accent) 32%);
        color:var(--theme-text);
      }
      .update-release {
        border-color:color-mix(in srgb,var(--theme-line) 78%,var(--theme-accent) 22%);
        background:var(--theme-panel);
        color:var(--theme-text);
      }
      .update-dismiss {
        position:absolute; top:7px; right:7px; width:23px; height:23px; padding:0;
        border-color:transparent; background:transparent; color:var(--theme-muted); font-size:15px; line-height:1;
      }
      .update-action:hover,
      .update-action:focus-visible,
      .update-release:hover,
      .update-release:focus-visible,
      .update-dismiss:hover,
      .update-dismiss:focus-visible,
      .life-btn:hover {
        border-color:var(--theme-accent);
        color:var(--theme-text);
        outline:none;
      }
      .update-action:hover,
      .update-action:focus-visible {
        background:color-mix(in srgb,var(--theme-panel) 55%,var(--theme-accent) 45%);
      }
      .update-release:hover,
      .update-release:focus-visible {
        background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
      }
            .cluster[data-theme-skin="gradient"] .update-notice {
        border:1px solid transparent;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin);
        background-origin:border-box;
        background-clip:padding-box,border-box;
      }
      .cluster[data-theme-skin="gradient"] .update-version,
      .cluster[data-theme-skin="gradient"] .update-action {
        border-color:transparent;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin);
        background-origin:border-box;
        background-clip:padding-box,border-box;
      }
      .toast { margin-bottom:7px; padding:6px 8px; border:1px solid #34343b; border-radius:8px; background:#18181b; color:#efeff1; font-size:var(--exp-font-size-small,11px); box-shadow:0 8px 24px #0006; }
      .toast[hidden] { display:none; }
      .fl-tool-panel { position:relative; margin-top:5px; border:1px solid #27272d; background:#19191e; border-radius:9px; overflow:visible; }
      .fl-tool-header { display:flex; justify-content:space-between; align-items:flex-start; height:auto; min-height:0; padding:7px 8px; cursor:pointer; border-radius:8px; }
      .fl-tool-header:hover { background:#9147ff18; }
      .fl-tool-header.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .fl-tool-title { min-width:0; flex:1; font-size:var(--exp-font-size-body,13px); font-weight:700; white-space:normal; overflow-wrap:anywhere; }
      .fl-tool-chevron { background:none; border:0; color:#adadb8; cursor:pointer; }
      .fl-tool-body { padding:0 10px 8px; }
      .fl-tool-body:not(.fl-tool-hidden) { display:grid; height:auto; min-height:0; max-height:none; overflow:visible; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:stretch; column-gap:8px; }
      .cluster .fl-tool-body:not(.fl-tool-hidden) { grid-template-columns:minmax(0,1fr); }
      .cluster .fl-tool-body:not(.fl-tool-hidden) > * { grid-column:1/-1; }
      .fl-tool-body > :is(.fl-switch,.mini-row,.life-btn) { min-width:0; }
      .fl-tool-body > :is(.compact-inventory,.campaign-manager,.diag) { grid-column:1/-1; }
      #tdh-diagnostics-body { padding-bottom:2px; }
      #tdh-diagnostics-body > [data-dropper-tools] { grid-column:1/-1; min-width:0; display:grid; grid-template-columns:minmax(0,1fr)!important; gap:6px!important; margin-top:10px!important; align-items:stretch; }
      #tdh-diagnostics-body > [data-dropper-tools]:not(:has(> details[open])) { grid-auto-rows:1fr; }
      #tdh-diagnostics-body>[data-dropper-tools]>details[open]{grid-column:1/-1!important}
      #tdh-diagnostics-body>[data-dropper-tools]>details:not([open]){grid-column:auto!important}
      #tdh-diagnostics-body > [data-dropper-tools] > details { min-width:0; margin-top:0!important; padding:5px 10px!important; border:1px solid color-mix(in srgb,var(--theme-line) 72%,transparent); border-radius:8px; background:color-mix(in srgb,var(--theme-panel) 80%,var(--theme-raised) 20%); overflow-wrap:anywhere; transition:background .14s ease,border-color .14s ease; }
      #tdh-diagnostics-body > [data-dropper-tools] > details > summary { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:24px; list-style:none; cursor:pointer; color:var(--theme-text); font-size:var(--exp-font-size-body,13px); font-weight:600; line-height:1.3; border-radius:4px; }
      #tdh-diagnostics-body > [data-dropper-tools] > details > summary::-webkit-details-marker { display:none; }
      #tdh-diagnostics-body > [data-dropper-tools] > details > summary::after { content:""; flex:0 0 5px; width:5px; height:5px; margin-right:2px; border-right:1.5px solid var(--theme-muted); border-bottom:1.5px solid var(--theme-muted); transform:rotate(-45deg); }
      #tdh-diagnostics-body > [data-dropper-tools] > details[open] { border-color:color-mix(in srgb,var(--theme-accent) 30%,var(--theme-line)); }
      #tdh-diagnostics-body > [data-dropper-tools] > details[open] > summary::after { transform:rotate(45deg); }
      #tdh-diagnostics-body > [data-dropper-tools] > details:has(> summary:hover) { background:var(--theme-raised); border-color:color-mix(in srgb,var(--theme-accent) 25%,var(--theme-line)); }
      #tdh-diagnostics-body > [data-dropper-tools] > details > summary:focus-visible { outline:2px solid var(--theme-accent); outline-offset:4px; }
      #tdh-diagnostics-body :is(button,summary) { font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif; }
      #tdh-diagnostics-body > .action-pair > .life-btn { background:color-mix(in srgb,var(--theme-panel) 80%,var(--theme-raised) 20%); border-color:color-mix(in srgb,var(--theme-line) 72%,transparent); border-radius:8px; font-weight:600; }
      #tdh-diagnostics-body > .action-pair > .life-btn:hover { background:var(--theme-raised); border-color:color-mix(in srgb,var(--theme-accent) 25%,var(--theme-line)); }
      @media (prefers-reduced-motion:reduce) { #tdh-diagnostics-body > [data-dropper-tools] > details { transition:none; } }
      #tdh-diagnostics-body > [data-dropper-tools] :is(button,select) { max-width:100%; min-width:0; white-space:normal; }

      .fl-tool-hidden { display:none !important; }
      .fl-switch, .mini-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; height:auto; min-height:0; padding:6px 0; }
      .fl-switch + .fl-switch, .mini-row + .mini-row { border-top:1px solid #26262b; }
      .fl-switch-text, .mini-row > span {
        min-width:0;
        font-size:var(--exp-font-size-body,13px);
        line-height:1.25;
        white-space:normal;
        word-break:normal;
        overflow-wrap:break-word;
        hyphens:none;
      }
      .toggleSwitch {
        position:relative; box-sizing:border-box; flex:none; width:34px; height:20px;
        border:1px solid color-mix(in srgb,var(--theme-line) 88%,var(--theme-muted) 12%);
        border-radius:6px;
        background:color-mix(in srgb,var(--theme-bg) 84%,var(--theme-panel) 16%);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.018);
        cursor:pointer;
        transition:.15s background,.15s border-color;
      }
      .toggleSwitch::after {
        content:""; position:absolute; top:2px; left:2px; width:14px; height:14px;
        box-sizing:border-box; border:0; border-radius:4px;
        background:color-mix(in srgb,var(--theme-muted) 82%,var(--theme-text) 18%);
        box-shadow:none;
        transition:.15s transform,.15s background;
      }
      .toggleSwitch[aria-checked="true"] {
        border-color:color-mix(in srgb,var(--theme-line) 52%,var(--theme-accent) 48%);
        background:color-mix(in srgb,var(--theme-panel) 72%,var(--theme-accent) 28%);
      }
      .toggleSwitch[aria-checked="true"]::after {
        transform:translateX(14px);
        background:var(--theme-text);
      }
      .life-btn { width:100%; min-height:28px; margin-top:6px; font-size:var(--exp-font-size-body,13px); }
      .life-btn.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .select-lite { min-width:0; max-width:72px; background:#111114; color:#efeff1; border:1px solid #34343b; border-radius:6px; padding:4px 6px; font-size:var(--exp-font-size-body,13px); }
      .auth-required {
        grid-column:1/-1;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-top:6px;
        padding:7px 8px;
        border:1px solid color-mix(in srgb,#f59e0b 46%,var(--theme-line));
        border-radius:7px;
        background:color-mix(in srgb,var(--theme-panel) 84%,#f59e0b 16%);
        color:#ffe5a8;
        font-size:var(--exp-font-size-small,11px);
        font-weight:800;
      }
      .auth-required[hidden] { display:none !important; }
      .auth-required .life-btn {
        width:auto;
        min-width:112px;
        margin:0;
        flex:0 0 auto;
      }
      .account-link-warning {
        grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:8px;
        margin-top:6px; padding:8px; border:1px solid color-mix(in srgb,#f59e0b 58%,var(--theme-line));
        border-radius:8px; background:color-mix(in srgb,var(--theme-panel) 82%,#f59e0b 18%); color:#ffe6ad;
      }
      .account-link-warning[hidden] { display:none!important; }
      .account-link-warning-copy { min-width:0; display:flex; flex-direction:column; gap:2px; }
      .account-link-warning-copy strong { font-size:var(--exp-font-size-small,11px); line-height:1.2; }
      .account-link-warning-copy span { color:color-mix(in srgb,#ffe6ad 78%,var(--theme-muted)); font-size:var(--exp-font-size-small,11px); line-height:1.35; overflow-wrap:anywhere; }
      .account-link-warning .life-btn { width:auto; min-width:104px; margin:0; flex:0 0 auto; }
      .deadline-status {
        grid-column:1/-1; margin-top:6px; padding:6px 8px; border:1px solid var(--theme-line);
        border-radius:8px; background:var(--theme-inset); color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35;
      }
      .deadline-status[hidden] { display:none!important; }
      .deadline-status[data-tone="warn"] { border-color:color-mix(in srgb,#e2b34a 58%,var(--theme-line)); color:#f2cf75; }
      .deadline-status[data-tone="bad"] { border-color:color-mix(in srgb,#df5b65 62%,var(--theme-line)); color:#ff9ea6; }
      .multi-tab-status {
        grid-column:1/-1; margin:3px 0 4px; padding:6px 8px; border:1px solid color-mix(in srgb,var(--theme-accent) 40%,var(--theme-line));
        border-radius:7px; background:color-mix(in srgb,var(--theme-panel) 92%,var(--theme-accent) 8%);
        color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35;
      }
      .multi-tab-status[hidden] { display:none!important; }
      .multi-tab-status[data-role="controller"] { color:color-mix(in srgb,#76d69a 78%,var(--theme-text)); border-color:color-mix(in srgb,#3ac978 46%,var(--theme-line)); }
      .multi-tab-status[data-role="passive"] { color:#f2cf75; border-color:color-mix(in srgb,#e2b34a 55%,var(--theme-line)); }
      .session-recovery-status {
        grid-column:1/-1; margin:3px 0 4px; padding:6px 8px; border:1px solid color-mix(in srgb,#57b5ff 44%,var(--theme-line));
        border-radius:7px; background:color-mix(in srgb,var(--theme-panel) 92%,#57b5ff 8%); color:color-mix(in srgb,#a8d5ff 78%,var(--theme-text)); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35;
      }
      .session-recovery-status[hidden] { display:none!important; }
      .campaign-strategy-row { padding:6px 8px; margin:0; border-bottom:1px solid var(--theme-line); }
      .campaign-strategy-row .select-lite { max-width:136px; width:136px; }
      .earning-confidence {
        grid-column:1/-1; display:flex; align-items:baseline; justify-content:space-between; gap:8px;
        margin:3px 0 4px; padding:7px 8px; border:1px solid var(--theme-line); border-radius:8px;
        background:var(--theme-inset); color:var(--theme-muted);
      }
      .earning-confidence strong { color:var(--theme-text); font-size:var(--exp-font-size-small,11px); line-height:1.25; }
      .earning-confidence span { min-width:0; text-align:right; font-size:var(--exp-font-size-small,11px); line-height:1.3; overflow-wrap:anywhere; }
      .earning-confidence[data-tone="good"] { border-color:color-mix(in srgb,#3ac978 56%,var(--theme-line)); }
      .earning-confidence[data-tone="warn"] { border-color:color-mix(in srgb,#e2b34a 58%,var(--theme-line)); }
      .earning-confidence[data-tone="bad"] { border-color:color-mix(in srgb,#df5b65 62%,var(--theme-line)); }
      .stream-health-list,.eligibility-checklist-list { padding:3px 8px 7px; }
      .status-check-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; padding:5px 0; }
      .status-check-row + .status-check-row { border-top:1px solid var(--theme-line); }
      .status-check-label { min-width:0; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.3; }
      .status-check-value { max-width:150px; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:800; line-height:1.3; text-align:right; overflow-wrap:anywhere; }
      .status-check-value[data-tone="good"] { color:#76d69a; }
      .status-check-value[data-tone="warn"] { color:#f2cf75; }
      .status-check-value[data-tone="bad"] { color:#ff9ea6; }
      #tdh-stream-lock[aria-pressed="true"] { border-color:color-mix(in srgb,var(--theme-accent) 72%,var(--theme-line)); background:color-mix(in srgb,var(--theme-panel) 76%,var(--theme-accent) 24%); }
      .campaign-priority-controls { display:flex; align-items:center; gap:4px; margin-top:4px; }
      .campaign-priority-rank { min-width:22px; color:var(--theme-accent2); font-size:var(--exp-font-size-small,11px); font-weight:900; }
      .campaign-priority-button { width:24px; height:22px; padding:0; border:1px solid var(--theme-line); border-radius:5px; background:var(--theme-panel); color:var(--theme-text); cursor:pointer; font-size:var(--exp-font-size-small,11px); }
      .campaign-priority-button:disabled { opacity:.35; cursor:default; }
      .campaign-priority-button:not(:disabled):hover,.campaign-priority-button:not(:disabled):focus-visible { border-color:var(--theme-accent); outline:none; }
      .routing-history-list,.claim-history-list { max-height:180px; overflow:auto; padding:3px 8px 7px; }
      .routing-history-row,.claim-history-row { display:grid; gap:2px; padding:6px 0; min-width:0; }
      .routing-history-row + .routing-history-row,.claim-history-row + .claim-history-row { border-top:1px solid var(--theme-line); }
      .routing-history-main,.claim-history-main { min-width:0; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:750; line-height:1.35; overflow-wrap:anywhere; }
      .routing-history-time,.claim-history-time { color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.25; }
      #tdh-toggle-inventory,
      #tdh-refresh-campaign-data { grid-column:1/-1; }
      .auth-advanced { margin-top:2px; border:1px solid var(--theme-line); border-radius:7px; background:var(--theme-inset); padding:6px 8px; }
      .auth-advanced > summary { cursor:pointer; list-style:none; color:var(--theme-muted); font-size:var(--exp-font-size-body,13px); font-weight:600; user-select:none; }
      .auth-advanced > summary::-webkit-details-marker { display:none; }
      .auth-advanced[open] > summary { margin-bottom:6px; color:var(--theme-text); }
      .auth-advanced-body { display:flex; flex-direction:column; gap:6px; }
      .auth-hint { color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.35; }
      .auth-input { width:100%; min-height:30px; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-inset); color:var(--theme-text); padding:6px 8px; font-size:var(--exp-font-size-body,13px); }
      .auth-input:focus { outline:2px solid var(--theme-focus); outline-offset:2px; border-color:var(--theme-focus); }
      .theme-row { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:28px; padding:6px 0; font-size:var(--exp-font-size-body,13px); }
      .exp-theme-swatch{box-sizing:border-box!important;flex:0 0 22px!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;padding:0!important;border-radius:5px!important}
      .exp-theme-swatches { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .exp-theme-swatch { appearance:none; width:18px; height:18px; min-width:18px; padding:0; border:2px solid var(--theme-line); border-radius:4px; box-sizing:border-box; cursor:pointer; }
      .exp-theme-swatch.is-on { border-color:var(--theme-text); box-shadow:0 0 0 2px var(--theme-accent); }
      .fl-tool-panel { border-color:var(--theme-line); background:var(--theme-panel); }
      .fl-tool-body { border-color:var(--theme-line); background:var(--theme-bg); color:var(--theme-text); }
      .select-lite, .life-btn { border-color:var(--theme-line); background:var(--theme-raised); color:var(--theme-text); }
      .cluster a { color:var(--theme-link); }
      .fl-tool-chevron, #tdh-rail-subtitle, .compact-extra { color:var(--theme-muted); }
      .cluster[data-ui-theme="contrast"] .toggleSwitch { border:2px solid #fff; background:#050505; }
      .cluster[data-ui-theme="contrast"] .toggleSwitch::after { top:0; left:0; border:1px solid #050505; background:#fff; }
      .cluster[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"] { background:#fff; border-color:#fff; }
      .cluster[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"]::after { background:#050505; border-color:#fff; transform:translateX(14px); }
      @media (forced-colors: active) {
        .toggleSwitch { forced-color-adjust:none; border:1px solid CanvasText; background:Canvas; }
        .toggleSwitch::after { border-color:CanvasText; background:CanvasText; }
        .toggleSwitch[aria-checked="true"] { border-color:Highlight; background:Highlight; }
        .toggleSwitch[aria-checked="true"]::after { border-color:HighlightText; background:HighlightText; }
      }
            .cluster[data-theme-skin="gradient"] #tdh-tools-dock {
        border:1px solid transparent !important;
        background-origin:border-box !important;
        background-clip:padding-box, border-box !important;
        background-image:linear-gradient(var(--theme-bg),var(--theme-bg)),var(--theme-skin) !important;
      }
      .cluster[data-theme-skin="gradient"] #tdh-settings-launcher {
        border-color:color-mix(in srgb,var(--theme-accent) 30%,transparent) !important;
        background:var(--theme-panel) !important;
        background-image:none !important;
      }
      .cluster[data-theme-skin="gradient"] #tdh-settings-launcher:hover {
        border-color:color-mix(in srgb,var(--theme-accent) 58%,transparent) !important;
        background:color-mix(in srgb,var(--theme-panel) 96%,var(--theme-accent) 4%) !important;
        background-image:none !important;
      }
      .cluster[data-theme-skin="gradient"] #tdh-settings-launcher[aria-expanded="true"] {
        border:1px solid transparent !important;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin) !important;
        background-origin:border-box !important;
        background-clip:padding-box,border-box !important;
      }
      .cluster[data-theme-skin="gradient"] #tdh-header-version {
        border:1px solid var(--theme-line);
        background:var(--theme-bg);
        color:var(--theme-text);
        border-radius:6px;
      }
      .cluster[data-theme-skin="gradient"] #tdh-header-version:hover,
      .cluster[data-theme-skin="gradient"] #tdh-header-version:focus-visible {
        border-color:transparent;
        background-image:linear-gradient(var(--theme-panel),var(--theme-panel)),var(--theme-skin);
        background-origin:border-box;
        background-clip:padding-box,border-box;
      }
      .cluster[data-theme-skin="gradient"] .header-divider {
        height:2px;
        border-radius:2px;
        opacity:.9;
        background:var(--theme-skin);
        -webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 16%,#000 84%,transparent 100%);
        mask-image:linear-gradient(90deg,transparent 0%,#000 16%,#000 84%,transparent 100%);
      }
      .cluster[data-theme-skin="gradient"] .drop-bar > span {
        background:var(--theme-accent) !important;
      }
      .cluster[data-theme-skin="gradient"] .progress-head .drop-percent {
        color:var(--theme-accent2) !important;
      }
      .cluster[data-theme-skin="gradient"]:not([data-ui-theme="contrast"]) .toggleSwitch[aria-checked="true"] {
        border-color:color-mix(in srgb,var(--theme-line) 52%,var(--theme-accent) 48%);
        background:color-mix(in srgb,var(--theme-panel) 72%,var(--theme-accent) 28%);
      }
      .cluster[data-theme-skin="gradient"] .exp-theme-swatch.is-on {
        border-color:var(--theme-text);
        box-shadow:0 0 0 2px var(--theme-accent2);
      }
      .cluster[data-theme-skin="gradient"] :is(.fl-tool-header,.life-btn).last-opened {
        box-shadow:none;
        position:relative;
      }
      .cluster[data-theme-skin="gradient"] :is(.fl-tool-header,.life-btn).last-opened::before {
        content:"";
        position:absolute;
        left:0;
        top:4px;
        bottom:4px;
        width:2px;
        border-radius:2px;
        background:var(--theme-skin-vertical);
      }
      .cluster[data-theme-skin="gradient"] .fl-tool-header:hover,
      .cluster[data-theme-skin="gradient"] .fl-tool-header:focus-visible,
      .cluster[data-theme-skin="gradient"] .fl-tool-header[aria-expanded="true"] {
        background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
      }
      .cluster[data-theme-skin="gradient"] :is(.life-btn,.select-lite,.auth-input):focus-visible,
      .cluster[data-theme-skin="gradient"] .skip-streamer-chip:focus-visible {
        outline:2px solid transparent !important;
        border-color:transparent !important;
        background-origin:border-box !important;
        background-clip:padding-box,border-box !important;
        background-image:linear-gradient(var(--theme-bg),var(--theme-bg)),var(--theme-skin) !important;
      }
      .cluster[data-ui-theme="warm"] #tdh-tools-dock {
        border:1px solid color-mix(in srgb,var(--theme-line) 84%,var(--theme-accent) 16%) !important;
        background-image:
          radial-gradient(120% 65% at 50% -18%,color-mix(in srgb,var(--theme-accent) 9%,transparent),transparent 72%),
          linear-gradient(180deg,color-mix(in srgb,var(--theme-panel) 42%,var(--theme-bg) 58%),var(--theme-bg) 44%) !important;
        background-clip:padding-box !important;
        box-shadow:0 18px 50px #0009,inset 0 1px 0 #ffedcf12;
      }
      .cluster[data-ui-theme="warm"] .header-icon {
        background:linear-gradient(155deg,color-mix(in srgb,var(--theme-accent) 13%,var(--theme-panel)),var(--theme-panel) 70%);
        box-shadow:inset 0 1px 0 #ffedcf20,0 2px 9px #0005;
      }
      .cluster[data-ui-theme="warm"] #tdh-header-version {
        border-color:color-mix(in srgb,var(--theme-line) 66%,var(--theme-accent) 34%);
        background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
        color:var(--theme-accent2);
      }
      .cluster[data-ui-theme="warm"] #tdh-rail-close {
        border-color:var(--theme-line);background:var(--theme-panel);color:var(--theme-muted);
      }
      .cluster[data-ui-theme="warm"] .header-divider {
        background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--theme-accent) 55%,transparent) 50%,transparent);
      }
      .cluster[data-ui-theme="warm"] :is(.fl-tool-header,.life-btn):not(.last-opened) {
        box-shadow:inset 0 1px 0 #ffedcf0a;
      }
      .cluster[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"] {
        background:#fff;
        border-color:#fff;
      }
      .cluster[data-ui-theme="contrast"] .toggleSwitch[aria-checked="true"]::after {
        background:#050505;
        border-color:#fff;
      }
      .compact-inventory { display:none; margin-top:6px; border:1px solid #9147ff55; background:#111114; border-radius:9px; overflow:hidden; }
      .compact-inventory.open { display:block; }
      .campaign-manager { margin-top:6px; border:1px solid color-mix(in srgb,var(--theme-accent) 34%,var(--theme-line)); border-radius:9px; background:var(--theme-bg); overflow:hidden; }
      .campaign-manager > summary { list-style:none; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 8px; cursor:pointer; }
      .campaign-manager > summary::-webkit-details-marker { display:none; }
      .campaign-manager-title { flex:0 0 auto; white-space:nowrap; font-size:var(--exp-font-size-body,13px); font-weight:800; color:var(--theme-text); }
      .campaign-manager-summary { flex:1 1 0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right; font-size:var(--exp-font-size-small,11px); font-weight:700; color:var(--theme-muted); }
      .campaign-manager[open] > summary { border-bottom:1px solid var(--theme-line); }
      .campaign-manager-note { padding:6px 8px 3px; font-size:var(--exp-font-size-small,11px); line-height:1.35; color:var(--theme-muted); }
      .campaign-manager-note[data-tone="warn"] { color:#f2cf75; }
      #tdh-campaign-planner { color:var(--theme-text); font-weight:700; }
      .unclaimed-badge { flex:0 0 auto; padding:1px 6px; border:1px solid color-mix(in srgb,#e2b34a 58%,var(--theme-line)); border-radius:8px; color:#f2cf75; font-size:var(--exp-font-size-small,11px); font-weight:800; white-space:nowrap; }
      .unclaimed-badge[hidden] { display:none; }
      .unclaimed-section { border-bottom:1px solid var(--theme-line); }
      .unclaimed-section[hidden] { display:none; }
      .unclaimed-title { padding:6px 8px 0; font-size:var(--exp-font-size-small,11px); font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--theme-muted); }
      .eligibility-chip {
        grid-column:1/-1; margin-top:6px;
        border:1px solid color-mix(in srgb,var(--theme-line) 68%,var(--theme-accent) 32%);
        border-radius:8px; background:var(--theme-panel); overflow:hidden;
      }
      .eligibility-chip > summary {
        list-style:none; display:flex; align-items:center; gap:6px; min-height:28px;
        box-sizing:border-box; padding:5px 8px; cursor:pointer;
        color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:800;
      }
      .eligibility-chip > summary::-webkit-details-marker { display:none; }
      .eligibility-chip > summary::after {
        content:"▸"; margin-left:auto; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); transition:.12s transform;
      }
      .eligibility-chip[open] > summary::after { transform:rotate(90deg); }
      .eligibility-chip > summary > #tdh-eligibility-summary { flex:1 1 auto; min-width:0; }
      .eligibility-checklist-count { flex:0 1 auto; min-width:0; max-width:45%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); font-weight:700; }
      .eligibility-chip > .eligibility-checklist-list { border-top:1px solid var(--theme-line); }
      .eligibility-chip[data-tone="good"] { border-color:color-mix(in srgb,#3ac978 58%,var(--theme-line)); }
      .eligibility-chip[data-tone="warn"] { border-color:color-mix(in srgb,#e2b34a 58%,var(--theme-line)); }
      .eligibility-chip[data-tone="bad"] { border-color:color-mix(in srgb,#df5b65 58%,var(--theme-line)); }
      .eligibility-chip[data-tone="muted"] { border-color:var(--theme-line); }
      .eligibility-detail {
        padding:0 8px 7px; border-top:1px solid var(--theme-line);
        color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.4;
      }
      .eligibility-detail[hidden] { display:none; }
      .campaign-game-list { max-height:240px; overflow:auto; padding:2px 7px 6px; }
      .campaign-game-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; min-height:36px; padding:6px 0; }
      .campaign-game-row + .campaign-game-row { border-top:1px solid #242429; }
      .campaign-game-copy { min-width:0; }
      .campaign-game-name { overflow:hidden; color:var(--theme-text); font-size:var(--exp-font-size-small,11px); font-weight:800; text-overflow:ellipsis; white-space:nowrap; }
      .campaign-game-meta { margin-top:2px; color:var(--theme-muted); font-size:var(--exp-font-size-small,11px); line-height:1.3; }
      .campaign-ignore-check { position:relative; box-sizing:border-box; width:22px; height:22px; padding:0; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-panel); color:var(--theme-text); cursor:pointer; }
      .campaign-ignore-check::after { content:""; position:absolute; inset:4px; border-radius:3px; background:transparent; }
      .campaign-ignore-check[aria-checked="true"] { border-color:var(--theme-accent); background:color-mix(in srgb,var(--theme-panel) 70%,var(--theme-accent) 30%); }
      .campaign-ignore-check[aria-checked="true"]::after { content:"✓"; display:grid; place-items:center; inset:0; background:transparent; color:var(--theme-text); font-size:13px; font-weight:900; }
      .campaign-ignore-check:focus-visible { outline:2px solid var(--theme-accent2); outline-offset:2px; }
      .inventory-head { padding:7px 8px; border-bottom:1px solid #2a2a30; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .inventory-head strong { font-size:var(--exp-font-size-body,13px); }
      .inventory-head span { font-size:var(--exp-font-size-small,11px); color:#adadb8; }
      .inventory-list { padding:3px 7px 6px; }
      .inventory-item { display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:7px; align-items:center; padding:6px 0; }
      .inventory-item + .inventory-item { border-top:1px solid #242429; }
      .reward-thumb { width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg,#9147ff,#5c16c5); display:grid; place-items:center; font-size:var(--exp-font-size-small,11px); font-weight:900; color:#fff; }
      .reward-copy { min-width:0; }
      .reward-name { font-size:var(--exp-font-size-small,11px); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .reward-meta { margin-top:1px; font-size:var(--exp-font-size-small,11px); color:#adadb8; }
      .reward-state { font-size:var(--exp-font-size-small,11px); font-weight:800; color:#bf94ff; white-space:nowrap; }
      .queue-list { display:block; }
      .queue-collapsible {
        grid-column:1/-1;
        margin-top:6px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 34%,var(--theme-line));
        border-radius:9px;
        background:var(--theme-bg);
        overflow:hidden;
      }
      .queue-collapsible > summary {
        list-style:none;
      }
      .queue-collapsible > summary::-webkit-details-marker {
        display:none;
      }
      .queue-summary-head {
        min-height:32px;
        padding:7px 8px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        cursor:pointer;
        user-select:none;
      }
      .queue-summary-head:hover,
      .queue-summary-head:focus-visible {
        background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%);
        outline:none;
      }
      .queue-summary-head > div {
        min-width:0;
        display:flex;
        align-items:baseline;
        gap:4px;
      }
      .queue-summary-head strong {
        font-size:var(--exp-font-size-small,11px);
        white-space:nowrap;
      }
      .queue-summary-head span:not(.queue-summary-chevron) {
        min-width:0;
        color:var(--theme-muted);
        font-size:var(--exp-font-size-small,11px);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .queue-summary-chevron {
        flex:0 0 auto;
        color:var(--theme-muted);
        font-size:var(--exp-font-size-body,13px);
        transition:.15s transform;
      }
      .queue-collapsible[open] .queue-summary-chevron {
        transform:rotate(90deg);
      }
      .queue-collapsible[open] .inventory-list {
        border-top:1px solid var(--theme-line);
      }
      .diag { display:none; box-sizing:border-box;width:100%;min-width:0;height:160px;max-height:160px;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;box-shadow:inset 0 2px 6px #0006; margin-top:6px; padding:7px; border:1px solid #2b2b31; border-radius:7px; background:#101014; font:var(--exp-font-size-small,11px)/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; color:#b8b8c0; white-space:pre-wrap; }
      .diag.open { display:block; }
      .has-tooltip { position:relative; }
      .has-tooltip::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + 4px); width:min(190px, calc(100vw - 48px)); max-width:100%; padding:6px 8px; border:1px solid #3b3b44; border-radius:7px; background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0007; box-sizing:border-box; font-size:var(--exp-font-size-small,11px); line-height:1.35; white-space:normal; overflow-wrap:anywhere; opacity:0; pointer-events:none; z-index:999; transform:translateY(-2px); transition:.12s opacity,.12s transform; }
      .has-tooltip:hover::after, .has-tooltip:focus-visible::after { opacity:1; transform:translateY(0); }
      .reduce-motion *, .reduce-motion *::before, .reduce-motion *::after { animation:none !important; transition:none !important; }
      @media (max-width:700px) {
        .badge-row { width:100%; }
        #tdh-drop-card { flex:1 1 auto; width:auto; min-width:0; max-width:none; }
      }
    `;
  }

