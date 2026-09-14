# Competitive Feature Research — KaraokeArcade

**Date:** 2026-08-26
**Question:** What features do competing karaoke systems offer that KaraokeArcade lacks, and which should we add?
**Method:** 6 search angles → 29 sources fetched → 141 claims extracted → 25 verified by 3-vote adversarial review (20 confirmed, 5 refuted) → 14 synthesized findings. Competitor scope limited to self-hosted/OSS and commercial party/venue-KJ tools; consumer social singing apps (Smule, StarMaker) deliberately excluded.

---

## Executive summary

KaraokeArcade's **architecture is already at parity** with the best self-hosted competitors. PiKaraoke matches it on all three defining traits — no-app mobile web remote joined by QR, a browser-openable full-screen player, and Pi-to-PC/Docker deploy. The gap is not infrastructure; it is the layer of party/KJ features built on top.

Two clusters account for nearly all of it:

1. **Key/pitch change.** The only feature present in *every* competitor surveyed. Critically, in mature tools it is not a live transport knob — it is metadata stored on the queue entry, set at request time, and remembered per singer across shows.
2. **Per-singer memory and show flow.** Persistent singer profiles with saved queues, host-selectable rotation insertion policy, host moderation of requests, singer notifications, break/filler music, and an on-screen rotation ticker.

Almost none of this is blocked by the browser + Node architecture. The genuine constraints are narrow: browser autoplay gating on remote-started playback, and low-latency mic monitoring — which upstream deliberately keeps external.

---

## What KaraokeArcade has today

Established by reading the repo, not inferred:

| Area | Present |
|---|---|
| Queue | Linked-list ordering (`prevQueueId`), per-user pause/resume (`queuePauses`), admin move/remove |
| Rooms | Multiple, password-protected, roles table (`005-roles.sql`) |
| Identity | Guest accounts, QR join |
| Library | Filename→artist/title MetaParser, `[genre, tag]` taxonomy tags, stars by id **and** by normalized name, path priority for preferred version, tag/starred filters |
| Singer memory | `songHistory` table **with UI** — `src/routes/Account/components/SongHistory` |
| Player | CDG, MP4, MP4-alpha, WebGL/Butterchurn visualizer, ReplayGain, volume/play/pause/next/replay |
| Server | Scanner + file-watcher workers, SQLite migration chain, socket.io |

**Confirmed absent:** grep of `src/`, `server/`, `shared/` for `pitch|semitone|transpose|detune|playbackRate|preservesPitch` returns **zero hits**. The `queue` table (`001-initial-schema.sql`) is `queueId, roomId, songId, userId` — no key column, no position parameter, no note field.

---

## Findings

### 1. Architecture is parity, not differentiation
*Confidence: medium (2-1)*

PiKaraoke's README advertises "Instant Mobile Remote: Search and queue songs from any smartphone—just scan and sing" and a "Dedicated Player… that can be opened on any web browser", running on Pi 3/4, macOS, Windows, Linux, with `--headless` and an official Docker image. Karaoke Eternal advertises the same three traits.

Divergence outside those three is real — PiKaraoke is Python/Flask with a yt-dlp-centric pipeline and no first-class multi-room; KaraokeArcade ships password-protected rooms — so this is not "no differentiation at all", but the architecture is not the moat.

