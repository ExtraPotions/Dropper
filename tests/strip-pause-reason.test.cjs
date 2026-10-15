'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../src/parts/07-markup-lists-and-appearance.js', 'utf8');
function extract(name) { const start = source.indexOf('  function ' + name + '('), rest = source.slice(start), end = rest.slice(4).search(/^  (?:async )?function \w+\(/m); assert.ok(start >= 0, name); return rest.slice(0, end + 4); }
const context = vm.createContext({});
vm.runInContext(extract('briefAge') + extract('stripPauseReason'), context);
const reason = (presentation, health = {}, eligibility = {}) => { const value = context.stripPauseReason(presentation, health, eligibility); return value && { text: value.text, tone: value.tone }; };

test('the strip names why Twitch is not counting', () => {
  assert.deepEqual(reason({ label: 'Progress stalled', tone: 'bad' }, { creditedProgressAgeMs: 14 * 60000 }), { text: 'Stalled · no credit for 14m', tone: 'bad' });
  assert.deepEqual(reason({ label: 'Progress stalled', tone: 'bad' }, {}), { text: 'Stalled · no new credit', tone: 'bad' });
  assert.deepEqual(reason({ label: 'Wrong category', tone: 'warn' }, { streamGame: 'Just Chatting' }), { text: 'Wrong category · Just Chatting', tone: 'warn' });
  assert.deepEqual(reason({ label: 'Wrong category', tone: 'warn' }, {}), { text: 'Wrong category', tone: 'warn' });
  assert.deepEqual(reason({ label: 'Stream offline', tone: 'bad' }), { text: 'Stream offline', tone: 'bad' });
});

test('blocked rewards say what blocks them', () => {
  const blocked = code => reason({ label: 'Not eligible', tone: 'bad' }, {}, { code });
  assert.deepEqual(blocked('account-link'), { text: 'Account not linked · moving on', tone: 'warn' });
  assert.deepEqual(blocked('participation'), { text: 'Not eligible for this campaign', tone: 'bad' });
  assert.deepEqual(blocked('expired'), { text: 'Campaign ended', tone: 'bad' });
  assert.deepEqual(blocked('paid-requirement'), { text: 'Paid reward excluded', tone: 'bad' });
  assert.deepEqual(blocked('deadline-risk'), { text: 'May not finish in time', tone: 'warn' });
});

test('normal earning and ordinary waiting keep the usual line', () => {
  for (const label of ['Verified', 'Eligible stream', 'Waiting for Twitch', 'Not verified', 'No active Drop']) assert.equal(reason({ label, tone: 'warn' }), null, label);
});
