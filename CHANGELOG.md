## Unreleased

- Adds site-wide memory for content warning types you manually accept on Twitch, with a toggle in Streams > Playback options.
- Automatically accepts remembered warning types on other channels while leaving new types for you to review.
- Adds Forget Accepted Warnings and includes remembered-type counts in diagnostics. Reset clears the saved choices.

## 3.4.16 — 2026-10-07

- Keeps saved preferences in your userscript manager and safely migrates older settings.
- Checks Twitch progress messages more carefully before using them.
- Includes verified and rejected stream events in recent activity.

## 3.4.15 — 2026-10-06

- Makes menu labels and captions easier to read at every size.
- Aligns dropdowns, toggles, buttons, and section headings with consistent spacing.
- Gives menus more room while keeping each product's signature colors.

## 3.4.14 — 2026-10-07

- The standalone install is smaller while keeping all features bundled.
- Existing campaign, earning-status, and session fixes remain included.

## 3.4.13 — 2026-10-06

- Overwatch drop campaigns now open the live Overwatch 2 Twitch directory instead of waiting on the retired Overwatch category.
- Overwatch 2 streams are accepted for Overwatch campaigns, including after an older route was saved.

## 3.4.12 — 2026-10-06

- Keep Status open in System with its reason, recovery action, and recent activity.
- Group Copy Diagnostics, Show Diagnostics, and Report a Problem under Support; reports include the current status.
- Confirm Reset with a second tap inside the menu instead of browser dialogs.
- Move Menu Preferences to the end of Appearance.

## 3.4.11 — 2026-10-06

- Updates the shared foundation to exp-core 3.7.0.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.4.10 — 2026-10-06

- Keep a stream that Twitch confirms for your campaign open for up to six minutes while Twitch credits the first watched minute, instead of switching streams after 90 seconds.
- Stop the repeated stream switching that paused recovery and left new campaigns at progress pending.

## 3.4.9 — 2026-10-06

- Require exact selected-reward session evidence or credited Twitch progress before reporting a stream as earning.
- Keep campaign-only matches in stream verification so non-crediting channels rotate after the verification window.
- Recognize valid Twitch session envelopes without reward identity and report missing progress timestamps without Unix-epoch artifacts.

## 3.4.8 — 2026-10-04

- Keep System focused on Dropper Status, diagnostics, issue reporting, menu preferences, and a confirmed product reset.
- Keep missing Twitch progress pending and separate eligible streams from confirmed reward credit.
- Use observed progress increases for earning checks and identify missing or changed Twitch session responses.
- Clear stored Dropper data only after two reset confirmations.

## 3.4.7 — 2026-10-04

- Move to another eligible campaign after two minutes without a compatible visible stream.
- Retry deferred campaigns after five minutes while keeping channel restrictions enforced.
- Show stream discovery time and deferred campaigns in System diagnostics.

## 3.4.6 — 2026-10-04

- Open the correct Rainbow Six Siege category, including when an older route was saved.
- Keep Dropper's signature menu colors alongside other ExtraPotions products.
- Keep campaign-listed channels available across Twitch page changes and avoid unlisted channels for restricted campaigns.
- Show Recovery Paused when a move is blocked, and clear the pending stream-opening state.

## 3.4.5 — 2026-10-03

- Show a clear System status and offer safe recovery when needed.
- Choose Standard, Large, or Extra Large menus on each site.
- Pause repeated recovery switches until Resume and show a recent progress timeline.

## 3.4.4 — 2026-10-03

- Recognize current Twitch campaign information before switching away from eligible streams.
- Keep chat bonus checks running alongside automatic Drop claims.

## 3.4.3 — 2026-10-02

- Collect later channel-point bonus chests after an earlier bonus has been claimed.
- Keep duplicate bonus claims blocked while waiting for Twitch confirmation.

## 3.4.2 — 2026-10-02

- Remove the empty duplicate Maintenance section from System.
- Use compact full-width System submenus with softer colors and clear hover and keyboard focus states.
- Separate diagnostic buttons from maintenance tools while keeping menu labels readable.

## 3.4.1 — 2026-10-02

- Make small menu text easier to read, including captions, version badges, notices, and diagnostic details.
- Use consistent sizes for labels and controls across the menu.

## 3.4.0 — 2026-10-02

- Set quiet hours, protect favorite channels, and exclude channels from automatic selection.
- Choose to stay on a stream while it is earning and quiet browser alerts during quiet hours.
- Pause Dropper with the other ExtraPotions products from System > Site control.

## 3.3.51 — 2026-10-01

- Refreshes routing candidate evidence when exact credited progress confirms the active earning stream.
- Preserves the original stream-verification timestamp and records a separate credited-progress verification timestamp.
- Prevents credited progress evidence from being attached to another reward ID and adds a regression for that boundary.

## 3.3.50 — 2026-10-01

- Clears stale routing wait reasons when verification or earning resumes after a pause.
- Keeps wait reasons attached only to Waiting and Paused states so diagnostics match the active routing state.
- Adds a regression for earning → paused → verify-stream → earning while retaining exp-core 3.4.13.

## 3.3.49 — 2026-10-01

- Updates the shared foundation to exp-core 3.4.13.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.48 — 2026-10-01

- Removes retired width settings, preset CSS and chat-width observers; menu sizing now comes from Core and fits the viewport.
- Clears stale earning state when routing is held, records trustworthy manual-arrival evidence, and refreshes reward identity without inventing watch credit.
- Uses simultaneous reward timing rather than adding overlapping campaign progress bars; ambiguous dependencies and windows remain unknown.
- Separates standby cache maintenance from real observations and rediscoveries, preserving manual playback and navigation protections.

## 3.3.47 — 2026-10-01

- Updates the shared foundation to exp-core 3.4.12.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.46 — 2026-10-01

- Updates the shared foundation to exp-core 3.4.11.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.45 — 2026-10-01

- Moves menu exclusivity, outside-click dismissal and inactivity timing into exp-core 3.4.10 while preserving Dropper layout and saved preferences.
- Removes the remaining private menu listeners and obsolete support styles; support controls continue to come from Core.
- Preserves the released Inventory recovery and exact-reward progress fixes without changing Twitch routing or claim safety.

## 3.3.44 — 2026-10-01

- Updates the shared foundation to exp-core 3.4.10.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.43 — 2026-10-01

- Repairs the Inventory request and preserves the last valid reward snapshot when Twitch returns unavailable or partial data.
- Keeps successful read-only session updates running through Inventory lookup failures without weakening claim, authorization, rate-limit or integrity checks.
- Resolves active reward details and keeps watch minutes tied to the exact reward across claims and next-reward transitions.
- Reports syncing and unknown deadline estimates honestly; retains Core 3.4.9 and existing manual viewing protections.

## 3.3.42 — 2026-10-01

- Updates to exp-core 3.4.9.
- The support button and popover now come from exp-core, shared with the rest of the suite.
- The install link now comes from the exp-core update checker, which only points at published releases.

## 3.3.41 — 2026-10-01

- Fixes watch progress and claimed rewards not being seen, after Twitch changed its Inventory request.
- Learns Twitch's current requests from its own pages and reports when one stops working, so future Twitch changes are caught.
- Stops picking remembered campaigns that Twitch no longer lists.

## 3.3.40 — 2026-10-01

- Streams in a Streaming Together session are no longer rejected as being in the wrong category.
- When a stream shows several categories, Dropper uses the one that matches the Drop it is earning.
- Loads reward details for campaigns Dropper only remembers from earlier, so it no longer waits on them.

## 3.3.39 — 2026-10-01

- Fixes Dropper getting stuck on "Waiting for authoritative Drop details" and never opening a stream.
- Remembers a campaign's rewards between checks and asks Twitch for the missing ones directly.
- Moves on to the next campaign when Twitch reports no watch-time rewards for one, and tries it again after 15 minutes.

## 3.3.38 — 2026-10-01

- Updates the shared foundation to exp-core 3.4.8.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.37 — 2026-10-01

