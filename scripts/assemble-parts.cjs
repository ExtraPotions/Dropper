'use strict';

// Dropper's source lives in ordered part files under src/parts/. This script joins
// them, in file-name order and without changing a byte, into src/dropper.user.js,
// which the build, the release scripts, and the tests all read.
//
//   node scripts/assemble-parts.cjs          write src/dropper.user.js
//   node scripts/assemble-parts.cjs --check  fail if src/dropper.user.js is out of date
//
// Edit the parts, not src/dropper.user.js. All parts share one scope inside a single
// function, so order matters: a part may only rely on names defined in earlier parts
// or on function declarations, which are available everywhere.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'src', 'parts');
const OUTPUT = path.join(ROOT, 'src', 'dropper.user.js');
const PART_NAME = /^(\d{2})-[a-z0-9-]+\.js$/;

function listParts(root = ROOT) {
  const directory = path.join(root, 'src', 'parts');
  const names = fs.readdirSync(directory).filter(name => name.endsWith('.js')).sort();
  for (const name of names) {
    if (!PART_NAME.test(name)) throw new Error(`Unexpected file in src/parts: ${name} (expected NN-name.js)`);
  }
  names.forEach((name, index) => {
    if (Number(PART_NAME.exec(name)[1]) !== index) {
      throw new Error(`Part numbers must run 00, 01, 02... without gaps or repeats; found ${name} at position ${index}`);
    }
  });
  return names;
}

function assembleParts(root = ROOT) {
  const directory = path.join(root, 'src', 'parts');
  return listParts(root).map(name => fs.readFileSync(path.join(directory, name), 'utf8')).join('');
}

if (require.main === module) {
  const assembled = assembleParts();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
    if (current !== assembled) {
      console.error('src/dropper.user.js is out of date with src/parts. Run: node scripts/assemble-parts.cjs');
      process.exit(1);
    }
    console.log(`src/dropper.user.js matches ${listParts().length} parts.`);
  } else {
    fs.writeFileSync(OUTPUT, assembled);
    console.log(`Assembled ${listParts().length} parts into src/dropper.user.js (${assembled.length} bytes).`);
  }
}

module.exports = { assembleParts, listParts, PARTS_DIR };
