  function watchingLogin() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (!parts.length || RESERVED.has(parts[0].toLowerCase())) return "";
    return parts[0].toLowerCase();
  }

  // Twitch replaces its persisted-query hashes every few weeks, and an old hash
  // can keep answering with an outdated shape instead of failing. Twitch's own
  // page always sends the current ones, so Dropper learns each operation's hash
  // and variable names (never values) from the page's requests and prefers them
  // over the built-in GQL_OPS hashes.
  const GQL_LEARNED_OPERATIONS_KEY = "dropper-gql-operations-v1";
  const GQL_HASH_PATTERN = /^[a-f0-9]{64}$/;
  const gqlOperationHealth = {};
  let gqlLearnedOperations = (() => {
    try { return JSON.parse(localStorage.getItem(GQL_LEARNED_OPERATIONS_KEY) || "{}") || {}; } catch (_) { return {}; }
  })();

  function builtInGqlOperation(name) {
    return Object.values(GQL_OPS).find((op) => op.name === name) || null;
  }

  function learnedGqlOperation(name) {
    const learned = gqlLearnedOperations[name];
    return learned && GQL_HASH_PATTERN.test(learned.hash || "") ? learned : null;
  }

  function saveLearnedGqlOperations() {
    if (productResetting) return;
    try { localStorage.setItem(GQL_LEARNED_OPERATIONS_KEY, JSON.stringify(gqlLearnedOperations)); } catch (_) { /* storage full or blocked */ }
  }

  // Dropper's own requests only ever carry the built-in or the learned hash, so
  // a different hash that Twitch answered with data can only be Twitch's own.
  function learnGqlOperationsFromPage(operations, rows) {
    if (!Array.isArray(operations) || !Array.isArray(rows)) return;
    let changed = false;
    operations.forEach((operation, index) => {
      const name = cleanText(operation?.name);
      const hash = cleanText(operation?.hash).toLowerCase();
      const builtIn = builtInGqlOperation(name);
      if (!builtIn || !GQL_HASH_PATTERN.test(hash) || hash === builtIn.hash) return;
      const row = rows[index];
      if (!row?.data || (Array.isArray(row.errors) && row.errors.length)) return;
      const expected = GQL_EXPECTED_SHAPES[name];
      if (expected && !expected(row.data)) return;
      if (learnedGqlOperation(name)?.hash === hash) return;
      gqlLearnedOperations[name] = {
        hash,
        variableKeys: (operation.variableKeys || []).map((key) => cleanText(key)).filter(Boolean).slice(0, 20),
        learnedAt: Date.now(),
      };
      changed = true;
      logActivity("gql-operation", `Learned Twitch's current ${name} request`, { operation: name, hash: hash.slice(0, 12) });
    });
    if (changed) saveLearnedGqlOperations();
  }

  function noteGqlOperationResult(name, result, detail = "") {
    if (!name) return;
    gqlOperationHealth[name] = { result, detail: cleanText(detail).slice(0, 160), at: Date.now() };
  }

  // A learned hash Twitch no longer recognises is dropped so the next request
  // falls back to the built-in one until the page shows a newer hash.
  function forgetLearnedGqlOperation(name, reason, expectedHash = "") {
    const learned = learnedGqlOperation(name);
    if (!learned || (expectedHash && learned.hash !== expectedHash)) return;
    delete gqlLearnedOperations[name];
    saveLearnedGqlOperations();
    logActivity("gql-operation", `Dropped the learned ${name} request`, { operation: name, reason });
  }

  function gqlOperationsSnapshot() {
    return Object.fromEntries(Object.values(GQL_OPS).map((op) => {
      const learned = learnedGqlOperation(op.name);
      const health = gqlOperationHealth[op.name] || null;
      return [op.name, {
        source: learned ? "learned-from-twitch" : "built-in",
        hash: (learned?.hash || op.hash).slice(0, 12),
        learnedAt: learned?.learnedAt ? new Date(learned.learnedAt).toISOString() : null,
        lastResult: health?.result || null,
        lastDetail: health?.detail || null,
        lastAt: health?.at ? new Date(health.at).toISOString() : null,
      }];
    }));
  }

  function gqlPayload(op, variables) {
    const learned = learnedGqlOperation(op.name);
    // Built-in default variables the current query no longer declares are left
    // out; callers' explicit variables always go through.
    const defaults = learned
      ? Object.fromEntries(Object.entries(op.variables || {}).filter(([key]) => learned.variableKeys.includes(key)))
      : op.variables;
    return {
      operationName: op.name,
      variables: { ...defaults, ...(variables || {}) },
      extensions: { persistedQuery: { version: 1, sha256Hash: learned?.hash || op.hash } },
    };
  }

  let clientIntegrity = { token: "", clientId: "", expiresAt: 0, transport: "", deviceId: "" };
  let integrityRequest = null;
  let lastIntegrityTransport = "";

  function twitchDeviceId() {
    return (
      cleanText(twitchNetworkCapture.deviceId) ||
      cookie("unique_id") ||
      cookie("unique_id_durable") ||
      "tdh-device"
    );
  }

  function integrityExpiresAt(expiration, now = Date.now()) {
    const value = Number(expiration || 0);
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return now + 10 * 60 * 1000;
  }

  function parseIntegrityPayload(json, status = 200) {
    if (status < 200 || status >= 300) return null;
    const token = cleanText(json?.token || "");
    if (!token) return null;
    return { token, expiresAt: integrityExpiresAt(json?.expiration) };
  }

  function normalizeHeaderMap(headers) {
    const out = {};
    if (!headers) return out;
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      headers.forEach((value, key) => {
        out[String(key).toLowerCase()] = String(value);
      });
      return out;
    }
    if (Array.isArray(headers)) {
      for (const entry of headers) {
        if (!entry || entry.length < 2) continue;
        out[String(entry[0]).toLowerCase()] = String(entry[1]);
      }
      return out;
    }
    if (typeof headers === "object") {
      for (const [key, value] of Object.entries(headers)) {
        if (value == null) continue;
        out[String(key).toLowerCase()] = String(value);
      }
    }
    return out;
  }

  function captureTwitchNetworkHeaders(headers) {
    const map = normalizeHeaderMap(headers);
    if (map["client-integrity"]) {
      twitchNetworkCapture.integrity = map["client-integrity"];
      twitchNetworkCapture.integrityExpiresAt = Math.max(
        Number(twitchNetworkCapture.integrityExpiresAt || 0),
        Date.now() + 10 * 60 * 1000,
      );
    }
    if (map["client-id"]) twitchNetworkCapture.clientId = map["client-id"];
    if (map["x-device-id"] || map["device-id"]) {
      twitchNetworkCapture.deviceId = map["x-device-id"] || map["device-id"];
    }
    if (map["client-session-id"]) twitchNetworkCapture.sessionId = map["client-session-id"];
    if (map["client-version"]) twitchNetworkCapture.clientVersion = map["client-version"];
    if (map.authorization) {
      twitchNetworkCapture.auth = map.authorization.replace(/^OAuth\s+/i, "");
    }
  }

  function capturedIntegrityToken(clientId = "", now = Date.now()) {
    const token = cleanText(twitchNetworkCapture.integrity);
    if (!token) return "";
    if (Number(twitchNetworkCapture.integrityExpiresAt || 0) && Number(twitchNetworkCapture.integrityExpiresAt) <= now) {
      return "";
    }
    if (clientId && twitchNetworkCapture.clientId && twitchNetworkCapture.clientId !== clientId) {
      return "";
    }
    return token;
  }

  function adoptCapturedIntegrity(clientId, transport = "page") {
    const token = capturedIntegrityToken(clientId);
    if (!token) return "";
    const expiresAt = Number(twitchNetworkCapture.integrityExpiresAt || 0) || Date.now() + 10 * 60 * 1000;
    storeClientIntegrity(clientId || twitchNetworkCapture.clientId || CLIENT_IDS[0], token, expiresAt, transport);
    return token;
  }

  function ingestTwitchGqlRows(rows, source = "twitch-page-intercept", operations = []) {
    if (!Array.isArray(rows) || !rows.length) return false;
    let touched = false;
    let inventoryRow = null;
    let dashboardCampaigns = null;
    let sessionRow = null;
    let availableCampaigns = null;

    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== "object") continue;
      const data = row.data;
      if (operations?.[index]?.name === "Inventory" ||
          Object.prototype.hasOwnProperty.call(data?.currentUser || {}, "inventory")) {
        inventoryRow = row;
        touched = true;
      }
      if (!data || typeof data !== "object" || (Array.isArray(row.errors) && row.errors.length)) continue;
      const dashboard = data.currentUser?.dropCampaigns;
      if (Array.isArray(dashboard)) {
        dashboardCampaigns = dashboard;
        touched = true;
      }
      if (
        data.currentUser?.dropCurrentSession ||
        data.currentUser?.dropCurrentSessionContext ||
        data.currentUser?.dropCurrentSession?.currentSession
      ) {
        sessionRow = row;
        touched = true;
      }
      const available = data.channelDropCampaigns || data.channel?.viewerDropCampaigns || data.user?.viewerDropCampaigns || data.channel?.dropCampaigns;
      if (Array.isArray(available)) {
        nativeRewardClaimEvidence(null, available);
        availableCampaigns = available;
        touched = true;
      }
    }

    if (!touched) return false;

    // Observing an Inventory error is not evidence that the data service has
    // recovered. Only successful read data can clear the network failure state.
    const hasFreshRead = Boolean(
      (inventoryRow && inventoryResponseState(inventoryRow).valid) ||
      dashboardCampaigns || sessionRow || availableCampaigns
    );
    if (hasFreshRead) {
      lastTwitchGqlAt = Date.now();
      lastGqlSuccessAt = Date.now();
      lastGqlError = "";
      clearGqlFailurePause(source);
      networkState.consecutiveFailures = 0;
      persistNetworkState();
    }

    if (Array.isArray(dashboardCampaigns)) {
      lastCampaignDashboardAt = Date.now();
      replaceCatalogFromDashboard(dashboardCampaigns, source);
      const open = openDashboardCampaigns(dashboardCampaigns);
      if (open.length && (open.length >= PAGE_CAMPAIGN_IMPORT_MIN || isCampaigns() || needsCampaignPageImport())) {
        markCampaignPageImport(open.length, source, CAMPAIGN_PAGE_DISPLAY.GQL_AUTH);
      }
    }
    if (inventoryRow) acceptInventoryResponse(inventoryRow, source);

    const campaignPool = mergeCampaigns(
      lastCampaignCatalog,
      mergeCampaigns(lastInventoryCampaigns, availableCampaigns || []),
    );
    const routingController = isAutoRoutingController();
    if (!routingController) noteDeferredAutoRouting("page-gql-deferred");
    const sessionDrop = sessionRow ? parseSessionDrop(sessionRow, mergeCampaigns(routingCampaignPool(), availableCampaigns || [])) : null;
    if (sessionRow) recordRewardSessionResolution(sessionDrop, routingCampaignPool());
    if (routingController && Array.isArray(availableCampaigns)) {
      updateRoutingCampaignSupportEvidence(watchingLogin(), availableCampaigns, sessionDrop);
    }
    if (currentDrop) {
      const liveInventoryDrop = inventoryResponseHealth.valid ? findActiveDropInCampaigns(lastInventoryCampaigns, currentDrop) : null;
      const sessionIdentity = sessionDrop
        ? dropIdentityMatchesTarget(sessionDrop, currentDrop)
        : { matchesTarget: false };
      if (liveInventoryDrop) {
        const matchingSession = sessionIdentity.matchesTarget ? sessionDrop : null;
        const minutes = reconcileDropProgress(sessionDrop, liveInventoryDrop, {
          inventoryLive: true,
          sessionEligible: sessionIdentity.matchesTarget,
          sessionRejectedReason: sessionDrop && !sessionIdentity.matchesTarget
            ? "different-campaign-or-drop"
            : "",
        });
        const requiredMinutes = Number(liveInventoryDrop.requiredMinutes || matchingSession?.requiredMinutes || 0);
        applyDrop({
          ...liveInventoryDrop,
          ...(matchingSession || {}),
          id: liveInventoryDrop.id || matchingSession?.id || currentDrop.id || "",
          name: liveInventoryDrop.name || matchingSession?.name || currentDrop.name || "Drop",
          game: liveInventoryDrop.game || matchingSession?.game || currentDrop.game || "",
          campaignKey: liveInventoryDrop.campaignKey || currentDrop.campaignKey || "",
          campaignId: liveInventoryDrop.campaignId || currentDrop.campaignId || "",
          campaign: liveInventoryDrop.campaign || currentDrop.campaign || "",
          rewardImage: liveInventoryDrop.rewardImage || currentDrop.rewardImage || matchingSession?.rewardImage || "",
          requiredMinutes,
          currentMinutes: minutes,
          percent: dropProgressPercent(minutes, requiredMinutes),
          remainingMinutes: Math.max(0, requiredMinutes - minutes),
          dropInstanceID: matchingSession?.dropInstanceID || liveInventoryDrop.dropInstanceID || currentDrop.dropInstanceID || "",
        });
        setStatus(dropActivityStatus(liveInventoryDrop || currentDrop));
      } else if (sessionDrop && sessionIdentity.matchesTarget) {
        applyDrop(sessionDrop);
        setStatus(dropActivityStatus(sessionDrop));
      } else if (sessionDrop) {
        reconcileDropProgress(sessionDrop, currentDrop, {
          inventoryLive: false,
          sessionEligible: false,
          sessionRejectedReason: "different-campaign-or-drop",
        });
      }
    } else if (sessionDrop) {
      applyDrop(sessionDrop);
      setStatus(dropActivityStatus(sessionDrop));
    }

    refreshDropCard();
    return true;
  }

  // Page events are untrusted. The correlation token is not authentication.
  // Bound traversal before copying, and expose only the fields Drops consumes.
  function validateTwitchBridgePayload(detail, correlation) {
    try {
      if (!detail || detail.secret !== correlation) return null;
      const url = new URL(detail.url, location.href);
      if (url.protocol !== 'https:' || url.hostname !== 'gql.twitch.tv' || url.port || url.username || url.password ||
          !['/gql', '/integrity'].includes(url.pathname) || url.search || url.hash) return null;
      if (detail.requestScope?.account !== storageAccountLogin() || detail.requestScope?.path !== location.pathname) return null;
      if (!Number.isInteger(detail.status) || detail.status < 200 || detail.status >= 300) return null;
      const seen = new Set();
      let nodes = 0, bytes = 0;
      const bounded = (value, depth = 0) => {
        if (++nodes > 100000 || depth > 32) return false;
        if (value == null || typeof value === 'boolean') return true;
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'string') { bytes += value.length * 2; return bytes <= 2 * 1024 * 1024; }
        if (typeof value !== 'object' || seen.has(value)) return false;
        seen.add(value);
        if (Array.isArray(value) && value.length > 10000) return false;
        for (const [key, property] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
          bytes += key.length * 2 + 16;
          if (bytes > 2 * 1024 * 1024 || ['__proto__', 'constructor', 'prototype'].includes(key) ||
              !Object.hasOwn(property, 'value') || !bounded(property.value, depth + 1)) return false;
        }
        return true;
      };
      if (!bounded(detail.json) || !bounded(detail.headers || {}) || !bounded(detail.operations)) return null;
      const headers = {};
      const limits = {'client-id': 64, 'client-integrity': 8192, 'x-device-id': 128, 'device-id': 128, 'client-session-id': 128, 'client-version': 128};
      for (const [key, value] of Object.entries(detail.headers || {})) {
        const name = key.toLowerCase();
        if (!Object.hasOwn(limits, name)) continue;
        if (typeof value !== 'string' || !value.length || value.length > limits[name] || !/^[\x21-\x7e]+$/.test(value)) return null;
        headers[name] = value;
      }
      if (headers['client-id'] && !CLIENT_IDS.includes(headers['client-id'])) return null;
      if (url.pathname === '/integrity') {
        const token = detail.json?.token, expiration = detail.json?.expiration;
        const expiresAt = expiration > 1e12 ? expiration : expiration * 1000;
        if (typeof token !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(token) ||
            !Number.isFinite(expiration) || expiresAt <= Date.now() || expiresAt > Date.now() + 24 * 60 * 60 * 1000) return null;
        return {url: url.href, headers, status: detail.status, json: {token, expiration}, operations: null};
      }
      const rows = Array.isArray(detail.json) ? detail.json : [detail.json];
      const operations = detail.operations;
      if (!Array.isArray(operations) || !operations.length || operations.length > 50 || rows.length !== operations.length) return null;
      const supported = new Set(Object.values(GQL_OPS).map(op => op.name));
      const selectedRows = [], selectedOperations = [];
      const pick = (value, keys) => value === null ? null : value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) : undefined;
      for (let index = 0; index < operations.length; index++) {
        const op = operations[index], row = rows[index];
        if (!op || typeof op.name !== 'string' || op.name.length > 80 || !/^[a-f0-9]{64}$/i.test(op.hash || '') ||
            !Array.isArray(op.variableKeys) || op.variableKeys.length > 20 ||
            op.variableKeys.some(key => typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))) return null;
        if (!supported.has(op.name)) continue;
        if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
        if ((!Object.hasOwn(row, 'data') && !(Array.isArray(row.errors) && row.errors.length)) ||
            (Object.hasOwn(row, 'data') && row.data !== null && (typeof row.data !== 'object' || Array.isArray(row.data))) ||
            (Object.hasOwn(row, 'errors') && !Array.isArray(row.errors))) return null;
        const data = pick(row.data, ['currentUser', 'channelDropCampaigns', 'channel', 'user', 'dropCampaign', 'claimDropRewards']);
        if (data?.currentUser) data.currentUser = pick(data.currentUser, ['inventory', 'dropCampaigns', 'dropCurrentSession', 'dropCurrentSessionContext']);
        if (data?.channel) data.channel = pick(data.channel, ['viewerDropCampaigns', 'dropCampaigns']);
        if (data?.user) data.user = pick(data.user, ['viewerDropCampaigns', 'dropCampaign', 'id', 'login', 'displayName', 'stream', 'broadcastSettings']);
        if (data?.claimDropRewards) data.claimDropRewards = pick(data.claimDropRewards, ['status']);
        selectedRows.push({data, ...(Array.isArray(row.errors) ? {errors: row.errors.slice(0, 10).map(error => ({message: typeof error?.message === 'string' ? error.message.slice(0, 240) : 'Twitch request failed'}))} : {})});
        selectedOperations.push({name: op.name, hash: op.hash.toLowerCase(), variableKeys: [...op.variableKeys]});
      }
      return selectedRows.length ? {url: url.href, headers, status: detail.status, json: selectedRows, operations: selectedOperations} : null;
    } catch (_) { return null; }
  }

  function handleInterceptedTwitchPayload(url, headers, json, status = 200, operations = null) {
    captureTwitchNetworkHeaders(headers);
    if (!json) return;
    if (String(url || "").includes("/integrity")) {
      const parsed = parseIntegrityPayload(json, status);
      if (parsed) {
        twitchNetworkCapture.integrity = parsed.token;
        twitchNetworkCapture.integrityExpiresAt = parsed.expiresAt;
        const clientId = twitchNetworkCapture.clientId || CLIENT_IDS[0];
        storeClientIntegrity(clientId, parsed.token, parsed.expiresAt, "page");
      }
      return;
    }
    if (status >= 200 && status < 300) {
      try { learnGqlOperationsFromPage(operations, Array.isArray(json) ? json : [json]); } catch (_) { /* learning is best effort */ }
    }
    try {
      const rows = parseGqlRows(json, status);
      ingestTwitchGqlRows(rows, "twitch-page-intercept", operations || []);
    } catch (_) {
      /* ignore non-drops or error payloads from Twitch's own traffic */
    }
  }

  function twitchPageNetworkHook(channel, correlation, supportedNames) {
    if (window.__tdhTwitchNetHooked) return;
    window.__tdhTwitchNetHooked = 1;
    const limit = 1024 * 1024, supported = new Set(supportedNames);
    const endpoint = value => {
      try { const p = new URL(String(value || ''), location.href);
        return p.protocol === 'https:' && p.hostname==="gql.twitch.tv" && !p.port && !p.username && !p.password &&
          !p.search && !p.hash && ['/gql', '/integrity'].includes(p.pathname) ? p.pathname : ''; } catch (_) { return ''; }
    };
    const scope = () => {
      const get = key => {
        const value = document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith(key + '='));
        try { return value ? decodeURIComponent(value.slice(key.length + 1)) : ''; } catch (_) { return ''; }
      };
      return {account: (get('login') || get('name') || 'signed-out').toLowerCase(), path: location.pathname};
    };
    const headerNames = new Set(['client-id', 'client-integrity', 'x-device-id', 'device-id', 'client-session-id', 'client-version']);
    const headers = input => {
      const output = {};
      try { new Headers(input || {}).forEach((value, key) => { if (headerNames.has(key)) output[key] = value; }); } catch (_) {}
      return output;
    };
    const operations = body => {
      try {
        if (typeof body !== 'string' || body.length > limit) return null;
        const rows = [].concat(JSON.parse(body));
        if (!rows.length || rows.length > 50) return null;
        return rows.map(row => ({name: row?.operationName || '', hash: row?.extensions?.persistedQuery?.sha256Hash || '', variableKeys: Object.keys(row?.variables || {})}));
      } catch (_) { return null; }
    };
    const pick = (value, keys) => value === null ? null : value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) : undefined;
    const emit = (url, capturedHeaders, text, status, requestScope, ops) => {
      try {
        if (typeof text !== 'string' || text.length > limit || status < 200 || status >= 300) return;
        let json = JSON.parse(text), selectedOps = null;
        if (endpoint(url) === '/integrity') json = pick(json, ['token', 'expiration']);
        else {
          const rows = [].concat(json);
          if (!ops || rows.length !== ops.length) return;
          json = []; selectedOps = [];
          ops.forEach((op, index) => {
            if (!supported.has(op.name)) return;
            const row = rows[index], data = pick(row?.data, ['currentUser', 'channelDropCampaigns', 'channel', 'user', 'dropCampaign', 'claimDropRewards']);
            if (data?.currentUser) data.currentUser = pick(data.currentUser, ['inventory', 'dropCampaigns', 'dropCurrentSession', 'dropCurrentSessionContext']);
            if (data?.channel) data.channel = pick(data.channel, ['viewerDropCampaigns', 'dropCampaigns']);
            if (data?.user) data.user = pick(data.user, ['viewerDropCampaigns', 'dropCampaign', 'id', 'login', 'displayName', 'stream', 'broadcastSettings']);
            if (data?.claimDropRewards) data.claimDropRewards = pick(data.claimDropRewards, ['status']);
            json.push({data, ...(Array.isArray(row?.errors) ? {errors: row.errors.slice(0, 10).map(error => ({message: String(error?.message || 'Twitch request failed').slice(0, 240)}))} : {})});
            selectedOps.push(op);
          });
          if (!json.length) return;
        }
        window.dispatchEvent(new CustomEvent(channel, {detail: {secret: correlation, url, headers: capturedHeaders, json, status, requestScope, operations: selectedOps}}));
      } catch (_) {}
    };
    const nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function') window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url || String(input || '');
      if (!endpoint(url)) return nativeFetch.apply(this, arguments);
      const capturedHeaders = headers(init?.headers || input?.headers), requestScope = scope();
      let body = Promise.resolve(init?.body);
      try { if (init?.body === undefined && typeof input?.clone === 'function') body = input.clone().text(); } catch (_) {}
      body = body.catch(() => undefined);
      return nativeFetch.apply(this, arguments).then(response => {
        try { Promise.all([response.clone().text(), body]).then(([text, requestBody]) => emit(url, capturedHeaders, text, response.status, requestScope, operations(requestBody))).catch(() => {}); } catch (_) {}
        return response;
      });
    };
    const X = window.XMLHttpRequest;
    if (typeof X !== 'function') return;
    const open = X.prototype.open, setHeader = X.prototype.setRequestHeader, send = X.prototype.send;
    X.prototype.open = function(method, url) {
      this.__tdhUrl = String(url || ''); this.__tdhHeaders = {};
      return open.apply(this, arguments);
    };
    X.prototype.setRequestHeader = function(name, value) {
      const key = String(name).toLowerCase();
      if (headerNames.has(key)) (this.__tdhHeaders ||= {})[key] = String(value);
      return setHeader.apply(this, arguments);
    };
    X.prototype.send = function(body) {
      if (endpoint(this.__tdhUrl)) {
        const requestScope = scope(), ops = operations(body), url = this.__tdhUrl, capturedHeaders = {...this.__tdhHeaders};
        this.addEventListener('load', () => {
          try { const text = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText;
            emit(url, capturedHeaders, text, this.status, requestScope, ops); } catch (_) {}
        }, {once: true});
      }
      return send.apply(this, arguments);
    };
  }

  function installTwitchNetworkHooks(uw = page) {
    if (twitchNetworkHooksInstalled || !uw) return;
    twitchNetworkHooksInstalled = true;

    const channel = "tdh-twitch-gql-intercept-v1";
    const secret = `tdh-${Math.random().toString(36).slice(2, 10)}`;
    const onPayload = (event) => {
      const detail = validateTwitchBridgePayload(event?.detail, secret);
      if (!detail) return;
      syncViewingContext();
      handleInterceptedTwitchPayload(detail.url, detail.headers || {}, detail.json, detail.status, detail.operations);
    };
    try { uw.addEventListener(channel, onPayload, true); } catch (_) { /* ignore */ }
    try { window.addEventListener(channel, onPayload, true); } catch (_) { /* ignore */ }

    // Page-world inject keeps ad-blocker failures off the Dropper.user.js stack.
    const injector = `(${twitchPageNetworkHook.toString()})(${JSON.stringify(channel)},${JSON.stringify(secret)},${JSON.stringify(Object.values(GQL_OPS).map(op => op.name))});`;

    twitchNetworkHookMode = "unavailable";
    try {
      const script = document.createElement("script");
      script.textContent = injector;
      (document.documentElement || document.head || document.body).appendChild(script);
      script.remove();
      if (uw.__tdhTwitchNetHooked) twitchNetworkHookMode = "page-script";
    } catch (_) {
      /* CSP may block injection; Dropper still polls GQL over GM. */
    }
    // Safari often strips inline script tags. Eval/Function on unsafeWindow
    // still installs the page-world hook without wrapping userscript fetch.
    if (twitchNetworkHookMode === "unavailable") {
      try {
        if (typeof uw.eval === "function") uw.eval(injector);
        else if (typeof uw.Function === "function") uw.Function(injector)();
        if (uw.__tdhTwitchNetHooked) twitchNetworkHookMode = "page-eval";
      } catch (_) {
        /* Safari userscripts may still be unable to hook page fetch. */
      }
    }
  }

  function cachedClientIntegrity(clientId, transport, now = Date.now()) {
    const deviceId = twitchDeviceId();
    if (
      clientIntegrity.clientId === clientId &&
      clientIntegrity.transport === transport &&
      clientIntegrity.deviceId === deviceId &&
      clientIntegrity.token &&
      Number(clientIntegrity.expiresAt || 0) - 60000 > now
    ) {
      return clientIntegrity.token;
    }
    const saved = readSession(CLIENT_INTEGRITY_KEY, null);
    if (
      !saved ||
      saved.clientId !== clientId ||
      saved.transport !== transport ||
      saved.deviceId !== deviceId ||
      !saved.token
    ) return "";
    if (Number(saved.expiresAt || 0) - 60000 <= now) return "";
    clientIntegrity = {
      token: String(saved.token),
      clientId,
      expiresAt: Number(saved.expiresAt),
      transport,
      deviceId,
    };
    return clientIntegrity.token;
  }

  function storeClientIntegrity(clientId, token, expiresAt, transport) {
    const deviceId = twitchDeviceId();
    clientIntegrity = { token, clientId, expiresAt, transport, deviceId };
    lastIntegrityTransport = transport;
    writeSession(CLIENT_INTEGRITY_KEY, { token, clientId, expiresAt, transport, deviceId });
  }

  function clearClientIntegrity({ clearCapture = false } = {}) {
    clientIntegrity = { token: "", clientId: "", expiresAt: 0, transport: "", deviceId: "" };
    integrityRequest = null;
    removeSession(CLIENT_INTEGRITY_KEY);
    if (clearCapture) {
      twitchNetworkCapture.integrity = "";
      twitchNetworkCapture.integrityExpiresAt = 0;
    }
  }

  function clientIntegritySnapshot(now = Date.now()) {
    const saved = clientIntegrity.token ? clientIntegrity : readSession(CLIENT_INTEGRITY_KEY, null);
    const expiresAt = Number(saved?.expiresAt || 0);
    return {
      cached: Boolean(saved?.token) && expiresAt - 60000 > now,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      transport: saved?.transport || lastIntegrityTransport || (twitchNetworkCapture.integrity ? "page" : null),
    };
  }

  async function postTwitchJson(url, { clientId, auth, integrity = "", body = null, transport = "page" } = {}) {
    const deviceId = twitchDeviceId();
    const headers = {
      "Client-ID": clientId,
      Authorization: `OAuth ${auth}`,
      "X-Device-Id": deviceId,
      "Device-ID": deviceId,
      "Content-Type": "application/json",
    };
    if (integrity) headers["Client-Integrity"] = integrity;
    if (twitchNetworkCapture.sessionId) headers["Client-Session-Id"] = twitchNetworkCapture.sessionId;
    if (twitchNetworkCapture.clientVersion) headers["Client-Version"] = twitchNetworkCapture.clientVersion;
    const payload = body == null ? "" : typeof body === "string" ? body : JSON.stringify(body);

    if (transport === "page") {
      if (typeof page.fetch !== "function") throw new Error("Twitch page fetch unavailable");
      // OAuth is already in Authorization. Including cookies makes browsers reject
      // Twitch's Access-Control-Allow-Origin: * response on gql.twitch.tv/integrity.
      const response = await page.fetch(url, {
        method: "POST",
        credentials: "omit",
        headers,
        body: payload,
      });
      let json = null;
      try { json = await response.json(); } catch (_) { json = null; }
      return { status: Number(response.status) || 0, json };
    }

    if (typeof GM_xmlhttpRequest !== "function") throw new Error("GM_xmlhttpRequest unavailable");
    headers.Origin = "https://www.twitch.tv";
    headers.Referer = "https://www.twitch.tv/";
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers,
        data: payload,
        timeout: 15000,
        onload(response) {
          let json = response.response;
          try {
            if (typeof json === "string") json = JSON.parse(json);
            if (!json && response.responseText) json = JSON.parse(response.responseText);
          } catch (_) {
            json = null;
          }
          resolve({ status: Number(response.status) || 0, json });
        },
        ontimeout() { reject(new Error("Twitch request timed out")); },
        onerror(response) {
          reject(new Error(`Twitch network error${response?.status ? ` (${response.status})` : ""}`));
        },
      });
    });
  }

  function preferredGqlTransports() {
    const transports = [];
    // GM bypasses CORS. Page fetch is useful only after Twitch has handed us a live token.
    if (typeof GM_xmlhttpRequest === "function") transports.push("gm");
    if (typeof page.fetch === "function") transports.push("page");
    if (capturedIntegrityToken() && transports.includes("page")) {
      return ["page", ...transports.filter((item) => item !== "page")];
    }
    if (lastIntegrityTransport && transports.includes(lastIntegrityTransport)) {
      return [lastIntegrityTransport, ...transports.filter((item) => item !== lastIntegrityTransport)];
    }
    return transports;
  }

  async function requestIntegrityToken(clientId, transport = "page") {
    const auth = getToken();
    if (!auth) throw new Error("Not logged in");
    const result = await postTwitchJson(INTEGRITY_URL, { clientId, auth, body: {}, transport });
    const parsed = parseIntegrityPayload(result.json, result.status);
    if (!parsed) throw new Error("Twitch integrity token missing");
    return { ...parsed, transport };
  }

  async function ensureClientIntegrity(clientId, { force = false, transport = "page" } = {}) {
    if (force) clearClientIntegrity({ clearCapture: true });
    if (!force) {
      const adopted = adoptCapturedIntegrity(clientId, transport === "gm" ? "page" : transport);
      if (adopted && transport === "page") return adopted;
      // Page-captured tokens stay on the page transport; GM mints its own.
      if (adopted && transport === "gm") {
        // Fall through to mint on GM.
      }
      const cached = cachedClientIntegrity(clientId, transport);
      if (cached) return cached;
      if (integrityRequest?.clientId === clientId && integrityRequest?.transport === transport) {
        return integrityRequest.promise;
      }
    }

    if (transport === "page") {
      // After a forced refresh, never re-adopt a rejected page-captured token.
      if (!force) {
        const adopted = adoptCapturedIntegrity(clientId, "page");
        if (adopted) return adopted;
      }
      // Never mint integrity through page.fetch — Twitch answers with ACAO:* which
      // browsers reject when credentials are involved, and page minting races Twitch's
      // own token. Fall through to the GM transport instead.
      throw new Error("Twitch page integrity unavailable");
    }

    const promise = requestIntegrityToken(clientId, transport)
      .then((result) => {
        storeClientIntegrity(clientId, result.token, result.expiresAt, transport);
        return result.token;
      })
      .finally(() => {
        if (integrityRequest?.promise === promise) integrityRequest = null;
      });
    integrityRequest = { clientId, transport, promise };
    return promise;
  }

  function isSoftGqlError(item) {
    const message = cleanText(item?.message || "");
    const code = cleanText(item?.extensions?.code || "");
    return (
      /failed integrity check|integritycheckfailed|service error/i.test(message)
      || /integritycheckfailed/i.test(code)
    );
  }

  function parseGqlRows(json, status = 200, { requests = null, allowInventoryFailure = false } = {}) {
    if (status < 200 || status >= 300) throw new Error(`GQL HTTP ${status}`);
    const rows = Array.isArray(json) ? json : [json];
    if (
      !rows.length ||
      rows.some(row =>
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        (!Object.prototype.hasOwnProperty.call(row, "data") && !Array.isArray(row.errors))
      )
    ) throw new Error("Malformed Twitch GQL response");
    if (requests && rows.length !== requests.length) {
      throw new Error("Twitch GQL response count does not match the request batch");
    }
    // Only the read-only polling path may retain sibling responses when the
    // Inventory document cannot be selected. Auth, integrity, HTTP and service
    // failures remain fatal, as do all errors in mutation-containing batches.
    const readOnly = Array.isArray(requests) && requests.length > 0 && requests.every((req) =>
      ["inventory", "viewerDropsDashboard", "streamInfo", "currentDrop", "availableDrops", "dropCampaignDetails"].includes(req?.op)
    );
    const hardErrors = [];
    for (const [index, row] of rows.entries()) {
      const errors = Array.isArray(row?.errors) ? row.errors : [];
      if (!errors.length) continue;
      const hasData = row?.data != null && typeof row.data === "object";
      if (hasData && errors.every(isSoftGqlError)) continue;
      if (allowInventoryFailure === true && readOnly && requests[index]?.op === "inventory" && gqlOperationFailureKind(row)) continue;
      hardErrors.push(...errors);
    }
    if (hardErrors.length) {
      const message = hardErrors
        .map((item) => cleanText(item?.message || ""))
        .filter(Boolean)
        .join(" · ");
      const error = new Error(message || "Twitch GQL error");
      error.gqlDefinitionFailure = hardErrors.every((item) => gqlOperationFailureKind({ errors: [item] }));
      const inventoryIndex = requests?.findIndex((req) => req?.op === "inventory") ?? -1;
      if (inventoryIndex >= 0 && Array.isArray(rows[inventoryIndex]?.errors) && rows[inventoryIndex].errors.length) {
        error.inventoryRow = rows[inventoryIndex];
      }
      throw error;
    }
    return rows;
  }

  // Validate operation responses without treating missing or unavailable data as
  // an empty inventory. A rejected shape alone does not prove a Twitch schema change.
  const GQL_EXPECTED_SHAPES = {
    Inventory: (data) => inventoryResponseState({ data }).valid,
    ViewerDropsDashboard: (data) => Array.isArray(data?.currentUser?.dropCampaigns) || data?.currentUser === null,
    ChannelDropsCampaigns: (data) => Array.isArray(data?.channelDropCampaigns),
    DropCurrentSessionContext: (data) => sessionResponseState({ data }).valid,
  };

  function sessionResponseState(row) {
    const data = row?.data;
    const user = data?.currentUser;
    const errors = Array.isArray(row?.errors) ? row.errors : [];
    const fields = value => value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value).filter(key => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)).slice(0, 12) : [];
    const type = value => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    const hasSession = Boolean(user && (Object.hasOwn(user, "dropCurrentSession") || Object.hasOwn(user, "dropCurrentSessionContext")));
    const session = user && Object.hasOwn(user, "dropCurrentSession") ? user.dropCurrentSession : user?.dropCurrentSessionContext;
    const node = session?.currentSession ?? session?.drop ?? session;
    const drop = node?.drop ?? node?.currentDrop ?? node;
    const nodeObject = Boolean(node && typeof node === "object" && !Array.isArray(node));
    const recognized = Boolean(nodeObject &&
      (drop?.id || drop?.name || node.dropID || session?.dropID));
    const expectedSessionFields = Boolean(nodeObject && [
      "dropID",
      "currentMinutesWatched",
      "requiredMinutesWatched",
      "channel",
      "game",
    ].some((key) => Object.hasOwn(node, key)));
    const inactive = nodeObject && !recognized && node.dropID === '' &&
      node.channel === null && node.game === null &&
      node.currentMinutesWatched === 0 && node.requiredMinutesWatched === 0;
    const valueSummary = Object.fromEntries([
      'dropID', 'currentMinutesWatched', 'requiredMinutesWatched', 'channel', 'game',
    ].map(key => [key, { present: Boolean(nodeObject && Object.hasOwn(node, key)),
      type: type(node?.[key]), empty: node?.[key] === '' || node?.[key] == null,
      zero: node?.[key] === 0 }]));
    let status = data == null || user == null ? "unavailable"
      : !hasSession ? "shape-changed"
        : session === null || (session && Object.hasOwn(session, "currentSession") && session.currentSession === null) ? "absent"
          : inactive ? "inactive"
          : recognized ? "ok"
            : expectedSessionFields ? "unidentified"
              : "shape-changed";
    if (errors.length) status = recognized ? "partial-response" : "error";
    return { valid: ['ok', 'absent', 'inactive', 'unidentified'].includes(status), status,
      shape: { data: type(data), currentUser: type(user), session: type(session), node: type(node),
        errorCount: errors.length, dataFields: fields(data), userFields: fields(user), sessionFields: fields(session), nodeFields: fields(node), valueSummary } };
  }

  function gqlOperationFailureKind(row) {
    // A missing operation is distinct from both authorization and a response
    // schema change. Do not classify a partial data response as safe to defer.
    if (row?.data != null || !Array.isArray(row?.errors) || !row.errors.length) return "";
    const errors = row.errors.map((item) => ({
      message: cleanText(item?.message || ""),
      code: cleanText(item?.extensions?.code || ""),
    }));
    if (errors.some((item) => /auth|forbidden|integrity|rate.?limit|too.?many|429|401|403/i.test(item.code))) return "";
    if (errors.every((item) => /^(PersistedQueryNotFound|PERSISTED_QUERY_NOT_FOUND)$/i.test(item.message) ||
        /^(PersistedQueryNotFound|PERSISTED_QUERY_NOT_FOUND)$/i.test(item.code))) return "hash-not-found";
    if (errors.every((item) => /^(?:operation with name ['"][A-Za-z_][A-Za-z0-9_]*['"] not found|unknown operation named ['"][A-Za-z_][A-Za-z0-9_]*['"])[.!]?$/i.test(item.message))) return "operation-not-found";
    return "";
  }

  function inventoryResponseState(row) {
    const data = row?.data;
    const user = data?.currentUser;
    const inventory = user?.inventory;
    const campaigns = inventory?.dropCampaignsInProgress;
    const errors = Array.isArray(row?.errors) ? row.errors : [];
    const type = value => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    // Keep bounded GraphQL field names and types, not response values, account
    // values or tokens. Field names help identify a changed response envelope.
    const fields = value => value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value).filter(key => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)).slice(0, 12) : [];
    const types = { data: type(data), currentUser: type(user), inventory: type(inventory),
      campaigns: type(campaigns), errorCount: errors.length };
    const shape = { ...types, dataFields: fields(data), userFields: fields(user), inventoryFields: fields(inventory) };
    const validRows = Array.isArray(campaigns) && campaigns.every(campaign => (
      campaign && typeof campaign === "object" && !Array.isArray(campaign)
    ));
    const valid = validRows && !errors.length;
    const status = valid ? (campaigns.length ? "ok" : "empty")
      : errors.length ? (validRows ? "partial-response" : "error")
        : data === null || user === null || inventory === null || campaigns === null
          ? "unavailable" : "shape-changed";
    return { valid, status, campaigns: valid ? campaigns : null, shape,
      detail: Object.entries(types).map(([key, value]) => `${key}=${value}`).join(";") };
  }

  function acceptInventoryResponse(row, source = "inventory-response") {
    const result = inventoryResponseState(row);
    const now = Date.now();
    inventoryResponseHealth = { valid: result.valid, status: result.status, at: now,
      lastValidAt: result.valid ? now : inventoryResponseHealth.lastValidAt,
      source, shape: result.shape };
    if (!result.valid) {
      inventoryClaimSweepState = { at: now, source, candidates: null, selected: 0,
        confirmed: 0, reason: "inventory-unavailable" };
      return result;
    }
    const discovered = extractCampaignCatalog(row);
    nativeRewardClaimEvidence(row?.data?.currentUser?.inventory, discovered);
    if (discovered.length) rememberCampaignCatalog(discovered, source);
    applyInventorySnapshot(result.campaigns, source);
    reconcileClaimHistory(result.campaigns);
    void queueInventoryClaimSweep(result.campaigns, source);
    return result;
  }

  function nativeRewardClaimEvidence(inventory = null, campaigns = []) {
    const storageKey = 'dropper-native-earned-rewards-v1';
    const saved = readSession(storageKey, { claims: [], groups: [] });
    const claims = new Set(Array.isArray(saved?.claims) ? saved.claims : []);
    const groups = new Map((Array.isArray(saved?.groups) ? saved.groups : []).map(group => [group.key, group]));
    let changed = false;
    for (const edge of Array.isArray(inventory?.earnedDropRewards?.edges) ? inventory.earnedDropRewards.edges : []) {
      const reward = edge?.node;
      const campaignId = cleanText(reward?.campaign?.id).toLowerCase();
      const rewardId = cleanText(reward?.item?.id);
      if (reward?.status !== 'CLAIMED' || !campaignId || !rewardId) continue;
      const key = campaignId + ':' + rewardId;
      if (!claims.has(key)) { claims.add(key); changed = true; }
    }
    for (const campaign of campaigns || []) {
      const campaignId = cleanText(campaign?.id).toLowerCase();
      if (!campaignId) continue;
      for (const group of Array.isArray(campaign.rewardGroups) ? campaign.rewardGroups : []) {
        const id = cleanText(group?.id);
        if (!id) continue;
        const key = campaignId + ':' + id;
        const rewardIds = (Array.isArray(group.rewards) ? group.rewards : []).map(reward => cleanText(reward?.id));
        const criteria = group.progressCriteria;
        // Only exact, complete identities for explicitly non-repeatable watch
        // groups prove that the corresponding routing target is already done.
        if (criteria?.requirementType !== 'WATCH') {
          if (groups.delete(key)) changed = true;
          continue;
        }
        const claimableOnce = criteria.isRepeatable === false && rewardIds.length > 0 && rewardIds.every(Boolean);
        const record = { key, campaignId, id, rewardIds, claimableOnce, name: cleanText(group.name),
          requiredMinutes: Number(criteria.requirements?.minutesWatched) || 0 };
        if (JSON.stringify(groups.get(key)) !== JSON.stringify(record)) { groups.set(key, record); changed = true; }
      }
    }
    const state = { claims: [...claims].slice(-2000), groups: [...groups.values()].slice(-2000) };
    if (changed) writeSession(storageKey, state);
    const retainedClaims = new Set(state.claims);
    const claimedGroups = new Set(state.groups.filter(group => group.claimableOnce && group.rewardIds.length &&
      group.rewardIds.every(id => retainedClaims.has(group.campaignId + ':' + id))).map(group => group.key));
    return { ...state, claimedGroups };
  }

  function overlayNativeClaimedRewards(campaigns) {
    const evidence = nativeRewardClaimEvidence(null, campaigns);
    return (campaigns || []).map(campaign => {
      const campaignId = cleanText(campaign?.id).toLowerCase();
      const drops = (campaign.timeBasedDrops || campaign.drops || []).map(drop =>
        evidence.claimedGroups.has(campaignId + ':' + cleanText(drop.id))
          ? { ...drop, self: { ...drop.self, isClaimed: true } } : drop);
      for (const group of evidence.groups) {
        if (group.campaignId !== campaignId || !evidence.claimedGroups.has(group.key) ||
            drops.some(drop => cleanText(drop.id) === group.id)) continue;
        drops.push({ id: group.id, name: group.name, requiredMinutesWatched: group.requiredMinutes,
          self: { isClaimed: true, currentMinutesWatched: null } });
      }
      // A partial legacy list must not turn one claimed native group into a
      // completed campaign. Missing groups still need an authoritative lookup.
      const nativeRewardsPending = evidence.groups.some(group => group.campaignId === campaignId &&
        !evidence.claimedGroups.has(group.key) && !drops.some(drop => cleanText(drop.id) === group.id));
      return { ...campaign, timeBasedDrops: drops, nativeRewardsPending };
    });
  }

  function checkGqlOperationResults(requests, json, status, payloads = []) {
    if (status < 200 || status >= 300) return;
    const rows = Array.isArray(json) ? json : [json];
    (requests || []).forEach((req, index) => {
      const name = GQL_OPS[req?.op]?.name;
      const row = rows[index];
      if (!name || !row) return;
      const errors = (Array.isArray(row.errors) ? row.errors : []).map((item) => cleanText(item?.message || ""));
      const definitionFailure = gqlOperationFailureKind(row);
      if (definitionFailure) {
        noteGqlOperationResult(name, definitionFailure, errors.join(" · ") || definitionFailure);
        // A response to an older in-flight payload must not discard a newer
        // validated hash learned from Twitch while that request was pending.
        forgetLearnedGqlOperation(name, definitionFailure, payloads[index]?.extensions?.persistedQuery?.sha256Hash || "");
        return;
      }
      if (name === "Inventory") {
        const inventory = inventoryResponseState(row);
        if (!inventory.valid && gqlOperationHealth[name]?.result !== inventory.status) {
          logActivity("gql-operation", `Inventory data unavailable (${inventory.status})`, { operation: name, shape: inventory.shape });
        }
        noteGqlOperationResult(name, inventory.valid ? "ok" : inventory.status, inventory.detail);
        return;
      }
      if (name === "DropCurrentSessionContext") {
        const session = sessionResponseState(row);
        noteGqlOperationResult(name, session.status, JSON.stringify(session.shape));
        return;
      }
      const expected = GQL_EXPECTED_SHAPES[name];
      if (row.data && expected && !expected(row.data)) {
        if (gqlOperationHealth[name]?.result !== "shape-changed") {
          logActivity("gql-operation", `Twitch's ${name} response no longer has the expected shape`, { operation: name });
        }
        noteGqlOperationResult(name, "shape-changed", "expected fields missing");
        return;
      }
      noteGqlOperationResult(name, errors.length ? "error" : "ok", errors.join(" · "));
    });
  }

  async function gql(requests, { allowInventoryFailure = false } = {}) {
    const token = getToken();
    if (!token) throw new Error("Not logged in");
    const claimOnly = Boolean(
      Array.isArray(requests) &&
      requests.length &&
      requests.every((req) => req?.op === "claimDrop")
    );
    const body = requests.map((req) => gqlPayload(GQL_OPS[req.op], req.variables));
    const send = async (clientId, { refreshIntegrity = false, transport = "page" } = {}) => {
      let integrity = "";
      try {
        integrity = await ensureClientIntegrity(clientId, {
          force: refreshIntegrity,
          transport,
        });
      } catch (mintError) {
        if (transport === "page") integrity = adoptCapturedIntegrity(clientId, "page");
        if (!integrity) throw mintError;
      }
      if (!integrity && transport === "page") {
        integrity = adoptCapturedIntegrity(clientId, "page");
      }
      beforeDropperNetworkRequest();
      const result = await postTwitchJson(GQL_URL, {
        clientId,
        auth: token,
        integrity,
        body,
        transport,
      });
      checkGqlOperationResults(requests, result.json, result.status, body);
      return parseGqlRows(result.json, result.status, { requests, allowInventoryFailure });
    };

    const tryClient = async (clientId, { refreshIntegrity = false } = {}) => {
      let lastError = null;
      let pageDeadEnd = false;
      let transports = preferredGqlTransports();
      for (let index = 0; index < transports.length; index += 1) {
        const transport = transports[index];
        if (transport === "page" && pageDeadEnd) continue;
        try {
          const rows = await send(clientId, {
            refreshIntegrity: refreshIntegrity || Boolean(lastError && /failed to fetch|network error|timed out|page integrity unavailable/i.test(lastError?.message || "")),
            transport,
          });
          lastIntegrityTransport = transport;
          return rows;
        } catch (error) {
          // Prefer the first actionable failure; page integrity is a dead-end.
          if (!lastError || /page integrity unavailable/i.test(lastError?.message || "")) {
            lastError = error;
          } else if (!/page integrity unavailable/i.test(error?.message || "")) {
            lastError = error;
          }
          if (/integrity/i.test(error?.message || "") && !/page integrity unavailable/i.test(error?.message || "")) {
            clearClientIntegrity({ clearCapture: true });
            lastIntegrityTransport = "gm";
          }
          if (error?.circuitOpen || error?.gqlDefinitionFailure) throw error;
          if (/page integrity unavailable/i.test(error?.message || "")) {
            pageDeadEnd = true;
            lastIntegrityTransport = "gm";
          } else if (
            /failed to fetch|network error|timed out/i.test(error?.message || "") &&
            transport === "page" &&
            transports.includes("gm")
          ) {
            lastIntegrityTransport = "gm";
          }
        }
      }
      throw lastError || new Error("Twitch GQL unavailable");
    };

    if (claimOnly) {
      try {
        const result = await send(CLIENT_IDS[0], { transport: preferredGqlTransports()[0] || 'page' });
        recordDropperNetworkSuccess();
        return result;
      } catch (error) { recordDropperNetworkFailure(error); throw error; }
    }

    try {
      const result = await tryClient(CLIENT_IDS[0]);
      recordDropperNetworkSuccess();
      return result;
    } catch (error) {
      let failure = error;
      const integrityRejected =
        /integrity/i.test(failure?.message || "") &&
        !/page integrity unavailable/i.test(failure?.message || "");

      if (integrityRejected && !failure?.circuitOpen && !failure?.integrityRetried) {
        try {
          const refreshed = await tryClient(CLIENT_IDS[0], { refreshIntegrity: true });
          recordDropperNetworkSuccess();
          return refreshed;
        } catch (refreshedError) {
          refreshedError.integrityRetried = true;
          failure = refreshedError;
        }
      }

      if (claimOnly && integrityRejected) {
        throw failure;
      }

      if (/401|403|integrity|failed to fetch|network error|timed out|page integrity unavailable/i.test(failure.message || "") && !failure?.circuitOpen) {
        try {
          lastIntegrityTransport = "gm";
          const fallback = await tryClient(CLIENT_IDS[1], { refreshIntegrity: true });
          recordDropperNetworkSuccess();
          return fallback;
        } catch (fallbackError) {
          recordDropperNetworkFailure(fallbackError);
          throw fallbackError;
        }
      }
      recordDropperNetworkFailure(failure);
      throw failure;
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

  function dropPreconditionSatisfied(drop) {
    const self = drop?.self || {};
    const required = Number(drop?.requiredMinutesWatched || 0);
    const current = self.currentMinutesWatched == null || self.currentMinutesWatched === "" ? null : Number(self.currentMinutesWatched);
    return Boolean(self.isClaimed || (required > 0 && current >= required));
  }

  function campaignKey(campaign) {
    const game = campaign?.game?.displayName || campaign?.game?.name || "";
    return String(campaign?.id || `${game}|${campaign?.name || ""}`).toLowerCase();
  }

  function campaignIsExcluded(campaignOrDrop) {
    if (!campaignOrDrop) return false;
    const gameName = typeof campaignOrDrop.game === "string"
      ? campaignOrDrop.game
      : campaignOrDrop.game?.displayName || campaignOrDrop.game?.name || "";
    const campaignName = typeof campaignOrDrop.campaign === "string"
      ? campaignOrDrop.campaign
      : campaignOrDrop.name || "";
    const slug = normalizedGameSlug(campaignOrDrop.gameSlug || campaignOrDrop.game?.slug || "");
    return Boolean(
      EXCLUDED_CATEGORY_SLUGS.has(slug) ||
      EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(gameName)) ||
      EXCLUDED_CAMPAIGN_NAMES.has(normalizeGameName(campaignName))
    );
  }

  function campaignWindow(campaign, drop = null) {
    const startAt = campaign?.startAt || drop?.startAt || "";
    const endAt = campaign?.endAt || drop?.endAt || "";
    const startMs = startAt ? Date.parse(startAt) : 0;
    const endMs = endAt ? Date.parse(endAt) : 0;
    return {
      startAt,
      endAt,
      startMs: Number.isFinite(startMs) ? startMs : 0,
      endMs: Number.isFinite(endMs) ? endMs : 0,
    };
  }

  function campaignRoutingWindow(campaignOrDrop) {
    const startAt = cleanText(campaignOrDrop?.startAt || campaignOrDrop?.campaignStartAt || "");
    const endAt = cleanText(campaignOrDrop?.endAt || campaignOrDrop?.campaignEndAt || "");
    const startMs = startAt ? Date.parse(startAt) : 0;
    const endMs = endAt ? Date.parse(endAt) : 0;
    return {
      startAt,
      endAt,
      startMs: Number.isFinite(startMs) ? startMs : 0,
      endMs: Number.isFinite(endMs) ? endMs : 0,
    };
  }

  function campaignRoutingState(campaignOrDrop, now = Date.now(), options = {}) {
    const key = typeof campaignOrDrop === "string"
      ? cleanText(campaignOrDrop).toLowerCase()
      : cleanText(
          campaignOrDrop?.campaignKey ||
          campaignOrDrop?.campaignId ||
          campaignOrDrop?.id ||
          ""
        ).toLowerCase();
    const status = typeof campaignOrDrop === "object" && campaignOrDrop
      ? cleanText(campaignOrDrop.status).toUpperCase()
      : "";
    const excluded = typeof campaignOrDrop === "object" && campaignOrDrop
      ? campaignIsExcluded(campaignOrDrop)
      : false;
    const ignored = Boolean(
      !options.ignoreUserPreference &&
      typeof campaignOrDrop === "object" &&
      campaignOrDrop &&
      campaignGameIsIgnored(campaignOrDrop, now)
    );
    const completed = Boolean(!options.ignoreCompletion && key && campaignMarkedComplete(key));
    const window = typeof campaignOrDrop === "object" && campaignOrDrop
      ? campaignRoutingWindow(campaignOrDrop)
      : { startAt: "", endAt: "", startMs: 0, endMs: 0 };
    const windowKnown = Boolean(
      window.startMs &&
      window.endMs &&
      window.endMs > window.startMs
    );

    let reason = "open";
    if (campaignOrDrop?.self?.isAccountConnected === false || campaignOrDrop?.isAccountConnected === false) reason = "account-link-required";
    else if (campaignOrDrop?.self?.isEligible === false) reason = "participation-not-eligible";
    else if (excluded) reason = "excluded";
    else if (ignored) reason = "ignored-game";
    else if (completed) reason = "completed";
    else if (status && !["ACTIVE", "TEST", "OPEN"].includes(status)) reason = "status-closed";
    else if (!windowKnown) reason = "campaign-dates-unknown";
    else if (window.startMs > now) reason = "not-started";
    else if (window.endMs <= now) reason = "expired";

    return {
      key: key || null,
      status: status || null,
      startAt: window.startAt || null,
      endAt: window.endAt || null,
      startMs: window.startMs,
      endMs: window.endMs,
      windowKnown,
      excluded,
      ignored,
      completed,
      open: reason === "open",
      reason,
    };
  }

  function campaignIsRoutingOpen(campaignOrDrop, now = Date.now()) {
    return campaignRoutingState(campaignOrDrop, now).open;
  }

  function campaignMemoryRoutingState(key, now = Date.now(), options = {}) {
    const wanted = cleanText(key).toLowerCase();
    if (!wanted) return { key: null, open: false, reason: "campaign-key-missing", windowKnown: false };
    const record = campaignMemory?.campaigns?.[wanted] || campaignMemory?.campaigns?.[key] || null;
    if (!record) return { key: wanted, open: false, reason: "campaign-memory-missing", windowKnown: false };
    return campaignRoutingState({
      id: record.id || wanted,
      campaignKey: wanted,
      name: record.name || "",
      game: record.game || "",
      startAt: record.startAt || "",
      endAt: record.endAt || "",
      status: record.status || "",
    }, now, options);
  }

  function dropFitsCampaignWindow(item, now = Date.now()) {
    if (!item) return false;
    const endMs = Number(
      item.endMs
      || Date.parse(item.campaignEndAt || item.dropEndAt || item.endAt || "")
      || 0,
    );
    if (!Number.isFinite(endMs) || endMs <= 0 || endMs >= Number.MAX_SAFE_INTEGER / 2) {
      return true;
    }
    const usableMs = endMs - now - CAMPAIGN_WINNABLE_BUFFER_MS;
    if (usableMs <= 0) return false;

    if (item.needsDropDetails || item.remainingMinutes == null) {
      return usableMs >= CAMPAIGN_SHELL_MIN_WINDOW_MS;
    }
    const remainingMinutes = Number(item.remainingMinutes);
    if (!Number.isFinite(remainingMinutes) || remainingMinutes >= Number.MAX_SAFE_INTEGER / 2) {
      return usableMs >= CAMPAIGN_SHELL_MIN_WINDOW_MS;
    }
    if (remainingMinutes <= 0) return true;
    return remainingMinutes * 60 * 1000 <= usableMs;
  }

  function dropCanFinishBefore(drop, endMs, now = Date.now()) {
    const remainingMinutes = Number(drop?.remainingMinutes);
    const deadline = Number(endMs);
    if (!Number.isFinite(deadline) || deadline <= 0) return false;
    if (!Number.isFinite(remainingMinutes) || remainingMinutes < 0) return false;
    if (remainingMinutes >= Number.MAX_SAFE_INTEGER / 2) return false;
    return now + remainingMinutes * 60 * 1000 + CAMPAIGN_WINNABLE_BUFFER_MS < deadline;
  }

  function currentDropCanFinishBefore(endMs, now = Date.now()) {
    return dropCanFinishBefore(currentDrop, endMs, now);
  }

  function currentDropIsWinnableInProgress() {
    if (!currentDrop || currentDrop.isClaimed || isSyntheticWaitingDrop(currentDrop)) return false;
    if (dropProgressComplete(currentDrop)) return false;
    return dropFitsCampaignWindow(currentDrop);
  }

  function campaignKeysMatch(left, right) {
    const a = cleanText(left).toLowerCase();
    const b = cleanText(right).toLowerCase();
    return Boolean(a && b && a === b);
  }

  function pickMatchesCurrentDrop(pick, activeDrop = currentDrop) {
    if (!pick || !activeDrop) return false;
    if (campaignKeysMatch(
      pick.campaignKey || pick.campaignId,
      activeDrop.campaignKey || activeDrop.campaignId,
    )) {
      return true;
    }
    return Boolean(pick.id && activeDrop.id && String(pick.id) === String(activeDrop.id));
  }

  function preferCurrentWinnableOpenDrop(pool) {
    if (!currentDropIsWinnableInProgress()) return null;
    return (pool || []).find((item) => pickMatchesCurrentDrop(item)) || null;
  }

  function preferWinnableDrops(items, now = Date.now()) {
    const list = items || [];
    const winnable = list.filter((item) => dropFitsCampaignWindow(item, now));
    return winnable.length ? winnable : list;
  }

  function handoffLocksTargetGame(pending = getHandoffState()) {
    if (!pending?.targetGame) return false;
    return [
      HANDOFF_STATES.FINDING_STREAM,
      HANDOFF_STATES.SWITCHING,
      HANDOFF_STATES.VERIFYING,
    ].includes(normalizedHandoffState(pending));
  }

  function dropMatchesLockedHandoff(drop) {
    const routing = readRoutingControllerSession();
    if (
      ![
        ROUTING_STATES.FIND_STREAM,
        ROUTING_STATES.OPEN_STREAM,
        ROUTING_STATES.VERIFY_STREAM,
        ROUTING_STATES.EARNING,
        ROUTING_STATES.CLAIM,
        ROUTING_STATES.WAITING,
      ].includes(routing.state) ||
      !routing.targetGame
    ) {
      return true;
    }
    if (!drop || !gameNamesMatch(drop.game || "", routing.targetGame)) return false;
    const targetKey = cleanText(routing.targetCampaignKey);
    const dropKey = cleanText(drop.campaignKey || drop.campaignId);
    if (targetKey && dropKey && targetKey !== dropKey) return false;
    return true;
  }
  function handoffIsBusyRouting(pending, { includeCheckingGame = false } = {}) {
    if (!pending) return false;
    const state = normalizedHandoffState(pending);
    if (includeCheckingGame && state === HANDOFF_STATES.CHECKING_GAME) return true;
    return [
      HANDOFF_STATES.SELECTING_GAME,
      HANDOFF_STATES.FINDING_STREAM,
      HANDOFF_STATES.SWITCHING,
      HANDOFF_STATES.VERIFYING,
    ].includes(state);
  }

  function campaignIsOpen(campaign, drop = null, now = Date.now()) {
    if (campaignIsExcluded(campaign) || campaignIsExcluded(drop)) return false;
    if (campaign?.self?.isAccountConnected === false || campaign?.isAccountConnected === false || campaign?.self?.isEligible === false || drop?.self?.isEligible === false) return false;
    const status = cleanText(campaign?.status || "").toUpperCase();
    if (status && status !== "ACTIVE" && status !== "TEST") return false;
    const window = campaignWindow(campaign, drop);
    // GQL can legitimately return shell campaigns without dates. Synthetic
    // page rows cannot: without a verified page window they are unsafe routing
    // candidates and must fail closed.
    if (/^page:/i.test(cleanText(campaign?.id || ""))) {
      if (!window.startMs || !window.endMs || window.endMs <= window.startMs) return false;
    }
    if (window.startMs && window.endMs && window.endMs <= window.startMs) return false;
    if (window.startMs && window.startMs > now) return false;
    if (window.endMs && window.endMs <= now) return false;
    return true;
  }

  function findCampaignForDrop(campaigns, activeDrop = currentDrop) {
    if (!activeDrop) return null;
    const wantedId = String(activeDrop.campaignId || "");
    const wantedName = cleanText(activeDrop.campaign).toLowerCase();
    const wantedGame = cleanText(activeDrop.game).toLowerCase();
    const wantedDropId = String(activeDrop.id || "");
    const now = Date.now();
    const dropEndMs = Date.parse(activeDrop.campaignEndAt || activeDrop.dropEndAt || "") || 0;
    let nameMatch = null;

    for (const campaign of campaigns || []) {
      if (wantedId && String(campaign?.id || "") === wantedId) return campaign;
      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      if (wantedDropId && drops.some((drop) => String(drop?.id || "") === wantedDropId)) return campaign;

      const name = cleanText(campaign?.name).toLowerCase();
      const game = cleanText(campaign?.game?.displayName || campaign?.game?.name).toLowerCase();
      if (!(wantedName && name === wantedName && (!wantedGame || !game || game === wantedGame))) continue;
      if (!nameMatch) {
        nameMatch = campaign;
        continue;
      }
      if (campaignIsOpen(campaign, null, now) && !campaignIsOpen(nameMatch, null, now)) {
        nameMatch = campaign;
      }
    }

    if (nameMatch) {
      const matchEndMs = campaignWindow(nameMatch).endMs;
      if (
        matchEndMs &&
        dropEndMs &&
        matchEndMs < dropEndMs &&
        !campaignIsOpen(nameMatch, null, now)
      ) {
        return null;
      }
    }
    return nameMatch;
  }

  function exactDropMetadataFromCampaigns(campaigns, activeDrop = currentDrop) {
    if (!activeDrop || !Array.isArray(campaigns) || !campaigns.length) return null;
    const wantedId = cleanText(activeDrop.id);
    if (!wantedId) return null;
    const campaign = findCampaignForDrop(campaigns, activeDrop);
    if (!campaign) return null;
    const raw = (campaign?.timeBasedDrops || campaign?.drops || []).find((drop) => cleanText(drop?.id) === wantedId);
    if (!raw) return null;
    const self = raw?.self || {};
    const name = cleanText(raw?.name || raw?.benefitEdges?.[0]?.benefit?.name || "");
    return {
      name,
      rewardImage: dropBenefitImage(raw),
      dropInstanceID: cleanText(self.dropInstanceID || raw?.dropInstanceID || ""),
      requiredMinutes: Number(raw?.requiredMinutesWatched || raw?.requiredMinutes || 0) || 0,
    };
  }

  function restoreCurrentDropMetadataFromKnownCampaigns() {
    if (!currentDrop) return false;
    const sources = [lastInventoryCampaigns, lastCampaignCatalog];
    let metadata = null;
    for (const campaigns of sources) {
      metadata = exactDropMetadataFromCampaigns(campaigns, currentDrop);
      if (metadata?.name) break;
    }
    if (!metadata) return false;

    const currentName = cleanText(currentDrop.name);
    const replaceName = Boolean(
      metadata.name &&
      (
        !currentName ||
        /^current\s+drop$/i.test(currentName) ||
        isPlaceholderDropLabel(currentName) ||
        isDropCardMetadata(currentName)
      )
    );
    const next = {
      ...currentDrop,
      name: replaceName ? metadata.name : currentDrop.name,
      rewardImage: currentDrop.rewardImage || metadata.rewardImage || "",
      dropInstanceID: currentDrop.dropInstanceID || metadata.dropInstanceID || "",
      requiredMinutes: Number(currentDrop.requiredMinutes || 0) || metadata.requiredMinutes || 0,
    };
    if (
      cleanText(next.name) === cleanText(currentDrop.name) &&
      cleanText(next.rewardImage) === cleanText(currentDrop.rewardImage) &&
      cleanText(next.dropInstanceID) === cleanText(currentDrop.dropInstanceID) &&
      Number(next.requiredMinutes || 0) === Number(currentDrop.requiredMinutes || 0)
    ) return false;
    currentDrop = next;
    writeSession("tdh-drop", currentDrop);
    return true;
  }

  function campaignHasUnclaimedWatchDrops(campaign) {
    const drops = campaign?.timeBasedDrops || campaign?.drops || [];
    return drops.some((drop) => {
      const self = drop?.self || {};
      return !self.isClaimed && !requiresSubscription(drop) && Number(drop?.requiredMinutesWatched || 0) > 0;
    });
  }

  function campaignExpirySnapshot(campaigns = lastInventoryCampaigns, activeDrop = currentDrop, now = Date.now()) {
    if (!activeDrop) return null;
    const campaign = findCampaignForDrop(campaigns, activeDrop);
    const fallbackDrop = {
      endAt: activeDrop.dropEndAt || activeDrop.campaignEndAt || "",
      startAt: activeDrop.dropStartAt || activeDrop.campaignStartAt || "",
    };
    const window = campaignWindow(campaign, fallbackDrop);
    if (!window.endMs) return null;

    const hasUnclaimed = campaign
      ? campaignHasUnclaimedWatchDrops(campaign)
      : !activeDrop.isClaimed;

    const key = campaign
      ? campaignKey(campaign)
      : String(activeDrop.campaignId || `${activeDrop.game || ""}|${activeDrop.campaign || ""}`).toLowerCase();

    const graceEndsAt = window.endMs + CAMPAIGN_EXPIRY_GRACE_MS;
    return {
      campaignKey: key,
      campaignId: campaign?.id || activeDrop.campaignId || "",
      campaignName: campaign?.name || activeDrop.campaign || activeDrop.game || "Current Campaign",
      game: campaign?.game?.displayName || campaign?.game?.name || activeDrop.game || "",
      endAt: window.endAt,
      endMs: window.endMs,
      graceEndsAt,
      graceRemainingMs: Math.max(0, graceEndsAt - now),
      ended: now >= window.endMs,
      overdue: hasUnclaimed && now >= graceEndsAt,
      hasUnclaimed,
    };
  }

  function normalizeExcludedCampaignKeys(keys = []) {
    return [...new Set((keys || []).map((key) => cleanText(key).toLowerCase()).filter(Boolean))];
  }

  function dropBenefitImage(drop) {
    return cleanText(
      drop?.rewardImage ||
      drop?.imageAssetURL ||
      drop?.imageURL ||
      drop?.imageUrl ||
      drop?.benefitEdges?.[0]?.benefit?.imageAssetURL ||
      ""
    );
  }

  function imageNodeUrl(node) {
    return cleanText(node?.currentSrc || node?.src || node?.getAttribute?.("src") || "");
  }

  function rewardImageFromCard(card, progressBar = null) {
    if (!card) return "";
    const scopes = [];
    let cursor = progressBar?.parentElement || null;
    for (let depth = 0; cursor && depth < 5; depth += 1, cursor = cursor.parentElement) {
      if (!card.contains(cursor) && cursor !== card) break;
      scopes.push(cursor);
      if (cursor === card) break;
    }
    if (!scopes.includes(card)) scopes.push(card);

    const selectors = [
      "img.inventory-drop-image",
      "[data-test-selector*='RewardPresentation'] img",
      "[data-test-selector*='reward' i] img",
      "img[src]",
    ];

    for (const scope of scopes) {
      for (const selector of selectors) {
        for (const image of scope.querySelectorAll?.(selector) || []) {
          const alt = cleanText(image.getAttribute?.("alt") || "");
          const cls = cleanText(image.getAttribute?.("class") || "");
          if (/drops?\s*campaign\s*image|campaign\s*image|avatar|profile/i.test(`${alt} ${cls}`)) continue;
          const url = imageNodeUrl(image);
          if (/^https?:\/\//i.test(url)) return url;
        }
      }
    }
    return "";
  }

  function rewardImageFromInventoryDom(drop = currentDrop) {
    if (!drop) return "";
    const wantedName = cleanText(drop.name).toLowerCase();
    const wantedCampaign = cleanText(drop.campaign).toLowerCase();
    const wantedGame = cleanText(drop.game).toLowerCase();
    const wantedPercent = Number(drop.percent);
    const cards = [
      ...document.querySelectorAll(TWITCH_DOM_SELECTORS.inventoryCard),
      ...document.querySelectorAll(TWITCH_DOM_SELECTORS.dropsCampaignCard),
      ...document.querySelectorAll(TWITCH_DOM_SELECTORS.dropsCampaignClassCard),
    ];

    let fallback = "";
    for (const card of cards) {
      const text = cleanText(card.textContent).toLowerCase();
      const bars = [...card.querySelectorAll("[role='progressbar']")];
      const matchingBar = bars.find((bar) => {
        const percent = barPercent(bar);
        return Number.isFinite(wantedPercent) && Number.isFinite(percent) && percent === wantedPercent;
      }) || bars[0] || null;
      const image = rewardImageFromCard(card, matchingBar);
      if (!image) continue;
      const identityMatch = Boolean(
        (wantedName && text.includes(wantedName)) ||
        (wantedCampaign && text.includes(wantedCampaign)) ||
        (wantedGame && text.includes(wantedGame))
      );
      if (identityMatch) return image;
      if (!fallback && matchingBar) fallback = image;
    }
    return fallback;
  }

  function pickNextOpenCampaignDrop(campaigns, excludedCampaignKeys = [], excludedGames = [], { preferCurrent = true } = {}) {
    const now = Date.now();
    const excludedCampaigns = new Set(normalizeExcludedCampaignKeys(excludedCampaignKeys));
    const excludedGameSet = new Set((excludedGames || []).map((game) => cleanText(game).toLowerCase()).filter(Boolean));
    const candidates = [];

    for (const campaign of campaigns || []) {
      const key = campaignKey(campaign);
      if (excludedCampaigns.has(key)) continue;
      if (campaignMarkedComplete(campaign)) continue;

      const game = campaign?.game?.displayName || campaign?.game?.name || "";
      if (!game) continue;
      if (excludedGameSet.has(cleanText(game).toLowerCase())) continue;
      if (!campaignIsRoutingOpen(campaign, now)) continue;

      const watchDrops = campaignWatchDrops(campaign);
      if (watchDrops.length && markCampaignCompleteIfWatchDone(campaign, "watch-progress-complete")) {
        continue;
      }

      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      let addedWatchDrop = false;
      for (const drop of drops) {
        const self = drop?.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop?.requiredMinutesWatched || 0);
        const current = self.currentMinutesWatched == null || self.currentMinutesWatched === "" ? null : Number(self.currentMinutesWatched);
        if (required <= 0 || !campaignIsOpen(campaign, drop, now)) continue;
        if (current >= required) continue;

        const preconditionsMet = dropperPreconditionsMet(drop, drops);
        if (!preconditionsMet) continue;

        const window = campaignWindow(campaign, drop);
        candidates.push({
          id: drop.id || "",
          dropInstanceID: self.dropInstanceID || "",
          name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop",
          rewardImage: dropBenefitImage(drop),
          game,
          gameSlug: campaign.game?.slug || "",
          gameId: campaign.game?.id || "",
          campaignId: campaign.id || "",
          campaignKey: key,
          campaign: campaign.name || game,
          campaignStartAt: campaign.startAt || "",
          campaignEndAt: campaign.endAt || drop.endAt || "",
          dropStartAt: drop.startAt || "",
          dropEndAt: drop.endAt || "",
          endMs: window.endMs || Number.MAX_SAFE_INTEGER,
          percent: dropProgressPercent(current, required),
          currentMinutes: current,
          requiredMinutes: required,
          remainingMinutes: current == null || !Number.isFinite(current) ? null : Math.max(0, required - current),
          needsDropDetails: false,
        });
        addedWatchDrop = true;
      }

      // ViewerDropsDashboard often returns open campaigns without timeBasedDrops.
      // Still queue them by end date so ending-soonest is not skipped for Inventory-only rows.
      if (!addedWatchDrop) {
        if (watchDrops.length && !campaign.nativeRewardsPending) continue;
        const window = campaignWindow(campaign);
        candidates.push({
          id: "",
          dropInstanceID: "",
          name: campaign.name || "Drop",
          game,
          gameSlug: campaign.game?.slug || "",
          gameId: campaign.game?.id || "",
          campaignId: campaign.id || "",
          campaignKey: key,
          campaign: campaign.name || game,
          campaignStartAt: campaign.startAt || "",
          campaignEndAt: campaign.endAt || "",
          dropStartAt: "",
          dropEndAt: "",
          endMs: window.endMs || Number.MAX_SAFE_INTEGER,
          percent: null,
          currentMinutes: null,
          requiredMinutes: null,
          remainingMinutes: null,
          needsDropDetails: true,
        });
      }
    }

    const incomplete = candidates.filter((item) => !dropProgressComplete(item));
    // Preserve the established shell safety window first. A campaign without
    // reward details and less than the minimum inspection window yields when
    // any other candidate exists, while remaining a last-resort fallback.
    const shellSafe = incomplete.filter((item) => {
      if (!item.needsDropDetails) return true;
      const endMs = Number(item.endMs || 0);
      if (!Number.isFinite(endMs) || endMs <= 0 || endMs >= Number.MAX_SAFE_INTEGER / 2) return true;
      return endMs - now - CAMPAIGN_WINNABLE_BUFFER_MS >= CAMPAIGN_SHELL_MIN_WINDOW_MS;
    });
    const inspectionPool = shellSafe.length ? shellSafe : incomplete;
    // Known unwinnable detailed rewards are filtered whenever a viable option
    // exists. The shared ranker then applies personal priority and sequencing.
    const winnablePool = preferWinnableDrops(inspectionPool, now);
    const pool = rankCampaignCandidatesForStrategy(winnablePool, now);
    return (preferCurrent && preferCurrentWinnableOpenDrop(pool)) || pool[0] || null;
  }

  function listOpenCampaignQueue(campaigns = routingCampaignPool(), now = Date.now()) {
    const byKey = new Map();
    for (const campaign of campaigns || []) {
      if (!campaignIsRoutingOpen(campaign, now)) continue;
      if (campaignMarkedComplete(campaign)) continue;
      const game = cleanText(campaign?.game?.displayName || campaign?.game?.name || "");
      if (!game) continue;
      const key = campaignKey(campaign);
      if (!key) continue;
      if (campaignWatchDrops(campaign).length && markCampaignCompleteIfWatchDone(campaign, "watch-progress-complete")) {
        continue;
      }
      const window = campaignWindow(campaign);
      // Page scrapes without an end date inflate the queue and never expire.
      if (isPageScrapedCampaignKey(key) && !window.endMs) continue;
      const endMs = window.endMs || Number.MAX_SAFE_INTEGER;
      const prior = byKey.get(key);
      if (prior && prior.endMs <= endMs) continue;
      const sequence = DropperActiveViewing.campaignSequence(campaign, now);
      byKey.set(key, {
        key,
        id: campaign?.id || "",
        name: cleanText(campaign?.name) || game,
        game,
        startAt: window.startAt || "",
        endAt: window.endAt || "",
        endMs,
        campaign,
        sequenceRemainingMinutes: sequence.remainingMinutes,
        sequenceFinishable: sequence.finishable,
        sequenceMarginMinutes: sequence.marginMinutes,
        sequenceInProgress: sequence.inProgress,
        pendingClaims: sequence.pendingClaims,
      });
    }
    return rankCampaignCandidatesForStrategy([...byKey.values()], now);
  }

  // Game keys in the order Dropper will pick them for the next campaign under the active Campaign Order.
  function campaignQueueGameOrder(now = Date.now()) {
    try {
      return [...new Set(listOpenCampaignQueue(routingCampaignPool(), now).map(item => normalizeGameName(item.game)).filter(Boolean))];
    } catch (_) { return []; }
  }

  function openCampaignManagementPool(now = Date.now()) {
    const merged = mergeCampaigns(
      mergeCampaigns(lastCampaignCatalog, lastInventoryCampaigns),
      openCampaignsFromMemory(now, { ignoreUserPreference: true }),
    );
    return suppressPageCampaignsWithAuthoritativeMatches(merged);
  }

  function listOpenCampaignGames(campaigns = openCampaignManagementPool(), now = Date.now()) {
    const byGame = new Map();
    for (const campaign of campaigns || []) {
      const state = campaignRoutingState(campaign, now, {
        ignoreCompletion: true,
        ignoreUserPreference: true,
      });
      if (!state.open) continue;
      const game = campaignGameName(campaign);
      const gameKey = ignoredCampaignGameKey(game);
      if (!game || !gameKey || !state.endMs) continue;
      const campaignIdentity = campaignKey(campaign) || `${gameKey}:${state.endMs}`;
      const prior = byGame.get(gameKey) || {
        key: gameKey,
        game,
        campaignKeys: new Set(),
        campaignNames: new Set(),
        earliestEndMs: state.endMs,
        latestEndMs: state.endMs,
        latestEndAt: state.endAt || campaign?.endAt || "",
      };
      prior.campaignKeys.add(campaignIdentity);
      const campaignName = cleanText(campaign?.name || "");
      if (campaignName && normalizeGameName(campaignName) !== gameKey) prior.campaignNames.add(campaignName);
      prior.earliestEndMs = Math.min(prior.earliestEndMs, state.endMs);
      if (state.endMs >= prior.latestEndMs) {
        prior.latestEndMs = state.endMs;
        prior.latestEndAt = state.endAt || campaign?.endAt || prior.latestEndAt;
      }
      byGame.set(gameKey, prior);
    }
    return [...byGame.values()].map((item) => ({
      key: item.key,
      game: item.game,
      campaignCount: item.campaignKeys.size,
      campaignNames: [...item.campaignNames],
      earliestEndMs: item.earliestEndMs,
      latestEndMs: item.latestEndMs,
      latestEndAt: item.latestEndAt,
      ignored: Number(ignoredCampaignGames.games?.[item.key]?.expiresAt || 0) > now,
    })).sort((a, b) => cleanText(a.game).localeCompare(cleanText(b.game)));
  }

  function reconcileIgnoredCampaignGames(openGames, now = Date.now()) {
    pruneIgnoredCampaignGames(now);
    let changed = false;
    for (const item of openGames || []) {
      const record = ignoredCampaignGames.games?.[item.key];
      if (!record) continue;
      const latestEndMs = Number(item.latestEndMs || 0);
      if (!Number.isFinite(latestEndMs) || latestEndMs <= Number(record.expiresAt || 0)) continue;
      ignoredCampaignGames.games[item.key] = {
        ...record,
        game: item.game || record.game,
        expiresAt: latestEndMs,
      };
      changed = true;
    }
    if (changed) saveIgnoredCampaignGames();
    return changed;
  }

  function campaignQueueTriplet(campaigns = routingCampaignPool(), activeDrop = currentDrop, now = Date.now()) {
    const queue = listOpenCampaignQueue(campaigns, now);
    if (!queue.length) {
      return { previous: null, current: null, next: null, queue };
    }
    const activeKey = cleanText(
      activeDrop?.campaignKey ||
      activeDrop?.campaignId ||
      "",
    ).toLowerCase();
    const activeGame = cleanText(activeDrop?.game || "").toLowerCase();
    let index = activeKey
      ? queue.findIndex((item) => item.key === activeKey || cleanText(item.id).toLowerCase() === activeKey)
      : -1;
    if (index < 0 && activeGame) {
      index = queue.findIndex((item) => cleanText(item.game).toLowerCase() === activeGame);
    }
    if (index < 0) index = 0;
    return {
      previous: index > 0 ? queue[index - 1] : null,
      current: queue[index] || null,
      next: index >= 0 && index < queue.length - 1 ? queue[index + 1] : null,
      queue,
      index,
    };
  }

  function formatCampaignEndLabel(endAt, endMs = 0, now = Date.now()) {
    const ms = Number(endMs) || Date.parse(endAt || "") || 0;
    if (!ms) return "No End Date";
    if (ms <= now) return "Expired";
    try {
      const stamp = new Date(ms).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `Ends ${stamp}`;
    } catch (_) {
      return `Ends ${cleanText(endAt)}`;
    }
  }

  function expireEndedOpenCampaigns(now = Date.now()) {
    let expiredCount = 0;
    const pool = mergeCampaigns(lastCampaignCatalog, openCampaignsFromMemory(now));
    for (const campaign of pool) {
      const window = campaignWindow(campaign);
      if (!window.endMs || window.endMs > now) continue;
      const key = campaignKey(campaign);
      if (!key) continue;
      if (campaignMarkedComplete(key)) continue;
      const marked = markCampaignCompleted(key, {
        id: campaign?.id || "",
        name: campaign?.name || "",
        game: campaign?.game?.displayName || campaign?.game?.name || "",
        startAt: window.startAt || campaign?.startAt || "",
        endAt: window.endAt || campaign?.endAt || "",
        source: "campaign-ended",
        status: "expired",
      });
      if (marked) expiredCount += 1;
    }

    const before = lastCampaignCatalog.length;
    lastCampaignCatalog = (lastCampaignCatalog || []).filter((campaign) => {
      const window = campaignWindow(campaign);
      if (!window.endMs) return true;
      return window.endMs > now;
    });
    if (lastCampaignCatalog.length !== before) {
      lastCampaignCatalogAt = Date.now();
      campaignCatalogCache = { at: lastCampaignCatalogAt, campaigns: lastCampaignCatalog };
      try { writeSession(CAMPAIGN_CATALOG_KEY, campaignCatalogCache); } catch (_) { /* ignore */ }
    }

    if (expiredCount) {
      logActivity("campaign-expiry", `Expired ${expiredCount} open campaign${expiredCount === 1 ? "" : "s"} past end date`, {
        expiredCount,
      });
    }
    return expiredCount;
  }

  function pickTimedDrop(campaigns, gameName) {
    const now = Date.now();
    const wantedGame = (gameName || "").toLowerCase();
    const options = [];
    for (const campaign of campaigns || []) {
      if (campaignMarkedComplete(campaign)) continue;
      if (!campaignIsRoutingOpen(campaign, now)) continue;
      const game = campaign.game?.displayName || campaign.game?.name || "";
      if (!game) continue;
      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = self.currentMinutesWatched == null || self.currentMinutesWatched === "" ? null : Number(self.currentMinutesWatched);
        if (required <= 0 || current >= required || !campaignIsOpen(campaign, drop, now)) continue;
        const pre = dropperPreconditionsMet(drop, drops);
        if (!pre) continue;
        options.push({
          id: drop.id || "",
          dropInstanceID: self.dropInstanceID || "",
          isClaimed: Boolean(self.isClaimed),
          name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop",
          rewardImage: dropBenefitImage(drop),
          game,
          gameSlug: campaign.game?.slug || "",
          gameId: campaign.game?.id || "",
          campaignId: campaign.id || "",
          campaignKey: campaignKey(campaign),
          campaign: campaign.name || game,
          campaignStartAt: campaign.startAt || "",
          campaignEndAt: campaign.endAt || drop.endAt || "",
          dropStartAt: drop.startAt || "",
          dropEndAt: drop.endAt || "",
          endMs: campaignWindow(campaign, drop).endMs || Number.MAX_SAFE_INTEGER,
          percent: dropProgressPercent(current, required),
          currentMinutes: current,
          requiredMinutes: required,
          remainingMinutes: current == null || !Number.isFinite(current) ? null : Math.max(0, required - current),
        });
      }
    }
    if (!options.length) return null;
    const matching = wantedGame
      ? options.filter((item) => item.game.toLowerCase() === wantedGame || item.campaign.toLowerCase().includes(wantedGame))
      : options;
    const pool = matching.length ? matching : options;
    const earning = pool.filter((item) => !dropProgressComplete(item));
    const ranked = preferWinnableDrops(earning, now);
    ranked.sort((a, b) => {
      if ((b.currentMinutes > 0) - (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      return a.remainingMinutes - b.remainingMinutes;
    });
    return ranked[0] || null;
  }

  function pickRemainingGameDrop(campaigns, gameName, completedDropId = "", completedDropName = "", completedCampaignKey = "") {
    const wantedGame = cleanText(gameName).toLowerCase();
    const wantedCampaign = cleanText(completedCampaignKey).toLowerCase();
    const completedName = cleanText(completedDropName).toLowerCase();
    if (!wantedGame) return null;

    const scoped = [];
    for (const campaign of campaigns || []) {
      const key = campaignKey(campaign);
      if (wantedCampaign && key !== wantedCampaign) continue;
      const game = campaign?.game?.displayName || campaign?.game?.name || "";
      if (cleanText(game).toLowerCase() !== wantedGame) continue;
      const drops = (campaign.timeBasedDrops || campaign.drops || []).map((drop) => {
        const dropId = drop.id || "";
        const dropName = cleanText(drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop").toLowerCase();
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = Number(drop?.self?.currentMinutesWatched) || 0;
        const justFinished = Boolean(
          (completedDropId && dropId === completedDropId) ||
          (!completedDropId && completedName && dropName === completedName && current >= required)
        );
        if (!justFinished) return drop;
        // Keep the finished reward for prerequisite resolution. Watch
        // completion is not a claim, and must not fabricate that evidence.
        return {
          ...drop,
          self: {
            ...(drop.self || {}),
            isClaimed: Boolean(drop.self?.isClaimed),
            currentMinutesWatched: Math.max(current, required),
          },
        };
      });
      scoped.push({ ...campaign, timeBasedDrops: drops, drops });
    }
    return pickTimedDrop(scoped, gameName);
  }

  function pickNextGameDrop(campaigns, completedGame, excludedGames = []) {
    const previous = cleanText(completedGame).toLowerCase();
    const excluded = new Set((excludedGames || []).map((game) => cleanText(game).toLowerCase()).filter(Boolean));
    const next = [];
    const now = Date.now();

    for (const campaign of campaigns || []) {
      if (!campaignIsRoutingOpen(campaign, now)) continue;
      const game = campaign.game?.displayName || campaign.game?.name || "";
      const normalizedGame = cleanText(game).toLowerCase();
      if (!game || normalizedGame === previous || excluded.has(normalizedGame)) continue;

      const drops = campaign.timeBasedDrops || campaign.drops || [];
      for (const drop of drops) {
        const self = drop.self || {};
        if (self.isClaimed || requiresSubscription(drop)) continue;
        const required = Number(drop.requiredMinutesWatched) || 0;
        const current = self.currentMinutesWatched == null || self.currentMinutesWatched === "" ? null : Number(self.currentMinutesWatched);
        if (required <= 0 || !campaignIsOpen(campaign, drop, now)) continue;

        const preconditionsMet = dropperPreconditionsMet(drop, drops);
        if (!preconditionsMet) continue;

        next.push({
          id: drop.id || "",
          isClaimed: Boolean(self.isClaimed),
          name: drop.name || drop.benefitEdges?.[0]?.benefit?.name || "Drop",
          rewardImage: dropBenefitImage(drop),
          game,
          gameSlug: campaign.game?.slug || "",
          gameId: campaign.game?.id || "",
          campaignId: campaign.id || "",
          campaignKey: campaignKey(campaign),
          campaign: campaign.name || game,
          campaignStartAt: campaign.startAt || "",
          campaignEndAt: campaign.endAt || drop.endAt || "",
          dropStartAt: drop.startAt || "",
          dropEndAt: drop.endAt || "",
          percent: dropProgressPercent(current, required),
          currentMinutes: current,
          requiredMinutes: required,
          remainingMinutes: current == null || !Number.isFinite(current) ? null : Math.max(0, required - current),
        });
      }
    }

    // Complete-but-unclaimed Drops are claim targets, not watch targets.
    // Sorting by remaining minutes otherwise prefers 100% Drops (remaining 0)
    // over incomplete campaigns in other games.
    const incomplete = next.filter((item) => !dropProgressComplete(item));
    incomplete.sort((a, b) => {
      if ((b.currentMinutes > 0) !== (a.currentMinutes > 0)) return (b.currentMinutes > 0) - (a.currentMinutes > 0);
      return a.remainingMinutes - b.remainingMinutes;
    });
    return incomplete[0] || null;
  }

  function maybeAdvanceExpiredCampaign(campaigns = lastInventoryCampaigns) {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("expired-campaign-advance");
      return false;
    }
    if (!settings.findNextStream || !currentDrop) return false;

    const expiry = campaignExpirySnapshot(campaigns, currentDrop);
    if (!expiry?.ended || !expiry.hasUnclaimed) return false;

    if (!expiry.overdue) {
      if (dropProgressComplete(currentDrop)) {
        setStatus(`Campaign Ended · Claim Grace ${Math.ceil(expiry.graceRemainingMs / 1000)}s`);
      }
      return false;
    }

    const pending = getHandoffState();
    if (handoffIsBusyRouting(pending)) return false;

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: currentDrop.game || expiry.game,
        completedDrop: currentDrop.name || "Drop",
        completedDropId: currentDrop.id || "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: pending?.skippedGames || [],
        forceOpenCampaign: true,
        expiredCampaignKey: expiry.campaignKey,
        expiredCampaignName: expiry.campaignName,
        excludedCampaignKeys: [...new Set([...(pending?.excludedCampaignKeys || []), expiry.campaignKey].filter(Boolean))],
        startedAt: pending?.startedAt || Date.now(),
      },
      `${expiry.campaignName} ended with unclaimed rewards · advancing after 60s grace`,
    );

    logActivity("campaign-expiry", "Campaign claim grace expired · selecting next open campaign", {
      campaign: expiry.campaignName,
      game: expiry.game,
      endedAt: expiry.endAt,
      graceSeconds: Math.round(CAMPAIGN_EXPIRY_GRACE_MS / 1000),
    });
    setStatus(`${expiry.campaignName} Ended · Finding Next Open Campaign`);
    notifyUser("Campaign Ended · Moving To Next Open Drops Campaign");
    return continueToNextGame(campaigns);
  }

  function maybeAdvanceExcludedCampaign(campaigns = lastCampaignCatalog) {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("excluded-campaign-advance");
      return false;
    }
    const pending = getHandoffState();
    const target = currentDrop || (pending?.targetGame ? {
      game: pending.targetGame,
      gameSlug: pending.targetSlug || "",
      campaign: pending.targetCampaign || "",
    } : null);
    if (!campaignIsExcluded(target)) return false;

    const blockedKey = String(
      currentDrop?.campaignKey ||
      currentDrop?.campaignId ||
      pending?.targetCampaignKey ||
      "first-partners-collection"
    ).toLowerCase();
    const blockedGame = cleanText(currentDrop?.game || pending?.targetGame || "First Partners Collection");

    logActivity("campaign-excluded", "Skipped excluded Twitch category and campaign", {
      game: blockedGame || null,
      campaign: currentDrop?.campaign || pending?.targetCampaign || null,
      slug: currentDrop?.gameSlug || pending?.targetSlug || null,
    });
    clearStoredCurrentDrop();

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: blockedGame,
        completedDrop: "",
        completedDropId: "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: [...new Set([...(pending?.skippedGames || []), blockedGame].filter(Boolean))],
        excludedCampaignKeys: [...new Set([...(pending?.excludedCampaignKeys || []), blockedKey].filter(Boolean))],
        forceOpenCampaign: true,
        excludedInvalidCategory: true,
        startedAt: pending?.startedAt || Date.now(),
      },
      `Excluded invalid Twitch category ${blockedGame || "first-partners-collection"} · selecting another campaign`,
    );
    setStatus("Invalid Twitch Category Skipped · Finding Another Campaign");
    refreshDropCard();
    return continueToNextGame(campaigns);
  }

  function completedActiveCampaignKey(pending = getHandoffState()) {
    const keys = [
      currentDrop?.campaignKey,
      currentDrop?.campaignId,
      pending?.targetCampaignKey,
      pending?.selectedCampaignKey,
    ];
    for (const key of keys) {
      const value = cleanText(key);
      if (value && campaignMarkedComplete(value)) return value;
    }
    return "";
  }

  function maybeAbandonCompletedActiveDrop(campaigns = routingCampaignPool()) {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("completed-campaign-abandon");
      return false;
    }
    const pending = getHandoffState();
    const completedKey = completedActiveCampaignKey(pending);
    if (!completedKey) return false;

    const abandonedGame = cleanText(
      currentDrop?.game || pending?.targetGame || pending?.selectedCampaignGame || "Completed Campaign",
    );
    const abandonedCampaign = cleanText(
      currentDrop?.campaign || pending?.targetCampaign || pending?.selectedCampaignName || abandonedGame,
    );

    logActivity("campaign-complete", `Left completed campaign ${abandonedCampaign || abandonedGame} · selecting next open campaign`, {
      campaignKey: completedKey,
      game: abandonedGame || null,
      drop: currentDrop?.name || null,
      handoffState: pending ? normalizedHandoffState(pending) : null,
    });

    clearStoredCurrentDrop();

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: abandonedGame,
        completedDrop: "",
        completedDropId: "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: [...new Set([...(pending?.skippedGames || []), abandonedGame].filter(Boolean))],
        excludedCampaignKeys: [...new Set([...(pending?.excludedCampaignKeys || []), completedKey].filter(Boolean))],
        forceOpenCampaign: true,
        abandonedCompletedCampaign: true,
        auditStage: "",
        startedAt: Date.now(),
      },
      `Completed campaign ${abandonedCampaign || abandonedGame} abandoned · selecting next open campaign`,
    );
    setStatus("Completed Campaign Left · Finding Next Open Campaign");
    notifyUser("Completed Campaign Left · Finding Next Open Drops");
    refreshDropCard();
    return continueToNextGame(campaigns);
  }

  function maybeAbandonUnwinnableActiveDrop(campaigns = routingCampaignPool()) {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("unwinnable-campaign-abandon");
      return false;
    }
    if (!settings.findNextStream || !currentDrop || currentDrop.isClaimed) return false;
    if (dropProgressComplete(currentDrop)) return false;
    if (dropFitsCampaignWindow(currentDrop)) return false;

    const pending = getHandoffState();
    if (handoffIsBusyRouting(pending)) return false;

    const abandonedKey = cleanText(currentDrop.campaignKey || currentDrop.campaignId || "").toLowerCase();
    const abandonedGame = cleanText(currentDrop.game || "Campaign");
    const abandonedCampaign = cleanText(currentDrop.campaign || abandonedGame);
    const excludedKeys = [...new Set([...(pending?.excludedCampaignKeys || []), abandonedKey].filter(Boolean))];
    const nextOpen = pickNextOpenCampaignDrop(campaigns, excludedKeys, []);
    if (!nextOpen || !dropFitsCampaignWindow(nextOpen)) return false;

    const nextKey = cleanText(nextOpen.campaignKey || nextOpen.campaignId || "").toLowerCase();
    if (abandonedKey && nextKey && nextKey === abandonedKey) return false;

    logActivity("campaign-unwinnable", `Left unwinnable ${abandonedCampaign || abandonedGame} · remaining watch exceeds campaign window`, {
      campaignKey: abandonedKey || null,
      game: abandonedGame || null,
      drop: currentDrop.name || null,
      remainingMinutes: Number(currentDrop.remainingMinutes) || null,
      campaignEndAt: currentDrop.campaignEndAt || currentDrop.dropEndAt || null,
      nextCampaign: nextOpen.campaign || nextOpen.game || null,
      nextGame: nextOpen.game || null,
    });

    clearStoredCurrentDrop();

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: abandonedGame,
        completedDrop: "",
        completedDropId: "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: [...new Set([...(pending?.skippedGames || []), abandonedGame].filter(Boolean))],
        excludedCampaignKeys: excludedKeys,
        forceOpenCampaign: true,
        abandonedUnwinnableCampaign: true,
        auditStage: "",
        startedAt: Date.now(),
      },
      `Cannot finish ${abandonedCampaign || abandonedGame} before campaign end · selecting next open campaign`,
    );
    setStatus("Cannot Finish In Time · Finding Next Open Campaign");
    notifyUser("Cannot Finish In Time · Moving To Next Open Drops Campaign");
    refreshDropCard();
    return continueToNextGame(campaigns);
  }

  function maybeYieldToSoonerOpenCampaign(campaigns = routingCampaignPool()) {
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("sooner-campaign-yield");
      return false;
    }
    if (!settings.findNextStream || !currentDrop || currentDrop.isClaimed) return false;
    if (dropProgressComplete(currentDrop)) return false;

    const pending = getHandoffState();
    // Do not interrupt an in-flight search/switch. That bounce is what trips
    // reload-loop protection while two ending-soon campaigns fight.
    if (handoffIsBusyRouting(pending)) return false;

    const currentKey = cleanText(currentDrop.campaignKey || currentDrop.campaignId || "").toLowerCase();
    const currentEndMs = Number(
      currentDrop.endMs
      || Date.parse(currentDrop.campaignEndAt || currentDrop.dropEndAt || "")
      || Number.MAX_SAFE_INTEGER,
    );
    if (!Number.isFinite(currentEndMs) || currentEndMs >= Number.MAX_SAFE_INTEGER / 2) return false;

    const excludedKeys = normalizeExcludedCampaignKeys(pending?.excludedCampaignKeys || []);
    const soonest = pickNextOpenCampaignDrop(campaigns, excludedKeys, pending?.skippedGames || []);
    if (!soonest || !dropFitsCampaignWindow(soonest)) return false;

    const soonestKey = cleanText(soonest.campaignKey || soonest.campaignId || "").toLowerCase();
    if (!soonestKey || soonestKey === currentKey) return false;
    if (excludedKeys.includes(soonestKey)) return false;

    const soonestEndMs = Number(soonest.endMs || Number.MAX_SAFE_INTEGER);
    if (!(soonestEndMs < currentEndMs)) return false;

    // Already routing toward the sooner campaign — let finding/switching finish.
    const targetKey = cleanText(pending?.targetCampaignKey || "").toLowerCase();
    if (pending && targetKey && targetKey === soonestKey) return false;

    const laterGame = cleanText(currentDrop.game || "Campaign");
    const laterCampaign = cleanText(currentDrop.campaign || laterGame);
    const soonerGame = cleanText(soonest.game || "Campaign");
    const soonerCampaign = cleanText(soonest.campaign || soonerGame);

    logActivity("campaign-ending-sooner", `Left ${laterCampaign || laterGame} · ${soonerCampaign || soonerGame} ends sooner`, {
      laterCampaignKey: currentKey || null,
      laterGame: laterGame || null,
      laterEndAt: currentDrop.campaignEndAt || currentDrop.dropEndAt || null,
      soonerCampaignKey: soonestKey || null,
      soonerGame: soonerGame || null,
      soonerEndAt: soonest.campaignEndAt || soonest.dropEndAt || null,
      handoffState: pending ? normalizedHandoffState(pending) : null,
    });

    adoptSelectedTargetDrop(soonest, "ending-sooner");

    transitionHandoff(
      HANDOFF_STATES.SELECTING_GAME,
      {
        completedGame: laterGame,
        completedDrop: "",
        completedDropId: "",
        targetGame: "",
        targetSlug: "",
        targetStream: "",
        skippedGames: pending?.skippedGames || [],
        excludedCampaignKeys: excludedKeys,
        forceOpenCampaign: true,
        yieldedToSoonerCampaign: true,
        deferredLaterCampaign: laterCampaign,
        auditStage: "",
        startedAt: Date.now(),
      },
      `Sooner campaign ${soonerCampaign || soonerGame} ends before ${laterCampaign || laterGame} · switching`,
    );
    setStatus(`Ending Sooner · ${soonerGame || soonerCampaign}`);
    notifyUser("Ending Sooner · Moving To Next Open Drops Campaign");
    refreshDropCard();
    return continueToNextGame(campaigns);
  }

  function advanceAfterWatchComplete(drop = currentDrop, reason = "watch-complete") {
    if (!drop || !dropProgressComplete(drop)) return false;

    const completed = { ...drop };
    const completedGame = cleanText(completed.game || "");
    const completedCampaignKey = cleanText(completed.campaignKey || completed.campaignId || "");
    const completedCampaign = cleanText(completed.campaign || completedGame);
    const pool = routingCampaignPool();

    // Persist Twitch-credited watch completion without pretending the reward
    // itself has been claimed. This keeps completed watch targets out of routing.
    rememberCampaignStates(pool, "watch-progress-complete");

    const remaining = pickRemainingGameDrop(
      pool,
      completedGame,
      completed.id || "",
      completed.name || "",
      completedCampaignKey,
    );

    if (remaining && !dropProgressComplete(remaining) && dropFitsCampaignWindow(remaining)) {
      adoptSelectedTargetDrop(remaining, "watch-complete-next-drop");
      logActivity("drop-earned", `${completed.name || "Drop"} reached 100% · continuing current campaign`, {
        game: completedGame || null,
        campaign: completedCampaign || null,
        campaignKey: completedCampaignKey || null,
        completedDropId: completed.id || null,
        nextDrop: remaining.name || null,
        nextDropId: remaining.id || null,
        reason,
      });
      transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          ...routingControllerTargetFromDrop(remaining),
          targetStream: "",
          failedStreams: [],
          candidateEvidence: null,
          waitReason: "",
          deadlineAt: 0,
        },
        `${completed.name || "Drop"} earned · continuing ${completedCampaign || completedGame || "campaign"}`,
      );
      setStatus(`${completed.name || "Drop"} Earned · Next Drop: ${remaining.name || "Drop"}`);
      notifyUser(`${completed.name || "Drop"} Earned · Continuing Campaign`);
      queueGqlPollSoon("drop-earned-next-drop", 0);
      return true;
    }

    const completedCampaignNode = findCampaignForDrop(pool, completed);
    if (completedCampaignNode && campaignWatchDropsComplete(completedCampaignNode)) {
      markCampaignCompleteIfWatchDone(completedCampaignNode, "watch-progress-complete");
    }

    clearStoredCurrentDrop();
    logActivity("drop-earned", `${completed.name || "Drop"} reached 100% · selecting next campaign`, {
      game: completedGame || null,
      campaign: completedCampaign || null,
      campaignKey: completedCampaignKey || null,
      completedDropId: completed.id || null,
      reason,
      claimed: Boolean(completed.isClaimed),
    });
    transitionRoutingController(
      ROUTING_STATES.SELECT_CAMPAIGN,
      {
        completedGame,
        completedDrop: completed.name || "Drop",
        completedDropId: completed.id || "",
        completedCampaignKey,
        targetGame: "",
        targetCampaign: "",
        targetCampaignKey: "",
        targetDropId: "",
        targetStream: "",
        failedStreams: [],
        candidateEvidence: null,
        waitReason: "",
        deadlineAt: 0,
      },
      `${completed.name || "Drop"} earned · selecting next eligible campaign`,
    );
    setStatus(`${completed.name || "Drop"} Earned · Selecting Next Campaign`);
    notifyUser(`${completed.name || "Drop"} Earned · Moving On`);
    queueGqlPollSoon("drop-earned-next-campaign", 0);
    return true;
  }

  function scheduleNextGameAfterClaim(drop) {
    const game = cleanText(drop?.game);
    if (currentDrop && (!drop?.id || currentDrop.id === drop.id)) {
      currentDrop = { ...currentDrop, isClaimed: true };
      writeSession("tdh-drop", currentDrop);
    }
    if (!settings.findNextStream) return;
    transitionRoutingController(
      ROUTING_STATES.SELECT_CAMPAIGN,
      {
        completedGame: game || currentDrop?.game || "",
        completedDrop: drop?.name || currentDrop?.name || "Drop",
        completedDropId: drop?.id || currentDrop?.id || "",
        completedCampaignKey: drop?.campaignKey || drop?.campaignId || currentDrop?.campaignKey || currentDrop?.campaignId || "",
        targetStream: "",
        failedStreams: [],
        deadlineAt: 0,
      },
      `Claimed ${drop?.name || "Drop"} · selecting next eligible watch-time Drop`,
    );
    setStatus(`${game || "Drop"} Claimed · Selecting Next Drop`);
    queueGqlPollSoon("drop-claimed", 0);
  }

  function isDirectoryCategoryPage() {
    return location.pathname.toLowerCase().startsWith("/directory/category/");
  }

  function normalizeGameName(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function gameNamesMatch(a, b) {
    const left = normalizeGameName(a);
    const right = normalizeGameName(b);
    if (!left || !right) return false;
    if (left === right) return true;
    const leftAlias = CATEGORY_SLUG_ALIASES[left];
    const rightAlias = CATEGORY_SLUG_ALIASES[right];
    return Boolean(
      (leftAlias && normalizedGameSlug(leftAlias) === normalizedGameSlug(b)) ||
      (rightAlias && normalizedGameSlug(rightAlias) === normalizedGameSlug(a))
    );
  }

  function extractCardGameName(card, text = "", aria = "") {
    const categoryLink = card?.querySelector?.('a[href*="/directory/category/"], a[href*="/directory/game/"]');
    if (categoryLink) {
      const href = String(categoryLink.getAttribute?.("href") || categoryLink.href || "");
      const slugPart = href.split("/directory/category/")[1] || href.split("/directory/game/")[1] || "";
      const fromSlug = decodeURIComponent(String(slugPart.split(/[/?#]/)[0] || "")).replace(/-/g, " ");
      const linkText = cleanText(categoryLink.textContent || categoryLink.getAttribute?.("aria-label") || "");
      if (linkText) return linkText;
      if (fromSlug) return fromSlug;
    }
    const gameNode = card?.querySelector?.('[data-a-target*="game"], [data-a-target*="category"], [data-test-selector*="game-name"]');
    const nodeText = cleanText(gameNode?.textContent || "");
    if (nodeText) return nodeText;
    const haystack = `${aria} ${text}`;
    const playing = haystack.match(/\b(?:playing|streaming)\s+(.+?)(?:\s+\d[\d,.]*\s*(?:viewers?|watching)|\s+LIVE\b|\s*$)/i);
    if (playing) return cleanText(playing[1]);
    return "";
  }

  function shuffleInPlace(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      const current = items[index];
      items[index] = items[swap];
      items[swap] = current;
    }
    return items;
  }

  function streamViewerCount(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function compareKnownViewerCounts(left, right, descending = false) {
    const a = streamViewerCount(left?.viewers);
    const b = streamViewerCount(right?.viewers);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return descending ? b - a : a - b;
  }

  function streamCandidateEvidence(candidate) {
    const live = candidate?.availability === 'live' || candidate?.visibleInCategory === true;
    const hint = candidate?.availability === 'campaign-hint' || candidate?.source === 'campaign-hint';
    const freshCached = candidate?.freshCached === true;
    const acl = candidate?.allowListMatch === true || candidate?.aclMatched === true || candidate?.campaignAclMatched === true;
    const drops = candidate?.dropsTagged === true;
    let rank = 7;
    let label = 'stale-cache';
    if (live && acl) { rank = 0; label = 'live-campaign-allowed'; }
    else if (live && drops) { rank = 1; label = 'live-drops-tagged'; }
    else if (live) { rank = 2; label = 'live-same-game'; }
    else if (hint && acl) { rank = 3; label = 'campaign-hint-allowed'; }
    else if (hint && drops) { rank = 4; label = 'campaign-hint'; }
    else if (freshCached && acl) { rank = 5; label = 'fresh-cache-allowed'; }
    else if (freshCached && drops) { rank = 6; label = 'fresh-cache-drops'; }
    return { rank, label, live, acl, drops, hint, freshCached };
  }