- Fixes the progress card being cut off at the top of the window when the launchers are dragged to the top: it now hangs below its launcher instead.
- Nothing changes when the launchers are at the bottom of the window.

## 3.3.36 — 2026-09-30

- Checks GitHub for new versions with one small request instead of downloading the whole script from the main branch every 15 minutes.
- Install and update links now point to published releases, so only released versions are offered.
- Update notices now show the highlights of the new release.

## 3.3.35 — 2026-09-30

- Changing Campaign Order, or ranking a game with the up and down arrows, now takes effect right away: Dropper moves to the top-ranked game instead of waiting for the current reward to finish.
- The campaign list shows the order Dropper will pick in, marks the game you are watching and the one that is next, and offers the ranking arrows only under My Priority.
- A changed order never overrides a pause, a locked or chosen stream, or automatic switching being off, and never interrupts a claim.

## 3.3.34 — 2026-09-30

- While the progress card is showing, menus open directly above it instead of beside the launchers, and below it when the launchers sit in the top half of the window.
- Update and changelog notices stack above the open menu, or above the progress card, so nothing covers the card or a launcher.
- Uses the shared exp-core notice placement, so every product places notices the same way.

## 3.3.33 — 2026-09-30

- Opens the Dropper menu beside the launcher grid, lined up with the launcher, so it no longer opens over or behind other launchers.
- Keeps every product menu clear of the Drops progress card.
- Uses the shared exp-core menu placement, so Dropper menus open exactly like SHIFT, PRISMA, and WARD menus.

## 3.3.32 — 2026-09-30

- Lets you drag the launcher to move the whole launcher group up or down the right edge; Shift+drag or Alt+Arrow keys reorder launchers.
- Keeps launcher dragging working on Twitch, where the video player used to swallow the mouse movement.
- Stacks all launchers in the right-hand column while the progress card is showing, so no launcher sits underneath it.
- Uses the shared exp-core launcher code, so Dropper drags, positions, and resets its launcher exactly like SHIFT, PRISMA, and WARD.

## 3.3.31 — 2026-09-30

- Updates the shared foundation to exp-core 3.4.5.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.30 — 2026-09-30

- Adds a planner line to Open Campaigns: watch time left across open campaigns, the first deadline, and how many may not finish in time.
- Shows subscription rewards in each game row, for information only. Dropper never subscribes.
- Adds unclaimed rewards to Claim History, with a badge and a claim soon flag.
- Shortens the Drops menu by folding the eligibility checklist into its row and moving two page settings to Appearance.

## 3.3.29 — 2026-09-29

- Updates the shared foundation to exp-core 3.4.4.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.28 — 2026-09-29

- Updates the shared foundation to exp-core 3.4.3.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.27 — 2026-09-29

- Adds a Check for Updates button in Maintenance that works on demand.
- Checks GitHub release information only when you press it and never installs anything.
- Reports whether an update is available, Dropper is current, or the check failed.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.

## 3.3.26 — 2026-09-29

- Shows Resume Playback once when playback is paused, instead of a second copy beside Stay On This Stream.
- Keeps the other recovery actions, such as Recheck Twitch and Find Another Stream, in the same place.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Adds no new settings.

## 3.3.25 — 2026-09-29

- Fixes the Claim History and Open Campaigns headings collapsing into a column of single letters when the status text is long.
- Keeps the campaign status text on one line and shortens it when there is no room.
- Simplifies the menu to a single width that follows the Dropper theme.
- Removes the Menu width, Menu theme, Menu notifications, and menu arrangement controls.

## 3.3.24 — 2026-09-29

- Updates the shared foundation to exp-core 3.4.2.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.23 — 2026-09-29

- Updates the shared foundation to exp-core 3.4.1.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.22 — 2026-09-29

- Adds clear game-account link warnings and campaign deadline/time-remaining status for active Drops.
- Adds local claim history plus an explainable stream-switch and recovery log.
- Adds ranked campaign priorities and strategy modes for priority, deadline, closest-to-completion, and shortest-remaining selection.
- Adds opt-in browser notifications for claimed Drops, ending campaigns, stalled progress, and automatic stream switches with hidden-tab and cooldown controls.
- Makes automatic Picture-in-Picture explicitly opt-in and exits only Dropper-started PiP when you return.
- Adds deterministic multi-tab safety so the oldest active Dropper tab controls automatic routing while secondary tabs remain passive.
- Adds bounded restart recovery and additional fail-closed Twitch GQL handling without weakening Twitch-credited progress as the source of truth.

## 3.3.21 — 2026-09-29

- Updates the shared foundation to exp-core 3.4.0.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.20 — 2026-09-28

- Updates the shared foundation to exp-core 3.3.17.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.19 — 2026-09-28

- Updates the shared foundation to exp-core 3.3.16.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.18 — 2026-09-28

- Updates the shared foundation to exp-core 3.3.15.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.17 — 2026-09-28

- Updates the shared foundation to exp-core 3.3.14.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.16 — 2026-09-28

- Updates the shared foundation to exp-core 3.3.13.
- Rebuilds shared UI, launcher, diagnostics, notices, and coordination from the pinned Core release.
- Leaves Dropper Twitch routing, campaign, claim, and playback behavior unchanged.
- Keeps the standalone userscript distribution while Core remains the single shared source.

## 3.3.15 — 2026-09-27

- Adds the themed outer menu border shared across the ExtraPotions suite.
- Keeps border colors tied to the active menu palette without changing Twitch routing behavior.
- Publishes the completed 3.3.12 through 3.3.14 fallback eligibility and allow-list diagnostic fixes.
- Keeps launcher placement, progress geometry, and menu focus behavior unchanged.

## 3.3.14 — 2026-09-27

- Refreshes candidate allow-list diagnostics when Twitch campaign metadata arrives after stream selection.
- Keeps historical selection proof separate from the current campaign allow-list snapshot.
- Updates allow-list evidence during verification and earning without changing routing decisions.

## 3.3.13 — 2026-09-27

- Reports Drops-tagged fallback streams as Verification Pending while Twitch campaign proof is still being checked.
- Allows a non-allow-listed fallback stream to become Eligible after target-campaign GQL evidence or credited progress confirms it.
- Keeps eligibility diagnostics and menu presentation aligned with the routing controller.

## 3.3.12 — 2026-09-27

- Lets Drops-tagged same-game streams enter campaign verification when no campaign allow-list channel is live.
- Keeps campaign allow-list matches highest priority.
- Still requires target-campaign GQL evidence or credited progress before entering earning state.
- Binds fallback verification to the verified channel so proof cannot carry across streamer changes.
- Keeps routing, standby, queue, and diagnostics candidate qualification aligned.

## 3.3.11 — 2026-09-27

- Lets every launcher move left, right, up, or down within the shared grid.
- Persists the complete launcher order across reloads.
- Adds Alt+Arrow keyboard reordering for the focused launcher.
- Keeps Dropper first only until the user chooses a different order.

## 3.3.10 — 2026-09-27

- Adds raised and inset menu surfaces so controls and cards no longer blend into one flat layer.
- Uses accessible link, focus, and accent-text colors while keeping every existing Dropper palette intact.
- Preserves existing saved palette choices and established base colors.
- Adds computed theme-role regression coverage across the live menu.

## 3.3.9 — 2026-09-26

- Compacts System menus and keeps menu width controls together on one row.
- Groups existing menu preferences consistently while preserving saved settings.
- Removes automatic Settings Backup and its restore controls.
- Adds a Bitcoin donation option with address copying and wallet support.

## 3.3.8 — 2026-09-26

- Balances the four System cards with equal collapsed heights and matching padding.
- Preserves two columns in Full and Compact modes and one in Narrow mode.
- Lets expanded cards grow naturally while remaining inside the menu.
- Checks equal card heights and expanded content at all three menu widths.

## 3.3.7 — 2026-09-26

