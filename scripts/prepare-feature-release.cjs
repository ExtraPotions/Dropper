'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const write = (relative, value) => fs.writeFileSync(path.join(root, relative), value);
const bumpPatch = version => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || ''));
  if (!match) throw new Error(`Unsupported product version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};
const replaceRequired = (text, pattern, replacement, label) => {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`Could not update ${label}`);
  return next;
};

const rawNotes = process.env.RELEASE_NOTES_JSON || '';
if (!rawNotes) throw new Error('RELEASE_NOTES_JSON is required for a feature release');
let notes;
try { notes = JSON.parse(rawNotes); } catch { throw new Error('RELEASE_NOTES_JSON must be valid JSON'); }
if (!Array.isArray(notes) || notes.length < 1 || notes.length > 4 || notes.some(note => typeof note !== 'string' || !note.trim())) {
  throw new Error('Feature releases require 1-4 non-empty release-note strings');
}
notes = notes.map(note => note.trim());

const pkg = JSON.parse(read('package.json'));
const previous = pkg.version;
const next = String(process.env.RELEASE_VERSION || bumpPatch(previous));
if (!/^\d+\.\d+\.\d+$/.test(next) || next === previous) throw new Error(`Invalid release version: ${next}`);
const date = new Date().toISOString().slice(0, 10);

pkg.version = next;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

const lock = JSON.parse(read('package-lock.json'));
lock.version = next;
if (lock.packages?.['']) lock.packages[''].version = next;
write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

let source = read('src/dropper.user.js');
source = replaceRequired(source, /^\/\/ @version\s+\S+/m, `// @version      ${next}`, 'userscript metadata version');
const escapedPrevious = previous.replace(/\./g, '\\.');
source = replaceRequired(
  source,
  new RegExp(`const APP_VERSION = ["']${escapedPrevious}["'];`),
  `const APP_VERSION = "${next}";`,
  'APP_VERSION',
);
const marker = /const RELEASE_NOTES = \{\n/;
if (!marker.test(source)) throw new Error('Could not locate RELEASE_NOTES');
source = source.replace(marker, match => match + `    "${next}": [${notes.map(JSON.stringify).join(',')}],\n`);
write('src/dropper.user.js', source);

let changelog = read('CHANGELOG.md');
const section = `## ${next} — ${date}\n\n${notes.map(note => `- ${note}`).join('\n')}\n\n`;
if (!changelog.startsWith(`## ${next} `)) changelog = section + changelog;
write('CHANGELOG.md', changelog);

console.log(`Prepared Dropper ${next} feature release from ${previous} with ${notes.length} release notes.`);
