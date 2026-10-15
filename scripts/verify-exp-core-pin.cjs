'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'vendor', 'exp-core');
const pin = fs.readFileSync(path.join(vendor, 'PIN'), 'utf8').trim();

if (!/^v\d+\.\d+\.\d+$/.test(pin)) {
  throw new Error(`Invalid exp-core pin: ${pin || '(empty)'}`);
}

const mappings = [
  ['exp-core.js', 'dist/exp-core.js'],
  ['manifest.json', 'dist/manifest.json'],
];

// A product released with a new Core is pushed before that Core is published, so in CI a missing tag is
// waited for instead of failing the run. Local checks fail at once.
const waitSeconds = Number(process.env.EXP_CORE_PIN_WAIT_SECONDS || (process.env.CI ? 1800 : 0));
const pollSeconds = Number(process.env.EXP_CORE_PIN_POLL_SECONDS || 30);
const deadline = Date.now() + waitSeconds * 1000;

async function fetchPinned(remotePath) {
  const url = `https://raw.githubusercontent.com/ExtraPotions/exp-core/${pin}/${remotePath}`;
  for (;;) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ExtraPotions-exp-core-pin-check' },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 404 || Date.now() + pollSeconds * 1000 > deadline) {
      throw new Error(`Could not fetch ${pin}/${remotePath}: HTTP ${response.status}`);
    }
    console.log(`Waiting for exp-core ${pin} to be published (${remotePath} is not there yet).`);
    await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
  }
}

(async () => {
  for (const [localName, remotePath] of mappings) {
    const local = fs.readFileSync(path.join(vendor, localName));
    const remote = await fetchPinned(remotePath);
    if (!local.equals(remote)) {
      throw new Error(`Vendored exp-core drift: vendor/exp-core/${localName} does not match ${pin}/${remotePath}`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'));
  if (`v${manifest.coreVersion}` !== pin) {
    throw new Error(`Vendored exp-core manifest reports v${manifest.coreVersion}, expected ${pin}`);
  }

  console.log(`Vendored exp-core matches ${pin} byte-for-byte.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