- Restores a full-width two-column grid for System support and recovery cards.
- Keeps compatibility, backups, waiting explanations, and playback history aligned in Full and Compact modes.
- Uses one column in Narrow mode and keeps expanded cards inside the menu.
- Adds browser coverage for collapsed and expanded cards at each menu width.

## 3.3.6 — 2026-09-26

- Adds left-side section handles and visibility controls under System.
- Keeps long menu content within the available viewport while preserving current player and progress behavior.
- Refreshes the README and feature screenshots in a horizontal gallery.
- Clarifies installation and the separate code and artwork licenses.

## 3.3.5 — 2026-09-26

- Restores an initial Twitch mini-player through its native expansion control, with a manual restore action and viewer-control safeguards.
- Preserves saved settings and adds local backups, rollback, and product compatibility details.
- Explains waiting states using Twitch credit and playback evidence, and shows playback/navigation history.
- Adds player presentation diagnostics and regression coverage.

## 3.3.4 — 2026-09-26

- Rechecks the saved mute preference before every mute attempt and cancels disabled requests.
- Preserves player volume when muting streams.
- Closes other ExtraPotions menus when opening Dropper and respects peer menus.
- Adds regression coverage for mute preferences and menu coordination.

## 3.3.3 - 2026-09-26

- Recognizes credited progress on manually selected streams independently of automatic routing.
- Anchors startup verification to the selected stream rather than refreshing it on every poll.
- Preserves manual playback and automatic-switching preferences.
- Adds regression coverage for manual earning, paused playback, and verification timing.

## 3.3.2 - 2026-09-25

- Makes the Badge Only progress card use the same inner menu content width as Drops, Streams, Appearance, and System.
- Removes the 3.3.1 outer-dock width override and its negative side-margin compensation.
- Keeps Full, Compact, and Narrow responsible for the dock width while Badge Only inherits 100% of the dock content box.
- Adds a release regression contract that rejects a return to outer-width padding bleed.
## 3.3.1 - 2026-09-25

- Makes the Badge Only progress card use the same Full, Compact, and Narrow width calculation as the normal progress panel, menu, and update notice.
- Compensates for the menu's 9 px side padding on both sides so Badge Only no longer renders 18 px narrower than the selected panel width.
- Adds a visual-contract regression test that requires the Badge Only card and menu to share the same calculated width.
- Leaves the normal launcher-row progress layout unchanged while routing every panel-width decision through the shared width helper.
## 3.3.0 - 2026-09-25

- Finalizes the browser-only active-viewing Dropper rebuild with campaign discovery, priority and ignore controls, verified stream routing, automatic reward claiming, and account-scoped state.
- Hardens automatic claim controls with centralized Twitch selectors, scoped fullscreen handling, duplicate-claim protection, and fail-closed purchase/redeem/gift filtering.
- Separates campaign-level stream verification from exact reward identity so a different Drop in the same campaign cannot advance the locked reward when both Drop IDs are known.
- Adds focus-aware stall handling, bounded recovery and navigation loops, stale-state expiration, network backoff/circuit protection, standby candidate caching, and multi-tab coordination.
- Includes the final dev.15 release-gate regression suite covering selector safety, identity mismatches, account changes, claim retries, navigation loops, and browser behavior.

## 3.3.0-dev.15 - 2026-09-25

- Centralizes claim-related Twitch DOM selectors into one internal registry and strengthens fail-closed visibility checks without rejecting safe zero-size React controls.
- Separates campaign-level stream verification from exact reward identity so a different Drop in the same campaign cannot advance the locked reward when both Drop IDs are known.
- Adds explicit session identity diagnostics, including exact-drop, campaign-fallback, and campaign-only-different-drop classifications.
- Removes stale six-hour routing sessions from storage instead of only ignoring them.
- Expands browser claim-safety coverage and adds release-gate tests for identity mismatches and bounded transient-state cleanup.

## 3.3.0-dev.14 - 2026-09-25

- Distinguishes stale Twitch credit caused while the browser or Twitch tab is unfocused from a true foreground credit stall.
- Holds the verified stream with a `credit-delayed-background` diagnosis instead of rotating solely because credited progress aged in the background.
- Gives Twitch a 30-second foreground revalidation window after focus returns before a stale-credit condition can become `credit-stalled`.
- Keeps non-viewer playback stops and playback errors recoverable, and exposes focus, visibility, background timing, and revalidation timing in Diagnostics.

## 3.3.0-dev.13 - 2026-09-25

- Restores exact reward metadata from known Inventory/catalog rows after reload when an identified Drop was left with a generic `Current drop` label.
- Stops treating dated duration titles such as `1 Hour (Sep 25)` as generic card metadata while preserving filtering for plain duration-only labels.
- Reuses persisted routing verification only when the same channel, campaign, Drop, and game identities match and recent Twitch GQL evidence is still fresh.
- Keeps stale or identity-mismatched persisted proof fail-closed, and adds browser coverage for both metadata and eligibility reload reconciliation.

## 3.3.0-dev.12 - 2026-09-25

- Anchors the Support Dropper popover to the full menu header instead of the heart-button wrapper.
- Constrains the support popover width to the available menu header width so Narrow mode cannot overflow outside the menu.
- Preserves the existing compact Ko-fi support interaction at Full, Compact, and Narrow widths.
- Adds browser geometry coverage asserting the support popover remains inside the Narrow menu rectangle.

## 3.3.0-dev.11 - 2026-09-25

- Connects the compact Support Dropper popover to https://ko-fi.com/expdare.
- Opens Ko-fi in a separate tab with noopener and noreferrer protections.
- Keeps the heart itself as a non-navigating confirmation control so accidental clicks do not leave Twitch.
- Preserves the concise optional-support wording and all-features-free policy.

## 3.3.0-dev.10 - 2026-09-25

- Moves optional-support wording out of System and into a compact heart button beside the menu Close control.
- Adds a small Support Dropper popover with the concise copy “Donations are optional. All features stay free.” and no invented donation destination.
- Replaces the long reward-eligibility paragraph with a one-line expandable status chip for eligible, deadline-risk, account-link, prerequisite, stream-ineligible, and unknown states.
- Keeps the full eligibility explanation in the chip's expanded content and Diagnostics while preserving existing menu structure and widths.

## 3.3.0-dev.9 - 2026-09-25

- Replaces misleading off-stream "Working toward" copy with state-aware progress text that distinguishes automatic switching off, finding, opening, verifying, waiting, and manual stream choice.
- Adds a compact health summary inside the existing Claim History panel with confirmed/pending/attention counts and applicable selector-health states.
- Surfaces the latest inventory-sweep result in the same Claim History summary without creating another dashboard or top-level menu.
- Adds browser regression coverage for off-stream status accuracy and the single-panel claim-health presentation.

## 3.3.0-dev.8 - 2026-09-25

- Keeps ViewerDropsDashboard and All Campaigns data authoritative for catalog membership while Twitch Inventory remains authoritative for reward progress.
- Changes authenticated Inventory fallback from catalog replacement to progress overlay, preventing a short in-progress list from shrinking a richer saved catalog.
- Preserves broader campaign membership across Twitch navigation, integrity fallback, and one-campaign Inventory responses.
- Adds regression coverage proving Inventory fallback updates matching progress without removing dashboard or All Campaigns campaigns.

## 3.3.0-dev.7 - 2026-09-25

- Adds a bounded inventory-wide sweep for completed, unclaimed, non-subscription rewards already present in authoritative Twitch Inventory data.
- Routes every swept reward through the existing claim lock, ledger, exact-result handling, and account-scoped coordination instead of creating a second claim engine.
- Limits each sweep to three rewards and orders candidates by campaign deadline and reward order, while excluding entries without claim instance IDs.
- Keeps the actively watched reward on its existing claim path so collecting older completed rewards cannot navigate away from or replace an earning stream.

## 3.3.0-dev.6 - 2026-09-25

