'use strict';

/**
 * Inject Twitch session cookies into the running Dropper watch Chrome (CDP :9333)
 * or into .watch-profile for the next harness start.
 *
 * From your real browser (logged into Twitch):
 *   DevTools → Application → Cookies → https://www.twitch.tv
 *   Copy values for: auth-token  (required), unique_id (optional)
 *
 * Then either:
 *   echo 'YOUR_AUTH_TOKEN' > artifacts/diagnostics/auth-token.txt
 *   node scripts/watch-import-auth.cjs
 *
 * Or:
 *   DROPPER_AUTH_TOKEN='...' node scripts/watch-import-auth.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIAG_DIR = path.join(ROOT, 'artifacts', 'diagnostics');
const TOKEN_FILE = path.join(DIAG_DIR, 'auth-token.txt');
const UNIQUE_FILE = path.join(DIAG_DIR, 'unique-id.txt');
const CDP = process.env.DROPPER_WATCH_CDP || 'http://127.0.0.1:9333';

function readToken() {
  const fromEnv = String(process.env.DROPPER_AUTH_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  if (fs.existsSync(TOKEN_FILE)) return String(fs.readFileSync(TOKEN_FILE, 'utf8')).trim();
  return '';
}

function readUniqueId() {
  const fromEnv = String(process.env.DROPPER_UNIQUE_ID || '').trim();
  if (fromEnv) return fromEnv;
  if (fs.existsSync(UNIQUE_FILE)) return String(fs.readFileSync(UNIQUE_FILE, 'utf8')).trim();
  return '';
}

async function main() {
  const authToken = readToken();
  if (!authToken) {
    console.error(`Missing auth-token.
Put it in ${TOKEN_FILE}
or set DROPPER_AUTH_TOKEN.`);
    process.exit(1);
  }

  const uniqueId = readUniqueId();
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context on CDP — is watch-dropper running?');

  const cookies = [
    {
      name: 'auth-token',
      value: authToken,
      domain: '.twitch.tv',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ];
  if (uniqueId) {
    cookies.push(
      {
        name: 'unique_id',
        value: uniqueId,
        domain: '.twitch.tv',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      },
      {
        name: 'unique_id_durable',
        value: uniqueId,
        domain: '.twitch.tv',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      },
    );
  }

  await context.addCookies(cookies);

  let page = context.pages().find((item) => /twitch\.tv/i.test(item.url())) || context.pages()[0];
  if (!page) page = await context.newPage();
  await page.goto('https://www.twitch.tv/drops/inventory', { waitUntil: 'domcontentloaded', timeout: 60000 });

  const ok = await page.evaluate(() => Boolean(document.cookie.match(/(?:^|; )auth-token=/)));
  console.log(JSON.stringify({
    ok,
    url: page.url(),
    hasAuthCookie: ok,
    uniqueIdImported: Boolean(uniqueId),
  }, null, 2));

  // Leave the CDP browser running; do not close.
  await browser.close().catch(() => null);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
