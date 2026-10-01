<p align="center"><img src="assets/dropper-launcher.svg" width="128" height="128" alt="Dropper icon"></p>

# Dropper

**Follow your Twitch Drops from watch time to reward**

Track Twitch-credited progress, manage eligible streams, and claim available rewards from a compact menu.

[![Install Dropper](docs/badges/install.svg)](https://github.com/ExtraPotions/Dropper/releases/latest/download/dropper.user.js)
[![Code: PolyForm Noncommercial 1.0.0](docs/badges/code.svg)](LICENSE-CODE.md)
[![Artwork and documentation: CC BY-NC-SA 4.0](docs/badges/assets.svg)](LICENSE-ASSETS.md)

## Current release

**3.3.48** uses exp-core 3.4.12 for one shared, viewport-clamped menu size and removes retired width settings and observers. It corrects held routing state, session identity diagnostics, overlapping campaign estimates, and standby freshness reporting while preserving manual viewing, reward identity, and claim safeguards. See [the changelog](CHANGELOG.md) for details.

## Sizing and recovery behavior

Menus use one shared preferred size from exp-core and clamp to the available viewport. There are no selectable width presets. Upgrading discards only the retired width preferences and retains other saved settings.

When automatic routing is held by manual viewing or a playback pause, its controller reports a paused state and clears the previous channel's earning evidence. Unknown arrivals are identified as unclassified rather than attributed to a viewer click or an assumed raid. Explicit viewer selections remain protected; resuming automatic routing verifies the current eligible channel or rediscovers candidates in the target category.

Campaign watch-time milestones use the longest outstanding bar instead of adding overlapping bars. Missing durations or progress, unverified dependencies, and differing reward windows retain an unknown estimate. Reward credit still belongs to its exact reward ID. Cache maintenance does not count as fresh stream discovery or interrupt a healthy viewing session.

## Get started

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/get-it/) or [Tampermonkey](https://www.tampermonkey.net/).
2. [Install Dropper](https://github.com/ExtraPotions/Dropper/releases/latest/download/dropper.user.js) and confirm in your userscript manager.
3. Refresh Twitch and open the product launcher.

Sign in to Twitch and open the Dropper launcher. Check Drops for progress and claim options, then Streams for stream-switching preferences. Twitch determines eligibility and credited watch time.

## What you can do

- **Progress at a glance:** see the current reward, credited watch time, and earning status.
- **Claims:** optionally claim available Drops and channel-point bonus chests automatically.
- **Stream management:** find eligible streams and recover when a stream goes offline, changes category, or stops progressing.
- **Campaign browsing:** explore open campaigns and ignore games you do not want to follow.
- **Your preferred layout:** keep progress by the launcher or use Badge Only to place it at the top of the menu.
- **Your controls:** move the launcher and tune how the menu behaves from Appearance and System.

## See it in action

Screenshots show the current product with sample content.

<table>
  <tr>
    <td width="50%" valign="top" align="center"><a href="docs/screenshots/drops-menu.png"><img src="docs/screenshots/drops-menu.png" width="220" alt="Dropper: drop progress and claim controls"></a><br><strong>Drop progress and claim controls</strong></td>
    <td width="50%" valign="top" align="center"><a href="docs/screenshots/streams-menu.png"><img src="docs/screenshots/streams-menu.png" width="220" alt="Dropper: stream switching and recovery"></a><br><strong>Stream switching and recovery</strong></td>
  </tr>
</table>

## Support

[Support development](https://ko-fi.com/expdare). Donations are optional. All features remain available without donating.

## License

**Code:** [PolyForm Noncommercial License 1.0.0](LICENSE-CODE.md)<br>
**Artwork and documentation:** [CC BY-NC-SA 4.0](LICENSE-ASSETS.md)

## About

Dropper is an independent project and is not affiliated with or endorsed by Twitch.
