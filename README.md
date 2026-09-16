# KaraokeArcade

**Your TV is the stage. Everybody's phone is the remote. Nobody installs anything.**

KaraokeArcade runs the whole night from a browser. Guests scan a QR code, search your library, queue a song and watch their place in line from the couch. You self-host it on a laptop, a Mac mini, a Raspberry Pi or a NAS — no accounts to make, no subscription, no ads, nothing phoning home.

## One queue, three kinds of turn

There is one rotation and everything takes its turn in it. A trivia round and a singer battle sit in the queue exactly like a song does — they come round when they come round, and each costs a turn.

### 🎤 Karaoke

The part everybody came for. MP3+G, MP4 and a music-synced visualizer, a round-robin queue that stays fair as people arrive, and singers who can manage their own spot without asking the host for anything.

[![Karaoke on a phone](/docs/assets/images/karaoke.jpg?raw=true)](/docs/assets/images/karaoke.jpg?raw=true)

- **Queue from the couch.** Search by artist or song, star the ones you want later, tap once to get in line.
- **Know when you're up.** A strip at the top of every screen counts down to your turn.
- **Step away.** Hit pause and the rotation skips you until you're back — your songs keep their place.
- **Your list is yours.** Drag your own upcoming songs into the order you want. The rotation between singers stays automatic.
- **Sing it in your key.** Shift a song up or down six semitones without changing its tempo, and it remembers next time.
- **A moment between songs.** A short intermission names and shows the next singer, so nobody's left hunting for the mic.

### 🧠 Trivia

Music trivia that takes the gap between two singers, so the room has something to do — and the guests who would rather not sing get a way to play.

[![Trivia](/docs/assets/images/trivia.jpg?raw=true)](/docs/assets/images/trivia.jpg?raw=true)

- A round waits in the queue like a singer does, and comes up about once per lap.
- **Five questions**, big on the TV, four colored keys on every phone in the room.
- Anyone can play, whether or not they have a song queued. One answer each, first tap counts.
- The right answer goes up for everyone at once, then the scoreboard, then the next singer is on.
- Questions come from the [Open Trivia Database](https://opentdb.com/) and are cached ahead of time, so a party in a basement with no internet still plays.

### 🥊 Singer Battle

One turn, two singers, and each of them picks the other's song. It runs on the TV as an arcade cabinet: fighters, a VS slam, two-minute rounds and a verdict.

[![Singer Battle](/docs/assets/images/singer-battle.jpg?raw=true)](/docs/assets/images/singer-battle.jpg?raw=true)

- **Pick who you sing as.** Eight fighters; whoever you choose is who the room watches on stage.
- **Throw a challenge.** Pick somebody in the room, then pick the song *they* have to sing. Their phone gets 45 seconds to accept — and the song they pick back is the one *you* sing. Neither of you sees the other's choice until it's on screen.
- **Two minutes each**, so a whole battle is about five minutes of the night and costs one place in the queue, not two.
- **The room decides.** Everybody votes on their own phone — one vote each, anonymous, and nobody sees the count until the verdict. (Prefer it loud? A player running on the machine with the mic can score it on crowd noise instead.)

**Create your own singers** with [CharacterAssetGenerator](https://github.com/matt-antone/CharacterAssetGenerator).

Trivia and battles are off until a host turns them on for a room, so a night that is only songs is only songs.

## Good to know

- **Nothing to install for guests** — it's a web app; joining is a QR code and a name.
- **Guests welcome.** Let people in with an account, a new sign-up or as a guest, room by room.
- **More than one room.** Each has its own queue and can be password-protected.
- **Microphones are not required.** The player only outputs music, so your audio setup can be as simple or as serious as you like — see the [F.A.Q.](docs/content/faq/recommended-audio-microphone-setup.md)
- **Your library stays yours.** Point it at your folders; it scans MP3+G (including zipped) and MP4.
- **No ads, no telemetry, no cloud account.** Self-hosted, and ISC-licensed.

## How KaraokeArcade compares

KaraokeArcade is a fork of [Karaoke Eternal](https://github.com/bhj/KaraokeEternal), and tracks it for the media, scanning and server side. Where it differs is what the night feels like for the people in the room.

| | KaraokeArcade | Karaoke Eternal |
| --- | --- | --- |
| **Queue from your phone** | ✅ | ✅ |
| **MP3+G, MP4, visualizer** | ✅ | ✅ |
| **QR-code joining, guest accounts** | ✅ | ✅ |
| **Fair round-robin rotation** | ✅ | ✅ |
| **Reorder your own songs** | ✅ Drag them on your *Me* tab | Host only |
| **See how long until your turn** | ✅ Counts down in the header | Guess from the list |
| **Step away without losing your spot** | ✅ Pause and resume | Remove and re-queue |
| **Between songs** | ✅ Intermission names the next singer | Songs run back-to-back |
| **Music trivia rounds** | ✅ Built in, takes its own turn | ❌ |
| **Head-to-head singer battles** | ✅ Built in, with fighters and a room vote | ❌ |
| **Make your own fighters** | ✅ A written brief becomes sprite sheets, via an AI pipeline ([CharacterAssetGenerator](https://github.com/matt-antone/CharacterAssetGenerator)) | ❌ |
| **What you've sung** | ✅ Kept per singer, across parties | ❌ |
| **Change key** | ✅ ±6 semitones, same tempo, remembered next time you queue it | ❌ |
| **Look and feel** | DECK — dark, mixing-desk | The original Karaoke Eternal UI |
| **Self-hosted, ad-free, no telemetry** | ✅ | ✅ |

Both are free and ISC-licensed. If you want the original's simplicity, it's an excellent piece of software and you should use it.

## Getting started

KaraokeArcade has three parts. [Getting Started](docs/content/docs/getting-started/index.md) walks through them step by step:

- **[Server](docs/content/docs/karaokearcade-server/index.md)** — runs on a Windows PC, a Mac, a Raspberry Pi or a NAS, and serves both the app and your media. Several [installation methods](docs/content/docs/karaokearcade-server/index.md#installation) are available.
- **[App](docs/content/docs/karaokearcade-app/index.md)** — the phone app everyone uses. Nothing to install.
- **[Player](docs/content/docs/karaokearcade-app/index.md#player)** — the same app, running fullscreen on whatever is hooked up to your TV and speakers.

## Support

For bugs and requests specific to this fork, open an [issue](https://github.com/matt-antone/KaraokeArcade/issues).

## Contributing & development

Contributions are welcome — please open an issue before starting on anything major, since the project's scope is deliberately narrow.

You'll need [Node.js](https://nodejs.org/en/) v24 or later and [Bun](https://bun.sh) v1.2 or later:

1. Fork and clone the repo
2. `bun install`
3. `npm run dev`, then look for "Web server running at" for the server URL

Other useful scripts: `npm test` (vitest), `npm run lint`, `npm run typecheck`, and `npm run build` followed by `npm run serve` for a production run.

## Credits

KaraokeArcade is a fork of [Karaoke Eternal](https://github.com/bhj/KaraokeEternal) by RadRoot LLC, used under the ISC license. Trivia questions come from the [Open Trivia Database](https://opentdb.com/), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