- Re-evaluates the same campaign after a confirmed or already-claimed Drop result so claim-gated successor rewards can unlock immediately.
- Keeps a live same-game stream in place and re-verifies the newly unlocked reward instead of navigating away unnecessarily.
- Falls back to normal stream discovery when the current stream no longer matches the unlocked reward's game.
- Does not preempt a different campaign that has already begun earning credited progress.

## 3.3.0-dev.5 - 2026-09-25

- Ranks automatic stream candidates by campaign evidence before viewer-count preference.
- Prefers live campaign-allow-listed channels, then live Drops-tagged channels, then same-game probationary channels.
- Keeps live evidence ahead of cached standby evidence while preserving Lowest Viewers, Highest Viewers, and Any Eligible tie behavior.
- Adds candidate evidence rank and label to routing and queue diagnostics.

## 3.3.0-dev.4 - 2026-09-25

- Confirms channel-point bonus claims when Twitch removes the exact claimed bonus control; ambiguous outcomes remain unconfirmed.
- Adds a five-second floor to mutation-driven claim scans while preserving immediate watcher setup and direct/manual scans.
- Distinguishes saved campaign priorities from the default and removes the storage key when Normal is selected.
- Adds two bounded Twitch/GQL rechecks before a true credit stall can rotate to another stream.

## 3.3.0-dev.3 - 2026-09-25

- Tracks claim-selector observations over time and distinguishes monitoring, recent observations, stale observations, and actual detection failures.
- Adds explicit recovery diagnosis for viewer pause, offline streams, wrong categories, eligibility uncertainty, buffering, delayed credit, and stalled credit.
- Adds an account-and-reward-scoped localStorage claim lease as the fallback when Web Locks are unavailable.
- Preserves existing oldest-tab routing ownership and persisted pending-claim suppression while strengthening the fallback against duplicate cross-tab claims.

## 3.3.0-dev.2 - 2026-09-25

- Adds deadline-aware campaign sequencing that moves known-unfinishable choices behind viable campaigns before applying personal priority, urgency, active progress, and remaining watch time.
- Adds reward and campaign deadline feasibility to eligibility diagnostics without replacing Twitch-credited progress.
- Clarifies unconfirmed claim timeout wording and reconciles credited-progress verification with current GQL campaign evidence.
- Adds queue diagnostics that expose personal priority, finishability, remaining watch time, deadline margin, and in-progress state.

## 3.3.0-dev.1 - Active-viewing development build

- Preserve deliberate pauses and selected streams, including same-channel player remounts and reloads.
- Replace visibility/focus/pause overrides and simulated activity with observation and an optional screen wake lock.
- Use one claim coordinator with exact result handling, bounded retryable failures, account isolation, bounded history, and selector health.
- Add prerequisite graph validation, explicit eligibility explanations, and campaign priorities without overriding viewing choices.
- Apply browser-only and optional-donation wording. Preserve code/assets licenses and ExtraPotions chrome.

# Changelog

## 3.2.31 — 2026-09-25

- Reports separate progress-card, launcher, launcher-row, menu, and notice rectangles in diagnostics.
- Corrects progressPanelWidth so it measures the progress card instead of the combined launcher row.
- Forces a newly installed Dropper version to perform its own fresh remote update check instead of inheriting the prior version's throttle window.
- Attributes resource-load errors as Dropper-owned or page-owned and records only the asset hostname, not the full URL.

## 3.2.30 — 2026-09-25

- Unifies Update Available, Update Complete, notices, and Changelog into one Dropper-owned card space.
- Constrains every notice to the active Full, Compact, or Narrow menu width.
- Uses the menu bounds when open and the launcher row as the fallback anchor when the menu is closed.
- Removes Dropper notices from the shared launcher-grid floating-notice width path.

## 3.2.29 — 2026-09-25

- Places the Badge Only progress card above the Drops menu section instead of inside the Drops body.
- Keeps the Badge Only progress card matched to the active Full, Compact, or Narrow menu width.
- Preserves the normal layout where the live progress panel sits directly left of the Dropper launcher.
- Updates browser and layout regression coverage for the corrected Badge Only hierarchy.

## 3.2.28 — 2026-09-25

- Returns the live progress panel to the same launcher row, directly left of the Dropper launcher.
- Removes independent viewport positioning from the page progress card.
- Keeps the progress panel and launcher moving as one unit with an 8 px gap.
- Keeps the menu anchored above or below that row and the changelog directly above the menu.

## 3.2.27 — 2026-09-25

- Reanchors the launcher, progress panel, menu, and changelog to one measured launcher-grid geometry.
- Prevents opening the menu or changelog from shifting Dropper surfaces apart across the page.
- Keeps the progress panel and menu fixed relative to the real launcher grid instead of the cluster flow box.
- Preserves the changelog as a menu-width card directly above the menu.

## 3.2.26 — 2026-09-25

- Keeps the Current Version changelog card aligned to the Dropper menu instead of stretching across the page.
- Matches the changelog width to the active Full, Compact, or Narrow menu width.
- Positions the card directly above the menu with an 8 px gap and a viewport-safe below-menu fallback.
- Keeps automatic update notices in launcher-grid coordination while menu changelogs remain Dropper-owned.

## 3.2.25 — 2026-09-25

- Restores full theme colors to Update and Changelog notices.
- Restores the themed background, border, text, and button contrast.
- Keeps floating notices inside Dropper's themed container.
- Preserves viewport-safe launcher-grid positioning and multi-product stacking.

## 3.2.24 — 2026-09-25

- Keeps Update and Changelog notices fixed inside the visible browser window.
- Preserves launcher-grid anchoring at either the top or bottom edge.
- Keeps simultaneous product notices stacked beside the launcher grid.
- Prevents the zero-sized userscript host from offsetting the notice outside the viewport.

## 3.2.23 — 2026-09-25

- Places the Badge Only progress card inside the Drops menu instead of above the menu.
- Keeps the progress card at the top of the expanded Drops controls.
- Keeps the collapsed Drops header free of an external progress card.
- Restores the progress card beside the launcher when Badge Only is disabled.

## 3.2.22 — 2026-09-25

- Treats Dropper as an integrated ExtraPotions product in shared coordination and release provenance.
- Moves the live progress card above Drops inside the menu when Badge Only is enabled.
- Keeps only the Dropper badge visible on the page while Badge Only is active.
- Restores the progress card to the page beside the launcher when Badge Only is disabled.

## 3.2.21 — 2026-09-25

- Shows each automatic update notice once for that version instead of on every page load.
- Stacks simultaneous notices beside the complete launcher grid.
- Moves diagnostics and recovery actions under the final System menu.
- Keeps the version button available for reopening the current changelog manually.

## 3.2.20 — 2026-09-25

- Keeps the transparent width of Dropper's fixed badge row from intercepting neighboring launchers.
- Preserves pointer input for the Dropper launcher and progress panel.
- Verifies every installed product launcher remains the top hit target at both grid anchors.
- Keeps the existing three-column launcher order and spacing unchanged.

## 3.2.19 — 2026-09-25

- Uses the borderless Dropper launcher artwork for the userscript-manager icon.
- References the shared SVG by URL instead of embedding image bytes in the userscript.
- Removes the superseded bordered SVG and raster badge files.
- Blocks future builds if embedded image data returns.

## 3.2.18 — 2026-09-25

- Replaced pill and circular status chrome with compact rounded rectangles.
- Kept shared diagnostics and product-conflict reporting aligned with the active suite.
- Preserved the stable launcher grid and top/bottom progress-panel placement.
- Kept the embedded badge metadata and direct-install artifact reproducible.

## 3.2.17 — 2026-09-25

- Keeps the progress panel outside the complete three-column launcher grid and flips it below a top anchor or above a bottom anchor.
- Preserves peer launcher alignment and inward-opening menus while the progress panel or Dropper menu changes state.
- Standardizes Page, Technical, Console, and Plugin diagnostics with bounded redaction and current-page product conflict observations.
- Embeds the canonical Dropper badge in userscript-manager metadata and replaces the bordered README image with borderless SVG artwork.

