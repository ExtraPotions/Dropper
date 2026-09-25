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
  const onError = event => record('error', event.target === window ? 'runtime-error' : 'resource-error',
    event.target === window ? [event.error || event.message, { line: event.lineno, column: event.colno }] : [{ element: event.target?.tagName || 'unknown' }]);
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
