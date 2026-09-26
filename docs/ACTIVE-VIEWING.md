# Active-viewing implementation

Development version: 3.3.0-dev.5. Baseline: Dropper 3.2.31.

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


## 3.3.0-dev.2 campaign intelligence tranche

Campaign ordering now moves a campaign with a known impossible watch window behind viable work. Among viable or unknown candidates, ordering considers personal game priority, the currently active game, deadline margin, in-progress state, campaign end time, and remaining watch time. Priority still does not grant navigation permission and cannot override a deliberate pause or manual stream choice.

Eligibility reports reward-level deadline feasibility and campaign-wide remaining watch minutes when Twitch supplies enough data. These estimates never replace Twitch-credited progress. Timed-out page claims are described as "Claim Sent · Confirmation Unavailable" rather than as a rejection, and credited-progress verification carries forward current GQL campaign support when that evidence exists.


## 3.3.0-dev.3 recovery and coordination tranche

Claim selector health is observational. A page that has no claimable reward is reported as monitoring rather than as a broken selector. Recent and stale historical matches are distinguishable, while exceptions during detection are explicitly degraded.

Stream health now carries a recovery diagnosis that separates viewer pause, offline state, wrong game, eligibility uncertainty, buffering, delayed Twitch credit, and a true credit stall. These diagnostics do not grant navigation permission and therefore do not override the active-viewing safeguards introduced in dev.1.

When the Web Locks API is unavailable, claim coordination now adds a short account-and-reward-scoped localStorage lease with a verification settle step. The established oldest-tab policy and persisted pending records remain in place. This is a stronger browser fallback but is still not represented as a transactional storage primitive.


## 3.3.0-dev.4 bonus and recovery tranche

A bonus page claim can now be confirmed by a narrow UI transition: Dropper must have clicked the specific safe bonus control, then Twitch must remove or invalidate that exact claimable control after the click. If the control remains claimable or the context changes, the attempt remains pending/unconfirmed and is not counted as confirmed.

Mutation-driven claim scanning is coalesced to a five-second minimum interval. Direct/manual scans and initial watcher setup can still run immediately, which keeps response time predictable without letting Twitch's high-volume DOM mutations drive hundreds of scans per minute.

Campaign priority diagnostics now say whether a value came from a saved preference or the default. Selecting Normal removes the saved override entirely.

A verified credit stall no longer causes an immediate stream rotation. Dropper performs an urgent Twitch recheck, waits 30 seconds, performs one final recheck, waits another 30 seconds, and only then rotates if the stall is still present and automatic routing remains allowed.


## 3.3.0-dev.5 stream evidence tranche

Stream routing now uses an explicit evidence tier before viewer-count preference. A currently visible campaign allow-list match is strongest, followed by a currently visible Drops-tagged stream, followed by another live same-game stream that still needs verification. Campaign hints and cached standby entries remain lower-confidence fallbacks.

Lowest Viewers and Highest Viewers only break ties inside the same evidence tier, so a generic low-viewer stream cannot outrank a campaign-allow-listed channel. Any Eligible preserves its existing tie behavior after evidence quality is applied.

The selected candidate's evidence rank and label are retained in routing diagnostics so a future live report can explain why Dropper chose a channel.
