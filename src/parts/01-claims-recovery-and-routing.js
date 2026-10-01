  function restoreRecoverySnapshot(now = Date.now()) {
    if (!settings.resumeSessionOnRestart || currentDrop) return false;
    const snapshot = loadRecoverySnapshot(now);
    if (!snapshot) return false;
    currentDrop = { ...snapshot.drop, isClaimed: false };
    writeSession('tdh-drop', currentDrop);
    if (Number.isFinite(Number(currentDrop.percent))) {
      lastProgress = Number(currentDrop.percent);
      progressLabel = `${lastProgress}%`;
      writeSession('tdh-progress', lastProgress);
    }
    lastProgressAt = Number(snapshot.progressAt || 0);
    if (lastProgressAt) writeSession('tdh-progress-at', lastProgressAt);
    const login = cleanText(watchingLogin()).toLowerCase();
    const preferred = cleanText(snapshot.preferredStream).toLowerCase();
    if (login && preferred && login === preferred) {
      writeRoutingControllerSession({
        ...routingSessionDefaults(ROUTING_STATES.VERIFY_STREAM),
        ...routingControllerTargetFromDrop(currentDrop),
        targetStream: login,
        candidateEvidence: { source: 'restart-recovery', verificationRequired: true, recoveredSession: true },
        verifyBaselineMinutes: Number(currentDrop.currentMinutes || 0),
        verifyBaselinePercent: Number(currentDrop.percent || 0),
        deadlineAt: now + ROUTING_VERIFY_DEADLINE_MS,
      });
    } else if (settings.findNextStream) {
      writeRoutingControllerSession({
        ...routingSessionDefaults(ROUTING_STATES.FIND_STREAM),
        ...routingControllerTargetFromDrop(currentDrop),
        targetStream: '',
        candidateEvidence: { source: 'restart-recovery', verificationRequired: true, recoveredSession: true },
        deadlineAt: 0,
      });
    }
    lastSessionRecovery = {
      at: now,
      snapshotAt: Number(snapshot.at || now),
      preferredStream: preferred || null,
      sameStream: Boolean(login && preferred && login === preferred),
      drop: currentDrop.name || 'Current Drop',
      game: currentDrop.game || null,
    };
    logActivity('session-recovery', `Recovered ${currentDrop.name || 'Drop'} after restart · re-verifying Twitch`, {
      game: currentDrop.game || null,
      preferredStream: preferred || null,
      sameStream: lastSessionRecovery.sameStream,
      snapshotAgeSeconds: Math.max(0, Math.floor((now - Number(snapshot.at || now)) / 1000)),
    });
    queueGqlPollSoon('restart-recovery', 0);
    return true;
  }

  function refreshSessionRecoveryStatus() {
    const node = ui?.shadow?.getElementById('tdh-session-recovery-status');
    if (!node) return;
    if (!lastSessionRecovery) {
      node.hidden = true;
      node.textContent = '';
      return;
    }
    node.hidden = false;
    const age = Math.max(0, Date.now() - Number(lastSessionRecovery.snapshotAt || Date.now()));
    node.textContent = `Restart recovery · ${lastSessionRecovery.drop}${lastSessionRecovery.game ? ` · ${lastSessionRecovery.game}` : ''} · saved ${briefAge(age)} ago · re-verifying Twitch`;
  }

  function manualStreamLockSnapshot() {
    const login = cleanText(watchingLogin()).toLowerCase();
    const lock = readSession(MANUAL_STREAM_LOCK_KEY, null);
    if (!lock?.login) return null;
    if (login && cleanText(lock.login).toLowerCase() === login) return { ...lock, login };
    if (login && cleanText(lock.login).toLowerCase() !== login) removeSession(MANUAL_STREAM_LOCK_KEY);
    return null;
  }

  function setManualStreamLock(enabled, reason = 'viewer') {
    const login = cleanText(watchingLogin()).toLowerCase();
    const current = readSession(MANUAL_STREAM_LOCK_KEY, null);
    if (!enabled || !login) {
      if (current?.login) {
        logActivity('stream-lock', 'Released Stay On This Stream', {
          stream: current.login,
          reason: reason || 'viewer',
        });
      }
      removeSession(MANUAL_STREAM_LOCK_KEY);
      refreshViewingControls();
      return false;
    }
    writeSession(MANUAL_STREAM_LOCK_KEY, { login, at: Date.now(), reason: reason || 'viewer' });
    logActivity('stream-lock', 'Stay On This Stream enabled', { stream: login });
    refreshViewingControls();
    return true;
  }

  function viewingNavigationAllowed(reason = '', explicit = false) {
    const state = syncViewingContext();
    const manualAction = explicit || reason === 'manual-stream-skip' || Date.now() < explicitViewingNavigationUntil;
    if (!manualAction && manualStreamLockSnapshot()) {
      lastViewingNavigationBlock = 'Stream Locked';
      return false;
    }
    if (viewingIntent.navigationAllowed(manualAction)) return true;
    lastViewingNavigationBlock = state.paused ? 'Playback Paused' : 'Your Stream Is Selected';
    return false;
  }

  function viewingStatus() {
    const state = viewingIntent.snapshot();
    const lock = manualStreamLockSnapshot();
    if (state.paused) return state.pauseReason === 'viewer'
      ? { label: 'Playback Paused', detail: 'Dropper will not resume playback or switch streams while your pause is active.' }
      : { label: 'Playback Needs Attention', detail: 'Playback is paused. Resume it yourself or choose Resume Playback; Dropper will not guess why it stopped.' };
    if (lock) return { label: 'Staying On This Stream', detail: `Automatic routing is held on ${lock.login}. Dropper will still monitor Twitch credit and release the lock if the stream becomes unusable.` };
    if (lastViewingNavigationBlock && state.manualStream) return { label: 'Your Stream Is Selected', detail: 'Campaign recommendations will not change this stream. Use Skip Streamer or enable automatic switching when ready.' };
    return null;
  }

  function noteRequestedViewingNavigation(target) {
    const channel = streamLoginFromUrl(target) || '';
    if (channel) writeSession(VIEWING_NAVIGATION_KEY, { channel, until: Date.now() + 30000 });
    else removeSession(VIEWING_NAVIGATION_KEY);
  }

  function installViewingIntent() {
    if (viewingListenersInstalled) return;
    viewingListenersInstalled = true;
    syncViewingContext();
    const editable = node => Boolean(node?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'));
    const control = event => {
      if (!event.isTrusted || !watchingLogin() || editable(event.target)) return;
      const video = streamVideoElement();
      if (!video) return;
      const keyboard = event.type === 'keydown';
      if (keyboard && (event.altKey || event.ctrlKey || event.metaKey || event.repeat || ![' ', 'k', 'K'].includes(event.key))) return;
      if (!keyboard && event.target !== video && !event.target?.closest?.('[data-a-target="player-play-pause-button"],[data-a-target="player-overlay-play-button"]')) return;
      recentPlaybackControl = { action: video.paused ? 'resume' : 'pause', at: Date.now() };
    };
    const media = event => {
      if (!watchingLogin() || event.target !== streamVideoElement()) return;
      syncViewingContext();
      const explicit = Date.now() - recentPlaybackControl.at < 1500;
      if (event.type === 'pause' && !event.target.ended && !event.target.error) viewingIntent.pause(explicit && recentPlaybackControl.action === 'pause');
      if (event.type === 'playing') {
        if (viewingIntent.resume({ explicit: explicit && recentPlaybackControl.action === 'resume', remounted: videoMountedDuringPause })) {
          videoMountedDuringPause = false;
          removeSession(VIEWING_NAVIGATION_KEY);
          lastViewingNavigationBlock = '';
        } else { try { event.target.pause(); } catch (_) {} }
      }
      if (event.type === 'waiting' || event.type === 'stalled') viewingIntent.observe('buffering');
      if (event.type === 'ended') viewingIntent.observe('ended');
      if (event.type === 'error') viewingIntent.observe('error');
      refreshViewingControls();
      syncScreenWakeLock();
    };
    const preserveLayoutChoice = event => {
      if (!event.isTrusted || event.composedPath().some(node => node?.id === 'tdh-root')) return;
      if (event.type === 'keydown' && !['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) return;
      playerPresentationRecovery.viewerInteracted = true;
    };
    for (const type of ['pointerdown','wheel','touchmove','keydown']) document.addEventListener(type, preserveLayoutChoice, {capture:true,passive:true});
    // exp-core-allow: records the viewer's own player controls (pause/play), not a menu.
    document.addEventListener('pointerdown', control, true);
    document.addEventListener('keydown', control, true);
    for (const type of ['pause', 'playing', 'waiting', 'stalled', 'ended', 'error']) document.addEventListener(type, media, true);
    for (const type of ['fullscreenchange', 'enterpictureinpicture', 'leavepictureinpicture']) {
      document.addEventListener(type, () => { syncViewingContext(); queueClaimScan(); refreshViewingControls(); }, true);
    }
    window.addEventListener('popstate', () => { syncViewingContext(); refreshViewingControls(); });
    document.addEventListener('visibilitychange', syncScreenWakeLock);
    window.addEventListener('pagehide', () => { try { screenWakeLock?.release(); } catch (_) {} screenWakeLock = null; });
  }

  async function syncScreenWakeLock() {
    const shouldHold = Boolean(settings.keepTabActive && !document.hidden && watchingLogin() && streamVideoIsPlaying() && !viewingIntent.snapshot().paused);
    if (!shouldHold) {
      const lock = screenWakeLock; screenWakeLock = null;
      try { await lock?.release(); } catch (_) {}
      return;
    }
    if (screenWakeLock || wakeLockPending || !navigator.wakeLock?.request) return;
    wakeLockPending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (settings.keepTabActive && !document.hidden && streamVideoIsPlaying() && !viewingIntent.snapshot().paused) {
        screenWakeLock = lock;
        lock.addEventListener('release', () => { if (screenWakeLock === lock) screenWakeLock = null; }, { once: true });
      } else await lock.release();
    } catch (_) { /* Unsupported or denied wake locks never affect playback. */ }
    finally { wakeLockPending = false; }
  }

  function refreshViewingControls() {
    if (!ui) return;
    const state = viewingIntent.snapshot();
    const lock = manualStreamLockSnapshot();
    const message = viewingStatus();
    const status = ui.shadow.getElementById('tdh-viewing-status');
    if (status) status.textContent = message?.detail || (state.manualStream ? 'Your selected stream is protected from automatic navigation.' : 'Automatic navigation follows your stream settings.');
    const resume = ui.shadow.getElementById('tdh-resume-playback');
    if (resume) resume.hidden = !state.paused && state.playback === 'playing';
    const automatic = ui.shadow.getElementById('tdh-allow-switching');
    if (automatic) automatic.hidden = Boolean(lock) || (!state.manualStream && settings.findNextStream);
    const streamLock = ui.shadow.getElementById('tdh-stream-lock');
    if (streamLock) {
      streamLock.hidden = !watchingLogin();
      streamLock.setAttribute('aria-pressed', String(Boolean(lock)));
      streamLock.textContent = lock ? 'Release Stream Lock' : 'Stay On This Stream';
    }
    refreshRecoveryAction();
  }

  function claimContext() {
    syncViewingContext();
    return { channel: watchingLogin() || '', account: storageAccountLogin(), generation: viewingIntent.snapshot().generation, campaign: String(currentDrop?.campaignKey || currentDrop?.campaignId || '') };
  }
  function claimContextIsCurrent(context) {
    return context.channel === (watchingLogin() || '') && context.account === storageAccountLogin() && context.generation === viewingIntent.snapshot().generation && context.campaign === String(currentDrop?.campaignKey || currentDrop?.campaignId || '');
  }

  function claimHistoryPrefix(account = storageAccountLogin()) {
    return scopedLocalStorageKey(CLAIM_HISTORY_KEY, account) + ':record:';
  }
  function storedClaimRecords(account) {
    const prefix = claimHistoryPrefix(account); const records = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try { const record = JSON.parse(localStorage.getItem(key)); if (record) records.push({ key, record }); } catch (_) {}
      }
    } catch (_) {}
    return records.sort((a, b) => Number(b.record.updatedAt || 0) - Number(a.record.updatedAt || 0));
  }
  function claimLedger() {
    const account = storageAccountLogin();
    if (claimLedgerInstance && claimLedgerAccount === account) return claimLedgerInstance;
    claimLedgerAccount = account;
    claimLedgerInstance = DropperActiveViewing.createClaims({
      id: () => globalThis.crypto?.randomUUID?.() || `${TAB_ID}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      read: () => storedClaimRecords(account).slice(0, 100).map(item => item.record),
      put: record => {
        const prefix = claimHistoryPrefix(account);
        localStorage.setItem(prefix + encodeURIComponent(record.key), JSON.stringify(record));
        for (const stale of storedClaimRecords(account).slice(100)) localStorage.removeItem(stale.key);
      },
    });
    return claimLedgerInstance;
  }
  function claimRecordKey(drop) {
    const identity = String(drop?.id || drop?.dropInstanceID || '');
    return identity ? `drop:${String(drop.campaignId || drop.campaignKey || '').toLowerCase()}:${identity}` : '';
  }
  function claimLeaseStorageKey(key, account) {
    return `dropper-claim-lease-v1:${encodeURIComponent(account || 'signed-out')}:${encodeURIComponent(key)}`;
  }
  const fallbackClaimLease = DropperActiveViewing.createLease({
    id: () => TAB_ID,
    ttlMs: 8000,
    read: key => {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
    },
    write: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    remove: key => localStorage.removeItem(key),
    // A short settle lets simultaneous tabs observe which write actually won.
    settle: () => new Promise(resolve => setTimeout(resolve, 25)),
  });
  async function withClaimLock(key, context, task) {
    if (!claimContextIsCurrent(context)) return false;
    if (navigator.locks?.request) {
      return navigator.locks.request(`dropper-claim:${context.account}:${key}`, { ifAvailable: true }, lock => lock && claimContextIsCurrent(context) ? task() : false);
    }
    if (!isAutoRoutingController()) return false;
    return fallbackClaimLease.run(claimLeaseStorageKey(key, context.account), () => claimContextIsCurrent(context) ? task() : false);
  }
  function applyConfirmedDropClaim(campaigns, attempt) {
    const campaignId = cleanText(attempt?.campaignId).toLowerCase();
    const rewardId = cleanText(attempt?.rewardId);
    if (!campaignId || !rewardId) return campaigns || [];
    return (campaigns || []).map(campaign => {
      const key = cleanText(campaignKey(campaign) || campaign?.id).toLowerCase();
      if (key !== campaignId && cleanText(campaign?.id).toLowerCase() !== campaignId) return campaign;
      const drops = (campaign.timeBasedDrops || campaign.drops || []).map(drop => {
        if (cleanText(drop?.id) !== rewardId) return drop;
        return { ...drop, self: { ...(drop.self || {}), isClaimed: true } };
      });
      return { ...campaign, timeBasedDrops: drops, drops };
    });
  }

  function continueAfterConfirmedDropClaim(attempt) {
    if (attempt?.kind !== 'drop' || !attempt.rewardId || !attempt.campaignId) return false;
    lastInventoryCampaigns = applyConfirmedDropClaim(lastInventoryCampaigns, attempt);
    lastCampaignCatalog = applyConfirmedDropClaim(lastCampaignCatalog, attempt);
    const pool = routingCampaignPool();
    const campaignId = cleanText(attempt.campaignId).toLowerCase();
    const campaign = pool.find(item => {
      const key = cleanText(campaignKey(item) || item?.id).toLowerCase();
      return key === campaignId || cleanText(item?.id).toLowerCase() === campaignId;
    });
    if (!campaign) return false;
    const game = campaignGameName(campaign);
    const next = pickTimedDrop([campaign], game);
    if (!next || dropProgressComplete(next) || !dropFitsCampaignWindow(next)) return false;

    const currentCampaign = cleanText(currentDrop?.campaignKey || currentDrop?.campaignId).toLowerCase();
    const alreadyProgressingElsewhere = Boolean(
      currentDrop &&
      currentCampaign &&
      currentCampaign !== campaignId &&
      Number(currentDrop.currentMinutes || 0) > 0
    );
    if (alreadyProgressingElsewhere) return false;

    adoptSelectedTargetDrop(next, 'claim-unlocked-next-drop');
    const login = watchingLogin();
    const info = login ? readStreamInfo() : null;
    const sameLiveGame = Boolean(login && info?.live && info.game && gameNamesMatch(next.game || game, info.game));
    const routing = readRoutingControllerSession();
    if (sameLiveGame) {
      transitionRoutingController(
        ROUTING_STATES.VERIFY_STREAM,
        {
          ...routingControllerTargetFromDrop(next),
          targetStream: login,
          failedStreams: [],
          candidateEvidence: routing.candidateEvidence || null,
          verifyBaselineMinutes: Number(next.currentMinutes || 0),
          verifyBaselinePercent: Number(next.percent || 0),
          deadlineAt: Date.now() + ROUTING_VERIFY_DEADLINE_MS,
        },
        `Claim unlocked ${next.name || 'next Drop'} · verifying current stream`,
      );
      requestGqlPoll('claim-unlocked-next-drop', true);
    } else if (settings.findNextStream) {
      transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          ...routingControllerTargetFromDrop(next),
          targetStream: '',
          failedStreams: [],
          candidateEvidence: null,
          deadlineAt: 0,
        },
        `Claim unlocked ${next.name || 'next Drop'} · finding an eligible stream`,
      );
    }
    logActivity('claim-unlocked-reward', `Claim unlocked ${next.name || 'next Drop'} in the same campaign`, {
      campaign: next.campaign || campaign.name || game || null,
      campaignKey: next.campaignKey || next.campaignId || null,
      claimedRewardId: attempt.rewardId,
      nextRewardId: next.id || null,
      sameLiveGame,
    });
    setStatus(`Claim Confirmed · Next Drop: ${next.name || 'Drop'}`);
    queueGqlPollSoon('claim-unlocked-next-drop', 0);
    return true;
  }
  function recordClaimOutcome(ledger, attempt, outcome, evidence) {
    const settled = ledger.settle(attempt.key, attempt.attemptId, outcome, evidence);
    if (!settled) return null;
    const label = DropperActiveViewing.claimPresentation(settled);
    if (outcome === 'confirmed' || outcome === 'already-claimed') {
      if (attempt.kind === 'bonus') lastBonusAt = Date.now();
      else lastDropAt = Date.now();
      if (attempt.kind === 'drop') {
        if (attempt.key === claimRecordKey(currentDrop)) resetClaimReadyTimer();
        continueAfterConfirmedDropClaim(attempt);
      }
    }
    logActivity('claim-result', label, { kind: attempt.kind, rewardId: attempt.rewardId || null, outcome, evidence });
    setStatus(label);
    if (outcome === 'confirmed') {
      notifyUser(label);
      sendBrowserNotification(
        'claimed',
        'Dropper · Drop claimed',
        cleanText(settled.rewardName || (settled.kind === 'bonus' ? 'Bonus Chest' : 'Drop')) + (settled.game ? ` · ${settled.game}` : ''),
        { tag: `claim-${settled.key}` },
      );
    }
    for (const health of Object.values(claimHealth)) {
      if (health.kind === attempt.kind) { health.lastOutcome = outcome; health.lastEvidence = evidence; health.lastResultAt = Date.now(); }
    }
    renderClaimHistory();
    return settled;
  }
  function reconcileClaimHistory(campaigns) {
    const ledger = claimLedger();
    for (const record of ledger.snapshot()) {
      if (record.kind !== 'drop' || !record.rewardId || !['pending', 'unconfirmed', 'retryable', 'blocked'].includes(record.outcome)) continue;
      const campaign = (campaigns || []).find(item => String(item.id || '').toLowerCase() === record.campaignId.toLowerCase());
      const drop = (campaign?.timeBasedDrops || campaign?.drops || []).find(item => String(item.id || '') === record.rewardId);
      if (drop?.self?.isClaimed === true) recordClaimOutcome(ledger, record, 'confirmed', 'inventory');
    }
  }

  const CLAIM_GROUPS = Object.freeze([
    { id: 'bonus', kind: 'bonus', selector: BONUS_SELECTOR, applies: () => Boolean(watchingLogin()) },
    { id: 'stream-drop', kind: 'drop', selector: DROP_CLAIM_SELECTOR, applies: () => Boolean(watchingLogin()) },
    { id: 'inventory-drop', kind: 'drop', selector: DROP_CLAIM_SELECTOR, applies: () => isInventory() },
  ]);
  function claimTargetRendered(button) {
    if (!button?.isConnected) return false;
    const ownStyle = getComputedStyle(button);
    if (ownStyle.pointerEvents === 'none') return false;
    try {
      if (typeof button.checkVisibility === 'function') {
        return button.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      }
    } catch (_) {}
    for (let node = button; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    }
    return true;
  }
  function isSafeClaimTarget(button, group) {
    if (!button || button.tagName !== 'BUTTON' || !button.isConnected || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[inert]')) return false;
    const label = cleanText(`${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`);
    if (/\b(?:subscribe|subscription|gift|purchase|buy|redeem|spend)\b/i.test(label)) return false;
    const bonusContainer = button.closest(TWITCH_DOM_SELECTORS.bonusContainer);
    if (group.kind === 'bonus' && !bonusContainer && !button.querySelector('.claimable-bonus__icon')) return false;
    if (claimTargetRendered(button)) return true;
    return Boolean(
      group.kind === 'bonus' &&
      document.fullscreenElement &&
      bonusContainer &&
      button.matches('button[aria-label="Claim Bonus"]') &&
      button.querySelector('.claimable-bonus__icon')
    );
  }
  function claimTargetIdentity(button, group) {
    if (group.kind === 'drop') {
      const carrier = button.closest('[data-drop-id],[data-drop-instance-id]');
      const rewardId = carrier?.getAttribute('data-drop-id') || '';
      const instanceId = carrier?.getAttribute('data-drop-instance-id') || '';
      for (const campaign of lastInventoryCampaigns) {
        const reward = (campaign.timeBasedDrops || campaign.drops || []).find(item => (rewardId && item.id === rewardId) || (instanceId && item.self?.dropInstanceID === instanceId));
        if (reward && !reward.self?.isClaimed) return {
          id: reward.id, campaignId: String(campaign.id || ''), campaignKey: campaignKey(campaign),
          dropInstanceID: reward.self?.dropInstanceID || '',
          name: reward.name || reward.benefitEdges?.[0]?.benefit?.name || 'Drop',
          game: campaignGameName(campaign),
        };
      }
      if (!isInventory() && currentDrop?.id && dropProgressComplete(currentDrop)) return currentDrop;
    }
    if (!claimNodeIds.has(button)) claimNodeIds.set(button, `anonymous:${TAB_ID}:${++claimAnonymousSequence}`);
    return { anonymous: claimNodeIds.get(button) };
  }
  function bonusControlStillClaimable(button) {
    if (!button?.isConnected) return false;
    const container = button.closest(TWITCH_DOM_SELECTORS.bonusContainer);
    if (!container) return false;
    if (!button.querySelector('.claimable-bonus__icon')) return false;
    return isSafeClaimTarget(button, CLAIM_GROUPS[0]);
  }
  function confirmDismissedBonusControl(button, ledger, attempt, context) {
    setTimeout(() => {
      if (!claimContextIsCurrent(context)) return;
      const current = ledger.snapshot().find(record => record.key === attempt.key && record.attemptId === attempt.attemptId);
      if (!current || current.outcome !== 'pending') return;
      if (bonusControlStillClaimable(button)) return;
      recordClaimOutcome(ledger, attempt, 'confirmed', 'control-dismissed');
    }, BONUS_CONFIRM_SETTLE_MS);
  }
  function queuePageClaim(button, group) {
    if (!isSafeClaimTarget(button, group)) return false;
    const context = claimContext();
    if (context.account === 'signed-out') return false;
    const identity = claimTargetIdentity(button, group);
    const key = identity.anonymous || claimRecordKey(identity);
    if (!key) return false;
    if (identity.anonymous && Date.now() - lastAnonymousAttemptAt[group.kind] < 1500) return false;
    void withClaimLock(key, context, async () => {
      if (!isSafeClaimTarget(button, group)) return false;
      if (identity.anonymous && Date.now() - lastAnonymousAttemptAt[group.kind] < 1500) return false;
      const ledger = claimLedger();
      const attempt = ledger.begin({
        key, rewardId: identity.id || '', campaignId: identity.campaignId || identity.campaignKey || '',
        rewardName: group.kind === 'bonus' ? 'Bonus Chest' : cleanText(identity.name || currentDrop?.name || 'Drop'),
        game: cleanText(identity.game || currentDrop?.game || ''), kind: group.kind, evidence: 'page-control'
      });
      if (!attempt) return false;
      if (identity.anonymous) lastAnonymousAttemptAt[group.kind] = Date.now();
      try {
        button.click();
        if (group.kind === 'bonus') confirmDismissedBonusControl(button, ledger, attempt, context);
        claimHealth[group.id] = { ...claimHealth[group.id], kind: group.kind, state: 'attempted', lastAttemptAt: Date.now() };
        logActivity('claim-attempt', 'Claim Sent', { kind: group.kind, rewardId: identity.id || null, evidence: 'page-control' });
        setStatus('Claim Sent · Waiting For Twitch');
        queueGqlPollSoon('claim-confirmation', 1500);
        renderClaimHistory();
        return true;
      } catch (_) {
        if (claimContextIsCurrent(context)) recordClaimOutcome(ledger, attempt, 'unconfirmed', 'page-control');
        return false;
      }
    }).catch(() => { claimHealth[group.id] = { ...claimHealth[group.id], kind: group.kind, state: 'detection-failed' }; });
    return true;
  }
  function scanClaimGroups(root = document, kind = '') {
    if (claimScanTimer) { clearTimeout(claimScanTimer); claimScanTimer = null; }
    lastClaimScanAt = Date.now();
    claimScanQueuedAt = 0;
    let queued = 0;
    for (const group of CLAIM_GROUPS) {
      if (kind && kind !== group.kind) continue;
      const applicable = group.applies() && (group.kind === 'bonus' ? settings.claimBonus : settings.claimDrops);
      const checkedAt = Date.now();
      const previous = claimHealth[group.id] || {};
      claimHealth[group.id] = {
        ...previous,
        kind: group.kind,
        applicable,
        state: applicable ? 'no-claimable-reward' : 'not-applicable',
        checkedAt,
        checks: Number(previous.checks || 0) + 1,
        consecutiveNoMatch: applicable ? Number(previous.consecutiveNoMatch || 0) + 1 : 0,
      };
      if (!applicable) continue;
      try {
        const candidates = new Set();
        for (const node of [...(root.matches?.(group.selector) ? [root] : []), ...(root.querySelectorAll?.(group.selector) || [])]) {
          const button = node.closest?.('button');
          if (button && isSafeClaimTarget(button, group)) candidates.add(button);
        }
        if (group.id === 'inventory-drop') {
          for (const card of document.querySelectorAll(TWITCH_DOM_SELECTORS.inventoryCard)) {
            if (!card.querySelector(TWITCH_DOM_SELECTORS.rewardPresentation)) continue;
            for (const button of card.querySelectorAll('button')) if (isDropClaimButton(button) && isSafeClaimTarget(button, group)) candidates.add(button);
          }
        }
        if (candidates.size) {
          claimHealth[group.id].state = 'matched';
          claimHealth[group.id].lastMatchedAt = checkedAt;
          claimHealth[group.id].matchCount = Number(claimHealth[group.id].matchCount || 0) + candidates.size;
          claimHealth[group.id].consecutiveNoMatch = 0;
        }
        for (const button of candidates) if (queuePageClaim(button, group)) queued += 1;
      } catch (_) { claimHealth[group.id].state = 'detection-failed'; claimHealth[group.id].lastFailureAt = Date.now(); }
    }
    renderClaimHistory();
    return queued;
  }
  function queueClaimScan(reason = 'mutation', immediate = false) {
    if (!settings.claimBonus && !settings.claimDrops) return;
    const now = Date.now();
    const earliest = immediate ? now : Math.max(now, lastClaimScanAt + CLAIM_SCAN_MIN_INTERVAL_MS);
    if (claimScanTimer && claimScanQueuedAt && claimScanQueuedAt <= earliest) return;
    if (claimScanTimer) clearTimeout(claimScanTimer);
    claimScanQueuedAt = earliest;
    claimScanTimer = setTimeout(() => {
      claimScanTimer = null;
      claimScanQueuedAt = 0;
      scanClaimGroups();
    }, Math.max(0, earliest - now));
  }
  function claimSelectorHealthSnapshot(now = Date.now()) {
    return Object.fromEntries(Object.entries(claimHealth).map(([id, entry]) => [id, {
      ...entry,
      health: DropperActiveViewing.selectorHealth(entry, now),
    }]));
  }
  function claimHealthSummary(now = Date.now()) {
    const records = claimLedger().snapshot();
    const confirmed = records.filter(record => record.outcome === 'confirmed' || record.outcome === 'already-claimed').length;
    const pending = records.filter(record => record.outcome === 'pending' || record.outcome === 'retryable').length;
    const attention = records.filter(record => record.outcome === 'blocked' || record.outcome === 'unconfirmed').length;
    const parts = [];
    if (!records.length) parts.push('Claims: none');
    else {
      parts.push(`Claims: ${confirmed} confirmed`);
      if (pending) parts.push(`${pending} pending`);
      if (attention) parts.push(`${attention} needs attention`);
    }

    const labels = {
      'monitoring': 'monitoring',
      'observed': 'control observed',
      'observed-recently': 'control seen recently',
      'stale-observation': 'control not seen recently',
      'action-pending': 'claim pending',
      'degraded': 'detector degraded',
    };
    const health = claimSelectorHealthSnapshot(now);
    for (const [id, entry] of Object.entries(health)) {
      if (!entry?.applicable) continue;
      const label = id === 'bonus' ? 'Bonus' : id === 'inventory-drop' ? 'Inventory' : 'Drop';
      parts.push(`${label}: ${labels[entry.health?.status] || entry.health?.status || 'monitoring'}`);
    }

    const sweep = inventoryClaimSweepState || {};
    if (sweep.reason === 'claimed') parts.push(`Inventory sweep: ${Number(sweep.confirmed || 0)} claimed`);
    else if (sweep.reason === 'none-ready') parts.push('Inventory sweep: none ready');
    else if (sweep.reason === 'inventory-unavailable') parts.push('Inventory sweep: unavailable');
    else if (sweep.reason === 'secondary-tab') parts.push('Inventory sweep: managed by another tab');
    else if (sweep.reason === 'disabled') parts.push('Inventory sweep: disabled');
    return parts.join(' · ');
  }
  function renderClaimHistory() {
    const output = ui?.shadow?.getElementById('tdh-claim-history');
    const health = ui?.shadow?.getElementById('tdh-claim-health');
    if (!output) return;
    const records = claimLedger().snapshot()
      .filter(record => record.outcome === 'confirmed' || record.outcome === 'already-claimed')
      .slice(0, 12);
    if (health) health.textContent = claimHealthSummary();
    output.replaceChildren();
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'campaign-manager-note';
      empty.textContent = 'No claimed Drops recorded for this account.';
      output.append(empty);
      return;
    }
    for (const record of records) {
      const row = document.createElement('div');
      row.className = 'claim-history-row';
      const main = document.createElement('div');
      main.className = 'claim-history-main';
      const reward = cleanText(record.rewardName || (record.kind === 'bonus' ? 'Bonus Chest' : 'Drop'));
      const game = cleanText(record.game);
      const state = record.outcome === 'already-claimed' ? 'Already claimed' : 'Claimed';
      main.textContent = `${reward}${game ? ` · ${game}` : ''} · ${state}`;
      const time = document.createElement('div');
      time.className = 'claim-history-time';
      time.textContent = new Date(Number(record.updatedAt || record.at || Date.now())).toLocaleString();
      row.append(main, time);
      output.append(row);
    }
  }

  function renderRoutingHistory() {
    const output = ui?.shadow?.getElementById('tdh-routing-history');
    const summary = ui?.shadow?.getElementById('tdh-routing-history-summary');
    if (!output || !summary) return;
    const routingTypes = new Set(['routing-controller','handoff','stream-switch','stream-recovery','stream-skip','stream-skip-confirmed','multi-tab']);
    const rows = (Array.isArray(activityLog) ? activityLog : [])
      .filter(entry => routingTypes.has(entry.type) || /offline|stall|category|switch|routing|stream/i.test(entry.message || ''))
      .slice(-8)
      .reverse();
    summary.textContent = rows.length ? cleanText(rows[0].message).slice(0, 38) : 'No switches yet';
    output.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'campaign-manager-note';
      empty.textContent = 'Automatic switch reasons will appear here.';
      output.append(empty);
      return;
    }
    for (const entry of rows) {
      const row = document.createElement('div');
      row.className = 'routing-history-row';
      const main = document.createElement('div');
      main.className = 'routing-history-main';
      main.textContent = entry.message || entry.type || 'Routing update';
      const time = document.createElement('div');
      time.className = 'routing-history-time';
      time.textContent = new Date(Number(entry.at || Date.now())).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      row.append(main, time);
      output.append(row);
    }
  }

  function campaignPriorityEntry(game) {
    const key = scopedLocalStorageKey(CAMPAIGN_PRIORITY_KEY) + ':' + encodeURIComponent(normalizeGameName(game));
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return { value: 0, explicit: false, key };
      const value = Number(raw);
      return { value: [-1, 0, 1].includes(value) ? value : 0, explicit: true, key };
    } catch (_) { return { value: 0, explicit: false, key }; }
  }
  function readCampaignPriorityOrder() {
    try {
      const parsed = JSON.parse(localStorage.getItem(scopedLocalStorageKey(CAMPAIGN_PRIORITY_ORDER_KEY)) || '[]');
      return Array.isArray(parsed)
        ? [...new Set(parsed.map(value => normalizeGameName(value)).filter(Boolean))].slice(0, 250)
        : [];
    } catch (_) { return []; }
  }
  function writeCampaignPriorityOrder(order) {
    const clean = [...new Set((order || []).map(value => normalizeGameName(value)).filter(Boolean))].slice(0, 250);
    try { localStorage.setItem(scopedLocalStorageKey(CAMPAIGN_PRIORITY_ORDER_KEY), JSON.stringify(clean)); } catch (_) {}
    return clean;
  }
  function reconcileCampaignPriorityOrder(openGames = []) {
    const keyed = new Map((openGames || []).map(item => [normalizeGameName(item.game), item]).filter(([key]) => key));
    const existing = readCampaignPriorityOrder();
    const missing = [...keyed.keys()].filter(key => !existing.includes(key));
    missing.sort((left, right) => {
      const a = campaignPriorityEntry(keyed.get(left)?.game).value;
      const b = campaignPriorityEntry(keyed.get(right)?.game).value;
      return b - a;
    });
    const next = [...existing, ...missing].slice(0, 250);
    if (JSON.stringify(next) !== JSON.stringify(existing)) writeCampaignPriorityOrder(next);
    return next;
  }
  function campaignPriorityRank(game) {
    const key = normalizeGameName(game);
    const order = readCampaignPriorityOrder();
    const index = order.indexOf(key);
    if (index >= 0) return { rank: index + 1, score: 1000 - index, explicit: true, source: 'ranked' };
    const legacy = campaignPriorityEntry(game);
    return { rank: null, score: legacy.value, explicit: legacy.explicit, source: legacy.explicit ? 'legacy' : 'default' };
  }
  function campaignPriority(game) {
    return campaignPriorityRank(game).score;
  }
  function setCampaignPriority(game, priority) {
    if (![-1, 0, 1].includes(priority)) return;
    const entry = campaignPriorityEntry(game);
    try {
      if (priority === 0) localStorage.removeItem(entry.key);
      else localStorage.setItem(entry.key, String(priority));
    } catch (_) {}
  }
  function moveCampaignPriority(game, direction, openGames = []) {
    const order = reconcileCampaignPriorityOrder(openGames);
    const visible = [...new Set((openGames || []).map(item => normalizeGameName(item.game)).filter(Boolean))]
      .filter(key => order.includes(key))
      .sort((left, right) => order.indexOf(left) - order.indexOf(right));
    const key = normalizeGameName(game);
    const visibleIndex = visible.indexOf(key);
    const targetVisibleIndex = visibleIndex + Number(direction || 0);
    if (visibleIndex < 0 || targetVisibleIndex < 0 || targetVisibleIndex >= visible.length) return false;
    const targetKey = visible[targetVisibleIndex];
    const index = order.indexOf(key);
    const target = order.indexOf(targetKey);
    [order[index], order[target]] = [order[target], order[index]];
    writeCampaignPriorityOrder(order);
    return true;
  }
  function normalizedCampaignStrategy(value = settings.campaignStrategy) {
    const strategy = cleanText(value).toLowerCase();
    return ['priority','deadline','completion','shortest'].includes(strategy) ? strategy : 'priority';
  }

  function campaignStrategyLabel(value = settings.campaignStrategy) {
    return {
      priority: 'My Priority',
      deadline: 'Ending Soonest',
      completion: 'Closest to Completion',
      shortest: 'Shortest Remaining',
    }[normalizedCampaignStrategy(value)];
  }

  function rankCampaignCandidatesForStrategy(candidates, now = Date.now()) {
    const base = DropperActiveViewing.rankCampaignCandidates(candidates, {
      priorityOf: campaignPriority,
      now,
      activeGame: currentDrop?.game || '',
    });
    const strategy = normalizedCampaignStrategy();
    if (strategy === 'priority') return base;
    const original = new Map(base.map((item, index) => [item, index]));
    const remaining = item => {
      const value = Number(item?.sequenceRemainingMinutes ?? item?.remainingMinutes);
      return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
    };
    const deadline = item => {
      const value = Number(item?.endMs);
      return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
    };
    const completion = item => {
      const percent = Number(item?.percent);
      if (Number.isFinite(percent)) return Math.max(0, Math.min(100, percent));
      return item?.sequenceInProgress ? 0.5 : 0;
    };
    const feasibility = item => item?.sequenceFinishable === false ? 1 : 0;
    return [...base].sort((a, b) => {
      const feasibleDelta = feasibility(a) - feasibility(b);
      if (feasibleDelta) return feasibleDelta;
      if (strategy === 'deadline') {
        const delta = deadline(a) - deadline(b);
        if (delta) return delta;
      } else if (strategy === 'completion') {
        const delta = completion(b) - completion(a);
        if (delta) return delta;
        const rem = remaining(a) - remaining(b);
        if (rem) return rem;
      } else if (strategy === 'shortest') {
        const delta = remaining(a) - remaining(b);
        if (delta) return delta;
      }
      if (b.sequencePriority !== a.sequencePriority) return b.sequencePriority - a.sequencePriority;
      return (original.get(a) || 0) - (original.get(b) || 0);
    });
  }

  function dropperPreconditionsMet(drop, drops) {
    return DropperActiveViewing.planPrerequisites(drop, drops).ready;
  }
  function persistedRoutingEligibilityProof(now = Date.now()) {
    if (!currentDrop) return null;
    const routing = readRoutingControllerSession();
    if (routing.state !== ROUTING_STATES.EARNING) return null;

    const login = cleanText(watchingLogin()).toLowerCase();
    const targetStream = cleanText(routing.targetStream).toLowerCase();
    const currentCampaignKey = cleanText(currentDrop.campaignKey || currentDrop.campaignId).toLowerCase();
    const targetCampaignKey = cleanText(routing.targetCampaignKey).toLowerCase();
    const currentDropId = cleanText(currentDrop.id).toLowerCase();
    const targetDropId = cleanText(routing.targetDropId).toLowerCase();
    if (!login || !targetStream || login !== targetStream) return null;
    if (!currentCampaignKey || !targetCampaignKey || currentCampaignKey !== targetCampaignKey) return null;
    if (!currentDropId || !targetDropId || currentDropId !== targetDropId) return null;

    const targetGame = cleanText(currentDrop.game || routing.targetGame);
    const routingGame = cleanText(routing.targetGame);
    if (targetGame && routingGame && !gameNamesMatch(targetGame, routingGame)) return null;

    const evidence = routing.candidateEvidence || {};
    const evidenceAt = Number(evidence.gqlEvidenceAt || 0);
    const evidenceAge = evidenceAt ? now - evidenceAt : Number.POSITIVE_INFINITY;
    const evidenceTtl = Math.max(ROUTING_VERIFY_DEADLINE_MS, GQL_POLL_INTERVAL_MS * 2);
    if (!evidenceAt || evidenceAge < -5000 || evidenceAge > evidenceTtl) return null;
    const exactSessionMatch = Boolean(
      evidence.gqlSessionDropMatched === true ||
      evidence.gqlSessionCampaignMatched === true
    );
    if (evidence.gqlCampaignSupported !== true || !exactSessionMatch) return null;

    return {
      at: evidenceAt,
      method: "routing-session-restored",
      channel: login,
      game: targetGame || null,
      campaign: currentDrop.campaign || routing.targetCampaign || null,
      campaignKey: currentCampaignKey,
      proof: {
        gameMatched: true,
        campaignSupported: true,
        progressConfirmed: false,
        sessionRestored: true,
        sessionMatched: true,
      },
      currentMinutes: Number(currentDrop.currentMinutes || 0),
      requiredMinutes: Number(currentDrop.requiredMinutes || 0),
      currentPercent: Number(currentDrop.percent || 0),
    };
  }

  function restorePersistedRoutingVerification(now = Date.now()) {
    if (lastStreamVerification) return false;
    const restored = persistedRoutingEligibilityProof(now);
    if (!restored) return false;
    lastStreamVerification = restored;
    return true;
  }

  function activeRewardEligibility() {
    const campaign = findCampaignForDrop(lastInventoryCampaigns, currentDrop) || findCampaignForDrop(lastCampaignCatalog, currentDrop);
    const raw = (campaign?.timeBasedDrops || campaign?.drops || []).find(drop => drop.id === currentDrop?.id);
    const currentLogin = watchingLogin();
    const info = currentLogin ? readStreamInfo() : {};
    const proof = lastStreamVerification || persistedRoutingEligibilityProof();
    const verified = Boolean(
      proof &&
      cleanText(proof.channel).toLowerCase() === cleanText(currentLogin).toLowerCase() &&
      cleanText(proof.campaignKey).toLowerCase() === cleanText(currentDrop?.campaignKey || currentDrop?.campaignId).toLowerCase() &&
      (proof.proof?.campaignSupported || proof.proof?.progressConfirmed)
    );
    const routing = readRoutingControllerSession();
    const verificationPending = Boolean(
      routing.state === ROUTING_STATES.VERIFY_STREAM &&
      currentLogin &&
      cleanText(routing.targetStream).toLowerCase() === cleanText(currentLogin).toLowerCase() &&
      routing.candidateEvidence?.verificationRequired === true
    );
    return DropperActiveViewing.eligibility(campaign, raw, {
      now: Date.now(), channel: currentLogin, game: campaign && gameNamesMatch(campaignGameName(campaign), info.game) ? campaignGameName(campaign) : info.game,
      allowedChannels: campaign ? campaignAllowedChannels(campaign).map(item => item.login) : [], verified, verificationPending,
    });
  }


  function pollContext() {
    syncViewingContext();
    return { account: storageAccountLogin(), path: location.pathname, generation: viewingIntent.snapshot().generation };
  }
  function pollContextIsCurrent(context) {
    return context.account === storageAccountLogin() && context.path === location.pathname && context.generation === viewingIntent.snapshot().generation;
  }
  function eligibilityCompactPresentation(state) {
    const estimate = Number.isFinite(state?.estimateMinutes) ? Math.max(0, Math.round(state.estimateMinutes)) : null;
    switch (state?.code) {
      case 'eligible':
        return { text: `✓ Eligible${estimate !== null ? ` · ${estimate} min remaining` : ''}`, tone: 'good' };
      case 'deadline-risk':
        return { text: `⚠ Deadline Risk${estimate !== null ? ` · ${estimate} min needed` : ''}`, tone: 'bad' };
      case 'account-link':
        return { text: '⚠ Account Link Required', tone: 'warn' };
      case 'prerequisite-required':
      case 'prerequisite-unverified':
      case 'prerequisite-missing':
      case 'prerequisite-cycle':
        return { text: '⚠ Previous Reward Required', tone: 'warn' };
      case 'verification-pending':
        return { text: '• Verification Pending', tone: 'warn' };
      case 'wrong-game':
      case 'wrong-channel':
        return { text: '⚠ Stream Not Eligible', tone: 'warn' };
      case 'participation':
        return { text: '⚠ Campaign Not Eligible', tone: 'bad' };
      case 'not-started':
        return { text: '• Campaign Not Started', tone: 'muted' };
      case 'expired':
        return { text: '• Campaign Ended', tone: 'muted' };
      case 'paid-requirement':
        return { text: '• Paid Reward Excluded', tone: 'muted' };
      default:
        return { text: '? Eligibility Not Verified', tone: 'muted' };
    }
  }

  function refreshEligibilityControls() {
    const box = ui?.shadow?.getElementById('tdh-reward-eligibility');
    const summary = ui?.shadow?.getElementById('tdh-eligibility-summary');
    const detail = ui?.shadow?.getElementById('tdh-eligibility-detail');
    if (!box || !summary || !detail) return;
    const state = activeRewardEligibility();
    const compact = eligibilityCompactPresentation(state);
    summary.textContent = compact.text;
    box.dataset.tone = compact.tone;

    const accountWarning = ui.shadow.getElementById('tdh-account-link-warning');
    const accountDetail = ui.shadow.getElementById('tdh-account-link-detail');
    if (accountWarning) {
      const needsLink = state.code === 'account-link';
      accountWarning.hidden = !needsLink;
      if (needsLink && accountDetail) {
        const game = cleanText(currentDrop?.game);
        accountDetail.textContent = game
          ? `${game} requires a linked game account before Twitch can award this campaign's progress.`
          : 'This campaign requires a linked game account before Twitch can award progress.';
      }
    }

    const deadlineStatus = ui.shadow.getElementById('tdh-deadline-status');
    const deadline = state.deadline;
    if (deadlineStatus) {
      if (!Number.isFinite(deadline?.minutesUntilDeadline)) {
        deadlineStatus.hidden = true;
        deadlineStatus.textContent = '';
        deadlineStatus.dataset.tone = 'muted';
      } else {
        const minutes = Math.max(0, Math.round(deadline.minutesUntilDeadline));
        const timeLeft = minutes < 60 ? `${minutes}m` : minutes < 1440
          ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
          : `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
        const required = Number.isFinite(deadline.requiredMinutes) ? Math.max(0, Math.round(deadline.requiredMinutes)) : null;
        deadlineStatus.hidden = false;
        deadlineStatus.dataset.tone = deadline.finishable === false ? 'bad' : minutes <= 60 ? 'warn' : 'muted';
        deadlineStatus.textContent = deadline.finishable === false
          ? `⚠ Campaign ends in ${timeLeft} · ${required ?? '?'} min watch still required · Not finishable in time`
          : `Campaign ends in ${timeLeft}${required !== null ? ` · ${required} min watch remaining` : ''}${deadline.urgency === 'tight' ? ' · Close deadline' : ''}`;
      }
    }

    const estimate = Number.isFinite(state.estimateMinutes) ? ` Estimated reward time: ${state.estimateMinutes} min. Twitch-credited progress remains authoritative.` : '';
    const deadlineText = deadline?.finishable === false
      ? ` Deadline risk: ${deadline.requiredMinutes} min required with ${deadline.minutesUntilDeadline} min left.`
      : Number.isFinite(deadline?.marginMinutes) && deadline.marginMinutes <= 15
        ? ` Deadline margin: about ${Math.max(0, deadline.marginMinutes)} min.`
        : '';
    const campaignText = Number.isFinite(state.campaignPlan?.remainingMinutes)
      ? ` Campaign watch remaining: ${state.campaignPlan.remainingMinutes} min.`
      : '';
    detail.textContent = `${state.detail}${estimate}${deadlineText}${campaignText}`;
    refreshEligibilityChecklist();
  }

  // Viewing and Twitch network hooks are installed after all declarations so boot
  // never runs inside a temporal dead zone for later `let` bindings (SPA re-entry).
  function startDropper() {
    try { localStorage.removeItem(scopedLocalStorageKey("dropper-temp-campaign-skips-v1")); } catch (_) { /* legacy cleanup */ }
    const existingRoutingSession = readSession(ROUTING_SESSION_KEY, null);
    try { removeSession(NEXT_GAME_KEY); } catch (_) { /* 3.1 legacy handoff cleanup */ }
    restoreRecoverySnapshot();
    if (!existingRoutingSession || existingRoutingSession.version !== ROUTING_SESSION_VERSION) {
      try { removeSession(NAVIGATION_GUARD_KEY); } catch (_) { /* clear inherited pre-3.1 loop guard */ }
      try { removeSession(NAVIGATION_FLIGHT_KEY); } catch (_) { /* clear inherited pre-3.1 navigation flight */ }
    }
    installViewingIntent();
    if (settings.keepTabActive) installKeepTabActive(page);
    installTwitchNetworkHooks(page);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }

  function boot() {
    mountUi();
    restorePersistedRoutingVerification();
    watchProgressTitle();
    syncClaimWatchers();
    setStatus(featureStatus());
    logActivity("lifecycle", `Dropper ${APP_VERSION} started`);
    refreshDropCard();
    watchTwitchSubscriptionPromos();
    resumeUpdateReloadPending();
    checkVersionNotice();
    scheduleUpdateCheck();
    startTabPresenceSync();
    startHeartbeat();

    window.addEventListener("blur", () => {
      browserAttentionSnapshot();
      markUpdateInstallerLeft("blur");
    }, { passive: true });
    window.addEventListener("focus", () => {
      browserAttentionSnapshot();
      handleUpdateInstallerReturn("focus");
      queueGqlPollSoon("focus", 0);
      heartbeat();
    }, { passive: true });
    window.addEventListener("pageshow", () => {
      browserAttentionSnapshot();
      handleUpdateInstallerReturn("pageshow");
      queueGqlPollSoon("pageshow", 0);
      heartbeat();
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      browserAttentionSnapshot();
      if (document.hidden) {
        markUpdateInstallerLeft("hidden");
      } else {
        handleUpdateInstallerReturn("visible");
        queueGqlPollSoon("visible", 0);
        heartbeat();
      }
      void syncAutoPictureInPicture("visibilitychange");
    });
    document.addEventListener("leavepictureinpicture", () => {
      syncAutoPictureInPicture.owns = false;
    }, true);
    window.addEventListener("resize", () => {
      syncDropperWidthToChat();
      layoutChrome();
    }, { passive: true });
    document.addEventListener("exp-core:menu-open", () => {
      if (railOpen && document.documentElement.getAttribute("data-exp-open-menu") !== "dropper") setRailOpen(false, false);
    });
    window.addEventListener("storage", (event) => {
      if (event.key !== scopedLocalStorageKey(IGNORED_CAMPAIGN_GAMES_KEY)) return;
      ignoredCampaignGames = loadIgnoredCampaignGames();
      refreshOpenCampaignList();
      routingControllerTick(Date.now(), "campaign-ignore-storage-sync");
    });
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    routingControllerResetLegacyHandoff();
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

    const routing = readRoutingControllerSession();
    if (
      !currentDrop ||
      [
        ROUTING_STATES.SELECT_CAMPAIGN,
        ROUTING_STATES.FIND_STREAM,
        ROUTING_STATES.OPEN_STREAM,
        ROUTING_STATES.VERIFY_STREAM,
        ROUTING_STATES.WAITING,
      ].includes(routing.state)
    ) return GQL_RECOVERY_INTERVAL_MS;

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

  function dropProgressPercent(currentMinutes, requiredMinutes, fallback = 0) {
    const current = Number(currentMinutes);
    const required = Number(requiredMinutes);
    if (Number.isFinite(current) && Number.isFinite(required) && required > 0) {
      if (current >= required) return 100;
      return Math.max(0, Math.min(99, Math.round((current / required) * 100)));
    }

    const percent = Number(fallback);
    return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  }

  function dropProgressComplete(drop) {
    if (!drop) return false;
    if (drop.needsDropDetails) return false;
    if (drop.isClaimed) return true;

    const current = Number(drop.currentMinutes);
    const required = Number(drop.requiredMinutes);
    if (Number.isFinite(current) && Number.isFinite(required) && required > 0) {
      return current >= required;
    }

    return Number(drop.percent || 0) >= 100;
  }

  function progressStallTimeoutMs(healthy) {
    return healthy ? HEALTHY_STREAM_STALLED_MS : UNHEALTHY_STREAM_STALLED_MS;
  }

  function stalledProgressNeedsRecovery(now = Date.now()) {
    if (!settings.findNextStream || !currentDrop || dropProgressComplete(currentDrop)) return false;
    if (settings.queueEnabled && !settings.queueOnStall) return false;
    if (isAutoSwitchPaused()) return false;
    if (!viewingNavigationAllowed("stall-recovery")) return false;

    const routing = readRoutingControllerSession();
    if (
      routing.state === ROUTING_STATES.FIND_STREAM ||
      routing.state === ROUTING_STATES.OPEN_STREAM ||
      routing.state === ROUTING_STATES.VERIFY_STREAM ||
      routing.state === ROUTING_STATES.WAITING
    ) {
      return false;
    }

    const health = streamEarningHealthSnapshot();
    const recovery = health.recovery || { code: 'healthy', recoverable: false };
    if (recovery.recoverable && recovery.code !== 'credit-stalled') return true;
    if (health.inVerificationGrace) return false;
    if (recovery.code !== 'credit-stalled') return false;
    return health.progressAgeMs >= progressStallTimeoutMs(health.healthy);
  }

  function activeDropNeedsStream() {
    if (!settings.findNextStream || !currentDrop || currentDrop.isClaimed) return false;
    if (dropProgressComplete(currentDrop)) return false;
    if (campaignMarkedComplete(currentDrop.campaignKey || currentDrop.campaignId || "")) return false;
    const expiry = campaignExpirySnapshot(lastInventoryCampaigns, currentDrop);
    if (expiry?.ended) return false;

    const login = watchingLogin();
    if (login) {
      const info = readStreamInfo();
      if (info.live && info.game && gameNamesMatch(currentDrop.game || "", info.game)) {
        return stalledProgressNeedsRecovery();
      }
    }

    return true;
  }

  function matchingLiveDropStream(info = readStreamInfo()) {
    if (!currentDrop || currentDrop.isClaimed || dropProgressComplete(currentDrop)) return false;
    if (!watchingLogin()) return false;
    return Boolean(
      info?.live &&
      info.game &&
      currentDrop.game &&
      gameNamesMatch(currentDrop.game, info.game)
    );
  }

  function withinFirstWatchCreditGrace(now = Date.now()) {
    return currentStreamTimingSnapshot(now).inVerificationGrace;
  }

  function holdingVerifiedDropStream(now = Date.now()) {
    if (!matchingLiveDropStream()) return false;
    // Stay on a live matching Drop stream until progress is truly stalled.
    // Twitch often needs ~90s before the first watch minute credits.
    if (withinFirstWatchCreditGrace(now)) return true;
    return !stalledProgressNeedsRecovery();
  }

  function isTwitchHomepage() {
    return location.hostname.toLowerCase() === "www.twitch.tv" && (location.pathname === "/" || !location.pathname);
  }

  function isPlaceholderDropName(value) {
    return /^(?:active|current)\s+drop$/i.test(cleanText(value));
  }

  function isSyntheticWaitingDrop(drop = currentDrop) {
    if (!drop) return false;
    if (isPlaceholderDropName(drop.name) && !cleanText(drop.game)) return true;
    return Boolean(
      Number(drop.requiredMinutes || 0) <= 0 &&
      !drop.id &&
      !drop.campaignId &&
      !drop.campaignKey &&
      !drop.dropInstanceID
    );
  }

  function clearSyntheticWaitingDrop(reason = "cleared placeholder Drop") {
    if (!isSyntheticWaitingDrop(currentDrop)) return false;
    logActivity("drop-reset", reason, {
      name: currentDrop?.name || null,
      percent: currentDrop?.percent || 0,
    });
    clearStoredCurrentDrop();
    return true;
  }

  function clearStoredCurrentDrop() {
    currentDrop = null;
    removeSession("tdh-drop");
    clearRecoverySnapshot('active-drop-cleared');
  }

  function clearGqlFailurePause(reason = "page catalog recovered") {
    const open = Number(networkState.openUntil || 0) > Date.now();
    if (!open && !Number(networkState.consecutiveFailures || 0)) return false;
    if (open && !/gql|integrity|Twitch GQL|network protection/i.test(networkState.reason || "")) return false;
    const previousReason = networkState.reason || "";
    networkState.openUntil = 0;
    networkState.reason = "";
    networkState.consecutiveFailures = 0;
    persistNetworkState();
    logActivity("network", "Cleared GQL pause after page catalog recovery", {
      reason,
      previousReason: previousReason || null,
    });
    return true;
  }

  function maybeRecoverEmptyCatalog() {
    if (!getToken() || getHandoffState()) return false;
    if (lastCampaignCatalog.length || lastGqlSuccessAt) return false;
    if (!/integrity/i.test(lastGqlError || "") && !networkCircuitSnapshot().open) return false;
    // A live matching stream is already earning. Do not yank it to All Campaigns
    // just because GQL/catalog recovery failed — Twitch's first credit can take ~90s.
    if (holdingVerifiedDropStream() || matchingLiveDropStream()) {
      if (networkCircuitSnapshot().open) {
        setStatus(`Earning on ${watchingLogin() || "stream"} · Network Pause`);
      }
      return false;
    }
    if (isCampaigns()) {
      scheduleCampaignsPageCatalogEnrichment("campaigns-page-integrity-fallback");
      const pageCampaigns = scrapeCampaignsFromPage();
      if (!pageCampaigns.length) return false;
      rememberCampaignCatalog(pageCampaigns, "campaigns-page-integrity-fallback");
      clearGqlFailurePause("campaigns-page-scan");
      if (activeDropNeedsStream()) {
        setStatus(`Resuming ${currentDrop.game || "Active"} Drops · Searching From Twitch Home`);
        return ensureActiveCampaignStream();
      }
      if (!currentDrop || currentDrop.isClaimed || isSyntheticWaitingDrop(currentDrop)) {
        return startHomepageCampaignSearch();
      }
      return false;
    }
    if (isInventory() || isTwitchHomepage()) return false;
    clearSyntheticWaitingDrop("Cleared empty Active drop before All Campaigns recovery");
    setStatus("Opening All Campaigns · GQL Catalog Unavailable");
    autoNavigateTwitch(CAMPAIGNS_URL, "campaign-integrity-fallback");
    return true;
  }

  function readTabPresenceMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(scopedLocalStorageKey(TAB_PRESENCE_KEY)) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeTabPresenceMap(map) {
    try { localStorage.setItem(scopedLocalStorageKey(TAB_PRESENCE_KEY), JSON.stringify(map || {})); } catch (_) { /* ignore quota */ }
  }

  function pruneTabPresence(map = readTabPresenceMap(), now = Date.now()) {
    const next = {};
    for (const [id, entry] of Object.entries(map || {})) {
      if (!entry || typeof entry !== "object") continue;
      if (now - Number(entry.at || 0) > TAB_STALE_MS) continue;
      next[id] = entry;
    }
    return next;
  }

  function liveTabPeers(now = Date.now()) {
    const map = pruneTabPresence(readTabPresenceMap(), now);
    return Object.entries(map)
      .filter(([id]) => id !== TAB_ID)
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));
  }

  function publishTabPresence(extra = {}) {
    const now = Date.now();
    const map = pruneTabPresence(readTabPresenceMap(), now);
    map[TAB_ID] = {
      at: now,
      startedAt: TAB_STARTED_AT,
      path: location.pathname || "/",
      hidden: Boolean(document.hidden),
      hasHandoff: false,
      hasRouting: readRoutingControllerSession().state !== ROUTING_STATES.IDLE,
      routingState: readRoutingControllerSession().state,
      hasDrop: Boolean(currentDrop && !currentDrop.isClaimed && !isSyntheticWaitingDrop(currentDrop)),
      ...extra,
    };
    writeTabPresenceMap(map);
    lastPeerCount = Object.keys(map).length - 1;
    refreshMultiTabStatus();
    try {
      tabChannel?.postMessage({
        type: "presence",
        id: TAB_ID,
        entry: map[TAB_ID],
      });
    } catch (_) { /* ignore */ }
    return map;
  }

  function clearTabPresence() {
    const map = pruneTabPresence(readTabPresenceMap());
    delete map[TAB_ID];
    writeTabPresenceMap(map);
    refreshMultiTabStatus();
    try { tabChannel?.postMessage({ type: "bye", id: TAB_ID }); } catch (_) { /* ignore */ }
  }

  function isOldestLiveTab(now = Date.now()) {
    const peers = liveTabPeers(now);
    if (!peers.length) return true;
    const oldestPeer = Number(peers[0]?.startedAt || 0);
    return TAB_STARTED_AT <= oldestPeer;
  }

  function isAutoRoutingController() {
    // Deterministic single-tab ownership. The oldest live Dropper document is
    // the only tab allowed to make routing/navigation decisions.
    const peers = liveTabPeers();
    if (!peers.length) return true;
    return isOldestLiveTab();
  }

  function refreshMultiTabStatus() {
    const node = ui?.shadow?.getElementById('tdh-multi-tab-status');
    if (!node) return;
    const peers = liveTabPeers();
    if (!peers.length) {
      node.hidden = true;
      node.textContent = '';
      delete node.dataset.role;
      return;
    }
    const controller = isAutoRoutingController();
    node.hidden = false;
    node.dataset.role = controller ? 'controller' : 'passive';
    node.textContent = controller
      ? `Multi-tab safety · This tab controls switching · ${peers.length} other Dropper tab${peers.length === 1 ? '' : 's'} passive`
      : `Multi-tab safety · Passive tab · another Dropper tab controls automatic switching`;
  }

  function clearDeferredTabDropCard(reason) {
    // 3.1 keeps observational Drop data in secondary tabs. They may render
    // progress, but they never navigate or mutate the routing controller.
    return false;
  }

  function noteDeferredAutoRouting(reason) {
    publishTabPresence();
    const peers = liveTabPeers();
    if (!peers.length) return;
    const now = Date.now();
    const shouldLog = reason !== lastDeferredRoutingReason || now - lastDeferredRoutingAt > 60 * 1000;
    lastDeferredRoutingReason = reason;
    lastDeferredRoutingAt = now;
    if (shouldLog) {
      logActivity("multi-tab", "Deferred automatic routing because another Dropper tab is active", {
        reason,
        peers: peers.length,
        peerPaths: peers.slice(0, 5).map((peer) => peer.path || "/"),
      });
    }
    clearDeferredTabDropCard(reason || "deferred");
    setStatus(peers.length === 1
      ? "Another Dropper Tab Is Managing Drops"
      : `${peers.length} Other Dropper Tabs Are Active`);
  }

  function startTabPresenceSync() {
    publishTabPresence();
    if (tabPresenceTimer) clearInterval(tabPresenceTimer);
    tabPresenceTimer = setInterval(() => publishTabPresence(), TAB_PRESENCE_INTERVAL_MS);

    if (typeof BroadcastChannel === "function" && !tabChannel) {
      try {
        tabChannel = new BroadcastChannel(`${TAB_CHANNEL_NAME}:${storageAccountSuffix()}`);
        tabChannel.onmessage = (event) => {
          const data = event?.data;
          if (!data || data.id === TAB_ID) return;
          if (data.type === "bye") {
            const map = pruneTabPresence(readTabPresenceMap());
            delete map[data.id];
            writeTabPresenceMap(map);
            lastPeerCount = Math.max(0, Object.keys(map).length - (map[TAB_ID] ? 1 : 0));
            refreshMultiTabStatus();
            return;
          }
          if (data.type === "presence" && data.entry) {
            const map = pruneTabPresence(readTabPresenceMap());
            map[data.id] = data.entry;
            writeTabPresenceMap(map);
            lastPeerCount = Object.keys(map).length - (map[TAB_ID] ? 1 : 0);
            refreshMultiTabStatus();
          }
          if (data.type === "ping") {
            publishTabPresence();
          }
        };
        tabChannel.postMessage({ type: "ping", id: TAB_ID });
      } catch (_) {
        tabChannel = null;
      }
    }

    window.addEventListener("pagehide", clearTabPresence);
    window.addEventListener("beforeunload", clearTabPresence);
  }

  function startHomepageCampaignSearch() {
    const onDiscoverySurface = isTwitchHomepage() || isCampaigns() || isInventory();
    if (!settings.findNextStream || !onDiscoverySurface || getHandoffState() || !getToken()) return false;
    if (needsCampaignPageImport()) {
      return maybeImportOpenCampaignsFirst("homepage-before-import");
    }
    if (currentDrop && !currentDrop.isClaimed && !isSyntheticWaitingDrop(currentDrop)) return false;
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting(isCampaigns() ? "campaigns-page-search" : isInventory() ? "inventory-page-search" : "homepage-campaign-search");
      return false;
    }

    if (currentDrop) {
      logActivity("homepage-search", "Cleared inactive Drop card before campaign search", {
        name: currentDrop.name || null,
        game: currentDrop.game || null,
        claimed: Boolean(currentDrop.isClaimed),
      });
      clearStoredCurrentDrop();
    }

    const surface = isCampaigns() ? "campaigns" : isInventory() ? "inventory" : "homepage";
    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: "",
        completedDrop: "",
        completedDropId: "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: [],
        forceOpenCampaign: true,
        homepageDiscovery: surface === "homepage",
        campaignsPageDiscovery: surface === "campaigns",
        inventoryPageDiscovery: surface === "inventory",
        startedAt: Date.now(),
      },
      surface === "campaigns"
        ? "Twitch All Campaigns opened without an active Drop · selecting an open campaign"
        : surface === "inventory"
          ? "Twitch Inventory opened without an active Drop · selecting an open campaign"
          : "Twitch homepage opened without an active Drop · searching active campaigns",
    );
    setStatus("Finding Active Twitch Drops Campaign…");
    refreshDropCard();
    queueGqlPollSoon(surface === "campaigns" ? "campaigns-page-search" : surface === "inventory" ? "inventory-page-search" : "homepage-campaign-search", 0);
    return continueToNextGame(mergeCampaigns(lastCampaignCatalog, openCampaignsFromMemory()));
  }

  function maybeImportOpenCampaignsFirst(reason = "pre-earn-import") {
    if (!settings.findNextStream || !getToken()) return false;
    if (!needsCampaignPageImport()) return false;
    if (currentDropIsWinnableInProgress()) return false;
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("campaign-page-import");
      return false;
    }

    const pending = getHandoffState();
    const pendingState = normalizedHandoffState(pending);
    if (
      pending &&
      pendingState === HANDOFF_STATES.SELECTING_GAME &&
      pending.auditStage === "campaigns" &&
      pending.requireCampaignPageImport
    ) {
      return continueToNextGame(routingCampaignPool());
    }

    // Stop stream hunting / earning resume until Every open All Campaigns row is imported.
    if (pending && pendingState === HANDOFF_STATES.FINDING_STREAM) {
      logActivity("campaign-page-import", "Paused stream search until All Campaigns import finishes", {
        reason,
        targetGame: pending.targetGame || null,
        targetCampaign: pending.targetCampaign || null,
      });
    }

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: pending?.completedGame || currentDrop?.game || "",
        completedDrop: "",
        completedDropId: "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: pending?.skippedGames || [],
        excludedCampaignKeys: pending?.excludedCampaignKeys || [],
        forceOpenCampaign: true,
        requireCampaignPageImport: true,
        auditStage: "campaigns",
        campaignAuditStartedAt: Date.now(),
        campaignsImportStartedAt: 0,
        startedAt: Date.now(),
      },
      `Importing all open Drop campaigns before earning (${reason})`,
    );
    setStatus("Importing Open Drop Campaigns Before Earning…");
    if (!isCampaigns()) {
      autoNavigateTwitch(CAMPAIGNS_URL, "campaign-page-import");
      return true;
    }
    return continueToNextGame(routingCampaignPool());
  }

  function ensureActiveCampaignStream() {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("ensure-active-campaign-stream");
      return false;
    }
    if (needsCampaignPageImport()) {
      return maybeImportOpenCampaignsFirst("ensure-active-before-import");
    }
    if (!activeDropNeedsStream()) return false;

    const targetGame = currentDrop.game || "";
    if (!targetGame) return false;

    const login = watchingLogin();
    let stalledMatchingStream = false;
    if (login) {
      const info = readStreamInfo();
      const matchingStream = Boolean(info.live && info.game && gameNamesMatch(targetGame, info.game));
      stalledMatchingStream = matchingStream && stalledProgressNeedsRecovery();
      if (matchingStream && !stalledMatchingStream) return false;
      // Category-mismatch recovery only helps when Twitch exposes a different live game.
      // Offline / unread category channels must still fall through to stream search.
      if (!matchingStream && maybeRecoverCategoryMismatch()) return true;
    }

    let pending = getHandoffState();
    // normalizedHandoffState(null) defaults to CHECKING_GAME — only honor that when a
    // real handoff session exists, or idle tabs never start stream recovery.
    if (pending) {
      const pendingState = normalizedHandoffState(pending);
      if (
        pendingState === HANDOFF_STATES.SELECTING_GAME ||
        pendingState === HANDOFF_STATES.CHECKING_GAME
      ) return false;
      // Inventory can snap Working Toward back to an in-progress Drop while
      // routing is already hunting a sooner campaign. Do not steal that hunt.
      if (
        pending.targetGame &&
        !gameNamesMatch(pending.targetGame, targetGame) &&
        [
          HANDOFF_STATES.FINDING_STREAM,
          HANDOFF_STATES.SWITCHING,
          HANDOFF_STATES.VERIFYING,
        ].includes(pendingState)
      ) {
        return false;
      }
    }
    const alreadyLocked = Boolean(
      pending &&
      pending.lockActiveCampaign &&
      pending.targetGame &&
      gameNamesMatch(pending.targetGame, targetGame) &&
      [
        HANDOFF_STATES.FINDING_STREAM,
        HANDOFF_STATES.SWITCHING,
        HANDOFF_STATES.VERIFYING,
      ].includes(normalizedHandoffState(pending))
    );

    if (!alreadyLocked) {
      pending = transitionHandoff(
        HANDOFF_STATES.FINDING_STREAM,
        {
          completedGame: targetGame,
          completedDrop: currentDrop.name || "Drop",
          completedDropId: currentDrop.id || "",
          targetGame,
          targetSlug: currentDrop.gameSlug || "",
          targetStream: "",
          targetCampaign: currentDrop.campaign || "",
          targetCampaignKey: currentDrop.campaignKey || currentDrop.campaignId || "",
          failedStreams: [],
          lockActiveCampaign: true,
          discoveryMode: "homepage-search",
          homeSearchStage: "visit-home",
          recoveryReason: stalledMatchingStream ? "stalled-progress" : "resume-active-campaign",
          startedAt: Date.now(),
        },
        stalledMatchingStream
          ? `${currentDrop.name || targetGame} progress stalled · finding another eligible stream`
          : `Resuming unfinished ${currentDrop.campaign || targetGame} campaign`,
      );
    }

    if (alreadyLocked && pending.discoveryMode === "homepage-search") return true;
    if (alreadyLocked && pending.discoveryMode === "directory") {
      if (isDirectoryCategoryPage()) {
        continueDirectoryHandoffFromDom();
        return true;
      }
      const directoryUrl = gameDirectoryUrl({
        game: pending.targetGame || targetGame,
        gameSlug: pending.targetSlug || currentDrop?.gameSlug || "",
      });
      if (directoryUrl) {
        setStatus(`Searching ${pending.targetGame || targetGame} Category For Drops Streams`);
        autoNavigateTwitch(directoryUrl, "campaign-directory-fallback");
      }
      return true;
    }

    setStatus(`Resuming ${targetGame} Drops · Searching From Twitch Home`);
    if (isTwitchHomepage() || isTwitchSearchPage()) return continueHomepageCampaignHandoffFromDom();
    autoNavigateTwitch(TWITCH_HOME_URL, "campaign-home-search");
    return true;
  }

  function routingSessionDefaults(state = ROUTING_STATES.IDLE) {
    const now = Date.now();
    return {
      version: ROUTING_SESSION_VERSION,
      state,
      enteredAt: now,
      updatedAt: now,
      deadlineAt: 0,
      targetGame: "",
      targetSlug: "",
      targetCampaign: "",
      targetCampaignKey: "",
      targetDropId: "",
      targetStream: "",
      failedStreams: [],
      excludedCampaignKeys: [],
      navigationTarget: "",
      navigationReason: "",
      candidateEvidence: null,
      verifyBaselineMinutes: null,
      verifyBaselinePercent: null,
      earningStartedAt: 0,
      mismatchSince: 0,
      offlineSince: 0,
      waitReason: "",
      lastReason: "",
    };
  }

  function readRoutingControllerSession() {
    const raw = readSession(ROUTING_SESSION_KEY, null);
    if (!raw || raw.version !== ROUTING_SESSION_VERSION || !Object.values(ROUTING_STATES).includes(raw.state)) {
      return routingSessionDefaults();
    }
    if (raw.updatedAt && Date.now() - Number(raw.updatedAt) > 6 * 60 * 60 * 1000) {
      removeSession(ROUTING_SESSION_KEY);
      return routingSessionDefaults();
    }
    return { ...routingSessionDefaults(raw.state), ...raw, version: ROUTING_SESSION_VERSION };
  }

  function writeRoutingControllerSession(session) {
    const next = {
      ...routingSessionDefaults(session?.state || ROUTING_STATES.IDLE),
      ...(session || {}),
      version: ROUTING_SESSION_VERSION,
      updatedAt: Date.now(),
    };
    writeSession(ROUTING_SESSION_KEY, next);
    return next;
  }

  function transitionRoutingController(state, patch = {}, reason = "") {
    const previous = readRoutingControllerSession();
    const now = Date.now();
    const changed = previous.state !== state;
    const next = {
      ...previous,
      ...patch,
      version: ROUTING_SESSION_VERSION,
      state,
      enteredAt: changed ? now : Number(previous.enteredAt || now),
      updatedAt: now,
      deadlineAt: Object.prototype.hasOwnProperty.call(patch, "deadlineAt")
        ? Number(patch.deadlineAt || 0)
        : (changed ? 0 : Number(previous.deadlineAt || 0)),
      lastReason: reason || previous.lastReason || "",
    };
    writeSession(ROUTING_SESSION_KEY, next);
    const routingIdentityChanged = Boolean(
      changed ||
      cleanText(previous.targetStream).toLowerCase() !== cleanText(next.targetStream).toLowerCase() ||
      cleanText(previous.targetCampaignKey).toLowerCase() !== cleanText(next.targetCampaignKey).toLowerCase() ||
      cleanText(previous.targetDropId).toLowerCase() !== cleanText(next.targetDropId).toLowerCase()
    );
    if (routingIdentityChanged) clearSkipStreamerArm("routing-changed");
    if (changed || reason) {
      logActivity("routing-controller", reason || `${previous.state} → ${state}`, {
        from: previous.state,
        to: state,
        targetGame: next.targetGame || null,
        targetCampaign: next.targetCampaign || null,
        targetStream: next.targetStream || null,
        deadlineAt: next.deadlineAt ? new Date(next.deadlineAt).toISOString() : null,
      });
    }
    saveRecoverySnapshot('routing-transition');
    return next;
  }

  function routingControllerTargetFromDrop(drop = currentDrop) {
    if (!drop) return {};
    return {
      targetGame: cleanText(drop.game),
      targetSlug: resolveCategorySlug(drop),
      targetCampaign: cleanText(drop.campaign || drop.game),
      targetCampaignKey: cleanText(drop.campaignKey || drop.campaignId),
      targetDropId: cleanText(drop.id),
    };
  }


  function reconcileRoutingTargetWithCurrentDrop(reason = "routing-target-reconcile") {
    if (!currentDrop) return false;
    const routing = readRoutingControllerSession();
    if (
      routing.state !== ROUTING_STATES.EARNING &&
      routing.state !== ROUTING_STATES.VERIFY_STREAM
    ) return false;

    const currentCampaignKey = cleanText(currentDrop.campaignKey || currentDrop.campaignId);
    const routingCampaignKey = cleanText(routing.targetCampaignKey);
    if (
      !currentCampaignKey ||
      !routingCampaignKey ||
      currentCampaignKey !== routingCampaignKey
    ) return false;

    const currentDropId = cleanText(currentDrop.id);
    const routingDropId = cleanText(routing.targetDropId);
    if (!currentDropId || currentDropId === routingDropId) return false;

    writeRoutingControllerSession({
      ...routing,
      ...routingControllerTargetFromDrop(currentDrop),
      targetStream: routing.targetStream || watchingLogin() || "",
      verifyBaselineMinutes: Number(currentDrop.currentMinutes || 0),
      verifyBaselinePercent: Number(currentDrop.percent || 0),
    });
    logActivity("routing-target-repaired", "Repaired stale routing Drop identity", {
      reason,
      campaign: currentDrop.campaign || null,
      previousDropId: routingDropId || null,
      currentDropId,
      stream: routing.targetStream || watchingLogin() || null,
    });
    return true;
  }

  function restoreVerifiedEarningFromSession(channelLogin, sessionDrop, gameName = "") {
    const routing = readRoutingControllerSession();
    if (routing.state !== ROUTING_STATES.EARNING || !currentDrop || !sessionDrop) return false;

    const login = cleanText(channelLogin).toLowerCase();
    const target = cleanText(routing.targetStream).toLowerCase();
    if (!login || !target || login !== target) return false;

    const currentCampaignKey = cleanText(currentDrop.campaignKey || currentDrop.campaignId).toLowerCase();
    const sessionCampaignKey = cleanText(sessionDrop.campaignKey || sessionDrop.campaignId).toLowerCase();
    const currentDropId = cleanText(currentDrop.id);
    const sessionDropId = cleanText(sessionDrop.id);
    const campaignMatches = Boolean(
      currentCampaignKey &&
      sessionCampaignKey &&
      currentCampaignKey === sessionCampaignKey
    );
    const dropMatches = Boolean(
      currentDropId &&
      sessionDropId &&
      currentDropId === sessionDropId
    );
    const targetGame = cleanText(currentDrop.game || routing.targetGame);
    const sessionGame = cleanText(sessionDrop.game || gameName);
    const gameMatches = Boolean(
      !targetGame ||
      !sessionGame ||
      gameNamesMatch(targetGame, sessionGame)
    );
    if (!campaignMatches || !dropMatches || !gameMatches) return false;

    const now = Date.now();
    const candidateEvidence = {
      ...(routing.candidateEvidence || {}),
      gqlCampaignSupported: true,
      gqlSessionMatched: true,
      gqlSessionCampaignMatched: true,
      gqlSessionDropMatched: true,
      gqlEvidenceAt: now,
    };
    writeRoutingControllerSession({
      ...routing,
      ...routingControllerTargetFromDrop(currentDrop),
      candidateEvidence,
      targetStream: login,
      verifyBaselineMinutes: Number(currentDrop.currentMinutes || 0),
      verifyBaselinePercent: Number(currentDrop.percent || 0),
    });

    const priorVerificationMatches = Boolean(
      lastStreamVerification &&
      cleanText(lastStreamVerification.channel).toLowerCase() === login &&
      cleanText(lastStreamVerification.campaignKey || "").toLowerCase() === currentCampaignKey &&
      (!lastStreamVerification.game || !targetGame || gameNamesMatch(lastStreamVerification.game, targetGame))
    );

    if (!priorVerificationMatches) {
      lastStreamVerification = {
        at: Number(routing.earningStartedAt || routing.enteredAt || now),
        method: "current-session-restored",
        channel: login,
        game: targetGame || null,
        campaign: currentDrop.campaign || null,
        campaignKey: currentCampaignKey || null,
        proof: {
          gameMatched: true,
          campaignSupported: true,
          progressConfirmed: false,
          sessionRestored: true,
          sessionMatched: true,
        },
        currentMinutes: Number(currentDrop.currentMinutes || 0),
        requiredMinutes: Number(currentDrop.requiredMinutes || 0),
        currentPercent: Number(currentDrop.percent || 0),
      };
    }
    return true;
  }

  function routingControllerFailedSet(session = readRoutingControllerSession()) {
    return new Set(
      (session.failedStreams || [])
        .map((login) => cleanText(login).toLowerCase())
        .filter(Boolean),
    );
  }

  function routingControllerAddFailedStream(session, login) {
    const failedStreams = [...new Set([
      ...(session?.failedStreams || []),
      cleanText(login).toLowerCase(),
    ].filter(Boolean))];
    return failedStreams;
  }

  function clearSkippedStreamers(reason = "manual-clear", resumeRouting = false) {
    const session = readRoutingControllerSession();
    const routingSkipped = [...new Set(
      (session.failedStreams || []).map((login) => cleanText(login).toLowerCase()).filter(Boolean),
    )];
    const pending = getHandoffState();
    const legacySkipped = [...new Set(
      (pending?.failedStreams || []).map((login) => cleanText(login).toLowerCase()).filter(Boolean),
    )];
    const cleared = [...new Set([...routingSkipped, ...legacySkipped])];

    if (pending && legacySkipped.length) {
      writeSession(NEXT_GAME_KEY, { ...pending, failedStreams: [] });
    }

    const waitingOnStreams = Boolean(
      session.state === ROUTING_STATES.WAITING &&
      [
        "no-category-stream",
        "no-live-allowed-channel",
        "no-drops-qualified-stream",
        "stream-cycle-reset",
      ].includes(session.waitReason)
    );

    if (resumeRouting && waitingOnStreams) {
      transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        { failedStreams: [], waitReason: "", deadlineAt: 0 },
        "Skipped streamer rotation cleared manually",
      );
    } else if (routingSkipped.length) {
      writeRoutingControllerSession({ ...session, failedStreams: [] });
    }

    logActivity("stream-skip-clear", "Cleared temporary skipped streamer rotation", {
      reason,
      cleared,
      count: cleared.length,
      resumedRouting: Boolean(resumeRouting && waitingOnStreams),
    });

    if (resumeRouting && waitingOnStreams) {
      routingControllerTick(Date.now(), reason);
    }
    return cleared.length;
  }

  function routingControllerResetLegacyHandoff() {
    if (readSession(NEXT_GAME_KEY, null)) removeSession(NEXT_GAME_KEY);
  }

  function routingControllerNavigationInFlight(now = Date.now()) {
    return navigationFlightSnapshot(now);
  }

  function routingControllerNavigate(url, reason = "routing-controller") {
    if (!url || !isTrustedTwitchUrl(url)) return false;
    if (routingControllerNavigationInFlight()) return false;
    return autoNavigateTwitch(url, reason);
  }

  function routingControllerBootstrap(reason = "bootstrap") {
    routingControllerResetLegacyHandoff();
    if (!settings.findNextStream) {
      return transitionRoutingController(ROUTING_STATES.PAUSED, { deadlineAt: 0 }, "Automatic stream routing disabled");
    }
    if (
      !currentDrop ||
      currentDrop.isClaimed ||
      campaignMarkedComplete(currentDrop.campaignKey || currentDrop.campaignId || "") ||
      !campaignIsRoutingOpen(currentDrop)
    ) {
      return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, { deadlineAt: 0 }, reason);
    }
    if (dropProgressComplete(currentDrop)) {
      return advanceAfterWatchComplete(currentDrop, reason);
    }

    const login = watchingLogin();
    const info = login ? readStreamInfo() : null;
    if (login && info?.live && info.game && gameNamesMatch(currentDrop.game || "", info.game)) {
      return transitionRoutingController(
        ROUTING_STATES.VERIFY_STREAM,
        {
          ...routingControllerTargetFromDrop(currentDrop),
          targetStream: login,
          candidateEvidence: {
            source: "current-channel",
            dropsTagged: Boolean(info.dropsEnabled),
            game: info.game,
            seenAt: Date.now(),
          },
          verifyBaselineMinutes: Number(currentDrop.currentMinutes || 0),
          verifyBaselinePercent: Number(currentDrop.percent || 0),
          deadlineAt: Date.now() + ROUTING_VERIFY_DEADLINE_MS,
          mismatchSince: 0,
          offlineSince: 0,
        },
        reason + " · verifying current same-game channel",
      );
    }

    return transitionRoutingController(
      ROUTING_STATES.FIND_STREAM,
      {
        ...routingControllerTargetFromDrop(currentDrop),
        targetStream: "",
        failedStreams: [],
        candidateEvidence: null,
        deadlineAt: 0,
      },
      reason,
    );
  }

  function routingControllerSelectCampaign(now = Date.now()) {
    let session = readRoutingControllerSession();

    if (currentDrop && !currentDrop.isClaimed && dropProgressComplete(currentDrop)) {
      return advanceAfterWatchComplete(currentDrop, "Completed Drop already has full watch credit");
    }

    if (
      currentDrop &&
      !currentDrop.isClaimed &&
      !dropProgressComplete(currentDrop) &&
      !campaignMarkedComplete(currentDrop.campaignKey || currentDrop.campaignId || "") &&
      !campaignIsExcluded(currentDrop) &&
      campaignIsRoutingOpen(currentDrop, now) &&
      dropFitsCampaignWindow(currentDrop, now)
    ) {
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        { ...routingControllerTargetFromDrop(currentDrop), targetStream: "", failedStreams: [], deadlineAt: 0 },
        "Continuing active unfinished campaign",
      );
    }

    if (
      currentDrop?.isClaimed ||
      campaignMarkedComplete(currentDrop?.campaignKey || currentDrop?.campaignId || "") ||
      (currentDrop && !campaignIsRoutingOpen(currentDrop, now))
    ) {
      clearStoredCurrentDrop();
    }

    const { next, excluded } = pickViableCampaign(session);

    if (!next) {
      queueGqlPollSoon("routing-no-campaign", 0);
      return transitionRoutingController(
        ROUTING_STATES.WAITING,
        {
          targetGame: "",
          targetCampaign: "",
          targetCampaignKey: "",
          targetDropId: "",
          targetStream: "",
          excludedCampaignKeys: [...excluded],
          waitReason: "no-eligible-campaign",
          deadlineAt: now + ROUTING_NO_CAMPAIGN_RETRY_MS,
        },
        "No eligible watch-time campaign available",
      );
    }

    if (next.needsDropDetails || !Number.isFinite(Number(next.requiredMinutes)) || Number(next.requiredMinutes) <= 0) {
      queueGqlPollSoon("routing-campaign-details", 0);
      return transitionRoutingController(
        ROUTING_STATES.WAITING,
        {
          ...routingControllerTargetFromDrop(next),
          excludedCampaignKeys: [...excluded],
          waitReason: "campaign-details",
          deadlineAt: now + ROUTING_WAIT_RETRY_MS,
        },
        `Waiting for authoritative Drop details for ${next.campaign || next.game}`,
      );
    }

    adoptSelectedTargetDrop(next, "routing-controller-select");
    return transitionRoutingController(
      ROUTING_STATES.FIND_STREAM,
      {
        ...routingControllerTargetFromDrop(next),
        failedStreams: [],
        excludedCampaignKeys: [...excluded],
        targetStream: "",
        candidateEvidence: null,
        waitReason: "",
        deadlineAt: 0,
      },
      `Selected ${next.campaign || next.game}`,
    );
  }

  function routingControllerFindStream(now = Date.now()) {
    let session = readRoutingControllerSession();
    if (!currentDrop || currentDrop.isClaimed || dropProgressComplete(currentDrop)) {
      return routingControllerBootstrap("Active Drop changed while finding a stream");
    }

    const targetGame = cleanText(session.targetGame || currentDrop.game);
    const targetSlug = resolveCategorySlug({
      game: targetGame,
      gameSlug: session.targetSlug || currentDrop.gameSlug || "",
    });
    if (!targetGame || !targetSlug) {
      queueGqlPollSoon("routing-category-missing", 0);
      return transitionRoutingController(
        ROUTING_STATES.WAITING,
        { waitReason: "category-unresolved", deadlineAt: now + ROUTING_WAIT_RETRY_MS },
        "Waiting for a verified Twitch category route",
      );
    }

    if (!isDirectoryCategoryPage() || currentDirectorySlug() !== targetSlug) {
      const url = `https://www.twitch.tv/directory/category/${encodeURIComponent(targetSlug)}`;
      transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        { targetSlug, navigationTarget: url, navigationReason: "find-stream-category", deadlineAt: now + ROUTING_NAVIGATION_DEADLINE_MS },
        `Opening ${targetGame} category`,
      );
      routingControllerNavigate(url, "routing-find-category");
      return true;
    }

    const snapshot = classifyRoutingCandidates(targetGame, targetSlug, session, now);
    const {
      skipped,
      allowedChannels,
      allowedLogins,
      routableCandidates,
      candidates,
    } = snapshot;
    let candidate = candidates[0] || null;
    const aclMatched = Boolean(candidate?.allowListMatch);
    if (candidate && aclMatched) {
      candidate = { ...candidate, aclMatched: true, visibleInCategory: true, source: 'campaign-acl' };
    }

    if (!candidate) {
      const waitingForAcl = allowedChannels.length > 0;
      const exhaustedTemporaryRotation = Boolean(
        skipped.size &&
        routableCandidates.length &&
        candidates.length === 0
      );

      if (exhaustedTemporaryRotation) {
        const tried = [...skipped];
        logActivity("stream-rotation-reset", "All visible eligible streamers were tried; clearing temporary rotation", {
          game: targetGame || null,
          campaign: session.targetCampaign || null,
          tried,
          visibleEligible: routableCandidates.map((item) => item.login),
          retrySeconds: Math.round(ROUTING_WAIT_RETRY_MS / 1000),
        });
        setStatus(`All Visible ${targetGame} Streams Checked · Retrying Shortly`);
        return transitionRoutingController(
          ROUTING_STATES.WAITING,
          {
            targetSlug,
            targetStream: "",
            failedStreams: [],
            candidateEvidence: null,
            waitReason: "stream-cycle-reset",
            deadlineAt: now + ROUTING_WAIT_RETRY_MS,
          },
          `Cleared temporary streamer rotation after trying ${tried.length} stream${tried.length === 1 ? "" : "s"}`,
        );
      }

      setStatus(
        waitingForAcl
          ? `Waiting For A Live ${session.targetCampaign || targetGame} Stream`
          : `Waiting On ${targetGame} Category For An Eligible Stream`,
      );
      return transitionRoutingController(
        ROUTING_STATES.WAITING,
        {
          targetSlug,
          targetStream: "",
          candidateEvidence: null,
          waitReason: waitingForAcl ? "no-live-allowed-channel" : "no-category-stream",
          deadlineAt: now + ROUTING_WAIT_RETRY_MS,
        },
        waitingForAcl
          ? `No live allow-listed ${session.targetCampaign || targetGame} stream visible yet`
          : `No usable ${targetGame} stream visible yet`,
      );
    }

    const visibleDropsProof = candidate.dropsTagged === true;
    const campaignAclProof = Boolean(candidate.aclMatched || aclMatched);
    const next = transitionRoutingController(
      ROUTING_STATES.OPEN_STREAM,
      {
        targetSlug,
        targetStream: candidate.login,
        candidateEvidence: {
          source: candidate.source || "category",
          dropsTagged: visibleDropsProof,
          campaignAclMatched: campaignAclProof,
          visibleInCategory: Boolean(candidate.visibleInCategory),
          categoryScoped: true,
          probationary: !campaignAclProof,
          verificationRequired: !campaignAclProof,
          campaignProbe: false,
          campaignAllowListPresent: Boolean(allowedChannels.length),
          campaignAllowListMatch: campaignAclProof,
          game: candidate.game || targetGame,
          evidenceRank: candidate.evidenceRank ?? streamCandidateEvidence(candidate).rank,
          evidenceLabel: candidate.evidenceLabel || streamCandidateEvidence(candidate).label,
          seenAt: now,
        },
        navigationTarget: candidate.href,
        navigationReason: campaignAclProof ? "campaign-acl-stream" : visibleDropsProof ? "drops-tagged-verification-stream" : "probationary-stream",
        verifyBaselineMinutes: Number(currentDrop.currentMinutes || 0),
        verifyBaselinePercent: Number(currentDrop.percent || 0),
        deadlineAt: now + ROUTING_NAVIGATION_DEADLINE_MS,
      },
      campaignAclProof
        ? `Opening campaign-allowed stream ${candidate.login}`
        : visibleDropsProof
          ? `Opening Drops-tagged stream ${candidate.login} for campaign verification`
          : `Opening category stream ${candidate.login} for Drop verification`,
    );
    lastStreamSwitch = now;
    setStatus(
      campaignAclProof
        ? `Opening ${candidate.login} For ${session.targetCampaign || targetGame}`
        : visibleDropsProof
          ? `Opening ${candidate.login} · Verifying ${targetGame} Campaign`
          : `Opening ${candidate.login} · Verifying Drops Eligibility`,
    );
    routingControllerNavigate(
      candidate.href,
      campaignAclProof ? "routing-open-campaign-acl-stream" : visibleDropsProof ? "routing-open-drops-verification-stream" : "routing-open-probationary-stream",
    );
    return next;
  }

  function routingControllerOpenStream(now = Date.now()) {
    const session = readRoutingControllerSession();
    const login = cleanText(watchingLogin()).toLowerCase();
    const target = cleanText(session.targetStream).toLowerCase();

    if (login && target && login === target) {
      finalVerificationPollTarget = "";
      finalVerificationPollAt = 0;
      requestGqlPoll("routing-stream-arrival", true);
      return transitionRoutingController(
        ROUTING_STATES.VERIFY_STREAM,
        {
          deadlineAt: now + ROUTING_VERIFY_DEADLINE_MS,
          mismatchSince: 0,
          offlineSince: 0,
          navigationTarget: "",
          navigationReason: "",
        },
        `Arrived at ${login} · verifying stream`,
      );
    }

    if (session.deadlineAt && now >= session.deadlineAt) {
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, target),
          targetStream: "",
          candidateEvidence: null,
          deadlineAt: 0,
        },
        `Could not reach ${target || "target stream"} · returning to category`,
      );
    }

    setStatus(`Opening ${session.targetStream || "Drops Stream"}…`);
    return false;
  }

  function activeCampaignAllowListEvidence(channelLogin = watchingLogin()) {
    if (!currentDrop || !campaignIsRoutingOpen(currentDrop)) return null;
    const campaign = findCampaignForDrop(routingCampaignPool(), currentDrop);
    if (!campaign || !campaignIsRoutingOpen(campaign) || !campaign.allow || typeof campaign.allow !== "object") return null;

    const allowedChannels = campaignAllowedChannels(campaign);
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const login = cleanText(channelLogin).toLowerCase();
    const present = campaign.allow.isEnabled !== false && allowedChannels.length > 0;
    return {
      campaignAllowListPresent: present,
      campaignAllowListMatch: Boolean(present && login && allowedLogins.has(login)),
      campaignAllowListSource: "active-campaign",
    };
  }

  function syncRoutingCampaignAllowListEvidence(session = readRoutingControllerSession(), channelLogin = watchingLogin(), now = Date.now()) {
    if (!session?.candidateEvidence) return session;
    const current = session.candidateEvidence;
    const snapshot = activeCampaignAllowListEvidence(channelLogin);
    if (!snapshot) return session;
    if (
      current.campaignAllowListPresent === snapshot.campaignAllowListPresent &&
      current.campaignAllowListMatch === snapshot.campaignAllowListMatch &&
      current.campaignAllowListSource === snapshot.campaignAllowListSource
    ) return session;

    return writeRoutingControllerSession({
      ...session,
      candidateEvidence: {
        ...current,
        ...snapshot,
        campaignAllowListUpdatedAt: now,
      },
    });
  }

  function updateRoutingCampaignSupportEvidence(channelLogin, availableCampaigns, sessionDrop = null) {
    let session = readRoutingControllerSession();
    if (session.state !== ROUTING_STATES.VERIFY_STREAM) return false;

    const login = cleanText(channelLogin).toLowerCase();
    const target = cleanText(session.targetStream).toLowerCase();
    if (!login || !target || login !== target) return false;
    if (!currentDrop || !campaignIsRoutingOpen(currentDrop)) return false;
    session = syncRoutingCampaignAllowListEvidence(session, login);

    const campaignSupport = channelSupportsTargetCampaign(availableCampaigns, session);
    const sessionGameMatches = Boolean(
      sessionDrop &&
      (!session.targetGame || gameNamesMatch(session.targetGame, sessionDrop.game || ""))
    );
    const targetCampaignKey = cleanText(session.targetCampaignKey).toLowerCase();
    const sessionCampaignKey = cleanText(sessionDrop?.campaignKey || sessionDrop?.campaignId).toLowerCase();
    const targetDropId = cleanText(session.targetDropId);
    const sessionDropId = cleanText(sessionDrop?.id);
    const sessionCampaignMatches = Boolean(
      sessionGameMatches &&
      targetCampaignKey &&
      sessionCampaignKey &&
      sessionCampaignKey === targetCampaignKey
    );
    const sessionDropMatches = Boolean(
      sessionGameMatches &&
      targetDropId &&
      sessionDropId &&
      sessionDropId === targetDropId
    );
    const sessionMatches = sessionCampaignMatches || sessionDropMatches;
    const sessionIdentityLevel = sessionDropMatches
      ? "exact-drop"
      : sessionCampaignMatches
        ? (targetDropId && sessionDropId ? "campaign-only-different-drop" : "campaign-fallback")
        : "none";

    if (campaignSupport !== true && !sessionMatches) return false;

    const evidence = {
      ...(session.candidateEvidence || {}),
      gqlCampaignSupported: true,
      gqlSessionMatched: sessionMatches,
      gqlSessionCampaignMatched: sessionCampaignMatches,
      gqlSessionDropMatched: sessionDropMatches,
      gqlSessionIdentityLevel: sessionIdentityLevel,
      gqlEvidenceAt: Date.now(),
    };
    writeRoutingControllerSession({ ...session, candidateEvidence: evidence });
    logActivity("stream-verification-evidence", "Twitch GQL confirmed target campaign support", {
      channel: login,
      campaign: session.targetCampaign || null,
      campaignKey: session.targetCampaignKey || null,
      targetDropId: targetDropId || null,
      sessionDropId: sessionDropId || null,
      viaAvailableCampaigns: campaignSupport === true,
      viaCurrentSessionCampaign: sessionCampaignMatches,
      viaCurrentSessionDrop: sessionDropMatches,
      sessionIdentityLevel,
    });
    return true;
  }

  function requestFinalVerificationPoll(targetLogin, now = Date.now()) {
    const target = cleanText(targetLogin).toLowerCase();
    if (!target) return false;
    if (finalVerificationPollTarget === target && finalVerificationPollAt) return false;

    finalVerificationPollTarget = target;
    finalVerificationPollAt = now;
    requestGqlPoll("routing-final-verification", true).then((started) => {
      if (!started && finalVerificationPollTarget === target) {
        finalVerificationPollAt = 0;
      }
    }).catch(() => {
      if (finalVerificationPollTarget === target) {
        finalVerificationPollAt = 0;
      }
    });
    return true;
  }

  function routingControllerVerifyStream(now = Date.now()) {
    let session = readRoutingControllerSession();
    const login = cleanText(watchingLogin()).toLowerCase();
    const target = cleanText(session.targetStream).toLowerCase();
    const info = readStreamInfo();
    const streamGame = cleanText(info.game);
    const targetGame = cleanText(session.targetGame || currentDrop?.game);
    session = syncRoutingCampaignAllowListEvidence(session, login || target, now);
    const gameMatches = Boolean(streamGame && targetGame && gameNamesMatch(targetGame, streamGame));
    const minutesAdvanced = Number(currentDrop?.currentMinutes || 0) > Number(session.verifyBaselineMinutes || 0);
    const percentAdvanced = Number(currentDrop?.percent || 0) > Number(session.verifyBaselinePercent || 0);
    const progressProof = minutesAdvanced || percentAdvanced;
    const verificationLogin = login || target;

    if (login && target && login !== target) {
      if (session.deadlineAt && now >= session.deadlineAt) {
        return transitionRoutingController(
          ROUTING_STATES.FIND_STREAM,
          { failedStreams: routingControllerAddFailedStream(session, target), targetStream: "", deadlineAt: 0 },
          "Verification route changed before target stream stabilized",
        );
      }
      return false;
    }

    if (now - PAGE_STARTED_AT < STREAM_ROUTE_SETTLE_MS) {
      setStatus(`Loading ${target || login || targetGame} Before Verification…`);
      return false;
    }

    if (streamGame && !gameMatches) {
      const mismatchSince = Number(session.mismatchSince || 0) || now;
      if (!session.mismatchSince) session = writeRoutingControllerSession({ ...session, mismatchSince });
      if (now - mismatchSince >= CATEGORY_MISMATCH_GRACE_MS) {
        setManualStreamLock(false, 'category-changed');
        return transitionRoutingController(
          ROUTING_STATES.FIND_STREAM,
          {
            failedStreams: routingControllerAddFailedStream(session, target || login),
            targetStream: "",
            candidateEvidence: null,
            mismatchSince: 0,
            deadlineAt: 0,
          },
          `Rejected ${target || login || "stream"} · category is ${streamGame}`,
        );
      }
      setStatus(`Verifying ${targetGame} · Twitch Still Shows ${streamGame}`);
      return false;
    }

    const liveDropsVisible = Boolean(info.dropsEnabled);
    const directoryDropsVisible = Boolean(session.candidateEvidence?.dropsTagged);
    const aclCampaignProof = Boolean(session.candidateEvidence?.campaignAclMatched);
    const gqlCampaignProof = Boolean(session.candidateEvidence?.gqlCampaignSupported);
    const campaignProof = aclCampaignProof || gqlCampaignProof;
    if (
      info.live &&
      gameMatches &&
      (
        campaignProof ||
        progressProof
      )
    ) {
      lastStreamVerification = {
        at: now,
        method: progressProof
          ? "credited-progress"
          : "gql-campaign+game",
        channel: login || target || null,
        dropId: currentDrop?.id || null,
        game: targetGame || null,
        campaign: session.targetCampaign || currentDrop?.campaign || null,
        campaignKey: session.targetCampaignKey || currentDrop?.campaignKey || currentDrop?.campaignId || null,
        proof: {
          gameMatched: true,
          campaignSupported: campaignProof,
          campaignAclMatched: aclCampaignProof,
          gqlCampaignSupported: gqlCampaignProof,
          progressConfirmed: progressProof,
          directoryDropsVisible,
          liveDropsVisible,
        },
      };
      return transitionRoutingController(
        ROUTING_STATES.EARNING,
        {
          earningStartedAt: now,
          candidateEvidence: {
            ...(session.candidateEvidence || {}),
            campaignVerified: true,
            verifiedChannel: verificationLogin,
            creditedProgressVerified: progressProof,
            verifiedAt: now,
          },
          deadlineAt: 0,
          mismatchSince: 0,
          offlineSince: 0,
          verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
          verifyBaselinePercent: Number(currentDrop?.percent || 0),
          recoveryStage: 0,
          recoveryStartedAt: 0,
          recoveryLastCheckAt: 0,
        },
        `Verified ${login || target} for ${session.targetCampaign || targetGame}`,
      );
    }

    const verificationRemainingMs = session.deadlineAt
      ? Math.max(0, Number(session.deadlineAt) - now)
      : 0;
    if (
      session.deadlineAt &&
      verificationRemainingMs > 0 &&
      verificationRemainingMs <= GQL_MIN_GAP_MS &&
      requestFinalVerificationPoll(target || login, now)
    ) {
      setStatus(`Verifying ${target || login || targetGame} · Final Twitch Check`);
      return false;
    }

    if (session.deadlineAt && now >= session.deadlineAt) {
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, target || login),
          targetStream: "",
          candidateEvidence: null,
          mismatchSince: 0,
          deadlineAt: 0,
        },
        `Verification deadline expired for ${target || login || "stream"}`,
      );
    }

    const genericDropsVisible = Boolean(
      session.candidateEvidence?.dropsTagged ||
      info.dropsEnabled
    );
    setStatus(
      genericDropsVisible
        ? `Verifying ${target || login || "Drops Stream"} · Waiting For Campaign Proof`
        : `Verifying ${target || login || "Drops Stream"} For ${targetGame}`,
    );
    return false;
  }

  function routingControllerEarning(now = Date.now()) {
    let session = readRoutingControllerSession();
    if (!currentDrop || currentDrop.isClaimed) {
      return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, { deadlineAt: 0 }, "Current Drop claimed or cleared");
    }
    if (campaignGameIsIgnored(currentDrop, now)) {
      const ignoredGame = cleanText(currentDrop.game || "Campaign");
      clearStoredCurrentDrop();
      return transitionRoutingController(
        ROUTING_STATES.SELECT_CAMPAIGN,
        { targetGame: "", targetCampaign: "", targetCampaignKey: "", targetDropId: "", targetStream: "", deadlineAt: 0 },
        `${ignoredGame} is ignored until its campaign ends`,
      );
    }
    if (dropProgressComplete(currentDrop)) {
      return advanceAfterWatchComplete(currentDrop, "Earning reached 100%");
    }

    const expiry = campaignExpirySnapshot(mergeCampaigns(lastInventoryCampaigns, lastCampaignCatalog), currentDrop, now);
    if (expiry?.ended || campaignMarkedComplete(currentDrop.campaignKey || currentDrop.campaignId || "")) {
      const key = cleanText(currentDrop.campaignKey || currentDrop.campaignId).toLowerCase();
      clearStoredCurrentDrop();
      return transitionRoutingController(
        ROUTING_STATES.SELECT_CAMPAIGN,
        {
          excludedCampaignKeys: [...new Set([...(session.excludedCampaignKeys || []), key].filter(Boolean))],
          deadlineAt: 0,
        },
        "Active campaign ended or completed",
      );
    }

    const login = cleanText(watchingLogin()).toLowerCase();
    const info = readStreamInfo();
    const targetGame = cleanText(session.targetGame || currentDrop.game);
    session = syncRoutingCampaignAllowListEvidence(session, login, now);
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const gameMatches = Boolean(info.game && targetGame && gameNamesMatch(targetGame, info.game));
    const verifiedChannel = cleanText(session.candidateEvidence?.verifiedChannel).toLowerCase();
    const verifiedCampaignEvidence = Boolean(
      verifiedChannel &&
      login === verifiedChannel &&
      session.candidateEvidence?.campaignVerified === true
    );

    if (allowedLogins.size && login && !allowedLogins.has(login) && !verifiedCampaignEvidence) {
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, login),
          targetStream: "",
          candidateEvidence: null,
          deadlineAt: 0,
        },
        `Verified session invalidated · ${login} is not verified for ${session.targetCampaign || targetGame}`,
      );
    }

    if (!login || !info.live) {
      const offlineSince = Number(session.offlineSince || 0) || now;
      if (!session.offlineSince) session = writeRoutingControllerSession({ ...session, offlineSince });
      if (now - offlineSince >= ROUTING_OFFLINE_GRACE_MS) {
        setManualStreamLock(false, 'stream-offline');
        return transitionRoutingController(
          ROUTING_STATES.FIND_STREAM,
          {
            failedStreams: routingControllerAddFailedStream(session, session.targetStream || login),
            targetStream: "",
            offlineSince: 0,
            deadlineAt: 0,
          },
          "Verified stream went offline",
        );
      }
      setStatus(`Waiting For ${session.targetStream || targetGame} Stream To Recover`);
      return false;
    }

    if (info.game && !gameMatches) {
      const mismatchSince = Number(session.mismatchSince || 0) || now;
      if (!session.mismatchSince) session = writeRoutingControllerSession({ ...session, mismatchSince });
      if (now - mismatchSince >= CATEGORY_MISMATCH_GRACE_MS) {
        return transitionRoutingController(
          ROUTING_STATES.FIND_STREAM,
          {
            failedStreams: routingControllerAddFailedStream(session, login),
            targetStream: "",
            mismatchSince: 0,
            deadlineAt: 0,
          },
          `${login} changed category from ${targetGame} to ${info.game}`,
        );
      }
      setStatus(`Category Changed To ${info.game} · Confirming Before Switching`);
      return false;
    }

    if (session.offlineSince || session.mismatchSince) {
      session = writeRoutingControllerSession({ ...session, offlineSince: 0, mismatchSince: 0 });
    }

    const health = streamEarningHealthSnapshot();
    const recovery = health.recovery || { code: 'healthy', recoverable: false };
    if (recovery.code !== 'credit-stalled' && (session.recoveryStage || session.recoveryStartedAt || session.recoveryLastCheckAt)) {
      session = writeRoutingControllerSession({ ...session, recoveryStage: 0, recoveryStartedAt: 0, recoveryLastCheckAt: 0 });
    }
    if (recovery.code === 'credit-delayed-background') {
      setStatus(`Twitch Credit Delayed In Background · Holding ${login}`);
      return false;
    }
    if (recovery.code === 'foreground-revalidation-grace') {
      setStatus(`Browser Active Again · Rechecking Twitch Credit`);
      return false;
    }
    if (recovery.code === 'playback-stopped' || recovery.code === 'playback-error') {
      setManualStreamLock(false, recovery.code);
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, login),
          targetStream: "",
          recoveryStage: 0,
          recoveryStartedAt: 0,
          recoveryLastCheckAt: 0,
          deadlineAt: 0,
        },
        `Playback stopped on ${login}`,
      );
    }
    if (recovery.code === 'credit-delayed') {
      setStatus(`Twitch Credit Delayed · Holding ${login}`);
      return false;
    }
    if (recovery.code === 'buffering') {
      setStatus(`Playback Buffering · Holding ${login}`);
      return false;
    }
    const stallAnchor = Math.max(
      Number(lastProgressAt || 0),
      Number(session.earningStartedAt || session.enteredAt || now),
    );
    const stallMs = progressStallTimeoutMs(Boolean(health.healthy));
    if (
      recovery.code === 'credit-stalled' &&
      settings.queueOnStall &&
      !isAutoSwitchPaused() &&
      stallAnchor &&
      now - stallAnchor >= stallMs
    ) {
      if (manualStreamLockSnapshot()) {
        sendBrowserNotification(
          'stalled',
          'Dropper · Progress stalled',
          `No new Twitch credit from ${login}. Stay On This Stream is preventing automatic recovery.`,
          { tag: `stall-locked-${login}-${cleanText(currentDrop?.id || currentDrop?.campaignKey || 'drop')}`, cooldownMs: 5 * 60 * 1000 },
        );
        setStatus(`Progress Stalled · Staying On ${login}`);
        return false;
      }
      const stage = Number(session.recoveryStage || 0);
      if (!stage) {
        sendBrowserNotification(
          'stalled',
          'Dropper · Progress stalled',
          `No new Twitch credit from ${login}. Dropper is rechecking before it switches streams.`,
          { tag: `stall-${login}-${cleanText(currentDrop?.id || currentDrop?.campaignKey || 'drop')}`, cooldownMs: 5 * 60 * 1000 },
        );
        requestGqlPoll('stall-recovery-recheck', true);
        writeRoutingControllerSession({ ...session, recoveryStage: 1, recoveryStartedAt: now, recoveryLastCheckAt: now });
        setStatus(`Credit Stalled · Rechecking Twitch Before Switching`);
        return false;
      }
      if (stage === 1 && now - Number(session.recoveryStartedAt || now) >= STALL_RECOVERY_RECHECK_MS) {
        requestGqlPoll('stall-recovery-final-check', true);
        writeRoutingControllerSession({ ...session, recoveryStage: 2, recoveryLastCheckAt: now });
        setStatus(`Credit Still Stalled · Final Twitch Check`);
        return false;
      }
      if (stage < 2 || now - Number(session.recoveryLastCheckAt || now) < STALL_RECOVERY_RECHECK_MS) return false;
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, login),
          targetStream: "",
          recoveryStage: 0,
          recoveryStartedAt: 0,
          recoveryLastCheckAt: 0,
          deadlineAt: 0,
        },
        `No credited progress from ${login} after two Twitch rechecks`,
      );
    }

    setStatus(rewardCreditStatus(currentDrop, login));
    return false;
  }

  function routingControllerClaim(now = Date.now()) {
    if (!currentDrop) {
      return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, { deadlineAt: 0 }, "No active Drop · selecting next campaign");
    }
    if (!dropProgressComplete(currentDrop)) {
      return routingControllerBootstrap("Drop is no longer complete");
    }

    // 3.1.11 no longer blocks routing on reward claiming. CLAIM is retained as
    // a compatibility state for sessions created by older builds and unwinds
    // immediately into normal watch progression.
    return advanceAfterWatchComplete(currentDrop, "Legacy CLAIM state resumed");
  }

  function routingControllerWaiting(now = Date.now()) {
    const session = readRoutingControllerSession();
    if (session.waitReason === "claim-disabled") {
      if (currentDrop?.isClaimed || !currentDrop) {
        return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, { deadlineAt: 0 }, "Manual claim detected");
      }
      setStatus("Drop Complete · Waiting For Manual Claim");
      return false;
    }

    if (
      session.waitReason === "no-category-stream" ||
      session.waitReason === "no-live-allowed-channel"
    ) {
      const targetGame = cleanText(session.targetGame || currentDrop?.game || "");
      const targetSlug = resolveCategorySlug({
        game: targetGame,
        gameSlug: session.targetSlug || currentDrop?.gameSlug || "",
      });
      const onTargetCategory = Boolean(
        targetSlug &&
        isDirectoryCategoryPage() &&
        currentDirectorySlug() === targetSlug
      );

      if (onTargetCategory) {
        const snapshot = classifyRoutingCandidates(targetGame, targetSlug, session, now);
        if (snapshot.candidates.length) {
          transitionRoutingController(
            ROUTING_STATES.FIND_STREAM,
            { waitReason: "", deadlineAt: 0 },
            `Twitch rendered ${snapshot.candidates.length} usable ${targetGame || "category"} stream candidate${snapshot.candidates.length === 1 ? "" : "s"}`,
          );
          return routingControllerFindStream(now);
        }
      }

      setStatus(
        session.waitReason === "no-live-allowed-channel"
          ? `Waiting For A Live Campaign-Compatible ${targetGame || "Target"} Stream`
          : `Waiting For ${targetGame || "Target"} Category Streams To Render`,
      );
    } else if (session.waitReason === "stream-cycle-reset") {
      setStatus(`All Visible ${session.targetGame || "Target"} Streams Checked · Retry Pending`);
    } else if (session.waitReason === "no-drops-qualified-stream") {
      setStatus(`Waiting On ${session.targetGame || "Target"} Category For A Drops-Qualified Stream`);
    }

    if (!session.deadlineAt || now < session.deadlineAt) return false;

    if (
      session.waitReason === "no-drops-qualified-stream" ||
      session.waitReason === "no-category-stream" ||
      session.waitReason === "no-live-allowed-channel" ||
      session.waitReason === "stream-cycle-reset" ||
      session.waitReason === "category-unresolved"
    ) {
      return transitionRoutingController(ROUTING_STATES.FIND_STREAM, { waitReason: "", deadlineAt: 0 }, "Retrying stream discovery");
    }

    queueGqlPollSoon("routing-wait-retry", 0);
    return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, { waitReason: "", deadlineAt: 0 }, "Retrying campaign selection");
  }

  function routingControllerDiagnostics(now = Date.now()) {
    const session = readRoutingControllerSession();
    return {
      version: session.version,
      state: session.state,
      stateAgeSeconds: Math.max(0, Math.floor((now - Number(session.enteredAt || now)) / 1000)),
      deadlineAt: session.deadlineAt ? new Date(session.deadlineAt).toISOString() : null,
      deadlineRemainingSeconds: session.deadlineAt ? Math.max(0, Math.ceil((session.deadlineAt - now) / 1000)) : null,
      targetGame: session.targetGame || null,
      targetCampaign: session.targetCampaign || null,
      targetCampaignKey: session.targetCampaignKey || null,
      targetDropId: session.targetDropId || null,
      targetStream: session.targetStream || null,
      failedStreams: session.failedStreams || [],
      temporarySkippedStreams: session.failedStreams || [],
      streamSkipPolicy: "temporary-rotation",
      excludedCampaignKeys: session.excludedCampaignKeys || [],
      waitReason: session.waitReason || null,
      navigationTarget: session.navigationTarget || null,
      navigationReason: session.navigationReason || null,
      candidateEvidence: session.candidateEvidence || null,
      recoveryStage: Number(session.recoveryStage || 0),
      recoveryStartedAt: session.recoveryStartedAt ? new Date(session.recoveryStartedAt).toISOString() : null,
      recoveryLastCheckAt: session.recoveryLastCheckAt ? new Date(session.recoveryLastCheckAt).toISOString() : null,
      lastReason: session.lastReason || null,
    };
  }

  function routingControllerReconcileActiveTarget(now = Date.now()) {
    if (!currentDrop) return false;
    if (dropProgressComplete(currentDrop)) return false;

    const session = readRoutingControllerSession();
    const key = cleanText(currentDrop.campaignKey || currentDrop.campaignId).toLowerCase();
    const expiry = campaignExpirySnapshot(
      mergeCampaigns(lastInventoryCampaigns, lastCampaignCatalog),
      currentDrop,
      now,
    );

    const routingState = campaignRoutingState(currentDrop, now);
    let reason = "";
    if (!routingState.open) {
      reason = `Locked campaign ${currentDrop.campaign || currentDrop.game || key || "target"} is not routable · ${routingState.reason}`;
    } else if (key && campaignMarkedComplete(key)) {
      reason = `Locked campaign ${currentDrop.campaign || currentDrop.game || key} is already complete or expired`;
    } else if (campaignIsExcluded(currentDrop)) {
      reason = `Locked campaign ${currentDrop.campaign || currentDrop.game || "target"} is excluded`;
    } else if (expiry?.ended) {
      reason = `Locked campaign ${expiry.campaignName || currentDrop.campaign || currentDrop.game} has ended`;
    } else if (!dropFitsCampaignWindow(currentDrop, now)) {
      const replacement = pickNextOpenCampaignDrop(
        routingCampaignPool(),
        key ? [key] : [],
        [],
      );
      if (replacement && dropFitsCampaignWindow(replacement, now)) {
        reason = `Locked campaign ${currentDrop.campaign || currentDrop.game || "target"} can no longer finish before its deadline`;
      }
    }

    if (!reason) return false;

    const excludedCampaignKeys = normalizeExcludedCampaignKeys([
      ...(session.excludedCampaignKeys || []),
      key,
    ]);

    logActivity("routing-target-evicted", reason, {
      campaignKey: key || null,
      campaign: currentDrop.campaign || null,
      game: currentDrop.game || null,
      state: session.state,
      ended: Boolean(expiry?.ended),
      endAt: expiry?.endAt || currentDrop.campaignEndAt || null,
    });

    clearStoredCurrentDrop();
    transitionRoutingController(
      ROUTING_STATES.SELECT_CAMPAIGN,
      {
        targetGame: "",
        targetSlug: "",
        targetCampaign: "",
        targetCampaignKey: "",
        targetDropId: "",
        targetStream: "",
        failedStreams: [],
        excludedCampaignKeys,
        navigationTarget: "",
        navigationReason: "",
        candidateEvidence: null,
        waitReason: "",
        deadlineAt: 0,
      },
      reason,
    );
    setStatus("Previous Campaign Ended · Selecting Next Eligible Campaign");
    return true;
  }

  // Picks the best campaign that can be earned now, skipping any that cannot. `excluded` carries the skipped
  // keys so callers can keep them out of later picks. preferCurrent: false ranks purely by Campaign Order.
  function pickViableCampaign(session, { preferCurrent = true } = {}) {
    const excluded = new Set((session.excludedCampaignKeys || []).map((key) => cleanText(key).toLowerCase()).filter(Boolean));
    // Details-pending campaigns whose details already came back empty are
    // skipped only until the miss expires, so they stay out of `excluded`.
    const missed = new Set();
    let next = null;
    for (let attempts = 0; attempts < 12; attempts += 1) {
      next = pickNextOpenCampaignDrop(routingCampaignPool(), [...excluded, ...missed], [], { preferCurrent });
      if (!next) break;
      const key = cleanText(next.campaignKey || next.campaignId).toLowerCase();
      if (campaignIsExcluded(next) || (!next.needsDropDetails && !dropFitsCampaignWindow(next))) {
        if (key) excluded.add(key);
        next = null;
        continue;
      }
      if (next.needsDropDetails && key && campaignDetailsMissedRecently(key)) {
        missed.add(key);
        next = null;
        continue;
      }
      break;
    }
    return { next, excluded };
  }

  // The viewer changed Campaign Order or hand-ranked a game, so act on it straight away: when the top-ranked
  // campaign is not the one being earned, leave for it. Same limits as any automatic move: automatic switching
  // on, this tab routing, playback not paused, and no manual stream lock. Returns what happened for the UI.
  function applyCampaignOrderNow(reason = 'campaign-order-changed', now = Date.now()) {
    const none = (why = '') => ({ switched: false, why });
    if (!settings.findNextStream) return none('Automatic Switching Is Off');
    if (!isAutoRoutingController()) return none('Another Tab Is Routing');
    const session = readRoutingControllerSession();
    const movable = [ROUTING_STATES.SELECT_CAMPAIGN, ROUTING_STATES.FIND_STREAM, ROUTING_STATES.OPEN_STREAM, ROUTING_STATES.VERIFY_STREAM, ROUTING_STATES.EARNING];
    // Claiming, waiting, and idle states are never interrupted; the next selection uses the new order anyway.
    if (!movable.includes(session.state) || !currentDrop || currentDrop.isClaimed) return none();
    if (!viewingNavigationAllowed(reason)) return none(lastViewingNavigationBlock || 'Navigation Blocked');
    const { next: top, excluded } = pickViableCampaign(session, { preferCurrent: false });
    if (!top) return none();
    if (pickMatchesCurrentDrop(top)) return { switched: false, why: '', alreadyTop: true, game: top.game };
    // Do not abandon a working stream for a campaign whose reward details have not loaded yet.
    if (top.needsDropDetails || !Number.isFinite(Number(top.requiredMinutes)) || Number(top.requiredMinutes) <= 0) return none('Reward Details Pending');
    const leaving = cleanText(currentDrop.game || 'Campaign');
    clearStoredCurrentDrop();
    transitionRoutingController(
      ROUTING_STATES.SELECT_CAMPAIGN,
      { targetGame: '', targetCampaign: '', targetCampaignKey: '', targetDropId: '', targetStream: '', candidateEvidence: null, excludedCampaignKeys: [...excluded], deadlineAt: 0 },
      `Campaign Order changed · moving from ${leaving} to ${top.game}`,
    );
    routingControllerTick(now, reason);
    return { switched: true, why: '', game: top.game, from: leaving };
  }

  function routingControllerTick(now = Date.now(), reason = "heartbeat") {
    routingControllerResetLegacyHandoff();
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("routing-controller");
      return false;
    }
    if (!settings.findNextStream) {
      const session = readRoutingControllerSession();
      if (session.state !== ROUTING_STATES.PAUSED) {
        transitionRoutingController(ROUTING_STATES.PAUSED, { deadlineAt: 0 }, "Automatic stream routing disabled");
      }
      return false;
    }

    if (!viewingNavigationAllowed(reason)) { refreshViewingControls(); return false; }

    clearSyntheticWaitingDrop("Cleared empty Active drop before 3.1 routing");
    expireEndedOpenCampaigns(now);
    if (routingControllerReconcileActiveTarget(now)) return true;

    let session = readRoutingControllerSession();
    if (session.state === ROUTING_STATES.IDLE || session.state === ROUTING_STATES.PAUSED || session.state === ROUTING_STATES.ERROR) {
      session = routingControllerBootstrap(reason);
    }

    if (routingControllerNavigationInFlight(now)) return true;

    switch (session.state) {
      case ROUTING_STATES.SELECT_CAMPAIGN:
        return routingControllerSelectCampaign(now);
      case ROUTING_STATES.FIND_STREAM:
        return routingControllerFindStream(now);
      case ROUTING_STATES.OPEN_STREAM:
        return routingControllerOpenStream(now);
      case ROUTING_STATES.VERIFY_STREAM:
        return routingControllerVerifyStream(now);
      case ROUTING_STATES.EARNING:
        return routingControllerEarning(now);
      case ROUTING_STATES.CLAIM:
        return routingControllerClaim(now);
      case ROUTING_STATES.WAITING:
        return routingControllerWaiting(now);
      default:
        return false;
    }
  }

