'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.DROPPER_TEST_SOURCE || path.join(__dirname, '..', 'src', 'dropper.user.js'), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = source.indexOf('\n  function ', start + 1);
  assert.ok(end > start);
  return source.slice(start, end);
}
function context({links = [], stored = {}} = {}) {
  const storage = new Map(Object.entries(stored));
  const cacheKey = source.match(/const CATEGORY_SLUG_CACHE_KEY = "([^"]+)"/)[1];
  const aliases = JSON.parse(source.match(/const CATEGORY_SLUG_ALIASES = Object\.freeze\((\{[\s\S]*?\})\);/)[1].replace(/,\s*}/, '}'));
  const c = {
    URL, Set, Date,
    CATEGORY_SLUG_CACHE_KEY: cacheKey, CATEGORY_SLUG_ALIASES: aliases,
    EXCLUDED_CATEGORY_SLUGS: new Set(['first-partners-collection']),
    EXCLUDED_CAMPAIGN_NAMES: new Set(['first partners collection']),
    cleanText: value => String(value || '').replace(/\s+/g, ' ').trim(),
    location: {href: 'https://www.twitch.tv/ukkiina'},
    document: {querySelector: () => links[0] || null, querySelectorAll: () => links},
    localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
    logActivity: () => {}, categorySlugCache: {}, storage,
  };
  vm.createContext(c);
  for (const name of [
    'normalizeGameName', 'normalizedGameSlug', 'gameNamesMatch',
    'loadCategorySlugCache', 'saveCategorySlugCache', 'categorySlugFromUrl',
    'expectedCategorySlugCandidates', 'categorySlugCoversGame', 'suppliedCategorySlugMatchesGame',
    'campaignGameSlugFallback', 'rememberCategorySlug', 'findObservedCategorySlug', 'resolveCategorySlug',
  ]) vm.runInContext(functionSource(name), c);
  c.categorySlugCache = c.loadCategorySlugCache();
  return c;
}
const pcLink = {textContent: 'World of Tanks', href: 'https://www.twitch.tv/directory/category/world-of-tanks'};
const consoleDrop = {game: 'World of Tanks Console', gameSlug: 'world-of-tanks-console', gameId: '499551'};
test('distinct categories never match through shared title prefixes', () => {
  const c = context();
  for (const [a, b] of [['World of Tanks', 'World of Tanks Console'], ['World of Tanks', 'World of Tanks Blitz'], ['Minecraft', 'Minecraft Dungeons'], ['Overwatch', 'Overwatch 2']]) {
    assert.equal(c.gameNamesMatch(a, b), false, `${a} != ${b}`);
    assert.equal(c.gameNamesMatch(b, a), false, `${b} != ${a}`);
  }
  assert.equal(c.gameNamesMatch('', 'World of Tanks'), false);
});
test('normalization and explicit category aliases still match', () => {
  const c = context();
  assert.equal(c.gameNamesMatch(' WORLD OF TANKS: Console ', 'World of Tanks Console'), true);
  assert.equal(c.gameNamesMatch('Delta Force', 'Delta Force: Hawk Ops'), true);
  assert.equal(c.gameNamesMatch('The Blood of Dawnwalker', 'Dawnwalker'), true);
});
test('supplied slugs cannot substitute a sequel or a different platform', () => {
  const c = context();
  assert.equal(c.suppliedCategorySlugMatchesGame('World of Tanks', 'world-of-tanks-console'), false);
  assert.equal(c.suppliedCategorySlugMatchesGame('World of Tanks Console', 'world-of-tanks'), false);
  assert.equal(c.suppliedCategorySlugMatchesGame('Minecraft', 'minecraft-dungeons'), false);
  assert.equal(c.suppliedCategorySlugMatchesGame('Delta Force', 'delta-force-hawk-ops'), true);
});
test('Vivaldi diagnostics: PC page cannot replace the Console campaign route', () => {
  const c = context({links: [pcLink]});
  c.rememberCategorySlug(consoleDrop.game, consoleDrop.gameSlug, 'twitch-gql');
  assert.equal(c.resolveCategorySlug(consoleDrop), 'world-of-tanks-console');
  assert.equal(c.categorySlugCache['world of tanks console'], 'world-of-tanks-console');
  assert.equal(c.gameNamesMatch(consoleDrop.game, pcLink.textContent), false);
});
test('legacy poisoned cache is ignored while other stored state stays intact', () => {
  const poisoned = JSON.stringify({'world of tanks console': 'world-of-tanks'});
  const c = context({stored: {'dropper-category-slugs-v2': poisoned, 'tdh-settings-v3': 'preserve-me'}});
  assert.equal(c.resolveCategorySlug(consoleDrop), 'world-of-tanks-console');
  assert.equal(c.storage.get('tdh-settings-v3'), 'preserve-me');
  assert.equal(c.storage.get('dropper-category-slugs-v2'), poisoned);
});
test('persisted old routing slug recovers even without a new inventory response', () => {
  const c = context({links: [pcLink], stored: {'dropper-category-slugs-v2': JSON.stringify({'world of tanks console': 'world-of-tanks'})}});
  assert.equal(c.resolveCategorySlug({game: consoleDrop.game, gameSlug: 'world-of-tanks'}), 'world-of-tanks-console');
});
test('exact observed names retain real Twitch slugs across page loads', () => {
  const link = {textContent: 'Example Game', href: 'https://www.twitch.tv/directory/category/12345-example'};
  const c = context({links: [link]});
  assert.equal(c.resolveCategorySlug('Example Game'), '12345-example');
  const next = context({stored: Object.fromEntries(c.storage)});
  assert.equal(next.resolveCategorySlug('Example Game'), '12345-example');
});