Sources: [pikaraoke](https://github.com/vicwomg/pikaraoke) · [wiki](https://github.com/vicwomg/pikaraoke/wiki) · [docker](https://hub.docker.com/r/vicwomg/pikaraoke) · [karaoke-eternal.com](https://www.karaoke-eternal.com/)

### 2. Pitch/key shift is the most universal gap
*Confidence: high*

- **PiKaraoke** — "Live Pitch Shifting: Adjust the key of any song to match your vocal range". Implemented server-side: `ffmpeg.py` takes `semitones: int = 0` and applies `audio.filter("rubberband", pitch=2 ** (semitones / 12))`. This is a re-encode on key change, not free realtime DSP.
- **OpenKJ** — README lists "Key changer", "Tempo control", "EQ".
- **Siglos** — key ±12 tones, tempo −100%/+100%.
- **SongbookDB** — key selector exposed directly to guests, range widened from ±3 to ±5 per release notes.
- Upstream request exists as `bhj/KaraokeEternal` issue #45.

Sources: [pikaraoke ffmpeg.py](https://raw.githubusercontent.com/vicwomg/pikaraoke/master/pikaraoke/lib/ffmpeg.py) · [OpenKJ](https://github.com/OpenKJ/OpenKJ) · [Siglos Pro manual](https://www.powerkaraoke.com/download/SiglosPro.pdf) · [SongbookDB](https://pcdj.com/songbookdb/)

### 3. Key change is queue metadata, not a transport control
*Confidence: high*

This is the finding that shapes the design. OpenKJ's schema: `INSERT INTO queuesongs (singer, song, artist, title, discid, path, keychg, played, position)`, with `UPDATE queuesongs SET keychg = :key WHERE qsongid = :id`, surfaced as a right-click "Set Key Change" prompt in semitones and a `COL_KEY` column; playback reads it via `setPitchShift(song.keyChange)`.

Siglos changelog 1.2.22: "Key change now is remembered per song for each singer", with a KJ setting "Reset key to zero for songs not sung by the singer (by default latest key change for singer is used)".

SongbookDB's guest request form renders "Key change (optional): − 0 +" alongside "Note to DJ (optional)".

*Caveats:* OpenKJ's live spinbox tweaks are transient — only the right-click action persists — and cross-session persistence requires the singer be flagged a regular. Siglos persists key per singer but **tempo only per rotation entry**.

Sources: [OpenKJ tablemodelqueuesongs.cpp](https://raw.githubusercontent.com/OpenKJ/OpenKJ/master/src/models/tablemodelqueuesongs.cpp) · [Siglos changelog](https://www.powerkaraoke.com/download/changelog/siglos/ChangeLog.txt) · [Siglos KJ settings](https://www.powerkaraoke.com/help/siglospro/idh_kjsettings.html) · [songbookdb.com](https://www.songbookdb.com/)

### 4. Persistent singer profiles are KJ-software baseline
*Confidence: high*

OpenKJ marks a "tracked regular singer" with a heart icon; clicking it saves the singer and continues to track songs added, deleted or moved **and saves associated key changes** for future sessions. Siglos fills a returning singer's song list from past performances, with venue tagging and a "Show from current venue only" filter. PCDJ Karaoki ships a "Singer Data" screen storing prior requests including key change, per-singer song stacks, and an "On Break" state.

KaraokeArcade already has more of this than the raw comparison suggests — `songHistory` exists *and is surfaced* in the Account view, and `songStarsByName` survives scanner re-minting of songIds. **The missing piece is specifically key memory and cross-session queue restore**, not history itself.

Sources: [OpenKJ docs](https://docs.openkj.org/doku.php?id=getting_started) · [Siglos Pro](https://www.powerkaraoke.com/download/SiglosPro.pdf) · [PCDJ Karaoki](https://pcdj.com/karaoke-software/karaoki/)

### 5. Rotation fairness is an explicit host-controlled policy
*Confidence: high*

OpenKJ's add-singer dialog: "'Fair' (default) means that the singer will be added one full rotation from the current position… 'Next' will put them after the current singer. 'Bottom' will add them at the bottom of the current rotation."

Siglos runs strict round-based rotation with a separate singer list: "first play one song for each singer before allowing the second round."

KaraFun's Singer Rotation is group-based round-robin ("By default, one group corresponds to one remote"; groups mergeable; pre-existing items land in an "Unassigned Group"). It shipped April 2025 as a **pro-exclusive feature** on the ~$49/mo venue tier, while the ~$9.99 consumer tier is private-use-only. Fairness is deliberately sold as the venue differentiator — a useful signal about what the market prices.

KaraokeArcade's `Queue.add({roomId, songId, userId})` hard-codes tail insertion; `QUEUE_ADD` carries only `songId`; the only repositioning is a separate admin drag via `QUEUE_MOVE`.

Sources: [OpenKJ docs](https://docs.openkj.org/doku.php?id=getting_started) · [Siglos playback mgmt](https://www.powerkaraoke.com/help/siglospro/idh_playback_management.html) · [KaraFun help](https://www.karafun.com/help/web_484.html) · [KaraFun blog](https://www.karafun.com/blog/1511-singer-rotation-a-new-exclusive-feature-for-effortless-karaoke-hosting.html) · [KaraFun pro pricing](https://www.karafun.com/our-pro-offers)

### 6. Host-moderated request approval
*Confidence: high*

Karaoke Mugen models two modes: private karaoke = "all additions are made directly to the current list"; public karaoke = "songs are added to the suggestion list first then validated by an operator", who can accept or refuse (refusing returns the requester's quota). A third poll mode votes on 4 random suggestions per song change.

SongbookDB lets the KJ "switch song requesting on or off… ban requesters" (banned users move to a Blocked Users grid) and optionally "turn on 'auto mode' so requests are automatically sent to rotation without any manual interaction".

Grep of KaraokeArcade for `suggest|approve|pendingApproval|moderat` returns nothing.

Sources: [Karaoke Mugen operator docs](https://docs.karaokes.moe/user-guide/operator/index.html) · [playlists](https://docs.karaokes.moe/user-guide/playlists/index.html) · [SongbookDB PAL docs](https://www.songbookdb.com/docs2/songbookdb-pal-documentation.php)

### 7. Richer guest request payload
*Confidence: high*

SongbookDB guests "choose the song version they want to sing and set any key changes"; the form carries a key delta plus a free-text "Note to DJ". Join is by 5-character KJ handle or QR.

Siglos remote request mode lets "customers create their accounts, so they can check the songs they have sung in the past, add them to the rotation, and manage their rotation without bothering the KJ", secured by a numeric code, with per-request key change and a Remarks field (plus a KJ setting "Pause when remarks entered").

*Correction carried from source:* Siglos's connectkaraoke.com relay is now free for active Pro users, not the paid service the 2022 manual describes.

Sources: [SongbookDB](https://pcdj.com/songbookdb/) · [singer app update](https://pcdj.com/songbookdb-singer-app-update-1-5-6/) · [Siglos Pro](https://www.powerkaraoke.com/download/SiglosPro.pdf)

### 8. Show-flow surfaces beyond the queue
*Confidence: high*

OpenKJ lists as distinct features "Fades break music in and out automatically when karaoke tracks start/end" and "Rotation ticker on the CDG display" — the ticker crawls across the bottom showing current singer, rotation size, and upcoming singers, with configurable font/size/height. Issue #199 requests a hotkey to *override* the automatic break music, confirming the automatic behavior ships.

SongbookDB: "BUZZ – alert singers when their song is ready" and "SHOUT OUT" to message everyone currently viewing the songbook — both subscription-gated.

Sources: [OpenKJ](https://github.com/OpenKJ/OpenKJ) · [issue #199](https://github.com/OpenKJ/OpenKJ/issues/199) · [SongbookDB hoster app](https://www.songbookdb.com/docs2/SongbookDB-Mobile-Requests-Hoster-app.php)

### 9. Mic features are absent by design, not oversight
*Confidence: high*

Karaoke Eternal FAQ: "Karaoke Eternal makes no assumptions about audio input so that it can work with any mic setup (including none at all)", offering only external approaches — an audio interface with software mixing, or a hardware mixer. Repo grep confirms zero `getUserMedia` / `mediaDevices` / `MediaRecorder` / `createAnalyser` call sites; the only Web Audio use is output-side (`Player.tsx` `createMediaElementSource` feeding Butterchurn).

By contrast OpenKJ ships "Automatic performance recording". So this is feasible-but-unbuilt rather than impossible — but low-latency in-app monitoring is where the browser genuinely fights back.

Sources: [KE FAQ](https://www.karaoke-eternal.com/faq/) · [OpenKJ](https://github.com/OpenKJ/OpenKJ)

### 10. Browser autoplay policy is a real architectural tax
*Confidence: high*

Upstream FAQ: "Most browsers block media from playing automatically unless the webpage has been interacted with in some way, which can cause issues when starting the player remotely", followed by four per-browser settings workarounds. App docs: "Starting playback inside the player (rather than on a remote device) helps avoid browser auto-play restrictions."

A native player process would not face this. The in-app mitigation available is an explicit arm-playback interaction on player load.

Sources: [KE FAQ](https://www.karaoke-eternal.com/faq/) · [KE app docs](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/)

---

## Ranked backlog

Effort estimates are engineering judgment from reading `Queue.ts`, the migration chain, and `Player.tsx` — **not** from prototyping.

### Tier 1 — largest competitive gap

**T1. Per-song key change: queue metadata + playback pitch shift + per-singer memory**
One feature triad, not three.

- *Impact:* High. Only feature present in every competitor surveyed. Requested upstream (KE #45). Makes a fixed local library usable by singers whose range doesn't match the recording.
- *Effort:* Medium-high for the DSP, low for everything else.
- *Approach (preferred):* Client-side phase vocoder in an AudioWorklet — SoundTouch-JS or a Rubberband WASM build — inserted between the existing `createMediaElementSource` node and destination. Works for MP3+G **and** MP4 (`createMediaElementSource` accepts video elements) and preserves duration, so CDG graphics timing stays synced.
- *Approach (fallback):* Server-side FFmpeg + rubberband transcode on key change — PiKaraoke's method. Costs a re-encode; poor fit for a Pi.
- *Not a substitute:* plain `playbackRate` shifts tempo and pitch together.
- *Schema:* one migration adding `keyChange` to `queue`, a ±control in the guest request UI, defaulting from the user's last value for that song (Siglos's exact behavior) with an opt-out setting.
- *Load-bearing unknown:* AudioWorklet CPU headroom on Pi-class hardware, and CDG sync across a full song. Validate before committing.

### Tier 2 — high impact, low effort, ship first

**T2a. Host-selectable queue placement (next / fair / bottom)**
`Queue.add` already builds a linked list and `Queue.move` already relocates nodes — adding a position parameter reuses existing machinery. Closes the OpenKJ Fair/Next/Bottom gap *and* the VIP/cut-in-line case in one change. Days, not weeks.

**T2b. On-player rotation ticker**
Player already renders overlays (`PlayerTextOverlay`, `UpNow`) and holds queue state client-side. Current singer + next-up is presentation-only.

**T2c. "You're up next" notification to the guest phone**
The socket connection already exists — an in-app toast plus `navigator.vibrate` covers SongbookDB's BUZZ case while the page is open. True background Web Push (service worker + VAPID) is a separate, larger step and should not gate the cheap version.

**T2d. Free-text note-to-host on requests**
One nullable column plus a text input. Mirrors Siglos Remarks / SongbookDB "Note to DJ". Immediately useful for duets ("singing with Dana") **without building a duet data model**.

### Tier 3 — medium impact, medium effort

**T3a. Per-room moderated mode**
Guest requests land in a suggestion list the host accepts or refuses. What separates a house party (open queue is correct) from a bar or public event. Maps onto the existing per-room model as a room flag plus a pending state on the queue row, reusing `005-roles.sql` for who can approve.

**T3b. Host moderation controls**
Requesting on/off, ban a requester, broadcast message. Small additions to the same surface; these are what make the system safe to expose at a public venue.

**T3c. Auto-faded break/filler music**
Largest item in this tier: a second audio source in the player, auto-fade tied to queue transitions, plus a manual override (OpenKJ users asked for exactly that override). Medium effort, high perceived polish.

### Tier 4 — defer or decline

- **Mic-derived scoring, performance recording, in-app monitoring/mixing.** Upstream's no-mic stance is a deliberate constraint that keeps the audio setup arbitrarily flexible. `getUserMedia` makes scoring and recording technically possible, but capture-to-output latency makes in-app monitoring unusable against a hardware mixer. **Mic mixing should stay explicitly out of scope and be documented as such.**
- **Global tempo and EQ.** Even OpenKJ keeps these global-only — only key is per-singer. Lower value than the key work they'd ride alongside.
- **Streaming output (OBS/Twitch/Chromecast).** High effort, contested value.

Prioritization signal: KaraFun charges roughly 5× for the tier carrying rotation fairness. **The party-UX features in Tiers 1–3 are what the market actually prices — not media-processing exotica.**

---

## Caveats

**Source mix skews vendor-authored.** Every commercial claim (PCDJ Karaoki, SongbookDB, Siglos, KaraFun) rests on the vendor's own pages, manuals, or help docs. Appropriate for feature-*existence* claims, but there is no independent verification of how well any of it works, and marketing language ("fair", "complete control") is not an algorithm specification. OSS claims are stronger — OpenKJ and PiKaraoke were verified against master-branch source.

**Three source-access problems.** `docs.openkj.org` returned HTTP 525 during verification, so OpenKJ doc quotes came from search-cached text corroborated against C++ source where possible. `powerkaraoke.com` returned 403 to automated fetch; the Siglos PDF was the primary evidence there, and it is © 2022 documenting Siglos Pro 2.0 — dated prior art, not verified current behavior.

**Five claims were refuted 0-3 and are excluded.** Notably: that PiKaraoke's YouTube download is the biggest library-acquisition differentiator; that OpenKJ's remote songbook is a paid hosted service; and that catalog-parity features are blocked by licensing. **The licensing question is unresolved rather than settled — this report makes no legal claim.**

**Two claims were softened.** OpenKJ's tempo and EQ are global, not per-singer. Siglos remembers key per singer but not tempo. The backlog reflects the corrected versions.

**Effort estimates are unvalidated.** Particularly the AudioWorklet pitch-shift estimate, which has not been tested against real CDG sync or Pi-class CPU.

---

## Open questions

1. **Does an AudioWorklet phase vocoder hold up on real player hardware?** CPU headroom on a Pi-class host, and CDG graphics staying synced with pitch-shifted audio across a full song. This is the load-bearing unknown under T1; if it fails, the fallback is a server-side transcode that is a poor fit for a Pi.
2. **What are the real licensing constraints** on karaoke media for a self-hosted, no-catalog project — specifically whether storing per-singer key changes, recording performances, or streaming output creates exposure a plain local-file player does not. Genuinely open; the claim asserting licensing blocks catalog parity was refuted.
3. **Which of these matter to *our* users** versus which are venue/KJ-professional needs a house-party product should decline? This report ranks by competitive gap and effort, with **no demand-side evidence**. Moderated mode (T3a) and break music (T3c) are venue features whose value to a home user is unverified.
4. ~~How much per-singer memory already exists?~~ **Closed.** `songHistory` and `songStarsByName` both exist and are surfaced in the UI (`src/routes/Account/components/SongHistory`, `ButtonStar` across Library and Queue). The gap is key memory and cross-session queue restore, not history.

---

## Sources

**Self-hosted / OSS**
[pikaraoke](https://github.com/vicwomg/pikaraoke) · [pikaraoke wiki](https://github.com/vicwomg/pikaraoke/wiki) · [pikaraoke docker](https://hub.docker.com/r/vicwomg/pikaraoke) · [OpenKJ](https://github.com/OpenKJ/OpenKJ) · [OpenKJ docs](https://docs.openkj.org/doku.php?id=getting_started) · [OpenKJ #119](https://github.com/OpenKJ/OpenKJ/issues/119) · [OpenKJ #199](https://github.com/OpenKJ/OpenKJ/issues/199) · [OpenKJ #201](https://github.com/OpenKJ/OpenKJ/issues/201) · [Karaoke Mugen](https://mugen.karaokes.moe/en/) · [Mugen operator docs](https://docs.karaokes.moe/user-guide/operator/index.html) · [kjams Rotation wiki](https://karaoke.kjams.com/wiki/Rotation) · [karaoke-for-jellyfin](https://github.com/johnpc/karaoke-for-jellyfin) · [allkaraoke](https://github.com/Asvarox/allkaraoke)

**Upstream**
[karaoke-eternal.com](https://www.karaoke-eternal.com/) · [FAQ](https://www.karaoke-eternal.com/faq/) · [app docs](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/) · [server docs](https://www.karaoke-eternal.com/docs/karaoke-eternal-server/)

**Commercial KJ / venue**
[PCDJ rotation list](https://pcdj.com/its-all-about-the-karaoke-singer-rotation-list/) · [PCDJ Karaoki](https://pcdj.com/karaoke-software/karaoki/) · [SongbookDB](https://pcdj.com/songbookdb/) · [songbookdb.com](https://www.songbookdb.com/) · [SongbookDB PAL docs](https://www.songbookdb.com/docs2/songbookdb-pal-documentation.php) · [SongbookDB kiosk mode](https://pcdj.com/songbookdb-kiosk-mode/) · [Siglos Pro manual](https://www.powerkaraoke.com/download/SiglosPro.pdf) · [Siglos changelog](https://www.powerkaraoke.com/download/changelog/siglos/ChangeLog.txt) · [KaraFun help](https://www.karafun.com/help/web_484.html) · [KaraFun rotation blog](https://www.karafun.com/blog/1511-singer-rotation-a-new-exclusive-feature-for-effortless-karaoke-hosting.html) · [KaraFun pro offers](https://www.karafun.com/our-pro-offers)

**Implementation feasibility**
[soundtouchjs-audio-worklet](https://github.com/cutterbl/soundtouchjs-audio-worklet) · [CDGPlayer](https://github.com/cutterbl/CDGPlayer) · [AirConnect](https://github.com/philippe44/AirConnect)

**Practitioner discussion**
[Karaoke Scene: "What is a 'fair' rotation?"](https://www.karaokescene.com/forums/viewtopic.php?f=1&t=15581&start=60) · [Karaoke Scene Magazine forum](https://www.karaokescenemagazine.com/forums/viewtopic.php?f=1&t=5821)

**Licensing** *(gathered; no legal conclusion drawn)*
[Singa: USA karaoke licensing](https://singa.com/blog/usa-karaoke-licensing-for-bars-and-venues-explained-in-5-minutes/) · [KaraFun content & copyright](https://business.karafun.com/helpcenter/content-and-copyright_278.html) · [FindLaw: 9th Cir. karaoke file copying](https://www.findlaw.com/legalblogs/ninth-circuit/court-says-no-trademark-infringement-for-copying-karaoke-files/) · [Twitch music legal](https://legal.twitch.com/en/legal/music/)
