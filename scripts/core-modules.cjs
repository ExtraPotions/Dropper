'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CORE_BEGIN = '  // BEGIN EXP CORE';
const CORE_END = '  // END EXP CORE';

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function readCoreBundle(root = ROOT) {
  return normalize(fs.readFileSync(path.join(root, 'vendor', 'exp-core', 'exp-core.js'), 'utf8')).trim();
}

function readCoreModule(name, root = ROOT) {
  const symbols = Object.freeze({
    menuArrangement: 'ExpMenuArrangement',
    diagnostics: 'ExtraPotionsDiagnostics',
    productTools: 'ExtraPotionsTools',
  });
  const symbol = symbols[name];
  if (!symbol) throw new Error(`Unknown exp-core module: ${name}`);
  const bundle = readCoreBundle(root);
  const declaration = `const ${symbol} = (() => {`;
  const start = bundle.indexOf(declaration);
  if (start < 0) throw new Error(`Pinned exp-core is missing ${symbol}`);
  const end = bundle.indexOf('\n})();', start);
  if (end < 0) throw new Error(`Pinned exp-core has an incomplete ${symbol} module`);
  return bundle.slice(start, end + '\n})();'.length).trim();
}

function assembleDropperSource(source, root = ROOT) {
  const template = normalize(source);
  const start = template.indexOf(CORE_BEGIN);
  const end = template.indexOf(CORE_END, start);
  if (start < 0 || end < 0) throw new Error('Dropper source is missing the exp-core bundle placeholder');
  const after = end + CORE_END.length;
  return template.slice(0, start)
    + CORE_BEGIN + '\n'
    + readCoreBundle(root) + '\n'
    + CORE_END
    + template.slice(after);
}

module.exports = {
  CORE_BEGIN,
  CORE_END,
  assembleDropperSource,
  readCoreBundle,
  readCoreModule,
};
