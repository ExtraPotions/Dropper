'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const installPath = path.join(root, 'dropper.user.js');

// Ideal install size is 100–150 KB; auth + campaign import helpers need more room.
// Shipped single-file ceiling is 2 MB.
const MAX_INSTALL_BYTES = 2 * 1024 * 1024;

test('dropper.user.js is a direct install with no @resource entries', () => {
  const install = fs.readFileSync(installPath, 'utf8');
  assert.match(install, /^\/\/ ==UserScript==/u);
  assert.match(install, /#tdh-settings-launcher/u);
  assert.match(install, /fl-tool-title">Drops</u);
  assert.match(install, /@version\s+3.2.18/u);
  assert.deepEqual(Buffer.from(install.match(/^\/\/ @icon\s+data:image\/svg\+xml;base64,(.+)$/m)[1], 'base64'), fs.readFileSync(path.join(root, 'assets/dropper-icon.svg')));
  assert.doesNotMatch(install, /^\/\/ @resource\s/m);
  assert.doesNotMatch(install, /^\/\/ @grant\s+GM_getResourceText/m);
  assert.doesNotMatch(install, /GM_getResourceText/u);
  assert.doesNotMatch(install, /expPart\d+/u);
});

test('dropper.user.js stays within the defensible single-file size ceiling', () => {
  const bytes = fs.statSync(installPath).size;
  assert.ok(
    bytes <= MAX_INSTALL_BYTES,
    `dropper.user.js is ${bytes} bytes; ceiling is ${MAX_INSTALL_BYTES} bytes`,
  );
});

test('dropper.user.js stays readable below the 2 MB minify threshold', () => {
  const bytes = fs.statSync(installPath).size;
  const install = fs.readFileSync(installPath, 'utf8');
  assert.ok(bytes <= MAX_INSTALL_BYTES, `dropper.user.js is ${bytes} bytes; minify only above ${MAX_INSTALL_BYTES} bytes`);
  assert.match(install, /function twitchDropsHelper/u);
});

test('dropper.user.js records a reproducible SHA256', () => {
  const install = fs.readFileSync(installPath, 'utf8');
  const sha256 = crypto.createHash('sha256').update(install).digest('hex');
  assert.match(sha256, /^[0-9a-f]{64}$/u);
});
