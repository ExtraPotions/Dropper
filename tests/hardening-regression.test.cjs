'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadDropperSource } = require('./load-source.cjs');
const source = loadDropperSource();

test('claim selectors are centralized and unsafe automatic actions stay fail closed', () => {
  assert.match(source, /const TWITCH_DOM_SELECTORS = Object\.freeze\(/);
  assert.match(source, /bonusContainer:/);
  assert.match(source, /dropClaim:/);
  assert.match(source, /inventoryCard:/);
  assert.match(source, /function claimTargetRendered\(/);
  assert.match(source, /pointerEvents === 'none'/);
  assert.match(source, /subscribe\|subscription\|gift\|purchase\|buy\|redeem\|spend/);
  assert.match(source, /button\.closest\(TWITCH_DOM_SELECTORS\.bonusContainer\)/);
});

test('same campaign but different known Drop IDs cannot feed locked reward progress', () => {
  const start = source.indexOf('  function dropIdentityMatchesTarget(');
  const end = source.indexOf('\n  function reconcileDropProgress', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {
    cleanText: value => String(value ?? '').trim(),
    campaignRoutingState: () => ({ open: true, reason: 'open' }),
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.match = dropIdentityMatchesTarget;`, context);

  const target = { id: 'target-drop', campaignKey: 'campaign-a' };
  const exact = context.match({ id: 'target-drop', campaignKey: 'campaign-a' }, target);
  assert.equal(exact.matchesTarget, true);
  assert.equal(exact.identityLevel, 'exact-drop');

  const otherReward = context.match({ id: 'other-drop', campaignKey: 'campaign-a' }, target);
  assert.equal(otherReward.campaignMatched, true);
  assert.equal(otherReward.dropMatched, false);
  assert.equal(otherReward.matchesTarget, false);
  assert.equal(otherReward.identityLevel, 'campaign-only-different-drop');
  assert.equal(otherReward.mismatchReason, 'same-campaign-different-drop');

  const campaignFallback = context.match({ campaignKey: 'campaign-a' }, target);
  assert.equal(campaignFallback.matchesTarget, true);
  assert.equal(campaignFallback.identityLevel, 'campaign-fallback');
});

test('stale transient state has bounded lifetime and stale routing storage is removed', () => {
  assert.match(source, /const AUTO_NAVIGATION_IN_FLIGHT_MS = 20 \* 1000/);
  assert.match(source, /const AUTO_NAVIGATION_WINDOW_MS = 60 \* 1000/);
  assert.match(source, /const AUTO_NAVIGATION_LIMIT = 6/);
  assert.match(source, /const HANDOFF_SESSION_TTL_MS = 15 \* 60 \* 1000/);
  assert.match(source, /const STANDBY_CACHE_TTL_MS = 15 \* 60 \* 1000/);
  assert.match(source, /record\.outcome === 'pending' && now\(\) - record\.at >= 45000/);
  assert.match(source, /recoveryAttempts >= 3/);
  assert.match(source, /Number\(state\.expiresAt\) <= now/);
  assert.match(source, /Number\(item\.seenAt \|\| 0\) <= now - STANDBY_CACHE_TTL_MS/);
  assert.match(source, /Date\.now\(\) - Number\(raw\.updatedAt\) > 6 \* 60 \* 60 \* 1000\) \{\s*removeSession\(ROUTING_SESSION_KEY\);/s);
});

test('campaign-level GQL evidence is explicitly distinct from exact reward identity', () => {
  assert.match(source, /gqlSessionIdentityLevel:/);
  assert.match(source, /campaign-only-different-drop/);
  assert.match(source, /sessionRejectedReason: sessionDrop && !sessionEligible/);
  assert.match(source, /sessionIdentity\.mismatchReason \|\| "different-campaign-or-drop"/);
});
