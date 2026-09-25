'use strict';
const fs = require('node:fs');
const path = require('node:path');

function loadDropperSource(root = path.resolve(__dirname, '..')) {
  const sourcePath = path.join(root, 'src', 'dropper.user.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  if (!source.includes('function twitchDropsHelper') || !source.includes('#tdh-settings-launcher')) {
    throw new Error('Dropper source is incomplete');
  }
  return source;
}

module.exports = { loadDropperSource };
