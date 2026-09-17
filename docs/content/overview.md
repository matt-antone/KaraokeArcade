---
title: Overview
description: Everything KaraokeArcade does - the karaoke queue, music trivia and singer battles - how it compares to Karaoke Eternal, and how to install, support and contribute to it.
---

**Your TV is the stage. Everybody's phone is the remote. Nobody installs anything.**

KaraokeArcade runs the whole night from a browser. Guests scan a QR code, search your library, queue a song and watch their place in line from the couch. You self-host it on a laptop, a Mac mini, a Raspberry Pi or a NAS - no accounts to make, no subscription, no ads, nothing phoning home.

## One queue, three kinds of turn

There is one rotation and everything takes its turn in it. A trivia round and a singer battle sit in the queue exactly like a song does - they come round when they come round, and each costs a turn.

Trivia and battles are off until a host turns them on for a room, so a night that is only songs is only songs.

### Karaoke

The part everybody came for. See <a href='{{< ref "docs/karaokearcade-app" >}}'>the app</a> for how each screen works.

{{< screenshots >}}

<p style="text-align: center;">
  <i>App in mobile browser (top) controlling player in desktop browser (bottom)</i>
</p>

- **Queue from the couch.** Search by artist or song, star the ones you want later, tap once to get in line.
- **Know when you're up.** A <a href='{{< ref "docs/karaokearcade-app/#status-strip" >}}'>strip at the top of every screen</a> counts down to your turn.
- **Step away.** Hit pause and the rotation skips you until you're back - your songs keep their place.
- **Your list is yours.** Drag your own upcoming songs into the order you want on the <a href='{{< ref "docs/karaokearcade-app/#the-me-tab" >}}'>Me tab</a>. The rotation between singers stays automatic.
- **Sing it in your key.** <a href='{{< ref "docs/karaokearcade-app/#song-settings" >}}'>Shift a song</a> up or down six semitones without changing its tempo, and it remembers next time.
- **A moment between songs.** A short intermission names and shows the next singer, so nobody's left hunting for the mic.

### Trivia

Music trivia that takes the gap between two singers, so the room has something to do - and the guests who would rather not sing get a way to play. See <a href='{{< ref "docs/karaokearcade-app/#trivia" >}}'>Trivia</a>.

<div class="pair">
{{< img "images/trivia-tv.jpg" "Trivia on the TV" "1x" />}}
{{< img "images/trivia-phone.jpg" "Trivia on a phone" "1x" />}}
</div>

- A round waits in the queue like a singer does, and comes up about once per lap.
- **Five questions**, on an arcade cabinet on the TV, with four coloured keys on every phone in the room.
- Anyone can play, whether or not they have a song queued. One answer each, first tap counts.
- The right answer goes up for everyone at once, then how many got it. After the last question come the high scores on a podium, then the winner, then the next singer is on.
- Questions come from the <a href="https://opentdb.com/" rel="noopener">Open Trivia Database</a>{{% icon-external %}} and are cached ahead of time, so a party in a basement with no internet still plays.

### Singer Battle

One turn, two singers, and each of them picks the other's song. It runs on the TV as an arcade cabinet: fighters, a VS slam, two-minute rounds and a verdict. See <a href='{{< ref "docs/karaokearcade-app/#battle" >}}'>Battle</a>.

<div class="pair">
{{< img "images/battle-tv.jpg" "Singer Battle on the TV" "1x" />}}
{{< img "images/battle-phone.jpg" "Voting on a phone" "1x" />}}
</div>

- **Pick who you sing as.** Eight fighters; whoever you choose is who the room watches on stage.
- **Throw a challenge.** Pick somebody in the room, then pick the song *they* have to sing. Their phone gets 45 seconds to accept - and the song they pick back is the one *you* sing. Neither of you sees the other's choice until it's on screen.
- **Two minutes each**, so a whole battle is about five minutes of the night and costs one place in the queue, not two.
- **The room decides.** Everybody votes on their own phone - one vote each, anonymous, and nobody sees the count until the verdict. Hosts who would rather have it loud can switch the room to crowd-noise scoring instead.

**Create your own fighters** with <a href="https://github.com/matt-antone/CharacterAssetGenerator" rel="noopener">CharacterAssetGenerator</a>{{% icon-external %}}.

## Good to know

- **Nothing to install for guests** - it's a web app; joining is a QR code and a name.
- **Guests welcome.** Let people in with an account, a new sign-up or as a guest, room by room.
- **More than one room.** Each has its own queue and can be password-protected.
- **Your library stays yours.** Point it at your folders; it scans <a href='{{< ref "docs/karaokearcade-server/#media-files" >}}'>MP3+G (including zipped) and MP4</a>.
- **Music-synced visualizations.** A WebGL visualizer runs behind the lyrics for MP3+G, and behind MP4 when <a href='{{< ref "docs/karaokearcade-app/#preferences-admin-only" >}}'>video background keying</a> is switched on for that folder - the key colour is detected for you.
- **No ads, no telemetry, no cloud account.** Self-hosted, and ISC-licensed.

