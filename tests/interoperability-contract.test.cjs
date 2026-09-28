'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Dropper delegates its flagship suite contract to Core', () => {
  const source = read('src/dropper.user.js');
  assert.match(source, /registerSuiteProduct\?\./u);
  assert.match(source, /productId:\s*"dropper"/u);
  const block = source.slice(source.indexOf('registerSuiteProduct?.({'), source.indexOf('registerDiagnosticsProduct'));
  assert.doesNotMatch(block, /role\s*:/u);
  assert.doesNotMatch(block, /capabilities\s*:/u);
  assert.doesNotMatch(block, /twitch\.drops/u);
});

test('generated Dropper userscript carries the delegated suite registration', () => {
  const built = read('dropper.user.js');
  assert.match(built, /productId:\s*"dropper"/u);
  const block = built.slice(built.indexOf('registerSuiteProduct?.({'), built.indexOf('registerDiagnosticsProduct'));
  assert.doesNotMatch(block, /role\s*:/u);
  assert.doesNotMatch(block, /capabilities\s*:/u);
});
