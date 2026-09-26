  // BEGIN DROPPER ACTIVE VIEWING
  // Original implementation of the approved Dropper feature specification.
  // No twitch-autoclaim or TwitchDropsMiner implementation is included here.
  const DropperActiveViewing = (() => {
    const text = value => String(value ?? '').trim();
    const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    const terminal = new Set(['confirmed', 'already-claimed', 'blocked', 'unconfirmed', 'discarded']);
    const outcomes = new Set(['pending', 'retryable', ...terminal]);
    const evidenceKinds = new Set(['request', 'page-control', 'claim-result', 'inventory', 'timeout', 'network', 'permission', 'integrity', 'unknown', 'context-change']);
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
            if (text(raw.key).length > 512 || text(raw.rewardId).length > 180 || text(raw.campaignId).length > 180) continue;
            if (/https?:|[\r\n<>]/i.test(raw.key + (raw.rewardId || '') + (raw.campaignId || ''))) continue;
            const record = {
              key: text(raw.key), kind: raw.kind, rewardId: text(raw.rewardId), campaignId: text(raw.campaignId),
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
      function begin({ key, rewardId = '', campaignId = '', kind = 'drop', evidence = 'request' }) {
        expire();
        if (!claimKinds.has(kind) || !text(key) || key.length > 512 || /https?:|[\r\n<>]/i.test(key + rewardId + campaignId)) return null;
        const prior = records.get(key);
        if (prior && (prior.outcome !== 'retryable' || prior.attempts >= 3 || now() < prior.nextAttemptAt)) return null;
        return persist({
          key, rewardId: text(rewardId).slice(0, 180), campaignId: text(campaignId).slice(0, 180), kind,
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
      if (context.allowedChannels?.length && context.channel && !context.allowedChannels.map(x => text(x).toLowerCase()).includes(text(context.channel).toLowerCase())) return result('wrong-channel', 'Stream Not Eligible', "This stream does not meet the selected campaign's channel requirements.", { plan, deadline, campaignPlan });
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
      if (health.pauseReason === 'viewer' || health.paused === true) return { code: 'viewer-paused', recoverable: false };
      if (health.live === false) return { code: 'offline', recoverable: true };
      if (health.gameMatches === false) return { code: 'wrong-game', recoverable: true };
      if (health.playback === 'error') return { code: 'playback-error', recoverable: true };
      if (health.inVerificationGrace) return { code: 'verification-grace', recoverable: false };
      if (health.campaignVerified === false) return { code: 'eligibility-unverified', recoverable: false };
      const progressAgeMs = Math.max(0, Number(health.progressAgeMs || 0));
      if (progressAgeMs >= Math.max(0, stalledMs)) return { code: 'credit-stalled', recoverable: true };
      if (health.playback === 'buffering' && progressAgeMs >= Math.max(0, delayedMs)) return { code: 'buffering', recoverable: false };
      if (progressAgeMs >= Math.max(0, delayedMs)) return { code: 'credit-delayed', recoverable: false };
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

    return Object.freeze({ createIntent, createClaims, claimResponse, claimFailure, planPrerequisites, deadlineAssessment, campaignSequence, rankCampaignCandidates, eligibility, selectorHealth, recoveryDiagnosis, createLease, claimPresentation });
  })();
  // END DROPPER ACTIVE VIEWING
