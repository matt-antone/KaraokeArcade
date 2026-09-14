---
title: Overview
seoTitle: KaraokeArcade | Open karaoke party system
description: Host awesome karaoke parties where everyone can easily find and queue songs from their phone's browser. The player is also fully browser-based with support for MP3+G, MP4 videos and WebGL visualizations. The server is self-hosted and runs on nearly everything.
---

Host awesome karaoke parties where everyone can easily find and queue songs from their phone's browser. The player is also fully browser-based with support for MP3+G, MP4 videos and WebGL visualizations. The server is self-hosted and runs on nearly everything.

{{< screenshots >}}

<p style="text-align: center;">
  <i>App in mobile browser (top) controlling player in desktop browser (bottom)</i>
</p>

## Features

- Plays:
  - MP3+G (MP3 with CDG lyrics; including zipped)
  - MP4 videos
  - Music-synced visualizations (with automatic lyrics background removal)
- Fast, modern mobile browser app designed for "karaoke conditions"
- Easy joining with QR codes and guest accounts
- Multiple simultaneous rooms/queues (optionally password-protected)
- Dynamic queues keep parties fair, fun and no-fuss
- Singers manage their own spot: a **Me** tab with drag-to-reorder, a wait-time readout with a pause key, and a history of what's been sung
- A short intermission between songs that names and shows the next singer
- Fully self-hosted
- No ads or telemetry

Microphones are *not* required since the player itself only outputs music - this allows your audio setup to be as simple or complex as you like. See the <a href='{{< ref "faq.md/#recommended-audio-microphone-setup" >}}'>F.A.Q.</a> for more information.

## Getting Started

 KaraokeArcade basically has 3 parts. See <a href='{{< ref "docs/getting-started" >}}'>Getting Started</a> to get up and running step-by-step, or jump to the documentation for each part below:

- **<a href='{{< ref "docs/karaokearcade-server" >}}'>Server:</a>** Runs on pretty much anything to serve the web app and your media files.
- **<a href='{{< ref "docs/karaokearcade-app" >}}'>App:</a>** Fast, modern mobile web app designed for "karaoke conditions".
- **<a href='{{< ref "docs/karaokearcade-app/#player" >}}'>Player:</a>** Just another part of the app, but meant to run fullscreen on the system handling audio/video for a <a href='{{< ref "docs/karaokearcade-app/#rooms-admin-only" >}}'>room</a>.

## Installation

There are several <a href='{{< ref "docs/karaokearcade-server#installation" >}}'>installation methods</a> available for KaraokeArcade Server.

## Discord & Support

For bugs and requests specific to KaraokeArcade, open an <a href="https://github.com/matt-antone/KaraokeParty/issues" rel="noopener">issue</a>{{% icon-external %}}. For general karaoke-system support and development chat, there's the <a href="https://discord.gg/PgqVtFq" rel="noopener">Karaoke Eternal Discord Server</a>{{% icon-external %}}, home of the <a href="https://github.com/bhj/KaraokeEternal" rel="noopener">project KaraokeArcade is forked from</a>{{% icon-external %}}.

## Contributing & Development

See the <a href="{{% baseurl %}}repo">GitHub project page</a>{{% icon-external %}}.

## Acknowledgements

- [David Zukowski](https://zuko.me){{% icon-external %}}: react-redux-starter-kit, which this project began as a fork of (all contributors up until it was detached to its own project are listed on the Contributors page)
- [Luke Tucker](https://github.com/ltucker/){{% icon-external %}}: the original JavaScript CD+Graphics implementation
- Mic favicon by [Freepik](https://www.freepik.com/){{% icon-external %}} from [flaticon.com](https://www.flaticon.com/){{% icon-external %}}
