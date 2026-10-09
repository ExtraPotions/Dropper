'use strict';

// README screenshots, captured by exp-core's shared tool: npm run screenshots

// Twitch campaign data is not available offline, so the progress card shows sample values.
async function paintSampleProgress(page, host) {
  await host.evaluate(node => {
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
  // The progress bar animates its width; let it settle so captures are repeatable.
  await page.waitForTimeout(600);
}

module.exports = {
  build: ['scripts/assemble-parts.cjs', 'scripts/minify-dist.cjs'],
  userscript: 'dropper.user.js',
  host: '#tdh-root',
  url: 'https://www.twitch.tv/sample_streamer',
  page: '<!doctype html><html><head><title>Twitch</title></head><body style="margin:0;background:#0e0e10"></body></html>',
  viewport: { width: 960, height: 1400 },
  // A placeholder sign-in cookie keeps the menu out of its signed-out state.
  cookies: [{ name: 'auth-token', value: 'sample', domain: '.twitch.tv', path: '/' }],
  // Let Dropper finish starting up before the first capture.
  setup: page => page.waitForTimeout(1600),
  shots: [
    { file: 'drops-menu.png', section: 'Drops', tab: 'Progress', before: paintSampleProgress },
    { file: 'streams-menu.png', section: 'Streams', tab: 'Playback', before: paintSampleProgress },
  ],
};