Microphones are *not* required since the player itself only outputs music - this allows your audio setup to be as simple or complex as you like. See the <a href='{{< ref "faq.md/#recommended-audio-microphone-setup" >}}'>F.A.Q.</a> for more information.

## How KaraokeArcade compares

KaraokeArcade is a fork of <a href="https://github.com/bhj/KaraokeEternal" rel="noopener">Karaoke Eternal</a>{{% icon-external %}}, and tracks it for the media, scanning and server side. Where it differs is what the night feels like for the people in the room.

| Feature | KaraokeArcade | Karaoke Eternal |
| --- | --- | --- |
| **Queue from your phone** | Yes | Yes |
| **MP3+G, MP4, visualizer** | Yes | Yes |
| **QR-code joining, guest accounts** | Yes | Yes |
| **Fair round-robin rotation** | Yes | Yes |
| **Reorder your own songs** | Drag them on your *Me* tab | Host only |
| **See how long until your turn** | Counts down in the header | Guess from the list |
| **Step away without losing your spot** | Pause and resume | Remove and re-queue |
| **Between songs** | Intermission names the next singer | Songs run back-to-back |
| **Music trivia rounds** | Built in, takes its own turn | — |
| **Head-to-head singer battles** | Built in, with fighters and a room vote | — |
| **Make your own fighters** | A written brief becomes sprite sheets, via an AI pipeline | — |
| **What you've sung** | Kept per singer, across parties | — |
| **Change key** | ±6 semitones, same tempo, remembered next time you queue it | — |
| **Look and feel** | DECK — dark, mixing-desk | The original Karaoke Eternal UI |
| **Self-hosted, ad-free, no telemetry** | Yes | Yes |

Both are free and ISC-licensed. If you want the original's simplicity, it's an excellent piece of software and you should use it.

## Getting Started

KaraokeArcade has three parts. See <a href='{{< ref "docs/getting-started" >}}'>Getting Started</a> to get up and running step-by-step, or jump to the documentation for each part below:

- **<a href='{{< ref "docs/karaokearcade-server" >}}'>Server:</a>** Runs on a Windows PC, a Mac, a Raspberry Pi or a NAS, and serves both the app and your media files.
- **<a href='{{< ref "docs/karaokearcade-app" >}}'>App:</a>** Fast, modern mobile web app designed for "karaoke conditions".
- **<a href='{{< ref "docs/karaokearcade-app/#player" >}}'>Player:</a>** Just another part of the app, but meant to run fullscreen on the system handling audio/video for a <a href='{{< ref "docs/karaokearcade-app/#rooms-admin-only" >}}'>room</a>.

## Installation

There are several <a href='{{< ref "docs/karaokearcade-server#installation" >}}'>installation methods</a> available for KaraokeArcade Server.

## Support

For bugs and requests specific to KaraokeArcade, open an <a href="https://github.com/matt-antone/KaraokeArcade/issues" rel="noopener">issue</a>{{% icon-external %}}. KaraokeArcade is forked from <a href="https://github.com/bhj/KaraokeEternal" rel="noopener">Karaoke Eternal</a>{{% icon-external %}}.

## Contributing & Development

Contributions are welcome - please open an <a href="https://github.com/matt-antone/KaraokeArcade/issues" rel="noopener">issue</a>{{% icon-external %}} before starting on anything major, since the project's scope is deliberately narrow.

You'll need <a href="https://nodejs.org/en/" rel="noopener">Node.js</a>{{% icon-external %}} v24 or later and <a href="https://bun.sh" rel="noopener">Bun</a>{{% icon-external %}} v1.2 or later:

1. Fork and clone the <a href="{{% baseurl %}}repo">repo</a>{{% icon-external %}}
2. `bun install`
3. `npm run dev`, then look for "Web server running at" for the server URL

Other useful scripts: `npm test` (vitest), `npm run lint`, `npm run typecheck`, and `npm run build` followed by `npm run serve` for a production run.

## Acknowledgements

- <a href="https://github.com/bhj/KaraokeEternal" rel="noopener">Karaoke Eternal</a>{{% icon-external %}} by RadRoot LLC: the project KaraokeArcade is forked from, used under the ISC license
- <a href="https://zuko.me" rel="noopener">David Zukowski</a>{{% icon-external %}}: react-redux-starter-kit, which that project began as a fork of (all contributors up until it was detached to its own project are listed on the Contributors page)
- <a href="https://github.com/ltucker/" rel="noopener">Luke Tucker</a>{{% icon-external %}}: the original JavaScript CD+Graphics implementation
- <a href="https://opentdb.com/" rel="noopener">Open Trivia Database</a>{{% icon-external %}}: the trivia questions, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a>{{% icon-external %}}
