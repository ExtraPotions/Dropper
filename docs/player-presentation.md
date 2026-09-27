# Twitch channel-player recovery

The supplied 3.3.4 report shows playing video and increasing Twitch credit, but contains no player presentation or dimensions. It does not establish what triggered mini-player mode. Dropper previously checked playback only and made no attempt to restore a mini-player left on a channel arrival.

The repair uses Twitch’s native button inside [data-a-player-state="mini"]. The current English accessible label is Expand Player. This was verified in Twitch’s public frontend asset core-10ca3f02c9ee778f17d1.js on 2026-09-26; the handler expands/navigates to its content or scrolls back to the anchored player. No Twitch internal state or private methods are modified. Unknown controls are left unchanged.

Automatic recovery is limited to one requested expansion in the first 30 seconds, before trusted pointer, wheel, touch or scroll-key interaction. It requires the exact channel route, a visible enabled native control, visible document and unpaused intent. It never calls video.play, requestFullscreen or picture-in-picture APIs. A manual action bypasses the arrival window but keeps route and mode checks. Diagnostics report the mode, video dimensions, control availability and last request result. An expansion request is not reported as confirmed success.

Reference: https://help.twitch.tv/s/article/a-tour-of-your-channel-page

Tests use a reduced DOM matching the public player contract plus pause, interaction, opt-out, timeout, fullscreen, browser PiP, non-channel routes, missing controls and unrelated buttons. Authenticated Firefox reproduction remains unverified.
