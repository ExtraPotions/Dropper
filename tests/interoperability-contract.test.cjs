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


test('Dropper publishes compact non-identifying suite state', () => {
  const source = read('src/dropper.user.js');
  assert.match(source, /ExtraPotionsCore\.publishSuiteState\("dropper", "dropper\.state-changed"/u);
  assert.match(source, /activeReward/u);
  assert.match(source, /progressPercent/u);
  assert.match(source, /routingState/u);
  assert.doesNotMatch(source.slice(source.indexOf('publishSuiteState("dropper"'), source.indexOf('refreshOpenCampaignList();', source.indexOf('publishSuiteState("dropper"'))), /streamer|login|rewardName|title|account/i);
});

test('Dropper reaches Core through the bundle-local binding, never an unassigned global', () => {
  assert.doesNotMatch(read('src/dropper.user.js'), /globalThis\.ExtraPotionsCore/u);
});
