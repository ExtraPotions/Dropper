# Dropper development

Suite-wide steps (shared Core changes, release order, screenshots, adding a product) are in [exp-core's maintainer guide](https://github.com/ExtraPotions/exp-core/blob/main/docs/development.md). This page covers what is specific to Dropper.

## Source layout

- `src/parts/` is the source. Read [src/parts/README.md](../src/parts/README.md) before adding a file: parts are joined in name order into one function, so order matters.
- `src/dropper.user.js` and the root `dropper.user.js` are generated. Never edit them by hand.
- The userscript header, `APP_VERSION`, `RELEASE_NOTES` and `QUIET_RELEASES` live in `src/parts/00-setup-and-state.js`.
- `vendor/exp-core/` is the bundled Core. Change it only by syncing from exp-core.

## Commands

| Task | Command |
|---|---|
| Build | `npm run build` (assemble the parts, then minify the install) |
| Check the assembled source is current | `npm run build:check` |
| Full suite | `npm test`, or after a build `node --test --test-concurrency=2 tests/*.test.cjs` |
| README screenshots | `npm run screenshots` (exp-core must sit beside Dropper) |
| Feature release | `RELEASE_NOTES_JSON='["…","…"]' npm run prepare:release:feature` (add `RELEASE_QUIET=1` for a quiet one) |

`build:check` covers assembly only. After changing parts, run the full build so the minified install matches.

## Things the tests hold fixed

- `docs/screenshots/` contains exactly `drops-menu.png` and `streams-menu.png`.
- Older changelog headings that the distribution test lists must stay in `CHANGELOG.md`.
- Surfaces that update cards must not cover (the progress strip and the page card) carry `data-exp-reserved`.

## Live checks

[WATCH.md](WATCH.md) runs Dropper in a headed browser that keeps a signed-in Twitch profile and writes diagnostics to `artifacts/diagnostics/`. Neither that folder nor `.watch-profile/` may be committed. [ACTIVE-VIEWING.md](ACTIVE-VIEWING.md) records how stream handling was verified.

## Writing about Dropper

Describe what the menu shows: drop progress, eligibility, campaigns, history, inventory and games. Do not describe Dropper as automating anything in the README or other public text.

## Manual checks and publication

Build the changed product and choose relevant manual tests. `release:check` and `verify:release` remain optional diagnostics, including their legacy published Core-pin checks; neither is a publication prerequisite. Windows test runners use concurrency two.

Both GitHub workflows are manual: Manual tests runs the suite; Publish release uploads the selected commit's existing built assets and SHA256SUMS without rebuilding or testing. Commit generated files before an authorized publication. Publishing requires an explicit user request; commits, pushes and tag pushes do not start it. Existing releases are not overwritten.

Core synchronization is deliberate local work. There is no scheduled sync, automatic product release, pin wait or release-order gate. See the suite guide's Shipping section. Claim and handoff rules remain in workspace AGENTS.md.
