# Active-viewing implementation

Development version: 3.3.0-dev.13. Baseline: Dropper 3.2.31.

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


## 3.3.0-dev.6 claim-gated reward tranche

Watch completion and claim completion are now treated separately. A successor reward that only requires the previous reward to be completed can already advance at 100% watch progress. A successor that explicitly requires the previous reward to be claimed is re-evaluated only after Dropper receives confirmed or already-claimed evidence.

The confirmed claim is applied to Dropper's in-memory campaign snapshots before prerequisite evaluation. If that unlocks another watch-time reward in the same campaign, it becomes the active target. When the currently viewed stream is still live in the same game, Dropper re-verifies it in place instead of navigating away. A different campaign that has already begun earning credited progress is not preempted.


## 3.3.0-dev.7 inventory claim sweep tranche

Dropper now checks authoritative Twitch Inventory snapshots for completed, unclaimed, non-subscription rewards beyond the currently watched Drop. Up to three claim-ready rewards are selected per sweep, ordered by campaign deadline and reward order. Candidates without a claim instance ID are ignored.

The sweep does not introduce a second claim engine. Every selected reward runs through the same account-scoped claim lock, ledger, result parser, retry rules, history, and confirmation flow already used by the current Drop. Secondary tabs do not initiate sweeps.

The reward currently being watched is excluded from the inventory sweep because it already has an immediate claim path. Confirmed background rewards therefore cannot replace or navigate away from a different campaign that is actively earning credited progress.


## 3.3.0-dev.8 campaign catalog ownership tranche

Campaign membership and reward progress now have explicit ownership boundaries. ViewerDropsDashboard and All Campaigns data determine which campaigns belong in the broad catalog. Twitch Inventory supplies authoritative in-progress reward state for campaigns it contains.

When the authenticated dashboard request is blocked and Dropper falls back to Inventory, that fallback now overlays progress onto matching catalog entries instead of replacing the catalog. If no broader catalog exists yet, the Inventory fallback may seed it, but once a richer catalog is present a short Inventory response cannot shrink it.

This preserves deadline planning, prerequisite context, next-campaign selection, and campaign-manager completeness across Twitch navigation and integrity fallback while keeping Inventory progress authoritative.


## 3.3.0-dev.9 status and claim-health presentation tranche

Dropper's status text now distinguishes real stream activity from Inventory-only progress. When no stream is loaded, a current Drop is described with its game and credited watch progress plus the routing state, such as automatic switching off, finding, opening, verifying, waiting, or choosing an eligible stream. Inventory progress alone is never described as active earning.

The existing Claim History details now contain one compact health line. It summarizes confirmed, pending, and attention-needed claim records, applicable Drop/Bonus/Inventory selector health, and the latest inventory-sweep result. This information stays inside System and does not add a new top-level panel or dashboard.


## 3.3.0-dev.10 compact support and eligibility tranche

The permanent donation paragraph has been removed from System. A small heart button now sits beside the menu Close control and opens a compact Support Dropper popover. The popover states that donations are optional and all features stay free. No payment destination is invented or embedded.

Reward eligibility is now a compact expandable chip inside Drops. The collapsed state uses short labels such as "✓ Eligible · 88 min remaining", "⚠ Deadline Risk · 88 min needed", "⚠ Account Link Required", "⚠ Previous Reward Required", "⚠ Stream Not Eligible", or "? Eligibility Not Verified". Expanding the chip reveals the detailed eligibility explanation, timing estimate, deadline margin/risk, and campaign watch-time context when available.

The verbose eligibility data remains available in Diagnostics. No new top-level panel or dashboard was added.


## 3.3.0-dev.11 Ko-fi support destination

The Support Dropper heart popover now includes an "Open Ko-fi" action pointing to https://ko-fi.com/expdare. The heart remains a non-navigating control that opens the compact confirmation popover first.

The Ko-fi action opens in a separate tab with noopener and noreferrer protections. Support remains optional and does not alter access to any Dropper feature.


## 3.3.0-dev.12 narrow support popover geometry

The Support Dropper popover is now positioned relative to the full menu header instead of the small heart-button wrapper. Its width is capped by the available menu header width, so Narrow mode keeps the entire popover inside the Dropper menu.

The Ko-fi confirmation flow and support wording are unchanged. Browser regression coverage verifies the popover's left edge, right edge, and width remain within the Narrow menu rectangle.


## 3.3.0-dev.13 reload-state reconciliation

Identified Drops now preserve or restore their exact Twitch reward metadata across same-account reloads. A reward title that begins with a duration can be legitimate, so dated titles such as `1 Hour (Sep 25)` are no longer classified as generic card metadata. If a prior build stored a generic `Current drop` name, Dropper repairs it from an exact Drop-ID match in known Inventory or catalog data.

Eligibility can now reuse recent persisted routing/GQL verification after reload when the active channel, campaign key, Drop ID, and game still match. The saved evidence must include Twitch campaign support plus an exact session campaign or Drop match and must remain within the bounded verification window. Stale or identity-mismatched evidence remains unverified.

The restored proof also repopulates `lastStreamVerification` during boot so Diagnostics, routing state, earning health, and the eligibility chip report a consistent state after reload.
