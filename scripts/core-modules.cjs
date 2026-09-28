'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CORE_BUNDLE = path.join(ROOT, 'vendor', 'exp-core', 'exp-core.js');

const BLOCKS = Object.freeze({
  menuArrangement: {
    symbol: 'ExpMenuArrangement',
    begin: '  // BEGIN SHARED MENU ARRANGEMENT',
    end: '  // END SHARED MENU ARRANGEMENT',
  },
  diagnostics: {
    symbol: 'ExtraPotionsDiagnostics',
    begin: '  // BEGIN SHARED DIAGNOSTICS',
    end: '  // END SHARED DIAGNOSTICS',
  },
  productTools: {
    symbol: 'ExtraPotionsTools',
    begin: '  // BEGIN SHARED PRODUCT TOOLS',
    end: '  // END SHARED PRODUCT TOOLS',
  },
});

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function readCoreBundle(root = ROOT) {
  return normalize(fs.readFileSync(path.join(root, 'vendor', 'exp-core', 'exp-core.js'), 'utf8'));
}

function readCoreModule(name, root = ROOT) {
  const block = BLOCKS[name];
  if (!block) throw new Error(`Unknown exp-core module: ${name}`);
  const bundle = readCoreBundle(root);
  const declaration = `const ${block.symbol} = (() => {`;
  const start = bundle.indexOf(declaration);
  if (start < 0) throw new Error(`Pinned exp-core is missing ${block.symbol}`);
  const end = bundle.indexOf('\n})();', start);
  if (end < 0) throw new Error(`Pinned exp-core has an incomplete ${block.symbol} module`);
  return bundle.slice(start, end + '\n})();'.length).trim();
}

function replaceBlock(source, name, body) {
  const block = BLOCKS[name];
  const start = source.indexOf(block.begin);
  const end = source.indexOf(block.end, start);
  if (start < 0 || end < 0) throw new Error(`Dropper source is missing ${name} Core markers`);
  const after = end + block.end.length;
  return source.slice(0, start)
    + block.begin + '\n'
    + body.trim() + '\n'
    + block.end
    + source.slice(after);
}

function assembleDropperSource(source, root = ROOT) {
  let assembled = normalize(source);
  for (const name of Object.keys(BLOCKS)) {
    assembled = replaceBlock(assembled, name, readCoreModule(name, root));
  }
  return assembled;
}

function placeholderDropperSource(source) {
  let template = normalize(source);
  for (const [name, block] of Object.entries(BLOCKS)) {
    template = replaceBlock(template, name, `// populated from pinned exp-core: ${name}`);
  }
  return template;
}

module.exports = {
  BLOCKS,
  CORE_BUNDLE,
  assembleDropperSource,
  placeholderDropperSource,
  readCoreBundle,
  readCoreModule,
};