## 3.2.16 — 2026-09-24

- Adds an Open Campaigns checklist to the Drops menu, grouped by game and refreshed from Dropper's existing campaign poll.
- Preserves account-scoped ignored games across automatic campaign refreshes and synchronized Twitch tabs.
- Extends an ignored game through its latest open campaign end date, then removes the ignore automatically after expiration.
- Excludes ignored games from new routing decisions and immediately leaves an ignored active game for the next eligible campaign.

## 3.2.15 — 2026-09-24

- Moves the Dropper progress ring to the outside edge of its 40 px badge artwork.
- Keeps the live campaign-progress ring exclusive to Dropper.
- Removes decorative progress rings from sibling ExtraPotions launchers.
- Uses the canonical Dropper SVG as the userscript-manager icon.

## 3.2.14 — 2026-09-24

- Uses 48 px launcher buttons with 40 px artwork and an 8 px gap between launchers.
- Expands menu-header badge artwork to 38 px.
- Adds a dedicated 128 px raster badge derivative.
- Keeps the original badge and launcher SVG files byte-for-byte unchanged.

## 3.2.13 — 2026-09-24

- Packs sibling launchers into a compact right rail beside the visible progress panel instead of leaving reserved empty rows.
- Restores the normal three-column launcher row when Badge Only hides the progress panel.
- Aligns Dropper's embedded grid coordinator with the shared build-time Core.
- Advances the userscript version and install link to 3.2.13.

## 3.2.12 — 2026-09-24

- Updates the Pride theme browser contract to expect the approved new rainbow color.
- Keeps the 3.2.11 palette behavior unchanged while restoring release validation.
- Advances the userscript version and install link to 3.2.12.
- Preserves the eight-slot menu order and Twitch-exclusive palette.

## 3.2.11 — 2026-09-24

- Replaces every legacy non-Twitch menu palette with the new eight-slot system.
- Orders palettes as Ember, Midnight, Glacier, High Contrast, Verdant, Pride, Twitch, and Dropper Gem.
- Keeps Twitch exclusive to Dropper while exporting the deep Crimson counterpart for sibling products.
- Adds six-role palette metadata so every theme carries complementary color relationships instead of one accent pair.

## 3.2.10 — 2026-09-24

- Makes the Warm charcoal menu depth visible beneath the existing gradient-border treatment.
- Carries the same material finish to sibling menus through the shared Core.
- Keeps amber accents restrained and leaves Twitch and High Contrast unchanged.
- Preserves menu layout, settings, and semantic status colors.

## 3.2.9 — 2026-09-24

- Adds a softly layered dark surface to the Warm charcoal settings menu.
- Uses restrained amber edge-lighting near the menu header instead of a full-panel accent wash.
- Gives the gem and header controls subtle inset depth while keeping ordinary controls matte.
- Leaves Twitch, High Contrast, progress information, and semantic status colors unchanged.

## 3.2.4 — 2026-09-23

- Restyles toggle switches with matte theme surfaces, softer knobs, and restrained accent ON states instead of metallic gray and full-gradient tracks.
- Keeps High Contrast and forced-colors switch behavior explicit and unchanged for accessibility.
- Matches switch chrome to the active theme instead of using metallic gray tracks or full-gradient ON fills.
- Leaves existing toggle behavior, settings persistence, and panel layout unchanged.

## 3.2.3 — 2026-09-23

- Adds a subtle fine-grain texture and restrained inset depth to the progress card so the solid surface feels less flat.
- Keeps the 3.2 panel structure and solid theme surface intact without restoring the old fade behavior.
- Applies the texture only to the progress card so menus and launcher chrome stay unchanged.
- Leaves existing progress information, Skip Streamer, and status row behavior intact.

## 3.2.2 — 2026-09-23

- Polishes the 3.2 progress panel with a steadier bottom row, fixed Skip button footprint, quieter status styling, and a more neutral panel border.
- Renames Progress & Appearance to Appearance.
- Keeps armed Skip confirmation compact with a Confirm label plus countdown.
- Leaves Skip Streamer arm-and-confirm behavior and campaign routing unchanged.

## 3.2.1 — 2026-09-23

- Restores a real CSS border around the menu header icon while keeping the shared split-gem SVG itself border-free.
- Makes the menu icon frame follow the active theme instead of relying on artwork that only looked like a border.
- Keeps the launcher and menu on the same split-gem artwork.
- Leaves icon size, placement, and click behavior unchanged.

## 3.2.0 — 2026-09-23

- Redesigns the progress panel as a calmer solid utility card with streamer, category, progress, reward, and status information in one clear hierarchy.
- Removes the streamer avatar, reward thumbnail, stream-title/viewer/uptime clutter, panel fade behavior, and obsolete campaign-navigation collapse behavior.
- Uses theme color only for restrained progress, percentage, status, and control accents instead of a gradient or faded panel treatment.
- Leaves automatic routing, Skip Streamer, and Last checked fully available in the redesigned card.

## 3.1.57 — 2026-09-23

- Removes the Previous, Current, and Next campaign strip from above the progress panel.
- Fixes Theme row overflow in Compact and Narrow widths by giving the swatches the full row.
- Preserves the accessible Menu Theme label while the swatches use the remaining width.
- Leaves campaign selection available through existing menu controls instead of the removed strip.

## 3.1.56 — 2026-09-23

- Compacts Progress & Appearance so it stays within the normal menu height instead of being the only section to trigger a scrollbar.
- Tightens only that panel's control spacing, theme swatches, separator, and opacity row.
- Leaves the global menu layout and other sections unchanged.
- Keeps Progress, Theme, width, opacity, and related controls fully usable in the shorter panel.

## 3.1.55 — 2026-09-23

- Uses the same split-gem icon artwork for both the launcher and the menu header.
- Removes the menu-only framed badge treatment so Dropper has one consistent icon identity.
- Keeps launcher size, progress ring, and update badge behavior unchanged.
- Leaves menu header layout and click targets intact.

## 3.1.54 — 2026-09-23

- Refines the launcher with a softer frame, tighter themed progress ring, quieter update badge, and clearer open state.
- Adds a restrained hover treatment and subtle drag feedback.
- Preserves the launcher's 48px footprint and existing click, drag, and update behavior.
- Leaves progress-ring math and Keep Tab Active behavior unchanged.

## 3.1.53 — 2026-09-23

- Removes the launcher hover/focus helper tooltip so the Dropper badge stays visually clean.
- Keeps the launcher accessibility label unchanged.
- Keeps the update-available indicator unchanged.
- Leaves launcher click, drag, and progress-ring behavior intact.

## 3.1.52 — 2026-09-23

- Renames Notifications to Status Toasts so the setting clearly describes Dropper's brief in-app messages.
- Moves Status Toasts from Progress & Appearance into Streams.
- Places the control with the other stream and campaign status-feedback settings.
- Leaves toast timing, copy, and enable/disable behavior unchanged.

## 3.1.51 — 2026-09-23

- Collapses the Active + Standby stream list by default so the Streams menu stays compact.
- Replaces the always-open block with a one-line ready-stream summary that expands on demand.
- Keeps Active and Standby stream details available after expansion.
- Leaves routing, skip, and standby selection behavior unchanged.

## 3.1.50 — 2026-09-23

- Visually splits the Streams menu into Current Stream and Routing & Backup groups without adding another top-level menu.
- Makes routing-specific controls, skip conditions, standby list, and skipped-stream cleanup read as one full-width automation block.
- Keeps current-stream controls visually separate from routing automation.
- Leaves existing Streams settings and skip behavior unchanged.

## 3.1.49 — 2026-09-23

- Merges Progress, Theme, and Layout controls into one Progress & Appearance menu to reduce top-level menu clutter.
- Keeps progress controls visually grouped above theme, width, opacity, and notification settings inside the combined panel.
- Removes the separate Theme & Layout top-level menu.
- Leaves the underlying progress, theme, width, and opacity settings unchanged.

