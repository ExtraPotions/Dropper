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
      deferredCampaigns: {},
      creditVerificationAttempts: {},
      streamDiscoveryStartedAt: 0,
      navigationTarget: "",
      navigationReason: "",
      candidateEvidence: null,
      verifyBaselineMinutes: null,
      verifyBaselinePercent: null,
      firstCreditWindow: false,
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
    const holdsWaitReason = state === ROUTING_STATES.WAITING || state === ROUTING_STATES.PAUSED;
    const waitReason = Object.prototype.hasOwnProperty.call(patch, "waitReason")
      ? cleanText(patch.waitReason)
      : (holdsWaitReason ? cleanText(previous.waitReason) : "");
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
      // The first-credit extension belongs to one verification of one stream.
      firstCreditWindow: Object.prototype.hasOwnProperty.call(patch, "firstCreditWindow")
        ? Boolean(patch.firstCreditWindow)
        : Boolean(
          !changed &&
          previous.firstCreditWindow &&
          cleanText(previous.targetStream).toLowerCase() === cleanText(patch.targetStream ?? previous.targetStream).toLowerCase()
        ),
      waitReason,
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
      verifyBaselineMinutes: currentDrop.currentMinutes == null ? null : Number(currentDrop.currentMinutes),
      verifyBaselinePercent: currentDrop.percent == null ? null : Number(currentDrop.percent),
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
      gqlSessionIdentityLevel: "exact-drop",
      gqlEvidenceAt: now,
    };
    writeRoutingControllerSession({
      ...routing,
      ...routingControllerTargetFromDrop(currentDrop),
      candidateEvidence,
      targetStream: login,
      verifyBaselineMinutes: currentDrop.currentMinutes == null ? null : Number(currentDrop.currentMinutes),
      verifyBaselinePercent: currentDrop.percent == null ? null : Number(currentDrop.percent),
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
        currentMinutes: currentDrop.currentMinutes == null ? null : Number(currentDrop.currentMinutes),
        requiredMinutes: Number(currentDrop.requiredMinutes || 0),
        currentPercent: currentDrop.percent == null ? null : Number(currentDrop.percent),
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
    const moved = autoNavigateTwitch(url, reason);
    if (!moved && recoveryNavigationState().suspended) {
      transitionRoutingController(ROUTING_STATES.PAUSED, { targetStream: '', navigationTarget: null, navigationReason: null, deadlineAt: 0, waitReason: 'recovery-paused' }, 'Recovery paused after repeated stream changes');
      setStatus('Recovery Paused · Resume from System');
    }
    return moved;
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

    const key = cleanText(currentDrop.campaignKey || currentDrop.campaignId).toLowerCase();
    if (Number(readRoutingControllerSession().deferredCampaigns?.[key]) > Date.now()) {
      return routingControllerSelectCampaign();
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
          verifyBaselineMinutes: currentDrop.currentMinutes == null ? null : Number(currentDrop.currentMinutes),
          verifyBaselinePercent: currentDrop.percent == null ? null : Number(currentDrop.percent),
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
    const currentKey = cleanText(currentDrop?.campaignKey || currentDrop?.campaignId).toLowerCase();
    const retryAt = Number(session.deferredCampaigns?.[currentKey]) || 0;

    if (currentDrop && !currentDrop.isClaimed && dropProgressComplete(currentDrop)) {
      return advanceAfterWatchComplete(currentDrop, "Completed Drop already has full watch credit");
    }

    if (
      currentDrop &&
      !currentDrop.isClaimed &&
      !dropProgressComplete(currentDrop) &&
      !campaignMarkedComplete(currentDrop.campaignKey || currentDrop.campaignId || "") &&
      !campaignIsExcluded(currentDrop) &&
      retryAt <= now &&
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

    const { next, excluded } = pickViableCampaign(session, { now });

    if (!next) {
      if (currentDrop && !currentDrop.isClaimed && retryAt > now) {
        const creditCooldown = Number(session.creditVerificationAttempts?.[currentKey]?.count) >= 3;
        return transitionRoutingController(ROUTING_STATES.WAITING, {
          ...routingControllerTargetFromDrop(currentDrop),
          targetStream: watchingLogin() || session.targetStream || '',
          waitReason: creditCooldown ? 'reward-credit-unconfirmed' : 'no-eligible-campaign',
          deadlineAt: retryAt,
        }, 'Campaign deferred · keeping current stream open until cooldown ends');
      }
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
        streamDiscoveryStartedAt: now,
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
    // Finding a stream ends in navigation, so it starts only in the tab chosen for automatic switching.
    if (!isAutomationTab()) { lastViewingNavigationBlock = 'Automatic Switching Is Off In This Tab'; return false; }
    let session = readRoutingControllerSession();
    if (!currentDrop || currentDrop.isClaimed || dropProgressComplete(currentDrop)) {
      return routingControllerBootstrap("Active Drop changed while finding a stream");
    }
    if (!session.streamDiscoveryStartedAt) {
      session = writeRoutingControllerSession({ ...session, streamDiscoveryStartedAt: now });
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
        verifyBaselineMinutes: currentDrop.currentMinutes == null ? null : Number(currentDrop.currentMinutes),
        verifyBaselinePercent: currentDrop.percent == null ? null : Number(currentDrop.percent),
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
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const login = cleanText(channelLogin).toLowerCase();
    const present = allowedChannels.length > 0;
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
    const aclRejected = Boolean(cleanText(channelLogin)) && current.campaignAclMatched === true &&
      snapshot.campaignAllowListPresent && !snapshot.campaignAllowListMatch;
    if (
      current.campaignAllowListPresent === snapshot.campaignAllowListPresent &&
      current.campaignAllowListMatch === snapshot.campaignAllowListMatch &&
      current.campaignAllowListSource === snapshot.campaignAllowListSource && !aclRejected
    ) return session;

    return writeRoutingControllerSession({
      ...session,
      candidateEvidence: {
        ...current,
        ...snapshot,
        ...(aclRejected ? { campaignAclMatched: false } : {}),
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

    const gqlCampaignSupported = Boolean(
      session.candidateEvidence?.gqlCampaignSupported ||
      campaignSupport === true
    );
    const evidence = {
      ...(session.candidateEvidence || {}),
      gqlCampaignSupported,
      gqlSessionMatched: sessionMatches,
      gqlSessionCampaignMatched: sessionCampaignMatches,
      gqlSessionDropMatched: sessionDropMatches,
      gqlSessionIdentityLevel: sessionIdentityLevel,
      gqlEvidenceAt: Date.now(),
    };
    writeRoutingControllerSession({ ...session, candidateEvidence: evidence });
    const evidenceMessage = sessionDropMatches
      ? "Twitch GQL matched the selected Drop session"
      : sessionCampaignMatches
        ? "Twitch GQL matched the target campaign session"
        : "Twitch GQL confirmed target campaign support";
    logActivity("stream-verification-evidence", evidenceMessage, {
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

  function routingRewardCreditState(session, now = Date.now()) {
    const poll = typeof lastSessionPoll === 'undefined' ? null : lastSessionPoll;
    const fresh = poll && cleanText(poll.channelLogin).toLowerCase() === cleanText(session.targetStream).toLowerCase() &&
      Number(poll.at) <= now && now - Number(poll.at) <= 90 * 1000;
    if (!fresh) return { code: 'session-check-pending', label: 'Waiting For Reward Session' };
    if (poll.responseStatus === 'unidentified') return { code: 'session-unidentified', label: 'Reward Session Unidentified' };
    if (poll.responseStatus === 'inactive') return { code: 'session-inactive', label: 'No Active Reward Session' };
    if (poll.responseStatus === 'absent') return { code: 'session-absent', label: 'Reward Session Missing' };
    if (['error','unavailable','partial-response'].includes(poll.responseStatus)) return { code: 'session-request-unavailable', label: 'Reward Session Check Unavailable' };
    if (poll.responseStatus === 'shape-changed') return { code: 'session-shape-changed', label: 'Reward Session Format Unrecognized' };
    if (poll.identityLevel === 'exact-drop') return { code: 'session-identified', label: 'Waiting For Twitch Credit' };
    return { code: 'session-unmatched', label: 'Reward Session Does Not Match Selected Drop' };
  }

  function routingControllerCreditDeadline(session, login, now) {
    const key = cleanText(session.targetCampaignKey).toLowerCase();
    if (!key) return false;
    const attempts = Object.fromEntries(Object.entries(session.creditVerificationAttempts || {})
      .filter(([, entry]) => entry && Number(entry.expiresAt) > now).slice(-19));
    const previous = attempts[key];
    const count = Math.min(3, Math.max(0, Number(previous?.count) || 0) + 1);
    attempts[key] = { count, expiresAt: now + 30 * 60 * 1000 };
    session = writeRoutingControllerSession({ ...session, creditVerificationAttempts: attempts });
    if (count < 3) return false;

    // Campaign support without reward identity or new credit does not prove
    // the channel failed. Bound these slow retries across stream navigations.
    const retryAt = now + 15 * 60 * 1000;
    attempts[key].expiresAt = retryAt;
    const deferredCampaigns = Object.fromEntries(Object.entries(session.deferredCampaigns || {})
      .filter(([, until]) => Number(until) > now));
    deferredCampaigns[key] = retryAt;
    const patch = { creditVerificationAttempts: attempts, deferredCampaigns,
      streamDiscoveryStartedAt: 0, mismatchSince: 0, recoveryStage: 0 };
    const { next, excluded } = pickViableCampaign({ ...session, ...patch }, { preferCurrent: false, now });
    if (next) return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, {
      ...patch, excludedCampaignKeys: [...excluded], targetStream: '',
      candidateEvidence: null, waitReason: '', deadlineAt: 0,
    }, 'Reward credit unconfirmed after three stream attempts · deferring campaign for 15 minutes');
    return transitionRoutingController(ROUTING_STATES.WAITING, {
      ...patch, waitReason: 'reward-credit-unconfirmed', deadlineAt: retryAt,
    }, `Reward credit unconfirmed · keeping ${login || session.targetStream || 'current stream'} open for a 15-minute cooldown`);
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

    const currentMinutes = currentDrop?.currentMinutes == null ? null : Number(currentDrop.currentMinutes);
    const currentPercent = currentDrop?.percent == null ? null : Number(currentDrop.percent);
    const baselineMinutes = session.verifyBaselineMinutes == null ? null : Number(session.verifyBaselineMinutes);
    const baselinePercent = session.verifyBaselinePercent == null ? null : Number(session.verifyBaselinePercent);
    const targetIdentityMatches = Boolean(
      login && target && login === target &&
      cleanText(currentDrop?.id) === cleanText(session.targetDropId) &&
      cleanText(currentDrop?.campaignKey || currentDrop?.campaignId).toLowerCase() === cleanText(session.targetCampaignKey).toLowerCase()
    );
    // The first known observation can be historical progress. Establish its
    // baseline before a later observation is allowed to prove fresh credit.
    if (targetIdentityMatches && (
      (!Number.isFinite(baselineMinutes) && Number.isFinite(currentMinutes)) ||
      (!Number.isFinite(baselinePercent) && Number.isFinite(currentPercent))
    )) {
      session = writeRoutingControllerSession({ ...session,
        verifyBaselineMinutes: Number.isFinite(baselineMinutes) ? baselineMinutes : currentMinutes,
        verifyBaselinePercent: Number.isFinite(baselinePercent) ? baselinePercent : currentPercent,
      });
    }
    const minutesAdvanced = targetIdentityMatches && Number.isFinite(baselineMinutes) &&
      Number.isFinite(currentMinutes) && currentMinutes > baselineMinutes;
    const percentAdvanced = targetIdentityMatches && Number.isFinite(baselinePercent) &&
      Number.isFinite(currentPercent) && currentPercent > baselinePercent;
    const progressProof = minutesAdvanced || percentAdvanced;

    const liveDropsVisible = Boolean(info.dropsEnabled);
    const directoryDropsVisible = Boolean(session.candidateEvidence?.dropsTagged);
    const aclCampaignProof = Boolean(session.candidateEvidence?.campaignAclMatched);
    const gqlCampaignProof = Boolean(session.candidateEvidence?.gqlCampaignSupported);
    const campaignProof = aclCampaignProof || gqlCampaignProof;
    const exactSessionProof = Boolean(
      session.candidateEvidence?.gqlSessionDropMatched === true &&
      session.candidateEvidence?.gqlSessionIdentityLevel === "exact-drop"
    );
    const earningProof = exactSessionProof || progressProof;
    if (
      info.live &&
      gameMatches &&
      earningProof
    ) {
      lastStreamVerification = {
        at: now,
        method: progressProof
          ? "credited-progress"
          : "session-drop-match",
        channel: login || target || null,
        dropId: currentDrop?.id || null,
        game: targetGame || null,
        campaign: session.targetCampaign || currentDrop?.campaign || null,
        campaignKey: session.targetCampaignKey || currentDrop?.campaignKey || currentDrop?.campaignId || null,
        proof: {
          gameMatched: true,
          campaignSupported: campaignProof || exactSessionProof,
          campaignAclMatched: aclCampaignProof,
          gqlCampaignSupported: gqlCampaignProof,
          sessionMatched: exactSessionProof,
          sessionDropMatched: exactSessionProof,
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
            campaignVerified: campaignProof || exactSessionProof,
            verifiedChannel: verificationLogin,
            creditedProgressVerified: progressProof,
            verifiedAt: now,
          },
          deadlineAt: 0,
          mismatchSince: 0,
          offlineSince: 0,
          verifyBaselineMinutes: currentDrop?.currentMinutes == null ? null : Number(currentDrop.currentMinutes),
          verifyBaselinePercent: currentDrop?.percent == null ? null : Number(currentDrop.percent),
          recoveryStage: 0,
          recoveryStartedAt: 0,
          recoveryLastCheckAt: 0,
          creditVerificationAttempts: Object.fromEntries(Object.entries(session.creditVerificationAttempts || {})
            .filter(([key]) => key !== cleanText(session.targetCampaignKey).toLowerCase())),
          deferredCampaigns: Object.fromEntries(Object.entries(session.deferredCampaigns || {})
            .filter(([key]) => key !== cleanText(session.targetCampaignKey).toLowerCase())),
        },
        `Verified earning on ${login || target} for ${session.targetCampaign || targetGame}`,
      );
    }

    // Campaign support proves eligibility, not earning. Keep an eligible live
    // stream open for Twitch's first credit instead of rotating at 90 seconds.
    if (campaignProof && info.live && gameMatches && session.deadlineAt && !session.firstCreditWindow) {
      session = writeRoutingControllerSession({
        ...session,
        firstCreditWindow: true,
        deadlineAt: Math.max(
          Number(session.deadlineAt),
          Number(session.enteredAt || now) + ROUTING_FIRST_CREDIT_DEADLINE_MS,
        ),
      });
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
      if (campaignProof && info.live && gameMatches) {
        if (routingControllerCreditDeadline(session, target || login, now)) return true;
        session = readRoutingControllerSession();
      }
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
      campaignProof && info.live && gameMatches
        ? `Eligible ${target || login || "Drops Stream"} · ${routingRewardCreditState(session, now).label}`
        : genericDropsVisible
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

  function routingControllerDeferUnavailableCampaign(session, now = Date.now()) {
    if (!["no-category-stream", "no-live-allowed-channel"].includes(session.waitReason)) return false;
    const startedAt = Number(session.streamDiscoveryStartedAt || 0);
    const key = cleanText(session.targetCampaignKey).toLowerCase();
    if (!key || !startedAt || now - startedAt < 2 * 60 * 1000) return false;

    // A partial directory scan cannot prove channels offline. Temporarily
    // revisit this campaign later while another campaign gets a chance.
    const deferredCampaigns = Object.fromEntries(Object.entries(session.deferredCampaigns || {})
      .filter(([, until]) => Number(until) > now));
    deferredCampaigns[key] = now + 5 * 60 * 1000;
    const { next, excluded } = pickViableCampaign({ ...session, deferredCampaigns }, { preferCurrent: false, now });
    if (!next) return false;
    setStatus("No Compatible Stream Found · Trying Another Campaign");
    return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, {
      deferredCampaigns,
      streamDiscoveryStartedAt: 0,
      excludedCampaignKeys: [...excluded],
      targetStream: "",
      candidateEvidence: null,
      waitReason: "",
      deadlineAt: 0,
    }, `Temporarily deferred ${session.targetCampaign || session.targetGame} after stream discovery; selecting another campaign`);
  }

  function routingControllerWaiting(now = Date.now()) {
    const session = readRoutingControllerSession();
    if (session.waitReason === 'reward-credit-unconfirmed') {
      const matches = cleanText(currentDrop?.id) === cleanText(session.targetDropId) &&
        cleanText(currentDrop?.campaignKey || currentDrop?.campaignId).toLowerCase() === cleanText(session.targetCampaignKey).toLowerCase();
      const advanced = matches && (
        (session.verifyBaselineMinutes != null && currentDrop?.currentMinutes != null && Number(currentDrop.currentMinutes) > Number(session.verifyBaselineMinutes)) ||
        (session.verifyBaselinePercent != null && currentDrop?.percent != null && Number(currentDrop.percent) > Number(session.verifyBaselinePercent))
      );
      if (matches && ((session.verifyBaselineMinutes == null && currentDrop?.currentMinutes != null) ||
        (session.verifyBaselinePercent == null && currentDrop?.percent != null))) {
        writeRoutingControllerSession({ ...session,
          verifyBaselineMinutes: session.verifyBaselineMinutes ?? currentDrop.currentMinutes,
          verifyBaselinePercent: session.verifyBaselinePercent ?? currentDrop.percent,
        });
      }
      if (advanced || session.candidateEvidence?.gqlSessionDropMatched === true) {
        return routingControllerVerifyStream(now);
      }
      if (now < Number(session.deadlineAt || 0)) {
        setStatus('Reward Credit Unconfirmed · Keeping Current Stream Open During Cooldown');
        return false;
      }
      return transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, {
        waitReason: '', deadlineAt: 0, targetStream: '', candidateEvidence: null,
      }, 'Reward-credit cooldown ended · checking campaigns again');
    }
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
    const deferred = routingControllerDeferUnavailableCampaign(session, now);
    if (deferred) return deferred;

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
      streamDiscoveryAgeSeconds: session.streamDiscoveryStartedAt
        ? Math.max(0, Math.floor((now - Number(session.streamDiscoveryStartedAt)) / 1000)) : null,
      deferredCampaigns: Object.entries(session.deferredCampaigns || {})
        .filter(([, until]) => Number(until) > now)
        .map(([campaignKey, until]) => ({ campaignKey, retryAt: new Date(Number(until)).toISOString() })),
      creditVerification: {
        attemptLimit: 3, cooldownSeconds: 900,
        attempts: Math.min(3, Math.max(0, Number(session.creditVerificationAttempts?.[cleanText(session.targetCampaignKey).toLowerCase()]?.count) || 0)),
        cooldownActive: session.waitReason === 'reward-credit-unconfirmed' && Number(session.deadlineAt) > now,
        rewardSession: routingRewardCreditState(session, now),
      },
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
    const claimed = nativeRewardClaimEvidence().claimedGroups.has(
      cleanText(currentDrop.campaignKey || currentDrop.campaignId).toLowerCase() + ':' + cleanText(currentDrop.id));
    if (claimed) {
      clearStoredCurrentDrop();
      transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, {
        targetGame: '', targetCampaign: '', targetCampaignKey: '', targetDropId: '',
        targetStream: '', candidateEvidence: null, waitReason: '', deadlineAt: 0,
      }, 'Twitch inventory confirms the selected reward was already claimed · selecting next reward');
      return true;
    }
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

    if (!reason) {
      // Stored targets can survive navigation or a pause. Recheck their cooldown
      // before any bootstrap, discovery, or verification path can resume them.
      if (Number(session.deferredCampaigns?.[key]) > now &&
          !(session.state === ROUTING_STATES.WAITING && session.waitReason === 'reward-credit-unconfirmed')) {
        routingControllerSelectCampaign(now);
        return true;
      }
      return false;
    }

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
  function pickViableCampaign(session, { preferCurrent = true, now = Date.now() } = {}) {
    const excluded = new Set((session.excludedCampaignKeys || []).map((key) => cleanText(key).toLowerCase()).filter(Boolean));
    // Details-pending campaigns whose details already came back empty are
    // skipped only until the miss expires, so they stay out of `excluded`.
    const missed = new Set(Object.entries(session.deferredCampaigns || {})
      .filter(([, until]) => Number(until) > now)
      .map(([key]) => cleanText(key).toLowerCase()).filter(Boolean));
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
    if (recoveryNavigationState().suspended) {
      setStatus('Recovery Paused · Resume from System');
      return false;
    }
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

    if (!viewingNavigationAllowed(reason)) {
      const session = readRoutingControllerSession();
      const viewing = viewingIntent.snapshot();
      const hiddenHold = viewing.paused && viewing.pauseReason !== 'viewer' && typeof document !== 'undefined' && document && (document.hidden || document.pictureInPictureElement);
      if (hiddenHold) return false;
      const waitReason = viewing.paused ? 'viewer-paused' : viewing.manualStream ? 'manual-stream' : 'stream-locked';
      if (session.state !== ROUTING_STATES.PAUSED || session.waitReason !== waitReason || session.candidateEvidence || session.targetStream) {
        transitionRoutingController(ROUTING_STATES.PAUSED, {
          waitReason, targetStream: '', candidateEvidence: null, deadlineAt: 0,
          mismatchSince: 0, offlineSince: 0,
        }, lastViewingNavigationBlock || 'Viewing intent holds automatic routing');
      }
      refreshViewingControls();
      return false;
    }

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
