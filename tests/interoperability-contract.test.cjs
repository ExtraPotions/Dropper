'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Dropper declares flagship suite interoperability capabilities', () => {
  const source = read('src/dropper.user.js');
  assert.match(source, /registerSuiteProduct\?\./u);
  assert.match(source, /role:\s*"flagship"/u);
  for (const capability of ['twitch.drops', 'twitch.campaigns', 'twitch.progress', 'twitch.claims', 'twitch.stream-management']) {
    assert.match(source, new RegExp(capability.replace('.', '\\.')));
  }
});

test('generated Dropper userscript carries the same suite declaration', () => {
  const built = read('dropper.user.js');
  assert.match(built, /productId:\s*"dropper"/u);
  assert.match(built, /role:\s*"flagship"/u);
  assert.match(built, /twitch\.drops/u);
});
