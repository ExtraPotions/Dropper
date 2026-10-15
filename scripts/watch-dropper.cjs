'use strict';

/**
 * Headed Twitch + Dropper watch harness for Cloud Agents.
 *
 * - Persistent Chrome profile (Twitch login survives restarts)
 * - Real GM_xmlhttpRequest via Node (CORS-free Dropper GQL)
 * - Injects dropper.user.js on every Twitch document
 * - Polls window.dropperDebug() into artifacts/diagnostics/
 *
 * Usage:
 *   node scripts/watch-dropper.cjs
 *   node scripts/watch-dropper.cjs --url https://www.twitch.tv/directory
 *   node scripts/watch-dropper.cjs --once   # one dump then exit
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const INSTALL_PATH = path.join(ROOT, 'dropper.user.js');
const SOURCE_PATH = path.join(ROOT, 'src', 'dropper.user.js');
const PROFILE_DIR = path.join(ROOT, '.watch-profile');
const DIAG_DIR = path.join(ROOT, 'artifacts', 'diagnostics');
const LATEST_PATH = path.join(DIAG_DIR, 'latest.json');
const STATUS_PATH = path.join(DIAG_DIR, 'watch-status.json');
const LOG_PATH = path.join(DIAG_DIR, 'watch.log');
const CDP_PORT = Number(process.env.DROPPER_WATCH_CDP_PORT || 9333);
const POLL_MS = Number(process.env.DROPPER_WATCH_POLL_MS || 15000);
const STATUS_PORT = Number(process.env.DROPPER_WATCH_STATUS_PORT || 9340);

const args = process.argv.slice(2);
const once = args.includes('--once');
const urlArg = args.find((item, index) => args[index - 1] === '--url') || 'https://www.twitch.tv/drops/inventory';

function stripUserscriptHeader(source) {
  const end = source.indexOf('// ==/UserScript==');
  if (end < 0) return source;
  let cursor = end + '// ==/UserScript=='.length;
  while (source[cursor] === '\n' || source[cursor] === '\r') cursor += 1;
  while (source.startsWith('//', cursor)) {
    const lineEnd = source.indexOf('\n', cursor);
    if (lineEnd < 0) {
      cursor = source.length;
      break;
    }
    cursor = lineEnd + 1;
  }
  while (source[cursor] === '\n' || source[cursor] === '\r') cursor += 1;
  return source.slice(cursor);
}

function loadDropperSource() {
  // Prefer readable source for init-script injection. Twitch CSP often blocks
  // <script> tags, and evaluating a minified install artifact via CDP can throw
  // temporal-dead-zone errors after SPA navigations.
  const install = fs.existsSync(INSTALL_PATH) ? fs.readFileSync(INSTALL_PATH, 'utf8') : '';
  const readableInstall = install.includes('function twitchDropsHelper');
  const filePath = readableInstall ? INSTALL_PATH : (fs.existsSync(SOURCE_PATH) ? SOURCE_PATH : INSTALL_PATH);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Missing Dropper source at ${SOURCE_PATH} or ${INSTALL_PATH}`);
  }
  return stripUserscriptHeader(fs.readFileSync(filePath, 'utf8'));
}
function log(message, meta) {
  const line = `[${new Date().toISOString()}] ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, `${line}\n`);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function summarizeDiagnostics(diag) {
  if (!diag || typeof diag !== 'object') return { ok: false, reason: 'no-diagnostics' };
  const earning = diag.earningHealth || {};
  const mismatch = diag.categoryMatch || {};
  const drop = diag.currentDrop || null;
  const recent = Array.isArray(diag.recentActivity) ? diag.recentActivity.slice(-8) : [];
  const ghostActive = Boolean(
    drop &&
    /^(?:active|current)\s+drop$/i.test(String(drop.name || '')) &&
    !String(drop.game || '').trim()
  );
  const unhealthy = earning.healthy === false || mismatch.mismatchActive === true || ghostActive;
  return {
    ok: true,
    version: diag.version || null,
    statusText: diag.statusText || null,
    watchingLogin: diag.watchingLogin || earning.login || null,
    dropName: drop?.name || null,
    dropGame: drop?.game || null,
    dropPercent: drop?.percent ?? null,
    tokenCaptured: Boolean(diag.tokenCaptured),
    deviceCaptured: Boolean(diag.deviceCaptured),
    earningHealthy: earning.healthy !== false,
    gameMatches: earning.gameMatches !== false,
    expectedGame: earning.expectedGame || mismatch.expectedGame || null,
    streamGame: earning.streamGame || mismatch.streamGame || null,
    mismatchActive: Boolean(mismatch.mismatchActive),
    ghostActive,
    unhealthy,
    networkCircuitOpen: Boolean(diag.networkSafety?.circuitOpen),
    gqlError: diag.gql?.lastError || null,
    recentActivity: recent.map((item) => ({
      at: item.at || null,
      type: item.type || null,
      message: item.message || null,
    })),
  };
}

async function installGmPolyfill(context) {
  await context.exposeBinding('__dropperGmXhr', async (_source, opts = {}) => {
    const method = String(opts.method || 'GET').toUpperCase();
    const targetUrl = String(opts.url || '');
    if (!targetUrl) throw new Error('GM_xmlhttpRequest missing url');

    const headers = { ...(opts.headers || {}) };
    const cookies = await context.cookies([
      'https://www.twitch.tv',
      'https://gql.twitch.tv',
      'https://raw.githubusercontent.com',
    ]);
    if (cookies.length) {
      headers.Cookie = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    }
    if (!headers.Origin && /twitch\.tv/i.test(targetUrl)) {
      headers.Origin = 'https://www.twitch.tv';
      headers.Referer = 'https://www.twitch.tv/';
    }

    const controller = new AbortController();
    const timeoutMs = Number(opts.timeout || 15000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(targetUrl, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : opts.data,
        signal: controller.signal,
        redirect: 'follow',
      });
      const responseText = await response.text();
      return {
        status: response.status,
        responseText,
        finalUrl: String(response.url || targetUrl),
      };
    } finally {
      clearTimeout(timer);
    }
  });

  await context.addInitScript(() => {
    if (window.__dropperGmReady) return;
    window.__dropperGmReady = true;
    window.unsafeWindow = window;
    window.GM_xmlhttpRequest = function GM_xmlhttpRequest(opts = {}) {
      const run = window.__dropperGmXhr;
      if (typeof run !== 'function') {
        queueMicrotask(() => opts.onerror?.({ status: 0, responseText: 'GM binding missing' }));
        return;
      }
      Promise.resolve(run(opts))
        .then((response) => {
          const payload = {
            status: Number(response?.status || 0),
            responseText: String(response?.responseText || ''),
            response: response?.responseText || '',
            finalUrl: response?.finalUrl || opts.url || '',
          };
          try {
            opts.onload?.(payload);
          } catch (error) {
            opts.onerror?.({ status: payload.status, responseText: String(error?.message || error) });
          }
        })
        .catch((error) => {
          if (error?.name === 'AbortError') opts.ontimeout?.(error);
          else opts.onerror?.({ status: 0, responseText: String(error?.message || error) });
        });
    };
  });
}

async function injectDropper(page, source) {
  const already = await page.evaluate(() => Boolean(window.dropperDebug));
  if (already) return false;
  await page.evaluate(() => {
    document.getElementById('tdh-root')?.remove();
  }).catch(() => null);
  // addInitScript covers new documents; this is a same-document recovery path.
  await page.evaluate((code) => {
    // eslint-disable-next-line no-new-func
    new Function(code)();
  }, source);
  await page.waitForFunction(
    () => Boolean(window.dropperDebug || document.getElementById('tdh-root')),
    null,
    { timeout: 20000 },
  ).catch(() => null);
  return true;
}

async function dumpDiagnostics(page) {
  const diag = await page.evaluate(() => {
    try {
      if (typeof window.dropperDebug === 'function') return window.dropperDebug();
    } catch (_) { /* ignore */ }
    return null;
  });
  const summary = summarizeDiagnostics(diag);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (diag) {
    writeJson(LATEST_PATH, diag);
    writeJson(path.join(DIAG_DIR, `diag-${stamp}.json`), diag);
  }
  writeJson(path.join(DIAG_DIR, 'latest-summary.json'), {
    capturedAt: new Date().toISOString(),
    pageUrl: page.url(),
    ...summary,
  });
  return { diag, summary };
}

