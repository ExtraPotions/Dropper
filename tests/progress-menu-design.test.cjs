'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const install = fs.readFileSync(path.join(__dirname, '../dropper.user.js'), 'utf8');
function contrast(foreground, background) {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).reduce((sum, channel, index) => {
    const value = channel / 255;
    return sum + [0.2126, 0.7152, 0.0722][index] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  }, 0);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const width of [360, 1280]) for (const size of ['standard', 'large', 'extra-large']) {
  test(`floating progress shares the menu design at ${width}px, ${size}`, async t => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(size => {
      window.GM_xmlhttpRequest = () => {};
      localStorage.setItem('exp:suite:menu-size', size);
    }, size);
    await page.route('https://www.twitch.tv/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Twitch fixture</title><body></body>',
    }));
    await page.goto('https://www.twitch.tv/dropper-design-fixture');
    await page.addScriptTag({ content: install });
    await page.waitForFunction(() => document.getElementById('tdh-root')?.shadowRoot?.getElementById('tdh-drop-card'));
    await page.waitForTimeout(100);
    const facts = await page.evaluate(() => {
      const root = document.getElementById('tdh-root').shadowRoot;
      const card = root.getElementById('tdh-drop-card'), menu = root.getElementById('tdh-tools-dock');
      const c = getComputedStyle(card), m = getComputedStyle(menu), box = card.getBoundingClientRect();
      const state = getComputedStyle(root.getElementById('tdh-drop-state'));
      return {
        background: c.backgroundColor, menuBackground: m.backgroundColor,
        border: c.borderTopColor, menuBorder: m.borderTopColor,
        radius: c.borderTopLeftRadius, menuRadius: m.borderTopLeftRadius,
        font: c.fontFamily, menuFont: m.fontFamily,
        texture: getComputedStyle(card, '::before').display,
        weight: getComputedStyle(root.getElementById('tdh-stream-channel')).fontWeight,
        stateShadow: getComputedStyle(root.getElementById('tdh-drop-state'), '::before').boxShadow,
        stateColor: state.color, menuMuted: m.getPropertyValue('--theme-muted').trim(),
        text: getComputedStyle(root.getElementById('tdh-stream-channel')).color,
        muted: getComputedStyle(root.getElementById('tdh-drop-meta')).color,
        fits: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      };
    });
    assert.equal(facts.background, facts.menuBackground);
    assert.equal(facts.border, facts.menuBorder);
    assert.equal(facts.radius, facts.menuRadius);
    assert.equal(facts.font, facts.menuFont);
    assert.equal(facts.texture, 'none');
    assert.equal(facts.weight, '600');
    assert.equal(facts.stateShadow, 'none');
    for (const color of [facts.text, facts.muted, facts.stateColor]) assert.ok(contrast(color, facts.background) >= 4.5, `${color} on ${facts.background}`);
    assert.ok(facts.fits, JSON.stringify(facts));
    await page.evaluate(() => window.dropperShow());
    if (width === 1280 && size === 'standard') {
      await page.screenshot({ path: path.join(__dirname, '../../local-verification/dropper-menu-reference-20261011.png') });
    }
    await page.locator('#tdh-root').locator('#tdh-rail-close').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card').dataset.presentation), 'page-card');
    await page.keyboard.press('Alt+g');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-settings-launcher').getAttribute('aria-expanded')), 'false');
    if (width === 1280 && size === 'standard') {
      await page.screenshot({ path: path.join(__dirname, '../../local-verification/dropper-progress-menu-20261011.png') });
    }
    await page.evaluate(() => document.getElementById('tdh-root').shadowRoot.getElementById('tdh-tools-dock').style.setProperty('--theme-bg', '#000000'));
    await page.waitForFunction(() => getComputedStyle(document.getElementById('tdh-root').shadowRoot.getElementById('tdh-drop-card')).backgroundColor === 'rgb(0, 0, 0)');
    assert.deepEqual(errors, []);
  });
}
