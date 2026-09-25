# Changelog

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
