  // ---------------------------------------------------------------------------
  // Campaign insights: read-only summaries built from campaign and inventory data
  // Dropper already holds. Nothing here changes routing, claiming, or settings, and
  // every entry point returns an empty result instead of throwing when data is
  // missing, because Twitch offers no viewer API and its data can change shape.
  // The pure helpers take their data as arguments so tests can run them on their own.
  // ---------------------------------------------------------------------------

  function insightsText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function insightsNumber(value) {
    return value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function insightsDrops(campaign) {
    return campaign?.timeBasedDrops || campaign?.drops || [];
  }

  function insightsDropName(drop) {
    return insightsText(
      drop?.name ||
      drop?.benefitEdges?.[0]?.benefit?.name ||
      drop?.benefit?.name ||
      drop?.rewards?.[0]?.name ||
      "Reward",
    );
  }

  function insightsGameName(campaign) {
    return insightsText(campaign?.game?.displayName || campaign?.game?.name || campaign?.gameName || (typeof campaign?.game === "string" ? campaign.game : ""));
  }

  // Number of subscriptions a drop needs, read from the same fields the routing code checks.
  function insightsRequiredSubs(drop) {
    return insightsNumber(
      drop?.requiredSubs ??
      drop?.requiredSubscriptions ??
      drop?.requiredSubscriptionCount ??
      drop?.subscriptionRequirement?.requiredSubs,
    ) || 0;
  }

  // "2d 4h", "5h 10m", or "12m".
  function insightsSpan(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    if (total < 60) return `${total}m`;
    if (total < 1440) return `${Math.floor(total / 60)}h ${total % 60}m`;
    return `${Math.floor(total / 1440)}d ${Math.floor((total % 1440) / 60)}h`;
  }

  // ---- Deadline planner -------------------------------------------------------

  // queue: the open-campaign queue (game, endMs, sequenceRemainingMinutes,
  // sequenceFinishable, pendingClaims). Ignored games are left out.
  function summarizeCampaignPlan(queue, { isIgnored = () => false, now = Date.now() } = {}) {
    const games = new Set();
    let campaigns = 0;
    let remainingMinutes = 0;
    let unknown = 0;
    let atRisk = 0;
    let earliestEndMs = 0;
    for (const item of queue || []) {
      if (!item || isIgnored(item.game)) continue;
      const endMs = insightsNumber(item.endMs);
      const hasEnd = endMs !== null && endMs > now && endMs < Number.MAX_SAFE_INTEGER / 2;
      campaigns += 1;
      games.add(insightsText(item.game).toLowerCase());
      const remaining = insightsNumber(item.sequenceRemainingMinutes);
      if (remaining === null) unknown += 1;
      else remainingMinutes += Math.max(0, remaining);
      if (item.sequenceFinishable === false) atRisk += 1;
      if (hasEnd && (!earliestEndMs || endMs < earliestEndMs)) earliestEndMs = endMs;
    }
    return { campaigns, games: games.size, remainingMinutes, unknown, atRisk, earliestEndMs };
  }

  function campaignPlanText(summary, now = Date.now()) {
    if (!summary || !summary.campaigns) return "";
    const parts = [];
    const known = summary.campaigns - summary.unknown;
    if (known > 0) parts.push(`about ${insightsSpan(summary.remainingMinutes)} of watching left`);
    else parts.push("watch time not known yet");
    parts.push(`${summary.campaigns} open campaign${summary.campaigns === 1 ? "" : "s"}`);
    if (summary.earliestEndMs > now) parts.push(`first ends in ${insightsSpan((summary.earliestEndMs - now) / 60000)}`);
    if (summary.atRisk) parts.push(`${summary.atRisk} may not finish in time`);
    if (summary.unknown && known > 0) parts.push(`${summary.unknown} without a known time`);
    return `Planner: ${parts.join(" · ")}`;
  }

  function campaignPlannerText(now = Date.now()) {
    try {
      const queue = listOpenCampaignQueue(openCampaignManagementPool(now), now);
      const isIgnored = (game) => Number(ignoredCampaignGames.games?.[ignoredCampaignGameKey(game)]?.expiresAt || 0) > now;
      return campaignPlanText(summarizeCampaignPlan(queue, { isIgnored, now }), now);
    } catch {
      return "";
    }
  }

  // ---- Subscription rewards ---------------------------------------------------

  // Returns Map(gameKey -> { count, maxSubs }) for unclaimed subscription rewards.
  function subscriptionRewardsByGame(campaigns, gameKeyOf = insightsText) {
    const result = new Map();
    for (const campaign of campaigns || []) {
      const key = gameKeyOf(insightsGameName(campaign));
      if (!key) continue;
      for (const drop of insightsDrops(campaign)) {
        if (drop?.self?.isClaimed === true) continue;
        const subs = insightsRequiredSubs(drop);
        if (!subs) continue;
        const entry = result.get(key) || { count: 0, maxSubs: 0 };
        entry.count += 1;
        entry.maxSubs = Math.max(entry.maxSubs, subs);
        result.set(key, entry);
      }
    }
    return result;
  }

  function subscriptionRewardText(entry) {
    if (!entry || !entry.count) return "";
    const plural = entry.count === 1 ? "" : "s";
    return `${entry.count} subscription reward${plural} (up to ${entry.maxSubs} sub${entry.maxSubs === 1 ? "" : "s"})`;
  }

  // ---- Unclaimed rewards ------------------------------------------------------

  // Rewards fully earned but not yet claimed. Twitch lets you claim for a limited time
  // after a campaign ends and its own pages disagree on how long (7 or 14 days), so the
  // list only says how long ago a campaign ended and flags older ones as "claim soon".
  const UNCLAIMED_CLAIM_SOON_MS = 5 * 24 * 60 * 60 * 1000;

  function unclaimedRewards(campaigns, now = Date.now()) {
    const items = [];
    for (const campaign of campaigns || []) {
      const endMs = Date.parse(campaign?.endAt || "");
      const ended = Number.isFinite(endMs) && endMs > 0 && endMs <= now;
      for (const drop of insightsDrops(campaign)) {
        if (drop?.self?.isClaimed === true) continue;
        if (insightsRequiredSubs(drop)) continue;
        const required = insightsNumber(drop?.requiredMinutesWatched ?? drop?.requiredMinutes);
        const current = insightsNumber(drop?.self?.currentMinutesWatched ?? drop?.currentMinutes);
        if (required === null || required <= 0 || current === null || current < required) continue;
        items.push({
          name: insightsDropName(drop),
          game: insightsGameName(campaign),
          ended,
          endedAgoMs: ended ? now - endMs : 0,
          claimSoon: ended && now - endMs >= UNCLAIMED_CLAIM_SOON_MS,
        });
      }
    }
    // Longest since ending first: those are the ones closest to closing.
    return items.sort((a, b) => b.endedAgoMs - a.endedAgoMs || a.game.localeCompare(b.game));
  }

  function unclaimedRewardLine(item) {
    const when = item.ended ? `campaign ended ${insightsSpan(item.endedAgoMs / 60000)} ago` : "campaign still running";
    return `${item.name}${item.game ? ` · ${item.game}` : ""} · ${when}${item.claimSoon ? " · claim soon" : ""}`;
  }

  function refreshUnclaimedRewards(now = Date.now()) {
    try {
      if (!ui) return;
      const panel = ui.shadow.getElementById("tdh-unclaimed-panel");
      const list = ui.shadow.getElementById("tdh-unclaimed-list");
      const summary = ui.shadow.getElementById("tdh-unclaimed-summary");
      if (!panel || !list || !summary) return;
      const items = unclaimedRewards(mergeCampaigns(lastCampaignCatalog, lastInventoryCampaigns), now);
      panel.hidden = items.length === 0;
      summary.textContent = items.length ? String(items.length) : "";
      list.replaceChildren();
      for (const item of items.slice(0, 20)) {
        const row = document.createElement("div");
        row.className = "campaign-manager-note";
        row.textContent = unclaimedRewardLine(item);
        if (item.claimSoon) row.dataset.tone = "warn";
        list.appendChild(row);
      }
      if (items.length) {
        const help = document.createElement("div");
        help.className = "campaign-manager-note";
        help.textContent = "Open your Twitch Drops Inventory to claim. Twitch limits how long claiming stays open after a campaign ends.";
        list.appendChild(help);
      }
    } catch {
      // An insights problem must never affect the menu.
    }
  }

