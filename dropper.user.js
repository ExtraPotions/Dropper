// ==UserScript==
// @name         Dropper
// @namespace    twitch-drops-helper
// @version      3.3.0-dev.2
// @description  A browser-only Twitch companion for the streams you choose to watch: track credited reward progress, manage campaigns, and collect earned rewards.
// @icon         https://raw.githubusercontent.com/ExtraPotions/Dropper/main/assets/dropper-launcher.svg
// @updateURL    https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js
// @downloadURL  https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js
// @tag          Twitch
// @tag          Drops
// @tag          Rewards
// @author       ExtraPotions
// @license      PolyForm-Noncommercial-1.0.0
// @match        https://www.twitch.tv/*
// @match        https://player.twitch.tv/*
// @match        https://embed.twitch.tv/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      gql.twitch.tv
// @connect      raw.githubusercontent.com
// ==/UserScript==


// Dropper Manager Metadata
// Description: Track Twitch-credited progress, collect free earned rewards, and manage campaigns while respecting your playback and stream choices.
// Tags: Twitch, Drops, Rewards


(function twitchDropsHelper() {
  "use strict";

  // Dropper owns one top-level Twitch page. Running inside Twitch player/embed
  // frames duplicates heartbeats, update checks, DOM scans, and network work.
  if (window.top !== window.self) return;

  // BEGIN SHARED DIAGNOSTICS
/* Local diagnostic capture shared at build time by ExtraPotions products. */
const ExtraPotionsDiagnostics = (() => {
  const LIMIT = 100;
  const supportedProducts = ['ward', 'dropper', 'prisma', 'shift'];
  const protocol = 'exp-core-coordination-v1';
  const entries = [], hooks = [], registrations = new Map();
  const startedAt = new Date().toISOString();
  let omitted = 0, recording = false, active = true;
  const redact = value => String(value)
    .replace(/https?:\/\/[^\s"<>]+/gi, '[url]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b(Bearer|OAuth)\s+\S+/gi, '$1 [redacted]')
    .replace(/\b(token|password|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\b\d{3}-\d{7}-\d{7}\b/g, '[order-id]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[opaque-id]')
    .slice(0, 2000);
  function clean(value, depth = 0, seen = new WeakSet()) {
    if (depth > 8) return '[depth limit]';
    if (typeof value === 'string') return redact(value);
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Node || value === window) return undefined;
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    try {
      if (value instanceof Error) return { name: redact(value.name), message: redact(value.message), stack: redact(value.stack || '') };
      if (Array.isArray(value)) return value.slice(0, 100).map(item => clean(item, depth + 1, seen));
      const result = {};
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value)).slice(0, 150)) {
        if (/token|cookie|authorization|password|secret|pageText|innerHTML|outerHTML|formValue|matchText|__proto__|constructor|prototype/i.test(key)) continue;
        if (!('value' in descriptor)) continue;
        const item = clean(descriptor.value, depth + 1, seen);
        if (item !== undefined) result[key] = item;
      }
      return result;
    } catch { return '[unavailable]'; } finally { seen.delete(value); }
  }
  function record(level, kind, values) {
    if (recording || !active) return;
    recording = true;
    try {
      entries.push({ at: new Date().toISOString(), level, kind, values: clean(values.slice(0, 10)) });
      if (entries.length > LIMIT) { entries.shift(); omitted += 1; }
    } catch {} finally { recording = false; }
  }
  for (const level of ['debug', 'log', 'info', 'warn', 'error']) {
    try {
      const original = console[level];
      if (typeof original !== 'function') continue;
      const wrapped = function(...args) { record(level, 'console', args); return Reflect.apply(original, this, args); };
      console[level] = wrapped;
      if (console[level] === wrapped) hooks.push({ level, original, wrapped });
    } catch {}
  }
  function resourceErrorDetails(target) {
    const element = target?.tagName || 'unknown';
    const root = target?.getRootNode?.();
    const host = root?.host || null;
    const productId = host?.dataset?.productId || host?.dataset?.expDiagnosticsProduct || null;
    const owned = Boolean(
      productId ||
      host?.dataset?.expOwned === '1' ||
      target?.dataset?.expOwned === '1'
    );
    let assetHost = null;
    try {
      const raw = target?.currentSrc || target?.src || target?.href || '';
      assetHost = raw ? new URL(raw, location.href).hostname : null;
    } catch {}
    return {
      element,
      owner: owned ? (productId || 'extrapotions') : 'page',
      assetHost,
    };
  }
  const onError = event => record('error', event.target === window ? 'runtime-error' : 'resource-error',
    event.target === window
      ? [event.error || event.message, { line: event.lineno, column: event.colno }]
      : [resourceErrorDetails(event.target)]);
  const onRejection = event => record('error', 'unhandled-rejection', [event.reason]);
  addEventListener('error', onError, true);
  addEventListener('unhandledrejection', onRejection);

  function registerProduct(id, version, host) {
    id = String(id).toLowerCase();
    if (!supportedProducts.includes(id)) return null;
    let marker = registrations.get(id);
    if (!marker) {
      marker = document.createElement('meta');
      marker.dataset.expOwned = '1';
      marker.dataset.expDiagnosticsProduct = id;
      marker.dataset.expProductVersion = String(version || 'unknown').slice(0, 40);
      marker.dataset.expCoordinationProtocol = protocol;
      marker.dataset.expDiagnosticsInstance = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      registrations.set(id, marker);
    }
    if (!marker.isConnected) (document.head || document.documentElement)?.append(marker);
    if (host) host.dataset.expDiagnosticsInstance = marker.dataset.expDiagnosticsInstance;
    return marker;
  }
  addEventListener('DOMContentLoaded', () => { for (const marker of registrations.values()) if (!marker.isConnected) (document.head || document.documentElement)?.append(marker); }, { once: true });
  function compatibility() {
    const markers = [...document.querySelectorAll('meta[data-exp-diagnostics-product]')];
    const hosts = [...document.querySelectorAll('[data-exp-product-launcher="1"][data-product-id]')];
    const conflicts = [];
    const products = supportedProducts.map(id => {
      const records = markers.filter(n => n.dataset.expDiagnosticsProduct === id);
      const launchers = hosts.filter(n => n.dataset.productId === id);
      const versions = [...new Set(records.map(n => redact(n.dataset.expProductVersion || 'unknown')))];
      const protocols = [...new Set(records.map(n => redact(n.dataset.expCoordinationProtocol || 'unknown')))];
      if (records.length > 1 || launchers.length > 1) conflicts.push({ type: 'duplicate-product', products: [id], instances: Math.max(records.length, launchers.length) });
      if (protocols.some(p => p !== protocol && p !== 'unknown')) conflicts.push({ type: 'protocol-mismatch', products: [id], protocols });
      return { id, status: records.length || launchers.length ? 'observed' : 'not-observed', versions, protocols, instances: Math.max(records.length, launchers.length), launchers: launchers.length };
    });
    const boxes = hosts.map(host => {
      // An inaccessible shadow or unknown box is not evidence of a collision.
      const launcher = host.shadowRoot?.querySelector('[data-exp-part="launcher"],.ward-launcher,.launcher,#tdh-settings-launcher');
      if (!launcher || !launcher.getClientRects().length || getComputedStyle(launcher).visibility === 'hidden') return null;
      return { id: host.dataset.productId, box: launcher.getBoundingClientRect() };
    }).filter(x => x && supportedProducts.includes(x.id));
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const x = boxes[a], y = boxes[b];
      if (Math.min(x.box.right, y.box.right) - Math.max(x.box.left, y.box.left) > 2 && Math.min(x.box.bottom, y.box.bottom) - Math.max(x.box.top, y.box.top) > 2)
        conflicts.push({ type: 'launcher-overlap', products: [x.id, y.id] });
    }
    return { scope: 'current-page', installationInventory: 'unavailable', products, conflicts,
      status: conflicts.length ? 'conflicts-detected' : 'no-conflicts-observed',
      limitations: ['Disabled products and products outside their match rules cannot be enumerated.', 'Only reported registrations, protocol mismatches, duplicate instances and observable launcher overlap are checked.'] };
  }
  function createReport(product, details = {}, core = {}) {
    const { host, shadow: suppliedShadow, ...rest } = details;
    const shadow = suppliedShadow || host?.shadowRoot;
    const id = String(product || 'ExtraPotions').toLowerCase();
    const registration = registerProduct(id, details.product?.version || details.version, host);
    const data = clean(rest);
    const count = selector => document.querySelectorAll(selector).length;
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const byType = {};
    for (const entry of resources) {
      const summary = byType[entry.initiatorType || 'other'] ||= { count: 0, durationMs: 0, transferBytes: 0 };
      summary.count++; summary.durationMs += Math.round(entry.duration); summary.transferBytes += entry.transferSize || 0;
    }
    const page = { origin: location.origin, protocol: location.protocol, readyState: document.readyState, contentType: document.contentType, characterSet: document.characterSet, compatibilityMode: document.compatMode, language: document.documentElement?.lang || null, direction: document.documentElement?.dir || 'auto',
      structure: { elements: count('*'), headings: count('h1,h2,h3,h4,h5,h6'), links: count('a[href]'), forms: count('form'), inputs: count('input,select,textarea'), buttons: count('button,[role="button"]'), images: count('img'), videos: count('video'), audio: count('audio'), frames: count('iframe'), scripts: count('script'), stylesheets: document.styleSheets.length },
      layout: { documentWidth: document.documentElement?.scrollWidth || 0, documentHeight: document.documentElement?.scrollHeight || 0, scrollX, scrollY, horizontalOverflow: (document.documentElement?.scrollWidth || 0) > innerWidth },
      preferences: { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, darkColorScheme: matchMedia('(prefers-color-scheme: dark)').matches, forcedColors: matchMedia('(forced-colors: active)').matches },
      performance: { navigation: navigation ? { type: navigation.type, durationMs: Math.round(navigation.duration), responseMs: Math.round(navigation.responseEnd), domInteractiveMs: Math.round(navigation.domInteractive), domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd), loadMs: Math.round(navigation.loadEventEnd), redirectCount: navigation.redirectCount } : null, resources: { count: resources.length, byType }, paint: performance.getEntriesByType('paint').map(e => ({ name: e.name, startMs: Math.round(e.startTime) })) },
      privacy: { pageText: 'excluded', formValues: 'excluded', urlPathsAndQueries: 'excluded', resourceUrls: 'excluded', cookiesAndStorage: 'excluded; sanitized plugin state supplied separately' } };
    const environment = { hostname: location.hostname, topLevelContext: window.top === window.self, visibility: document.visibilityState, online: navigator.onLine, language: navigator.language, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio } };
    const rect = n => { const b = n.getBoundingClientRect(); return { width: b.width, height: b.height, x: b.x, y: b.y, visible: !!n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' }; };
    const ui = { mounted: !!host?.isConnected, menuWidth: host?.dataset.menuWidth || null,
      surfaces: [...(shadow?.querySelectorAll('.panel,.ward,#tdh-tools-dock,[data-exp-part="dock"]') || [])].map(rect),
      categories: [...(shadow?.querySelectorAll('.route,.nav-item,.fl-tool-header') || [])].map(n => ({ name: redact(n.textContent.trim()), expanded: n.getAttribute('aria-expanded') })),
      swatches: [...(shadow?.querySelectorAll('.exp-theme-swatch') || [])].map(n => ({ name: n.getAttribute('aria-label'), selected: n.getAttribute('aria-pressed'), ...rect(n) })) };
    let manager = null;
    try { if (typeof GM_info === 'object') manager = { name: GM_info.scriptHandler || null, version: GM_info.version || null, injectInto: GM_info.injectInto || null }; } catch {}
    return { ...data, report: `${product} Diagnostics`, schemaVersion: 3, generatedAt: new Date().toISOString(), page,
      technical: { environment, manager, core: clean(core), ui, capabilities: { mutationObserver: typeof MutationObserver === 'function', constructedStylesheets: typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype, clipboard: !!navigator.clipboard, trustedTypes: !!globalThis.trustedTypes } },
      console: { startedAt, scope: 'accessible-userscript-realm-and-window-events', limit: LIMIT, omitted, hooks: hooks.map(h => ({ level: h.level, installed: console[h.level] === h.wrapped })), entries: clean(entries), limitations: ['No DevTools history, browser-internal logs, or inaccessible isolated-world console messages.', 'Messages are redacted and bounded; attribution to another script is not inferred.'] },
      plugin: { id, version: data.product?.version || data.version || registration?.dataset.expProductVersion || null, state: data, compatibility: compatibility() },
      environment, ui, core: data.core || clean(core) };
  }
  function dispose() {
    active = false;
    for (const {level, original, wrapped} of hooks) if (console[level] === wrapped) console[level] = original;
    removeEventListener('error', onError, true); removeEventListener('unhandledrejection', onRejection);
    for (const marker of registrations.values()) marker.remove();
  }
  // Dropper is the source of truth: Show/Hide first, Copy second, transient
  // Diagnostics Copied / Copy Failed feedback, and fresh reports per action.
  function bindControls({ show, copy, output, getReport, notify = () => {}, onShow = () => {}, onCopy = () => {} }) {
    let timer, generation = 0;
    output.hidden = true; output.setAttribute('role', 'region');
    output.setAttribute('aria-label', 'Page, technical, console, and plugin diagnostics'); output.tabIndex = 0;
    show.setAttribute('aria-expanded', 'false');
    const showClick = async () => {
      const opening = output.hidden, ticket = ++generation;
      output.hidden = !opening; output.classList.toggle('open', opening);
      show.textContent = opening ? 'Hide Diagnostics' : 'Show Diagnostics';
      show.setAttribute('aria-expanded', String(opening)); show.classList.toggle('last-opened', opening);
      if (opening) {
        try { const report = await getReport(); if (ticket === generation) output.textContent = JSON.stringify(report, null, 2); }
        catch { if (ticket === generation) output.textContent = 'Diagnostics unavailable.'; notify('Could not generate diagnostics.'); }
      }
      onShow(opening);
    };
    const copyClick = async () => {
      copy.disabled = true; clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(JSON.stringify(await getReport(), null, 2));
        copy.textContent = 'Diagnostics Copied'; onCopy();
      } catch { copy.textContent = 'Copy Failed'; notify('Could not copy diagnostics. Use Show Diagnostics.'); }
      finally { copy.disabled = false; timer = setTimeout(() => { copy.textContent = 'Copy Diagnostics'; }, 1600); }
    };
    show.addEventListener('click', showClick); copy.addEventListener('click', copyClick);
    return () => { ++generation; clearTimeout(timer); show.removeEventListener('click', showClick); copy.removeEventListener('click', copyClick); };
  }
  function createControls(getReport, notify) {
    const wrapper = document.createElement('div'); wrapper.className = 'diagnostics-controls';
    const actions = document.createElement('div'); actions.className = 'action-pair';
    const show = document.createElement('button'), copy = document.createElement('button'), output = document.createElement('pre');
    for (const button of [show, copy]) { button.type = 'button'; button.className = 'life-btn action'; }
    show.textContent = 'Show Diagnostics'; copy.textContent = 'Copy Diagnostics'; output.className = 'diag';
    bindControls({ show, copy, output, getReport, notify });
    actions.append(show, copy); wrapper.append(actions, output); return wrapper;
  }
  return Object.freeze({ createReport, registerProduct, compatibility, bindControls, createControls, dispose });
})();

  // END SHARED DIAGNOSTICS

  const SETTINGS_KEY = "tdh-settings-v3";
  const ACCOUNT_SCOPE_OWNER_KEY = "dropper-account-scope-owner-v1";
  const LEGACY_LAUNCHER_TOP_KEY = "tdh-launcher-top";
  const LEGACY_LAUNCHER_GRID_DELTA_KEY = "tdh-launcher-grid-delta-v3";
  const LAUNCHER_GRID_DELTA_KEY = "exp:v3:launcher-grid-delta";
  const LAUNCHER_ORDER_KEY = "exp:v3:launcher-order";
  function protectLauncherHost(host) {
    host = host?.getRootNode?.().host || host;
    if (!host || host.nodeType !== 1) return () => {};
    host.dataset.expOwned = '1';
    ExtraPotionsDiagnostics.registerProduct('dropper', APP_VERSION, host);
    const shadow = host.shadowRoot;
    const hostCss = `:host{all:initial!important;position:fixed!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;display:block!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;z-index:2147483647!important;isolation:isolate!important;transform:none!important;filter:none!important;clip:auto!important;clip-path:none!important;contain:none!important;content-visibility:visible!important;mix-blend-mode:normal!important}`;
    let protectionSheet = null;
    let protectionStyle = null;
    let repairing = false;
    const installHostCss = () => {
      if (!shadow) return;
      try {
        const current = shadow.adoptedStyleSheets;
        if (protectionSheet && current?.includes?.(protectionSheet)) return;
        const view = host.ownerDocument?.defaultView || window;
        const Sheet = view.CSSStyleSheet || (typeof CSSStyleSheet === 'function' ? CSSStyleSheet : null);
        if (typeof Sheet === 'function' && Sheet.prototype?.replaceSync && current && typeof current[Symbol.iterator] === 'function') {
          if (!protectionSheet) {
            protectionSheet = new Sheet();
            protectionSheet.replaceSync(hostCss);
          }
          if (![...current].includes(protectionSheet)) shadow.adoptedStyleSheets = [...current, protectionSheet];
          return;
        }
      } catch {}
      if (!protectionStyle) {
        protectionStyle = document.createElement('style');
        protectionStyle.dataset.expHostProtection = '1';
        protectionStyle.textContent = hostCss;
      }
      if (!protectionStyle.isConnected) {
        try { shadow.prepend(protectionStyle); } catch {}
      }
    };
    const ensure = () => {
      if (repairing) return;
      repairing = true;
      try {
        const root = document.documentElement;
        if (root && host.parentNode !== root) root.append(host);
        if (host.hidden) host.hidden = false;
        host.removeAttribute('hidden');
        host.removeAttribute('inert');
        if (host.getAttribute('aria-hidden') === 'true') host.removeAttribute('aria-hidden');
        installHostCss();
        if (typeof host.showPopover === 'function') {
          if (host.getAttribute('popover') !== 'manual') host.setAttribute('popover', 'manual');
          let open = false;
          try { open = host.matches(':popover-open'); } catch {}
          if (!open) { try { host.showPopover(); } catch {} }
        }
      } catch {}
      repairing = false;
    };
    ensure();
    const hostObserver = new MutationObserver(() => queueMicrotask(ensure));
    hostObserver.observe(host, { attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'popover'] });
    const rootObserver = new MutationObserver(() => {
      if (host.parentNode !== document.documentElement) queueMicrotask(ensure);
    });
    rootObserver.observe(document.documentElement, { childList: true });
    const timer = setInterval(ensure, 2000);
    const onToggle = () => queueMicrotask(ensure);
    host.addEventListener('toggle', onToggle);
    return () => {
      hostObserver.disconnect();
      rootObserver.disconnect();
      clearInterval(timer);
      host.removeEventListener('toggle', onToggle);
      if (protectionSheet && shadow?.adoptedStyleSheets) {
        try { shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets].filter((sheet) => sheet !== protectionSheet); } catch {}
      }
      try { protectionStyle?.remove(); } catch {}
    };
  }

  function registerBadgeGrid(host, productId, priority) {
    protectLauncherHost(host);
    host.dataset.expProductLauncher = "1"; host.dataset.productId = productId; host.dataset.launcherPriority = String(priority);
    const layout = () => {
      const columns = 3;
      let order=[];try{const saved=JSON.parse(localStorage.getItem(LAUNCHER_ORDER_KEY)||"[]");if(Array.isArray(saved))order=saved;}catch{}
      const peers = [...document.querySelectorAll('[data-exp-product-launcher="1"]')].sort((a,b)=>{const ai=order.indexOf(a.dataset.productId),bi=order.indexOf(b.dataset.productId);if(a.dataset.productId!=="dropper"&&b.dataset.productId!=="dropper"&&ai!==bi){if(ai<0)return 1;if(bi<0)return -1;return ai-bi;}return Number(b.dataset.launcherPriority||0)-Number(a.dataset.launcherPriority||0)||(a.dataset.productId||'').localeCompare(b.dataset.productId||'');});
      const dropper = peers.find((node) => node.dataset.productId === "dropper");
      const products = peers.filter((node) => node !== dropper);
      const assign = (node, slot, span = 1) => {
        const row = Math.floor(slot / columns);
        const column = slot % columns;
        node.dataset.launcherSlot = String(slot); node.dataset.launcherRow = String(row); node.dataset.launcherColumn = String(column); node.dataset.launcherSpan = String(span);
        node.style.setProperty('--exp-launcher-x', `${column * 56}px`); node.style.setProperty('--exp-launcher-y', `${row * 56}px`); node.style.setProperty('--exp-launcher-offset', `${row * 56}px`);
      };
      if (dropper) assign(dropper, 0);
      products.forEach((node, index) => assign(node, (dropper ? 1 : 0) + index));
      try{localStorage.setItem(LAUNCHER_ORDER_KEY,JSON.stringify(products.map((node)=>node.dataset.productId).filter(Boolean)));}catch{}
    };
    const refresh = () => requestAnimationFrame(() => { layout(); layoutChrome(); layoutFloatingNotices(); });
    document.addEventListener('exp-core:coordination', refresh); addEventListener('resize', refresh, { passive:true }); layout();
    document.dispatchEvent(new CustomEvent('exp-core:coordination',{detail:{type:'launcher-added',productId}}));
  }
  const APP_VERSION = "3.3.0-dev.2";
  ExtraPotionsDiagnostics.registerProduct("dropper", APP_VERSION);
  const LAST_VERSION_KEY = "dropper-last-version-v2";
  const NOTICE_KEY_PREFIX = "exp:v3:dropper:notice:";
  const UPDATE_STATE_KEY = "dropper-update-state-v2";
  const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const UPDATE_CHECK_LEASE_MS = 30 * 1000;

  function claimNotice(changeId) {
    const key = NOTICE_KEY_PREFIX + String(changeId || "change");
    try {
      if (localStorage.getItem(key) === "1") return false;
      localStorage.setItem(key, "1");
    } catch (_) { /* best effort */ }
    return true;
  }

  function layoutFloatingNotices() {
    const launchers = [...document.querySelectorAll('[data-exp-product-launcher="1"][data-product-id]')]
      .map((host) => host.shadowRoot?.querySelector('[data-exp-part="launcher"],.ward-launcher,.launcher,#tdh-settings-launcher'))
      .filter(Boolean)
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.width && box.height);
    const notices = [...document.querySelectorAll('[data-exp-product-launcher="1"][data-product-id]')]
      .flatMap((host) => [...(host.shadowRoot?.querySelectorAll('[data-exp-floating-notice="1"]') || [])].map((notice) => ({ host, notice })))
      .filter(({ notice }) => !notice.hidden && notice.getClientRects().length)
      .sort((a, b) => Number(a.host.dataset.launcherSlot || 0) - Number(b.host.dataset.launcherSlot || 0) || a.host.dataset.productId.localeCompare(b.host.dataset.productId));
    if (!launchers.length || !notices.length) return;
    const anchor = document.documentElement.dataset.expLauncherAnchor === "top" ? "top" : "bottom";
    const gridTop = Math.min(...launchers.map((box) => box.top));
    const gridBottom = Math.max(...launchers.map((box) => box.bottom));
    const gridRight = Math.max(...launchers.map((box) => box.right));
    let cursor = anchor === "top" ? gridBottom + 8 : gridTop - 8;
    for (const { notice } of notices) {
      const width = Math.min(notice.offsetWidth || notice.scrollWidth || 260, Math.max(0, innerWidth - 24));
      const height = notice.offsetHeight || notice.scrollHeight || 72;
      const top = anchor === "top" ? cursor : cursor - height;
      notice.style.setProperty("width", `${width}px`, "important");
      notice.style.setProperty("left", `${Math.max(8, Math.min(innerWidth - width - 8, gridRight - width))}px`, "important");
      notice.style.setProperty("right", "auto", "important");
      notice.style.setProperty("top", `${Math.max(8, Math.min(innerHeight - height - 8, top))}px`, "important");
      notice.style.setProperty("bottom", "auto", "important");
      cursor = anchor === "top" ? top + height + 8 : top - 8;
    }
  }
  const NEXT_GAME_KEY = "dropper-next-game-after-claim";
  const ROUTING_SESSION_KEY = "dropper-routing-session-v310";
  const ROUTING_SESSION_VERSION = 1;
  const ROUTING_STATES = Object.freeze({
    IDLE: "idle",
    SELECT_CAMPAIGN: "select-campaign",
    FIND_STREAM: "find-stream",
    OPEN_STREAM: "open-stream",
    VERIFY_STREAM: "verify-stream",
    EARNING: "earning",
    CLAIM: "claim",
    WAITING: "waiting",
    PAUSED: "paused",
    ERROR: "error",
  });
  const ROUTING_NAVIGATION_DEADLINE_MS = 30 * 1000;
  const ROUTING_VERIFY_DEADLINE_MS = 90 * 1000;
  const ROUTING_WAIT_RETRY_MS = 30 * 1000;
  const ROUTING_NO_CAMPAIGN_RETRY_MS = 60 * 1000;
  const ROUTING_OFFLINE_GRACE_MS = 60 * 1000;
  const ROUTING_CLAIM_FALLBACK_MS = 60 * 1000;
  const HANDOFF_STAGE_TIMEOUT_MS = 45 * 1000;
  const HEARTBEAT_INTERVAL_MS = 5000;
  const STARTUP_NETWORK_QUIET_MS = 12 * 1000;
  const STREAM_ROUTE_SETTLE_MS = 15 * 1000;
  const SKIP_STREAMER_ARM_MS = 3 * 1000;
  const SKIP_STREAMER_ARM_TICK_MS = 250;
  const NAVIGATION_GUARD_KEY = "dropper-auto-navigation-guard";
  const NAVIGATION_FLIGHT_KEY = "dropper-navigation-in-flight";
  const AUTO_NAVIGATION_IN_FLIGHT_MS = 20 * 1000;
  const UI_DOM_SCAN_INTERVAL_MS = 15 * 1000;
  const PROMO_STARTUP_SCAN_DELAY_MS = 8 * 1000;
  const AUTO_NAVIGATION_WINDOW_MS = 60 * 1000;
  const AUTO_NAVIGATION_LIMIT = 6;
  const AUTO_NAVIGATION_COOLDOWN_MS = 90 * 1000;
  const GQL_POLL_INTERVAL_MS = 60 * 1000;
  const GQL_RECOVERY_INTERVAL_MS = 30 * 1000;
  const GQL_MIN_GAP_MS = 15 * 1000;
  const GQL_MAX_BACKOFF_MS = 5 * 60 * 1000;
  const ACTIVITY_LOG_KEY = "dropper-activity-log";
  const NETWORK_STATE_KEY = "dropper-network-state";
  const STANDBY_CACHE_KEY = "dropper-standby-streams";
  const CAMPAIGN_CATALOG_KEY = "dropper-campaign-catalog";
  const CAMPAIGN_PAGE_IMPORT_KEY = "dropper-campaign-page-import-v1";
  const CAMPAIGN_MEMORY_KEY = "dropper-campaign-memory-v1";
  const CAMPAIGN_MEMORY_RESET_KEY = "dropper-campaign-memory-reset-v1";
  const IGNORED_CAMPAIGN_GAMES_KEY = "dropper-ignored-campaign-games-v1";
  const CAMPAIGN_MEMORY_RESET_VERSION = "3.2.6";
  const STANDBY_REFRESH_KEY = "dropper-standby-refresh-at";
  const MUTE_PENDING_KEY = "dropper-mute-pending-v1";
  const MUTE_PENDING_MS = 45 * 1000;
  const TAB_PRESENCE_KEY = "dropper-tab-presence-v1";
  const TAB_ID_KEY = "dropper-tab-id-v1";
  const TAB_STARTED_KEY = "dropper-tab-started-v1";
  const TAB_CHANNEL_NAME = "dropper-tab-presence-v1";
  const TAB_STALE_MS = 20 * 1000;
  const TAB_PRESENCE_INTERVAL_MS = 4 * 1000;
  const STANDBY_CACHE_TTL_MS = 15 * 60 * 1000;
  const STANDBY_LIVE_FRESH_MS = 60 * 1000;
  const STANDBY_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
  const CAMPAIGN_CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const CAMPAIGN_MEMORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
  const CAMPAIGN_AUDIT_WAIT_MS = 15 * 1000;
  const PAGE_CAMPAIGN_IMPORT_MIN = 12;
  const PAGE_CAMPAIGN_IMPORT_WAIT_MS = 45 * 1000;
  const PAGE_CAMPAIGN_IMPORT_TTL_MS = 30 * 60 * 1000;
  const PAGE_CAMPAIGN_IMPORT_EMPTY_TTL_MS = 2 * 60 * 1000;
  const CAMPAIGN_PAGE_DISPLAY = Object.freeze({
    ACCORDION: "accordion",
    TEXT_BLOCK: "text-block",
    EMPTY: "empty",
    LOADING: "loading",
    TIMEOUT: "timeout",
    GQL_AUTH: "gql-auth",
    GQL_INVENTORY: "gql-inventory",
    UNKNOWN: "unknown",
  });
  const HOME_CAMPAIGN_SEARCH_WAIT_MS = 5 * 1000;
  const HOME_GAME_SEARCH_WAIT_MS = 8 * 1000;
  const FULL_SEARCH_WAIT_MS = 15 * 1000;
  const ACTIVITY_LOG_LIMIT = 40;
  const NETWORK_WINDOW_MS = 60 * 60 * 1000;
  const NETWORK_REQUEST_SOFT_BUDGET = 180;
  const NETWORK_FAILURE_THRESHOLD = 3;
  const CIRCUIT_ERROR_COOLDOWN_MS = 5 * 60 * 1000;
  const CIRCUIT_RATE_COOLDOWN_MS = 15 * 60 * 1000;
  const ACTIVE_STREAM_VERIFY_TIMEOUT_MS = 30 * 1000;
  const HANDOFF_SESSION_TTL_MS = 15 * 60 * 1000;
  const CAMPAIGN_EXPIRY_GRACE_MS = 60 * 1000;
  const CLAIM_RETRY_INTERVAL_MS = 30 * 1000;
  const CLAIM_READY_GRACE_MS = 0;
  const CAMPAIGN_WINNABLE_BUFFER_MS = 3 * 60 * 1000;
  const CAMPAIGN_SHELL_MIN_WINDOW_MS = 15 * 60 * 1000;
  const CATEGORY_MISMATCH_GRACE_MS = 15 * 1000;
  const HEALTHY_STREAM_DELAYED_MS = 5 * 60 * 1000;
  const HEALTHY_STREAM_STALLED_MS = 6 * 60 * 1000;
  const UNHEALTHY_STREAM_DELAYED_MS = 90 * 1000;
  const UNHEALTHY_STREAM_STALLED_MS = 2 * 60 * 1000;
  const FIRST_WATCH_CREDIT_GRACE_MS = 90 * 1000;
  const STREAM_OFFLINE_CONFIRM_MS = 60 * 1000;
  const CATEGORY_SLUG_CACHE_KEY = "dropper-category-slugs-v3";
  const EXCLUDED_CATEGORY_SLUGS = new Set(["first-partners-collection"]);
  const EXCLUDED_CAMPAIGN_NAMES = new Set(["first partners collection"]);
  const CATEGORY_SLUG_ALIASES = Object.freeze({
    "the blood of dawnwalker": "dawnwalker",
    "delta force": "delta-force-hawk-ops",
  });
  const HANDOFF_STATES = Object.freeze({
    CHECKING_GAME: "checking-game",
    SELECTING_GAME: "selecting-game",
    FINDING_STREAM: "finding-stream",
    SWITCHING: "switching",
    VERIFYING: "verifying",
    COMPLETE: "complete",
    FAILED: "failed",
  });
  const UPDATE_URL = "https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js";
  const INSTALL_URL = `https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js?v=${APP_VERSION}`;
  const RELEASES_URL = "https://github.com/ExtraPotions/Dropper/releases";
  const UPDATE_NOTICE_DURATION_MS = 30 * 1000;
  const UPDATE_RELOAD_KEY = "dropper-update-reload-pending";
  const UPDATE_RETURN_DELAY_MS = 3 * 1000;
  const UPDATE_RELOAD_FALLBACK_MS = 45 * 1000;
  const UPDATE_RELOAD_PENDING_TTL_MS = 2 * 60 * 1000;
  const MENU_INACTIVITY_DISMISS_MS = 15 * 1000;
  const RELEASE_NOTES = {
    "3.3.0-dev.2": [
      "Uses deadline-aware campaign sequencing: known-unfinishable campaigns fall behind viable choices before personal priority, urgency, active progress, and remaining watch time are considered.",
      "Adds reward and campaign deadline feasibility to eligibility diagnostics while keeping Twitch-credited progress authoritative.",
      "Clarifies unconfirmed claim timeout wording and reconciles credited-progress verification with current GQL campaign evidence."
    ],

    "3.2.31": [
      "Improves diagnostics with separate progress-card, launcher, launcher-row, menu, and notice geometry.",
      "Forces each newly installed Dropper version to perform its own fresh update check and attributes resource errors to Dropper or the page."
    ],
    "3.2.30": [
      "Unifies Update Available, Update Complete, notices, and Changelog into one Dropper menu-width card space.",
      "Keeps every Dropper notice constrained to the active Full, Compact, or Narrow width whether the menu is open or closed."
    ],
    "3.2.29": [
      "Places the Badge Only progress card above the Drops menu section instead of inside the Drops body.",
      "Keeps the Badge Only progress card matched to the active Full, Compact, or Narrow menu width."
    ],
    "3.2.28": [
      "Returns the live progress panel to the same launcher row, directly left of the Dropper launcher.",
      "Removes independent viewport positioning from the page progress card so the panel and launcher move as one unit."
    ],
    "3.2.27": [
      "Reanchors the launcher, progress panel, menu, and changelog to one measured launcher-grid geometry.",
      "Prevents opening the menu or changelog from shifting Dropper surfaces apart across the page."
    ],
    "3.2.26": [
      "Keeps the Current Version changelog card aligned to the Dropper menu instead of stretching across the page.",
      "Matches the changelog card width to the active Dropper menu width and positions it directly above the menu with a viewport-safe fallback."
    ],
    "3.2.25": [
      "Restores full theme colors, borders, and background contrast to Update and Changelog notices.",
      "Keeps floating notices inside Dropper's themed container while preserving viewport-safe positioning."
    ],
    "3.2.24": [
      "Keeps Update and Changelog notices fixed inside the visible browser window.",
      "Preserves launcher-grid anchoring and notice stacking at either grid edge."
    ],
    "3.2.23": [
      "Places the Badge Only progress card inside the Drops menu instead of above the menu.",
      "Keeps the progress card at the top of the expanded Drops controls."
    ],
    "3.2.22": [
      "Treats Dropper as an integrated ExtraPotions product in shared coordination and release provenance.",
      "Moves the live progress card above Drops inside the menu when Badge Only is enabled.",
      "Keeps only the Dropper badge visible on the page while Badge Only is active."
    ],
    "3.2.21": [
      "Shows each automatic update notice once for that version instead of on every page load.",
      "Stacks simultaneous notices beside the complete launcher grid.",
      "Moves diagnostics and recovery actions under the final System menu."
    ],
    "3.2.20": [
      "Keeps Dropper's transparent launcher row from intercepting neighboring product launchers.",
      "Preserves pointer input for the Dropper launcher and progress panel.",
      "Verifies every installed launcher remains clickable at both grid anchors."
    ],
    "3.2.19": [
      "Uses the borderless Dropper launcher artwork for the userscript-manager icon.",
      "References the shared SVG by URL instead of embedding image bytes in the userscript.",
      "Removes the superseded bordered SVG and raster badge files.",
      "Blocks future builds if embedded image data returns."
    ],
    "3.2.18": [
      "Uses compact rounded rectangles for status, progress, version, and skip controls.",
      "Keeps diagnostics and multi-product conflict reporting aligned across the active suite."
    ],
    "3.2.17": [
      "Keeps the progress panel outside the complete three-column launcher grid and flips it below a top anchor or above a bottom anchor.",
      "Preserves peer launcher alignment and inward-opening menus while the progress panel or Dropper menu changes state.",
      "Standardizes Page, Technical, Console, and Plugin diagnostics with bounded redaction and current-page product conflict observations.",
      "Embeds the canonical Dropper badge in userscript-manager metadata and replaces the bordered README image with borderless SVG artwork.",
    ],
    "3.2.16": [
      "Adds an automatically refreshed Open Campaigns checklist grouped by game.",
      "Keeps ignored games excluded from routing until their latest open campaign ends.",
      "Preserves account-scoped ignore choices across campaign refreshes and Twitch tabs.",
    ],
    "3.2.15": [
      "Moves the Dropper progress ring to the outside edge of its 40 px badge artwork.",
      "Keeps the live campaign-progress ring exclusive to Dropper.",
      "Removes decorative progress rings from sibling ExtraPotions launchers.",
      "Uses the canonical Dropper SVG as the userscript-manager icon.",
    ],
    "3.2.14": [
      "Uses 48 px launcher buttons with 40 px artwork and an 8 px launcher gap.",
      "Expands the menu-header badge artwork to the full 38 px contract.",
      "Adds a dedicated 128 px raster badge derivative.",
      "Keeps the original badge and launcher SVG files byte-for-byte unchanged.",
    ],
    "3.2.13": [
      "Packs sibling launchers into a compact right rail beside the visible progress panel.",
      "Restores the normal launcher row when Badge Only hides the progress panel.",
      "Aligns Dropper's embedded grid coordinator with the shared build-time Core.",
    ],
    "3.2.12": [
      "Updates the Pride theme browser contract to expect the approved new rainbow color.",
      "Keeps the 3.2.11 palette behavior unchanged while restoring release validation.",
    ],
    "3.2.11": [
      "Replaces the legacy menu palettes with the locked Ember, Midnight, Glacier, High Contrast, Verdant, Pride, Twitch, and Dropper Gem system.",
      "Keeps Twitch exclusive to Dropper and publishes the richer six-role palette contract for sibling products.",
      "Migrates saved Warm, Graphite, and Pine selections to Ember, Glacier, and Verdant.",
    ],
    "3.2.10": [
      "Makes the Warm charcoal depth visible beneath its gradient-border treatment in Dropper and shared menus.",
      "Keeps the amber highlight subtle and leaves other palettes unchanged.",
    ],
    "3.2.9": [
      "Gives Warm charcoal a layered dark menu surface, subtle amber edge-lighting, and quieter matte controls.",
      "Keeps accent color on the gem, active controls, and focus while preserving readable text and semantic states.",
    ],
    "3.2.8": [
      "Rebalances the chip footer specifically for Compact and Narrow widths instead of shrinking the full-width treatment.",
      "Compact shows a shorter last-checked age while keeping the labeled Skip chip; Narrow uses abbreviated status text and an icon-only Skip chip until confirmation is armed.",
      "Preserves full status and timestamp context in accessible labels and tooltips while preventing footer crowding.",
    ],
    "3.2.7": [
      "Reworks the progress-panel footer into a unified status and last-checked chip, with semantic state dots and a quieter segmented divider.",
      "Restyles Skip as a compact action chip with a fast-forward icon, restrained theme accent, and the existing arm-then-confirm safety behavior.",
      "Tightens Compact and Narrow footer sizing so status context and Skip stay aligned without competing with Drop progress.",
    ],
    "3.2.5": [
      "Performs a one-time per-account reset of persistent campaign memory so stale and duplicate historical campaign identities are discarded.",
      "Rebuilds campaign memory only from fresh campaign data while preserving the active Drop, settings, routing preferences, and other account-scoped state.",
      "Adds campaign-memory reset version and timestamp to diagnostics so the migration can be verified.",
    ],
    "3.2.4": [
      "Restyles toggle switches with matte theme surfaces, softer knobs, and restrained accent ON states instead of metallic gray and full-gradient tracks.",
      "Keeps High Contrast and forced-colors switch behavior explicit and unchanged for accessibility.",
    ],
    "3.2.3": [
      "Adds a subtle fine-grain texture and restrained inset depth to the progress card so the solid surface feels less flat.",
      "Keeps the 3.2 panel structure and solid theme surface intact without restoring the old fade behavior.",
    ],
    "3.2.2": [
      "Polishes the 3.2 progress panel with a steadier bottom row, fixed Skip button footprint, quieter status styling, and a more neutral panel border.",
      "Renames Progress & Appearance to Appearance and keeps armed Skip confirmation compact with a Confirm label plus countdown.",
    ],
    "3.2.1": [
      "Restores a real CSS border around the menu header icon while keeping the shared split-gem SVG itself border-free.",
      "Makes the menu icon frame follow the active theme instead of relying on artwork that only looked like a border.",
    ],
    "3.2.0": [
      "Redesigns the progress panel as a calmer solid utility card with streamer, category, progress, reward, and status information in one clear hierarchy.",
      "Removes the streamer avatar, reward thumbnail, stream-title/viewer/uptime clutter, panel fade behavior, and obsolete campaign-navigation collapse behavior.",
      "Uses theme color only for restrained progress, percentage, status, and control accents instead of a gradient/faded panel treatment.",
    ],
    "3.1.57": [
      "Removes the Previous, Current, and Next campaign strip from above the progress panel.",
      "Fixes Theme row overflow in Compact and Narrow widths by giving the swatches the full row while preserving the accessible Menu Theme label.",
    ],
    "3.1.56": [
      "Compacts Progress & Appearance so it stays within the normal menu height instead of being the only section to trigger a scrollbar.",
      "Tightens only that panel's control spacing, theme swatches, separator, and opacity row without changing the global menu layout.",
    ],
    "3.1.55": [
      "Uses the same split-gem icon artwork for both the launcher and the menu header.",
      "Removes the menu-only framed badge treatment so Dropper has one consistent icon identity.",
    ],
    "3.1.54": [
      "Refines the launcher with a softer frame, tighter themed progress ring, quieter update badge, and clearer open state.",
      "Adds a restrained hover treatment and subtle drag feedback while preserving the launcher's 48px footprint and behavior.",
    ],
    "3.1.53": [
      "Removes the launcher hover/focus helper tooltip so the Dropper badge stays visually clean.",
      "Keeps the launcher accessibility label and update-available indicator unchanged.",
    ],
    "3.1.52": [
      "Renames Notifications to Status Toasts so the setting clearly describes Dropper's brief in-app messages.",
      "Moves Status Toasts from Progress & Appearance into Streams, where stream and campaign status feedback is managed.",
    ],
    "3.1.51": [
      "Collapses the Active + Standby stream list by default so the Streams menu stays compact.",
      "Replaces the always-open block with a one-line ready-stream summary that expands on demand.",
    ],
    "3.1.50": [
      "Visually splits the Streams menu into Current Stream and Routing & Backup groups without adding another top-level menu.",
      "Makes routing-specific controls, skip conditions, standby list, and skipped-stream cleanup read as one full-width automation block.",
    ],
    "3.1.49": [
      "Merges Progress, Theme, and Layout controls into one Progress & Appearance menu to reduce top-level menu clutter.",
      "Keeps progress controls visually grouped above theme, width, opacity, and notification settings inside the combined panel.",
    ],
    "3.1.48": [
      "Simplifies the Drops panel by removing the permanent Twitch account/import card and leaving Drops Inventory as the primary full-width action.",
      "Only shows a compact Twitch Login Required row when authentication is missing, and moves manual campaign recovery to Diagnostics as Refresh Campaign Data.",
    ],
    "3.1.47": [
      "Changes Skip Streamer to a two-step arm-and-confirm interaction so a single accidental click cannot rotate away from a working stream.",
      "The armed skip state shows the streamer name and a 3-second countdown, then cancels automatically on timeout, stream or route changes, panel collapse, menu close, or session reset.",
    ],
    "3.1.46": [
      "Restores the soft fade at both ends of the header divider for gradient themes while preserving each theme's color treatment.",
      "Keeps the flat Twitch palette on its original faded divider behavior.",
    ],
    "3.1.45": [
      "Restores the original flat Gem look as a dedicated Twitch palette using the classic Twitch purple and dark surfaces.",
      "Keeps the newer Dropper Gem gradient theme available separately so users can choose between the original flat Twitch look and the richer Gem skin.",
    ],
    "3.1.44": [
      "Finishes the unified theme-skin rollout by removing the final Pride-only current-campaign accent rule.",
      "All themes now share the same visual treatment model; only their palette and gradient stops differ.",
    ],
    "3.1.43": [
      "Upgrades every Dropper theme to use the richer gradient-skin treatment previously reserved for Pride.",
      "Adds theme-specific gradient borders, header accents, progress fills, active controls, focus states, and update/changelog styling while keeping High Contrast monochrome.",
    ],
    "3.1.42": [
      "Makes update notifications and the current-version changelog inherit the selected Dropper theme instead of using a fixed purple palette.",
      "Adds themed update buttons, borders, text, version badges, and a Pride gradient treatment while preserving custom opacity.",
    ],
    "3.1.41": [
      "Adds optional user-controlled Dropper panel opacity in Theme & Layout with a persistent 40–100% slider.",
      "Keeps the Dropper launcher fully opaque so settings remain accessible even when panels are made translucent.",
    ],
    "3.1.40": [
      "Keeps the Panel + Menu Width control inside the Theme & Layout panel by stacking the label and selector in Narrow mode.",
      "Improves toggle visibility with a defined track border and gives the High Contrast theme distinct on/off track and knob colors.",
    ],
    "3.1.39": [
      "Prevents routine current-session GQL confirmations from rewriting the stream verification timestamp while earning.",
      "Restores verification time from the original earning-state anchor after navigation or reload so stall timing cannot be kept artificially fresh.",
    ],
    "3.1.38": [
      "Makes candidate ACL diagnostics derive from the active campaign instead of stale category-page snapshots and filters cached diagnostic candidates against that ACL.",
      "Builds one queue snapshot per diagnostics report so queue names and queue details cannot disagree when Any Eligible randomization is enabled.",
      "Anchors first-watch verification grace to the stream routing state instead of routine session refreshes and separates DOM playback, recent credited progress, and verified earning signals.",
    ],
    "3.1.37": [
      "Fixes Theme & Layout alignment in Full panel width so the width label no longer collapses into a vertical stack.",
      "Keeps the width selector and Notifications on clean full-width rows without changing the two-column layout used by other menu sections.",
    ],
    "3.1.36": [
      "Makes campaign channel allow-lists authoritative before navigation, verification, standby selection, and queueing.",
      "Stops probing Drops-tagged channels that are not allowed by the active campaign and rejects stale non-ACL verification sessions immediately.",
      "Clarifies loaded versus verified earning-stream diagnostics and removes the obsolete expanded progress width diagnostic.",
    ],
    "3.1.35": [
      "Makes verified campaign start/end dates the authoritative eligibility gate for routing, stream proof, progress merging, and standby candidates.",
      "Keeps unknown-date and closed campaigns in catalog memory for diagnostics while preventing them from becoming active routing targets.",
      "Purges expired campaign inventory and standby state before it can leak back into selection or verification.",
    ],
    "3.1.34": [
      "Prevents session progress from a different campaign or Drop in the same game from advancing the locked active Drop.",
      "Requires campaign-key or Drop-ID identity before session data can merge with active Inventory progress.",
      "Reports rejected cross-campaign session minutes in progress diagnostics without using them as verification proof.",
    ],
    "3.1.33": [
      "Unifies router and standby candidate filtering so skipped or non-routable streams cannot reappear as usable queue candidates.",
      "Separates currently visible stream candidates from cached observations and labels cache freshness explicitly.",
      "Rescans category candidates immediately while waiting and adds per-channel routability reasons to diagnostics.",
    ],
  };
  const DEFAULTS = {
    claimBonus: true,
    keepTabActive: true,
    claimDrops: true,
    progressInTitle: true,
    findNextStream: false,
    muteRestarted: true,
    backgroundEarning: false,
    reduceMotion: false,
    collapsedPanelWidth: "compact",
    uiTheme: "dropper",
    customOpacity: false,
    opacityPercent: 85,
    badgeOnly: false,
    notifications: true,
    hideTwitchSubscriptionPromos: true,
    pauseAutoSwitchMinutes: 0,
    pauseAutoSwitchUntil: 0,
    queueEnabled: true,
    queueCount: 3,
    queueOnStall: true,
    queueOnOffline: true,
    queueOnCategoryChange: true,
    queuePreference: "Any Eligible",
  };
  const PRIDE_RAINBOW = "linear-gradient(90deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4)";
  const PRIDE_RAINBOW_VERTICAL = "linear-gradient(180deg,#c84e66,#d07840,#be9f37,#3b8a5f,#3d79a6,#7455a4)";
  const CRIMSON_THEME = Object.freeze({ id:"crimson", name:"Crimson", swatch:"linear-gradient(135deg,#0c0508 0 38%,#941f2f 38% 69%,#2f746e 69% 100%)", canvas:"#0c0508", surface:"#1d090f", primary:"#941f2f", companion:"#5e2144", counterpoint:"#2f746e", interactive:"#b63243", bg:"#0c0508", panel:"#1d090f", line:"#4a1b28", text:"#e5d2d7", muted:"#ae8b94", accent:"#941f2f", accent2:"#b63243", skin:"linear-gradient(135deg,#941f2f 0%,#5e2144 52%,#2f746e 100%)", skinVertical:"linear-gradient(180deg,#941f2f 0%,#5e2144 52%,#2f746e 100%)" });
  const UI_THEMES = Object.freeze([
    { id:"ember", name:"Ember", swatch:"linear-gradient(135deg,#120807 0 38%,#c9512c 38% 69%,#b68a32 69% 100%)", canvas:"#120807", surface:"#24100c", primary:"#c9512c", companion:"#8f2d3f", counterpoint:"#b68a32", interactive:"#e16a3b", bg:"#120807", panel:"#24100c", line:"#4e2a22", text:"#f1ddd2", muted:"#b99787", accent:"#c9512c", accent2:"#e16a3b", skin:"linear-gradient(135deg,#c9512c 0%,#8f2d3f 52%,#b68a32 100%)", skinVertical:"linear-gradient(180deg,#c9512c 0%,#8f2d3f 52%,#b68a32 100%)" },
    { id:"midnight", name:"Midnight", swatch:"linear-gradient(135deg,#050a12 0 38%,#3563a3 38% 69%,#348f8b 69% 100%)", canvas:"#050a12", surface:"#0c1726", primary:"#3563a3", companion:"#65558f", counterpoint:"#348f8b", interactive:"#477abd", bg:"#050a12", panel:"#0c1726", line:"#26364b", text:"#d4deeb", muted:"#91a2b7", accent:"#3563a3", accent2:"#477abd", skin:"linear-gradient(135deg,#3563a3 0%,#65558f 52%,#348f8b 100%)", skinVertical:"linear-gradient(180deg,#3563a3 0%,#65558f 52%,#348f8b 100%)" },
    { id:"glacier", name:"Glacier", swatch:"linear-gradient(135deg,#061216 0 38%,#4a9eaa 38% 69%,#92b85b 69% 100%)", canvas:"#061216", surface:"#0d252a", primary:"#4a9eaa", companion:"#5c76a4", counterpoint:"#92b85b", interactive:"#67b7c1", bg:"#061216", panel:"#0d252a", line:"#29464b", text:"#d8ebee", muted:"#8fa9ae", accent:"#4a9eaa", accent2:"#67b7c1", skin:"linear-gradient(135deg,#4a9eaa 0%,#5c76a4 52%,#92b85b 100%)", skinVertical:"linear-gradient(180deg,#4a9eaa 0%,#5c76a4 52%,#92b85b 100%)" },
    { id:"contrast", name:"High contrast", swatch:"linear-gradient(135deg,#000000 0 48%,#ffffff 48% 78%,#ffd400 78% 100%)", canvas:"#000000", surface:"#0a0a0a", primary:"#ffffff", companion:"#bfbfbf", counterpoint:"#ffd400", interactive:"#ffd400", bg:"#000000", panel:"#0a0a0a", line:"#ffffff", text:"#ffffff", muted:"#e0e0e0", accent:"#ffffff", accent2:"#ffd400", skin:"linear-gradient(135deg,#ffffff 0%,#bfbfbf 55%,#ffd400 100%)", skinVertical:"linear-gradient(180deg,#ffffff 0%,#bfbfbf 55%,#ffd400 100%)" },
    { id:"verdant", name:"Verdant", swatch:"linear-gradient(135deg,#06110d 0 38%,#318c61 38% 69%,#2f7f86 69% 100%)", canvas:"#06110d", surface:"#0d2218", primary:"#318c61", companion:"#667c3c", counterpoint:"#2f7f86", interactive:"#49a879", bg:"#06110d", panel:"#0d2218", line:"#28483a", text:"#d7e9df", muted:"#93aa9e", accent:"#318c61", accent2:"#49a879", skin:"linear-gradient(135deg,#318c61 0%,#667c3c 52%,#2f7f86 100%)", skinVertical:"linear-gradient(180deg,#318c61 0%,#667c3c 52%,#2f7f86 100%)" },
    { id:"pride", name:"Pride", swatch:"linear-gradient(135deg,#c84e66 0%,#d07840 16.6%,#be9f37 33.3%,#3b8a5f 50%,#3d79a6 66.6%,#7455a4 100%)", canvas:"#100a12", surface:"#1d1222", primary:"#c34f7d", companion:"#7555a6", counterpoint:"#328c82", interactive:"#dd6793", bg:"#100a12", panel:"#1d1222", line:"#4a2b50", text:"#f0ddea", muted:"#b89db4", accent:"#c34f7d", accent2:"#dd6793", skin:PRIDE_RAINBOW, skinVertical:PRIDE_RAINBOW_VERTICAL },
    { id:"twitch", name:"Twitch", swatch:"linear-gradient(135deg,#18181b 0 48%,#9147ff 48% 78%,#bf94ff 78% 100%)", canvas:"#111114", surface:"#19191e", primary:"#9147ff", companion:"#772ce8", counterpoint:"#bf94ff", interactive:"#bf94ff", bg:"#111114", panel:"#19191e", line:"#34343b", text:"#efeff1", muted:"#adadb8", accent:"#9147ff", accent2:"#bf94ff", skin:"linear-gradient(135deg,#9147ff,#bf94ff)", skinVertical:"linear-gradient(180deg,#9147ff,#bf94ff)", skinMode:"flat" },
    { id:"dropper", name:"Dropper gem", swatch:"linear-gradient(135deg,#0b0713 0 38%,#7a46c8 38% 69%,#2a8c9b 69% 100%)", canvas:"#0b0713", surface:"#171025", primary:"#7a46c8", companion:"#b14589", counterpoint:"#2a8c9b", interactive:"#9864dc", bg:"#0b0713", panel:"#171025", line:"#3c2850", text:"#e8ddf2", muted:"#aa98bb", accent:"#7a46c8", accent2:"#9864dc", skin:"linear-gradient(135deg,#7a46c8 0%,#b14589 52%,#2a8c9b 100%)", skinVertical:"linear-gradient(180deg,#7a46c8 0%,#b14589 52%,#2a8c9b 100%)" }
  ]);
  const BONUS_SELECTOR = 'button[aria-label="Claim Bonus"], .claimable-bonus__icon';
  const DROP_CLAIM_SELECTOR = [
    '[data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"]',
    'button[data-a-target="drops-claim-button"]',
  ].join(",");
  const INVENTORY_URL = "https://www.twitch.tv/drops/inventory";
  const CAMPAIGNS_URL = "https://www.twitch.tv/drops/campaigns";
  const TWITCH_HOME_URL = "https://www.twitch.tv/";
  const TWITCH_LOGIN_URL = "https://www.twitch.tv/login";

  const GQL_URL = "https://gql.twitch.tv/gql";
  const INTEGRITY_URL = "https://gql.twitch.tv/integrity";
  const CLIENT_INTEGRITY_KEY = "dropper-client-integrity-v1";
  const CLIENT_IDS = ["kimne78kx3ncx6brgo4mv6wki5h1ko", "kd1unb4b3q4t58fwlpcbzcbnm76a8fp"];
  const GQL_OPS = {
    inventory: {
      name: "Inventory",
      hash: "fbdc9d9857fa39ff458d3f6116b157a9481fd140266879a2508a662f5c8af6f8",
      variables: { fetchRewardCampaigns: true },
    },
    viewerDropsDashboard: {
      name: "ViewerDropsDashboard",
      hash: "69750554e0a81492f2d343558f84bdf3e324767650a2dbb6e79a3c629b4548cf",
      variables: { fetchRewardCampaigns: true },
    },
    currentDrop: {
      name: "DropCurrentSessionContext",
      hash: "4d06b702d25d652afb9ef835d2a550031f1cf762b193523a92166f40ea3d142b",
      variables: {},
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
      hash: "3b8a08f5a35dc95d7de229dea731a106a9aa9fa2e84c8f693fd159943f273e4f",
      variables: { input: { dropInstanceID: "" } },
    },
    dropCampaignDetails: {
      name: "DropCampaignDetails",
      hash: "039277bf98f3130929262cc7c6efd9c141ca3749cb6dca442fc8ead9a53f77c1",
      variables: { channelLogin: "", dropID: "" },
    },
  };
  const RESERVED = new Set([
    "directory", "downloads", "drops", "friends", "inventory", "jobs", "messages",
    "moderator", "p", "popout", "prime", "privacy", "products", "search", "settings",
    "store", "subs", "subscriptions", "turbo", "user", "videos", "wallet",
  ]);

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
      const deadline = deadlineAssessment(campaign, null, { totalRemainingMinutes: known ? remainingMinutes : null }, now, bufferMinutes);
      return { watchRewards, remainingMinutes: known ? remainingMinutes : null, pendingClaims, inProgress, ...deadline };
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
        const feasibility = value => value === true ? 0 : value === null ? 1 : 2;
        const feasibleDelta = feasibility(a.sequenceFinishable) - feasibility(b.sequenceFinishable);
        if (feasibleDelta) return feasibleDelta;
        if (b.sequencePriority !== a.sequencePriority) return b.sequencePriority - a.sequencePriority;
        if (a.sequenceActiveGame !== b.sequenceActiveGame) return a.sequenceActiveGame ? -1 : 1;
        const marginA = Number.isFinite(a.sequenceMarginMinutes) ? a.sequenceMarginMinutes : Number.MAX_SAFE_INTEGER;
        const marginB = Number.isFinite(b.sequenceMarginMinutes) ? b.sequenceMarginMinutes : Number.MAX_SAFE_INTEGER;
        if (marginA !== marginB) return marginA - marginB;
        if (a.sequenceInProgress !== b.sequenceInProgress) return a.sequenceInProgress ? -1 : 1;
        const endA = Number.isFinite(Number(a.endMs)) ? Number(a.endMs) : Number.MAX_SAFE_INTEGER;
        const endB = Number.isFinite(Number(b.endMs)) ? Number(b.endMs) : Number.MAX_SAFE_INTEGER;
        if (endA !== endB) return endA - endB;
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

    return Object.freeze({ createIntent, createClaims, claimResponse, claimFailure, planPrerequisites, deadlineAssessment, campaignSequence, rankCampaignCandidates, eligibility, claimPresentation });
  })();
  // END DROPPER ACTIVE VIEWING

  const settings = loadSettings();
  const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const PAGE_STARTED_AT = Date.now();
  const TAB_ID = (() => {
    try {
      const key = scopedSessionStorageKey(TAB_ID_KEY);
      let id = sessionStorage.getItem(key);
      if (!id) {
        id = `t${PAGE_STARTED_AT.toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return `t${PAGE_STARTED_AT.toString(36)}`;
    }
  })();
  const TAB_STARTED_AT = (() => {
    try {
      const key = scopedSessionStorageKey(TAB_STARTED_KEY);
      const saved = Number(sessionStorage.getItem(key) || 0);
      if (Number.isFinite(saved) && saved > 0) return saved;
      sessionStorage.setItem(key, String(PAGE_STARTED_AT));
      return PAGE_STARTED_AT;
    } catch (_) {
      return PAGE_STARTED_AT;
    }
  })();
  let tabPresenceTimer = null;
  let tabChannel = null;
  let lastPeerCount = 0;
  let lastDeferredRoutingAt = 0;
  let lastDeferredRoutingReason = "";
  let statusText = "Starting…";
  let progressLabel = "";
  let lastNativeTitle = document.title || "Twitch";
  let progressTitleObserver = null;
  let progressTitleSyncQueued = false;
  let lastBonusAt = 0;
  let lastDropAt = 0;
  let lastClaimAttemptAt = 0;
  let claimReadySince = 0;
  let claimReadySignature = "";
  let lastClaimIntegrityFallback = null;
  let lastProgressReconcile = null;
  let lastSessionPoll = null;
  let twitchNetworkHookMode = "";
  let lastStreamVerification = null;
  let finalVerificationPollTarget = "";
  let finalVerificationPollAt = 0;
  let lastStreamSwitch = 0;
  let streamOfflineSince = 0;
  let categoryMismatchSince = 0;
  let categoryMismatchSignature = "";
  let categorySlugCache = loadCategorySlugCache();
  let lastProgress = readSession("tdh-progress", 0);
  let lastProgressAt = readSession("tdh-progress-at", Date.now());
  let currentDrop = readSession("tdh-drop", null);
  if (currentDrop && isDropCardMetadata(currentDrop.name)) {
    currentDrop = { ...currentDrop, name: "Current drop" };
  }
  let lastPath = "";
  let watchClock = { login: "", started: 0 };
  let lastCheckedAt = 0;
  let lastCheckedLogin = "";
  let ui = null;
  let railOpen = false;
  let skipStreamerArm = { login: "", expiresAt: 0 };
  let skipStreamerArmTimer = null;
  let lastPanelId = "";
  let lastSubmenuId = "";
  let clusterTop = 0;
  let launcherGridDelta = Number(localStorage.getItem(LAUNCHER_GRID_DELTA_KEY) || 0);
  if (!Number.isFinite(launcherGridDelta)) launcherGridDelta = 0;
  localStorage.removeItem(LEGACY_LAUNCHER_TOP_KEY);
  localStorage.removeItem(LEGACY_LAUNCHER_GRID_DELTA_KEY);
  let lastUiProgressPercent = null;
  let lastUiRoutingState = "";
  let menuDismissTimer = null;
  let menuDismissAt = 0;
  let updateNoticeTimer = null;
  let updateNoticeState = null;
  let lastUpdateNoticeVersion = "";
  let updateReloadTimer = null;
  let updateFallbackTimer = null;
  let pauseAutoSwitchUntil = Number(settings.pauseAutoSwitchUntil || 0);
  let lastInventoryCampaigns = [];
  let campaignCatalogCache = loadCampaignCatalogCache();
  let lastCampaignCatalog = campaignCatalogCache.campaigns;
  let lastCampaignCatalogAt = campaignCatalogCache.at;
  let lastCampaignPageScanSignature = "";
  let lastCampaignPageImportAt = 0;
  let lastCampaignPageImportCount = 0;
  let lastCampaignPageImportDisplay = "";
  let lastCampaignPageImportSource = "";
  let lastCampaignsPageEnrichmentFinishedAt = 0;
  let lastCampaignPageDisplay = {
    mode: CAMPAIGN_PAGE_DISPLAY.UNKNOWN,
    accordionHeaders: 0,
    dateLeaves: 0,
    hasEmptyMessage: false,
    hasOpenDropSection: false,
    hasOpenRewardSection: false,
    hasClosedSection: false,
    at: 0,
  };
  {
    const savedImport = readSession(CAMPAIGN_PAGE_IMPORT_KEY, null);
    const savedAt = Number(savedImport?.at || 0);
    const savedCount = Number(savedImport?.count || 0);
    const savedFinishedAt = Number(savedImport?.finishedAt || savedAt || 0);
    const savedDisplay = cleanText(savedImport?.display || "");
    const savedSource = cleanText(savedImport?.source || "");
    const importAge = savedFinishedAt ? Date.now() - savedFinishedAt : PAGE_CAMPAIGN_IMPORT_TTL_MS + 1;
    const restoreFilled = savedCount > 0 && importAge < PAGE_CAMPAIGN_IMPORT_TTL_MS;
    const restoreEmpty = (
      savedCount <= 0 &&
      (savedDisplay === CAMPAIGN_PAGE_DISPLAY.EMPTY || savedDisplay === CAMPAIGN_PAGE_DISPLAY.TIMEOUT) &&
      importAge < PAGE_CAMPAIGN_IMPORT_EMPTY_TTL_MS
    );
    if (restoreFilled || restoreEmpty) {
      lastCampaignPageImportAt = savedAt || savedFinishedAt;
      lastCampaignPageImportCount = Math.max(0, savedCount);
      lastCampaignPageImportDisplay = savedDisplay;
      lastCampaignPageImportSource = savedSource;
      lastCampaignsPageEnrichmentFinishedAt = savedFinishedAt;
    }
  }
  let campaignMemory = loadCampaignMemory();
  let ignoredCampaignGames = loadIgnoredCampaignGames();
  // Restore a prior All Campaigns page import from the session catalog when present.
  {
    const restoredPageCount = (lastCampaignCatalog || []).filter((campaign) => (
      /^page:/i.test(String(campaign?.id || ""))
    )).length;
    if (restoredPageCount > 0 && lastCampaignCatalogAt) {
      lastCampaignPageImportCount = Math.max(lastCampaignPageImportCount, restoredPageCount);
      lastCampaignPageImportAt = Math.max(lastCampaignPageImportAt, lastCampaignCatalogAt);
      lastCampaignsPageEnrichmentFinishedAt = Math.max(
        lastCampaignsPageEnrichmentFinishedAt,
        lastCampaignCatalogAt,
      );
    }
  }
  repairRoutingIdentity();
  let chatWidthObserver = null;
  let chatDomObserver = null;
  let observedChatElement = null;
  let bonusClaimObserver = null;
  let dropClaimObserver = null;
  let suppressedSubscriptionPromoCount = 0;
  let lastPromoScanAt = 0;
  let lastQueueRefreshAt = 0;
  let lastStandbyRefreshAt = Number(readSession(STANDBY_REFRESH_KEY, 0)) || 0;
  let duplicateNavigationSkips = 0;
  let lastGqlPollAt = 0;
  let lastGqlSuccessAt = 0;
  let lastGqlError = "";
  let lastTwitchGqlAt = 0;
  let twitchNetworkCapture = {
    integrity: "",
    integrityExpiresAt: 0,
    clientId: "",
    deviceId: "",
    sessionId: "",
    clientVersion: "",
    auth: "",
  };
  let twitchNetworkHooksInstalled = false;
  let lastCampaignDashboardAt = 0;
  let haveSeenInventorySnapshot = false;
  let lastInProgressKeys = new Set();
  let heartbeatTimer = null;
  let lastHeartbeatAt = 0;
  let startupNetworkReadyAt = 0;
  let nextGqlPollAt = 0;
  let gqlPollInFlight = false;
  let gqlErrorStreak = 0;
  let pendingGqlReason = "startup";
  let lastGqlReason = "";
  let activityLog = readSession(ACTIVITY_LOG_KEY, []);
  let standbyCache = readSession(STANDBY_CACHE_KEY, []);
  let lastRoutingCandidateSnapshot = {
    at: 0,
    game: "",
    gameSlug: "",
    campaignKey: "",
    allowListPresent: false,
    visible: [],
  };
  let networkState = readSession(NETWORK_STATE_KEY, {
    requestTimes: [],
    consecutiveFailures: 0,
    openUntil: 0,
    reason: "",
    lastOpenedAt: 0,
    softBudgetWarnedAt: 0,
  });
  const previousInstalledVersion = (() => {
    try { return localStorage.getItem(LAST_VERSION_KEY) || ""; } catch (_) { return ""; }
  })();
  if (
    previousInstalledVersion &&
    previousInstalledVersion !== APP_VERSION
  ) {
    removeSession(CLIENT_INTEGRITY_KEY);
    removeSession(NAVIGATION_GUARD_KEY);
    removeSession(NAVIGATION_FLIGHT_KEY);
    if (/gql|integrity/i.test(networkState.reason || "")) {
      networkState = {
        requestTimes: [],
        consecutiveFailures: 0,
        openUntil: 0,
        reason: "",
        lastOpenedAt: 0,
        softBudgetWarnedAt: 0,
      };
      writeSession(NETWORK_STATE_KEY, networkState);
    }
  }

  const VIEWING_INTENT_KEY = 'dropper-viewing-intent-v1';
  const VIEWING_NAVIGATION_KEY = 'dropper-viewing-navigation-v1';
  const CLAIM_HISTORY_KEY = 'dropper-claim-history-v1';
  const CAMPAIGN_PRIORITY_KEY = 'dropper-campaign-priority-v1';
  let viewingAccount = storageAccountLogin();
  let viewingVideo = null;
  let videoMountedDuringPause = false;
  let recentPlaybackControl = { action: '', at: 0 };
  let viewingListenersInstalled = false;
  let screenWakeLock = null;
  let wakeLockPending = false;
  let claimLedgerAccount = '';
  let claimLedgerInstance = null;
  let claimScanTimer = null;
  let claimAnonymousSequence = 0;
  const claimNodeIds = new WeakMap();
  let lastAnonymousAttemptAt = { bonus: 0, drop: 0 };
  let claimHealth = {};
  let lastViewingNavigationBlock = '';
  let explicitViewingNavigationUntil = 0;
  const viewingIntent = DropperActiveViewing.createIntent({
    load: account => {
      try { return JSON.parse(sessionStorage.getItem(scopedSessionStorageKey(VIEWING_INTENT_KEY, account)) || 'null'); }
      catch (_) { return null; }
    },
    save: state => {
      try { sessionStorage.setItem(scopedSessionStorageKey(VIEWING_INTENT_KEY, state.account), JSON.stringify(state)); }
      catch (_) { /* The in-memory pause hold remains authoritative in this tab. */ }
    },
  });

  function resetViewingAccount(account) {
    viewingAccount = account;
    viewingVideo = null;
    videoMountedDuringPause = false;
    recentPlaybackControl = { action: '', at: 0 };
    claimLedgerInstance = null;
    claimLedgerAccount = '';
    claimHealth = {};
    lastAnonymousAttemptAt = { bonus: 0, drop: 0 };
    lastViewingNavigationBlock = '';
    explicitViewingNavigationUntil = 0;
    lastDropAt = 0; lastBonusAt = 0; lastClaimAttemptAt = 0;
    resetClaimReadyTimer();
    currentDrop = readSession('tdh-drop', null);
    lastProgress = readSession('tdh-progress', 0);
    lastProgressAt = readSession('tdh-progress-at', Date.now());
    lastInventoryCampaigns = [];
    haveSeenInventorySnapshot = false;
    lastInProgressKeys = new Set();
    campaignCatalogCache = loadCampaignCatalogCache();
    lastCampaignCatalog = campaignCatalogCache.campaigns;
    lastCampaignCatalogAt = campaignCatalogCache.at;
    campaignMemory = loadCampaignMemory();
    ignoredCampaignGames = loadIgnoredCampaignGames();
    activityLog = readSession(ACTIVITY_LOG_KEY, []);
    lastStreamVerification = null;
    lastSessionPoll = null;
    clientIntegrity = { token: '', clientId: '', expiresAt: 0, transport: '', deviceId: '' };
    watchClock = { login: '', started: 0, elapsed: 0, lastTick: 0 };
    lastPath = location.pathname;
    lastProgressReconcile = null;
    twitchNetworkCapture = { integrity: '', integrityExpiresAt: 0, clientId: '', deviceId: '', sessionId: '', clientVersion: '', auth: '' };
    nextGqlPollAt = 0;
    try { tabChannel?.close(); } catch (_) {}
    tabChannel = null;
  }

  function automaticViewingArrival(login = watchingLogin(), now = Date.now()) {
    const requested = readSession(VIEWING_NAVIGATION_KEY, null);
    return Boolean(requested && requested.channel === login && requested.until > now);
  }

  function syncViewingContext() {
    const account = storageAccountLogin();
    if (viewingAccount !== account) resetViewingAccount(account);
    const login = watchingLogin() || '';
    const automaticArrival = automaticViewingArrival(login);
    const changed = viewingIntent.context(account, login, automaticArrival);
    if (changed) {
      viewingVideo = null;
      lastViewingNavigationBlock = '';
      recentPlaybackControl = { action: '', at: 0 };
    }
    const video = login ? streamVideoElement() : null;
    if (video !== viewingVideo) {
      viewingVideo = video;
      videoMountedDuringPause = viewingIntent.snapshot().paused;
    }
    if (!video) viewingIntent.observe('unknown');
    else if (video.ended) viewingIntent.observe('ended');
    else if (video.error) viewingIntent.observe('error');
    else if (video.paused) {
      // An unrequested paused player is not permission to force playback.
      if (!automaticArrival || viewingIntent.snapshot().paused) viewingIntent.pause(false);
      else viewingIntent.observe('paused');
    } else {
      const held = viewingIntent.snapshot();
      const explicitResume = recentPlaybackControl.action === 'resume' && Date.now() - recentPlaybackControl.at < 1500;
      if (held.paused && (videoMountedDuringPause || held.pauseReason === 'viewer') && !explicitResume) {
        // Preserve a known pause through a same-channel player replacement.
        // This does not intercept or replace Twitch's media methods.
        try { video.pause(); } catch (_) {}
      } else viewingIntent.observe(video.readyState > 1 ? 'playing' : 'buffering');
    }
    return viewingIntent.snapshot();
  }

  function viewingNavigationAllowed(reason = '', explicit = false) {
    const state = syncViewingContext();
    const manualAction = explicit || reason === 'manual-stream-skip' || Date.now() < explicitViewingNavigationUntil;
    if (viewingIntent.navigationAllowed(manualAction)) return true;
    lastViewingNavigationBlock = state.paused ? 'Playback Paused' : 'Your Stream Is Selected';
    return false;
  }

  function viewingStatus() {
    const state = viewingIntent.snapshot();
    if (state.paused) return state.pauseReason === 'viewer'
      ? { label: 'Playback Paused', detail: 'Dropper will not resume playback or switch streams while your pause is active.' }
      : { label: 'Playback Needs Attention', detail: 'Playback is paused. Resume it yourself or choose Resume Playback; Dropper will not guess why it stopped.' };
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
    const message = viewingStatus();
    const status = ui.shadow.getElementById('tdh-viewing-status');
    if (status) status.textContent = message?.detail || (state.manualStream ? 'Your selected stream is protected from automatic navigation.' : 'Automatic navigation follows your stream settings.');
    const resume = ui.shadow.getElementById('tdh-resume-playback');
    if (resume) resume.hidden = !state.paused && state.playback === 'playing';
    const automatic = ui.shadow.getElementById('tdh-allow-switching');
    if (automatic) automatic.hidden = !state.manualStream && settings.findNextStream;
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
  async function withClaimLock(key, context, task) {
    if (!claimContextIsCurrent(context)) return false;
    if (navigator.locks?.request) {
      return navigator.locks.request(`dropper-claim:${context.account}:${key}`, { ifAvailable: true }, lock => lock && claimContextIsCurrent(context) ? task() : false);
    }
    // Without Web Locks this is advisory leader coordination, not a cross-tab
    // atomicity guarantee. The persisted pending record still suppresses repeats.
    if (!isAutoRoutingController()) return false;
    return task();
  }
  function recordClaimOutcome(ledger, attempt, outcome, evidence) {
    const settled = ledger.settle(attempt.key, attempt.attemptId, outcome, evidence);
    if (!settled) return null;
    const label = DropperActiveViewing.claimPresentation(settled);
    if (outcome === 'confirmed' || outcome === 'already-claimed') {
      if (attempt.kind === 'bonus') lastBonusAt = Date.now();
      else lastDropAt = Date.now();
      if (attempt.kind === 'drop' && attempt.key === claimRecordKey(currentDrop)) resetClaimReadyTimer();
    }
    logActivity('claim-result', label, { kind: attempt.kind, rewardId: attempt.rewardId || null, outcome, evidence });
    setStatus(label);
    if (outcome === 'confirmed') notifyUser(label);
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
  function isSafeClaimTarget(button, group) {
    if (!button || button.tagName !== 'BUTTON' || !button.isConnected || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[inert]')) return false;
    const label = cleanText(`${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`);
    if (/\b(?:subscribe|subscription|gift|purchase|buy|redeem|spend)\b/i.test(label)) return false;
    const bonusContainer = button.closest('.community-points-summary,[data-test-selector="community-points-summary"],[data-a-target="community-points-summary"]');
    if (group.kind === 'bonus' && !bonusContainer && !button.querySelector('.claimable-bonus__icon')) return false;
    const visible = Boolean(button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden');
    if (visible) return true;
    return Boolean(group.kind === 'bonus' && document.fullscreenElement && bonusContainer && button.matches('button[aria-label="Claim Bonus"]') && button.querySelector('.claimable-bonus__icon'));
  }
  function claimTargetIdentity(button, group) {
    if (group.kind === 'drop') {
      const carrier = button.closest('[data-drop-id],[data-drop-instance-id]');
      const rewardId = carrier?.getAttribute('data-drop-id') || '';
      const instanceId = carrier?.getAttribute('data-drop-instance-id') || '';
      for (const campaign of lastInventoryCampaigns) {
        const reward = (campaign.timeBasedDrops || campaign.drops || []).find(item => (rewardId && item.id === rewardId) || (instanceId && item.self?.dropInstanceID === instanceId));
        if (reward && !reward.self?.isClaimed) return { id: reward.id, campaignId: String(campaign.id || ''), campaignKey: campaignKey(campaign), dropInstanceID: reward.self?.dropInstanceID || '' };
      }
      if (!isInventory() && currentDrop?.id && dropProgressComplete(currentDrop)) return currentDrop;
    }
    if (!claimNodeIds.has(button)) claimNodeIds.set(button, `anonymous:${TAB_ID}:${++claimAnonymousSequence}`);
    return { anonymous: claimNodeIds.get(button) };
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
      const attempt = ledger.begin({ key, rewardId: identity.id || '', campaignId: identity.campaignId || identity.campaignKey || '', kind: group.kind, evidence: 'page-control' });
      if (!attempt) return false;
      if (identity.anonymous) lastAnonymousAttemptAt[group.kind] = Date.now();
      try {
        button.click();
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
    let queued = 0;
    for (const group of CLAIM_GROUPS) {
      if (kind && kind !== group.kind) continue;
      const applicable = group.applies() && (group.kind === 'bonus' ? settings.claimBonus : settings.claimDrops);
      claimHealth[group.id] = { ...claimHealth[group.id], kind: group.kind, applicable, state: applicable ? 'no-claimable-reward' : 'not-applicable', checkedAt: Date.now() };
      if (!applicable) continue;
      try {
        const candidates = new Set();
        for (const node of [...(root.matches?.(group.selector) ? [root] : []), ...(root.querySelectorAll?.(group.selector) || [])]) {
          const button = node.closest?.('button');
          if (button && isSafeClaimTarget(button, group)) candidates.add(button);
        }
        if (group.id === 'inventory-drop') {
          for (const card of document.querySelectorAll('.inventory-max-width > div:not(:first-child)')) {
            if (!card.querySelector('[role="progressbar"],[data-test-selector*="RewardPresentation"]')) continue;
            for (const button of card.querySelectorAll('button')) if (isDropClaimButton(button) && isSafeClaimTarget(button, group)) candidates.add(button);
          }
        }
        if (candidates.size) claimHealth[group.id].state = 'matched';
        for (const button of candidates) if (queuePageClaim(button, group)) queued += 1;
      } catch (_) { claimHealth[group.id].state = 'detection-failed'; }
    }
    return queued;
  }
  function queueClaimScan() {
    if (claimScanTimer || (!settings.claimBonus && !settings.claimDrops)) return;
    claimScanTimer = setTimeout(() => { claimScanTimer = null; scanClaimGroups(); }, 150);
  }
  function renderClaimHistory() {
    const output = ui?.shadow?.getElementById('tdh-claim-history');
    if (!output) return;
    const records = claimLedger().snapshot().slice(0, 20);
    output.textContent = records.length ? records.map(record => `${new Date(record.at).toLocaleTimeString()} · ${record.kind === 'bonus' ? 'Bonus' : 'Drop'} · ${DropperActiveViewing.claimPresentation(record)} · ${record.evidence}`).join('\n') : 'No claim attempts recorded for this account.';
  }

  function campaignPriority(game) {
    try {
      const value = Number(localStorage.getItem(scopedLocalStorageKey(CAMPAIGN_PRIORITY_KEY) + ':' + encodeURIComponent(normalizeGameName(game))) || 0);
      return [-1, 0, 1].includes(value) ? value : 0;
    } catch (_) { return 0; }
  }
  function setCampaignPriority(game, priority) {
    if (![-1, 0, 1].includes(priority)) return;
    try { localStorage.setItem(scopedLocalStorageKey(CAMPAIGN_PRIORITY_KEY) + ':' + encodeURIComponent(normalizeGameName(game)), String(priority)); } catch (_) {}
  }
  function dropperPreconditionsMet(drop, drops) {
    return DropperActiveViewing.planPrerequisites(drop, drops).ready;
  }
  function activeRewardEligibility() {
    const campaign = findCampaignForDrop(lastInventoryCampaigns, currentDrop) || findCampaignForDrop(lastCampaignCatalog, currentDrop);
    const raw = (campaign?.timeBasedDrops || campaign?.drops || []).find(drop => drop.id === currentDrop?.id);
    const info = watchingLogin() ? readStreamInfo() : {};
    const proof = lastStreamVerification;
    const verified = Boolean(proof && proof.channel === watchingLogin() && proof.campaignKey === currentDrop?.campaignKey && (proof.proof?.campaignSupported || proof.proof?.progressConfirmed));
    return DropperActiveViewing.eligibility(campaign, raw, {
      now: Date.now(), channel: watchingLogin(), game: campaign && gameNamesMatch(campaignGameName(campaign), info.game) ? campaignGameName(campaign) : info.game,
      allowedChannels: campaign ? campaignAllowedChannels(campaign).map(item => item.login) : [], verified,
    });
  }


  function pollContext() {
    syncViewingContext();
    return { account: storageAccountLogin(), path: location.pathname, generation: viewingIntent.snapshot().generation };
  }
  function pollContextIsCurrent(context) {
    return context.account === storageAccountLogin() && context.path === location.pathname && context.generation === viewingIntent.snapshot().generation;
  }
  function refreshEligibilityControls() {
    const output = ui?.shadow?.getElementById('tdh-reward-eligibility');
    if (!output) return;
    const state = activeRewardEligibility();
    const estimate = Number.isFinite(state.estimateMinutes) ? ` Estimated reward time: ${state.estimateMinutes} min. Twitch-credited progress remains authoritative.` : '';
    const deadline = state.deadline;
    const deadlineText = deadline?.finishable === false
      ? ` Deadline risk: ${deadline.requiredMinutes} min required with ${deadline.minutesUntilDeadline} min left.`
      : Number.isFinite(deadline?.marginMinutes) && deadline.marginMinutes <= 15
        ? ` Deadline margin: about ${Math.max(0, deadline.marginMinutes)} min.`
        : '';
    const campaignText = Number.isFinite(state.campaignPlan?.remainingMinutes)
      ? ` Campaign watch remaining: ${state.campaignPlan.remainingMinutes} min.`
      : '';
    output.textContent = `${state.label}. ${state.detail}${estimate}${deadlineText}${campaignText}`;
  }

  // Viewing and Twitch network hooks are installed after all declarations so boot
  // never runs inside a temporal dead zone for later `let` bindings (SPA re-entry).
  function startDropper() {
    try { localStorage.removeItem(scopedLocalStorageKey("dropper-temp-campaign-skips-v1")); } catch (_) { /* legacy cleanup */ }
    const existingRoutingSession = readSession(ROUTING_SESSION_KEY, null);
    try { removeSession(NEXT_GAME_KEY); } catch (_) { /* 3.1 legacy handoff cleanup */ }
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
      markUpdateInstallerLeft("blur");
    }, { passive: true });
    window.addEventListener("focus", () => {
      handleUpdateInstallerReturn("focus");
      queueGqlPollSoon("focus", 0);
      heartbeat();
    }, { passive: true });
    window.addEventListener("pageshow", () => {
      handleUpdateInstallerReturn("pageshow");
      queueGqlPollSoon("pageshow", 0);
      heartbeat();
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        markUpdateInstallerLeft("hidden");
      } else {
        handleUpdateInstallerReturn("visible");
        queueGqlPollSoon("visible", 0);
        heartbeat();
      }
    });
    window.addEventListener("resize", () => {
      syncDropperWidthToChat();
      layoutChrome();
    }, { passive: true });
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
    if (health.inVerificationGrace) return false;
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
    try { tabChannel?.postMessage({ type: "bye", id: TAB_ID }); } catch (_) { /* ignore */ }
  }

  function isOldestLiveTab(now = Date.now()) {
    const peers = liveTabPeers(now);
    if (!peers.length) return true;
    const oldestPeer = Number(peers[0]?.startedAt || 0);
    return TAB_STARTED_AT <= oldestPeer;
  }

  function isAutoRoutingController() {
    // 3.1 uses deterministic single-tab ownership. The oldest live Dropper tab
    // is the only tab allowed to make routing/navigation decisions.
    const peers = liveTabPeers();
    if (!peers.length) return true;
    return isOldestLiveTab();
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
            return;
          }
          if (data.type === "presence" && data.entry) {
            const map = pruneTabPresence(readTabPresenceMap());
            map[data.id] = data.entry;
            writeTabPresenceMap(map);
            lastPeerCount = Object.keys(map).length - (map[TAB_ID] ? 1 : 0);
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

    const excluded = new Set((session.excludedCampaignKeys || []).map((key) => cleanText(key).toLowerCase()).filter(Boolean));
    let next = null;
    for (let attempts = 0; attempts < 12; attempts += 1) {
      next = pickNextOpenCampaignDrop(routingCampaignPool(), [...excluded], []);
      if (!next) break;
      const key = cleanText(next.campaignKey || next.campaignId).toLowerCase();
      if (campaignIsExcluded(next) || (!next.needsDropDetails && !dropFitsCampaignWindow(next))) {
        if (key) excluded.add(key);
        next = null;
        continue;
      }
      break;
    }

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
    let candidate = null;
    let aclMatched = false;

    if (allowedChannels.length) {
      const visibleAllowed = candidates.find(
        (item) => allowedLogins.has(cleanText(item.login).toLowerCase()),
      ) || null;
      if (visibleAllowed) {
        candidate = {
          ...visibleAllowed,
          aclMatched: true,
          visibleInCategory: true,
          source: "campaign-acl",
        };
        aclMatched = true;
      }
    } else {
      const taggedCandidate = candidates.find((item) => item.dropsTagged === true) || null;
      const probationaryCandidate = candidates.find((item) => item.dropsTagged !== true) || null;
      candidate = taggedCandidate || probationaryCandidate;
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
          probationary: !(visibleDropsProof || campaignAclProof),
          campaignProbe: false,
          campaignAllowListPresent: Boolean(allowedChannels.length),
          campaignAllowListMatch: campaignAclProof,
          game: candidate.game || targetGame,
          seenAt: now,
        },
        navigationTarget: candidate.href,
        navigationReason: campaignAclProof ? "campaign-acl-stream" : visibleDropsProof ? "qualified-stream" : "probationary-stream",
        verifyBaselineMinutes: Number(currentDrop.currentMinutes || 0),
        verifyBaselinePercent: Number(currentDrop.percent || 0),
        deadlineAt: now + ROUTING_NAVIGATION_DEADLINE_MS,
      },
      campaignAclProof
        ? `Opening campaign-allowed stream ${candidate.login}`
        : visibleDropsProof
          ? `Opening Drops-qualified stream ${candidate.login}`
          : `Opening category stream ${candidate.login} for Drop verification`,
    );
    lastStreamSwitch = now;
    setStatus(
      campaignAclProof
        ? `Opening ${candidate.login} For ${session.targetCampaign || targetGame}`
        : visibleDropsProof
          ? `Opening ${candidate.login} For ${targetGame} Drops`
          : `Opening ${candidate.login} · Verifying Drops Eligibility`,
    );
    routingControllerNavigate(
      candidate.href,
      campaignAclProof ? "routing-open-campaign-acl-stream" : visibleDropsProof ? "routing-open-qualified-stream" : "routing-open-probationary-stream",
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

  function updateRoutingCampaignSupportEvidence(channelLogin, availableCampaigns, sessionDrop = null) {
    const session = readRoutingControllerSession();
    if (session.state !== ROUTING_STATES.VERIFY_STREAM) return false;

    const login = cleanText(channelLogin).toLowerCase();
    const target = cleanText(session.targetStream).toLowerCase();
    if (!login || !target || login !== target) return false;
    if (!currentDrop || !campaignIsRoutingOpen(currentDrop)) return false;

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

    if (campaignSupport !== true && !sessionMatches) return false;

    const evidence = {
      ...(session.candidateEvidence || {}),
      gqlCampaignSupported: true,
      gqlSessionMatched: sessionMatches,
      gqlSessionCampaignMatched: sessionCampaignMatches,
      gqlSessionDropMatched: sessionDropMatches,
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
    const gameMatches = Boolean(streamGame && targetGame && gameNamesMatch(targetGame, streamGame));
    const minutesAdvanced = Number(currentDrop?.currentMinutes || 0) > Number(session.verifyBaselineMinutes || 0);
    const percentAdvanced = Number(currentDrop?.percent || 0) > Number(session.verifyBaselinePercent || 0);
    const progressProof = minutesAdvanced || percentAdvanced;
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const verificationLogin = login || target;

    if (allowedLogins.size && verificationLogin && !allowedLogins.has(verificationLogin)) {
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, verificationLogin),
          targetStream: "",
          candidateEvidence: null,
          deadlineAt: 0,
        },
        `Rejected ${verificationLogin} · not allowed by ${session.targetCampaign || targetGame}`,
      );
    }

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
          deadlineAt: 0,
          mismatchSince: 0,
          offlineSince: 0,
          verifyBaselineMinutes: Number(currentDrop?.currentMinutes || 0),
          verifyBaselinePercent: Number(currentDrop?.percent || 0),
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
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const gameMatches = Boolean(info.game && targetGame && gameNamesMatch(targetGame, info.game));

    if (allowedLogins.size && login && !allowedLogins.has(login)) {
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, login),
          targetStream: "",
          candidateEvidence: null,
          deadlineAt: 0,
        },
        `Verified session invalidated · ${login} is not allowed by ${session.targetCampaign || targetGame}`,
      );
    }

    if (!login || !info.live) {
      const offlineSince = Number(session.offlineSince || 0) || now;
      if (!session.offlineSince) session = writeRoutingControllerSession({ ...session, offlineSince });
      if (now - offlineSince >= ROUTING_OFFLINE_GRACE_MS) {
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
    const stallAnchor = Math.max(
      Number(lastProgressAt || 0),
      Number(session.earningStartedAt || session.enteredAt || now),
    );
    const stallMs = progressStallTimeoutMs(Boolean(health.healthy));
    if (
      settings.queueOnStall &&
      !isAutoSwitchPaused() &&
      stallAnchor &&
      now - stallAnchor >= stallMs
    ) {
      return transitionRoutingController(
        ROUTING_STATES.FIND_STREAM,
        {
          failedStreams: routingControllerAddFailedStream(session, login),
          targetStream: "",
          deadlineAt: 0,
        },
        `No credited progress from ${login} before the earning deadline`,
      );
    }

    setStatus(`Earning ${currentDrop.name || "Drop"} On ${login}`);
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

  async function heartbeat() {
    if (!ui) return;
    const now = Date.now();
    syncViewingContext();
    lastHeartbeatAt = now;
    publishTabPresence();
    enforceUpdateReloadPending(now);
    enforceAutoDismissDeadlines(now);
    noteWatching();
    watchProgressTitle();
    ensureStreamMuted();
    ensureStreamPlaying();
    void syncScreenWakeLock();
    refreshViewingControls();
    renderClaimHistory();
    refreshEligibilityControls();
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
    if (now - lastStandbyRefreshAt >= STANDBY_REFRESH_INTERVAL_MS) refreshStandbyCampaignCache(now);

    routingControllerTick(Date.now(), "heartbeat");

    syncProgressSurfaces();
    updateTitle();

    const updateState = loadUpdateState();
    if (
      updateState.checkedForVersion !== APP_VERSION ||
      now - Number(updateState.lastCheckAt || 0) >= UPDATE_CHECK_INTERVAL_MS
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

  function syncDropperWidthToChat() {
    if (!ui?.cluster) return;
    const chat = findTwitchChatColumn();
    const measured = chat ? Math.round(chat.getBoundingClientRect().width) : 312;
    const width = Math.max(280, Math.min(measured || 312, 340));
    ui.cluster.style.setProperty("--dropper-width", `${width}px`);
  }

  function watchChatWidth() {
    if (!ui?.cluster) return;
    const attach = () => {
      const chat = findTwitchChatColumn();
      if (!chat) {
        if (observedChatElement && !observedChatElement.isConnected) {
          chatWidthObserver?.disconnect();
          chatWidthObserver = null;
          observedChatElement = null;
        }
        syncDropperWidthToChat();
        return;
      }
      if (chat === observedChatElement && chatWidthObserver) return;

      chatWidthObserver?.disconnect();
      observedChatElement = chat;
      syncDropperWidthToChat();
      if (typeof ResizeObserver !== "function") return;
      chatWidthObserver = new ResizeObserver(() => {
        syncDropperWidthToChat();
        layoutChrome();
      });
      chatWidthObserver.observe(chat);
    };

    attach();
    if (chatDomObserver || typeof MutationObserver !== "function") return;
    chatDomObserver = new MutationObserver(() => {
      attach();
    });
    chatDomObserver.observe(document.documentElement, { childList: true, subtree: true });
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
    return entry;
  }

  function clearActivityLog() {
    activityLog = [];
    writeSession(ACTIVITY_LOG_KEY, activityLog);
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
    if (settings.muteRestarted && streamLoginFromUrl(target.href)) {
      requestMuteAfterNavigation(reason);
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
      if (status === "expired" || status === "completed") continue;
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

  function routingCampaignPool(extra = [], now = Date.now()) {
    const merged = mergeCampaigns(
      mergeCampaigns(lastCampaignCatalog, lastInventoryCampaigns),
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

  function replaceCatalogFromDashboard(campaigns, source = "viewer-drops-dashboard") {
    if (!Array.isArray(campaigns)) return lastCampaignCatalog;
    const replaced = campaigns.map((campaign) => {
      const key = campaignKey(campaign);
      const progress = (lastInventoryCampaigns || []).find((item) => campaignKey(item) === key);
      return progress ? mergeCampaigns([campaign], [progress])[0] : campaign;
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

  async function enrichCampaignsWithDropDetails(campaigns, source = "drop-campaign-details") {
    const list = Array.isArray(campaigns) ? campaigns.filter(Boolean) : [];
    if (!list.length || !getToken()) return list;
    const login = cleanText(
      cookie("login") ||
      cookie("name") ||
      ""
    ).toLowerCase() || watchingLogin();
    const needsDetails = list.filter((campaign) => {
      const drops = campaign?.timeBasedDrops || campaign?.drops || [];
      return Boolean(campaign?.id) && drops.length === 0;
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
          if (!detailed?.id) continue;
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
            replaceCatalogFromDashboard(open, `${source}-inventory-fallback`);
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

  function ingestTwitchGqlRows(rows, source = "twitch-page-intercept") {
    if (!Array.isArray(rows) || !rows.length) return false;
    let touched = false;
    let inventoryCampaigns = null;
    let dashboardCampaigns = null;
    let sessionRow = null;
    let availableCampaigns = null;

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const data = row.data;
      if (!data || typeof data !== "object") continue;
      const inventory = data.currentUser?.inventory?.dropCampaignsInProgress;
      if (Array.isArray(inventory)) {
        inventoryCampaigns = inventory;
        touched = true;
      }
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
      const available = data.channel?.viewerDropCampaigns || data.user?.viewerDropCampaigns || data.channel?.dropCampaigns;
      if (Array.isArray(available)) {
        availableCampaigns = available;
        touched = true;
      }
    }

    if (!touched) return false;

    lastTwitchGqlAt = Date.now();
    lastGqlSuccessAt = Date.now();
    lastGqlError = "";
    clearGqlFailurePause(source);
    networkState.consecutiveFailures = 0;
    persistNetworkState();

    if (Array.isArray(dashboardCampaigns)) {
      lastCampaignDashboardAt = Date.now();
      replaceCatalogFromDashboard(dashboardCampaigns, source);
      const open = openDashboardCampaigns(dashboardCampaigns);
      if (open.length && (open.length >= PAGE_CAMPAIGN_IMPORT_MIN || isCampaigns() || needsCampaignPageImport())) {
        markCampaignPageImport(open.length, source, CAMPAIGN_PAGE_DISPLAY.GQL_AUTH);
      }
    }
    if (Array.isArray(inventoryCampaigns)) {
      const discovered = extractCampaignCatalog({ data: { currentUser: { inventory: { dropCampaignsInProgress: inventoryCampaigns } } } });
      if (discovered.length) rememberCampaignCatalog(discovered, source);
      applyInventorySnapshot(inventoryCampaigns, source);
    }

    const campaignPool = mergeCampaigns(
      lastCampaignCatalog,
      mergeCampaigns(lastInventoryCampaigns, availableCampaigns || []),
    );
    const routingController = isAutoRoutingController();
    if (!routingController) noteDeferredAutoRouting("page-gql-deferred");
    const sessionDrop = sessionRow ? parseSessionDrop(sessionRow, mergeCampaigns(lastInventoryCampaigns, availableCampaigns || [])) : null;
    if (currentDrop) {
      const liveInventoryDrop = findActiveDropInCampaigns(lastInventoryCampaigns, currentDrop);
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
        setStatus(`Working toward ${liveInventoryDrop.name || currentDrop.name}${watchingLogin() ? ` on ${watchingLogin()}` : ""}`);
      } else if (sessionDrop && sessionIdentity.matchesTarget) {
        applyDrop(sessionDrop);
        setStatus(`Working toward ${sessionDrop.name}${watchingLogin() ? ` on ${watchingLogin()}` : ""}`);
      } else if (sessionDrop) {
        reconcileDropProgress(sessionDrop, currentDrop, {
          inventoryLive: false,
          sessionEligible: false,
          sessionRejectedReason: "different-campaign-or-drop",
        });
      }
    } else if (sessionDrop) {
      applyDrop(sessionDrop);
      setStatus(`Working toward ${sessionDrop.name}${watchingLogin() ? ` on ${watchingLogin()}` : ""}`);
    }

    refreshDropCard();
    return true;
  }

  function handleInterceptedTwitchPayload(url, headers, json, status = 200) {
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
    try {
      const rows = parseGqlRows(json, status);
      ingestTwitchGqlRows(rows, "twitch-page-intercept");
    } catch (_) {
      /* ignore non-drops or error payloads from Twitch's own traffic */
    }
  }

  function installTwitchNetworkHooks(uw = page) {
    if (twitchNetworkHooksInstalled || !uw) return;
    twitchNetworkHooksInstalled = true;

    const channel = "tdh-twitch-gql-intercept-v1";
    const secret = `tdh-${Math.random().toString(36).slice(2, 10)}`;
    const onPayload = (event) => {
      const detail = event?.detail;
      if (!detail || detail.secret !== secret) return;
      if (!detail.requestScope || detail.requestScope.account !== storageAccountLogin() || detail.requestScope.path !== location.pathname) return;
      syncViewingContext();
      handleInterceptedTwitchPayload(detail.url, detail.headers || {}, detail.json, detail.status);
    };
    try { uw.addEventListener(channel, onPayload, true); } catch (_) { /* ignore */ }
    try { window.addEventListener(channel, onPayload, true); } catch (_) { /* ignore */ }

    // Page-world inject keeps ad-blocker failures off the Dropper.user.js stack.
    const injector = `(()=>{if(window.__tdhTwitchNetHooked)return;window.__tdhTwitchNetHooked=1;const C=${JSON.stringify(channel)},S=${JSON.stringify(secret)};const gql=u=>{try{const p=new URL(String(u||""),location.href);return p.hostname==="gql.twitch.tv"&&(p.pathname==="/gql"||p.pathname==="/integrity")}catch(e){return!1}};const scope=()=>{const c=document.cookie.split(";").map(x=>x.trim());const get=k=>{const v=c.find(x=>x.startsWith(k+"="));try{return v?decodeURIComponent(v.slice(k.length+1)):""}catch(e){return""}};return{account:(get("login")||get("name")||"signed-out").toLowerCase(),path:location.pathname}};const emit=(u,h,j,s,q)=>{try{window.dispatchEvent(new CustomEvent(C,{detail:{secret:S,url:u,headers:h||{},json:j,status:s,requestScope:q}}))}catch(e){}};const hdrs=h=>{const o={};if(!h)return o;if(typeof Headers!=="undefined"&&h instanceof Headers){h.forEach((v,k)=>{o[String(k).toLowerCase()]=String(v)});return o}if(Array.isArray(h)){for(const e of h){if(e&&e.length>=2)o[String(e[0]).toLowerCase()]=String(e[1])}return o}if(typeof h==="object"){for(const[k,v]of Object.entries(h)){if(v!=null)o[String(k).toLowerCase()]=String(v)}}return o};const urlOf=i=>typeof i==="string"?i:(i&&typeof i.url==="string"?i.url:String(i||""));const nf=window.fetch;if(typeof nf==="function"){window.fetch=function(i,n){const u=urlOf(i);if(!gql(u))return nf.apply(this,arguments);const rh=hdrs((n&&n.headers)||(i&&i.headers)),q=scope();return nf.apply(this,arguments).then(r=>{try{r.clone().json().then(j=>emit(u,rh,j,r.status,q)).catch(()=>{})}catch(e){}return r})}}const X=window.XMLHttpRequest;if(typeof X==="function"){const o=X.prototype.open,sH=X.prototype.setRequestHeader,s=X.prototype.send;X.prototype.open=function(m,u){this.__tdhUrl=String(u||"");this.__tdhHeaders={};return o.apply(this,arguments)};X.prototype.setRequestHeader=function(n,v){if(!this.__tdhHeaders)this.__tdhHeaders={};this.__tdhHeaders[String(n).toLowerCase()]=String(v);return sH.apply(this,arguments)};X.prototype.send=function(b){if(gql(this.__tdhUrl)){const q=scope();this.addEventListener("load",()=>{try{const t=this.responseText||"";emit(this.__tdhUrl,this.__tdhHeaders,t?JSON.parse(t):null,this.status,q)}catch(e){}},{once:!0})}return s.apply(this,arguments)}}})();`;

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

  function parseGqlRows(json, status = 200) {
    if (status < 200 || status >= 300) throw new Error(`GQL HTTP ${status}`);
    const rows = Array.isArray(json) ? json : [json];
    const hardErrors = [];
    for (const row of rows) {
      const errors = Array.isArray(row?.errors) ? row.errors : [];
      if (!errors.length) continue;
      const hasData = row?.data != null && typeof row.data === "object";
      if (hasData && errors.every(isSoftGqlError)) continue;
      hardErrors.push(...errors);
    }
    if (hardErrors.length) {
      const message = hardErrors
        .map((item) => cleanText(item?.message || ""))
        .filter(Boolean)
        .join(" · ");
      throw new Error(message || "Twitch GQL error");
    }
    return rows;
  }

  async function gql(requests) {
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
      return parseGqlRows(result.json, result.status);
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
          if (error?.circuitOpen) throw error;
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
    const current = Number(self.currentMinutesWatched || 0);
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
      ...document.querySelectorAll(".inventory-max-width > div:not(:first-child)"),
      ...document.querySelectorAll("[data-test-selector*='DropsCampaign']"),
      ...document.querySelectorAll("[class*='drops-campaign']"),
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

  function pickNextOpenCampaignDrop(campaigns, excludedCampaignKeys = [], excludedGames = []) {
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
        const current = Number(self.currentMinutesWatched || 0);
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
          remainingMinutes: Math.max(0, required - current),
          needsDropDetails: false,
        });
        addedWatchDrop = true;
      }

      // ViewerDropsDashboard often returns open campaigns without timeBasedDrops.
      // Still queue them by end date so ending-soonest is not skipped for Inventory-only rows.
      if (!addedWatchDrop) {
        if (watchDrops.length) continue;
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
    const ranked = DropperActiveViewing.rankCampaignCandidates(incomplete, {
      priorityOf: campaignPriority,
      now,
      activeGame: currentDrop?.game || "",
    });
    const viable = ranked.filter((item) => item.sequenceFinishable !== false);
    const pool = viable.length ? viable : ranked;
    pool.sort((a, b) => {
      if (Boolean(a.needsDropDetails) !== Boolean(b.needsDropDetails)) return a.needsDropDetails ? 1 : -1;
      return 0;
    });
    return preferCurrentWinnableOpenDrop(pool) || pool[0] || null;
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
    return DropperActiveViewing.rankCampaignCandidates([...byKey.values()], {
      priorityOf: campaignPriority,
      now,
      activeGame: currentDrop?.game || "",
    });
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
        const current = Number(self.currentMinutesWatched) || 0;
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
          remainingMinutes: Math.max(0, required - current),
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
        const current = Number(self.currentMinutesWatched) || 0;
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
          remainingMinutes: Math.max(0, required - current),
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

    const visible = allCandidates.map((item) => {
      const login = cleanText(item.login).toLowerCase();
      const allowListMatch = Boolean(login && allowedLogins.has(login));
      const dropsTagged = item.dropsTagged === true;
      const temporarilySkipped = Boolean(login && skipped.has(login));
      const campaignCompatible = !allowListPresent || allowListMatch;
      const routable = Boolean(!temporarilySkipped && campaignCompatible);

      let reason = "same-game-probationary";
      if (temporarilySkipped) reason = "temporary-skip";
      else if (allowListMatch) reason = "campaign-allow-list-match";
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
    });

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
        if (allowListPresent && !activeAllowedLogins.has(login)) return false;
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
        const routable = Boolean(
          !temporarilySkipped &&
          (!allowListPresent || allowListMatch)
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
            : allowListPresent
              ? allowListMatch ? "campaign-allow-list-match" : "campaign-allow-list-mismatch"
              : item.reason || null,
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
      error: null,
    };
    let sessionDrop = null;
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
      sessionDrop = parseSessionDrop(extra[0], [...campaigns, ...available]);
      note.session = Boolean(sessionDrop);
      note.minutes = Number.isFinite(Number(sessionDrop?.currentMinutes))
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
    } catch (error) {
      note.error = error?.message || String(error);
    }
    if (!pollContextIsCurrent(requestContext)) return { sessionDrop: null, available: [] };
    lastSessionPoll = note;
    return { sessionDrop, available };
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
      if (self.isClaimed || requiresSubscription(drop)) continue;
      const required = Number(drop?.requiredMinutesWatched || 0);
      if (required <= 0) continue;

      const current = Number(self.currentMinutesWatched || 0);
      const id = cleanText(drop?.id);
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
    return {
      targetCampaignKey: targetCampaignKey || null,
      targetDropId: targetDropId || null,
      dropCampaignKey: dropCampaignKey || null,
      dropId: dropId || null,
      campaignMatched,
      dropMatched,
      targetCampaignOpen: Boolean(targetRoutingState.open),
      targetCampaignReason: targetRoutingState.reason || null,
      matchesTarget: Boolean(targetRoutingState.open && (campaignMatched || dropMatched)),
    };
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
      const first = await gql(requests);
      if (!pollContextIsCurrent(requestContext)) return;
      lastGqlSuccessAt = Date.now();
      lastGqlError = "";
      let responseIndex = 0;
      const inventoryRow = first[responseIndex++];
      const inventoryCampaigns = inventoryRow?.data?.currentUser?.inventory?.dropCampaignsInProgress || [];
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
      const discoveredCampaigns = extractCampaignCatalog(inventoryRow);
      if (discoveredCampaigns.length) rememberCampaignCatalog(discoveredCampaigns, "dropper-inventory-poll");
      applyInventorySnapshot(inventoryCampaigns, "dropper-in-progress-poll");
      reconcileClaimHistory(inventoryCampaigns);

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
      const sessionState = await fetchSessionDropState(channelId, login, inventoryCampaigns);
      if (!pollContextIsCurrent(requestContext)) return;
      let sessionDrop = sessionState.sessionDrop;
      let available = sessionState.available;
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
            ? "different-campaign-or-drop"
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
            ? "different-campaign-or-drop"
            : "",
        });
      }

      if (drop) applyDrop(drop);
      reconcileRoutingTargetWithCurrentDrop("gql-refresh");
      restoreVerifiedEarningFromSession(login, sessionDrop, gameName);

      // 3.1: GQL refresh updates data only. The routing controller decides what happens next.

      if (drop) {
        const channelNote = login ? ` on ${login}` : "";
        setStatus(`Working toward ${drop.name}${channelNote}`);
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
        const attempt = ledger.begin({ key, rewardId: drop.id || '', campaignId: drop.campaignId || drop.campaignKey || '', kind: 'drop' });
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
    if (!settings.claimBonus && !settings.claimDrops) {
      dropClaimObserver?.disconnect(); dropClaimObserver = null;
      clearTimeout(claimScanTimer); claimScanTimer = null;
      return;
    }
    if (!dropClaimObserver && document.documentElement) {
      dropClaimObserver = new MutationObserver(queueClaimScan);
      dropClaimObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    queueClaimScan();
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
      /^\d+\s*(?:minutes?|hours?)\b/i.test(text) ||
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
      if (status === "expired" || status === "completed" || record.completedAt) return false;
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
    const bars = [...card.querySelectorAll("[role='progressbar']")].map((bar) => ({
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
    const gameLink = document.querySelector('[data-a-target="stream-game-link"]');
    const game = cleanText(gameLink?.textContent);
    const gameCategoryUrl = gameLink?.href || "";
    const gameSlug = categorySlugFromUrl(gameCategoryUrl);
    if (game && gameSlug) rememberCategorySlug(game, gameSlug, "active-stream");
    const viewers = cleanText(document.querySelector('[data-a-target="animated-channel-viewers-count"]')?.textContent);
    const uptime = cleanText(document.querySelector('.live-time span[aria-hidden="true"]')?.textContent);
    const dropsEnabled = streamHasDropsEnabledTag(root);
    const live = Boolean(root.querySelector('.tw-channel-status-text-indicator, [class*="ChannelStatusTextIndicator"]')) || /\bLIVE\b/i.test(root.textContent || "");
    return { channelName, title, game, gameSlug, gameCategoryUrl, viewers, uptime, dropsEnabled, live };
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

  function requestMuteAfterNavigation(reason = "automatic-routing") {
    if (!settings.muteRestarted) return;
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
      if (playing && typeof playing.catch === 'function') playing.catch(() => {
        viewingIntent.pause(false);
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
    if (!settings.muteRestarted) return false;
    const pending = mutePendingSnapshot();
    if (!pending) return false;
    if (!watchingLogin()) return false;

    const video = document.querySelector("video");
    let changed = false;
    if (video && !video.muted) {
      try {
        video.muted = true;
        video.volume = 0;
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
    return changed;
  }

  function muteWhenReady(win) {
    if (!win) return;
    requestMuteAfterNavigation("popup-stream");
    const timer = setInterval(() => {
      try {
        const video = win.document?.querySelector("video");
        if (video) {
          video.muted = true;
          video.volume = 0;
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

  function themeSwatchesHtml() {
    return `<div class="theme-row"><span>Theme</span><div class="exp-theme-swatches" id="tdh-theme-swatches" role="radiogroup" aria-label="Menu Theme">${UI_THEMES.map((theme) => `<button type="button" class="exp-theme-swatch" data-theme="${theme.id}" aria-label="${theme.name}" title="${theme.name}" style="background:${theme.swatch}"></button>`).join("")}</div></div>`;
  }

  function css() {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .cluster {
        position: fixed; right: 12px; z-index: 2147483600;
        display: flex; flex-direction: column-reverse; align-items: flex-end;
        width: max-content; max-width: calc(100vw - 24px); gap: 8px;
        --theme-bg:#111114; --theme-panel:#19191e; --theme-line:#34343b; --theme-text:#efeff1; --theme-muted:#adadb8; --theme-accent:#9147ff; --theme-accent2:#bf94ff; --theme-skin:linear-gradient(135deg,#d9b5ff,#9b5af9,#7428e8); --theme-skin-vertical:linear-gradient(180deg,#d9b5ff,#9b5af9,#7428e8); --dropper-ui-opacity:1;
        font: 13px/1.42 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: var(--theme-text);
      }
      .cluster.open-up { flex-direction: column; }
      #tdh-tools-dock,
      #tdh-drop-card,
      .update-notice {
        opacity:var(--dropper-ui-opacity,1);
        transition:opacity .15s ease;
      }
      .progress-stack {
        width:min(var(--dropper-width, 312px), calc(100vw - 24px));
        display:flex; flex-direction:column; align-items:stretch;
        transition:.15s width;
        gap:6px;
      }
      .progress-stack[data-collapsed-width="compact"] { width:min(260px, calc(100vw - 24px)); }
      .progress-stack[data-collapsed-width="narrow"] { width:min(220px, calc(100vw - 24px)); }
      .progress-stack[data-collapsed-width="full"] { width:min(var(--dropper-width, 312px), calc(100vw - 24px)); }
      .cluster[data-panel-width="compact"] #tdh-tools-dock,
      .cluster[data-panel-width="compact"] > .update-notice[data-placement="menu"] {
        width:min(260px, calc(100vw - 24px));
      }
      .cluster[data-panel-width="narrow"] #tdh-tools-dock,
      .cluster[data-panel-width="narrow"] > .update-notice[data-placement="menu"] {
        width:min(220px, calc(100vw - 24px));
      }
      .cluster[data-panel-width="full"] #tdh-tools-dock,
      .cluster[data-panel-width="full"] > .update-notice[data-placement="menu"] {
        width:min(var(--dropper-width, 312px), calc(100vw - 24px));
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
      .compact-reward { font-size:10px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .compact-extra { font-size:9px; color:#b8b8c0; white-space:nowrap; }
      .state-pill { display:inline-flex; align-items:center; border:1px solid #34343a; border-radius:5px; padding:1px 5px; font-size:8px; font-weight:800; color:#d0d0d5; background:#1c1c21; white-space:nowrap; }
      .state-pill.good { color:#c8ffd7; border-color:#22c55e66; background:#22c55e18; }
      .state-pill.warn { color:#ffe5a8; border-color:#f59e0b66; background:#f59e0b18; }
      .state-pill.bad { color:#ffd1d1; border-color:#ef444466; background:#ef444418; }
      .stream-info { padding:7px 9px 6px; display:grid; grid-template-columns:32px minmax(0,1fr); gap:7px; align-items:center; }
      .stream-info-hidden { display:none; }
      .stream-head { min-width:0; display:flex; align-items:center; gap:5px; }
      .stream-channel { font-size:11px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .stream-live { font-size:8px; font-weight:900; background:#eb0400; color:#fff; border-radius:4px; padding:1px 4px; }
      .stream-title { display:none; }
      .stream-game { font-size:9px; color:#adadb8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .stream-badges { display:flex; gap:4px; flex-wrap:nowrap; align-items:center; justify-self:end; font-size:8px; color:#8f8f98; }
      .stream-badges[hidden] { display:none !important; }
      .stream-badge { padding:1px 4px; border:1px solid #34343b; border-radius:99px; }
      .stream-badge.drops-enabled { color:#d7ffd7; border-color:#22c55e66; background:#22c55e18; }
      .stream-dot { color:#5f5f68; }
      .drop-section { padding:7px 9px 8px; border-top:1px solid #29292f; }
      .drop-kicker { font-size:8px; color:#bf94ff; font-weight:900; letter-spacing:.07em; text-transform:uppercase; margin-bottom:2px; }
      .drop-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-right:24px; }
      .drop-name { font-size:11px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .drop-game { display:none; }
      .drop-bar-row { margin-top:6px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px; align-items:center; }
      .drop-bar { height:6px; border-radius:99px; background:#2b2b31; overflow:hidden; }
      .drop-bar > span { display:block; height:100%; width:0; background:#9147ff; transition:.2s width,.2s background; }
      .drop-percent { font-size:10px; font-weight:800; color:#bf94ff; min-width:28px; text-align:right; }
      .drop-meta { font-size:8px; color:#9c9ca5; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .drop-status-row { margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:8px; color:#a7a7b0; }
      .progress-age { color:#a7a7b0; }
      .progress-age.warn { color:#f59e0b; }
      .progress-age.bad { color:#ef4444; font-weight:800; }
      /* 3.2.0 progress panel */
      .cluster{pointer-events:none!important}
      .cluster :is(#tdh-tools-dock,.update-notice,#tdh-drop-card,#tdh-settings-launcher){pointer-events:auto!important}
      .cluster .progress-stack{height:auto;min-height:48px;pointer-events:none!important}
      .cluster .badge-row{position:fixed!important;min-height:112px!important;height:auto!important;justify-content:flex-end!important;align-items:center!important;pointer-events:none!important}
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
      .stream-channel{min-width:0!important;color:var(--theme-text)!important;font-size:12px!important;font-weight:850!important;line-height:1.15!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .progress-head .drop-percent{min-width:38px!important;color:var(--theme-accent2)!important;font-size:12px!important;font-weight:900!important;line-height:1!important;text-align:right!important;white-space:nowrap!important}
      .progress-category{grid-area:category!important;min-width:0!important;color:var(--theme-muted)!important;font-size:9px!important;line-height:1.15!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .drop-bar{grid-area:bar!important;height:7px!important;margin:1px 0 0!important;border-radius:3px!important;background:color-mix(in srgb,var(--theme-line) 62%,transparent)!important;overflow:hidden!important}
      .drop-bar>span{display:block!important;height:100%!important;width:0;border-radius:inherit!important;background:var(--theme-accent)!important}
      .progress-reward-row{grid-area:reward!important;min-width:0!important;display:flex!important;align-items:center!important;gap:6px!important;color:var(--theme-muted)!important;font-size:9px!important;line-height:1.15!important}
      .progress-reward-row .drop-meta{margin:0!important;flex:0 0 auto!important;color:var(--theme-muted)!important;font-size:9px!important;white-space:nowrap!important}
      .progress-dot{flex:0 0 auto!important;color:color-mix(in srgb,var(--theme-muted) 78%,transparent)!important}
      .progress-reward-row .drop-name{min-width:0!important;color:var(--theme-muted)!important;font-size:9px!important;font-weight:650!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .drop-status-row{grid-area:status!important;min-width:0!important;margin:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;color:var(--theme-muted)!important;font-size:8px!important;line-height:1!important}
      .status-meta-chip{box-sizing:border-box!important;min-width:0!important;height:24px!important;display:flex!important;align-items:center!important;overflow:hidden!important;border:1px solid color-mix(in srgb,var(--theme-line) 88%,var(--theme-accent) 12%)!important;border-radius:6px!important;background:color-mix(in srgb,var(--theme-bg) 94%,var(--theme-panel) 6%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important}
      .drop-status-row .state-pill{box-sizing:border-box!important;min-width:0!important;min-height:0!important;height:22px!important;display:inline-flex!important;align-items:center!important;gap:5px!important;padding:0 8px!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--theme-muted)!important;font-size:8px!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important}
      .drop-status-row .state-pill::before{content:""!important;flex:0 0 auto!important;width:6px!important;height:6px!important;border-radius:2px!important;background:currentColor!important;box-shadow:0 0 7px color-mix(in srgb,currentColor 42%,transparent)!important}
      .drop-status-row .state-pill.good{color:#8fd7a0!important}
      .drop-status-row .state-pill.warn{color:#e4bd6c!important}
      .drop-status-row .state-pill.bad{color:#dc9393!important}
      .status-chip-divider{flex:0 0 auto!important;width:1px!important;height:12px!important;background:color-mix(in srgb,var(--theme-line) 82%,transparent)!important}
      .status-clock-icon{flex:0 0 auto!important;width:10px!important;height:10px!important;margin-left:7px!important;color:color-mix(in srgb,var(--theme-muted) 86%,var(--theme-text) 14%)!important}
      #tdh-updated-ago{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;padding:0 8px 0 4px!important;border:0!important;color:var(--theme-muted)!important;font-size:7.5px!important;font-weight:600!important;font-variant-numeric:tabular-nums!important;line-height:1!important;text-align:left!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .skip-streamer-chip{appearance:none!important;box-sizing:border-box!important;height:24px!important;min-height:24px!important;min-width:64px!important;max-width:82px!important;padding:0 9px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;border:1px solid color-mix(in srgb,var(--theme-line) 72%,var(--theme-accent) 28%)!important;border-radius:6px!important;background:color-mix(in srgb,var(--theme-bg) 95%,var(--theme-accent) 5%)!important;color:color-mix(in srgb,var(--theme-text) 84%,var(--theme-accent) 16%)!important;font:800 8px/1 ui-sans-serif,system-ui,sans-serif!important;cursor:pointer!important;white-space:nowrap!important;overflow:hidden!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important;transition:border-color .14s ease,background .14s ease,color .14s ease,box-shadow .14s ease!important}
      .skip-streamer-chip:hover,.skip-streamer-chip:focus-visible{border-color:color-mix(in srgb,var(--theme-accent) 72%,var(--theme-line) 28%)!important;background:color-mix(in srgb,var(--theme-panel) 88%,var(--theme-accent) 12%)!important;color:var(--theme-accent2)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-accent) 16%,transparent)!important;outline:none!important}
      .skip-streamer-chip:disabled{opacity:.36!important;cursor:default!important;box-shadow:none!important}
      .skip-streamer-chip .skip-icon{flex:0 0 auto!important;width:10px!important;height:10px!important;fill:currentColor!important}
      .skip-streamer-chip .skip-label{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .skip-streamer-chip .skip-countdown{display:inline-grid!important;place-items:center!important;min-width:18px!important;height:16px!important;margin-left:1px!important;padding:0 4px!important;border-radius:4px!important;background:#ef4444!important;color:#fff!important;font-size:6px!important;font-weight:900!important;line-height:1!important}
      .skip-streamer-chip .skip-countdown[hidden]{display:none!important}
      .skip-streamer-chip.is-armed{min-width:78px!important;max-width:92px!important;border-color:color-mix(in srgb,#ef4444 62%,var(--theme-line))!important;background:color-mix(in srgb,var(--theme-panel) 90%,#ef4444 10%)!important;color:#efb0b0!important}
      .skip-streamer-chip.is-armed .skip-icon{display:none!important}
      .progress-stack[data-collapsed-width="compact"] .stream-info{padding:9px 10px!important}
      .progress-stack[data-collapsed-width="compact"] .progress-copy{row-gap:6px!important}
      .progress-stack[data-collapsed-width="compact"] .stream-channel,.progress-stack[data-collapsed-width="compact"] .progress-head .drop-percent{font-size:11px!important}
      .progress-stack[data-collapsed-width="compact"] .progress-category,.progress-stack[data-collapsed-width="compact"] .progress-reward-row,.progress-stack[data-collapsed-width="compact"] .progress-reward-row .drop-meta,.progress-stack[data-collapsed-width="compact"] .progress-reward-row .drop-name{font-size:8px!important}
      .progress-stack[data-collapsed-width="compact"] .drop-status-row{grid-template-columns:minmax(0,1fr) auto!important;gap:5px!important}
      .progress-stack[data-collapsed-width="compact"] .status-meta-chip{height:22px!important}
      .progress-stack[data-collapsed-width="compact"] .drop-status-row .state-pill{height:20px!important;gap:4px!important;padding-inline:6px!important;font-size:7.25px!important}
      .progress-stack[data-collapsed-width="compact"] .drop-status-row .state-pill::before{width:5px!important;height:5px!important}
      .progress-stack[data-collapsed-width="compact"] .status-chip-divider{height:10px!important}
      .progress-stack[data-collapsed-width="compact"] .status-clock-icon{width:8.5px!important;height:8.5px!important;margin-left:5px!important}
      .progress-stack[data-collapsed-width="compact"] #tdh-updated-ago{padding:0 6px 0 3px!important;font-size:6.75px!important}
      .progress-stack[data-collapsed-width="compact"] .skip-streamer-chip{height:22px!important;min-height:22px!important;min-width:49px!important;max-width:56px!important;padding-inline:7px!important;gap:4px!important;font-size:7px!important}
      .progress-stack[data-collapsed-width="compact"] .skip-streamer-chip .skip-icon{width:9px!important;height:9px!important}
      .progress-stack[data-collapsed-width="compact"] .skip-streamer-chip.is-armed{min-width:67px!important;max-width:76px!important;padding-inline:6px!important}
      .progress-stack[data-collapsed-width="narrow"] .stream-info{padding:8px 9px!important}
      .progress-stack[data-collapsed-width="narrow"] .progress-copy{row-gap:5px!important}
      .progress-stack[data-collapsed-width="narrow"] .stream-channel,.progress-stack[data-collapsed-width="narrow"] .progress-head .drop-percent{font-size:10px!important}
      .progress-stack[data-collapsed-width="narrow"] .progress-category,.progress-stack[data-collapsed-width="narrow"] .progress-reward-row,.progress-stack[data-collapsed-width="narrow"] .progress-reward-row .drop-meta,.progress-stack[data-collapsed-width="narrow"] .progress-reward-row .drop-name{font-size:7.25px!important}
      .progress-stack[data-collapsed-width="narrow"] .drop-status-row{grid-template-columns:minmax(0,1fr) auto!important;gap:4px!important}
      .progress-stack[data-collapsed-width="narrow"] .status-meta-chip{height:21px!important}
      .progress-stack[data-collapsed-width="narrow"] .drop-status-row .state-pill{height:19px!important;gap:3px!important;padding-inline:5px!important;font-size:6.6px!important}
      .progress-stack[data-collapsed-width="narrow"] .drop-status-row .state-pill::before{width:4.5px!important;height:4.5px!important;box-shadow:none!important}
      .progress-stack[data-collapsed-width="narrow"] .status-chip-divider{height:9px!important}
      .progress-stack[data-collapsed-width="narrow"] .status-clock-icon{width:8px!important;height:8px!important;margin-left:4px!important}
      .progress-stack[data-collapsed-width="narrow"] #tdh-updated-ago{padding:0 5px 0 2px!important;font-size:6.25px!important}
      .progress-stack[data-collapsed-width="narrow"] .skip-streamer-chip{width:26px!important;min-width:26px!important;max-width:26px!important;height:21px!important;min-height:21px!important;padding:0!important;gap:0!important}
      .progress-stack[data-collapsed-width="narrow"] .skip-streamer-chip .skip-icon{width:10px!important;height:10px!important}
      .progress-stack[data-collapsed-width="narrow"] .skip-streamer-chip:not(.is-armed) .skip-label{display:none!important}
      .progress-stack[data-collapsed-width="narrow"] .skip-streamer-chip.is-armed{width:auto!important;min-width:64px!important;max-width:72px!important;padding-inline:5px!important;gap:3px!important}
      .progress-stack[data-collapsed-width="narrow"] .skip-streamer-chip.is-armed .skip-label{display:inline!important}
      .progress-stack[data-collapsed-width="narrow"] .skip-streamer-chip .skip-countdown{min-width:16px!important;height:14px!important;padding-inline:3px!important;font-size:5.5px!important}

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
      .stream-subsection-label{grid-column:1/-1;min-width:0;margin:1px 0 2px;color:var(--theme-accent2);font-size:8px;font-weight:900;line-height:1.2;letter-spacing:.08em;text-transform:uppercase}
      .stream-subsection-label.with-divider{margin-top:7px;padding-top:8px;border-top:1px solid var(--theme-line,#34343b)}
      #tdh-streams-body>.queue-switches,
      #tdh-streams-body>.queue-collapsible,
      #tdh-clear-skipped-streamers{grid-column:1/-1}
      .queue-switches{display:grid;grid-template-columns:minmax(58px,.7fr) minmax(0,1.3fr);column-gap:10px;row-gap:0;min-width:0;margin:6px 0;padding:2px 0;border:0;align-items:stretch}
      .queue-switches-label{grid-column:1;grid-row:1/span 3;display:flex;align-items:center;min-width:0;font-size:11px;font-weight:700;line-height:1.2;color:var(--theme-text,#efeff1)}
      .queue-switches>.fl-switch{grid-column:2;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:10px;min-width:0;padding:5px 0!important;text-align:left!important}
      .queue-switches>.fl-switch>span:first-child{display:block;flex:1 1 auto;width:auto!important;min-width:0!important;min-height:0!important;white-space:normal!important;word-break:normal!important;overflow-wrap:normal!important;line-height:1.25;text-align:left}
      .queue-switches>.fl-switch>.toggleSwitch{flex:0 0 34px;margin-left:auto}
      #tdh-collapsed-width{box-sizing:border-box;width:104px;min-width:0!important;max-width:104px!important;flex:0 1 104px}
      #tdh-progress-body{padding-bottom:5px}
      #tdh-progress-body>.fl-switch,
      #tdh-progress-body>.mini-row{padding:4px 0}
      #tdh-progress-body>.mini-row:has(#tdh-collapsed-width){grid-column:1/-1;align-items:center;flex-wrap:wrap}
      #tdh-progress-body>.mini-row:has(#tdh-collapsed-width)>span{flex:1 1 120px;min-width:0;white-space:normal;overflow-wrap:normal}
      #tdh-progress-body>.theme-row{min-height:22px;padding:3px 0;gap:6px}
      #tdh-progress-body .exp-theme-swatches{gap:3px;flex-wrap:nowrap;min-width:0}
      #tdh-progress-body .exp-theme-swatch{flex:0 0 18px!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;border-radius:4px!important}
      .cluster[data-panel-width="compact"] #tdh-progress-body>.theme-row>span,
      .cluster[data-panel-width="narrow"] #tdh-progress-body>.theme-row>span{display:none}
      .cluster[data-panel-width="compact"] #tdh-progress-body>.theme-row,
      .cluster[data-panel-width="narrow"] #tdh-progress-body>.theme-row{gap:0}
      .cluster[data-panel-width="compact"] #tdh-progress-body .exp-theme-swatches,
      .cluster[data-panel-width="narrow"] #tdh-progress-body .exp-theme-swatches{width:100%;justify-content:space-between}
      .cluster[data-panel-width="narrow"] #tdh-progress-body>.mini-row:has(#tdh-collapsed-width){flex-direction:column;align-items:stretch;gap:4px}
      .cluster[data-panel-width="narrow"] #tdh-progress-body>.mini-row:has(#tdh-collapsed-width)>span{flex:0 0 auto;width:100%}
      .cluster[data-panel-width="narrow"] #tdh-collapsed-width{width:100%;max-width:100%!important;flex:0 0 auto;margin:0}
      .cluster[data-panel-width="narrow"] #tdh-progress-body>.theme-row{gap:4px}
      .cluster[data-panel-width="narrow"] #tdh-progress-body .exp-theme-swatch{flex-basis:16px!important;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important}
      .appearance-separator{grid-column:1/-1;width:100%;border:0;border-top:1px solid var(--theme-line,#34343b);margin:3px 0 1px}
      .opacity-row{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(72px,1fr) auto;align-items:center;gap:6px;min-width:0;padding:4px 0;border-top:1px solid #26262b}
      .opacity-row[hidden]{display:none!important}
      .opacity-row>span{font-size:11px;line-height:1.25;white-space:nowrap}
      #tdh-opacity-range{width:100%;min-width:0;accent-color:var(--theme-accent)}
      #tdh-opacity-value{min-width:34px;text-align:right;font-size:10px;font-weight:800;color:var(--theme-muted)}
      .cluster[data-panel-width="narrow"] .opacity-row{grid-template-columns:1fr auto}
      .cluster[data-panel-width="narrow"] #tdh-opacity-range{grid-column:1/-1}
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
        border:2px solid var(--theme-panel,#18181b); border-radius:4px; background:#f59e0b; color:#111114; font-size:8px; font-weight:950;
        box-shadow:0 2px 6px #0007; z-index:4; pointer-events:none;
      }
      #tdh-settings-launcher .ring { position:absolute; top:50%; left:50%; width:44px; height:44px; pointer-events:none; transform:translate(-50%,-50%); }
      #tdh-settings-launcher .track { fill:none; stroke:color-mix(in srgb,var(--theme-line,#34343b) 72%,transparent); stroke-width:2.5; }
      #tdh-settings-launcher .fill { fill:none; stroke:var(--theme-accent,#9147ff); stroke-width:2.5; stroke-linecap:round; transition:.2s stroke; }
      #tdh-settings-launcher .icon { position:absolute; top:50%; left:50%; width:40px; height:40px; pointer-events:none; z-index:1; transform:translate(-50%,-50%); }
      #tdh-tools-dock {
        position:fixed; right:12px; top:auto; bottom:auto;
        display:none; width:min(var(--dropper-width, 312px), calc(100vw - 24px)); max-width:calc(100vw - 24px);
        height:max-content; min-height:0; max-height:none; overflow:visible; flex:0 0 auto;
        transition:.15s width;
        padding:9px 9px 4px; background:var(--theme-bg); border:0; border-radius:14px; box-shadow:0 18px 50px #0008; color-scheme:dark;
      }
      #tdh-tools-dock.fl-rail-open { display:block; height:max-content; min-height:0; max-height:none; }
      #tdh-tools-dock:focus { outline:none; }
      .menu-head {
        display:grid; grid-template-columns:minmax(0,1fr) 30px;
        align-items:start; gap:8px; width:100%;
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
        background:#1b1721; color:#c9a7ff; cursor:pointer; font:800 8px/1 ui-sans-serif,system-ui,sans-serif;
        white-space:nowrap;
      }
      #tdh-header-version:hover, #tdh-header-version:focus-visible {
        border-color:#9147ff; background:#251d31; color:#fff; outline:none;
      }
      #tdh-rail-subtitle {
        margin-top:2px; font-size:9px; line-height:1.2; color:#adadb8;
        white-space:normal; overflow-wrap:anywhere;
      }
      #tdh-rail-close {
        width:30px; height:30px; min-width:30px; padding:0; justify-self:end;
        border:1px solid #3a3a42; border-radius:8px; background:#151519; color:#b8b8c0;
        cursor:pointer; font:18px/1 Arial,sans-serif;
      }
      #tdh-rail-close:hover { border-color:#9147ff; color:#fff; background:#211b2b; }
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
      .update-kicker { margin-bottom:2px; color:var(--theme-accent2); font-size:8px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
      .update-title { font-size:12px; line-height:1.25; font-weight:850; color:var(--theme-text); }
      .update-version {
        flex:none; padding:2px 6px;
        border:1px solid color-mix(in srgb,var(--theme-accent) 62%,var(--theme-line));
        border-radius:5px;
        background:color-mix(in srgb,var(--theme-panel) 82%,var(--theme-accent) 18%);
        color:var(--theme-text);
        font-size:8px; font-weight:800; white-space:nowrap;
      }
      .update-text { margin-top:6px; font-size:9px; line-height:1.45; color:var(--theme-muted); white-space:normal; overflow:visible; }
      .update-list { margin:7px 0 0; padding:0 0 0 15px; max-height:86px; overflow:auto; color:var(--theme-text); font-size:9px; line-height:1.4; scrollbar-width:thin; }
      .update-list li::marker { color:var(--theme-accent); }
      .update-list li + li { margin-top:3px; }
      .update-footer { display:flex; justify-content:flex-end; gap:6px; margin-top:8px; padding-top:7px; border-top:1px solid var(--theme-line); }
      .update-action, .update-release, .update-dismiss, .life-btn {
        border:1px solid var(--theme-line); border-radius:7px;
        background:var(--theme-bg); color:var(--theme-text); cursor:pointer;
      }
      .update-action, .update-release { min-height:27px; padding:0 10px; font-size:9px; font-weight:800; }
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
      .toast { margin-bottom:7px; padding:6px 8px; border:1px solid #34343b; border-radius:8px; background:#18181b; color:#efeff1; font-size:9px; box-shadow:0 8px 24px #0006; }
      .toast[hidden] { display:none; }
      .fl-tool-panel { position:relative; margin-top:5px; border:1px solid #27272d; background:#19191e; border-radius:9px; overflow:visible; }
      .fl-tool-header { display:flex; justify-content:space-between; align-items:flex-start; height:auto; min-height:0; padding:7px 8px; cursor:pointer; border-radius:8px; }
      .fl-tool-header:hover { background:#9147ff18; }
      .fl-tool-header.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .fl-tool-title { min-width:0; flex:1; font-size:12px; font-weight:700; white-space:normal; overflow-wrap:anywhere; }
      .fl-tool-chevron { background:none; border:0; color:#adadb8; cursor:pointer; }
      .fl-tool-body { padding:0 10px 8px; }
      .fl-tool-body:not(.fl-tool-hidden) { display:grid; height:auto; min-height:0; max-height:none; overflow:visible; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:stretch; column-gap:8px; }
      .cluster[data-panel-width="compact"] .fl-tool-body:not(.fl-tool-hidden),
      .cluster[data-panel-width="narrow"] .fl-tool-body:not(.fl-tool-hidden) { grid-template-columns:minmax(0,1fr); }
      .cluster[data-panel-width="compact"] .fl-tool-body:not(.fl-tool-hidden) > *,
      .cluster[data-panel-width="narrow"] .fl-tool-body:not(.fl-tool-hidden) > * { grid-column:1/-1; }
      .fl-tool-body > :is(.fl-switch,.mini-row,.life-btn) { min-width:0; }
      .fl-tool-body > :is(.compact-inventory,.campaign-manager,.diag) { grid-column:1/-1; }
      #tdh-diagnostics-body { padding-bottom:2px; }
      .fl-tool-hidden { display:none !important; }
      .fl-switch, .mini-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; height:auto; min-height:0; padding:6px 0; }
      .fl-switch + .fl-switch, .mini-row + .mini-row { border-top:1px solid #26262b; }
      .fl-switch-text, .mini-row > span {
        min-width:0;
        font-size:11px;
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
      .life-btn { width:100%; min-height:28px; margin-top:6px; font-size:11px; }
      .life-btn.last-opened { box-shadow:inset 3px 0 0 #b783ff; }
      .select-lite { min-width:0; max-width:72px; background:#111114; color:#efeff1; border:1px solid #34343b; border-radius:6px; padding:4px 6px; font-size:11px; }
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
        font-size:10px;
        font-weight:800;
      }
      .auth-required[hidden] { display:none !important; }
      .auth-required .life-btn {
        width:auto;
        min-width:112px;
        margin:0;
        flex:0 0 auto;
      }
      #tdh-toggle-inventory,
      #tdh-refresh-campaign-data { grid-column:1/-1; }
      .auth-advanced { margin-top:2px; border:1px solid var(--theme-line); border-radius:7px; background:var(--theme-bg); padding:6px 8px; }
      .auth-advanced > summary { cursor:pointer; list-style:none; color:var(--theme-muted); font-size:11px; font-weight:600; user-select:none; }
      .auth-advanced > summary::-webkit-details-marker { display:none; }
      .auth-advanced[open] > summary { margin-bottom:6px; color:var(--theme-text); }
      .auth-advanced-body { display:flex; flex-direction:column; gap:6px; }
      .auth-hint { color:var(--theme-muted); font-size:10px; line-height:1.35; }
      .auth-input { width:100%; min-height:30px; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-panel); color:var(--theme-text); padding:6px 8px; font-size:11px; }
      .auth-input:focus { outline:none; border-color:var(--theme-accent); }
      .theme-row { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:28px; padding:6px 0; font-size:11px; }
      .exp-theme-swatch{box-sizing:border-box!important;flex:0 0 22px!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;padding:0!important;border-radius:5px!important}
      .exp-theme-swatches { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .exp-theme-swatch { appearance:none; width:18px; height:18px; min-width:18px; padding:0; border:2px solid var(--theme-line); border-radius:4px; box-sizing:border-box; cursor:pointer; }
      .exp-theme-swatch.is-on { border-color:var(--theme-text); box-shadow:0 0 0 2px var(--theme-accent); }
      .fl-tool-panel { border-color:var(--theme-line); background:var(--theme-panel); }
      .fl-tool-body, .select-lite, .life-btn { border-color:var(--theme-line); background:var(--theme-bg); color:var(--theme-text); }
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
      .campaign-manager-title { min-width:0; font-size:11px; font-weight:800; color:var(--theme-text); }
      .campaign-manager-summary { flex:0 0 auto; font-size:8px; font-weight:700; color:var(--theme-muted); }
      .campaign-manager[open] > summary { border-bottom:1px solid var(--theme-line); }
      .campaign-manager-note { padding:6px 8px 3px; font-size:8px; line-height:1.35; color:var(--theme-muted); }
      .campaign-game-list { max-height:240px; overflow:auto; padding:2px 7px 6px; }
      .campaign-game-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; min-height:36px; padding:6px 0; }
      .campaign-game-row + .campaign-game-row { border-top:1px solid #242429; }
      .campaign-game-copy { min-width:0; }
      .campaign-game-name { overflow:hidden; color:var(--theme-text); font-size:10px; font-weight:800; text-overflow:ellipsis; white-space:nowrap; }
      .campaign-game-meta { margin-top:2px; color:var(--theme-muted); font-size:8px; line-height:1.3; }
      .campaign-ignore-check { position:relative; box-sizing:border-box; width:22px; height:22px; padding:0; border:1px solid var(--theme-line); border-radius:6px; background:var(--theme-panel); color:var(--theme-text); cursor:pointer; }
      .campaign-ignore-check::after { content:""; position:absolute; inset:4px; border-radius:3px; background:transparent; }
      .campaign-ignore-check[aria-checked="true"] { border-color:var(--theme-accent); background:color-mix(in srgb,var(--theme-panel) 70%,var(--theme-accent) 30%); }
      .campaign-ignore-check[aria-checked="true"]::after { content:"✓"; display:grid; place-items:center; inset:0; background:transparent; color:var(--theme-text); font-size:13px; font-weight:900; }
      .campaign-ignore-check:focus-visible { outline:2px solid var(--theme-accent2); outline-offset:2px; }
      .inventory-head { padding:7px 8px; border-bottom:1px solid #2a2a30; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .inventory-head strong { font-size:11px; }
      .inventory-head span { font-size:9px; color:#adadb8; }
      .inventory-list { padding:3px 7px 6px; }
      .inventory-item { display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:7px; align-items:center; padding:6px 0; }
      .inventory-item + .inventory-item { border-top:1px solid #242429; }
      .reward-thumb { width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg,#9147ff,#5c16c5); display:grid; place-items:center; font-size:9px; font-weight:900; color:#fff; }
      .reward-copy { min-width:0; }
      .reward-name { font-size:10px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .reward-meta { margin-top:1px; font-size:8px; color:#adadb8; }
      .reward-state { font-size:8px; font-weight:800; color:#bf94ff; white-space:nowrap; }
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
        font-size:10px;
        white-space:nowrap;
      }
      .queue-summary-head span:not(.queue-summary-chevron) {
        min-width:0;
        color:var(--theme-muted);
        font-size:8px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .queue-summary-chevron {
        flex:0 0 auto;
        color:var(--theme-muted);
        font-size:11px;
        transition:.15s transform;
      }
      .queue-collapsible[open] .queue-summary-chevron {
        transform:rotate(90deg);
      }
      .queue-collapsible[open] .inventory-list {
        border-top:1px solid var(--theme-line);
      }
      .diag { display:none; box-sizing:border-box;width:100%;min-width:0;height:160px;max-height:160px;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;box-shadow:inset 0 2px 6px #0006; margin-top:6px; padding:7px; border:1px solid #2b2b31; border-radius:7px; background:#101014; font:9px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; color:#b8b8c0; white-space:pre-wrap; }
      .diag.open { display:block; }
      .has-tooltip { position:relative; }
      .has-tooltip::after { content:attr(data-tip); position:absolute; left:0; top:calc(100% + 4px); width:min(190px, calc(100vw - 48px)); max-width:100%; padding:6px 8px; border:1px solid #3b3b44; border-radius:7px; background:#0e0e10; color:#efeff1; box-shadow:0 6px 18px #0007; box-sizing:border-box; font-size:10px; line-height:1.35; white-space:normal; overflow-wrap:anywhere; opacity:0; pointer-events:none; z-index:999; transform:translateY(-2px); transition:.12s opacity,.12s transform; }
      .has-tooltip:hover::after, .has-tooltip:focus-visible::after { opacity:1; transform:translateY(0); }
      .reduce-motion *, .reduce-motion *::before, .reduce-motion *::after { animation:none !important; transition:none !important; }
      @media (max-width:700px) {
        .badge-row { width:100%; }
        #tdh-drop-card { flex:1 1 auto; width:auto; min-width:0; max-width:none; }
      }
    `;
  }

  function dropperGemSvg(className) {
    return `<svg class="${className}" viewBox="0 0 1024 1024" aria-hidden="true"><polygon points="494,210 285,500 430,590" fill="#D9B5FF"/><polygon points="494,210 430,590 494,470" fill="#9B5AF9"/><polygon points="285,500 285,685 430,590" fill="#8C39F2"/><polygon points="285,685 494,842 430,590" fill="#5417B3"/><polygon points="430,590 494,470 494,842" fill="#7428E8"/><polygon points="530,210 739,500 594,590" fill="#AEB0C2"/><polygon points="530,210 594,590 530,470" fill="#6A6E87"/><polygon points="739,500 739,685 594,590" fill="#4E5268"/><polygon points="739,685 530,842 594,590" fill="#242633"/><polygon points="594,590 530,470 530,842" fill="#3F4254"/><rect x="502" y="205" width="20" height="650" rx="10" fill="#101017"/></svg>`;
  }

  function mountUi() {
    if (ui) return ui;
    const host = document.createElement("div");
    host.id = "tdh-root";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${css()}</style>
      <div class="cluster" id="tdh-cluster">
        <aside id="tdh-tools-dock" role="region" aria-labelledby="tdh-rail-title">
          <div class="menu-head">
            <div class="header-brand">
              <div class="header-icon" aria-hidden="true">
                ${dropperGemSvg("menu-icon")}
              </div>
              <div class="header-copy">
                <div class="header-title-row">
                  <h2 id="tdh-rail-title">Dropper</h2>
                  <button type="button" id="tdh-header-version" aria-label="View Dropper v${APP_VERSION} Changelog" title="View Changelog">v${APP_VERSION}</button>
                </div>
                <div id="tdh-rail-subtitle">Twitch Drops: Track and Redeem</div>
              </div>
            </div>
            <button type="button" id="tdh-rail-close" aria-label="Close">×</button>
          </div>
          <div class="header-divider"></div>
          <div class="toast" id="tdh-toast" hidden></div>
          <div class="update-notice" id="tdh-update-notice" hidden>
            <button type="button" class="update-dismiss" id="tdh-update-dismiss" aria-label="Dismiss Update Notice">×</button>
            <div class="update-head">
              <div class="update-heading">
                <div class="update-kicker" id="tdh-update-kicker">What's New</div>
                <div class="update-title" id="tdh-update-title"></div>
              </div>
              <div class="update-version" id="tdh-update-version"></div>
            </div>
            <div class="update-text" id="tdh-update-text"></div>
            <ul class="update-list" id="tdh-update-list"></ul>
            <div class="update-footer">
              <button type="button" class="update-release" id="tdh-update-release">GitHub Release</button>
              <a class="update-action" id="tdh-update-action" href="#" target="_blank" rel="noopener noreferrer" role="button">View Update</a>
            </div>
          </div>
          <div class="badge-only-progress-slot" id="tdh-badge-only-progress-slot" aria-label="Drop progress" hidden></div>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-drops-body"><span class="fl-tool-title">Drops</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-drops-body">
            ${switchHtml("tdh-claim-drops", "Auto-Claim Drops", "", settings.claimDrops)}
            ${switchHtml("tdh-claim-bonus", "Auto-Claim Bonus Chests", "Attempts Free Bonus Claims. A Click Is Not Counted As Confirmation.", settings.claimBonus)}
            ${switchHtml("tdh-keep-tab", "Keep Screen Awake", "Requests A Screen Wake Lock During Actual Playback. Does Not Override Visibility Or Pauses.", settings.keepTabActive)}
            ${switchHtml("tdh-hide-sub-promos", "Hide Twitch Subscribe Promos", "", settings.hideTwitchSubscriptionPromos)}
            <div class="auth-required" id="tdh-auth-required" hidden>
              <span>Twitch Login Required</span>
              <button type="button" class="life-btn" id="tdh-twitch-login">Open Twitch Login</button>
            </div>
            <details class="campaign-manager" id="tdh-open-campaigns">
              <summary><span class="campaign-manager-title">Open Campaigns</span><span class="campaign-manager-summary" id="tdh-open-campaign-summary">Loading…</span></summary>
              <div class="campaign-manager-note">Check a game to ignore it until its latest campaign ends. Priorities order recommendations without changing your selected stream.</div>
              <div class="campaign-game-list" id="tdh-open-campaign-list"></div>
            </details>
            <div class="campaign-manager-note" id="tdh-reward-eligibility" role="status">Eligibility Not Verified</div>
            <button type="button" class="life-btn" id="tdh-toggle-inventory">Show Drops Inventory</button>
            <div class="compact-inventory" id="tdh-compact-inventory"><div class="inventory-head"><div><strong>Campaign Drops</strong><span id="tdh-inventory-game"></span></div></div><div class="inventory-list" id="tdh-inventory-list"></div></div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-streams-body"><span class="fl-tool-title">Streams</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-streams-body">
            <div class="stream-subsection-label">Current Stream</div>
            <div class="campaign-manager-note" id="tdh-viewing-status" role="status"></div>
            <div class="action-pair"><button type="button" class="life-btn" id="tdh-resume-playback">Resume Playback</button><button type="button" class="life-btn" id="tdh-allow-switching">Use Automatic Switching</button></div>
            ${switchHtml("tdh-find-next", "Automatic Stream Switching", "Uses Eligible Alternatives Only When You Permit Switching. Manual Selections And Pauses Stay Protected.", settings.findNextStream)}
            ${switchHtml("tdh-mute-next", "Mute Opened Streams", "Mutes Streams Dropper Opens Or Switches To, Including Same-Tab Routing.", settings.muteRestarted)}
            ${switchHtml("tdh-background-earning", "Background Progress Tracking", "Reports Actual Twitch Credit In Hidden Tabs Or Picture-in-Picture. Does Not Simulate Viewing.", settings.backgroundEarning)}
            <div class="mini-row"><span>Pause Auto-Switch</span><select class="select-lite" id="tdh-pause-switch"><option value="0">Off</option><option value="30">30 Min</option><option value="60">1 Hour</option><option value="120">2 Hours</option><option value="240">4 Hours</option><option value="480">8 Hours</option><option value="720">12 Hours</option><option value="1440">24 Hours</option></select></div>
            ${switchHtml("tdh-notifications", "Status Toasts", "Shows brief in-app Dropper messages for stream switches, campaign changes, and completed Drops.", settings.notifications)}
            <div class="stream-subsection-label with-divider">Routing & Backup</div>
            ${switchHtml("tdh-queue-enabled", "Maintain Backup Streams", "Keeps A Short List Of Eligible Backup Drops Channels Ready.", settings.queueEnabled)}
            <div class="mini-row"><span>Standby Streams</span><select class="select-lite" id="tdh-queue-count"><option value="1">1</option><option value="3">3</option><option value="5">5</option></select></div>
            <div class="queue-switches">
              <div class="queue-switches-label">Skip On</div>
              ${switchHtml("tdh-queue-stall", "Stall", "Switches The Current Tab When Credited Progress Stalls.", settings.queueOnStall)}
              ${switchHtml("tdh-queue-offline", "Offline", "Switches The Current Tab When The Active Stream Goes Offline.", settings.queueOnOffline)}
              ${switchHtml("tdh-queue-category", "Category Change", "Finds A Replacement Stream If The Current Channel Changes Away From The Active Drop Game.", settings.queueOnCategoryChange)}
            </div>
            <div class="mini-row"><span>Channel Preference</span><select class="select-lite" id="tdh-queue-preference"><option>Any Eligible</option><option>Lowest Viewers</option><option>Highest Viewers</option></select></div>
            <details class="queue-collapsible" id="tdh-queue-details">
              <summary class="queue-summary-head">
                <div><strong>Active + Standby</strong><span id="tdh-queue-summary"></span></div>
                <span class="queue-summary-chevron" aria-hidden="true">▸</span>
              </summary>
              <div class="inventory-list" id="tdh-queue-list"></div>
            </details>
            <button type="button" class="life-btn" id="tdh-clear-skipped-streamers" data-help="Clears The Temporary Streamer Rotation And Immediately Retries Discovery When Waiting.">Clear Skipped Streamers</button>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-progress-body"><span class="fl-tool-title">Appearance</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-progress-body">
            ${switchHtml("tdh-progress-title", "Show Progress In Tab", "", settings.progressInTitle)}
            ${switchHtml("tdh-badge-only", "Badge Only", "Keeps Only The Dropper Badge On The Page And Shows Progress At The Top Of The Drops Menu.", settings.badgeOnly)}
            ${switchHtml("tdh-reduce-motion", "Reduce Motion", "", settings.reduceMotion)}
            <hr class="appearance-separator">
            ${themeSwatchesHtml()}
            <div class="mini-row"><span>Panel + Menu Width</span><select class="select-lite" id="tdh-collapsed-width"><option value="full">Full</option><option value="compact">Compact</option><option value="narrow">Narrow</option></select></div>
            ${switchHtml("tdh-custom-opacity", "Custom Opacity", "Makes Dropper panels translucent while keeping the launcher fully visible.", settings.customOpacity)}
            <div class="opacity-row" id="tdh-opacity-row"${settings.customOpacity ? "" : " hidden"}>
              <span id="tdh-opacity-label">Opacity</span>
              <input id="tdh-opacity-range" type="range" min="40" max="100" step="5" value="${normalizedOpacityPercent()}" aria-labelledby="tdh-opacity-label" aria-valuemin="40" aria-valuemax="100" aria-valuenow="${normalizedOpacityPercent()}" aria-valuetext="${normalizedOpacityPercent()}%">
              <output id="tdh-opacity-value" for="tdh-opacity-range">${normalizedOpacityPercent()}%</output>
            </div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-diagnostics-body"><span class="fl-tool-title">System</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-diagnostics-body">
            <div class="action-pair"><button type="button" class="life-btn" id="tdh-diagnostics-toggle">Show Diagnostics</button>
            <button type="button" class="life-btn" id="tdh-copy-diagnostics">Copy Diagnostics</button></div>
            <hr class="action-separator">
            <button type="button" class="life-btn" id="tdh-refresh-campaign-data">Refresh Campaign Data</button>
            <button type="button" class="life-btn" id="tdh-clear-activity">Clear Activity Log</button>
            <div class="action-pair"><button type="button" class="life-btn" id="tdh-refresh-now">Refresh Drop State</button>
            <button type="button" class="life-btn" id="tdh-reset-session">Reset Session State</button></div>
            <details class="campaign-manager" id="tdh-claim-history-panel"><summary>Claim History</summary><pre id="tdh-claim-history" class="campaign-manager-note" style="white-space:pre-wrap;overflow-wrap:anywhere">No claim attempts recorded for this account.</pre></details>
            <div class="campaign-manager-note" id="tdh-support-note">Donations are optional and support continued development. All features remain available without donating, and donations do not change your license rights.</div>
            <div class="diag" id="tdh-diagnostics" role="region" aria-label="Site and plugin diagnostics" tabindex="0"></div>
          </div></section>
        </aside>
        <div class="progress-stack">
          <div class="badge-row">
          <section id="tdh-drop-card" aria-live="polite">
            <div class="expanded-content">
              <div class="stream-info" id="tdh-stream-info">
                <div class="progress-copy">
                  <div class="progress-head">
                    <div class="stream-channel" id="tdh-stream-channel">Finding Stream…</div>
                    <div class="drop-percent" id="tdh-drop-percent">0%</div>
                  </div>
                  <div class="progress-category"><span class="stream-game" id="tdh-stream-game">Waiting For Category</span></div>
                  <div class="drop-bar"><span id="tdh-drop-fill"></span></div>
                  <div class="progress-reward-row">
                    <span class="drop-meta" id="tdh-drop-meta">0 / 0 min</span>
                    <span class="progress-dot">•</span>
                    <span class="drop-name" id="tdh-drop-name">Waiting For Drop</span>
                  </div>
                  <div class="drop-status-row">
                    <div class="status-meta-chip">
                      <span class="state-pill" id="tdh-drop-state">Idle</span>
                      <span class="status-chip-divider" aria-hidden="true"></span>
                      <svg class="status-clock-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"></circle><path d="M8 4.5v3.8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                      <span id="tdh-updated-ago">Checked —</span>
                    </div>
                    <button type="button" class="skip-streamer-chip" id="tdh-skip-streamer" aria-label="No active streamer to skip">
                      <svg class="skip-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.25 2.5 7.4 8l-5.15 5.5V2.5Zm6.1 0L13.5 8l-5.15 5.5V2.5Z"></path></svg>
                      <span class="skip-label">Skip</span>
                      <span class="skip-countdown" hidden></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <button type="button" id="tdh-settings-launcher" aria-controls="tdh-tools-dock" aria-expanded="false" aria-label="Open Dropper Settings" data-userscript-launcher="userscript-launcher-v1" data-launcher-id="dropper" data-launcher-preferred-position="right-bottom">
            <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><path class="track" d="M18 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3H18Z"></path><path class="fill" id="tdh-ring" d="M18 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3H18Z" pathLength="100" stroke-dasharray="0 100"></path></svg>
            ${dropperGemSvg("icon")}
          </button>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(host);
    registerBadgeGrid(host, "dropper", 90);
    ui = { host, shadow, cluster: shadow.getElementById("tdh-cluster"), launcher: shadow.getElementById("tdh-settings-launcher"), dock: shadow.getElementById("tdh-tools-dock") };
    // Text wrapping, width transitions, and nested panels can change the menu
    // after the initial layout. Coalesce resize work without another poll loop.
    let chromeLayoutFrame = 0;
    const chromeResizeObserver = new ResizeObserver(() => {
      if (!host.isConnected || ui?.host !== host) {
        cancelAnimationFrame(chromeLayoutFrame);
        chromeResizeObserver.disconnect();
        return;
      }
      if (chromeLayoutFrame) return;
      chromeLayoutFrame = requestAnimationFrame(() => {
        chromeLayoutFrame = 0;
        if (host.isConnected && ui?.host === host) layoutChrome();
      });
    });
    chromeResizeObserver.observe(ui.dock);
    chromeResizeObserver.observe(shadow.querySelector(".badge-row"));
    const updateNotice = shadow.getElementById("tdh-update-notice");
    if (updateNotice) {
      updateNotice.dataset.placement = "menu";
      delete updateNotice.dataset.expFloatingNotice;
      ui.cluster.append(updateNotice);
      new ResizeObserver(() => requestAnimationFrame(positionMenuUpdateNotice)).observe(updateNotice);
      new MutationObserver(() => requestAnimationFrame(positionMenuUpdateNotice)).observe(updateNotice,{attributes:true,attributeFilter:["hidden","class"]});
    }
    bindDrag();
    bindSwitches();
    bindPanels();
    bindMenuInactivity();
    bindDropperControls();
    renderSwitches();
    applyMotionSetting();
    applyAppearanceSettings();
    syncProgressSurfaces();
    refreshDropCard();
    refreshQueueList();
    watchChatWidth();
    syncDropperWidthToChat();
    layoutChrome();
    ui.launcher.addEventListener("click", () => setRailOpen(!railOpen));
    shadow.getElementById("tdh-header-version")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!railOpen) setRailOpen(true);
      showCurrentChangelog();
      scheduleMenuDismiss();
    });
    shadow.getElementById("tdh-rail-close").addEventListener("click", () => setRailOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.altKey && (event.key === "g" || event.key === "G") && !event.repeat) { event.preventDefault(); setRailOpen(!railOpen, true); }
      if (event.key === "Escape" && railOpen) setRailOpen(false, true);
      if (!event.altKey && (event.key === "r" || event.key === "R") && railOpen) requestGqlPoll("keyboard-refresh", true);
    });
    document.addEventListener("pointerdown", (event) => { if (railOpen && !event.composedPath().includes(host)) setRailOpen(false); });
    return ui;
  }


  function formatUptime(value) {
    const match = String(value || "").match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!match) return value || "";
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function isTrustedTwitchUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      const host = parsed.hostname.toLowerCase();
      return parsed.protocol === "https:" && (host === "twitch.tv" || host === "www.twitch.tv" || host === "player.twitch.tv" || host === "embed.twitch.tv" || host.endsWith(".twitch.tv"));
    } catch (_) {
      return false;
    }
  }

  function skipStreamerArmSnapshot(now = Date.now()) {
    const login = cleanText(skipStreamerArm?.login).toLowerCase();
    const expiresAt = Number(skipStreamerArm?.expiresAt || 0);
    if (!login || !expiresAt || expiresAt <= now) return null;
    return {
      login,
      expiresAt,
      remainingMs: Math.max(0, expiresAt - now),
      remainingSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
    };
  }

  function clearSkipStreamerArm(reason = "", log = false) {
    clearTimeout(skipStreamerArmTimer);
    skipStreamerArmTimer = null;
    const previous = skipStreamerArmSnapshot();
    skipStreamerArm = { login: "", expiresAt: 0 };
    if (log && previous) {
      logActivity("stream-skip-arm", "Canceled armed streamer skip", {
        reason: reason || null,
        stream: previous.login,
      });
    }
    renderSkipStreamerControl();
    return Boolean(previous);
  }

  function renderSkipStreamerControl(now = Date.now()) {
    const button = ui?.shadow?.getElementById("tdh-skip-streamer");
    if (!button) return;

    const active = cleanText(watchingLogin()).toLowerCase();
    const canSkip = Boolean(currentDrop && active);
    let armed = skipStreamerArmSnapshot(now);

    if (armed && (!canSkip || armed.login !== active)) {
      clearTimeout(skipStreamerArmTimer);
      skipStreamerArmTimer = null;
      skipStreamerArm = { login: "", expiresAt: 0 };
      armed = null;
    }

    const label = button.querySelector(".skip-label");
    const countdown = button.querySelector(".skip-countdown");
    button.disabled = !canSkip;
    button.setAttribute("aria-disabled", String(!canSkip));
    button.classList.toggle("is-armed", Boolean(armed));

    if (armed) {
      const displayLogin = active || armed.login;
      if (label) label.textContent = "Confirm";
      if (countdown) {
        countdown.hidden = false;
        countdown.textContent = `${armed.remainingSeconds}s`;
      }
      button.title = `Click again within ${armed.remainingSeconds}s to skip ${displayLogin}`;
      button.setAttribute("aria-label", `Confirm skip ${displayLogin}, ${armed.remainingSeconds} seconds remaining`);
      return;
    }

    if (label) label.textContent = "Skip";
    if (countdown) {
      countdown.hidden = true;
      countdown.textContent = "";
    }
    button.title = canSkip
      ? `Arm skip for ${active}; click again within 3 seconds to confirm`
      : "No active streamer to skip";
    button.setAttribute("aria-label", canSkip ? `Arm skip streamer ${active}` : "No active streamer to skip");
  }

  function scheduleSkipStreamerArmTick() {
    clearTimeout(skipStreamerArmTimer);
    skipStreamerArmTimer = null;
    const armed = skipStreamerArmSnapshot();
    if (!armed) {
      skipStreamerArm = { login: "", expiresAt: 0 };
      renderSkipStreamerControl();
      return;
    }
    renderSkipStreamerControl();
    skipStreamerArmTimer = setTimeout(
      scheduleSkipStreamerArmTick,
      Math.min(SKIP_STREAMER_ARM_TICK_MS, Math.max(40, armed.remainingMs + 10)),
    );
  }

  function armSkipCurrentStreamer() {
    const active = cleanText(watchingLogin()).toLowerCase();
    if (!active || !currentDrop) {
      clearSkipStreamerArm();
      setStatus("No Active Stream To Skip");
      notifyUser("No Active Stream To Skip");
      return false;
    }

    skipStreamerArm = {
      login: active,
      expiresAt: Date.now() + SKIP_STREAMER_ARM_MS,
    };
    logActivity("stream-skip-arm", "Armed streamer skip confirmation", {
      stream: active,
      confirmSeconds: Math.round(SKIP_STREAMER_ARM_MS / 1000),
    });
    scheduleSkipStreamerArmTick();
    return true;
  }

  function handleSkipStreamerClick() {
    const active = cleanText(watchingLogin()).toLowerCase();
    const armed = skipStreamerArmSnapshot();

    if (armed && active && armed.login === active) {
      clearSkipStreamerArm();
      return skipCurrentStreamer();
    }

    clearSkipStreamerArm();
    return armSkipCurrentStreamer();
  }

  function skipCurrentStreamer() {
    explicitViewingNavigationUntil = Date.now() + 15000;
    clearSkipStreamerArm();
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("manual-stream-skip");
      return false;
    }

    const active = cleanText(watchingLogin()).toLowerCase();
    if (!active || !currentDrop) {
      setStatus("No Active Stream To Skip");
      notifyUser("No Active Stream To Skip");
      return false;
    }

    const session = readRoutingControllerSession();
    transitionRoutingController(
      ROUTING_STATES.FIND_STREAM,
      {
        ...routingControllerTargetFromDrop(currentDrop),
        targetStream: "",
        failedStreams: routingControllerAddFailedStream(session, active),
        candidateEvidence: null,
        mismatchSince: 0,
        offlineSince: 0,
        deadlineAt: 0,
        waitReason: "",
      },
      `Manual stream skip · ${active}`,
    );

    lastStreamVerification = null;
    streamVerificationState = null;
    logActivity("stream-skip", "Skipped current streamer", {
      from: active,
      game: currentDrop.game || null,
      campaign: currentDrop.campaign || null,
    });
    setStatus(`Skipping ${active} · Returning To ${currentDrop.game || "Target"} Category`);
    routingControllerTick(Date.now(), "manual-stream-skip");
    return true;
  }

  function pruneStandbyCache(now = Date.now()) {
    const source = Array.isArray(standbyCache) ? standbyCache : [];
    standbyCache = source.filter((item) => {
      if (
        !item ||
        !item.login ||
        Number(item.seenAt || 0) <= now - STANDBY_CACHE_TTL_MS ||
        campaignMarkedComplete(item.campaignKey || "")
      ) return false;

      const explicitState = campaignRoutingState({
        campaignKey: item.campaignKey || "",
        startAt: item.campaignStartAt || "",
        endAt: item.campaignEndAt || "",
        status: item.campaignStatus || "",
        game: item.game || "",
      }, now);
      if (explicitState.windowKnown) return explicitState.open;

      const memoryState = campaignMemoryRoutingState(item.campaignKey || "", now);
      return memoryState.open;
    }).slice(-60);
    writeSession(STANDBY_CACHE_KEY, standbyCache);
    return standbyCache;
  }
  function rememberStandbyCandidates(candidates, context = {}) {
    if (!Array.isArray(candidates) || !candidates.length) return;
    const now = Date.now();
    const existing = pruneStandbyCache(now);
    const byLogin = new Map(existing.map((item) => [item.login, item]));

    for (const candidate of candidates) {
      const login = cleanText(candidate?.login).toLowerCase();
      const href = twitchChannelHref(candidate?.href);
      if (!login || !href) continue;
      byLogin.set(login, {
        ...(byLogin.get(login) || {}),
        login,
        href,
        label: cleanText(candidate.label || login),
        viewers: streamViewerCount(candidate.viewers),
        dropsTagged: Boolean(candidate.dropsTagged),
        game: cleanText(context.game || candidate.game || ""),
        gameSlug: cleanText(context.gameSlug || candidate.gameSlug || ""),
        campaignKey: cleanText(context.campaignKey || candidate.campaignKey || ""),
        campaignStartAt: cleanText(context.campaignStartAt || candidate.campaignStartAt || currentDrop?.campaignStartAt || ""),
        campaignEndAt: cleanText(context.campaignEndAt || candidate.campaignEndAt || currentDrop?.campaignEndAt || ""),
        campaignStatus: cleanText(context.campaignStatus || candidate.campaignStatus || "ACTIVE"),
        seenAt: now,
      });
    }

    standbyCache = [...byLogin.values()]
      .sort((a, b) => Number(a.seenAt || 0) - Number(b.seenAt || 0))
      .slice(-60);
    writeSession(STANDBY_CACHE_KEY, standbyCache);
    lastStandbyRefreshAt = now;
    writeSession(STANDBY_REFRESH_KEY, lastStandbyRefreshAt);
  }

  function cachedStandbyCandidates(gameName = currentDrop?.game || "", campaignKeyValue = currentDrop?.campaignKey || "") {
    const active = cleanText(watchingLogin()).toLowerCase();
    const failed = routingControllerFailedSet(readRoutingControllerSession());
    const wantedGame = normalizeGameName(gameName);
    const wantedCampaign = cleanText(campaignKeyValue);
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const allowListPresent = allowedLogins.size > 0;

    const items = pruneStandbyCache().filter((item) => {
      const login = cleanText(item?.login).toLowerCase();
      if (!login || login === active || failed.has(login)) return false;
      if (wantedGame && (!item.game || !gameNamesMatch(wantedGame, item.game))) return false;
      if (wantedCampaign && item.campaignKey !== wantedCampaign) return false;
      if (allowListPresent && !allowedLogins.has(login)) return false;
      return true;
    }).map((item) => ({
      ...item,
      allowListMatch: allowListPresent
        ? allowedLogins.has(cleanText(item.login).toLowerCase())
        : Boolean(item.allowListMatch),
    }));

    const ranked = sortStreamCandidates(items, (left, right) => Number(right.seenAt || 0) - Number(left.seenAt || 0));
    return ranked;
  }

  function refreshStandbyCampaignCache(now = Date.now()) {
    const routing = readRoutingControllerSession();
    const targetGame = routing.targetGame || currentDrop?.game || "";
    const targetCampaignKey = routing.targetCampaignKey || currentDrop?.campaignKey || "";
    pruneStandbyCache(now);
    if (targetCampaignKey) {
      standbyCache = standbyCache.filter((item) => item.campaignKey === targetCampaignKey);
      writeSession(STANDBY_CACHE_KEY, standbyCache);
    }
    lastStandbyRefreshAt = now;
    writeSession(STANDBY_REFRESH_KEY, now);
    queueGqlPollSoon("standby-refresh", 0);
    logActivity("standby-refresh", "Refreshed standby streams for active campaign", {
      campaignKey: targetCampaignKey || null,
      game: targetGame || null,
      candidates: cachedStandbyCandidates(targetGame, targetCampaignKey).length,
      intervalMinutes: Math.round(STANDBY_REFRESH_INTERVAL_MS / 60000),
    });
  }

  function discoverQueueCandidates(now = Date.now()) {
    const seen = new Set();
    const items = [];
    const active = cleanText(watchingLogin()).toLowerCase();
    const routing = readRoutingControllerSession();
    const failed = routingControllerFailedSet(routing);
    const targetGame = routing.targetGame || currentDrop?.game || "";
    const targetCampaignKey = cleanText(routing.targetCampaignKey || currentDrop?.campaignKey || "");
    const targetCampaignName = routing.targetCampaign || currentDrop?.campaign || "";
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const allowListPresent = allowedLogins.size > 0;
    const targetSlug = resolveCategorySlug({
      game: targetGame,
      gameSlug: routing.targetSlug || currentDrop?.gameSlug || "",
    });

    const add = (href, label = "", metadata = {}) => {
      const channelHref = twitchChannelHref(href);
      if (!channelHref) return;
      try {
        const parsed = new URL(channelHref);
        const login = cleanText(parsed.pathname.split("/").filter(Boolean)[0]).toLowerCase();
        if (
          !login ||
          login.length < 2 ||
          seen.has(login) ||
          login === active ||
          failed.has(login) ||
          metadata.routable === false
        ) return;

        const cleanLabel = cleanText(label) || login;
        const candidateGame = cleanText(metadata.game || "");
        const candidateCampaignKey = cleanText(metadata.campaignKey || "");
        const allowListMatch = Boolean(login && allowedLogins.has(login));
        if (allowListPresent && !allowListMatch) return;
        if (targetGame && (!candidateGame || !gameNamesMatch(targetGame, candidateGame))) return;
        if (targetCampaignKey && candidateCampaignKey && candidateCampaignKey !== targetCampaignKey) return;

        seen.add(login);
        const viewerMatch = cleanLabel.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
        const viewers = metadata.viewers != null
          ? streamViewerCount(metadata.viewers)
          : (viewerMatch ? streamViewerCount(viewerMatch[1].replace(/,/g, "")) : null);
        const seenAt = Number(metadata.seenAt || now);
        const availability = metadata.availability || "cached";
        items.push({
          login,
          href: channelHref,
          label: metadata.label || cleanLabel || login,
          viewers,
          dropsTagged: Boolean(metadata.dropsTagged),
          allowListMatch: allowListPresent ? allowListMatch : Boolean(metadata.allowListMatch),
          game: candidateGame,
          campaignKey: candidateCampaignKey || targetCampaignKey,
          source: metadata.source || "cache",
          availability,
          seenAt,
          cacheAgeSeconds: availability === "live" ? 0 : Math.max(0, Math.floor((now - seenAt) / 1000)),
          freshCached: availability !== "live" && now - seenAt <= STANDBY_LIVE_FRESH_MS,
        });
      } catch (_) { /* ignore */ }
    };

    const onTargetCategory = Boolean(
      isDirectoryCategoryPage() &&
      targetSlug &&
      currentDirectorySlug() === targetSlug
    );

    if (onTargetCategory) {
      const snapshot = classifyRoutingCandidates(targetGame, targetSlug, routing, now);
      snapshot.candidates.forEach((item) =>
        add(item.href, item.label, {
          ...item,
          campaignKey: targetCampaignKey,
          source: item.source || "category-card",
          availability: "live",
          seenAt: now,
        })
      );
    }

    document.querySelectorAll(
      "[data-test-selector='DropsCampaignInProgressDescription-hint-text-parent'] a, " +
      "[data-test-selector='DropsCampaignInProgressDescription-no-channels-hint-text'] a"
    ).forEach((node) => {
      const cardText = cleanText(node.closest('[data-test-selector*="DropsCampaign"], [class*="drops-campaign"]')?.textContent || "");
      const matchesTarget = Boolean(
        (targetCampaignName && normalizeGameName(cardText).includes(normalizeGameName(targetCampaignName))) ||
        (targetGame && normalizeGameName(cardText).includes(normalizeGameName(targetGame)))
      );
      if (matchesTarget) {
        add(node.href, node.textContent, {
          dropsTagged: true,
          game: targetGame,
          campaignKey: targetCampaignKey,
          source: "campaign-hint",
          availability: "campaign-hint",
          seenAt: now,
        });
      }
    });

    cachedStandbyCandidates(targetGame, targetCampaignKey).forEach((item) =>
      add(item.href, item.label, {
        ...item,
        source: "cache",
        availability: "cached",
      })
    );

    const availabilityRank = (item) => {
      if (item.availability === "live") return 0;
      if (item.availability === "campaign-hint") return 1;
      if (item.freshCached) return 2;
      return 3;
    };

    items.sort((a, b) => {
      const availabilityDiff = availabilityRank(a) - availabilityRank(b);
      if (availabilityDiff) return availabilityDiff;
      if (Boolean(b.allowListMatch) !== Boolean(a.allowListMatch)) return Number(Boolean(b.allowListMatch)) - Number(Boolean(a.allowListMatch));
      if (Boolean(b.dropsTagged) !== Boolean(a.dropsTagged)) return Number(Boolean(b.dropsTagged)) - Number(Boolean(a.dropsTagged));
      if (settings.queuePreference === "Lowest Viewers") return compareKnownViewerCounts(a, b, false);
      if (settings.queuePreference === "Highest Viewers") return compareKnownViewerCounts(a, b, true);
      return Number(b.seenAt || 0) - Number(a.seenAt || 0);
    });

    return items.slice(0, Number(settings.queueCount) || 3);
  }

  function refreshQueueList() {
    lastQueueRefreshAt = Date.now();
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-queue-list");
    const summary = ui.shadow.getElementById("tdh-queue-summary");
    if (!list) return;
    list.replaceChildren();
    const active = watchingLogin();
    if (active) appendQueueItem(
      list,
      active,
      "Active",
      currentDrop ? (currentDrop.needsDropDetails ? "Details Pending" : `${currentDrop.percent || 0}%`) : "Watching",
      true,
    );
    const candidates = settings.queueEnabled ? discoverQueueCandidates() : [];
    candidates.forEach((item, index) => {
      const availability = item.availability === "live"
        ? "Live Now"
        : item.availability === "campaign-hint"
          ? "Campaign Hint"
          : item.freshCached
            ? `Cached ${item.cacheAgeSeconds}s`
            : `Cached ${Math.max(1, Math.ceil(item.cacheAgeSeconds / 60))}m`;
      const viewers = item.viewers != null ? ` · ${item.viewers} Viewers` : "";
      const proof = item.allowListMatch ? "Allowed" : item.dropsTagged ? "Drops" : "Standby";
      appendQueueItem(
        list,
        item.label,
        `Standby ${index + 1} · ${availability}${viewers}`,
        proof,
        false,
      );
    });
    if (!active && !candidates.length) appendQueueItem(list, "No Eligible Streams Found", "Open Drops Inventory To Discover Channels", "Idle", false);
    if (summary) {
      if (!settings.queueEnabled) {
        summary.textContent = " · Off";
      } else {
        const readyCount = (active ? 1 : 0) + candidates.length;
        summary.textContent = readyCount
          ? ` · ${readyCount} stream${readyCount === 1 ? "" : "s"} ready`
          : " · No streams ready";
      }
    }
  }

  function appendQueueItem(list, name, meta, state, active) {
    const row = document.createElement("div");
    row.className = `inventory-item${active ? " current" : ""}`;
    const thumb = document.createElement("div"); thumb.className = "reward-thumb"; thumb.textContent = active ? "▶" : "•";
    const copy = document.createElement("div"); copy.className = "reward-copy";
    const title = document.createElement("div"); title.className = "reward-name"; title.textContent = name;
    const sub = document.createElement("div"); sub.className = "reward-meta"; sub.textContent = meta;
    copy.append(title, sub);
    const badge = document.createElement("div"); badge.className = "reward-state"; badge.textContent = state;
    row.append(thumb, copy, badge); list.appendChild(row);
  }

  function renderCompactInventory() {
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-inventory-list");
    const game = ui.shadow.getElementById("tdh-inventory-game");
    if (!list) return;
    list.replaceChildren();
    if (game) game.textContent = currentDrop?.game ? ` · ${currentDrop.game}` : "";
    if (!currentDrop) {
      appendInventoryItem(list, "No Active Drop", "Waiting For Twitch", "Idle");
      return;
    }
    const current = Number(currentDrop.currentMinutes) || 0;
    const required = Number(currentDrop.requiredMinutes) || 0;
    const authoritativePercent = authoritativeProgressPercent();
    const state = currentDrop.needsDropDetails
      ? "Details Pending"
      : currentDrop.isClaimed
        ? "Claimed"
        : dropProgressComplete(currentDrop)
          ? "Claim Ready"
          : authoritativePercent == null ? "Progress Pending" : `${authoritativePercent}%`;
    appendInventoryItem(
      list,
      currentDrop.name || "Current Drop",
      currentDrop.needsDropDetails ? "Twitch Details Pending" : required ? `${current} / ${required} Min` : "Progress Pending",
      state,
    );
  }

  function refreshOpenCampaignList(now = Date.now()) {
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-open-campaign-list");
    const summary = ui.shadow.getElementById("tdh-open-campaign-summary");
    if (!list || !summary) return;

    const openGames = listOpenCampaignGames(openCampaignManagementPool(now), now);
    reconcileIgnoredCampaignGames(openGames, now);
    const ignoredCount = openGames.filter((item) => (
      Number(ignoredCampaignGames.games?.[item.key]?.expiresAt || 0) > now
    )).length;
    summary.textContent = openGames.length
      ? `${openGames.length} game${openGames.length === 1 ? "" : "s"}${ignoredCount ? ` · ${ignoredCount} ignored` : ""}`
      : "No open games";

    list.replaceChildren();
    if (!openGames.length) {
      const empty = document.createElement("div");
      empty.className = "campaign-manager-note";
      empty.textContent = lastGqlError
        ? "Campaign data is temporarily unavailable. Dropper will retry automatically."
        : "No dated open campaigns are available yet. Dropper will refresh this list automatically.";
      list.appendChild(empty);
      return;
    }

    for (const item of openGames) {
      const ignored = Number(ignoredCampaignGames.games?.[item.key]?.expiresAt || 0) > now;
      const row = document.createElement("div");
      row.className = "campaign-game-row";
      const copy = document.createElement("div");
      copy.className = "campaign-game-copy";
      const title = document.createElement("div");
      title.className = "campaign-game-name";
      title.textContent = item.game;
      const meta = document.createElement("div");
      meta.className = "campaign-game-meta";
      const campaignLabel = `${item.campaignCount} open campaign${item.campaignCount === 1 ? "" : "s"}`;
      meta.textContent = `${campaignLabel} · Latest ${formatCampaignEndLabel(item.latestEndAt, item.latestEndMs, now).toLowerCase()}`;
      copy.append(title, meta);
      const priorityRow = document.createElement('label');
      priorityRow.className = 'mini-row';
      const priorityLabel = document.createElement('span'); priorityLabel.textContent = 'Priority';
      const priority = document.createElement('select'); priority.className = 'select-lite';
      priority.setAttribute('aria-label', `${item.game} campaign priority`);
      for (const [value, label] of [[1, 'High'], [0, 'Normal'], [-1, 'Low']]) {
        const option = document.createElement('option'); option.value = String(value); option.textContent = label; priority.append(option);
      }
      priority.value = String(campaignPriority(item.game));
      priority.addEventListener('change', () => {
        setCampaignPriority(item.game, Number(priority.value));
        setStatus('Campaign Priority Saved · Your Stream Is Unchanged');
      });
      priorityRow.append(priorityLabel, priority); copy.append(priorityRow);

      const check = document.createElement("button");
      check.type = "button";
      check.className = "campaign-ignore-check";
      check.setAttribute("role", "checkbox");
      check.setAttribute("aria-checked", String(ignored));
      check.setAttribute(
        "aria-label",
        `${ignored ? "Stop ignoring" : "Ignore"} ${item.game} until ${new Date(item.latestEndMs).toLocaleString()}`,
      );
      check.title = ignored ? "Stop Ignoring This Game" : "Ignore This Game";
      check.addEventListener("click", () => {
        const nextIgnored = check.getAttribute("aria-checked") !== "true";
        if (!setCampaignGameIgnored(item.game, item.latestEndMs, nextIgnored)) return;
        logActivity(
          nextIgnored ? "campaign-game-ignored" : "campaign-game-restored",
          `${item.game} ${nextIgnored ? "ignored until its latest campaign ends" : "restored to campaign routing"}`,
          { game: item.game, expiresAt: nextIgnored ? new Date(item.latestEndMs).toISOString() : null },
        );

        if (nextIgnored && currentDrop && gameNamesMatch(currentDrop.game || "", item.game)) {
          clearStoredCurrentDrop();
          transitionRoutingController(
            ROUTING_STATES.SELECT_CAMPAIGN,
            { targetGame: "", targetCampaign: "", targetCampaignKey: "", targetDropId: "", targetStream: "", deadlineAt: 0 },
            `${item.game} ignored by user`,
          );
        } else if (!nextIgnored) {
          const routing = readRoutingControllerSession();
          if (routing.state === ROUTING_STATES.WAITING && routing.waitReason === "no-eligible-campaign") {
            transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, { deadlineAt: 0 }, `${item.game} restored by user`);
          }
        }

        refreshOpenCampaignList();
        queueGqlPollSoon("campaign-ignore-changed", 0);
        routingControllerTick(Date.now(), "campaign-ignore-changed");
      });
      row.append(copy, check);
      list.appendChild(row);
    }
  }

  function appendInventoryItem(list, name, meta, state) {
    const row = document.createElement("div"); row.className = "inventory-item current";
    const thumb = document.createElement("div"); thumb.className = "reward-thumb"; thumb.textContent = "◆";
    const copy = document.createElement("div"); copy.className = "reward-copy";
    const title = document.createElement("div"); title.className = "reward-name"; title.textContent = name;
    const sub = document.createElement("div"); sub.className = "reward-meta"; sub.textContent = meta;
    copy.append(title, sub);
    const badge = document.createElement("div"); badge.className = "reward-state"; badge.textContent = state;
    row.append(thumb, copy, badge); list.appendChild(row);
  }

  function applyProgressColor(percent) {
    if (!ui) return;
    const fill = ui.shadow.getElementById("tdh-drop-fill");
    const pct = ui.shadow.getElementById("tdh-drop-percent");
    const ring = ui.shadow.getElementById("tdh-ring");
    let main = "#dc2626", soft = "#fb7185";
    if (percent >= 90) { main = "#16a34a"; soft = "#4ade80"; }
    else if (percent >= 70) { main = "#65a30d"; soft = "#a3e635"; }
    else if (percent >= 50) { main = "#ca8a04"; soft = "#facc15"; }
    else if (percent >= 25) { main = "#ea580c"; soft = "#fb923c"; }
    const pride = ui.cluster?.dataset?.uiTheme === "pride";
    if (fill) fill.style.background = pride ? PRIDE_RAINBOW : `linear-gradient(90deg, ${main}, ${soft})`;
    if (pct) pct.style.color = pride ? "#d8dbe1" : soft;
    if (ring) ring.style.stroke = pride ? "#d97898" : main;
  }

  function currentStreamTimingSnapshot(now = Date.now()) {
    const routing = readRoutingControllerSession();
    const login = cleanText(watchingLogin()).toLowerCase();
    const target = cleanText(routing.targetStream).toLowerCase();
    const targetMatches = Boolean(login && (!target || login === target));

    let streamAnchorAt = 0;
    if (targetMatches) {
      if (routing.state === ROUTING_STATES.EARNING) {
        streamAnchorAt = Number(routing.earningStartedAt || routing.enteredAt || 0);
      } else if (
        routing.state === ROUTING_STATES.VERIFY_STREAM ||
        routing.state === ROUTING_STATES.OPEN_STREAM
      ) {
        streamAnchorAt = Number(routing.enteredAt || 0);
      }
    }

    const verificationAt = (
      lastStreamVerification &&
      login &&
      cleanText(lastStreamVerification.channel).toLowerCase() === login
    )
      ? Number(lastStreamVerification.at || 0)
      : 0;

    const creditedProgressAt = Number(lastProgressAt || 0);
    const effectiveAnchorAt = Math.max(streamAnchorAt, verificationAt, creditedProgressAt);

    // First-watch grace belongs to the routing/stream lifecycle. Routine GQL
    // session confirmations may refresh lastStreamVerification, but must not
    // restart the grace clock after the stream has already been established.
    const graceAnchorAt = streamAnchorAt || verificationAt;
    const graceAnchorSource = streamAnchorAt ? "routing-stream" : verificationAt ? "verification-fallback" : null;
    const graceRemainingMs = graceAnchorAt
      ? Math.max(0, FIRST_WATCH_CREDIT_GRACE_MS - (now - graceAnchorAt))
      : 0;

    return {
      routingState: routing.state,
      streamAnchorAt,
      verificationAt,
      creditedProgressAt,
      effectiveAnchorAt,
      effectiveProgressAgeMs: effectiveAnchorAt ? Math.max(0, now - effectiveAnchorAt) : 0,
      creditedProgressAgeMs: creditedProgressAt ? Math.max(0, now - creditedProgressAt) : 0,
      graceAnchorAt,
      graceAnchorSource,
      graceRemainingMs,
      inVerificationGrace: Boolean(graceRemainingMs > 0),
    };
  }

  function streamEarningHealthSnapshot() {
    const now = Date.now();
    const login = watchingLogin();
    const info = login ? readStreamInfo() : {
      live: false,
      game: "",
      dropsEnabled: false,
    };

    const domVideoPlaying = Boolean(login && streamVideoIsPlaying());

    const gameMatches = Boolean(
      currentDrop?.game &&
      info.game &&
      gameNamesMatch(currentDrop.game, info.game)
    );

    const verification = lastStreamVerification;
    const verificationProof = verification?.proof || {};
    const currentCampaignKey = cleanText(currentDrop?.campaignKey || currentDrop?.campaignId || "");
    const verifiedCampaignKey = cleanText(verification?.campaignKey || "");
    const routing = readRoutingControllerSession();
    const routingEvidence = routing.candidateEvidence || {};
    const routingCampaignKey = cleanText(routing.targetCampaignKey || "");
    const routingStreamMatches = Boolean(
      login &&
      routing.state === ROUTING_STATES.EARNING &&
      cleanText(routing.targetStream).toLowerCase() === cleanText(login).toLowerCase() &&
      (!currentCampaignKey || !routingCampaignKey || currentCampaignKey === routingCampaignKey)
    );
    const restoredRoutingProof = Boolean(
      routingStreamMatches &&
      (
        routingEvidence.gqlCampaignSupported ||
        routingEvidence.gqlSessionCampaignMatched ||
        routingEvidence.campaignAclMatched
      )
    );
    const campaignVerified = Boolean(
      (
        login &&
        verification &&
        cleanText(verification.channel).toLowerCase() === cleanText(login).toLowerCase() &&
        (!verification.game || !currentDrop?.game || gameNamesMatch(verification.game, currentDrop.game)) &&
        (!currentCampaignKey || !verifiedCampaignKey || currentCampaignKey === verifiedCampaignKey) &&
        (verificationProof.campaignSupported || verificationProof.progressConfirmed || verificationProof.sessionMatched)
      ) ||
      restoredRoutingProof
    );
    const timing = currentStreamTimingSnapshot(now);
    const creditedRecently = Boolean(
      campaignVerified &&
      Number(timing.creditedProgressAt || 0) > 0 &&
      Number(currentDrop?.currentMinutes || 0) > 0 &&
      timing.creditedProgressAgeMs <= UNHEALTHY_STREAM_DELAYED_MS
    );
    const earningVerified = Boolean(
      routingStreamMatches &&
      campaignVerified &&
      gameMatches
    );
    const healthy = Boolean(
      login &&
      currentDrop &&
      campaignVerified &&
      (
        (
          info.live &&
          domVideoPlaying &&
          gameMatches
        ) ||
        creditedRecently
      )
    );

    return {
      login: login || null,
      live: Boolean(info.live),
      domVideoPlaying,
      domVideoPlayingAuthoritative: false,
      creditedRecently,
      earningVerified,
      expectedGame: currentDrop?.game || null,
      streamGame: info.game || null,
      gameMatches,
      campaignVerified,
      restoredRoutingProof,
      dropsTagVisible: Boolean(info.dropsEnabled),
      healthy,
      routingState: timing.routingState,
      inVerificationGrace: timing.inVerificationGrace,
      graceAnchorAt: timing.graceAnchorAt,
      graceAnchorSource: timing.graceAnchorSource,
      graceRemainingMs: timing.graceRemainingMs,
      creditedProgressAgeMs: timing.creditedProgressAgeMs,
      progressAgeMs: timing.effectiveProgressAgeMs,
    };
  }

  function syncCompactState() {
    if (!ui) return;
    const reward = ui.shadow.getElementById("tdh-compact-reward");
    const extra = ui.shadow.getElementById("tdh-compact-extra");
    const state = ui.shadow.getElementById("tdh-compact-state");
    const detail = ui.shadow.getElementById("tdh-drop-state");
    const updated = ui.shadow.getElementById("tdh-updated-ago");
    const health = streamEarningHealthSnapshot();
    const staleMs = health.progressAgeMs;

    let label = "Idle", cls = "state-pill";
    const routing = readRoutingControllerSession();

    if (!getToken()) {
      label = "Login Required";
      cls += " warn";
    } else if (viewingIntent.snapshot().paused) {
      label = 'Paused';
      cls += ' warn';
    } else if (currentDrop?.needsDropDetails) {
      label = "Details Pending";
      cls += " warn";
    } else if (dropProgressComplete(currentDrop)) {
      label = currentDrop.isClaimed ? "Claimed ✓" : "Earned";
      cls += " good";
    } else if (routing.state === ROUTING_STATES.VERIFY_STREAM) {
      label = "Verifying";
      cls += " warn";
    } else if (routing.state === ROUTING_STATES.OPEN_STREAM) {
      label = "Opening";
      cls += " warn";
    } else if (routing.state === ROUTING_STATES.FIND_STREAM) {
      label = "Finding";
      cls += " warn";
    } else if (routing.state === ROUTING_STATES.WAITING) {
      label = "Waiting";
      cls += " warn";
    } else if (routing.state === ROUTING_STATES.EARNING && currentDrop) {
      if (health.inVerificationGrace) {
        label = settings.backgroundEarning ? "BG Earning" : "Earning";
        cls += " good";
      } else if (staleMs >= progressStallTimeoutMs(health.healthy)) {
        label = "Stalled";
        cls += " bad";
      } else if (health.healthy && staleMs >= HEALTHY_STREAM_DELAYED_MS) {
        label = "Delayed";
        cls += " warn";
      } else if (!health.healthy && staleMs >= UNHEALTHY_STREAM_DELAYED_MS) {
        label = "Delayed";
        cls += " warn";
      } else {
        label = settings.backgroundEarning ? "BG Earning" : "Earning";
        cls += " good";
      }
    } else if (currentDrop) {
      label = "Waiting";
    }

    if (reward) reward.textContent = currentDrop?.name || "Waiting For Drop";
    const watched = watchClock.elapsed ? formatClock(watchClock.elapsed) : "";
    if (extra) extra.textContent = currentDrop
      ? currentDrop.needsDropDetails
        ? `Details Pending${watched ? ` · ${watched}` : ""}`
        : `${authoritativeProgressPercent() ?? "—"}% · ${Math.max(0, currentDrop.remainingMinutes || 0)}m${watched ? ` · ${watched}` : ""}`
      : "";

    const panelWidthMode = normalizedCollapsedPanelWidth();
    const narrowStatusLabels = {
      "Login Required": "Login",
      "Details Pending": "Details",
      "Claimed ✓": "Claimed",
      "Verifying": "Verify",
      "Opening": "Open",
      "Finding": "Find",
      "Waiting": "Wait",
      "BG Earning": "BG Earn",
      "Earning": "Earn",
      "Stalled": "Stalled",
      "Delayed": "Delayed",
      "Earned": "Earned",
      "Idle": "Idle",
    };
    const compactStatusLabels = {
      "Login Required": "Login",
      "Details Pending": "Details",
    };
    const detailLabel = panelWidthMode === "narrow"
      ? (narrowStatusLabels[label] || label)
      : panelWidthMode === "compact"
        ? (compactStatusLabels[label] || label)
        : label;

    if (state) {
      state.textContent = label;
      state.className = cls;
    }
    if (detail) {
      detail.textContent = detailLabel;
      detail.className = cls;
      detail.title = label;
      detail.setAttribute("aria-label", label);
    }

    if (updated) {
      const checkedAgeSeconds = lastCheckedAt
        ? Math.max(0, Math.floor((Date.now() - lastCheckedAt) / 1000))
        : null;
      const checkedAgeLabel = checkedAgeSeconds == null
        ? ""
        : checkedAgeSeconds < 60
          ? `${checkedAgeSeconds}s`
          : checkedAgeSeconds < 3600
            ? `${Math.floor(checkedAgeSeconds / 60)}m`
            : `${Math.floor(checkedAgeSeconds / 3600)}h`;
      const fullCheckedLabel = currentDrop && checkedAgeLabel
        ? `Checked ${checkedAgeLabel} ago`
        : "Checked —";
      updated.textContent = panelWidthMode === "full"
        ? fullCheckedLabel
        : (currentDrop && checkedAgeLabel ? checkedAgeLabel : "—");
      updated.title = fullCheckedLabel;
      updated.setAttribute("aria-label", fullCheckedLabel);
      updated.className = "progress-age";
    }

    renderSkipStreamerControl();

    const dot = ui.shadow.getElementById("tdh-compact-dot");
    if (dot) {
      dot.style.background =
        label === "Stalled" ? "#ef4444" :
        label === "Delayed" ? "#f59e0b" :
        label.includes("Earning") || label.includes("Claim") ? "#22c55e" :
        "#9147ff";
    }
  }

  function applyMotionSetting() {
    ui?.cluster?.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
  }

  function normalizedCollapsedPanelWidth(value = settings.collapsedPanelWidth) {
    const normalized = cleanText(value).toLowerCase();
    return ["full", "compact", "narrow"].includes(normalized) ? normalized : "compact";
  }

  function normalizedOpacityPercent(value = settings.opacityPercent) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 85;
    return Math.max(40, Math.min(100, Math.round(numeric / 5) * 5));
  }

  function syncProgressPanelPlacement() {
    if (!ui) return;
    const card = ui.shadow.getElementById("tdh-drop-card");
    const menuSlot = ui.shadow.getElementById("tdh-badge-only-progress-slot");
    const badgeRow = ui.shadow.querySelector(".badge-row");
    if (!card || !menuSlot || !badgeRow || !ui.launcher) return;
    if (settings.badgeOnly) {
      menuSlot.hidden = false;
      if (card.parentElement !== menuSlot) menuSlot.append(card);
      card.dataset.presentation = "menu-card";
    } else {
      menuSlot.hidden = true;
      if (card.parentElement !== badgeRow) badgeRow.insertBefore(card, ui.launcher);
      card.dataset.presentation = "page-card";
    }
  }

  function applyAppearanceSettings() {
    if (!ui) return;
    const legacyThemeAliases = { warm:"ember", discord:"glacier", pine:"verdant", obsidian:"contrast" };
    settings.uiTheme = legacyThemeAliases[settings.uiTheme] || settings.uiTheme;
    const theme = UI_THEMES.find((item) => item.id === settings.uiTheme) || UI_THEMES.at(-1);
    settings.uiTheme = theme.id;
    for (const key of ["bg", "panel", "line", "text", "muted", "accent", "accent2"]) ui.cluster.style.setProperty(`--theme-${key}`, theme[key]);
    ui.cluster.style.setProperty("--theme-skin", theme.skin || theme.swatch);
    ui.cluster.style.setProperty("--theme-skin-vertical", theme.skinVertical || theme.skin || theme.swatch);
    ui.cluster.dataset.uiTheme = theme.id;
    ui.cluster.dataset.themeSkin = theme.skinMode === "flat" ? "flat" : "gradient";
    settings.opacityPercent = normalizedOpacityPercent();
    const appliedOpacity = settings.customOpacity ? settings.opacityPercent / 100 : 1;
    ui.cluster.style.setProperty("--dropper-ui-opacity", String(appliedOpacity));
    ui.cluster.dataset.customOpacity = settings.customOpacity ? "true" : "false";
    ui.cluster.dataset.opacityPercent = String(settings.opacityPercent);
    const opacityRow = ui.shadow.getElementById("tdh-opacity-row");
    const opacityRange = ui.shadow.getElementById("tdh-opacity-range");
    const opacityValue = ui.shadow.getElementById("tdh-opacity-value");
    if (opacityRow) opacityRow.hidden = !settings.customOpacity;
    if (opacityRange) {
      opacityRange.value = String(settings.opacityPercent);
      opacityRange.setAttribute("aria-valuenow", String(settings.opacityPercent));
      opacityRange.setAttribute("aria-valuetext", settings.opacityPercent + "%");
    }
    if (opacityValue) opacityValue.textContent = settings.opacityPercent + "%";
    ui.shadow.querySelectorAll(".exp-theme-swatch").forEach((button) => {
      const active = button.dataset.theme === theme.id;
      button.classList.toggle("is-on", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const stack = ui.shadow.querySelector(".progress-stack");
    if (!stack) return;
    const width = normalizedCollapsedPanelWidth();
    stack.dataset.collapsedWidth = width;
    stack.classList.toggle("badge-only", Boolean(settings.badgeOnly));
    syncProgressPanelPlacement();
    ui.cluster.dataset.panelWidth = width;
    ui.cluster.dataset.badgeOnly = settings.badgeOnly ? "true" : "false";
    const select = ui.shadow.getElementById("tdh-collapsed-width");
    if (select && select.value !== width) select.value = width;
    requestAnimationFrame(layoutChrome);
  }

  function isAutoSwitchPaused() {
    const now = Date.now();
    if (pauseAutoSwitchUntil > now) return true;

    if (pauseAutoSwitchUntil || settings.pauseAutoSwitchMinutes || settings.pauseAutoSwitchUntil) {
      pauseAutoSwitchUntil = 0;
      settings.pauseAutoSwitchMinutes = 0;
      settings.pauseAutoSwitchUntil = 0;
      try { persistSettingsSnapshot(); } catch (_) { /* ignore */ }

      const select = ui?.shadow?.getElementById("tdh-pause-switch");
      if (select) select.value = "0";
    }
    return false;
  }

  function refreshTwitchAuthStatus() {
    const authRequired = ui?.shadow?.getElementById("tdh-auth-required");
    const loginButton = ui?.shadow?.getElementById("tdh-twitch-login");
    const loggedIn = isTwitchLoggedIn();

    if (authRequired) authRequired.hidden = loggedIn;
    if (loginButton) {
      loginButton.hidden = loggedIn;
      loginButton.textContent = "Open Twitch Login";
      loginButton.classList.toggle("last-opened", !loggedIn);
    }
    requestAnimationFrame(layoutChrome);
  }

  function bindDropperControls() {
    const s = ui.shadow;
    s.getElementById('tdh-resume-playback')?.addEventListener('click', () => {
      ensureStreamPlaying(true); refreshViewingControls();
    });
    s.getElementById('tdh-allow-switching')?.addEventListener('click', () => {
      syncViewingContext(); viewingIntent.allowSwitching();
      settings.findNextStream = true; saveSettings(); refreshViewingControls();
    });
    s.getElementById('tdh-claim-history-panel')?.addEventListener('toggle', renderClaimHistory);
    refreshViewingControls(); refreshEligibilityControls(); renderClaimHistory();
    const inventory = s.getElementById("tdh-compact-inventory");
    refreshTwitchAuthStatus();
    s.getElementById("tdh-open-campaigns")?.addEventListener("toggle", (event) => {
      if (!event.currentTarget.open) return;
      refreshOpenCampaignList();
      queueGqlPollSoon("open-campaign-list", 0);
    });
    s.getElementById("tdh-twitch-login")?.addEventListener("click", () => {
      try {
        window.open(TWITCH_LOGIN_URL, "_blank", "noopener,noreferrer");
      } catch (_) {
        location.assign(TWITCH_LOGIN_URL);
      }
      setStatus("Finish Twitch login, then return to Dropper");
      setTimeout(refreshTwitchAuthStatus, 1500);
    });
    s.getElementById("tdh-toggle-inventory")?.addEventListener("click", (event) => {
      const open = inventory.classList.toggle("open");
      if (open) lastSubmenuId = "inventory";
      event.currentTarget.textContent = open ? "Hide Drops Inventory" : "Show Drops Inventory";
      event.currentTarget.classList.toggle("last-opened", lastSubmenuId === "inventory");
      s.getElementById("tdh-diagnostics-toggle")?.classList.toggle("last-opened", lastSubmenuId === "diagnostics");
      renderCompactInventory();
      requestAnimationFrame(layoutChrome);
    });
    s.getElementById("tdh-skip-streamer")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleSkipStreamerClick();
    });
    s.getElementById("tdh-refresh-now")?.addEventListener("click", () => requestGqlPoll("manual-refresh", true));
    s.getElementById("tdh-refresh-campaign-data")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!getToken()) {
        button.textContent = "Twitch Login Required";
        setStatus("Twitch Login Required · Open Drops To Sign In");
        refreshTwitchAuthStatus();
        setTimeout(() => { if (button.isConnected) button.textContent = "Refresh Campaign Data"; }, 1800);
        return;
      }

      button.textContent = "Refreshing Campaign Data…";
      button.disabled = true;
      try {
        lastCampaignAuthImportError = "";
        const imported = await importOpenCampaignsViaAuth("manual-diagnostics-refresh");
        if (imported.length) {
          button.textContent = `Refreshed ${imported.length} Campaigns`;
          refreshDropCard();
          maybeImportOpenCampaignsFirst("manual-diagnostics-refresh-complete");
          queueGqlPollSoon("manual-diagnostics-refresh", 0);
        } else if (lastCampaignAuthImportError) {
          button.textContent = "Refresh Failed";
          setStatus(`Campaign refresh failed · ${lastCampaignAuthImportError}`);
        } else {
          button.textContent = "No Open Campaigns Returned";
          refreshDropCard();
        }
      } catch (error) {
        lastCampaignAuthImportError = cleanText(error?.message || error) || "Refresh failed";
        button.textContent = "Refresh Failed";
        setStatus(`Campaign refresh failed · ${lastCampaignAuthImportError}`);
      } finally {
        button.disabled = false;
        setTimeout(() => { if (button.isConnected) button.textContent = "Refresh Campaign Data"; }, 2200);
      }
    });
    s.getElementById("tdh-clear-skipped-streamers")?.addEventListener("click", (event) => {
      const cleared = clearSkippedStreamers("manual-clear-skipped-streamers", true);
      event.currentTarget.textContent = cleared
        ? `Cleared ${cleared} Streamer${cleared === 1 ? "" : "s"}`
        : "No Skipped Streamers";
      refreshQueueList();
      const diagnostics = s.getElementById("tdh-diagnostics");
      if (diagnostics?.classList.contains("open")) diagnostics.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Clear Skipped Streamers"; }, 1600);
    });
    const diag = s.getElementById("tdh-diagnostics");
    ExtraPotionsDiagnostics.bindControls({
      show: s.getElementById("tdh-diagnostics-toggle"), copy: s.getElementById("tdh-copy-diagnostics"), output: diag,
      getReport: () => JSON.parse(diagnosticsText()),
      onShow: opening => { if (opening) lastSubmenuId = "diagnostics"; requestAnimationFrame(layoutChrome); },
      onCopy: () => logActivity("diagnostics", "Diagnostics copied to clipboard")
    });
    s.getElementById("tdh-clear-activity")?.addEventListener("click", (event) => {
      clearActivityLog();
      event.currentTarget.textContent = "Activity Cleared";
      if (diag.classList.contains("open")) diag.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Clear Activity Log"; }, 1600);
    });
    s.getElementById("tdh-reset-session")?.addEventListener("click", (event) => {
      resetTransientSessionState();
      event.currentTarget.textContent = "Session Reset";
      if (diag.classList.contains("open")) diag.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Reset Session State"; }, 1600);
    });
    const queueCount = s.getElementById("tdh-queue-count"); queueCount.value = String(settings.queueCount); queueCount.addEventListener("change", () => { settings.queueCount = Number(queueCount.value); saveSettings(); refreshQueueList(); });
    const pref = s.getElementById("tdh-queue-preference"); pref.value = settings.queuePreference; pref.addEventListener("change", () => { settings.queuePreference = pref.value; saveSettings(); refreshQueueList(); });
    const pause = s.getElementById("tdh-pause-switch");
    if (!isAutoSwitchPaused()) {
      settings.pauseAutoSwitchMinutes = 0;
      settings.pauseAutoSwitchUntil = 0;
    }
    pause.value = String(settings.pauseAutoSwitchMinutes || 0);
    pause.addEventListener("change", () => {
      settings.pauseAutoSwitchMinutes = Number(pause.value);
      pauseAutoSwitchUntil = settings.pauseAutoSwitchMinutes
        ? Date.now() + settings.pauseAutoSwitchMinutes * 60000
        : 0;
      settings.pauseAutoSwitchUntil = pauseAutoSwitchUntil;
      saveSettings();
    });
    const collapsedWidth = s.getElementById("tdh-collapsed-width");
    collapsedWidth.value = normalizedCollapsedPanelWidth();
    collapsedWidth.addEventListener("change", () => {
      settings.collapsedPanelWidth = normalizedCollapsedPanelWidth(collapsedWidth.value);
      saveSettings();
      applyAppearanceSettings();
      layoutChrome();
    });
    const opacityRange = s.getElementById("tdh-opacity-range");
    opacityRange.value = String(normalizedOpacityPercent());
    opacityRange.addEventListener("input", () => {
      settings.opacityPercent = normalizedOpacityPercent(opacityRange.value);
      opacityRange.setAttribute("aria-valuenow", String(settings.opacityPercent));
      opacityRange.setAttribute("aria-valuetext", settings.opacityPercent + "%");
      applyAppearanceSettings();
    });
    opacityRange.addEventListener("change", () => {
      settings.opacityPercent = normalizedOpacityPercent(opacityRange.value);
      saveSettings();
      applyAppearanceSettings();
    });
    s.getElementById("tdh-theme-swatches")?.addEventListener("click", (event) => {
      const button = event.target.closest(".exp-theme-swatch");
      if (!button || !UI_THEMES.some((theme) => theme.id === button.dataset.theme)) return;
      settings.uiTheme = button.dataset.theme;
      saveSettings();
      applyAppearanceSettings();
    });
    s.getElementById("tdh-update-dismiss")?.addEventListener("click", hideUpdateNotice);
  }

  function notifyUser(text) {
    if (!settings.notifications || !ui) return;
    const toast = ui.shadow.getElementById("tdh-toast");
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(notifyUser.timer);
    notifyUser.timer = setTimeout(() => { toast.hidden = true; }, 3000);
    requestAnimationFrame(layoutChrome);
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
      installUrl: INSTALL_URL,
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
    const mode = normalizedCollapsedPanelWidth();
    if (mode === "narrow") return 220;
    if (mode === "compact") return 260;
    const full = parseFloat(getComputedStyle(ui.cluster).getPropertyValue("--dropper-width")) || 312;
    return Math.max(280, Math.min(full, 340));
  }

  function positionMenuUpdateNotice() {
    if (!ui) return;
    const notice = ui.shadow.getElementById("tdh-update-notice");
    if (!notice || notice.hidden) return;

    const width = Math.min(noticePanelWidth(), Math.max(0, window.innerWidth - 24));
    notice.style.setProperty("width", `${width}px`, "important");

    const menuBox = railOpen ? ui.dock.getBoundingClientRect() : null;
    const rowBox = ui.shadow.querySelector(".badge-row")?.getBoundingClientRect?.();
    const launcherBox = ui.launcher?.getBoundingClientRect?.();
    const anchorBox = menuBox?.width && menuBox?.height
      ? menuBox
      : rowBox?.width && rowBox?.height
        ? rowBox
        : launcherBox;

    if (!anchorBox?.width || !anchorBox?.height) return;

    const height = notice.offsetHeight || notice.scrollHeight || 72;
    const anchor = document.documentElement.dataset.expLauncherAnchor === "top" ? "top" : "bottom";
    let top;

    if (menuBox?.width && menuBox?.height) {
      const preferredTop = menuBox.top - height - 8;
      top = preferredTop >= 8
        ? preferredTop
        : Math.min(window.innerHeight - height - 8, menuBox.bottom + 8);
    } else if (anchor === "top") {
      top = Math.min(window.innerHeight - height - 8, anchorBox.bottom + 8);
    } else {
      top = Math.max(8, anchorBox.top - height - 8);
    }

    const left = Math.max(
      8,
      Math.min(window.innerWidth - width - 8, anchorBox.right - width),
    );

    notice.style.setProperty("left", `${left}px`, "important");
    notice.style.setProperty("right", "auto", "important");
    notice.style.setProperty("top", `${Math.max(8, top)}px`, "important");
    notice.style.setProperty("bottom", "auto", "important");
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

  function loadUpdateState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(UPDATE_STATE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveUpdateState(state) {
    try {
      localStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(state || {}));
    } catch (_) {
      /* ignore */
    }
  }

  function markUpdateAvailable(version) {
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
        details: [
          "A newer Dropper build is available.",
          "Install the latest userscript to get the newest fixes and improvements.",
          "After reinstalling, return to Twitch and Dropper will refresh this page automatically.",
        ],
        actionUrl: INSTALL_URL,
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
    const state = loadUpdateState();
    const available = cleanText(state.availableVersion || "");
    if (available && compareVersions(available, APP_VERSION) > 0) {
      markUpdateAvailable(available);
      return true;
    }
    if (available && compareVersions(available, APP_VERSION) <= 0) {
      state.availableVersion = "";
      state.availableAt = 0;
      saveUpdateState(state);
    }
    clearUpdateAvailableIndicator();
    return false;
  }

  function checkVersionNotice() {
    const state = loadUpdateState();
    if (state.availableVersion && compareVersions(state.availableVersion, APP_VERSION) <= 0) {
      state.availableVersion = "";
      state.availableAt = 0;
      saveUpdateState(state);
    }
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
    checkCachedUpdateNotice();
  }

  function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) { const diff = (pa[i] || 0) - (pb[i] || 0); if (diff) return diff; }
    return 0;
  }

  function scheduleUpdateCheck(force = false) {
    if (typeof GM_xmlhttpRequest !== "function") return;

    const now = Date.now();
    const state = loadUpdateState();

    if (state.availableVersion && compareVersions(state.availableVersion, APP_VERSION) <= 0) {
      state.availableVersion = "";
      state.availableAt = 0;
    }
    if (state.lastRemoteVersion && compareVersions(state.lastRemoteVersion, APP_VERSION) <= 0) {
      state.availableVersion = "";
      state.availableAt = 0;
    }
    const checkedForCurrentVersion = state.checkedForVersion === APP_VERSION;
    if (!checkedForCurrentVersion) {
      state.checkedForVersion = APP_VERSION;
      state.lastCheckAt = 0;
      state.checkLeaseUntil = 0;
      state.lastRemoteVersion = "";
      state.lastHttpStatus = 0;
      state.lastError = "";
    }
    saveUpdateState(state);

    // A newly installed version always performs one fresh remote check of its own
    // instead of inheriting the previous version's 15-minute throttle window.
    const lastCheckAt = Number(state.lastCheckAt || 0);
    const leaseUntil = Number(state.checkLeaseUntil || 0);

    if (!force && leaseUntil > now) {
      checkCachedUpdateNotice();
      return;
    }

    if (!force && checkedForCurrentVersion && now - lastCheckAt < UPDATE_CHECK_INTERVAL_MS) {
      checkCachedUpdateNotice();
      return;
    }

    state.checkedForVersion = APP_VERSION;
    state.lastCheckAt = now;
    state.checkLeaseUntil = now + UPDATE_CHECK_LEASE_MS;
    state.lastError = "";
    saveUpdateState(state);

    const cacheBucket = Math.floor(now / UPDATE_CHECK_INTERVAL_MS);
    const checkUrl = `${UPDATE_URL}?dropper_check=${encodeURIComponent(APP_VERSION)}&t=${cacheBucket}`;

    GM_xmlhttpRequest({
      method: "GET",
      url: checkUrl,
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      timeout: 12000,
      onload(response) {
        const nextState = loadUpdateState();
        const remote = String(response.responseText || "");
        const match = remote.match(/^\/\/ @version\s+([^\s]+)/m);
        const remoteVersion = cleanText(match?.[1] || "");

        nextState.checkedForVersion = APP_VERSION;
        nextState.lastCheckAt = Date.now();
        nextState.lastHttpStatus = Number(response.status || 0);
        nextState.lastRemoteVersion = remoteVersion || "";
        nextState.checkLeaseUntil = 0;
        nextState.lastError = "";

        if (remoteVersion && compareVersions(remoteVersion, APP_VERSION) > 0) {
          nextState.availableVersion = remoteVersion;
          nextState.availableAt = Date.now();
          saveUpdateState(nextState);
          if (lastUpdateNoticeVersion !== remoteVersion) {
            logActivity("update", `Dropper v${remoteVersion} is available`, {
              installedVersion: APP_VERSION,
              remoteVersion,
            });
          }
          markUpdateAvailable(remoteVersion);
          return;
        }

        if (remoteVersion && compareVersions(remoteVersion, APP_VERSION) <= 0) {
          nextState.availableVersion = "";
          nextState.availableAt = 0;
          clearUpdateAvailableIndicator();
        }

        saveUpdateState(nextState);
      },
      onerror(response) {
        const nextState = loadUpdateState();
        nextState.lastError = `Update check network error${response?.status ? ` (${response.status})` : ""}`;
        nextState.checkLeaseUntil = 0;
        nextState.lastCheckAt = Date.now();
        saveUpdateState(nextState);
        logActivity("update-error", nextState.lastError);
      },
      ontimeout() {
        const nextState = loadUpdateState();
        nextState.lastError = "Update check timed out";
        nextState.checkLeaseUntil = 0;
        nextState.lastCheckAt = Date.now();
        saveUpdateState(nextState);
        logActivity("update-error", nextState.lastError);
      },
    });
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
      MUTE_PENDING_KEY,
      CAMPAIGN_CATALOG_KEY,
      CAMPAIGN_PAGE_IMPORT_KEY,
      "tdh-drop",
      "tdh-progress",
      "tdh-progress-at",
    ].forEach((key) => {
      removeSession(key);
    });

    currentDrop = null;
    campaignCatalogCache = { at: 0, campaigns: [] };
    lastCampaignCatalog = [];
    lastCampaignCatalogAt = 0;
    lastInventoryCampaigns = [];
    lastInProgressKeys = new Set();
    haveSeenInventorySnapshot = false;

    standbyCache = [];
    lastStandbyRefreshAt = 0;
    lastRoutingCandidateSnapshot = {
      at: 0,
      game: "",
      gameSlug: "",
      campaignKey: "",
      allowListPresent: false,
      visible: [],
    };

    lastProgress = 0;
    lastProgressAt = Date.now();
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
    return JSON.stringify(ExtraPotionsDiagnostics.createReport("Dropper", { ...dropperDebugSnapshot(), host: ui?.host, shadow: ui?.shadow }), null, 2);
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
      headerVersionControl: Boolean(ui?.shadow?.getElementById("tdh-header-version")),
      launcherGrid: {
        slot: ui?.host?.dataset?.launcherSlot || null,
        offset: ui?.host ? getComputedStyle(ui.host).getPropertyValue("--exp-launcher-offset").trim() : null,
        manualDelta: launcherGridDelta,
      },
      autoDismiss: {
        menuSeconds: Math.round(MENU_INACTIVITY_DISMISS_MS / 1000),
        menuTimerActive: Boolean(menuDismissTimer),
        menuDismissAt: menuDismissAt ? new Date(menuDismissAt).toISOString() : null,
        menuRemainingSeconds: menuDismissAt ? Math.max(0, Math.ceil((menuDismissAt - now) / 1000)) : null,
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
      claims: { history: claimLedger().snapshot(), selectors: claimHealth, crossTabLock: navigator.locks?.request ? 'web-locks' : 'advisory-leader', limit: 100 },
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
        ignoredGames: Object.entries(ignoredCampaignGames.games || {}).map(([key, item]) => ({
          key,
          game: item?.game || key,
          expiresAt: item?.expiresAt ? new Date(item.expiresAt).toISOString() : null,
        })),
        queue: (() => {
          const triplet = campaignQueueTriplet(routingCampaignPool(), currentDrop, now);
          const summarize = (item) => item ? {
            game: item.game,
            name: item.name,
            endAt: item.endAt || null,
            endMs: item.endMs || null,
            priority: item.sequencePriority ?? campaignPriority(item.game),
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
      progressAgeSeconds: Math.max(0, Math.floor((now - lastProgressAt) / 1000)),
      progressFreshnessBasis: "credited-minutes-or-percent",
      lastProgress,
      lastProgressAt: new Date(lastProgressAt).toISOString(),
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
        lastReason: lastGqlReason || null,
        pendingReason: pendingGqlReason || null,
        lastPollAt: lastGqlPollAt ? new Date(lastGqlPollAt).toISOString() : null,
        lastSuccessAt: lastGqlSuccessAt ? new Date(lastGqlSuccessAt).toISOString() : null,
        lastInterceptedTwitchResponseAt: lastTwitchGqlAt ? new Date(lastTwitchGqlAt).toISOString() : null,
        lastCampaignDashboardAt: lastCampaignDashboardAt ? new Date(lastCampaignDashboardAt).toISOString() : null,
        lastError: lastGqlError || null,
        pageHook: twitchNetworkHookMode || null,
        sessionPoll: lastSessionPoll ? {
          ...lastSessionPoll,
          at: new Date(lastSessionPoll.at).toISOString(),
        } : null,
        clientIntegrity: clientIntegritySnapshot(now),
      },
      updateCheck: (() => {
        const state = loadUpdateState();
        return {
          intervalMinutes: Math.round(UPDATE_CHECK_INTERVAL_MS / 60000),
          stateKey: UPDATE_STATE_KEY,
          checkedForVersion: state.checkedForVersion || null,
          lastCheckAt: state.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : null,
          lastRemoteVersion: state.lastRemoteVersion || null,
          availableVersion: state.availableVersion || null,
          availableAt: state.availableAt ? new Date(state.availableAt).toISOString() : null,
          lastHttpStatus: Number(state.lastHttpStatus || 0) || null,
          lastError: state.lastError || null,
          checkLeaseUntil: state.checkLeaseUntil ? new Date(state.checkLeaseUntil).toISOString() : null,
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
        hasVerifiedEarningStream: Boolean(
          readRoutingControllerSession().state === ROUTING_STATES.EARNING &&
          matchingLiveDropStream()
        ),
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
          earningVerified: health.earningVerified,
          expectedGame: health.expectedGame,
          streamGame: health.streamGame,
          gameMatches: health.gameMatches,
          dropsTagVisible: health.dropsTagVisible,
          healthy: health.healthy,
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
        lastRefreshAt: lastStandbyRefreshAt ? new Date(lastStandbyRefreshAt).toISOString() : null,
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
      panelAndMenuWidth: normalizedCollapsedPanelWidth(),
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
    syncDropperWidthToChat();

    const badgeRow = ui.shadow.querySelector(".badge-row");
    const progressStack = ui.shadow.querySelector(".progress-stack");
    const progressCard = ui.shadow.getElementById("tdh-drop-card");
    const rowHeight = settings.badgeOnly ? 48 : Math.max(112, progressCard?.offsetHeight || 112);
    const panelMode = normalizedCollapsedPanelWidth();
    const panelWidth =
      panelMode === "narrow" ? 220 :
      panelMode === "compact" ? 260 :
      Math.max(280, Math.min(parseFloat(getComputedStyle(ui.cluster).getPropertyValue("--dropper-width")) || 312, 340));
    const launcherWidth = 48;
    const rowGap = settings.badgeOnly ? 0 : 8;
    const rowWidth = settings.badgeOnly ? launcherWidth : panelWidth + rowGap + launcherWidth;

    const reservedRows = 1;
    if (ui.host.dataset.launcherReservedRows !== String(reservedRows)) {
      ui.host.dataset.launcherReservedRows = String(reservedRows);
      document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "launcher-reservation", productId: "dropper", rows: reservedRows } }));
    }

    const gridOffset = parseFloat(getComputedStyle(ui.host).getPropertyValue("--exp-launcher-offset")) || 0;
    const storedDelta = Number(localStorage.getItem(LAUNCHER_GRID_DELTA_KEY) || 0);
    const minimumDelta = 8 - (window.innerHeight - 48 - 12);
    launcherGridDelta = Math.max(minimumDelta, Math.min(4, Number.isFinite(storedDelta) ? storedDelta : 0));
    const launcherTop = window.innerHeight - 48 - 12 + launcherGridDelta;
    const anchor = launcherTop <= (window.innerHeight - 48) / 2 ? "top" : "bottom";
    document.documentElement.dataset.expLauncherAnchor = anchor;
    ui.cluster.dataset.launcherAnchor = anchor;

    // Dropper's row is the single positioning surface. The progress card remains
    // directly to the left of the launcher and never receives viewport coordinates.
    clusterTop = anchor === "top"
      ? launcherTop + gridOffset
      : launcherTop - gridOffset - (settings.badgeOnly ? 0 : Math.round((rowHeight - 48) / 2));

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

    if (progressCard?.dataset.presentation === "page-card") {
      progressCard.style.setProperty("width", `${Math.min(panelWidth, Math.max(0, window.innerWidth - 80))}px`, "important");
      progressCard.style.setProperty("max-width", `calc(100vw - 80px)`, "important");
      for (const property of ["left", "right", "top", "bottom"]) progressCard.style.removeProperty(property);
    }

    const rowBox = badgeRow?.getBoundingClientRect?.();
    const rowTop = rowBox?.height ? rowBox.top : clusterTop;
    const rowBottom = rowBox?.height ? rowBox.bottom : clusterTop + rowHeight;

    if (railOpen) {
      // Inline width from the previous mode must not determine the measured
      // height. Constrain the new width and inward space before positioning.
      ui.dock.style.setProperty("width", `${Math.min(panelWidth, window.innerWidth - 24)}px`, "important");
      const availableMenuHeight = anchor === "top"
        ? window.innerHeight - rowBottom - 16
        : rowTop - 16;
      ui.dock.style.maxHeight = `${Math.max(0, availableMenuHeight)}px`;
      ui.dock.style.overflowY = "auto";
      const menuHeight = ui.dock.offsetHeight || ui.dock.clientHeight || 0;
      const desiredMenuTop = anchor === "top"
        ? rowBottom + 8
        : rowTop - menuHeight - 8;
      const safeMenuTop = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, desiredMenuTop));
      ui.dock.style.right = "12px";
      ui.dock.style.left = "auto";
      ui.dock.style.top = `${safeMenuTop}px`;
      ui.dock.style.bottom = "auto";

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

  function bindDrag() {
    let startY = 0;
    let startGridDelta = 0;
    let didDrag = false;
    let activePointerId = null;
    ui.launcher.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      activePointerId = event.pointerId;
      startY = event.clientY;
      startGridDelta = launcherGridDelta;
      didDrag = false;
      ui.launcher.classList.remove("is-dragging");
      event.preventDefault();
    });
    document.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointerId) return;
      const delta = event.clientY - startY;
      if (Math.abs(delta) > 4 && !didDrag) {
        didDrag = true;
        ui.launcher.classList.add("is-dragging");
      }
      if (!didDrag) return;
      event.preventDefault();
      launcherGridDelta = startGridDelta + delta;
      localStorage.setItem(LAUNCHER_GRID_DELTA_KEY, String(launcherGridDelta));
      document.dispatchEvent(new CustomEvent("exp-core:coordination", { detail: { type: "launcher-grid-moved", productId: "dropper" } }));
      layoutChrome();
    }, { passive: false });
    const endDrag = (event) => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      ui.launcher.classList.remove("is-dragging");
    };
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    ui.launcher.addEventListener("click", (event) => {
      if (!didDrag) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      didDrag = false;
    }, true);
  }

  function clearMenuDismissTimer() {
    clearTimeout(menuDismissTimer);
    menuDismissTimer = null;
    menuDismissAt = 0;
  }

  function scheduleMenuDismiss() {
    clearTimeout(menuDismissTimer);
    menuDismissTimer = null;
    if (!railOpen || !ui) {
      menuDismissAt = 0;
      return;
    }

    menuDismissAt = Date.now() + MENU_INACTIVITY_DISMISS_MS;
    menuDismissTimer = setTimeout(() => {
      enforceAutoDismissDeadlines(Date.now());
    }, MENU_INACTIVITY_DISMISS_MS + 20);
  }

  function enforceAutoDismissDeadlines(now = Date.now()) {
    if (railOpen && menuDismissAt && now >= menuDismissAt) {
      setRailOpen(false);
    }
  }

  function bindMenuInactivity() {
    if (!ui?.dock) return;
    const reset = () => {
      if (railOpen) scheduleMenuDismiss();
    };

    ["pointerdown", "click", "wheel", "keydown", "input", "change"].forEach((type) => {
      ui.dock.addEventListener(type, reset, { passive: type === "wheel" });
    });
  }

  function setRailOpen(open, focus) {
    railOpen = open;
    if (open) {
      collapseToolPanels();
      collapseNestedPanels();
    }
    ui.dock.classList.toggle("fl-rail-open", open);
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
      "tdh-claim-bonus": "claimBonus", "tdh-keep-tab": "keepTabActive", "tdh-claim-drops": "claimDrops",
      "tdh-progress-title": "progressInTitle", "tdh-find-next": "findNextStream", "tdh-mute-next": "muteRestarted",
      "tdh-background-earning": "backgroundEarning", "tdh-badge-only": "badgeOnly", "tdh-reduce-motion": "reduceMotion", "tdh-notifications": "notifications", "tdh-custom-opacity": "customOpacity",
      "tdh-hide-sub-promos": "hideTwitchSubscriptionPromos",
      "tdh-queue-enabled": "queueEnabled", "tdh-queue-stall": "queueOnStall", "tdh-queue-offline": "queueOnOffline", "tdh-queue-category": "queueOnCategoryChange",
    };
    Object.entries(map).forEach(([id, key]) => {
      ui.shadow.getElementById(id)?.addEventListener("click", () => {
        settings[key] = !settings[key];
        saveSettings();
        if (key === "claimBonus" || key === "claimDrops") syncClaimWatchers();
        if (key === "keepTabActive") void syncScreenWakeLock();
        if (key === "findNextStream" && settings.findNextStream) { syncViewingContext(); viewingIntent.allowSwitching(); }
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
      "tdh-claim-bonus": settings.claimBonus, "tdh-keep-tab": settings.keepTabActive, "tdh-claim-drops": settings.claimDrops,
      "tdh-progress-title": settings.progressInTitle, "tdh-find-next": settings.findNextStream, "tdh-mute-next": settings.muteRestarted,
      "tdh-background-earning": settings.backgroundEarning, "tdh-badge-only": settings.badgeOnly, "tdh-reduce-motion": settings.reduceMotion, "tdh-notifications": settings.notifications, "tdh-custom-opacity": settings.customOpacity,
      "tdh-hide-sub-promos": settings.hideTwitchSubscriptionPromos,
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
