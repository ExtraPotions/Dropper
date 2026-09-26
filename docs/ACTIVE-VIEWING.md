# Active-viewing implementation

Development version: 3.3.0-dev.1. Baseline: Dropper 3.2.31.

## Behavior

Dropper observes the real Twitch player. A deliberately paused player remains
paused across same-channel replacement and reload. A manually selected channel
is protected until the viewer explicitly permits switching. Resume Playback
resumes the player without enabling automatic navigation. Explicit Skip remains
a separate action. Fullscreen, picture-in-picture, and document visibility do
not prove whether the viewer is watching.

The old keep-active visibility/focus shims and forced playback are removed.
Keep Screen Awake requests a real screen wake lock only when supported, allowed,
and appropriate. A denied wake lock does not affect playback. The recovery
budget allows at most three automatic recovery attempts per context; deliberate
pauses and uncertain manual contexts are not recovery triggers.

Claim actions share an account-scoped coordinator. A click or HTTP 200 alone is
not proof of a claim. Exact supported API outcomes or inventory reconciliation
settle an identifiable reward. Already Claimed is distinct from a newly earned
claim. Pending attempts suppress repeats. Recognized transient failures permit
at most three attempts with delay. Unknown outcomes and integrity/authentication
failures require reconciliation or attention instead of alternate transport
retries. Replies from obsolete account, route, or campaign contexts are ignored.

Prerequisite planning detects cycles, missing nodes, and ambiguous requirements.
Missing timing semantics do not yield a precise combined ETA. Explicit account,
campaign, game, channel, and prerequisite evidence supplies eligibility reasons.
Campaign priority affects recommendations, not permission to navigate. Existing
campaign ignores remain in force.

Claim history is bounded to 100 sanitized records per account. Selector health
reports observations rather than assuming that absence of a claim button means
failure. These views use the existing System and Diagnostics surfaces; menu
widths and shared launcher/notice chrome are unchanged.

## Implementation provenance

This change adds newly written JavaScript within Dropper, based on the approved
functional design. It does not import, translate, or bundle implementations from
twitch-autoclaim or TwitchDropsMiner. Those projects were reviewed earlier in the
planning conversation, so this is not represented as a formal clean-room process
or an audit of the preexisting codebase. Existing license files are unchanged.
Any future direct code adoption requires a separate attribution/license review.

## Known limitations

Tests use synthetic Twitch pages and responses, not a live authenticated Twitch
account. Twitch DOM selectors and response contracts may change. Unknown API
statuses stay unconfirmed. A channel-point bonus without authoritative proof is
not presented as confirmed. Web Locks serialize cooperating tabs when available;
the fallback leader mechanism is advisory, not guaranteed cross-tab atomicity.
Browser evidence cannot perfectly distinguish every native media-key or player
pause source. Uncertain pauses fail safe rather than forcing playback.

## Validation

Run `npm test` with the locked dependencies and Playwright Chromium installed.
The suite includes the existing regression tests, pure state-machine tests, and
full-userscript browser fixtures. Browser fixtures cover deliberate pause,
remount and resume, listener deduplication, screen-mode observations, scoped
claim controls, exact claim confirmation, stale-account replies, priorities,
and Full/Compact/Narrow width checks. Fixture screenshots are generated under
`test-artifacts/`; test-only private hooks are not included in the distribution.

Before a stable release, manually check a live authenticated Twitch session:
intentional pause/resume and channel changes; fullscreen and picture-in-picture;
server-credited progress; an earned claim and inventory reconciliation; account
switching; and an offline/buffering stream. No live Twitch validation is claimed
by the automated fixture suite.

## Optional support

Dropper is free to use for personal, noncommercial purposes under its software
license. Donations are optional and support continued development. All features
remain available without donating, and donations do not change license rights.
No payment integration or donation destination is included in this change.
