'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = process.env.DROPPER_SCREENSHOT_DIR || path.join(ROOT, 'docs', 'screenshots');
const SCREENSHOT_THEME = /^(warm|twitch)$/.test(process.env.DROPPER_SCREENSHOT_THEME || '')
  ? process.env.DROPPER_SCREENSHOT_THEME : 'twitch';
const INSTALL_PATH = path.join(ROOT, 'dropper.user.js');

const MENU_SHOTS = [
  { id: 'tdh-drops-body', file: 'drops-menu.png', caption: 'Drops menu', extra: 'inventory' },
  { id: 'tdh-streams-body', file: 'streams-menu.png', caption: 'Streams menu', extra: 'queue' },
  { id: 'tdh-progress-body', file: 'appearance-menu.png', caption: 'Appearance menu' },
  { id: 'tdh-diagnostics-body', file: 'diagnostics-menu.png', caption: 'Diagnostics menu', extra: 'diagnostics' },
];

async function injectDropper(page) {
  await page.addInitScript(() => {
    window.GM_xmlhttpRequest = ({ onload, onerror }) => {
      const response = { status: 204, responseText: '', finalUrl: '' };
      queueMicrotask(() => {
        try {
          onload?.(response);
        } catch (_) {
          onerror?.({ status: 0, responseText: '' });
        }
      });
    };
  });
  await page.route('https://www.twitch.tv/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html>
<html>
<head>
  <title>Twitch</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0e0e10; color: #efeff1; font-family: Inter, "Segoe UI", sans-serif; }
    main { min-height: 100vh; }
    [data-a-target="right-column"] {
      position: fixed; right: 0; top: 0; width: 340px; height: 100vh;
      background: #18181b; border-left: 1px solid #2f2f35;
    }
  </style>
</head>
<body>
  <main aria-label="Dropper screenshot fixture"></main>
  <aside data-a-target="right-column"></aside>
</body>
</html>`,
  }));
  await page.goto('https://www.twitch.tv/dropper-screenshot-fixture');
  await page.addScriptTag({ content: fs.readFileSync(INSTALL_PATH, 'utf8') });
  await page.waitForFunction(
    () => Boolean(document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-tools-dock')),
    null,
    { timeout: 15000 },
  );
}

async function openMenu(page) {
  await page.evaluate(() => window.dropperShow?.());
  await page.waitForFunction(() => {
    const dock = document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-tools-dock');
    return Boolean(dock?.classList.contains('fl-rail-open'));
  }, null, { timeout: 5000 });
}

async function closeMenu(page) {
  await page.evaluate(() => {
    const launcher = document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-settings-launcher');
    if (launcher?.getAttribute('aria-expanded') === 'true') launcher.click();
  });
  await page.waitForFunction(() => {
    const dock = document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-tools-dock');
    return Boolean(dock) && !dock.classList.contains('fl-rail-open');
  }, null, { timeout: 5000 });
}

async function setTwitchFullWidth(page) {
  await page.evaluate((theme) => {
    const shadow = document.getElementById('tdh-root')?.shadowRoot;
    shadow?.querySelector(`.exp-theme-swatch[data-theme="${theme}"]`)?.click();
    const width = shadow?.getElementById('tdh-collapsed-width');
    if (width) {
      width.value = 'full';
      width.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, SCREENSHOT_THEME);
  await page.waitForTimeout(160);
}

async function paintProgressFixture(page) {
  await page.evaluate(() => {
    const shadow = document.getElementById('tdh-root')?.shadowRoot;
    if (!shadow) return;
    const set = (id, text) => {
      const node = shadow.getElementById(id);
      if (node) node.textContent = text;
    };
    set('tdh-stream-channel', 'Dropper Fixture');
    set('tdh-stream-game', 'Twitch Drops');
    set('tdh-drop-percent', '47%');
    set('tdh-drop-meta', '47 / 100 min');
    set('tdh-drop-name', 'Campaign Reward');
    set('tdh-drop-state', 'Earning');
    set('tdh-updated-ago', 'Checked 12s ago');
    const fill = shadow.getElementById('tdh-drop-fill');
    if (fill) fill.style.width = '47%';
    const percent = shadow.getElementById('tdh-drop-percent');
    if (percent) percent.style.color = '#bf94ff';
    const ring = shadow.getElementById('tdh-ring');
    if (ring) {
      ring.setAttribute('stroke-dasharray', '47 100');
      ring.style.stroke = '#9147ff';
    }
    const pill = shadow.getElementById('tdh-drop-state');
    if (pill) pill.className = 'state-pill good';
    const skip = shadow.getElementById('tdh-skip-streamer');
    if (skip) {
      skip.disabled = false;
      skip.setAttribute('aria-label', 'Skip Dropper Fixture');
    }
  });
}

async function expandPanel(page, panelId, extra) {
  await page.evaluate(({ panelId, extra }) => {
    const shadow = document.getElementById('tdh-root')?.shadowRoot;
    if (!shadow) return;
    shadow.querySelectorAll('.fl-tool-header').forEach((header) => {
      const body = shadow.getElementById(header.dataset.panel);
      const open = header.dataset.panel === panelId;
      body?.classList.toggle('fl-tool-hidden', !open);
      const chevron = header.querySelector('.fl-tool-chevron');
      if (chevron) {
        chevron.textContent = open ? '▾' : '▸';
        chevron.setAttribute('aria-expanded', String(open));
      }
      header.classList.toggle('last-opened', open);
    });
    if (extra === 'inventory') {
      const button = shadow.getElementById('tdh-toggle-inventory');
      const inventory = shadow.getElementById('tdh-compact-inventory');
      if (button && !inventory?.classList.contains('open')) button.click();
    }
    if (extra === 'queue') {
      shadow.getElementById('tdh-queue-details')?.setAttribute('open', '');
    }
    if (extra === 'diagnostics') {
      const button = shadow.getElementById('tdh-diagnostics-toggle');
      const diag = shadow.getElementById('tdh-diagnostics');
      if (button && !diag?.classList.contains('open')) button.click();
    }
  }, { panelId, extra: extra || '' });
  await page.waitForTimeout(180);
}

async function pinClusterTop(page) {
  await page.evaluate(() => {
    const cluster = document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-cluster');
    if (!cluster) return;
    cluster.classList.add('open-up');
    cluster.style.top = '12px';
    cluster.style.bottom = 'auto';
  });
  await page.waitForTimeout(80);
}

async function clusterBox(page) {
  return page.evaluate(() => {
    const shadow = document.getElementById('tdh-root')?.shadowRoot;
    const cluster = shadow?.getElementById('tdh-cluster');
    if (!cluster) return null;
    const rect = cluster.getBoundingClientRect();
    return {
      x: Math.max(0, Math.floor(rect.x - 10)),
      y: Math.max(0, Math.floor(rect.y - 10)),
      width: Math.ceil(rect.width + 20),
      height: Math.ceil(rect.height + 20),
    };
  });
}

async function captureCluster(page, outputPath) {
  await pinClusterTop(page);
  const box = await clusterBox(page);
  if (!box) throw new Error('Dropper cluster was not found for screenshot capture');
  const viewport = page.viewportSize();
  const neededHeight = box.y + box.height + 8;
  if (neededHeight > viewport.height || box.width + box.x > viewport.width) {
    await page.setViewportSize({
      width: Math.max(viewport.width, box.x + box.width + 16),
      height: Math.max(viewport.height, neededHeight),
    });
    await pinClusterTop(page);
  }
  const sized = page.viewportSize();
  const nextBox = await clusterBox(page);
  const clip = {
    x: nextBox.x,
    y: nextBox.y,
    width: Math.min(nextBox.width, sized.width - nextBox.x),
    height: Math.min(nextBox.height, sized.height - nextBox.y),
  };
  if (clip.width < 40 || clip.height < 40) {
    throw new Error(`Cluster clip too small: ${JSON.stringify({ box: nextBox, clip, viewport: sized })}`);
  }
  await page.screenshot({ path: outputPath, clip });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const stale of fs.readdirSync(OUTPUT_DIR).filter((name) => name.endsWith('.png'))) {
    fs.unlinkSync(path.join(OUTPUT_DIR, stale));
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 2400 },
      deviceScaleFactor: 2,
    });
    await injectDropper(page);
    await openMenu(page);
    await setTwitchFullWidth(page);
    await paintProgressFixture(page);

    await closeMenu(page);
    await paintProgressFixture(page);
    await captureCluster(page, path.join(OUTPUT_DIR, 'progress-panel.png'));
    console.log('Captured Progress panel -> docs/screenshots/progress-panel.png');

    await openMenu(page);
    await paintProgressFixture(page);
    for (const shot of MENU_SHOTS) {
      await expandPanel(page, shot.id, shot.extra);
      await paintProgressFixture(page);
      await captureCluster(page, path.join(OUTPUT_DIR, shot.file));
      console.log(`Captured ${shot.caption} -> docs/screenshots/${shot.file}`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
