'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      Accept: '*/*',
      'User-Agent': 'ExtraPotions-exp-core-sync',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

(async () => {
  const tag = await resolveTag();
  const base = `https://raw.githubusercontent.com/ExtraPotions/exp-core/${tag}/dist`;
  const [bundle, manifestBytes] = await Promise.all([
    fetchBuffer(`${base}/exp-core.js`),
    fetchBuffer(`${base}/manifest.json`),
  ]);
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
