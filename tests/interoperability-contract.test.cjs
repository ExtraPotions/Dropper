'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Dropper delegates suite and presentation metadata to Core diagnostics bootstrap', () => {
  const source = read('src/dropper.user.js');
  assert.match(source, /registerDiagnosticsProduct\("dropper"/);
  assert.doesNotMatch(source, /registerSuiteProduct\?\./u);
  assert.doesNotMatch(source, /registerPresentationProvider\?\./u);
});

test('generated Dropper userscript keeps the same Core-owned interoperability bootstrap', () => {
  const built = read('dropper.user.js');
  assert.match(built, /registerDiagnosticsProduct\("dropper"/);
  assert.doesNotMatch(built, /registerSuiteProduct\?\./u);
  assert.doesNotMatch(built, /registerPresentationProvider\?\./u);
});
