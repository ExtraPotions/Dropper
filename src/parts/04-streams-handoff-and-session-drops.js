  function rankStreamCandidatesByEvidence(candidates, extraCompare = null) {
    const items = [...(candidates || [])];
    items.sort((left, right) => {
      const a = streamCandidateEvidence(left);
      const b = streamCandidateEvidence(right);
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (settings.queuePreference === 'Lowest Viewers') {
        const viewer = compareKnownViewerCounts(left, right, false);
        if (viewer) return viewer;
      }
      if (settings.queuePreference === 'Highest Viewers') {
        const viewer = compareKnownViewerCounts(left, right, true);
        if (viewer) return viewer;
      }
      if (extraCompare) {
        const extra = extraCompare(left, right);
        if (extra) return extra;
      }
      return 0;
    });
    return items.map(item => {
      const evidence = streamCandidateEvidence(item);
      return { ...item, evidenceRank: evidence.rank, evidenceLabel: evidence.label };
    });
  }
  function sortStreamCandidates(candidates, extraCompare = null) {
    const items = [...(candidates || [])];
    if (settings.queuePreference === "Any Eligible") {
      const tagged = items.filter((item) => item.dropsTagged);
      const rest = items.filter((item) => !item.dropsTagged);
      shuffleInPlace(tagged);
      shuffleInPlace(rest);
      return [...tagged, ...rest];
    }
    items.sort((left, right) => {
      if (Boolean(right.dropsTagged) !== Boolean(left.dropsTagged)) return Number(Boolean(right.dropsTagged)) - Number(Boolean(left.dropsTagged));
      if (settings.queuePreference === "Lowest Viewers") return compareKnownViewerCounts(left, right, false);
      if (settings.queuePreference === "Highest Viewers") return compareKnownViewerCounts(left, right, true);
      return extraCompare ? extraCompare(left, right) : 0;
    });
    return items;
  }

  function resetCategoryMismatch() {
    categoryMismatchSince = 0;
    categoryMismatchSignature = "";
  }

  function maybeRecoverCategoryMismatch() {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("category-mismatch-recovery");
      resetCategoryMismatch();
      return false;
    }
    if (!settings.findNextStream || !settings.queueOnCategoryChange || !currentDrop || dropProgressComplete(currentDrop)) {
      resetCategoryMismatch();
      return false;
    }

    const login = watchingLogin();
    if (!login) {
      resetCategoryMismatch();
      return false;
    }

    const pending = getHandoffState();
    const pendingState = normalizedHandoffState(pending);
    const handoffLocksGame = Boolean(
      pending?.targetGame &&
      [
        HANDOFF_STATES.FINDING_STREAM,
        HANDOFF_STATES.SWITCHING,
        HANDOFF_STATES.VERIFYING,
      ].includes(pendingState)
    );

    const info = readStreamInfo();
    const expectedGame = cleanText(handoffLocksGame ? pending.targetGame : currentDrop.game);
    const actualGame = cleanText(info.game);

    if (!info.live || !expectedGame || !actualGame || gameNamesMatch(expectedGame, actualGame)) {
      resetCategoryMismatch();
      return false;
    }

    const signature = `${login}|${normalizeGameName(expectedGame)}|${normalizeGameName(actualGame)}`;
    const now = Date.now();
    if (categoryMismatchSignature !== signature) {
      categoryMismatchSignature = signature;
      categoryMismatchSince = now;
      logActivity("category-mismatch", "Live channel changed away from active Drop game", {
        channel: login,
        expectedGame,
        actualGame,
        campaign: currentDrop.campaign || null,
      });
    }

    const age = now - categoryMismatchSince;
    if (age < CATEGORY_MISMATCH_GRACE_MS) {
      const secondsLeft = Math.max(1, Math.ceil((CATEGORY_MISMATCH_GRACE_MS - age) / 1000));
      setStatus(`Category Changed To ${actualGame} · Replacing Stream In ${secondsLeft}s`);
      return false;
    }

    if (handoffLocksGame) return true;

    transitionHandoff(
      HANDOFF_STATES.FINDING_STREAM,
      {
        completedGame: expectedGame,
        completedDrop: currentDrop.name || "Drop",
        completedDropId: currentDrop.id || "",
        targetGame: expectedGame,
        targetSlug: resolveCategorySlug(currentDrop),
        targetStream: "",
        targetCampaign: currentDrop.campaign || "",
        targetCampaignKey: currentDrop.campaignKey || "",
        recoveryReason: "category-mismatch",
        previousStream: login,
        previousStreamGame: actualGame,
        skippedGames: pending?.skippedGames || [],
        startedAt: pending?.startedAt || now,
      },
      `${login} changed from ${expectedGame} to ${actualGame} · finding replacement stream`,
    );

    logActivity("stream-recovery", "Finding replacement stream for active campaign", {
      previousChannel: login,
      expectedGame,
      actualGame,
      campaign: currentDrop.campaign || null,
    });

    setStatus(`Category Changed · Finding Another ${expectedGame} Drops Stream`);
    notifyUser(`Channel Changed Category · Finding Another ${expectedGame} Stream`);
    resetCategoryMismatch();

    transitionHandoff(
      HANDOFF_STATES.FINDING_STREAM,
      {
        discoveryMode: "homepage-search",
        homeSearchStage: "visit-home",
        failedStreams: [...new Set([...(pending?.failedStreams || []), login].filter(Boolean))],
      },
      `Returning to Twitch Home to replace ${login || "the changed channel"}`,
    );
    autoNavigateTwitch(TWITCH_HOME_URL, "campaign-home-search");
    return true;
  }

  function loadCategorySlugCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CATEGORY_SLUG_CACHE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      let changed = false;
      for (const [game, slug] of Object.entries(parsed)) {
        if (EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(game)) || EXCLUDED_CATEGORY_SLUGS.has(normalizedGameSlug(slug))) {
          delete parsed[game];
          changed = true;
        }
      }
      if (changed) localStorage.setItem(CATEGORY_SLUG_CACHE_KEY, JSON.stringify(parsed));
      return parsed;
    } catch (_) {
      return {};
    }
  }

  function saveCategorySlugCache() {
    try {
      localStorage.setItem(CATEGORY_SLUG_CACHE_KEY, JSON.stringify(categorySlugCache));
    } catch (_) {
      /* ignore */
    }
  }

  function categorySlugFromUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      const host = parsed.hostname.toLowerCase();
      if (
        parsed.protocol !== "https:" ||
        !(host === "twitch.tv" || host === "www.twitch.tv" || host.endsWith(".twitch.tv"))
      ) return "";
      const match = parsed.pathname.match(/^\/directory\/category\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : "";
    } catch (_) {
      return "";
    }
  }

  function expectedCategorySlugCandidates(gameName) {
    const gameKey = normalizeGameName(gameName);
    const candidates = new Set();
    const fallback = normalizedGameSlug(gameName);
    const alias = normalizedGameSlug(CATEGORY_SLUG_ALIASES[gameKey] || "");
    if (fallback) candidates.add(fallback);
    if (alias) candidates.add(alias);
    return candidates;
  }

  function categorySlugCoversGame(gameName, slug) {
    const normalized = normalizedGameSlug(slug);
    return Boolean(normalized && expectedCategorySlugCandidates(gameName).has(normalized));
  }

  function suppliedCategorySlugMatchesGame(gameName, slugOrUrl) {
    const slug = categorySlugFromUrl(slugOrUrl) || normalizedGameSlug(slugOrUrl);
    if (!slug) return false;
    if (categorySlugCoversGame(gameName, slug)) return true;
    const learned = categorySlugCache[normalizeGameName(gameName)];
    return Boolean(learned && learned === slug);
  }

  function campaignGameSlugFallback(dropOrGame) {
    if (!dropOrGame || typeof dropOrGame !== "object") return "";
    const gameId = cleanText(dropOrGame.gameId || dropOrGame.game?.id || "");
    const gameName = cleanText(
      typeof dropOrGame.game === "string"
        ? dropOrGame.game
        : dropOrGame.game?.displayName || dropOrGame.game?.name || ""
    );
    if (!gameId || !gameName || EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(gameName))) return "";
    const slug = normalizedGameSlug(gameName);
    return slug && !EXCLUDED_CATEGORY_SLUGS.has(slug) ? slug : "";
  }

  function rememberCategorySlug(gameName, slugOrUrl, source = "observed") {
    const gameKey = normalizeGameName(gameName);
    const slug = categorySlugFromUrl(slugOrUrl) || normalizedGameSlug(slugOrUrl);
    if (!gameKey || !slug) return "";
    if (EXCLUDED_CAMPAIGN_NAMES.has(gameKey) || EXCLUDED_CATEGORY_SLUGS.has(slug)) {
      if (categorySlugCache[gameKey]) {
        delete categorySlugCache[gameKey];
        saveCategorySlugCache();
      }
      logActivity("category-route-rejected", "Rejected excluded Twitch category", { game: gameName, slug, source });
      return "";
    }

    const trustedObservedSource = ["twitch-link", "active-stream", "canonical-alias", "twitch-gql"].includes(source);
    if (!trustedObservedSource && !suppliedCategorySlugMatchesGame(gameName, slug)) {
      logActivity("category-route-rejected", "Rejected mismatched category slug", {
        game: gameName,
        slug,
        source,
      });
      return "";
    }

    const existing = cleanText(categorySlugCache[gameKey] || "");
    if (
      existing &&
      source === "twitch-campaign-game-id" &&
      (existing === slug || existing.startsWith(`${slug}-`))
    ) {
      return existing;
    }

    if (categorySlugCache[gameKey] !== slug) {
      categorySlugCache[gameKey] = slug;
      saveCategorySlugCache();
      logActivity("category-route", `Learned category slug for ${gameName}`, {
        game: gameName,
        slug,
        source,
      });
    }
    return slug;
  }

  function findObservedCategorySlug(gameName) {
    const wanted = normalizeGameName(gameName);
    if (!wanted) return "";

    const links = [
      document.querySelector('[data-a-target="stream-game-link"]'),
      ...document.querySelectorAll('a[href*="/directory/category/"]'),
    ].filter(Boolean);

    for (const link of links) {
      const text = cleanText(
        link.textContent ||
        link.getAttribute?.("aria-label") ||
        link.getAttribute?.("title") ||
        "",
      );
      if (!text || !gameNamesMatch(gameName, text)) continue;

      const slug = categorySlugFromUrl(link.href);
      if (slug) return rememberCategorySlug(gameName, slug, "twitch-link");
    }
    return "";
  }

  function resolveCategorySlug(dropOrGame) {
    const gameName = typeof dropOrGame === "string"
      ? cleanText(dropOrGame)
      : cleanText(dropOrGame?.game || "");

    if (!gameName) return "";

    const gameKey = normalizeGameName(gameName);
    if (EXCLUDED_CAMPAIGN_NAMES.has(gameKey)) return "";

    // A campaign-supplied category takes precedence over links on the current
    // stream, which may belong to a different edition of the same game.
    const supplied = typeof dropOrGame === "object"
      ? cleanText(dropOrGame?.gameSlug || "")
      : "";
    if (supplied && suppliedCategorySlugMatchesGame(gameName, supplied)) {
      const resolved = normalizedGameSlug(supplied);
      if (resolved) rememberCategorySlug(gameName, resolved, "twitch-gql");
      return resolved;
    }

    const cached = normalizedGameSlug(categorySlugCache[gameKey] || "");
    if (cached && !EXCLUDED_CATEGORY_SLUGS.has(cached)) return cached;

    const observed = findObservedCategorySlug(gameName);
    if (observed) return observed;

    const alias = cleanText(CATEGORY_SLUG_ALIASES[gameKey] || "");
    if (alias) {
      rememberCategorySlug(gameName, alias, "canonical-alias");
      return normalizedGameSlug(alias);
    }

    if (supplied) {
      logActivity("category-route-rejected", "Ignored stale supplied category slug", {
        game: gameName,
        suppliedSlug: supplied,
      });
    }

    const gameIdFallback = campaignGameSlugFallback(dropOrGame);
    if (gameIdFallback) {
      rememberCategorySlug(gameName, gameIdFallback, "twitch-campaign-game-id");
      logActivity("category-route", "Derived category slug from Twitch campaign game ID", {
        game: gameName,
        gameId: dropOrGame?.gameId || dropOrGame?.game?.id || null,
        slug: gameIdFallback,
      });
      return gameIdFallback;
    }

    // Games whose Twitch slug is the name itself (Minecraft) should not wait
    // for a directory link. Keep alias-backed names like Delta Force on the
    // canonical slug instead of inventing a shorter route.
    const derived = normalizedGameSlug(gameName);
    if (derived && !alias && !EXCLUDED_CATEGORY_SLUGS.has(derived) && categorySlugCoversGame(gameName, derived)) {
      rememberCategorySlug(gameName, derived, "normalized-name");
      return derived;
    }

    logActivity("category-route-rejected", "No verified Twitch category slug available", { game: gameName });
    return "";
  }

  function gameDirectoryUrl(drop) {
    const slug = resolveCategorySlug(drop);
    if (!slug || EXCLUDED_CATEGORY_SLUGS.has(slug)) {
      logActivity("category-route", "Could not resolve Twitch category slug", {
        game: drop?.game || null,
        campaign: drop?.campaign || null,
      });
      return "";
    }
    return `https://www.twitch.tv/directory/category/${encodeURIComponent(slug)}`;
  }

  function twitchChannelHref(url) {
    if (!isTrustedTwitchUrl(url)) return "";
    try {
      const parsed = new URL(url, location.href);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length !== 1) return "";
      const login = parts[0].toLowerCase();
      if (!login || RESERVED.has(login)) return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  function streamLoginFromUrl(url) {
    const href = twitchChannelHref(url);
    if (!href) return "";
    try {
      return new URL(href).pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
    } catch (_) {
      return "";
    }
  }

  function currentDirectorySlug() {
    const match = location.pathname.match(/^\/directory\/category\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).toLowerCase() : "";
  }

  function normalizedGameSlug(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isTwitchSearchPage() {
    return location.hostname.toLowerCase() === "www.twitch.tv" && location.pathname.toLowerCase() === "/search";
  }

  function twitchSearchUrl(query) {
    const term = cleanText(query);
    return term ? `https://www.twitch.tv/search?term=${encodeURIComponent(term)}` : "";
  }

  function twitchSearchTerm() {
    try {
      return cleanText(new URL(location.href).searchParams.get("term"));
    } catch (_) {
      return "";
    }
  }

  function searchTermsMatch(left, right) {
    return cleanText(left).toLowerCase() === cleanText(right).toLowerCase();
  }

  // Campaign titles like "DF Streamer Ladder Drops" are not Twitch search terms.
  // Always try the original game name first.
  function firstStreamSearchQuery(pending) {
    return cleanText(pending?.targetGame) || cleanText(pending?.targetCampaign);
  }

  function firstStreamSearchUsesGame(pending) {
    return Boolean(cleanText(pending?.targetGame));
  }

  function setTwitchHomepageSearchQuery(query) {
    const input = document.querySelector(
      'input[data-a-target="tray-search-input"], input[data-a-target="nav-search-input"], input[placeholder*="Search" i]',
    );
    if (!input) return false;
    const value = cleanText(query);
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(input, value);
    input.focus();
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function closestSearchStreamCard(link) {
    if (!link) return null;
    const direct = link.closest(
      'article, [role="listitem"], li, [data-a-target="nav-search-item"], [data-a-target*="preview-card"], [data-a-target*="search-result"], [data-test-selector*="preview-card"], [data-test-selector*="search-result"], [class*="search-result"], [class*="preview-card"]',
    );
    if (direct) return direct;

    let node = link.parentElement;
    let best = node;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (node.matches?.('main, [role="main"]')) break;
      const channelLinks = node.querySelectorAll?.(
        'a[data-a-target="preview-card-channel-link"][href], a[data-test-selector*="channel-link"][href], a[data-a-target*="search-result"][href]',
      ) || [];
      const hasCategory = Boolean(node.querySelector?.('a[href*="/directory/category/"], a[href*="/directory/game/"]'));
      const text = cleanText(node.textContent || "");
      const hasLiveSignal = Boolean(
        node.querySelector?.('[data-a-target*="live"], [data-test-selector*="live"], [aria-label*="Live" i]') ||
        /\bLIVE\b/i.test(text) ||
        /[\d,.]+\s*(?:viewers?|watching)\b/i.test(text)
      );
      if (channelLinks.length === 1 && (hasCategory || hasLiveSignal)) best = node;
    }
    return best || link.parentElement;
  }

  function searchResultCategorySlug(card) {
    const categoryLink = card?.querySelector?.('a[href*="/directory/category/"], a[href*="/directory/game/"]');
    if (!categoryLink) return "";
    const fromCategory = categorySlugFromUrl(categoryLink.href);
    if (fromCategory) return fromCategory;
    try {
      const parsed = new URL(categoryLink.href, location.href);
      const match = parsed.pathname.match(/^\/directory\/game\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : "";
    } catch (_) {
      return "";
    }
  }

  function collectHomepageSearchStreamCandidates(pending) {
    const excluded = new Set(
      (pending?.failedStreams || []).map((login) => cleanText(login).toLowerCase()).filter(Boolean),
    );
    const candidates = [];
    const seen = new Set();
    const links = new Set();
    const searchRoots = [
      ...document.querySelectorAll(
        '[data-a-target="nav-search-tray"], [data-a-target*="search-results"], [data-test-selector*="search-results"]',
      ),
    ];
    if (isTwitchSearchPage()) {
      document.querySelectorAll('main, [role="main"]').forEach((root) => searchRoots.push(root));
    }
    for (const root of searchRoots) {
      for (const link of root.querySelectorAll('a[href]')) links.add(link);
    }
    for (const link of document.querySelectorAll(
      'a[data-a-target*="search-result"][href], [data-a-target="nav-search-item"] a[href], a[data-test-selector*="search-result"][href], a[data-a-target="preview-card-channel-link"][href], a[data-test-selector*="channel-link"][href]',
    )) links.add(link);

    const wantedGame = cleanText(pending?.targetGame || "");
    const targetSlug = wantedGame
      ? resolveCategorySlug({ game: wantedGame, gameSlug: pending?.targetSlug || currentDrop?.gameSlug || "" })
      : "";
    const searchTermMatchesTarget = Boolean(
      isTwitchSearchPage() && wantedGame && searchTermsMatch(twitchSearchTerm(), wantedGame)
    );

    for (const link of links) {
      if (
        !link.closest('[data-a-target="nav-search-tray"]') &&
        link.closest('aside, [data-a-target="side-nav-bar"], [data-test-selector*="side-nav"]')
      ) continue;
      const href = twitchChannelHref(link.href);
      if (!href) continue;
      const login = streamLoginFromUrl(href);
      if (!login || excluded.has(login) || seen.has(login)) continue;

      const previewChannelLink = Boolean(link.matches?.(
        'a[data-a-target="preview-card-channel-link"][href], a[data-test-selector*="channel-link"][href]',
      ));
      const card = closestSearchStreamCard(link);
      if (streamCandidateIsPromoted(card, link)) continue;
      const text = cleanText(card?.textContent);
      const aria = cleanText(`${link.getAttribute("aria-label") || ""} ${card?.getAttribute?.("aria-label") || ""}`);
      const active = Boolean(
        previewChannelLink ||
        card?.querySelector?.('[data-a-target*="live"], [data-test-selector*="live"], [aria-label*="Live" i]') ||
        /\blive\s+channel\b/i.test(aria) ||
        /\bLIVE\b/i.test(text) ||
        /[\d,.]+\s*(?:viewers?|watching)\b/i.test(text)
      );
      if (!active) continue;

      const cardGame = extractCardGameName(card, text, aria);
      const cardSlug = searchResultCategorySlug(card);
      const categoryMatches = Boolean(
        wantedGame &&
        cardSlug &&
        (
          (targetSlug && (cardSlug === targetSlug || cardSlug.startsWith(`${targetSlug}-`) || targetSlug.startsWith(`${cardSlug}-`))) ||
          categorySlugCoversGame(wantedGame, cardSlug)
        )
      );
      if (wantedGame && cardGame && !gameNamesMatch(wantedGame, cardGame) && !categoryMatches) continue;
      if (wantedGame && !cardGame && !categoryMatches && !(previewChannelLink && searchTermMatchesTarget)) continue;

      seen.add(login);
      const viewerMatch = text.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
      const hasDropsTag = streamHasDropsEnabledTag(card);
      candidates.push({
        href,
        login,
        viewers: viewerMatch ? streamViewerCount(viewerMatch[1].replace(/,/g, "")) : null,
        dropsTagged: hasDropsTag,
        game: cardGame || (wantedGame && (categoryMatches || searchTermMatchesTarget) ? wantedGame : ""),
        gameSlug: cardSlug || targetSlug || "",
        campaignKey: cleanText(pending?.targetCampaignKey || ""),
        source: previewChannelLink ? "search-preview" : "search-result",
      });
    }

    const ranked = sortStreamCandidates(candidates);
    rememberStandbyCandidates(ranked);
    return ranked;
  }

  function continueHomepageCampaignHandoffFromDom() {
    let pending = getHandoffState();
    if (
      !pending ||
      normalizedHandoffState(pending) !== HANDOFF_STATES.FINDING_STREAM ||
      pending.discoveryMode !== "homepage-search"
    ) return false;

    if (isTwitchHomepage()) {
      const gameQuery = cleanText(pending.targetGame);
      const searchQuery = firstStreamSearchQuery(pending);
      if (!searchQuery) return false;
      const usingGame = firstStreamSearchUsesGame(pending);

      if (pending.homeSearchStage === "visit-home") {
        const trayStarted = setTwitchHomepageSearchQuery(searchQuery);
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            homeSearchStage: trayStarted
              ? (usingGame ? "game-home-results" : "campaign-home-results")
              : (usingGame ? "game-results" : "campaign-results"),
            homepageVisitedAt: pending.homepageVisitedAt || Date.now(),
            searchQuery,
            searchStartedAt: Date.now(),
          },
          usingGame
            ? `Twitch Home opened · searching for ${searchQuery}`
            : `Twitch Home opened · searching for campaign ${searchQuery}`,
        );
        setStatus(`Searching Twitch For ${searchQuery}`);
        if (!trayStarted) {
          autoNavigateTwitch(
            twitchSearchUrl(searchQuery),
            usingGame ? "campaign-game-search" : "campaign-name-search",
          );
        }
        return true;
      }

      const homeCandidates = collectHomepageSearchStreamCandidates(pending);
      const homeChosen = pickAutomaticStreamCandidate(homeCandidates, pending);
      if (homeChosen) {
        transitionHandoff(
          HANDOFF_STATES.SWITCHING,
          {
            targetStream: homeChosen.login,
            switchStartedAt: Date.now(),
            verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
            verifyBaselinePercent: Number(currentDrop?.percent || 0),
            failedStreams: pending.failedStreams || [],
          },
          `Selected active homepage search stream ${homeChosen.login}`,
        );
        lastStreamSwitch = Date.now();
        setStatus(`Opening Active ${pending.targetGame || "Drops"} Stream`);
        autoNavigateTwitch(homeChosen.href, "campaign-stream-search");
        return true;
      }

      const homeSearchStartedAt = Number(pending.searchStartedAt || pending.stateStartedAt || Date.now());
      const homeSearchAge = Date.now() - homeSearchStartedAt;
      if (pending.homeSearchStage === "campaign-home-results" && gameQuery && homeSearchAge >= HOME_CAMPAIGN_SEARCH_WAIT_MS) {
        setTwitchHomepageSearchQuery(gameQuery);
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            homeSearchStage: "game-home-results",
            searchQuery: gameQuery,
            searchStartedAt: Date.now(),
          },
          `No live campaign-name result · searching Twitch Home for ${gameQuery}`,
        );
        setStatus(`Searching Active ${gameQuery} Streams`);
        return true;
      }

      if (pending.homeSearchStage === "game-home-results" && homeSearchAge >= HOME_GAME_SEARCH_WAIT_MS) {
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            homeSearchStage: "game-results",
            searchQuery: gameQuery,
            searchStartedAt: Date.now(),
          },
          `Homepage tray had no live result · opening full ${gameQuery} search`,
        );
        autoNavigateTwitch(twitchSearchUrl(gameQuery), "campaign-game-search");
        return true;
      }

      setStatus(`Searching Twitch Home For An Active ${pending.targetGame || "Campaign"} Stream`);
      return false;
    }

    if (!isTwitchSearchPage()) {
      setStatus("Opening Twitch Home Before Campaign Search");
      autoNavigateTwitch(TWITCH_HOME_URL, "campaign-home-search");
      return true;
    }

    const wantedQuery = firstStreamSearchQuery(pending);
    const usingGame = firstStreamSearchUsesGame(pending);
    const pageTerm = twitchSearchTerm();
    const searchStage = cleanText(pending.homeSearchStage);
    const homeLikeStage = !searchStage || searchStage === "visit-home" || searchStage.endsWith("-home-results");

    if (wantedQuery && !searchTermsMatch(pageTerm, wantedQuery)) {
      transitionHandoff(
        HANDOFF_STATES.FINDING_STREAM,
        {
          homeSearchStage: usingGame ? "game-results" : "campaign-results",
          searchQuery: wantedQuery,
          searchStartedAt: Date.now(),
        },
        `Search was for ${pageTerm || "a different term"} · searching ${wantedQuery}`,
      );
      setStatus(`Searching Twitch For ${wantedQuery}`);
      autoNavigateTwitch(
        twitchSearchUrl(wantedQuery),
        usingGame ? "campaign-game-search" : "campaign-name-search",
      );
      return true;
    }

    if (homeLikeStage) {
      pending = transitionHandoff(
        HANDOFF_STATES.FINDING_STREAM,
        {
          homeSearchStage: usingGame ? "game-results" : "campaign-results",
          searchQuery: wantedQuery || pageTerm,
          searchStartedAt: pending.searchStartedAt || Date.now(),
        },
        usingGame
          ? `Full ${wantedQuery || pending.targetGame || "game"} search is open`
          : `Full campaign search is open`,
      ) || pending;
    }

    const candidates = collectHomepageSearchStreamCandidates(pending);
    const chosen = pickAutomaticStreamCandidate(candidates, pending);
    if (chosen) {
      transitionHandoff(
        HANDOFF_STATES.SWITCHING,
        {
          targetStream: chosen.login,
          switchStartedAt: Date.now(),
          verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
          verifyBaselinePercent: Number(currentDrop?.percent || 0),
          failedStreams: pending.failedStreams || [],
        },
        `Found active stream ${chosen.login} for ${pending.targetCampaign || pending.targetGame}`,
      );
      lastStreamSwitch = Date.now();
      setStatus(`Opening Active ${pending.targetGame || "Drops"} Stream`);
      autoNavigateTwitch(chosen.href, "campaign-stream-search");
      return true;
    }

    const searchStartedAt = Number(pending.searchStartedAt || pending.stateStartedAt || Date.now());
    const searchAge = Date.now() - searchStartedAt;
    const gameQuery = cleanText(pending.targetGame);
    if (pending.homeSearchStage === "campaign-results" && gameQuery && searchAge >= HOME_CAMPAIGN_SEARCH_WAIT_MS) {
      transitionHandoff(
        HANDOFF_STATES.FINDING_STREAM,
        {
          homeSearchStage: "game-results",
          searchQuery: gameQuery,
          searchStartedAt: Date.now(),
        },
        `No active campaign-name result · searching active streams for ${gameQuery}`,
      );
      setStatus(`Searching Active ${gameQuery} Streams`);
      autoNavigateTwitch(twitchSearchUrl(gameQuery), "campaign-game-search");
      return true;
    }

    if (pending.homeSearchStage === "game-results" && searchAge >= FULL_SEARCH_WAIT_MS) {
      const directorySlug = resolveCategorySlug({
        game: gameQuery || pending.targetGame || "",
        gameSlug: pending.targetSlug || currentDrop?.gameSlug || "",
      });
      const directoryUrl = directorySlug
        ? `https://www.twitch.tv/directory/category/${encodeURIComponent(directorySlug)}`
        : "";
      if (directoryUrl) {
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            discoveryMode: "directory",
            homeSearchStage: "directory-fallback",
            targetSlug: directorySlug,
            targetStream: "",
            searchStartedAt: 0,
            directoryStartedAt: Date.now(),
            retryCount: Number(pending.retryCount || 0) + 1,
          },
          `No compatible Twitch search result for ${pending.targetCampaign || pending.targetGame} · trying the ${gameQuery || pending.targetGame} category directory`,
        );
        setStatus(`Searching ${gameQuery || pending.targetGame || "Game"} Category For Drops Streams`);
        autoNavigateTwitch(directoryUrl, "campaign-directory-fallback");
        return true;
      }

      if (pending.lockActiveCampaign) {
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            homeSearchStage: "game-results",
            searchQuery: gameQuery || pending.searchQuery || "",
            searchStartedAt: Date.now(),
            retryCount: Number(pending.retryCount || 0) + 1,
          },
          `No compatible stream visible for ${pending.targetCampaign || pending.targetGame} · waiting before retrying`,
        );
        setStatus(`Waiting For A Compatible ${pending.targetGame || "Drops"} Stream`);
        queueGqlPollSoon("locked-campaign-search-wait", GQL_RECOVERY_INTERVAL_MS);
        return true;
      }

      const excludedCampaignKeys = normalizeExcludedCampaignKeys([
        ...(pending.excludedCampaignKeys || []),
        pending.targetCampaignKey,
      ]);
      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        {
          auditStage: "campaigns",
          targetGame: "",
          targetStream: "",
          excludedCampaignKeys,
          forceOpenCampaign: true,
        },
        `No active stream found for ${pending.targetCampaign || pending.targetGame} · selecting next open campaign`,
      );
      setStatus("No Active Stream Found · Selecting Next Open Campaign");
      autoNavigateTwitch(CAMPAIGNS_URL, "campaign-restart");
      return true;
    }

    setStatus(`Searching For An Active ${pending.targetGame || "Campaign"} Stream`);
    return false;
  }

  function closestDirectoryStreamCard(link) {
    if (!link) return null;

    const direct = link.closest(
      'article, [role="listitem"], li, [data-a-target*="preview-card"], [data-test-selector*="preview-card"], [class*="preview-card"]',
    );
    if (direct && streamHasDropsEnabledTag(direct)) return direct;

    let node = link.parentElement;
    let best = direct || node;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      if (node.matches?.('main, [role="main"]')) break;

      const channelLinks = node.querySelectorAll?.(
        'a[data-a-target="preview-card-channel-link"][href], a[data-test-selector*="channel-link"][href]',
      ) || [];
      if (channelLinks.length !== 1) continue;

      const hasCategory = Boolean(node.querySelector?.(
        'a[href*="/directory/category/"], a[href*="/directory/game/"]',
      ));
      const text = cleanText(node.textContent || "");
      const hasLiveSignal = Boolean(
        node.querySelector?.('[data-a-target*="live"], [data-test-selector*="live"], [aria-label*="Live" i]') ||
        /\bLIVE\b/i.test(text) ||
        /[\d,.]+\s*(?:viewers?|watching)\b/i.test(text)
      );
      const hasDropsSignal = streamHasDropsEnabledTag(node);

      if (hasCategory || hasLiveSignal || hasDropsSignal) best = node;
      if (hasDropsSignal && hasLiveSignal) return node;
    }
    return best || link.parentElement;
  }

  function streamCandidateIsPromoted(card, link = null) {
    const promotedSelector = [
      '.side-nav-card__link--promoted-followed',
      '[data-a-target*="promoted" i]',
      '[data-a-target*="sponsored" i]',
      '[data-a-target*="advertisement" i]',
      '[data-test-selector*="promoted" i]',
      '[data-test-selector*="sponsored" i]',
      '[data-test-selector*="advertisement" i]',
      '[class*="promoted" i]',
      '[class*="sponsored" i]',
      '[class*="advertisement" i]',
    ].join(",");

    if (link?.matches?.(promotedSelector) || link?.closest?.(promotedSelector)) return true;
    if (card?.matches?.(promotedSelector) || card?.querySelector?.(promotedSelector)) return true;

    const badgeNodes = card?.querySelectorAll?.(
      '[aria-label], [title], [data-a-target], [data-test-selector], span, p, div'
    ) || [];
    for (const node of badgeNodes) {
      if (node.children?.length) continue;
      const label = cleanText(
        node.getAttribute?.("aria-label") ||
        node.getAttribute?.("title") ||
        node.textContent ||
        ""
      );
      if (/^(?:sponsored|promoted|advertisement|ad)$/i.test(label)) return true;
    }
    return false;
  }

  function collectDirectoryStreamCandidates(gameName, gameSlug = "", excludedStreams = []) {
    const wantedGame = normalizeGameName(gameName);
    const wantedSlug = resolveCategorySlug({ game: gameName, gameSlug });
    const pageSlug = currentDirectorySlug();
    const pageIsTargetCategory = Boolean(
      isDirectoryCategoryPage() &&
      wantedSlug &&
      (pageSlug === wantedSlug || pageSlug.includes(wantedSlug) || wantedSlug.includes(pageSlug))
    );
    const excluded = new Set(
      (excludedStreams || []).map((login) => cleanText(login).toLowerCase()).filter(Boolean),
    );
    const candidates = [];
    const seen = new Set();
    const scanAt = Date.now();

    const links = [
      ...document.querySelectorAll(
        'a[data-a-target="preview-card-channel-link"], a[data-test-selector*="channel-link"]',
      ),
    ];

    for (const link of links) {
      const href = twitchChannelHref(link.href);
      if (!href) continue;
      const login = streamLoginFromUrl(href);
      if (!login || excluded.has(login) || seen.has(login)) continue;
      seen.add(login);

      const card = closestDirectoryStreamCard(link);

      if (streamCandidateIsPromoted(card, link)) {
        logActivity("stream-candidate-rejected", "Ignored promoted or sponsored Twitch placement", {
          stream: login,
          game: gameName || null,
          source: "category",
        });
        continue;
      }

      const text = cleanText(card?.textContent);
      const normalizedText = normalizeGameName(text);
      const hasDropsTag = streamHasDropsEnabledTag(card);

      const gameMatches =
        pageIsTargetCategory ||
        !wantedGame ||
        !normalizedText ||
        normalizedText.includes(wantedGame);

      if (!gameMatches) continue;
      const viewerMatch = text.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
      const viewers = viewerMatch ? streamViewerCount(viewerMatch[1].replace(/,/g, "")) : null;
      candidates.push({
        login,
        href,
        label: login,
        viewers,
        dropsTagged: hasDropsTag,
        game: gameName,
        gameSlug: wantedSlug,
        seenAt: scanAt,
        visibleInCategory: true,
      });
    }

    const ranked = sortStreamCandidates(candidates);
    const pending = getHandoffState();
    rememberStandbyCandidates(ranked, {
      game: gameName,
      gameSlug: wantedSlug,
      campaignKey: pending?.targetCampaignKey || currentDrop?.campaignKey || "",
    });

    return ranked;
  }

  function classifyRoutingCandidates(gameName, gameSlug = "", session = readRoutingControllerSession(), now = Date.now()) {
    const targetGame = cleanText(gameName || session?.targetGame || currentDrop?.game || "");
    const targetSlug = resolveCategorySlug({
      game: targetGame,
      gameSlug: gameSlug || session?.targetSlug || currentDrop?.gameSlug || "",
    });
    const allCandidates = sortStreamCandidates(
      collectDirectoryStreamCandidates(targetGame, targetSlug, []),
    );
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const skipped = routingControllerFailedSet(session);
    const allowListPresent = allowedChannels.length > 0;

    const visible = rankStreamCandidatesByEvidence(allCandidates.map((item) => {
      const login = cleanText(item.login).toLowerCase();
      const allowListMatch = Boolean(login && allowedLogins.has(login));
      const dropsTagged = item.dropsTagged === true;
      const temporarilySkipped = Boolean(login && skipped.has(login));
      const campaignCompatible = !allowListPresent || allowListMatch || dropsTagged;
      const routable = Boolean(!temporarilySkipped && campaignCompatible);

      let reason = "same-game-probationary";
      if (temporarilySkipped) reason = "temporary-skip";
      else if (allowListMatch) reason = "campaign-allow-list-match";
      else if (allowListPresent && dropsTagged) reason = "drops-tagged-verification-fallback";
      else if (allowListPresent) reason = "campaign-allow-list-mismatch";
      else if (dropsTagged) reason = "drops-tagged";

      return {
        ...item,
        login,
        seenAt: Number(item.seenAt || now),
        visibleInCategory: true,
        allowListMatch,
        dropsTagged,
        temporarilySkipped,
        campaignCompatible,
        routable,
        reason,
      };
    }));

    lastRoutingCandidateSnapshot = {
      at: now,
      game: targetGame,
      gameSlug: targetSlug,
      campaignKey: cleanText(session?.targetCampaignKey || currentDrop?.campaignKey || ""),
      allowListPresent,
      visible: visible.map((item) => ({
        login: item.login,
        viewers: streamViewerCount(item.viewers),
        dropsTagged: item.dropsTagged,
        allowListMatch: item.allowListMatch,
        temporarilySkipped: item.temporarilySkipped,
        routable: item.routable,
        reason: item.reason,
        evidenceRank: item.evidenceRank,
        evidenceLabel: item.evidenceLabel,
        seenAt: item.seenAt,
      })),
    };

    return {
      targetGame,
      targetSlug,
      allowedChannels,
      allowedLogins,
      skipped,
      allowListPresent,
      visibleCandidates: visible,
      routableCandidates: visible.filter((item) => item.campaignCompatible),
      candidates: visible.filter((item) => item.routable),
    };
  }

  function routingCandidateDiagnosticsSnapshot(now = Date.now()) {
    const routing = readRoutingControllerSession();
    const targetGame = cleanText(routing.targetGame || currentDrop?.game || "");
    const targetCampaignKey = cleanText(routing.targetCampaignKey || currentDrop?.campaignKey || "");
    const targetSlug = resolveCategorySlug({
      game: targetGame,
      gameSlug: routing.targetSlug || currentDrop?.gameSlug || "",
    });
    const onTargetCategory = Boolean(
      targetSlug &&
      isDirectoryCategoryPage() &&
      currentDirectorySlug() === targetSlug
    );

    if (
      onTargetCategory &&
      (
        !lastRoutingCandidateSnapshot.at ||
        now - Number(lastRoutingCandidateSnapshot.at) > HEARTBEAT_INTERVAL_MS ||
        lastRoutingCandidateSnapshot.gameSlug !== targetSlug
      )
    ) {
      classifyRoutingCandidates(targetGame, targetSlug, routing, now);
    }

    const activeAllowedChannels = activeCampaignAllowedChannels();
    const activeAllowedLogins = new Set(
      activeAllowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const allowListPresent = activeAllowedLogins.size > 0;
    const failed = routingControllerFailedSet(routing);
    const live = Array.isArray(lastRoutingCandidateSnapshot.visible)
      ? lastRoutingCandidateSnapshot.visible
      : [];
    const liveLogins = new Set(live.map((item) => cleanText(item.login).toLowerCase()).filter(Boolean));
    const wantedGame = normalizeGameName(targetGame);

    const cached = pruneStandbyCache(now)
      .filter((item) => {
        const login = cleanText(item?.login).toLowerCase();
        if (!login || liveLogins.has(login)) return false;
        if (wantedGame && (!item.game || !gameNamesMatch(wantedGame, item.game))) return false;
        if (targetCampaignKey && item.campaignKey !== targetCampaignKey) return false;
        if (allowListPresent && !activeAllowedLogins.has(login) && item.dropsTagged !== true) return false;
        return true;
      })
      .map((item) => {
        const login = cleanText(item.login).toLowerCase();
        const ageSeconds = Math.max(0, Math.floor((now - Number(item.seenAt || now)) / 1000));
        const temporarilySkipped = failed.has(login);
        const freshCached = ageSeconds * 1000 <= STANDBY_LIVE_FRESH_MS;
        const allowListMatch = allowListPresent ? activeAllowedLogins.has(login) : Boolean(item.allowListMatch);
        return {
          login,
          viewers: streamViewerCount(item.viewers),
          dropsTagged: Boolean(item.dropsTagged),
          allowListMatch,
          seenAt: item.seenAt ? new Date(item.seenAt).toISOString() : null,
          ageSeconds,
          freshCached,
          temporarilySkipped,
          routableNow: false,
          reason: temporarilySkipped
            ? "temporary-skip"
            : freshCached
              ? "recent-cache-not-live-proof"
              : "cached-not-currently-visible",
        };
      })
      .slice(0, 30);

    return {
      liveFreshSeconds: Math.round(STANDBY_LIVE_FRESH_MS / 1000),
      lastLiveScanAt: lastRoutingCandidateSnapshot.at
        ? new Date(lastRoutingCandidateSnapshot.at).toISOString()
        : null,
      targetGame: targetGame || null,
      targetCampaignKey: targetCampaignKey || null,
      onTargetCategory,
      allowListPresent,
      allowListSource: allowListPresent ? "active-campaign" : "none",
      allowedChannelCount: activeAllowedChannels.length,
      visible: live.map((item) => {
        const login = cleanText(item.login).toLowerCase();
        const allowListMatch = allowListPresent
          ? activeAllowedLogins.has(login)
          : Boolean(item.allowListMatch);
        const temporarilySkipped = Boolean(item.temporarilySkipped);
        const dropsTagged = item.dropsTagged === true;
        const routable = Boolean(
          !temporarilySkipped &&
          (!allowListPresent || allowListMatch || dropsTagged)
        );
        return {
          login: item.login,
          viewers: item.viewers,
          dropsTagged: Boolean(item.dropsTagged),
          allowListMatch,
          temporarilySkipped,
          routable,
          reason: temporarilySkipped
            ? "temporary-skip"
            : allowListMatch
              ? "campaign-allow-list-match"
              : allowListPresent && dropsTagged
                ? "drops-tagged-verification-fallback"
                : allowListPresent
                  ? "campaign-allow-list-mismatch"
                  : item.reason || null,
          evidenceRank: item.evidenceRank ?? streamCandidateEvidence({ ...item, allowListMatch, availability: 'live' }).rank,
          evidenceLabel: item.evidenceLabel || streamCandidateEvidence({ ...item, allowListMatch, availability: 'live' }).label,
          seenAt: item.seenAt ? new Date(item.seenAt).toISOString() : null,
        };
      }),
      cached,
    };
  }

  function streamCandidateHasDropsProof(candidate) {
    return Boolean(candidate?.dropsTagged === true);
  }

  function pickAutomaticStreamCandidate(candidates, pending = getHandoffState()) {
    const pool = Array.isArray(candidates) ? candidates : [];
    if (!pool.length) return null;
    if (pending?.lockActiveCampaign) {
      return pool.find(streamCandidateHasDropsProof) || null;
    }
    return pool[0] || null;
  }

  function findEligibleDirectoryStream(gameName, gameSlug = "", excludedStreams = []) {
    const candidates = collectDirectoryStreamCandidates(gameName, gameSlug, excludedStreams);
    const chosen = pickAutomaticStreamCandidate(candidates);
    return chosen?.href || "";
  }

  function campaignMatchesTarget(campaign, pending) {
    if (!campaign || !pending) return false;
    const targetKey = String(pending.targetCampaignKey || "");
    const targetName = normalizeGameName(pending.targetCampaign || "");
    const targetGame = normalizeGameName(pending.targetGame || "");

    if (targetKey && campaignKey(campaign) === targetKey) return true;
    if (targetKey && String(campaign.id || "") === targetKey) return true;

    const campaignName = normalizeGameName(campaign.name || "");
    const campaignGame = normalizeGameName(campaign.game?.displayName || campaign.game?.name || "");
    return Boolean(
      targetName &&
      campaignName === targetName &&
      (!targetGame || !campaignGame || gameNamesMatch(targetGame, campaignGame))
    );
  }

  function campaignAllowedChannels(campaign) {
    const allow = campaign?.allow;
    if (!allow || allow.isEnabled === false || !Array.isArray(allow.channels)) return [];
    const seen = new Set();
    const channels = [];
    for (const channel of allow.channels) {
      const login = cleanText(channel?.login || channel?.name || "").toLowerCase();
      if (!login || seen.has(login)) continue;
      seen.add(login);
      channels.push({
        id: cleanText(channel?.id || ""),
        login,
        displayName: cleanText(channel?.displayName || channel?.name || login),
      });
    }
    return channels;
  }

  function activeCampaignAllowedChannels() {
    if (!currentDrop || !campaignIsRoutingOpen(currentDrop)) return [];
    const campaign = findCampaignForDrop(routingCampaignPool(), currentDrop);
    if (!campaign || !campaignIsRoutingOpen(campaign)) return [];
    return campaignAllowedChannels(campaign);
  }

  function channelSupportsTargetCampaign(availableCampaigns, pending, now = Date.now()) {
    if (!pending || !currentDrop || !campaignIsRoutingOpen(currentDrop, now)) return null;
    if (!Array.isArray(availableCampaigns) || !availableCampaigns.length) return null;
    return availableCampaigns.some((campaign) => (
      campaignIsRoutingOpen(campaign, now) &&
      campaignMatchesTarget(campaign, pending)
    ));
  }
  function retryLockedCampaignStream(pending, reason) {
    if (!pending?.targetGame) return false;
    const failedStreams = [...new Set([
      ...(pending.failedStreams || []),
      pending.targetStream,
    ].filter(Boolean))];
    const failedSet = new Set(failedStreams.map((login) => cleanText(login).toLowerCase()));
    const targetCampaignKey = cleanText(pending.targetCampaignKey || currentDrop?.campaignKey || "");
    const cached = sortStreamCandidates(
      pruneStandbyCache().filter((item) => {
        const login = cleanText(item?.login).toLowerCase();
        if (!login || failedSet.has(login)) return false;
        if (pending.targetGame && (!item.game || !gameNamesMatch(pending.targetGame, item.game))) return false;
        if (targetCampaignKey && item.campaignKey && item.campaignKey !== targetCampaignKey) return false;
        return true;
      }),
      (left, right) => Number(right.seenAt || 0) - Number(left.seenAt || 0),
    );
    const cachedNext = pickAutomaticStreamCandidate(cached, pending);

    if (cachedNext?.href && cachedNext.login) {
      transitionHandoff(
        HANDOFF_STATES.SWITCHING,
        {
          targetStream: cachedNext.login,
          failedStreams,
          switchStartedAt: Date.now(),
          verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
          verifyBaselinePercent: Number(currentDrop?.percent || 0),
        },
        reason || `Trying cached ${pending.targetGame} Drops stream ${cachedNext.login}`,
      );
      lastStreamSwitch = Date.now();
      setStatus(`Opening Backup ${pending.targetGame} Drops Stream`);
      logActivity("stream-retry", "Trying cached stream candidate before restarting Twitch search", {
        stream: cachedNext.login,
        game: pending.targetGame,
        failedStreams,
      });
      autoNavigateTwitch(cachedNext.href, "campaign-stream-retry");
      return true;
    }

    const targetSlug = pending.targetSlug || resolveCategorySlug({ game: pending.targetGame });
    const directoryUrl = targetSlug
      ? `https://www.twitch.tv/directory/category/${encodeURIComponent(targetSlug)}`
      : "";

    transitionHandoff(
      HANDOFF_STATES.FINDING_STREAM,
      {
        targetGame: pending.targetGame,
        targetSlug,
        targetStream: "",
        targetCampaign: pending.targetCampaign || currentDrop?.campaign || "",
        targetCampaignKey: targetCampaignKey,
        failedStreams,
        lockActiveCampaign: true,
        discoveryMode: directoryUrl ? "directory" : "homepage-search",
        homeSearchStage: directoryUrl ? "directory-fallback" : "visit-home",
        searchQuery: "",
        searchStartedAt: 0,
        directoryStartedAt: directoryUrl ? Date.now() : Number(pending.directoryStartedAt || 0),
        recoveryReason: pending.recoveryReason || "active-campaign",
      },
      reason || `Trying another ${pending.targetGame} Drops stream`,
    );

    if (directoryUrl) {
      if (!isDirectoryCategoryPage() || currentDirectorySlug() !== targetSlug) {
        autoNavigateTwitch(directoryUrl, "campaign-directory-fallback");
      } else {
        continueDirectoryHandoffFromDom();
      }
      return true;
    }

    if (!isTwitchHomepage()) autoNavigateTwitch(TWITCH_HOME_URL, "campaign-home-search");
    return true;
  }

  function continueDirectoryHandoffFromDom() {
    const pending = getHandoffState();
    if (!pending || normalizedHandoffState(pending) !== HANDOFF_STATES.FINDING_STREAM || !isDirectoryCategoryPage()) return false;

    const stateStartedAt = Number(pending.stateStartedAt || pending.stageStartedAt || pending.startedAt || Date.now());
    const stageAge = Date.now() - stateStartedAt;
    if (stageAge > HANDOFF_STAGE_TIMEOUT_MS) {
      if (pending.lockActiveCampaign) {
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            failedStreams: pending.failedStreams || [],
            retryCount: Number(pending.retryCount || 0) + 1,
          },
          `Still searching for ${pending.targetGame || "active campaign"} streams · waiting for new category candidates`,
        );
        setStatus(`Waiting For A Compatible ${pending.targetGame || "Drops"} Stream`);
        queueGqlPollSoon("active-stream-search", GQL_RECOVERY_INTERVAL_MS);
        return false;
      }

      const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        {
          targetGame: "",
          targetSlug: "",
          targetStream: "",
          skippedGames,
        },
        `No Drops stream found for ${pending.targetGame || "target game"} · selecting another game`,
      );
      setStatus(`No Drops Stream Found For ${pending.targetGame || "Target Game"} · Trying Next Game`);
      notifyUser(`Skipping ${pending.targetGame || "Unavailable Game"} · Trying Next Eligible Game`);
      autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
      return true;
    }

    const href = findEligibleDirectoryStream(
      pending.targetGame || "",
      pending.targetSlug || "",
      pending.failedStreams || [],
    );
    if (!href) {
      const secondsLeft = Math.max(0, Math.ceil((HANDOFF_STAGE_TIMEOUT_MS - stageAge) / 1000));
      setStatus(`Finding A Drops Stream For ${pending.targetGame || "Next Game"} · ${secondsLeft}s`);
      return false;
    }

    const targetStream = streamLoginFromUrl(href);
    transitionHandoff(
      HANDOFF_STATES.SWITCHING,
      {
        targetStream,
        switchStartedAt: Date.now(),
        verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
        verifyBaselinePercent: Number(currentDrop?.percent || 0),
        failedStreams: pending.failedStreams || [],
      },
      `Trying stream ${targetStream || "channel"} for ${pending.targetGame || "next game"}`,
    );
    lastStreamSwitch = Date.now();
    setStatus(`Opening ${pending.targetGame || "Next Game"} Drops Stream`);
    notifyUser(`Moving To ${pending.targetGame || "Next Game"}`);
    autoNavigateTwitch(href, "automatic-routing");
    return true;
  }

  function watchDirectoryHandoff() {
    if (!isDirectoryCategoryPage()) return;
    let timer = null;
    const scan = () => {
      clearTimeout(timer);
      timer = setTimeout(() => continueDirectoryHandoffFromDom(), 180);
    };
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    scan();
  }

  function dropMatchesHandoffTarget(drop, pending) {
    if (!drop || !pending) return false;
    if (pending.targetGame && !gameNamesMatch(pending.targetGame, drop.game || "")) return false;

    const targetKey = String(pending.targetCampaignKey || "");
    if (
      targetKey &&
      drop.campaignKey !== targetKey &&
      drop.campaignId !== targetKey
    ) {
      const targetName = normalizeGameName(pending.targetCampaign || "");
      const dropName = normalizeGameName(drop.campaign || "");
      if (!targetName || targetName !== dropName) return false;
    }
    return true;
  }

  function creditedProgressProvesStream(drop, pending, previousDrop = null) {
    if (!dropMatchesHandoffTarget(drop, pending)) return false;

    const currentMinutes = Number(drop.currentMinutes);
    const currentPercent = Number(drop.percent);
    const baselineMinutes = Number(pending.verifyBaselineMinutes);
    const baselinePercent = Number(pending.verifyBaselinePercent);

    const minutesAdvanced = Number.isFinite(currentMinutes) && (
      (Number.isFinite(baselineMinutes) && currentMinutes > baselineMinutes) ||
      (
        previousDrop &&
        dropMatchesHandoffTarget(previousDrop, pending) &&
        currentMinutes > Number(previousDrop.currentMinutes || 0)
      )
    );

    const percentAdvanced = Number.isFinite(currentPercent) && (
      (Number.isFinite(baselinePercent) && currentPercent > baselinePercent) ||
      (
        previousDrop &&
        dropMatchesHandoffTarget(previousDrop, pending) &&
        currentPercent > Number(previousDrop.percent || 0)
      )
    );

    const switchAt = Number(pending.switchStartedAt || pending.verifyStartedAt || 0);
    const creditedAfterSwitch = Boolean(
      switchAt &&
      lastProgressAt > switchAt + 250 &&
      dropMatchesHandoffTarget(drop, pending)
    );

    return minutesAdvanced || percentAdvanced || creditedAfterSwitch;
  }

  function completeVerifiedHandoff(pending, method, details = {}) {
    if (!pending) return false;
    const channel = watchingLogin() || pending.targetStream || "";
    const progressConfirmed = /progress/i.test(method);
    const campaignSupported = Boolean(
      details.campaignSupport === true ||
      method === "available-campaign" ||
      method === "session-match"
    );
    const streamGame = cleanText(details.streamGame || readStreamInfo()?.game || "");
    const targetGame = cleanText(pending.targetGame || currentDrop?.game || "");
    const gameMatched = Boolean(streamGame && targetGame && gameNamesMatch(targetGame, streamGame));
    const proof = {
      gameMatched,
      campaignSupported,
      progressConfirmed,
    };
    if (!campaignSupported && !progressConfirmed) return false;
    lastStreamVerification = {
      at: Date.now(),
      method,
      dropId: currentDrop?.id || null,
      channel: channel || null,
      game: targetGame || null,
      campaign: pending.targetCampaign || currentDrop?.campaign || null,
      campaignKey: pending.targetCampaignKey || currentDrop?.campaignKey || currentDrop?.campaignId || null,
      proof,
      ...sanitizeDiagnosticMeta(details),
    };

    clearGqlFailurePause(`verified-stream:${method}`);
    transitionHandoff(
      HANDOFF_STATES.COMPLETE,
      {},
      `Verified ${channel || "stream"} for ${pending.targetCampaign || pending.targetGame}`,
    );
    clearHandoff(`Active campaign stream verified for ${pending.targetGame}`);
    logActivity("stream-verified", "Compatible Drops stream verified", {
      method,
      channel: channel || null,
      game: pending.targetGame || null,
      campaign: pending.targetCampaign || null,
      proof,
      ...details,
    });
    return true;
  }

  function verifyHandoffWithCreditedProgress(drop, previousDrop = null) {
    const pending = getHandoffState();
    if (!pending) return false;
    const state = normalizedHandoffState(pending);
    if (state !== HANDOFF_STATES.SWITCHING && state !== HANDOFF_STATES.VERIFYING) return false;
    if (!creditedProgressProvesStream(drop, pending, previousDrop)) return false;

    return completeVerifiedHandoff(pending, "credited-progress", {
      baselineMinutes: Number.isFinite(Number(pending.verifyBaselineMinutes)) ? Number(pending.verifyBaselineMinutes) : null,
      currentMinutes: Number.isFinite(Number(drop.currentMinutes)) ? Number(drop.currentMinutes) : null,
      baselinePercent: Number.isFinite(Number(pending.verifyBaselinePercent)) ? Number(pending.verifyBaselinePercent) : null,
      currentPercent: Number.isFinite(Number(drop.percent)) ? Number(drop.percent) : null,
    });
  }

  function verifyHandoffFromInventory(campaigns) {
    const pending = getHandoffState();
    if (!pending || !pending.lockActiveCampaign) return false;
    const state = normalizedHandoffState(pending);
    if (state !== HANDOFF_STATES.SWITCHING && state !== HANDOFF_STATES.VERIFYING) return false;

    const info = readStreamInfo();
    if (!info.live || !info.game || !gameNamesMatch(pending.targetGame || "", info.game)) return false;

    const targetDropId = pending.completedDropId || currentDrop?.id || "";
    for (const campaign of campaigns || []) {
      if (!campaignMatchesTarget(campaign, pending)) continue;
      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const raw of drops) {
        if (targetDropId && raw.id !== targetDropId) continue;
        const required = Number(raw.requiredMinutesWatched || currentDrop?.requiredMinutes || 0);
        const minutes = Number(raw.self?.currentMinutesWatched || 0);
        const percent = dropProgressPercent(minutes, required);
        const proof = {
          id: raw.id || targetDropId,
          game: campaign.game?.displayName || campaign.game?.name || pending.targetGame || "",
          campaignId: campaign.id || "",
          campaignKey: campaignKey(campaign),
          campaign: campaign.name || pending.targetCampaign || "",
          currentMinutes: minutes,
          requiredMinutes: required,
          percent,
        };
        if (creditedProgressProvesStream(proof, pending, currentDrop)) {
          return completeVerifiedHandoff(pending, "inventory-progress", {
            currentMinutes: minutes,
            currentPercent: percent,
          });
        }
      }
    }
    return false;
  }

  function verifyHandoffChannel(login, streamGame, availableCampaigns, sessionDrop) {
    const pending = getHandoffState();
    if (!pending) return false;
    const state = normalizedHandoffState(pending);
    if (state !== HANDOFF_STATES.SWITCHING && state !== HANDOFF_STATES.VERIFYING) return false;

    const targetGame = pending.targetGame || "";
    const gameMatches = Boolean(targetGame && streamGame && gameNamesMatch(targetGame, streamGame));
    const campaignSupport = channelSupportsTargetCampaign(availableCampaigns, pending);
    const sessionMatches = Boolean(
      sessionDrop &&
      gameNamesMatch(targetGame, sessionDrop.game || "") &&
      (
        !pending.targetCampaignKey ||
        sessionDrop.campaignKey === pending.targetCampaignKey ||
        sessionDrop.campaignId === pending.targetCampaignKey
      )
    );
    const creditedProgress = creditedProgressProvesStream(currentDrop, pending);

    if (gameMatches && (campaignSupport === true || sessionMatches || creditedProgress)) {
      completeVerifiedHandoff(
        pending,
        creditedProgress ? "credited-progress" : sessionMatches ? "session-match" : "available-campaign",
        {
          streamGame: streamGame || null,
          campaignSupport,
        },
      );
      return false;
    }

    const definiteGameMismatch = Boolean(targetGame && streamGame && !gameMatches);
    const definiteCampaignMismatch = Boolean(gameMatches && campaignSupport === false);
    if (pending.lockActiveCampaign && (definiteGameMismatch || definiteCampaignMismatch)) {
      logActivity("stream-rejected", "Rejected incompatible stream without waiting for verification timeout", {
        channel: pending.targetStream || login || null,
        targetGame: pending.targetGame || null,
        streamGame: streamGame || null,
        campaignSupport,
        reason: definiteGameMismatch ? "game-mismatch" : "campaign-mismatch",
      });
      return retryLockedCampaignStream(
        pending,
        definiteGameMismatch
          ? `Rejected ${pending.targetStream || login || "stream"} · wrong game`
          : `Rejected ${pending.targetStream || login || "stream"} · campaign unavailable`,
      );
    }

    const startedAt = Number(
      pending.verifyStartedAt ||
      pending.switchStartedAt ||
      pending.stateStartedAt ||
      Date.now()
    );

    if (state === HANDOFF_STATES.VERIFYING && Date.now() - startedAt > ACTIVE_STREAM_VERIFY_TIMEOUT_MS) {
      if (pending.lockActiveCampaign) {
        logActivity("stream-rejected", "Stream did not verify for active campaign", {
          channel: pending.targetStream || login || null,
          targetGame: pending.targetGame || null,
          streamGame: streamGame || null,
          campaignSupport,
        });
        retryLockedCampaignStream(
          pending,
          `Rejected ${pending.targetStream || login || "stream"} · trying another ${pending.targetGame} channel`,
        );
        return true;
      }

      const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        { targetGame: "", targetSlug: "", targetStream: "", skippedGames },
        `Could not verify ${pending.targetGame || "target game"} after switching`,
      );
      autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
      return true;
    }
    return false;
  }

  function adoptSelectedTargetDrop(next, reason = "target-selected") {
    if (!next) return false;

    const previous = currentDrop;
    const detailsPending = Boolean(next.needsDropDetails);
    const requiredValue = Number(next.requiredMinutes);
    const currentValue = Number(next.currentMinutes);
    const detailsKnown = !detailsPending && Number.isFinite(requiredValue) && requiredValue > 0;
    const required = detailsKnown ? requiredValue : null;
    const current = detailsKnown && Number.isFinite(currentValue) ? Math.max(0, currentValue) : null;
    const percent = detailsKnown ? dropProgressPercent(current, required, next.percent) : null;

    currentDrop = {
      ...next,
      isClaimed: Boolean(next.isClaimed),
      percent,
      currentMinutes: current,
      requiredMinutes: required,
      remainingMinutes: detailsKnown ? Math.max(0, required - current) : null,
      needsDropDetails: detailsPending || !detailsKnown,
    };

    const resolvedSlug = resolveCategorySlug(currentDrop);
    if (resolvedSlug) currentDrop.gameSlug = resolvedSlug;

    writeSession("tdh-drop", currentDrop);
    saveRecoverySnapshot('target-selected');
    if (detailsKnown) {
      progressLabel = `${percent}%`;
      lastProgress = percent;
      lastProgressAt = Date.now();
      writeSession("tdh-progress", percent);
      writeSession("tdh-progress-at", lastProgressAt);
    } else {
      progressLabel = "";
      removeSession("tdh-progress");
    }

    resetClaimReadyTimer();
    logActivity("target-drop", `Working Toward changed to ${currentDrop.name || "next Drop"}`, {
      reason,
      fromDrop: previous?.name || null,
      fromGame: previous?.game || null,
      toDrop: currentDrop.name || null,
      toGame: currentDrop.game || null,
      campaign: currentDrop.campaign || null,
      percent,
      currentMinutes: current,
      requiredMinutes: required,
    });

    syncProgressSurfaces();
    refreshDropCard();
    layoutChrome();
    return true;
  }


  function continueToNextGame(campaigns) {
    const pending = getHandoffState();
    if (!pending) return false;

    if (!pending.startedAt || Date.now() - pending.startedAt > HANDOFF_SESSION_TTL_MS) {
      transitionHandoff(HANDOFF_STATES.FAILED, {}, "Handoff expired after 15 minutes");
      clearHandoff("Expired handoff cleared");
      return false;
    }

    let state = normalizedHandoffState(pending);

    if (state === HANDOFF_STATES.SWITCHING) {
      const login = watchingLogin();
      if (login && (!pending.targetStream || login === pending.targetStream)) {
        transitionHandoff(
          HANDOFF_STATES.VERIFYING,
          {
            verifyStartedAt: Date.now(),
            verifyBaselineMinutes: Number.isFinite(Number(pending.verifyBaselineMinutes))
              ? Number(pending.verifyBaselineMinutes)
              : Number(currentDrop?.currentMinutes || 0),
            verifyBaselinePercent: Number.isFinite(Number(pending.verifyBaselinePercent))
              ? Number(pending.verifyBaselinePercent)
              : Number(currentDrop?.percent || 0),
          },
          `Arrived at ${login} · verifying Drop eligibility`,
        );
        requestGqlPoll("stream-arrival-verify", true);
        return false;
      }
      const switchStartedAt = Number(pending.switchStartedAt || pending.stateStartedAt || pending.startedAt || Date.now());
      if (Date.now() - switchStartedAt > ACTIVE_STREAM_VERIFY_TIMEOUT_MS) {
        if (pending.lockActiveCampaign) {
          return retryLockedCampaignStream(
            pending,
            `Stream switch timed out · trying another ${pending.targetGame} channel`,
          );
        }
        const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          { targetGame: "", targetSlug: "", targetStream: "", skippedGames },
          `Stream switch timed out for ${pending.targetGame || "target game"} · selecting another game`,
        );
        autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
        return true;
      }
      return true;
    }

    if (state === HANDOFF_STATES.VERIFYING) {
      const verifyStartedAt = Number(pending.verifyStartedAt || pending.stateStartedAt || pending.startedAt || Date.now());
      if (Date.now() - verifyStartedAt > ACTIVE_STREAM_VERIFY_TIMEOUT_MS) {
        if (pending.lockActiveCampaign) {
          return retryLockedCampaignStream(
            pending,
            `Verification timed out · trying another ${pending.targetGame} channel`,
          );
        }
        const skippedGames = [...new Set([...(pending.skippedGames || []), pending.targetGame].filter(Boolean))];
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          { targetGame: "", targetSlug: "", targetStream: "", skippedGames },
          `Verification timed out for ${pending.targetGame || "target game"} · selecting another game`,
        );
        setStatus(`Could Not Verify ${pending.targetGame || "Target Game"} · Trying Next Game`);
        autoNavigateTwitch(INVENTORY_URL, "automatic-routing");
        return true;
      }
      return false;
    }

    if (state === HANDOFF_STATES.FINDING_STREAM) {
      if (pending.discoveryMode === "homepage-search") {
        return continueHomepageCampaignHandoffFromDom();
      }

      if (isDirectoryCategoryPage()) {
        continueDirectoryHandoffFromDom();
        return true;
      }

      const currentLogin = watchingLogin();
      if (currentLogin) {
        const info = readStreamInfo();

        if (info.live && info.game && gameNamesMatch(pending.targetGame || "", info.game)) {
          transitionHandoff(
            HANDOFF_STATES.VERIFYING,
            {
              targetStream: currentLogin,
              verifyStartedAt: Date.now(),
              verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
              verifyBaselinePercent: Number(currentDrop?.percent || 0),
            },
            `Found target game on ${currentLogin} · verifying current channel in place`,
          );
          requestGqlPoll("stream-arrival-verify", true);
          return false;
        }

        if (Date.now() - PAGE_STARTED_AT < STREAM_ROUTE_SETTLE_MS || !info.game) {
          setStatus(`Loading ${pending.targetGame || "Target"} Stream Info…`);
          return false;
        }
      }

      const targetUrl = gameDirectoryUrl({
        game: pending.targetGame,
        gameSlug: pending.targetSlug,
      });
      if (targetUrl && autoNavigateTwitch(targetUrl, "find-target-category")) return true;

      transitionHandoff(HANDOFF_STATES.SELECTING_GAME, {}, "Target game directory URL unavailable");
      state = HANDOFF_STATES.SELECTING_GAME;
    }

    if (state === HANDOFF_STATES.CHECKING_GAME) {
      const remainingCurrentGameDrop = pickRemainingGameDrop(
        routingCampaignPool(campaigns),
        pending.completedGame,
        pending.completedDropId || "",
        pending.completedDrop || "",
        pending.completedCampaignKey || "",
      );

      if (remainingCurrentGameDrop) {
        const remainingFitsWindow = dropFitsCampaignWindow(remainingCurrentGameDrop);
        const soonestOpen = pickNextOpenCampaignDrop(
          routingCampaignPool(campaigns),
          pending.excludedCampaignKeys || [],
          [],
        );
        const remainingKey = cleanText(
          remainingCurrentGameDrop.campaignKey || remainingCurrentGameDrop.campaignId || "",
        ).toLowerCase();
        const soonestKey = cleanText(soonestOpen?.campaignKey || soonestOpen?.campaignId || "").toLowerCase();
        const remainingEndMs = Number(
          remainingCurrentGameDrop.endMs
          || Date.parse(remainingCurrentGameDrop.campaignEndAt || "")
          || Number.MAX_SAFE_INTEGER,
        );
        const soonestEndMs = Number(soonestOpen?.endMs || Number.MAX_SAFE_INTEGER);
        // Once a campaign is active, finish its remaining eligible watch-time Drops.
        // Another campaign ending sooner does not preempt it.
        const soonerCampaignElsewhere = false;
        const remainingUnwinnable = Boolean(
          !remainingFitsWindow
          && soonestOpen
          && soonestKey
          && soonestKey !== remainingKey
          && dropFitsCampaignWindow(soonestOpen),
        );

        if (!soonerCampaignElsewhere && !remainingUnwinnable) {
          if (remainingKey && campaignMarkedComplete(remainingKey)) {
            const record = campaignMemory.campaigns?.[remainingKey];
            if (record) {
              record.completedAt = 0;
              record.status = "open";
              saveCampaignMemory();
            }
          }
          adoptSelectedTargetDrop(remainingCurrentGameDrop, "same-game-continue");
          clearHandoff(`Continuing ${pending.completedGame} · ${remainingCurrentGameDrop.name}`);
          setStatus(`Continuing ${pending.completedGame} · ${remainingCurrentGameDrop.name}`);
          if (matchingLiveDropStream()) return false;
          return ensureActiveCampaignStream();
        }

        const yieldReason = remainingUnwinnable && !soonerCampaignElsewhere
          ? `Remaining ${pending.completedGame} cannot finish before campaign end · switching to ${soonestOpen.campaign || soonestOpen.game}`
          : `Sooner campaign ${soonestOpen.campaign || soonestOpen.game} ends before remaining ${pending.completedGame} · switching`;
        const yieldStatus = remainingUnwinnable && !soonerCampaignElsewhere
          ? `Cannot Finish In Time · ${soonestOpen.game || soonestOpen.campaign}`
          : `Ending Sooner · ${soonestOpen.game || soonestOpen.campaign}`;

        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          {
            forceOpenCampaign: true,
            claimReadyFallback: Boolean(pending.claimReadyFallback),
            excludedCampaignKeys: remainingUnwinnable
              ? [...new Set([...(pending.excludedCampaignKeys || []), remainingKey].filter(Boolean))]
              : (pending.excludedCampaignKeys || []),
            auditStage: "",
            deferredSameGame: pending.completedGame || "",
          },
          yieldReason,
        );
        setStatus(yieldStatus);
        state = HANDOFF_STATES.SELECTING_GAME;
      } else {
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          {
            forceOpenCampaign: true,
            claimReadyFallback: Boolean(pending.claimReadyFallback),
            excludedCampaignKeys: pending.excludedCampaignKeys || [],
            auditStage: "",
          },
          `${pending.completedGame} watch-time Drops complete · selecting next game`,
        );
        state = HANDOFF_STATES.SELECTING_GAME;
      }
    }

    if (state !== HANDOFF_STATES.SELECTING_GAME) return false;

    const current = getHandoffState() || pending;
    if (!current.auditStage) {
      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        { auditStage: "campaigns", campaignAuditStartedAt: Date.now() },
        "Checking active Twitch Drops campaigns",
      );
      setStatus("Checking Active Drops Campaigns…");
      if (!isCampaigns()) autoNavigateTwitch(CAMPAIGNS_URL, "campaign-audit");
      return true;
    }
    if (current.auditStage === "campaigns") {
      if (!isCampaigns()) {
        autoNavigateTwitch(CAMPAIGNS_URL, "campaign-audit");
        return true;
      }
      const auditStartedAt = Math.max(
        Number(current.campaignAuditStartedAt || current.stateStartedAt || 0),
        PAGE_STARTED_AT,
      );
      const auditAge = Date.now() - auditStartedAt;
      const pageCampaigns = scrapeCampaignsFromPage();
      if (pageCampaigns.length) {
        rememberCampaignCatalog(pageCampaigns, "campaign-audit-partial");
      }

      const importReady = hasFreshCampaignPageImport();
      // A fresh GQL/auth import is enough to pick. Never block earning on the
      // accordion scroll promise — with ~80 headers it can run for minutes and
      // previously ignored PAGE_CAMPAIGN_IMPORT_WAIT_MS entirely.
      if (!importReady) {
        if (!current.campaignsImportStartedAt) {
          transitionHandoff(
            HANDOFF_STATES.SELECTING_GAME,
            {
              ...current,
              auditStage: "campaigns",
              campaignAuditStartedAt: auditStartedAt,
              campaignsImportStartedAt: Date.now(),
              requireCampaignPageImport: true,
            },
            "Importing every open All Campaigns row before earning",
          );
          scheduleCampaignsPageCatalogEnrichment("campaign-audit-scroll");
          setStatus("Importing Open Drop Campaigns…");
          return false;
        }

        if (!campaignsPageEnrichmentPromise) {
          scheduleCampaignsPageCatalogEnrichment(
            current.campaignsImportRetry ? "campaign-audit-scroll-retry" : "campaign-audit-scroll",
          );
          if (!current.campaignsImportRetry) {
            transitionHandoff(
              HANDOFF_STATES.SELECTING_GAME,
              { ...getHandoffState(), campaignsImportRetry: true },
              "Retrying All Campaigns scroll import",
            );
          }
        }
        const found = Math.max(pageCampaigns.length, importedOpenCampaignCount());
        setStatus(`Importing Open Drop Campaigns… ${found || 0} Found`);
        if (auditAge < PAGE_CAMPAIGN_IMPORT_WAIT_MS) {
          return false;
        }
        // Timed out waiting for a large scrape — keep whatever we imported and continue.
        const timeoutDisplay = found > 0
          ? (lastCampaignPageDisplay.mode || CAMPAIGN_PAGE_DISPLAY.UNKNOWN)
          : (detectCampaignsPageDisplay().mode === CAMPAIGN_PAGE_DISPLAY.EMPTY
            ? CAMPAIGN_PAGE_DISPLAY.EMPTY
            : CAMPAIGN_PAGE_DISPLAY.TIMEOUT);
        markCampaignPageImport(found, "campaign-audit-timeout", timeoutDisplay);
      } else if (!current.campaignsImportStartedAt || !current.campaignsImportLogged) {
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          {
            ...getHandoffState(),
            auditStage: "campaigns",
            campaignAuditStartedAt: auditStartedAt,
            campaignsImportStartedAt: current.campaignsImportStartedAt || Date.now(),
            campaignsImportLogged: true,
            requireCampaignPageImport: false,
          },
          `Using fresh campaign import (${importedOpenCampaignCount()} open) · selecting one to earn`,
        );
      }

      const importedCount = importedOpenCampaignCount();
      if (importedCount > 0 && !current.campaignsImportLogged && !importReady) {
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          { ...getHandoffState(), campaignsImportLogged: true },
          `Imported ${importedCount} open campaigns · selecting one to earn`,
        );
      }

      const dashboardObservedForAudit = lastCampaignDashboardAt >= auditStartedAt;
      const memoryCampaigns = openCampaignsFromMemory();
      const auditPool = routingCampaignPool(pageCampaigns);
      const hasLocalCatalog = Boolean(
        lastCampaignCatalog.length || pageCampaigns.length || memoryCampaigns.length
      );
      const cachedCatalogFresh = Boolean(
        lastCampaignCatalog.length &&
        lastCampaignCatalogAt &&
        Date.now() - lastCampaignCatalogAt < 5 * 60 * 1000
      );
      if (!dashboardObservedForAudit && !cachedCatalogFresh && !hasLocalCatalog && auditAge < CAMPAIGN_AUDIT_WAIT_MS) {
        setStatus("Loading Active Drops Campaigns…");
        queueGqlPollSoon("campaign-catalog-audit", 0);
        return false;
      }

      const selectedOpenDrop = pickNextOpenCampaignDrop(
        auditPool,
        current.excludedCampaignKeys || [],
        current.skippedGames || [],
      );
      if (!selectedOpenDrop) {
        setStatus("Waiting For Next Open Eligible Campaign");
        queueGqlPollSoon("waiting-open-campaign", GQL_RECOVERY_INTERVAL_MS);
        return false;
      }

      const selectedKey = selectedOpenDrop.campaignKey || selectedOpenDrop.campaignId || "";
      if (isPageScrapedCampaignKey(selectedKey) || selectedOpenDrop.needsDropDetails) {
        adoptSelectedTargetDrop(selectedOpenDrop, "page-campaign-search");
        transitionHandoff(
          HANDOFF_STATES.FINDING_STREAM,
          {
            targetGame: selectedOpenDrop.game || "",
            targetSlug: selectedOpenDrop.gameSlug || "",
            targetStream: "",
            targetCampaign: selectedOpenDrop.campaign || "",
            targetCampaignKey: selectedKey,
            skippedGames: current.skippedGames || [],
            excludedCampaignKeys: current.excludedCampaignKeys || [],
            forceOpenCampaign: true,
            discoveryMode: "homepage-search",
            homeSearchStage: "visit-home",
            failedStreams: [],
            auditStage: "",
            selectedCampaignKey: selectedKey,
            selectedCampaignName: selectedOpenDrop.campaign || "",
            selectedCampaignGame: selectedOpenDrop.game || "",
            selectedDropId: selectedOpenDrop.id || "",
            lockActiveCampaign: true,
            needsDropDetails: Boolean(selectedOpenDrop.needsDropDetails),
          },
          selectedOpenDrop.needsDropDetails
            ? `Open campaign ${selectedOpenDrop.campaign || selectedOpenDrop.game} needs drop details · searching Twitch Home`
            : `Page campaign ${selectedOpenDrop.campaign || selectedOpenDrop.game} cannot use Inventory · searching Twitch Home`,
        );
        setStatus(`Opening Twitch Home For ${selectedOpenDrop.campaign || selectedOpenDrop.game}`);
        autoNavigateTwitch(TWITCH_HOME_URL, "campaign-home-search");
        return true;
      }

      transitionHandoff(
        HANDOFF_STATES.SELECTING_GAME,
        {
          auditStage: "inventory",
          campaignCatalogCount: lastCampaignCatalog.length,
          campaignCatalogCapturedAt: lastCampaignCatalogAt || 0,
          selectedCampaignKey: selectedKey,
          selectedCampaignName: selectedOpenDrop.campaign || "",
          selectedCampaignGame: selectedOpenDrop.game || "",
          selectedDropId: selectedOpenDrop.id || "",
        },
        `Picked open campaign ${selectedOpenDrop.campaign || selectedOpenDrop.game} · checking Inventory completion`,
      );
      setStatus(`Checking If ${selectedOpenDrop.campaign || selectedOpenDrop.game} Is Complete…`);
      autoNavigateTwitch(INVENTORY_URL, "inventory-audit");
      return true;
    }
    if (current.auditStage === "inventory" && !isInventory()) {
      autoNavigateTwitch(INVENTORY_URL, "inventory-audit");
      return true;
    }
    const eligibleCampaigns = routingCampaignPool(campaigns);
    const selectedCampaigns = current.selectedCampaignKey
      ? eligibleCampaigns.filter((campaign) => (
          campaignKey(campaign) === current.selectedCampaignKey ||
          String(campaign?.id || "") === current.selectedCampaignKey
        ))
      : eligibleCampaigns;
    const next = current.forceOpenCampaign
      ? pickNextOpenCampaignDrop(selectedCampaigns, [], [])
      : pickNextGameDrop(eligibleCampaigns, current.completedGame, current.skippedGames || []);

    if (!next) {
      if (current.forceOpenCampaign) {
        if (isPageScrapedCampaignKey(current.selectedCampaignKey) || current.needsDropDetails) {
          const excludedCampaignKeys = [...new Set([
            ...(current.excludedCampaignKeys || []),
            current.selectedCampaignKey,
          ].filter(Boolean))];
          transitionHandoff(
            HANDOFF_STATES.SELECTING_GAME,
            {
              auditStage: "campaigns",
              campaignAuditStartedAt: Date.now(),
              selectedCampaignKey: "",
              selectedCampaignName: "",
              selectedCampaignGame: "",
              selectedDropId: "",
              excludedCampaignKeys,
              needsDropDetails: false,
            },
            `${current.selectedCampaignName || "Page campaign"} has no Inventory match · picking next open campaign`,
          );
          setStatus("Page Campaign Skipped · Picking Next Open Campaign");
          autoNavigateTwitch(CAMPAIGNS_URL, "campaign-restart");
          return true;
        }
        const completedCampaign = selectedCampaigns[0] || null;
        markCampaignCompleted(current.selectedCampaignKey, {
          id: completedCampaign?.id || "",
          name: completedCampaign?.name || current.selectedCampaignName || "",
          game: completedCampaign?.game?.displayName || completedCampaign?.game?.name || current.selectedCampaignGame || "",
          startAt: completedCampaign?.startAt || "",
          endAt: completedCampaign?.endAt || "",
          source: "inventory-audit",
        });
        const excludedCampaignKeys = normalizeExcludedCampaignKeys([
          ...(current.excludedCampaignKeys || []),
          current.selectedCampaignKey,
        ]);
        transitionHandoff(
          HANDOFF_STATES.SELECTING_GAME,
          {
            auditStage: "campaigns",
            campaignAuditStartedAt: Date.now(),
            selectedCampaignKey: "",
            selectedCampaignName: "",
            selectedCampaignGame: "",
            selectedDropId: "",
            excludedCampaignKeys,
          },
          `${current.selectedCampaignName || "Selected campaign"} is complete in Inventory · picking next open campaign`,
        );
        setStatus("Campaign Complete · Picking Next Open Campaign");
        autoNavigateTwitch(CAMPAIGNS_URL, "campaign-restart");
        return true;
      }
      transitionHandoff(HANDOFF_STATES.COMPLETE, {}, "No more eligible watch-time games");
      setStatus("No More Eligible Games");
      notifyUser("All Eligible Watch-Time Drops Complete");
      clearHandoff("All eligible watch-time Drops complete");
      return false;
    }

    adoptSelectedTargetDrop(
      next,
      current.claimReadyFallback ? "claim-ready-fallback" :
      current.forceOpenCampaign ? "next-open-campaign" :
      "next-game",
    );

    transitionHandoff(
      HANDOFF_STATES.FINDING_STREAM,
      {
        targetGame: next.game,
        targetSlug: next.gameSlug || "",
        targetStream: "",
        targetCampaign: next.campaign || "",
        targetCampaignKey: next.campaignKey || "",
        skippedGames: current.skippedGames || [],
        excludedCampaignKeys: current.excludedCampaignKeys || [],
        forceOpenCampaign: true,
        discoveryMode: "homepage-search",
        homeSearchStage: "visit-home",
        failedStreams: [],
      },
      `Inventory confirmed ${next.campaign || next.game} is unfinished · visiting Twitch Home`,
    );
    setStatus(`Opening Twitch Home For ${next.campaign || next.game}`);
    notifyUser(`${current.completedGame || "Previous Drop"} Complete · Searching ${next.campaign || next.game}`);
    autoNavigateTwitch(TWITCH_HOME_URL, "campaign-home-search");
    return true;
  }

  function sessionDropQueryVariables(channelId, channelLogin) {
    const login = cleanText(channelLogin);
    if (!login) return null;
    return { channelLogin: login };
  }

  async function fetchSessionDropState(channelId, channelLogin, campaigns = []) {
    const requestContext = pollContext();
    const id = cleanText(channelId);
    const login = cleanText(channelLogin);
    const vars = sessionDropQueryVariables(id, login);
    const routing = readRoutingControllerSession();
    const note = {
      at: Date.now(),
      channelId: id || null,
      channelLogin: login || null,
      requestMode: vars?.channelLogin ? "channel-login" : "unavailable",
      requestVariables: vars ? Object.keys(vars) : [],
      queried: Boolean(vars),
      session: false,
      minutes: null,
      dropId: null,
      campaignKey: null,
      targetDropId: cleanText(routing.targetDropId) || null,
      targetCampaignKey: cleanText(routing.targetCampaignKey) || null,
      dropIdMatchedTarget: false,
      campaignMatchedTarget: false,
      identityLevel: "none",
      error: null,
    };
    let sessionDrop = null;
    let sessionRow = null;
    let available = [];
    if (!vars) {
      lastSessionPoll = note;
      return { sessionDrop, available };
    }
    try {
      const ops = [{ op: "currentDrop", variables: vars }];
      if (id) ops.push({ op: "availableDrops", variables: { channelID: id } });
      const extra = await gql(ops);
      if (!pollContextIsCurrent(requestContext)) return { sessionDrop: null, available: [] };
      available = id ? parseAvailableCampaigns(extra[1]) : [];
      sessionRow = extra[0];
      sessionDrop = parseSessionDrop(sessionRow, mergeCampaigns(campaigns, available));
      note.session = Boolean(sessionDrop);
      note.minutes = sessionDrop?.currentMinutes != null && Number.isFinite(Number(sessionDrop.currentMinutes))
        ? Number(sessionDrop.currentMinutes)
        : null;
      note.dropId = cleanText(sessionDrop?.id) || null;
      note.campaignKey = cleanText(sessionDrop?.campaignKey || sessionDrop?.campaignId) || null;
      note.dropIdMatchedTarget = Boolean(
        note.dropId &&
        note.targetDropId &&
        note.dropId === note.targetDropId
      );
      note.campaignMatchedTarget = Boolean(
        note.campaignKey &&
        note.targetCampaignKey &&
        note.campaignKey.toLowerCase() === note.targetCampaignKey.toLowerCase()
      );
      note.identityLevel = note.dropIdMatchedTarget
        ? "exact-drop"
        : note.campaignMatchedTarget
          ? (note.dropId && note.targetDropId ? "campaign-only-different-drop" : "campaign-fallback")
          : "none";
    } catch (error) {
      note.error = error?.message || String(error);
    }
    if (!pollContextIsCurrent(requestContext)) return { sessionDrop: null, available: [] };
    lastSessionPoll = note;
    return { sessionDrop, available, sessionRow };
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
      id: drop.id || dropId || "",
      isClaimed: Boolean(drop.self?.isClaimed),
      name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Current drop",
      rewardImage: dropBenefitImage(drop),
      game: campaign?.game?.displayName || campaign?.game?.name || drop.game?.displayName || drop.game?.name || session.game?.displayName || session.game?.name || "",
      gameSlug: campaign?.game?.slug || "",
      campaignId: campaign?.id || "",
      campaignKey: campaign ? campaignKey(campaign) : "",
      campaign: campaign?.name || "",
      campaignStartAt: campaign?.startAt || "",
      campaignEndAt: campaign?.endAt || drop.endAt || "",
      dropStartAt: drop.startAt || "",
      dropEndAt: drop.endAt || "",
      percent: dropProgressPercent(minutes, required),
      currentMinutes: minutes,
      requiredMinutes: required,
      remainingMinutes: Math.max(0, required - minutes),
      dropInstanceID:
        drop.self?.dropInstanceID ||
        drop.dropInstanceID ||
        node.dropInstanceID ||
        session.dropInstanceID ||
        "",
      session: true,
    };
  }

  function parseAvailableCampaigns(result) {
    const channel = result?.data?.channel || result?.data?.user || {};
    return channel.viewerDropCampaigns || channel.dropCampaigns || [];
  }

  function findActiveDropInCampaigns(campaigns, active = currentDrop) {
    if (!active || !Array.isArray(campaigns) || !campaigns.length) return null;

    // Inventory and campaign-dashboard responses do not always expose the same
    // campaign identity shape. Reuse the conservative campaign matcher so an
    // exact Drop ID, exact campaign ID, or same campaign name + game can bind
    // the live Inventory row back to the locked active target.
    const campaign = findCampaignForDrop(campaigns, active);
    if (!campaign || !campaignIsRoutingOpen(campaign)) return null;

    const wantId = cleanText(active.id);
    const wantKey = cleanText(active.campaignKey || active.campaignId).toLowerCase();
    const wantName = cleanText(active.name).toLowerCase();
    const wantGame = cleanText(active.game);
    const rawKey = campaignKey(campaign);
    const game = cleanText(campaign?.game?.displayName || campaign?.game?.name || "");
    const campaignName = cleanText(campaign?.name);
    const sameCampaignNameAndGame = Boolean(
      campaignName &&
      active.campaign &&
      normalizeGameName(campaignName) === normalizeGameName(active.campaign) &&
      (!wantGame || !game || gameNamesMatch(wantGame, game))
    );
    const drops = campaign?.timeBasedDrops || campaign?.drops || [];
    const campaignHasTargetDrop = Boolean(
      wantId && drops.some((drop) => cleanText(drop?.id) === wantId)
    );
    const preserveLockedCampaignIdentity = Boolean(
      wantKey &&
      rawKey &&
      !campaignKeysMatch(rawKey, wantKey) &&
      (campaignHasTargetDrop || sameCampaignNameAndGame)
    );
    const normalizedCampaignId = preserveLockedCampaignIdentity
      ? cleanText(active.campaignId || active.campaignKey)
      : cleanText(campaign?.id || active.campaignId);
    const normalizedCampaignKey = preserveLockedCampaignIdentity
      ? wantKey
      : cleanText(rawKey || wantKey);

    const options = [];
    for (const drop of drops) {
      const self = drop?.self || {};
      const id = cleanText(drop?.id);
      if (wantId && id !== wantId) continue;
      if ((self.isClaimed && !wantId) || requiresSubscription(drop)) continue;
      const required = Number(drop?.requiredMinutesWatched || 0);
      if (!Number.isFinite(required) || required <= 0) continue;

      // An explicit claim on the selected ID is completion proof. A sibling
      // reward or an absent row is not: leave advancement to the routing logic.
      const observed = self.currentMinutesWatched;
      const missingMinutes = observed == null || observed === "";
      if (missingMinutes && self.isClaimed !== true) continue;
      const current = missingMinutes ? required : Number(observed);
      if (!Number.isFinite(current) || current < 0) continue;
      const name = cleanText(drop?.name || drop?.benefitEdges?.[0]?.benefit?.name || "Drop");
      const idMatch = Boolean(wantId && id && wantId === id);
      const nameMatch = Boolean(wantName && name && wantName === name.toLowerCase());

      options.push({
        id: id || wantId || "",
        dropInstanceID: self.dropInstanceID || "",
        isClaimed: Boolean(self.isClaimed),
        name: name || active.name || "Drop",
        rewardImage: dropBenefitImage(drop) || active.rewardImage || "",
        game: game || active.game || "",
        gameSlug: campaign?.game?.slug || active.gameSlug || "",
        gameId: campaign?.game?.id || active.gameId || "",
        campaignId: normalizedCampaignId,
        campaignKey: normalizedCampaignKey,
        campaign: campaignName || active.campaign || game,
        campaignStartAt: campaign?.startAt || active.campaignStartAt || "",
        campaignEndAt: campaign?.endAt || drop?.endAt || active.campaignEndAt || "",
        dropStartAt: drop?.startAt || active.dropStartAt || "",
        dropEndAt: drop?.endAt || active.dropEndAt || "",
        endMs: campaignWindow(campaign, drop).endMs || Number(active.endMs) || Number.MAX_SAFE_INTEGER,
        percent: dropProgressPercent(current, required),
        currentMinutes: current,
        requiredMinutes: required,
        remainingMinutes: Math.max(0, required - current),
        fromLiveInventory: true,
        inventoryIdentityMatch: idMatch
          ? "drop-id"
          : campaignKeysMatch(rawKey, wantKey)
            ? "campaign-key"
            : sameCampaignNameAndGame
              ? "campaign-name-game"
              : nameMatch
                ? "drop-name"
                : "campaign",
      });
    }

    if (!options.length) return null;
    options.sort((a, b) => {
      const aId = wantId && a.id === wantId ? 1 : 0;
      const bId = wantId && b.id === wantId ? 1 : 0;
      if (bId !== aId) return bId - aId;
      const aName = wantName && cleanText(a.name).toLowerCase() === wantName ? 1 : 0;
      const bName = wantName && cleanText(b.name).toLowerCase() === wantName ? 1 : 0;
      if (bName !== aName) return bName - aName;
      if ((b.currentMinutes > 0) !== (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      return b.currentMinutes - a.currentMinutes;
    });
    return options[0];
  }

  function inventorySnapshotContainsDrop(drop) {
    if (!drop) return false;
    const wantId = cleanText(drop.id);
    const wantKey = cleanText(drop.campaignKey || drop.campaignId).toLowerCase();
    for (const campaign of lastInventoryCampaigns || []) {
      const key = campaignKey(campaign);
      if (wantKey && key === wantKey) return true;
      if (!wantId) continue;
      for (const item of campaign?.timeBasedDrops || campaign?.drops || []) {
        if (cleanText(item?.id) === wantId) return true;
      }
    }
    return false;
  }

  function dropIdentityMatchesTarget(drop, target = currentDrop) {
    const targetCampaignKey = cleanText(target?.campaignKey || target?.campaignId).toLowerCase();
    const targetDropId = cleanText(target?.id).toLowerCase();
    const dropCampaignKey = cleanText(drop?.campaignKey || drop?.campaignId).toLowerCase();
    const dropId = cleanText(drop?.id).toLowerCase();
    const targetRoutingState = target
      ? campaignRoutingState(target)
      : { open: false, reason: "target-missing" };
    const campaignMatched = Boolean(
      targetCampaignKey &&
      dropCampaignKey &&
      targetCampaignKey === dropCampaignKey
    );
    const dropMatched = Boolean(
      targetDropId &&
      dropId &&
      targetDropId === dropId
    );
    const bothDropIdsKnown = Boolean(targetDropId && dropId);
    const bothCampaignKeysKnown = Boolean(targetCampaignKey && dropCampaignKey);
    const exactDropMatched = Boolean(
      dropMatched &&
      (!bothCampaignKeysKnown || campaignMatched)
    );
    const campaignFallbackMatched = Boolean(
      campaignMatched &&
      !bothDropIdsKnown
    );
    const sameCampaignDifferentDrop = Boolean(
      campaignMatched &&
      bothDropIdsKnown &&
      !dropMatched
    );
    const identityLevel = exactDropMatched
      ? "exact-drop"
      : campaignFallbackMatched
        ? "campaign-fallback"
        : sameCampaignDifferentDrop
          ? "campaign-only-different-drop"
          : "none";
    return {
      targetCampaignKey: targetCampaignKey || null,
      targetDropId: targetDropId || null,
      dropCampaignKey: dropCampaignKey || null,
      dropId: dropId || null,
      campaignMatched,
      dropMatched,
      exactDropMatched,
      campaignFallbackMatched,
      sameCampaignDifferentDrop,
      identityLevel,
      targetCampaignOpen: Boolean(targetRoutingState.open),
      targetCampaignReason: targetRoutingState.reason || null,
      matchesTarget: Boolean(
        targetRoutingState.open &&
        (exactDropMatched || campaignFallbackMatched)
      ),
      mismatchReason: sameCampaignDifferentDrop
        ? "same-campaign-different-drop"
        : (!campaignMatched && bothCampaignKeysKnown ? "different-campaign" : null),
    };
  }

  function recordRewardSessionResolution(sessionDrop, campaigns = []) {
    if (!sessionDrop || !currentDrop) { rewardSessionResolution = null; return null; }
    const identity = dropIdentityMatchesTarget(sessionDrop, currentDrop);
    const campaign = (campaigns || []).find(item => campaignKeysMatch(campaignKey(item), currentDrop.campaignKey || currentDrop.campaignId));
    const drops = campaign?.timeBasedDrops || campaign?.drops || [];
    const selected = drops.find(item => cleanText(item?.id) === cleanText(currentDrop.id));
    const credited = drops.find(item => cleanText(item?.id) === cleanText(sessionDrop.id));
    const byId = new Map(drops.map(item => [cleanText(item?.id), item]));
    const pending = [...(selected?.preconditionDrops || [])];
    const visited = new Set();
    let prerequisite = false;
    while (pending.length && visited.size < 100) {
      const id = cleanText(pending.pop()?.id);
      if (!id || visited.has(id)) continue;
      visited.add(id);
      if (id === cleanText(sessionDrop.id)) { prerequisite = true; break; }
      pending.push(...(byId.get(id)?.preconditionDrops || []));
    }
    const minutes = sessionDrop.currentMinutes == null ? null : Number(sessionDrop.currentMinutes);
    rewardSessionResolution = {
      at: Date.now(), channel: watchingLogin(), targetDropId: cleanText(currentDrop.id),
      campaignKey: cleanText(currentDrop.campaignKey || currentDrop.campaignId), sessionDropId: cleanText(sessionDrop.id),
      sessionName: cleanText(credited?.name || credited?.benefitEdges?.[0]?.benefit?.name || sessionDrop.name || "Drop"),
      sessionMinutes: Number.isFinite(minutes) ? minutes : null,
      relation: identity.exactDropMatched ? "selected-reward"
        : identity.sameCampaignDifferentDrop ? (prerequisite ? "prerequisite" : selected && credited ? "other-reward" : "unresolved")
          : "different-or-unresolved-campaign",
      identityLevel: identity.identityLevel,
    };
    return rewardSessionResolution;
  }

  function reconcileDropProgress(sessionDrop, inventoryDrop, options = {}) {
    const required = Number(inventoryDrop?.requiredMinutes || sessionDrop?.requiredMinutes || 0);
    const inventoryMinutes = Number(inventoryDrop?.currentMinutes);
    const observedSessionMinutes = Number(sessionDrop?.currentMinutes);
    const inventoryValid = Number.isFinite(inventoryMinutes) && inventoryMinutes >= 0;
    const sessionObserved = Number.isFinite(observedSessionMinutes) && observedSessionMinutes >= 0;
    const sessionEligible = options.sessionEligible !== false;
    const sessionValid = sessionEligible && sessionObserved;
    const inventoryLive = Boolean(
      options.inventoryLive ??
      inventoryDrop?.fromLiveInventory ??
      inventorySnapshotContainsDrop(inventoryDrop)
    );

    let chosen = 0;
    let source = "none";

    // Catalog shells often carry 0 minutes for campaigns that are selected but
    // not yet in Inventory. Those zeros must not suppress a matching live
    // session counter. Session progress from another campaign or Drop is never
    // eligible to advance the locked target, even when the game matches.
    const inventoryAuthoritative = inventoryValid && (inventoryLive || inventoryMinutes > 0);

    if (inventoryAuthoritative) {
      chosen = inventoryMinutes;
      source = "inventory-authoritative";
      if (
        sessionValid &&
        observedSessionMinutes > chosen &&
        (!required || observedSessionMinutes <= required)
      ) {
        chosen = observedSessionMinutes;
        source = "session-ahead-of-inventory";
      } else if (sessionObserved && !sessionEligible) {
        source = "inventory-authoritative-session-rejected";
      }
    } else if (sessionValid) {
      if (required && observedSessionMinutes > required) {
        chosen = 0;
        source = "session-rejected-implausible";
      } else {
        chosen = observedSessionMinutes;
        source = inventoryValid ? "session-over-catalog-shell" : "session-fallback";
      }
    } else if (inventoryValid) {
      chosen = inventoryMinutes;
      source = sessionObserved && !sessionEligible
        ? "catalog-shell-session-rejected"
        : (inventoryLive ? "inventory-authoritative" : "catalog-shell");
    } else if (sessionObserved && !sessionEligible) {
      chosen = 0;
      source = "session-rejected-cross-campaign";
    }

    if (required > 0) chosen = Math.min(required, Math.max(0, chosen));

    lastProgressReconcile = {
      at: Date.now(),
      requiredMinutes: required,
      inventoryMinutes: inventoryValid ? inventoryMinutes : null,
      sessionMinutes: sessionValid ? observedSessionMinutes : null,
      observedSessionMinutes: sessionObserved ? observedSessionMinutes : null,
      chosenMinutes: chosen,
      inventoryLive,
      sessionEligible,
      sessionRejectedReason: sessionObserved && !sessionEligible
        ? cleanText(options.sessionRejectedReason || "different-campaign-or-drop")
        : null,
      source,
    };
    return chosen;
  }
  function resetClaimReadyTimer() {
    claimReadySince = 0;
    claimReadySignature = "";
  }

  function maybeAdvanceStuckClaim(campaigns = lastInventoryCampaigns) {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("claim-ready-advance");
      resetClaimReadyTimer();
      return false;
    }
    if (!settings.findNextStream || !currentDrop || currentDrop.isClaimed || !dropProgressComplete(currentDrop)) {
      resetClaimReadyTimer();
      return false;
    }

    const signature = [
      currentDrop.campaignKey || currentDrop.campaignId || currentDrop.campaign || "",
      currentDrop.id || currentDrop.name || "",
    ].join("|");

    const now = Date.now();
    if (claimReadySignature !== signature) {
      claimReadySignature = signature;
      claimReadySince = now;
      logActivity("claim-ready", "Completed Drop is waiting to be claimed", {
        drop: currentDrop.name || null,
        game: currentDrop.game || null,
        campaign: currentDrop.campaign || null,
        dropInstanceIdAvailable: Boolean(currentDrop.dropInstanceID),
      });
    }

    const age = now - claimReadySince;
    if (CLAIM_READY_GRACE_MS > 0 && age < CLAIM_READY_GRACE_MS) {
      setStatus(`Claim Ready · Waiting For Twitch ${Math.ceil((CLAIM_READY_GRACE_MS - age) / 1000)}s`);
      return false;
    }

    const pending = getHandoffState();
    // Already advancing past this completed Drop. Returning true here would
    // short-circuit the heartbeat/GQL poll and permanently stall selecting-game
    // after an SPA reload on the campaigns audit page.
    if (handoffIsBusyRouting(pending, { includeCheckingGame: true })) return false;

    const completionPool = routingCampaignPool(campaigns);
    const campaign = findCampaignForDrop(completionPool, currentDrop);
    const expiredKey = campaign
      ? campaignKey(campaign)
      : currentDrop.campaignKey || currentDrop.campaignId || "";

    // Watch time for this Drop is done. Leave claim to the user. Only mark the
    // campaign complete when every watch-time Drop is finished so routing can
    // traverse to other games by progress — not a hardcoded game skip list.
    const campaignWatchDone = Boolean(
      campaign
        ? markCampaignCompleteIfWatchDone(campaign, "claim-ready-progress")
        : false,
    );
    const excludedCampaignKeys = campaignWatchDone
      ? normalizeExcludedCampaignKeys([...(pending?.excludedCampaignKeys || []), expiredKey])
      : normalizeExcludedCampaignKeys(pending?.excludedCampaignKeys || []);

    // Prefer remaining same-game Drops before switching campaigns.
    transitionHandoff(
      HANDOFF_STATES.CHECKING_GAME,
      {
        completedGame: currentDrop.game || "",
        completedDrop: currentDrop.name || "Drop",
        completedDropId: currentDrop.id || "",
        completedCampaignKey: currentDrop.campaignKey || currentDrop.campaignId || "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: pending?.skippedGames || [],
        forceOpenCampaign: true,
        claimReadyFallback: true,
        excludedCampaignKeys,
        startedAt: pending?.startedAt || now,
      },
      `${currentDrop.name || "Completed Drop"} finished · checking remaining ${currentDrop.game || "game"} Drops`,
    );

    logActivity("claim-ready-continue", "Completed Drop · continuing without waiting for claim or account connection", {
      drop: currentDrop.name || null,
      game: currentDrop.game || null,
      campaign: currentDrop.campaign || null,
      dropInstanceIdAvailable: Boolean(currentDrop.dropInstanceID),
      graceSeconds: Math.round(CLAIM_READY_GRACE_MS / 1000),
    });

    setStatus(`${currentDrop.game || "Drop"} Complete · Checking Remaining Drops`);
    notifyUser("Drop Complete · Checking Remaining Watch-Time Drops");
    resetClaimReadyTimer();
    return continueToNextGame(completionPool);
  }

  function shouldFetchViewerDropsDashboard() {
    if (isCampaigns() || isInventory()) return true;
    const routing = readRoutingControllerSession();
    if (
      routing.state === ROUTING_STATES.SELECT_CAMPAIGN ||
      (
        routing.state === ROUTING_STATES.WAITING &&
        ["no-eligible-campaign", "campaign-details"].includes(routing.waitReason)
      )
    ) return true;
    if (!lastCampaignCatalog.length) return true;
    if (lastCampaignCatalogAt && Date.now() - lastCampaignCatalogAt > 5 * 60 * 1000) return true;
    return false;
  }
  async function pollGqlDrops() {
    const requestContext = pollContext();
    let inventoryReadCompleted = false;
    lastGqlPollAt = Date.now();
    try {
      if (!getToken()) {
        setStatus("Waiting for Twitch login…");
        refreshDropCard();
        return;
      }
      const login = watchingLogin();
      const fetchDashboard = shouldFetchViewerDropsDashboard();
      const requests = [{ op: "inventory" }];
      if (fetchDashboard) requests.push({ op: "viewerDropsDashboard" });
      if (login) requests.push({ op: "streamInfo", variables: { channel: login } });
      const first = await gql(requests, { allowInventoryFailure: true });
      if (!pollContextIsCurrent(requestContext)) return;
      lastGqlSuccessAt = Date.now();
      lastGqlError = "";
      let responseIndex = 0;
      const inventoryRow = first[responseIndex++];
      const inventoryResult = acceptInventoryResponse(inventoryRow, "inventory-poll");
      inventoryReadCompleted = true;
      // Empty local input means no *fresh* inventory. The last valid snapshot
      // remains in memory, but must not be relabelled as a successful new read.
      const inventoryCampaigns = inventoryResult.campaigns || [];
      if (fetchDashboard) {
        const dashboardRow = first[responseIndex++];
        const dashboardCampaigns = dashboardRow?.data?.currentUser?.dropCampaigns;
        if (Array.isArray(dashboardCampaigns)) {
          lastCampaignDashboardAt = Date.now();
          replaceCatalogFromDashboard(dashboardCampaigns, "viewer-drops-dashboard");
          const open = openDashboardCampaigns(dashboardCampaigns);
          if (open.length && (open.length >= PAGE_CAMPAIGN_IMPORT_MIN || isCampaigns() || needsCampaignPageImport())) {
            markCampaignPageImport(open.length, "viewer-drops-dashboard", CAMPAIGN_PAGE_DISPLAY.GQL_AUTH);
          }
        }
      }
      const streamRow = login ? first[responseIndex++] : null;
      await enrichRoutingTargetCampaign("routing-campaign-details");
      if (!pollContextIsCurrent(requestContext)) return;

      // Live Inventory is authoritative for credited watch minutes. Apply the
      // active Inventory Drop immediately, even on category/search pages where
      // there is no current channel session. This keeps visible progress and
      // the next stream-verification baseline synchronized with Twitch.
      const authoritativeInventoryDrop = currentDrop
        ? findActiveDropInCampaigns(inventoryCampaigns, currentDrop)
        : null;
      if (authoritativeInventoryDrop) applyDrop(authoritativeInventoryDrop);

      const campaignPool = suppressPageCampaignsWithAuthoritativeMatches(
        mergeCampaigns(lastCampaignCatalog, inventoryCampaigns),
      );
      reconcilePageCurrentDropWithAuthoritativeCampaign(campaignPool);
      const stream = streamRow?.data?.user;
      const channelId = stream?.id ? String(stream.id) : "";
      const gameName = stream?.stream?.game?.name || stream?.stream?.game?.displayName || "";
      const sessionState = await fetchSessionDropState(channelId, login, routingCampaignPool());
      if (!pollContextIsCurrent(requestContext)) return;
      let sessionDrop = sessionState.sessionDrop;
      let available = sessionState.available;
      if (await enrichRoutingTargetCampaign("session-reward-details", sessionDrop)) {
        if (!pollContextIsCurrent(requestContext)) return;
        sessionDrop = parseSessionDrop(sessionState.sessionRow, mergeCampaigns(routingCampaignPool(), available)) || sessionDrop;
      }
      if (!pollContextIsCurrent(requestContext)) return;
      recordRewardSessionResolution(sessionDrop, mergeCampaigns(routingCampaignPool(), available));
      updateRoutingCampaignSupportEvidence(login, available, sessionDrop);
      const activeUnclaimed = Boolean(currentDrop && !currentDrop.isClaimed);
      const preferredGame = activeUnclaimed ? currentDrop.game || "" : gameName || "";
      const streamMatchesActive = Boolean(
        !activeUnclaimed ||
        !gameName ||
        gameNamesMatch(currentDrop.game || "", gameName)
      );

      if (activeUnclaimed && gameName && !streamMatchesActive) {
        sessionDrop = null;
        available = [];
      }
      if (sessionDrop && preferredGame && !gameNamesMatch(sessionDrop.game || "", preferredGame)) {
        sessionDrop = null;
      }

      const fromAvailable = !activeUnclaimed && streamMatchesActive
        ? pickTimedDrop(available, preferredGame || gameName)
        : null;

      // Progress display follows live Inventory plus a session only when the
      // session belongs to the same campaign or exact Drop as the active target.
      // Same-game session data from another campaign remains diagnostic-only.
      const liveInventoryDrop = activeUnclaimed
        ? findActiveDropInCampaigns(inventoryCampaigns, currentDrop)
        : null;
      const preferredInventory = liveInventoryDrop || (
        activeUnclaimed ? null : pickTimedDrop(inventoryCampaigns, preferredGame)
      );
      const fromInventory = preferredInventory || (
        activeUnclaimed ? null : pickTimedDrop(inventoryCampaigns, "")
      );
      const sessionIdentity = activeUnclaimed && sessionDrop
        ? dropIdentityMatchesTarget(sessionDrop, currentDrop)
        : { matchesTarget: Boolean(sessionDrop) };
      const matchingSessionDrop = sessionIdentity.matchesTarget ? sessionDrop : null;

      let drop = activeUnclaimed
        ? (liveInventoryDrop || currentDrop)
        : (sessionDrop || fromInventory || fromAvailable);

      if (
        matchingSessionDrop &&
        streamMatchesActive &&
        (liveInventoryDrop || fromInventory || activeUnclaimed)
      ) {
        const inventorySide = liveInventoryDrop || fromInventory || {
          id: currentDrop?.id || matchingSessionDrop.id || "",
          name: currentDrop?.name || matchingSessionDrop.name,
          game: currentDrop?.game || matchingSessionDrop.game || gameName,
          gameSlug: currentDrop?.gameSlug || matchingSessionDrop.gameSlug || "",
          campaignId: currentDrop?.campaignId || matchingSessionDrop.campaignId || "",
          campaignKey: currentDrop?.campaignKey || matchingSessionDrop.campaignKey || "",
          campaign: currentDrop?.campaign || matchingSessionDrop.campaign || "",
          campaignStartAt: currentDrop?.campaignStartAt || matchingSessionDrop.campaignStartAt || "",
          campaignEndAt: currentDrop?.campaignEndAt || matchingSessionDrop.campaignEndAt || "",
          dropStartAt: currentDrop?.dropStartAt || matchingSessionDrop.dropStartAt || "",
          dropEndAt: currentDrop?.dropEndAt || matchingSessionDrop.dropEndAt || "",
          requiredMinutes: currentDrop?.requiredMinutes || matchingSessionDrop.requiredMinutes || 0,
          currentMinutes: Number(currentDrop?.currentMinutes || 0),
          dropInstanceID: currentDrop?.dropInstanceID || "",
          isClaimed: Boolean(currentDrop?.isClaimed),
        };
        const minutes = reconcileDropProgress(matchingSessionDrop, inventorySide, {
          inventoryLive: Boolean(liveInventoryDrop || fromInventory),
          sessionEligible: true,
        });
        const requiredMinutes = inventorySide.requiredMinutes || matchingSessionDrop.requiredMinutes || 0;
        drop = {
          ...inventorySide,
          ...matchingSessionDrop,
          id: inventorySide.id || matchingSessionDrop.id || currentDrop?.id || "",
          name: inventorySide.name || matchingSessionDrop.name,
          game: inventorySide.game || matchingSessionDrop.game || gameName,
          gameSlug: inventorySide.gameSlug || matchingSessionDrop.gameSlug || "",
          campaignId: inventorySide.campaignId || matchingSessionDrop.campaignId || "",
          campaignKey: inventorySide.campaignKey || matchingSessionDrop.campaignKey || "",
          campaign: inventorySide.campaign || matchingSessionDrop.campaign || "",
          campaignStartAt: inventorySide.campaignStartAt || matchingSessionDrop.campaignStartAt || "",
          campaignEndAt: inventorySide.campaignEndAt || matchingSessionDrop.campaignEndAt || "",
          dropStartAt: inventorySide.dropStartAt || matchingSessionDrop.dropStartAt || "",
          dropEndAt: inventorySide.dropEndAt || matchingSessionDrop.dropEndAt || "",
          requiredMinutes,
          currentMinutes: minutes,
          dropInstanceID: matchingSessionDrop.dropInstanceID || inventorySide.dropInstanceID || "",
          isClaimed: Boolean(matchingSessionDrop.isClaimed || inventorySide.isClaimed),
        };
        drop.percent = dropProgressPercent(minutes, requiredMinutes, drop.percent);
        drop.remainingMinutes = Math.max(0, requiredMinutes - minutes);
      } else if (liveInventoryDrop || fromInventory) {
        const inventorySide = liveInventoryDrop || fromInventory;
        const sessionEligible = Boolean(!activeUnclaimed || sessionIdentity.matchesTarget);
        const minutes = reconcileDropProgress(sessionDrop, inventorySide, {
          inventoryLive: true,
          sessionEligible,
          sessionRejectedReason: sessionDrop && !sessionEligible
            ? (sessionIdentity.mismatchReason || "different-campaign-or-drop")
            : "",
        });
        const requiredMinutes = Number(inventorySide.requiredMinutes || drop?.requiredMinutes || 0);
        drop = {
          ...(drop || {}),
          ...inventorySide,
          id: inventorySide.id || drop?.id || currentDrop?.id || "",
          campaignId: inventorySide.campaignId || drop?.campaignId || currentDrop?.campaignId || "",
          campaignKey: inventorySide.campaignKey || drop?.campaignKey || currentDrop?.campaignKey || "",
          campaign: inventorySide.campaign || drop?.campaign || currentDrop?.campaign || "",
          game: inventorySide.game || drop?.game || currentDrop?.game || preferredGame || "",
          gameSlug: inventorySide.gameSlug || drop?.gameSlug || currentDrop?.gameSlug || "",
          rewardImage: inventorySide.rewardImage || drop?.rewardImage || currentDrop?.rewardImage || "",
          requiredMinutes,
          currentMinutes: minutes,
          percent: dropProgressPercent(minutes, requiredMinutes, inventorySide.percent ?? drop?.percent),
          remainingMinutes: Math.max(0, requiredMinutes - minutes),
          isClaimed: Boolean(inventorySide.isClaimed || drop?.isClaimed),
        };
      } else if (sessionDrop) {
        reconcileDropProgress(sessionDrop, activeUnclaimed ? currentDrop : null, {
          inventoryLive: false,
          sessionEligible: Boolean(!activeUnclaimed || sessionIdentity.matchesTarget),
          sessionRejectedReason: activeUnclaimed && !sessionIdentity.matchesTarget
            ? (sessionIdentity.mismatchReason || "different-campaign-or-drop")
            : "",
        });
      }

      if (drop) applyDrop(drop);
      reconcileRoutingTargetWithCurrentDrop("gql-refresh");
      restoreVerifiedEarningFromSession(login, sessionDrop, gameName);

      // 3.1: GQL refresh updates data only. The routing controller decides what happens next.

      if (drop) {
        setStatus(dropActivityStatus(drop, login));
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
      if (!pollContextIsCurrent(requestContext)) return;
      if (!inventoryReadCompleted) acceptInventoryResponse(error?.inventoryRow || { data: null }, "inventory-request-failed");
      lastGqlError = error?.message || String(error);
      logActivity("poll-error", "Drop state refresh failed", { message: lastGqlError, reason: lastGqlReason || null });
      if (error.message === "Not logged in") {
        setStatus("Waiting for Twitch login…");
      } else if (lastTwitchGqlAt && Date.now() - lastTwitchGqlAt < 120000) {
        setStatus(`Watching ${watchingLogin() || "stream"} · tracking via Twitch`);
      } else if (matchingLiveDropStream() || holdingVerifiedDropStream()) {
        setStatus(`Watching ${watchingLogin() || "stream"} · waiting for Drop credit`);
      } else {
        setStatus(`Drops update failed: ${error.message}`);
      }
      refreshDropCard();
    }
  }

  function applyDrop(drop) {
    if (!drop) return;
    if (!dropMatchesLockedHandoff(drop)) return;
    drop = reconcileDropIdentity(drop);
    if (isSyntheticWaitingDrop(drop)) return;
    const previousDrop = currentDrop;

    // Same Drop identity: prefer exact Twitch Drop IDs. Only fall back to
    // campaign + name when one side does not have an authoritative Drop ID.
    const previousDropId = cleanText(previousDrop?.id);
    const incomingDropId = cleanText(drop?.id);
    const sameCampaignAndName = Boolean(
      previousDrop &&
      drop &&
      cleanText(previousDrop.campaignKey || previousDrop.campaignId) &&
      cleanText(previousDrop.campaignKey || previousDrop.campaignId) === cleanText(drop.campaignKey || drop.campaignId) &&
      cleanText(previousDrop.name).toLowerCase() === cleanText(drop.name).toLowerCase()
    );
    const sameDrop = Boolean(
      previousDrop &&
      drop &&
      (
        (previousDropId && incomingDropId)
          ? previousDropId === incomingDropId
          : sameCampaignAndName
      )
    );
    const previousMinutes = Number(previousDrop?.currentMinutes);
    const incomingMinutes = Number(drop.currentMinutes);
    if (
      sameDrop &&
      !drop.isClaimed &&
      Number.isFinite(previousMinutes) &&
      previousMinutes > 0 &&
      (!Number.isFinite(incomingMinutes) || incomingMinutes < previousMinutes)
    ) {
      const requiredMinutes = Number(drop.requiredMinutes || previousDrop.requiredMinutes || 0);
      drop = {
        ...drop,
        currentMinutes: previousMinutes,
        requiredMinutes,
        percent: dropProgressPercent(previousMinutes, requiredMinutes, previousDrop.percent),
        remainingMinutes: Math.max(0, requiredMinutes - previousMinutes),
        dropInstanceID: drop.dropInstanceID || previousDrop.dropInstanceID || "",
      };
    }

    if (sameDrop && previousDrop?.rewardImage && !dropBenefitImage(drop)) {
      drop = { ...drop, rewardImage: previousDrop.rewardImage };
    }

    const percent = dropProgressPercent(drop.currentMinutes, drop.requiredMinutes, drop.percent);
    currentDrop = { ...drop, percent };
    if (currentDrop.isClaimed || !dropProgressComplete(currentDrop)) resetClaimReadyTimer();
    const resolvedGameSlug = resolveCategorySlug(currentDrop);
    if (resolvedGameSlug) currentDrop.gameSlug = resolvedGameSlug;

    const changedDrop = previousDrop?.id !== currentDrop.id || previousDrop?.name !== currentDrop.name;
    const changedDropId = Boolean(
      previousDropId &&
      incomingDropId &&
      previousDropId !== incomingDropId
    );
    const sameCampaign = Boolean(
      previousDrop &&
      cleanText(previousDrop.campaignKey || previousDrop.campaignId) &&
      cleanText(previousDrop.campaignKey || previousDrop.campaignId) === cleanText(currentDrop.campaignKey || currentDrop.campaignId)
    );
    const changedPercent = Number(previousDrop?.percent ?? -1) !== Number(percent);
    const currentMinutes = Number(currentDrop.currentMinutes);
    const creditedMinuteAdvanced = Boolean(
      sameDrop &&
      Number.isFinite(currentMinutes) &&
      Number.isFinite(previousMinutes) &&
      currentMinutes > previousMinutes
    );

    if (changedDropId && sameCampaign) {
      const routing = readRoutingControllerSession();
      if (
        routing.state === ROUTING_STATES.EARNING ||
        routing.state === ROUTING_STATES.VERIFY_STREAM
      ) {
        writeRoutingControllerSession({
          ...routing,
          ...routingControllerTargetFromDrop(currentDrop),
          targetStream: routing.targetStream || watchingLogin() || "",
          verifyBaselineMinutes: Number(currentDrop.currentMinutes || 0),
          verifyBaselinePercent: Number(currentDrop.percent || 0),
        });
        logActivity("drop-stage-advanced", "Twitch advanced to the next Drop stage in the active campaign", {
          campaign: currentDrop.campaign || null,
          game: currentDrop.game || null,
          previousDropId,
          currentDropId: incomingDropId,
          currentMinutes: Number(currentDrop.currentMinutes || 0),
          requiredMinutes: Number(currentDrop.requiredMinutes || 0),
        });
      }
    }

    if (creditedMinuteAdvanced) {
      const login = watchingLogin();
      const info = login ? readStreamInfo() : null;
      const streamGame = cleanText(info?.game || "");
      const targetGame = cleanText(currentDrop?.game || "");
      const gameMatched = Boolean(
        streamGame &&
        targetGame &&
        gameNamesMatch(targetGame, streamGame)
      );

      if (login && gameMatched) {
        const routing = readRoutingControllerSession();
        const evidence = routing.candidateEvidence || {};
        const campaignSupported = Boolean(
          evidence.gqlCampaignSupported ||
          evidence.gqlSessionCampaignMatched ||
          evidence.gqlSessionDropMatched
        );
        lastStreamVerification = {
          at: Date.now(),
          method: "credited-progress",
          dropId: currentDrop?.id || null,
          channel: login,
          game: targetGame || null,
          campaign: currentDrop?.campaign || null,
          campaignKey: currentDrop?.campaignKey || currentDrop?.campaignId || null,
          proof: {
            gameMatched: true,
            campaignSupported,
            progressConfirmed: true,
          },
          currentMinutes,
          requiredMinutes: Number(currentDrop?.requiredMinutes || 0),
          currentPercent: percent,
        };
      }
    }

    if (changedDrop || changedPercent) {
      logActivity("progress", `${currentDrop.name || "Drop"} · ${percent}%`, {
        game: currentDrop.game || null,
        currentMinutes: currentDrop.currentMinutes || 0,
        requiredMinutes: currentDrop.requiredMinutes || 0,
      });
    } else if (creditedMinuteAdvanced) {
      logActivity("progress-minute", `${currentDrop.name || "Drop"} · ${currentMinutes} / ${currentDrop.requiredMinutes || "?"} min`, {
        game: currentDrop.game || null,
        currentMinutes,
        requiredMinutes: currentDrop.requiredMinutes || 0,
        percent,
      });
    }

    writeSession("tdh-drop", currentDrop);
    saveRecoverySnapshot('progress');
    reconcileRoutingTargetWithCurrentDrop("apply-drop");
    progressLabel = `${percent}%`;

    if (changedDrop || percent !== lastProgress || creditedMinuteAdvanced) {
      lastProgress = percent;
      lastProgressAt = Date.now();
      writeSession("tdh-progress", percent);
      writeSession("tdh-progress-at", lastProgressAt);
      if (watchingLogin()) lastCheckedAt = lastProgressAt;
    }

    syncProgressSurfaces();
    refreshDropCard();
    layoutChrome();
    maybeClaimCurrentDrop(currentDrop);
  }

