<p align="center">
  <img src="assets/dropper-icon-1024.png" width="128" height="128" alt="Dropper icon">
</p>

<h1 align="center">Dropper</h1>

<p align="center"><strong>Twitch Drops: Track and Redeem</strong></p>

<p align="center">
  A Twitch Drops companion for tracking watch time, monitoring progress, managing eligible streams, and redeeming rewards.
</p>

<p align="center">
  <img alt="Version 2.5.0" src="https://img.shields.io/badge/version-2.5.0-9147FF?style=flat-square">
  <img alt="Twitch Drops" src="https://img.shields.io/badge/Twitch-Drops-9147FF?style=flat-square&logo=twitch&logoColor=white">
  <img alt="JavaScript Userscript" src="https://img.shields.io/badge/JavaScript-Userscript-F7DF1E?style=flat-square&logo=javascript&logoColor=000000">
  <img alt="PolyForm Noncommercial 1.0.0" src="https://img.shields.io/badge/Code-PolyForm%20NC%201.0.0-6B7280?style=flat-square">
  <img alt="CC BY-NC-SA 4.0" src="https://img.shields.io/badge/Assets-CC%20BY--NC--SA%204.0-1769AA?style=flat-square">
</p>

## Install

<p>
  <a href="https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js">
    <img alt="Install with Violentmonkey" src="https://img.shields.io/badge/Install%20with-Violentmonkey-4C8BF5?style=for-the-badge">
  </a>
  <a href="https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js">
    <img alt="Install with Tampermonkey" src="https://img.shields.io/badge/Install%20with-Tampermonkey-111111?style=for-the-badge">
  </a>
</p>

Install a userscript manager, then click either button above. Both buttons open the current raw `dropper.user.js` release and should hand it off to your installed userscript manager.

**Direct install:** https://raw.githubusercontent.com/ExtraPotions/Dropper/main/dropper.user.js

## What Dropper Does

- Tracks Twitch-credited Drop progress and watch time.
- Redeems completed Twitch Drops and claims channel point bonus chests.
- Keeps eligible streams active while Twitch is in the background.
- Maintains a Stream Queue of eligible backup channels and can switch when progress stalls or a stream goes offline.
- Shows a compact Drop inventory, progress, ETA, campaign state, and current reward.
- Includes minimized progress, background earning status, diagnostics, notifications, and update/changelog notices.
- Uses a Twitch-themed interface with dedicated full-size and launcher icon assets.

## Stream Queue

Dropper can keep a short list of eligible standby channels without opening a pile of tabs. The active stream remains the earning stream, while standby channels are available for failover when the current channel stops earning or goes offline.

Queue behavior can be configured from the **Stream Queue** menu.

## Background Earning

Background Earning monitors Twitch-credited minutes while the stream is not the active tab. Dropper watches for stalled credit and surfaces a warning when the stream needs attention.

Twitch remains the authority on whether watch time is credited.

## Privacy And Network Access

Dropper runs on Twitch pages and communicates with:

- `gql.twitch.tv` for Drop progress, inventory, eligibility, and claim operations.
- `raw.githubusercontent.com` for Dropper update checks.

Authentication credentials are not written to Dropper's local settings storage.

## Current Release

**Dropper 2.5.0** is the current standalone live-test build.

The standalone version is intentionally independent of ExtraPotions V3 for now. Compatibility work can be added once the V3 integration layer is finalized.

## Project Files

| File | Purpose |
| --- | --- |
| `dropper.user.js` | Installable userscript |
| `assets/dropper-icon-1024.png` | 1024px primary icon |
| `assets/dropper-icon.svg` | Primary vector icon |
| `assets/dropper-launcher.svg` | Compact launcher mark |
| `preview/index.html` | Interactive UI preview |
| `LICENSE-CODE.md` | Software license |
| `LICENSE-ASSETS.md` | Artwork and documentation license |

## License

**Code:** [PolyForm Noncommercial License 1.0.0](LICENSE-CODE.md)  
**Artwork and documentation:** [CC BY-NC-SA 4.0](LICENSE-ASSETS.md)

See [NOTICE.md](NOTICE.md) for the split-license notice.

## Disclaimer

Dropper is an independent project and is not affiliated with or endorsed by Twitch.