## 3.1.48 — 2026-09-23

- Simplifies the Drops panel by removing the permanent Twitch account/import card and leaving Drops Inventory as the primary full-width action.
- Only shows a compact Twitch Login Required row when authentication is missing.
- Moves manual campaign recovery to Diagnostics as Refresh Campaign Data.
- Leaves Inventory navigation and automatic campaign import behavior unchanged.

## 3.1.47 — 2026-09-23

- Changes Skip Streamer to a two-step arm-and-confirm interaction so a single accidental click cannot rotate away from a working stream.
- The armed skip state shows the streamer name and a 3-second countdown.
- Cancels automatically on timeout, stream or route changes, panel collapse, menu close, or session reset.
- Leaves skip exclusion, campaign lock, and routing recovery unchanged after a confirmed skip.

## 3.1.46 — 2026-09-23

- Restores the soft fade at both ends of the header divider for gradient themes while preserving each theme's color treatment.
- Keeps the flat Twitch palette on its original faded divider behavior.
- Applies the fade only to header dividers, not to other panel borders.
- Leaves theme palettes, progress fills, and control accents unchanged.

## 3.1.45 — 2026-09-23

- Restores the original flat Gem look as a dedicated Twitch palette using the classic Twitch purple and dark surfaces.
- Keeps the newer Dropper Gem gradient theme available separately.
- Lets users choose between the original flat Twitch look and the richer Gem skin.
- Leaves High Contrast and other theme palettes unchanged.

## 3.1.44 — 2026-09-23

- Finishes the unified theme-skin rollout by removing the final Pride-only current-campaign accent rule.
- Makes every theme share the same visual treatment model.
- Limits remaining theme differences to palette and gradient stops.
- Leaves High Contrast monochrome and existing theme selection unchanged.

## 3.1.43 — 2026-09-23

- Upgrades every Dropper theme to use the richer gradient-skin treatment previously reserved for Pride.
- Adds theme-specific gradient borders, header accents, progress fills, active controls, focus states, and update/changelog styling.
- Keeps High Contrast monochrome.
- Leaves theme selection, custom opacity, and panel layout controls unchanged.

## 3.1.42 — 2026-09-23

- Makes update notifications and the current-version changelog inherit the selected Dropper theme instead of using a fixed purple palette.
- Adds themed update buttons, borders, text, and version badges.
- Gives Pride a gradient treatment on those surfaces while preserving custom opacity.
- Leaves update-check timing and install-link behavior unchanged.

## 3.1.41 — 2026-09-23

- Adds optional user-controlled Dropper panel opacity in Theme & Layout with a persistent 40–100% slider.
- Keeps the Dropper launcher fully opaque so settings remain accessible even when panels are translucent.
- Stores the opacity choice with other appearance settings.
- Leaves quiet-panel wake rules and existing theme palettes unchanged.

## 3.1.40 — 2026-09-23

- Keeps the Panel + Menu Width control inside the Theme & Layout panel by stacking the label and selector in Narrow mode.
- Improves toggle visibility with a defined track border.
- Gives the High Contrast theme distinct on/off track and knob colors.
- Leaves Compact and Full width layouts and existing toggle behavior unchanged.

## 3.1.39 — 2026-09-23

- Prevents routine current-session GQL confirmations from rewriting the stream verification timestamp while earning.
- Restores verification time from the original earning-state anchor after navigation or reload.
- Stops stall timing from being kept artificially fresh by routine session polls.
- Leaves the 90-second verification window and credited-progress proof rules unchanged.

## 3.1.38 — 2026-09-23

- Makes candidate ACL diagnostics derive from the active campaign instead of stale category-page snapshots.
- Filters cached diagnostic candidates against that ACL.
- Builds one queue snapshot per diagnostics report so queue names and queue details cannot disagree when Any Eligible randomization is enabled.
- Anchors first-watch verification grace to the stream routing state instead of routine session refreshes and separates DOM playback, recent credited progress, and verified earning signals.

## 3.1.37 — 2026-09-23

- Fixes Theme & Layout alignment in Full panel width so the width label no longer collapses into a vertical stack.
- Keeps the width selector and Notifications on clean full-width rows.
- Leaves the two-column layout used by other menu sections unchanged.
- Does not change Compact or Narrow width behavior.

## 3.1.36 — 2026-09-23

- Makes campaign channel allow-lists authoritative before navigation, verification, standby selection, and queueing.
- Stops probing Drops-tagged channels that are not allowed by the active campaign.
- Rejects stale non-ACL verification sessions immediately.
- Clarifies loaded versus verified earning-stream diagnostics and removes the obsolete expanded progress width diagnostic.

## 3.1.35 — 2026-09-22

- Makes verified campaign start and end dates the authoritative eligibility gate for routing, stream proof, progress merging, and standby candidates.
- Keeps unknown-date, future, closed, completed, and expired campaigns in catalog memory for diagnostics while preventing them from becoming active routing targets.
- Filters Inventory progress through the same dated-open campaign lifecycle before it can become active state.
- Purges standby candidates when their campaign window closes and exposes the active campaign lifecycle decision in diagnostics.

## 3.1.34 — 2026-09-22

- Prevents session progress from another campaign or Drop in the same game from advancing the locked active Drop.
- Requires a matching campaign key or exact Drop ID before session progress or session fields can merge with the active target.
- Keeps rejected cross-campaign session minutes visible in diagnostics without using them as credited-progress verification.
- Applies the same identity isolation to both normal Dropper polling and intercepted Twitch GQL traffic.

## 3.1.33 — 2026-09-22

- Unifies router and standby candidate filtering so temporarily skipped or non-routable channels cannot reappear as usable queue candidates.
- Separates currently visible candidates from cached observations and labels cached freshness explicitly.
- Rescans category candidates while waiting, including no-live-allowed-channel, so newly rendered usable streams can wake routing before the full retry deadline.
- Adds per-channel diagnostics for visibility, allow-list match, Drops tag, temporary skip state, routability, cache age, and rejection reason.

## 3.1.32 — 2026-09-22

- Fixes the case where progress reconciliation selected authoritative Inventory minutes but a stale zero-minute channel Drop shell was still applied afterward.
- Reuses Dropper's conservative campaign matcher for live Inventory, covering Drop ID, campaign ID, and same campaign name plus game when Twitch changes the identity shape.
- Preserves the locked campaign identity when Twitch's Inventory response omits or reshapes the campaign key.
- Prevents an active locked Drop from borrowing progress from a different campaign merely because both campaigns use the same game.

## 3.1.31 — 2026-09-22

- Keeps exact campaign allow-list matches as the first-choice stream candidates.
- When no exact allowed channel is visible, allows other Drops-tagged streamers in the correct game category to be opened as campaign probes.
- Requires Twitch campaign GQL proof or fresh credited progress before a non-allow-listed probe can enter EARNING.
- Keeps no-live-allowed-channel in stream-discovery retry flow instead of falling back toward campaign selection.

## 3.1.30 — 2026-09-22

- Limits in-app release history to the latest three versions.
- Limits each GitHub release description to the latest three changelog sections instead of publishing the entire changelog.
- Keeps the full CHANGELOG.md history in the repository.
- Adds regression checks so the three-release limit stays enforced.

## 3.1.29 — 2026-09-22

- Applies authoritative live Inventory progress to the active Drop before stream-session verification runs.
- Keeps progress panel minutes, percentage, launcher ring, and tab-title progress synchronized with Twitch Inventory even while Dropper is on a category page.
- Uses the synchronized Inventory value as the baseline for the next streamer verification, so only newly credited progress proves that streamer is earning.
- Keeps the existing campaign-specific GQL proof rules intact; a generic Drops tag alone still does not verify a restricted campaign.

## 3.1.28 — 2026-09-22

- Treats failed and manually skipped streamers as temporary rotation exclusions instead of a persistent blacklist.
- Clears the temporary rotation automatically after all visible eligible streamers have been tried, then retries after the normal 30-second wait.
- Adds a Clear Skipped Streamers button to the Streams panel for an immediate manual reset.
- Clears both current routing-controller skips and any legacy handoff skip list without resetting campaign progress.

