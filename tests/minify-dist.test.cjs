'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  MINIFY_THRESHOLD_BYTES,
  minifyUserscript,
  shouldMinify,
} = require('../scripts/minify-dist.cjs');

const SAMPLE_SOURCE = [
  '// ==UserScript==',
  '// @name Dropper',
  '// @version 3.1.9',
  '// ==/UserScript==',
  '',
  'function twitchDropsHelper() {',
  '  const readableName = "Dropper";',
  '  return readableName;',
  '}',
  '',
].join('\n');

function tempPair(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    input: path.join(dir, 'src.user.js'),
    output: path.join(dir, 'dropper.user.js'),
  };
}

test('minify threshold is 2 MB exclusive', () => {
  assert.equal(MINIFY_THRESHOLD_BYTES, 2 * 1024 * 1024);
  assert.equal(shouldMinify(0), false);
  assert.equal(shouldMinify(MINIFY_THRESHOLD_BYTES), false);
  assert.equal(shouldMinify(MINIFY_THRESHOLD_BYTES + 1), true);
});

test('build copies readable source below the minify threshold', async () => {
  const { input, output } = tempPair('dropper-build-');
  fs.writeFileSync(input, SAMPLE_SOURCE);
  const stats = await minifyUserscript(input, output);
  const built = fs.readFileSync(output, 'utf8');
  assert.equal(stats.minified, false);
  assert.equal(built, SAMPLE_SOURCE);
  assert.match(built, /function twitchDropsHelper/u);
  assert.match(built, /const readableName/u);
});

test('build minifies only when the source exceeds the threshold', async () => {
  const { input, output } = tempPair('dropper-minify-');
  fs.writeFileSync(input, SAMPLE_SOURCE);
  const stats = await minifyUserscript(input, output, { thresholdBytes: 1 });
  const built = fs.readFileSync(output, 'utf8');
  assert.equal(stats.minified, true);
  assert.doesNotMatch(built, /function twitchDropsHelper/u);
  assert.match(built, /@version 3\.1\.9/u);
  assert.match(built, /Dropper/u);
});
