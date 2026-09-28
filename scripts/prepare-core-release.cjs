'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const product = 'Dropper';

function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }
function write(relative, value) { fs.writeFileSync(path.join(root, relative), value); }
function exists(relative) { return fs.existsSync(path.join(root, relative)); }
function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || ''));
  if (!match) throw new Error(`Unsupported product version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
function replaceRequired(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`Could not update ${label}`);
  return next;
}

const pkg = JSON.parse(read('package.json'));
const previous = pkg.version;
const next = bumpPatch(previous);
const coreTag = read('vendor/exp-core/PIN').trim();
if (!/^v\d+\.\d+\.\d+$/.test(coreTag)) throw new Error(`Invalid exp-core pin: ${coreTag}`);
const coreVersion = coreTag.slice(1);
const date = new Date().toISOString().slice(0, 10);

pkg.version = next;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

const lock = JSON.parse(read('package-lock.json'));
lock.version = next;
if (lock.packages?.['']) lock.packages[''].version = next;
write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

let source = read('src/dropper.user.js');
source = replaceRequired(
  source,
  /^\/\/ @version\s+\S+/m,
  `// @version      ${next}`,
  'Dropper userscript metadata version',
);
const escapedPrevious = previous.replace(/\./g, '\\.');
source = replaceRequired(
  source,
  new RegExp(`const APP_VERSION = ["']${escapedPrevious}["'];`),
  `const APP_VERSION = "${next}";`,
  'Dropper APP_VERSION',
);
const releaseEntry = `    "${next}": ["Updates the shared foundation to exp-core ${coreVersion}.","Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.","Keeps Twitch routing, campaign, claim, and playback behavior unchanged.","Keeps the standalone userscript distribution while Core remains the single shared source."],\n`;
const releaseMarker = /const RELEASE_NOTES = \{\n/;
if (!releaseMarker.test(source)) throw new Error('Could not locate Dropper RELEASE_NOTES');
source = source.replace(releaseMarker, match => match + releaseEntry);
write('src/dropper.user.js', source);

let changelog = read('CHANGELOG.md');
const heading = `## ${next} — ${date}\n\n`;
const body = [
  `- Updates the shared foundation to exp-core ${coreVersion}.`,
  '- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.',
  '- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.',
  '- Keeps the standalone userscript distribution while Core remains the single shared source.',
  '',
].join('\n');
if (!changelog.startsWith(`## ${next} `)) changelog = heading + body + '\n' + changelog;
write('CHANGELOG.md', changelog);

console.log(`Prepared Dropper ${next} for exp-core ${coreVersion} (from ${previous}).`);