## 3.1.27 — 2026-09-22

- Widens the Skip Streamer control, labels it fully, and places it directly beside the streamer name.
- Removes the redundant LIVE chip from the progress header.
- Moves the Drops status chip into the existing status row to shorten the progress panel.
- Keeps streamer, percentage, Drops status, and Skip Streamer on one compact header without extra LIVE chrome.


## 3.1.26 — 2026-09-22

- Moves Skip Streamer into the progress header beside the percentage.
- Reduces the bottom status row to status plus Last checked for a shorter panel.
- Keeps Skip Streamer functionality and availability logic unchanged.
- Frees the status row from the Skip Streamer chip so the header carries the skip control.


## 3.1.25 — 2026-09-22

- Reduces progress-panel vertical height while preserving all current information.
- Tightens panel padding and row spacing and slightly reduces reward artwork size.
- Keeps the existing progress layout, status row, and controls unchanged.
- Leaves campaign navigation, Skip Streamer, and Last checked fully readable in the shorter panel.


## 3.1.24 — 2026-09-22

- Repairs stale routing Drop IDs after userscript reloads or updates while earning.
- Restores current-stream verification from Twitch session proof instead of relying only on in-memory verification state.
- Keeps stall health accurate across script restarts when Twitch continues crediting the active campaign.
- Prevents a restart from treating a still-earning stream as unverified or stalled.


## 3.1.23 — 2026-09-22

- Keeps Drop identity exact when Twitch advances to another Drop with the same reward name in the same campaign.
- Updates the routing controller target Drop ID in place when Twitch advances reward stages on the current verified stream.
- Prevents the previous reward stage from contaminating progress reconciliation for the next stage.
- Stays on the verified stream through same-campaign reward-stage changes instead of restarting discovery.


## 3.1.22 — 2026-09-22

- Raises the quiet progress-panel opacity from 22% to 45% for better readability.
- Keeps the existing hover, focus, and five-second wake behavior unchanged.
- Makes the faded earning panel easier to read without making it look fully awake.
- Leaves quiet-state wake rules and timing unchanged.


## 3.1.21 — 2026-09-22

- Stops campaign ACL routing from opening offline or non-visible allowed channels.
- Only opens allow-listed streamers that are currently visible in the correct Twitch game category.
- Waits for a live allowed streamer instead of falling back to arbitrary ACL entries.
- Avoids navigating to allow-listed channels that are not actually live in the target game.


## 3.1.20 — 2026-09-22

- Preserves Twitch campaign allow-list channels in the compact campaign catalog.
- Routes allow-list campaigns directly to their eligible streamers instead of probing unrelated game channels.
- Treats an exact campaign allow-list match as campaign-specific verification proof.
- Uses the campaign allow-list as routing evidence so restricted ladders stay on permitted channels.


## 3.1.19 — 2026-09-22

- Makes Reset Session State clear the routing session, including failed and skipped streamers.
- Also clears transient navigation guard, navigation-flight, standby-stream, and per-stream verification state.
- Keeps persistent campaign memory, settings, update state, and account-scoped preferences intact.
- Gives Reset Session State a clean routing restart without wiping saved Dropper preferences.


## 3.1.18 — 2026-09-22

- Fixes Twitch category-card boundaries so Dropper can see Drops tags that were outside the old shallow preview-card wrapper.
- Prioritizes directory channels whose full card contains a Drops marker before spending the 90-second verification window on probationary channels.
- Uses the same conservative multilingual Drops-marker detector across search and category discovery.
- Prefers visibly Drops-tagged category cards so verification time is not spent on unmarked channels first.


## 3.1.17 — 2026-09-22

- Forces one final Twitch Drop verification poll inside the 90-second stream verification window.
- Prevents normal 30/60-second GQL scheduling from skipping past the verification deadline.
- Keeps the verification deadline fixed at 90 seconds and exposes the final proof check in diagnostics.
- Makes the last seconds of VERIFY_STREAM still request Twitch proof before the window expires.


## 3.1.16 — 2026-09-22

- Makes the 90-second per-stream verification window authoritative for status and recovery timing.
- Prevents old credited-progress timestamps from making newly loaded streamers appear delayed or stalled.
- Separates raw credited-progress age from the current stream's effective stall age in diagnostics.
- Starts stall and recovery clocks from the currently loaded stream instead of inherited Drop progress.


## 3.1.15 — 2026-09-22

- Stops Last checked from resetting on every Twitch session poll.
- Resets Last checked only when the active streamer changes or credited Drop progress actually advances.
- Keeps stream-switch timing independent from network polling frequency.
- Leaves Last checked unchanged during routine session refreshes that do not credit new progress.


## 3.1.14 — 2026-09-22

- Resets the progress card Last checked timer whenever Dropper loads a different Twitch streamer.
- Separates stream check age from credited-progress age so channel changes no longer inherit stale timestamps.
- Refreshes Last checked when Dropper completes a current-session verification poll for the active streamer.
- Clears inherited Last checked values from the previous streamer so the timer reflects the newly loaded channel.


## 3.1.13 — 2026-09-22

- Displays the resolved Twitch reward image directly in the progress card.
- Keeps reward artwork compact beside watch minutes and reward name without expanding the panel layout.
- Hides missing or failed reward artwork cleanly while leaving progress information fully readable.


## 3.1.12 — 2026-09-22

- Accepts an exact Twitch current-session Drop ID match as campaign-specific stream verification proof.
- Keeps campaign-key matching and credited-progress verification intact while avoiding unnecessary stream cycling when Twitch omits campaign metadata.
- Expands diagnostics with session Drop identity matches and reports the routing controller's actual 90-second verification deadline.


## 3.1.11 — 2026-09-22

- Separates watch completion from reward claiming so a 100% Drop no longer blocks routing.
- Continues to the next unfinished watch-time reward in the same campaign first, then advances to the next eligible campaign.
- Leaves completed rewards unclaimed for later claiming instead of immediately opening Inventory or waiting in the CLAIM state.
- Stops the 3.1 controller from entering CLAIM solely because watch minutes reached 100%, so the next unfinished Drop can start immediately.


## 3.1.10 — 2026-09-22

- Fixes the Install Update control by using a real GitHub userscript install link instead of opening the raw file through a scripted popup.
- Keeps remote version checks on raw.githubusercontent.com while install navigation uses the GitHub /raw/ userscript URL expected by browser userscript managers.
- Preserves pending update refresh state before the installer link opens.
- Ships the readable userscript unless the single-file install exceeds 2 MB.


## 3.1.9 — 2026-09-22

- Refines the Pride theme into a darker hybrid style with neutral charcoal surfaces and restrained rainbow framing.
- Removes the permanent purple Pride surface wash while keeping rainbow progress, focus, selection, and active-state accents.
- Keeps Pride visually distinct without overpowering streamer, progress, campaign, or settings information.
- Softens Pride borders and header treatments so rainbow color is used for emphasis instead of filling the whole panel.


## 3.1.8 — 2026-09-22

- Recognizes Drop, Drops, Drops Enabled, Drops Active, and localized Drops status labels as visible candidate hints.
- Uses structural Twitch tag attributes and tag URLs first, then a conservative short-label text fallback that works across interface languages.
- Keeps visible Drops wording as ranking evidence only; campaign-specific GQL support or credited progress is still required to verify earning.
- Uses the neutral progress-card badge label Drops instead of claiming every detected marker literally says Drops Enabled.


## 3.1.7 — 2026-09-22

- Redesigns the progress header so the LIVE chip and percentage have dedicated columns and never overlap at any panel width.
- Shows richer streamer context in the progress card with stream title, category, viewer count, and uptime while keeping the card compact.
- Adds a quiet earning state that fades the verified healthy progress card until hover, focus, progress credit, or another attention-worthy state wakes it.
- Improves Settings label wrapping so normal words stay intact instead of breaking awkwardly in compact and narrow layouts.


