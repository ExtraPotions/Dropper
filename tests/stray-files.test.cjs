'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', '.watch-profile', 'test-artifacts', 'artifacts']);
// File-sync tools leave copies such as "name (# Edit conflict 2026-09-29 abc #).js"
// or "name (conflicted copy).js" beside the real file. They must never be committed.
const STRAY = /\((?:#\s*)?[^)]*conflict[^)]*\)|\bconflicted copy\b|\s-\sCopy\b/i;

function walk(directory, found = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (STRAY.test(entry.name)) found.push(path.relative(root, full));
    if (entry.isDirectory()) walk(full, found);
  }
  return found;
}

test('the repository has no sync-conflict or copy files', () => {
  assert.deepEqual(walk(root), []);
});

test('git ignores sync-conflict copies', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /^\*Edit conflict\*$/m);
  assert.match(ignore, /^\*conflicted copy\*$/m);
});
