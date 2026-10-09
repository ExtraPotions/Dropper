'use strict';

// Regenerates the README screenshots from the built userscript against a local sample Twitch page.
//   npm run capture-screenshots
// Images are captured into a temporary folder first, so a failed run never leaves docs/screenshots half updated.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FINAL_DIR = process.env.DROPPER_SCREENSHOT_DIR || path.join(ROOT, 'docs', 'screenshots');
const HOST = '#tdh-root';

// [section, tab, file]
const SHOTS = [
  ['Drops', 'Progress', 'drops-menu.png'],
  ['Streams', 'Playback', 'streams-menu.png'],
];

const samplePage = '<!doctype html><html><head><title>Twitch</title></head><body style="margin:0;background:#0e0e10"></body></html>';

function gmStub() {
  const values = new Map();
  window.GM_getValue = (key, fallback) => (values.has(key) ? values.get(key) : fallback);
  window.GM_setValue = (key, value) => values.set(key, value);
  window.GM_deleteValue = (key) => values.delete(key);
  window.GM_listValues = () => [...values.keys()];
  window.GM_addValueChangeListener = () => 1;
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = (options) => { queueMicrotask(() => options.onerror?.({ status: 0 })); return { abort() {} }; };
}

// Twitch campaign data is not available offline, so the progress card shows sample values.
async function paintSampleProgress(page) {
  await page.locator(HOST).evaluate((node) => {
    const shadow = node.shadowRoot;
    const set = (id, text, className) => {
      const element = shadow.getElementById(id);
      if (!element) return;
      element.textContent = text;
      if (className) element.className = className;
    };
    set('tdh-stream-channel', 'sample_streamer');
    set('tdh-stream-game', 'Sample Game');
    set('tdh-drop-meta', '28 / 60 min');
    set('tdh-drop-name', 'Sample Reward');
    set('tdh-drop-state', 'Earning', 'state-pill good');
    set('tdh-updated-ago', 'Checked 12s ago');
    set('tdh-eligibility-summary', '✓ Eligible · 32 min remaining');
    set('tdh-eligibility-checklist-summary', 'Ready');
    const eligibility = shadow.getElementById('tdh-reward-eligibility');
    if (eligibility) eligibility.dataset.tone = 'good';
    const fill = shadow.getElementById('tdh-drop-fill');
    if (fill) fill.style.width = '47%';
  });
}

// Use Playwright's bundled Chromium when installed, otherwise the system Edge.
const launch = () => chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }));

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dropper-shots-'));
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 960, height: 1400 }, deviceScaleFactor: 2 });
    // A placeholder sign-in cookie keeps the menu out of its signed-out state.
    await context.addCookies([{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }]);
    const page = await context.newPage();
    await page.addInitScript(gmStub);
    await page.route('**/*', (route) => {
      const asset = route.request().url().match(/raw\.githubusercontent\.com\/ExtraPotions\/Dropper\/main\/(assets\/.+)$/);
      if (asset) return route.fulfill({ path: path.join(ROOT, asset[1]) });
      if (route.request().isNavigationRequest()) return route.fulfill({ status: 200, contentType: 'text/html', body: samplePage });
      return route.abort();
    });
    await page.goto('https://www.twitch.tv/sample_streamer');
    await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'dropper.user.js'), 'utf8') });
    await page.waitForTimeout(2000);
    const host = page.locator(HOST);
    await host.locator('[data-exp-part="launcher"]').click();
    await page.waitForTimeout(400);
    for (const [section, tab, file] of SHOTS) {
      const header = host.locator('.fl-tool-header').filter({ hasText: section });
      if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
      await host.getByRole('tab', { name: tab, exact: true }).click();
      await page.waitForTimeout(300);
      await page.mouse.move(0, 0);
      await paintSampleProgress(page);
      await host.locator('[data-exp-part="dock"]').screenshot({ path: path.join(work, file) });
      console.log(`Captured ${section} > ${tab} -> docs/screenshots/${file}`);
    }
    fs.mkdirSync(FINAL_DIR, { recursive: true });
    for (const [, , file] of SHOTS) fs.copyFileSync(path.join(work, file), path.join(FINAL_DIR, file));
  } finally {
    await browser.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