## 3.1.6 — 2026-09-22

- Stops treating the generic Twitch "Drops Enabled" tag as campaign-specific eligibility proof.
- Correct game + generic Drops tag is now only candidate evidence, not sufficient to enter EARNING.
- A stream must prove the locked campaign through Twitch GQL campaign support or fresh credited Drop progress.
- Diagnostics preserve whether directory/live Drops tags were visible so false-positive eligibility can still be debugged.
- This specifically prevents restricted campaigns such as streamer-specific ladders from verifying on unrelated Drops-enabled channels.


## 3.1.5 — 2026-09-22

- Uses Twitch's per-channel available Drops campaigns as positive proof during probationary stream verification.
- A live stream in the correct game can verify immediately when GQL confirms the locked target campaign is available on that channel.
- Current Drop session matching can also provide positive campaign support evidence.
- Missing or empty GQL campaign data is not treated as a rejection by itself.
- GQL remains data-only: it updates verification evidence but does not navigate or change routing state directly.


## 3.1.4 — 2026-09-22

- Fixes a Twitch category render race after a failed probationary stream returns to the directory.
- While waiting for category streams, the controller now rescans the target directory on each heartbeat and wakes immediately when usable cards appear.
- Newly rendered candidates are evaluated before the fixed retry deadline, while failed and promoted channels remain excluded.
- Prevents a page that already shows channel cards from sitting in a stale 30-second WAITING state.


## 3.1.3 — 2026-09-22

- Keeps visible Drops-tagged streams as the preferred automatic candidate.
- When Twitch omits Drops badges from every category card, tries one non-promoted stream from the verified target category as a probationary candidate.
- A probationary stream must verify the correct game and then prove Drops eligibility through the live Drops marker or fresh credited progress before entering EARNING.
- Failed probationary channels remain in the controller's failed-stream set so the next attempt moves to a different channel.
- Replaces the indefinite "no Drops-qualified stream" wait with category-scoped verification when usable channels are present.


## 3.1.2 — 2026-09-22

- Rejects promoted, sponsored, and advertisement placements before automatic stream selection.
- Detects Twitch promotion markup structurally, including promoted-followed cards and promotion-oriented data/class markers.
- Also rejects standalone Sponsored / Promoted / Advertisement / Ad badges without blacklisting normal stream titles that merely contain those words.
- Applies the gate to both category and search candidate collectors.


## 3.1.1 — 2026-09-22

- Adds a controller preflight that evicts stale active targets before state dispatch.
- If the locked campaign is complete, expired, excluded, or no longer winnable while another eligible campaign is available, clears the stale current Drop and returns to campaign selection.
- Prevents FIND_STREAM / WAITING from continuing indefinitely on a campaign already marked expired in campaign memory.
- Adds regression coverage for expired-target eviction ordering.


## 3.1.0 — 2026-09-22

- Replaces Dropper's competing handoff, homepage search, directory fallback, retry, category-mismatch, offline, and stall routing loops with one routing controller.
- Uses one versioned routing session with explicit states: select campaign, find stream, open stream, verify stream, earning, claim, waiting, paused, and error.
- Uses one automatic discovery path: active campaign → target category → visible Drops-qualified stream → verification → earning.
- Removes routing decisions from GQL refresh. Twitch data refresh now updates state only; the controller decides navigation on the next heartbeat.
- Uses controller deadlines instead of independent routing timeout chains.
- Moves Previous / Next campaign navigation, Skip Streamer, post-claim progression, and claim fallback onto the same routing authority.
- Clears legacy handoff/navigation state on 3.1 startup so 3.0 routing sessions cannot leak into the new controller.
- Adds dedicated 3.1 routing-controller architecture regression tests.
- Removes the legacy handoff fallback from active Drop locking and dashboard polling.
- Requires current same-game channels to pass VERIFY_STREAM before EARNING.
- Requires actual baseline minute/percent advancement for progress verification instead of timestamp freshness.
- Clears legacy 3.0 handoff state before the first 3.1 heartbeat network cycle.
- Diagnostics now read the 3.1 routing session directly and no longer expose or depend on legacy handoff state.


## 3.0.78 — 2026-09-22

- Stops locked campaigns from auto-opening unverified stream candidates that do not show Twitch Drops eligibility.
- Applies the same Drops-proof gate to cached backups, homepage search, full search, and category-directory results.
- After a failed locked-campaign stream, returns directly to the target game category instead of restarting the home/search/category navigation loop.
- If no Drops-qualified replacement is visible, remains on the category page and waits for a valid candidate instead of repeatedly reloading Twitch.


## 3.0.77 — 2026-09-22

- Removes the legacy collapsed/expanded progress-card CSS that was still competing with the unified progress layout.
- Keeps the progress panel and standalone 48px launcher in one stable row at every campaign-navigation state.
- Uses a dedicated campaign-navigation visibility state so panel clicks only show or hide Previous / Current / Next.
- Updates the visual contract tests to reject the legacy progress-card geometry instead of requiring it.


## 3.0.76 — 2026-09-22

- Refines the unified progress panel so all requested stream, progress, reward, status, last-check, and Skip Streamer fields remain readable beside the launcher.
- Keeps the launcher as a standalone 48px control with a small gap from the progress card.
- Progress-card clicks now only show or hide Previous / Current / Next campaign navigation; the progress panel itself keeps one consistent layout.

## 3.0.75 — 2026-09-22

- Replaces the separate collapsed and expanded progress designs with one consistent progress panel beside the existing launcher.
- Shows streamer, stream title, category, Twitch progress, watched minutes, current reward, Dropper status, and last-check age in the unified panel.
- Adds a Skip Streamer chip that keeps the current campaign locked while moving to another eligible channel.
- Expands Previous / Current / Next campaign cards with campaign name, earned reward count, and campaign dates.


## 3.0.74 — 2026-09-22

- Restores the 3.0.70 progress and Previous / Current / Next campaign layout.
- Keeps later routing, credited-progress verification, and reward-image data fixes under the hood.
- Removes the 3.0.71–3.0.73 visual-contract redesign from the visible panel.

## 3.0.73 — 2026-09-22

- Carries Twitch reward imageAssetURL through Drop selection, session, and progress paths.
- Falls back to the active Inventory reward image when Twitch GQL data omits artwork.
- Preserves a known reward image across later same-Drop progress snapshots and reports image resolution in diagnostics.

## 3.0.72 — 2026-09-22

- Makes the approved reward-and-campaign screenshot the visual contract for the expanded progress panel.
- Matches the screenshot hierarchy: actual reward artwork, reward title, progress, percent, watch minutes, earning state, then Previous / Current / Next campaign cards.
- Keeps the contract responsive at the existing Full, Compact (260px), and Narrow (220px) widths.

## 3.0.71 — 2026-09-22

- Redesigns the expanded progress panel around the actual Twitch reward image, reward name, game, progress, timing, and earning state.
- Moves Previous / Next campaign navigation below progress with a denser card layout.
- Keeps the existing Full, Compact (260px), and Narrow (220px) width system unchanged.

## 3.0.70 — 2026-09-22

- Replaces the 24-hour Skip Current Campaign control with Previous and Next campaign navigation.
- Previous and Next navigate the eligible campaign queue without blacklisting or marking campaigns complete.
- Removes temporary campaign skips from routing and clears legacy skip state on startup.

## 3.0.69 — 2026-09-22

- Treats genuine same-Drop credited watch minutes as authoritative stream verification.
- Prevents a newly selected Drop from being mistaken for credited progress.
- Keeps Earning stable through brief Twitch player or stream-info DOM flickers after fresh credit.

## 3.0.68 — 2026-09-22

- Removes Advanced Token Override and uses the active Twitch browser session only.
- Removes Skip Current Stream and its temporary 30-minute streamer-skip state.
- Keeps automatic failed-stream retry and exclusion behavior intact.
