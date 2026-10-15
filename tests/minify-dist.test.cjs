'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  minifyUserscript,
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

test('build minifies even a small install and preserves readable input', async () => {
  const { input, output } = tempPair('dropper-build-');
  fs.writeFileSync(input, SAMPLE_SOURCE);
  const stats = await minifyUserscript(input, output);
  const built = fs.readFileSync(output, 'utf8');
  assert.equal(stats.minified, true);
  assert.equal(fs.readFileSync(input, 'utf8'), SAMPLE_SOURCE);
  assert.doesNotMatch(built, /function twitchDropsHelper/u);
  assert.match(built, /@version 3\.1\.9/u);
  assert.ok(stats.outputBytes < stats.originalBytes);
});

test('build produces deterministic minified output', async () => {
  const { input, output } = tempPair('dropper-minify-');
  fs.writeFileSync(input, SAMPLE_SOURCE);
  const stats = await minifyUserscript(input, output);
  const first = fs.readFileSync(output);
  await minifyUserscript(input, output);
  assert.deepEqual(fs.readFileSync(output), first);
  const built = fs.readFileSync(output, 'utf8');
  assert.equal(stats.minified, true);
  assert.doesNotMatch(built, /function twitchDropsHelper/u);
  assert.match(built, /@version 3\.1\.9/u);
  assert.match(built, /Dropper/u);
});
