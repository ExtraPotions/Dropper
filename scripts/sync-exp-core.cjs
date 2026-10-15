'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'vendor', 'exp-core');
const explicitTag = String(process.argv[2] || '').trim();

function validateTag(tag) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Invalid exp-core tag: ${tag || '(empty)'}`);
  return tag;
}

async function resolveTag() {
  if (explicitTag) return validateTag(explicitTag);
  const response = await fetch('https://api.github.com/repos/ExtraPotions/exp-core/releases/latest', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ExtraPotions-exp-core-sync',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Could not resolve latest exp-core release: HTTP ${response.status}`);
  const payload = await response.json();
  return validateTag(String(payload.tag_name || ''));
}

async function fetchBuffer(url, tag, signal) {
  const wait = process.env.CI ? Number(process.env.EXP_CORE_SYNC_WAIT_SECONDS || 300) * 1000 : 0;
  const poll = Number(process.env.EXP_CORE_SYNC_POLL_SECONDS || 15) * 1000;
  const deadline = Date.now() + wait;
  for (;;) {
    signal.throwIfAborted();
    const response = await fetch(url, {
      headers: {
        Accept: '*/*',
        'User-Agent': 'ExtraPotions-exp-core-sync',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const remaining = deadline - Date.now();
    if (response.status !== 404 || !(remaining > 0)) throw new Error(`Request failed: HTTP ${response.status} ${url}`);
    console.log(`Waiting for exp-core ${tag} files`);
    await delay(Math.min(poll, remaining), undefined, { signal });
  }
}

(async () => {
  const tag = await resolveTag();
  const base = `https://raw.githubusercontent.com/ExtraPotions/exp-core/${tag}/dist`;
  const controller = new AbortController();
  const [bundle, manifestBytes] = await Promise.all([
    fetchBuffer(`${base}/exp-core.js`, tag, controller.signal),
    fetchBuffer(`${base}/manifest.json`, tag, controller.signal),
  ]).catch(error => { controller.abort(); throw error; });
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (`v${manifest.coreVersion}` !== tag) {
    throw new Error(`Published exp-core manifest reports v${manifest.coreVersion}, expected ${tag}`);
  }
  fs.mkdirSync(vendor, { recursive: true });
  fs.writeFileSync(path.join(vendor, 'PIN'), `${tag}\n`);
  fs.writeFileSync(path.join(vendor, 'exp-core.js'), bundle);
  fs.writeFileSync(path.join(vendor, 'manifest.json'), manifestBytes);
  console.log(`Synced vendored exp-core to ${tag}.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