function startStatusServer(getState) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url === '/summary' || req.url === '/') {
      const state = getState();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(state, null, 2));
      return;
    }
    if (req.url === '/latest') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(fs.existsSync(LATEST_PATH) ? fs.readFileSync(LATEST_PATH, 'utf8') : '{"error":"no-dump-yet"}');
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  server.listen(STATUS_PORT, '127.0.0.1');
  return server;
}

async function main() {
  fs.mkdirSync(DIAG_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const source = loadDropperSource();

  let latestState = {
    startedAt: new Date().toISOString(),
    pageUrl: null,
    loggedIn: false,
    dropperMounted: false,
    summary: null,
  };

  const server = startStatusServer(() => latestState);
  log('status server listening', { url: `http://127.0.0.1:${STATUS_PORT}/` });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--remote-debugging-port=${CDP_PORT}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  await installGmPolyfill(context);
  // Init script survives Twitch SPA navigations; <script> tags often do not.
  await context.addInitScript({ content: source });

  context.on('page', async (page) => {
    page.on('framenavigated', async (frame) => {
      if (frame !== page.mainFrame()) return;
      if (!/twitch\.tv/i.test(page.url())) return;
      try {
        const injected = await injectDropper(page, source);
        if (injected) log('injected Dropper', { url: page.url() });
      } catch (error) {
        log('inject failed', { message: String(error?.message || error), url: page.url() });
      }
    });
  });

  let page = context.pages()[0] || await context.newPage();

  // Optional auth bootstrap from artifacts/diagnostics/auth-token.txt
  const tokenFile = path.join(DIAG_DIR, 'auth-token.txt');
  if (fs.existsSync(tokenFile)) {
    const authToken = String(fs.readFileSync(tokenFile, 'utf8')).trim();
    if (authToken) {
      const uniqueFile = path.join(DIAG_DIR, 'unique-id.txt');
      const uniqueId = fs.existsSync(uniqueFile) ? String(fs.readFileSync(uniqueFile, 'utf8')).trim() : '';
      const cookies = [{
        name: 'auth-token',
        value: authToken,
        domain: '.twitch.tv',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      }];
      if (uniqueId) {
        cookies.push(
          { name: 'unique_id', value: uniqueId, domain: '.twitch.tv', path: '/', httpOnly: false, secure: true, sameSite: 'Lax' },
          { name: 'unique_id_durable', value: uniqueId, domain: '.twitch.tv', path: '/', httpOnly: false, secure: true, sameSite: 'Lax' },
        );
      }
      await context.addCookies(cookies);
      try { fs.unlinkSync(tokenFile); } catch (_) { /* ignore */ }
      log('imported auth-token from diagnostics file');
    }
  }

  await page.goto(urlArg, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (/twitch\.tv/i.test(page.url())) {
    await injectDropper(page, source).catch((error) => {
      log('initial inject failed', { message: String(error?.message || error) });
    });
  }

  log('watch harness ready', {
    cdp: `http://127.0.0.1:${CDP_PORT}`,
    status: `http://127.0.0.1:${STATUS_PORT}/`,
    latest: LATEST_PATH,
    url: page.url(),
  });

  const tick = async () => {
    try {
      if (!page || page.isClosed()) {
        page = context.pages().find((item) => /twitch\.tv/i.test(item.url())) || context.pages()[0] || null;
        if (!page) {
          log('waiting for Twitch page');
          return;
        }
      }
      if (/twitch\.tv/i.test(page.url())) {
        await injectDropper(page, source).catch(() => null);
      }
      const token = await page.evaluate(() => {
        try {
          const match = document.cookie.match(/(?:^|; )auth-token=([^;]*)/);
          return Boolean(match?.[1]);
        } catch (_) {
          return false;
        }
      }).catch(() => false);
      const mounted = await page.evaluate(() => Boolean(window.dropperDebug || document.getElementById('tdh-root'))).catch(() => false);
      let summary = null;
      if (mounted) {
        const dump = await dumpDiagnostics(page);
        summary = dump.summary;
        if (summary?.unhealthy) {
          log('UNHEALTHY', summary);
        } else {
          log('ok', {
            statusText: summary?.statusText || null,
            drop: summary?.dropName || null,
            percent: summary?.dropPercent ?? null,
            game: summary?.dropGame || null,
            gqlError: summary?.gqlError || null,
          });
        }
      } else {
        log('waiting for Dropper mount', { url: page.url(), loggedIn: token });
      }
      latestState = {
        ...latestState,
        updatedAt: new Date().toISOString(),
        pageUrl: page.url(),
        loggedIn: token,
        dropperMounted: mounted,
        summary,
      };
      writeJson(STATUS_PATH, latestState);
    } catch (error) {
      log('tick error', { message: String(error?.message || error) });
    }
  };

  await tick();
  if (once) {
    await context.close();
    server.close();
    return;
  }

  setInterval(tick, POLL_MS);

  process.on('SIGINT', async () => {
    log('shutting down');
    server.close();
    await context.close().catch(() => null);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
