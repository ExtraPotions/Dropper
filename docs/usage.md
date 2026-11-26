# Using Dropper for Twitch

[Back to the README](../README.md)

## Install and open

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/get-it/) or [Tampermonkey](https://www.tampermonkey.net/).
2. [Install Dropper for Twitch](https://github.com/ExtraPotions/Dropper/releases/latest/download/dropper.user.js) and confirm in your userscript manager.
3. Sign in to Twitch, refresh, and open the Dropper launcher in Twitch's top bar. Other ExtraPotions products have their own icons beside it. In a narrow window or theater mode Dropper is a tab on the right edge instead.

The script appears as **Dropper for Twitch** in your userscript manager.

Stream switching starts at **Follow Campaign Order** in the first eligible tab. Saved choices, manual stream holds and pauses are respected; additional browsing tabs stay where you open them. Change the policy in **Settings → Switching**. With **My Priority** and **Follow Campaign Order**, the first game with a watch reward keeps its place during stream searches and temporary cooldowns. Once its rewards are finished or ineligible, Dropper moves to the next game.

## Features and controls

- **Track progress:** see credited watch time for the current reward on a compact card. On a channel page the card sits in place of the Stream Chat title bar, and the menu opens from its edge. Turn off **Look → Drop Details** for a one-line card with the channel, game, percentage and **Menu**. **Hide Chat** on the card collapses Twitch chat, and Twitch's Expand Chat reopens it. Pause or Resume reflects your viewing intent; Skip asks you to press it again. If the card says **Tap Play on Twitch**, press Play on the player or **Resume** on the card to continue on that channel. Twitch decides eligibility and credit.
- **Check eligibility:** see whether the stream you are watching matches the campaign: account, campaign, reward, game, and stream.
- **Keep rewards in reach:** browse open campaigns, review your history, and open your Drops inventory from the menu. Finished watch-Drop campaigns leave the campaign list.
- **Choose your games:** follow the games you care about and ignore the rest.
- **Reward campaigns:** a Twitch reward campaign that names a game, such as a launch celebration, appears under that game's category. A reward that repeats daily shows each day as its own step.
- **Site theme:** choose Light, Dark or System in **Look → Site Theme**. System follows your device. Twitch's functional purchase, live and status colors keep their meaning.

## Kick

Open **Campaigns** to set stream switching, turn **Claim Earned Rewards** on or off, and move games **Up** or **Down**. **Ignore** takes a game out of selection until its campaigns end. **Include** restores it. Game order, ignores and claim history belong to the signed-in Kick viewer.

From Kick Home, Browse, Following, a category or the campaigns page, Dropper can find a channel Kick says counts for your selected game. A channel you open yourself stays selected. **Open Next Stream** lets you choose to move. An earned reward keeps the campaigns page open for you.

The card shows the reward the current stream counts toward. **Earning** follows an increase in Kick's credited minutes. **Stalled** follows six observed minutes of advancing playback with flat credit. A daily case can earn on any live stream.

When **Claim Earned Rewards** is on, Dropper requests earned watch-time Drops and cases for the signed-in account. **Claim History** shows confirmation after Kick reports the reward claimed. An unconfirmed request stays in history for review. **Claim on Kick** opens your inventory.

## Shared menu

Each section is a drawer: opening one closes the others, and the menu reopens on the one you used last. Open **System** for status, diagnostics, troubleshooting and Reset. Menu sizing is in **Look**. On Twitch and Kick each ExtraPotions product has its own icon in the top bar (or shares one launcher when the bar has room for one icon). Donations are available from the heart on the progress card.

## Support and verification

[Report a problem](https://github.com/ExtraPotions/Dropper/issues).

## Look

The menu is charcoal with purple highlights, in Light, Dark and System. System follows your device and updates when its appearance changes. Site theme uses the same charcoal with purple highlights and the same three choices and is independent of the menu. Legacy palette settings migrate to System. Gem themes, palette choices and custom menu opacity are no longer available.
