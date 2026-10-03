'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assembleDropperSource } = require('../scripts/core-modules.cjs');

function loadDropperSource(root = path.resolve(__dirname, '..')) {
  const sourcePath = path.join(root, 'src', 'dropper.user.js');
  const source = assembleDropperSource(fs.readFileSync(sourcePath, 'utf8'), root);
  if (!source.includes('function twitchDropsHelper') || !source.includes('#tdh-settings-launcher')) {
    throw new Error('Dropper source is incomplete');
  }
  return source;
}

module.exports = { loadDropperSource };

function loadActiveViewing() {
  const vm = require('node:vm');
  const context = {};
  const module = fs.readFileSync(path.join(__dirname, '../src/active-viewing.js'), 'utf8');
  vm.runInNewContext(module + '\nthis.active = DropperActiveViewing;', context);
  return context.active;
}
module.exports.loadActiveViewing = loadActiveViewing;
