# Feature Backlog — KaraokeParty

Features we intend to build, with enough detail to start from. Sibling to
[competitive-features.md](competitive-features.md), which is a dated research
report on what competitors have; this file is the living list and includes
ideas of our own that no competitor ships.

Neither file is published — Hugo serves `docs/content/`.

**Status key:** `spec` needs design decisions resolved · `ready` can be picked up · `shipped`

---

## Shipped

- **Per-song key change** — queue metadata, Song Settings dialog on the Me tab, playback pitch shift, per-singer key memory. Was Tier 1 in the research report.
- **Music trivia** — rounds between singers, four answer keys on the phone, scoreboard on the player, five questions fetched per round. Was our own idea; how each open question was settled is recorded below.
- **Reset a room for a new night** — Reset for New Night in the Edit Room dialog, admin-gated. Empties the room's queue, lifts its pauses, and clears the player's `historyJSON`. `songHistory` untouched. Rooms are now reusable across nights.
- **Song battles** — one queue row with two singers in it, each of whom picks the other's song. Challenge and accept from the phone, a nine-beat sequence on the player, and the room's cheering read through the player's microphone to pick a winner. Was our own idea; how each open question was settled is recorded below.

---

## Reset a room for a new night

**Status:** shipped · **Effort:** low · **Source:** our own idea

A button on the room that hands it back empty, so the same room can host more
than one night instead of a new one being created each time.

### Intent

- A **room setting** resets the room.
- Afterwards the room behaves like a new one: empty queue, nobody paused, and
  the whole library **selectable again**.

### How "played" works today, verified

Worth reading before building, because the obvious implementation resets the
wrong thing.

- A played song's library row is **disabled**, not hidden — `SongItem.tsx` sets `disabled={isUpcoming || isPlayed}`, so it renders greyed and cannot be tapped. That is the behaviour this feature switches off.
- `isPlayed` comes from `getSongsStatus`, which reads **`status.historyJSON`**: a JSON array of `queueId`s for the player's current session.
- That array is **not in the database**. `PlayerController` appends to it as each song plays and it rides to the room on `PLAYER_STATUS`. It lives in the running player and nowhere else.
- So this is a **command to the player**, like replay and next, not a database write. Reset means asking the player to empty the array and push its status.
- Replay already rewinds part of it: `PlayerController` splices the history back to the replayed `queueId`.
- **Because it is player state, closing or reloading the player already clears it.** This feature is a deliberate button for the same effect, and that is worth confirming is what is wanted — if the intent is for the reset to survive a player restart, the history has to move to the database first, which is a much larger change.

### The trap

There are two different things called history, and resetting the wrong one
destroys data a guest cares about.

| | What it is | Should this button touch it? |
|---|---|---|
| `status.historyJSON` | queueIds played in the player's current session; drives the library disabling | **Yes** — this is the feature |
| `songHistory` table | per user, per song, keyed on normalized artist/title; survives nights and library rescans; shown in **Sung Tonight** and on the Account view | **No** — this is a guest's personal record of everything they have ever sung |

### What the spec above got wrong

Both corrections came out of driving the built feature against a real library.

1. **Clearing the history does not re-open the library.** `SongItem` disables on `isUpcoming || isPlayed`, and a played song's queue row survives. Emptying `historyJSON` only flips the row from *played* to *upcoming* — still disabled, and now it plays again when its turn comes round. The spec traced the `isPlayed` path and missed the other half of the condition.

2. **The stated use is between nights, and there the history reset is a no-op.** Closing the player already empties `historyJSON`. What actually survives the night is the queue, which is why the docs used to say to create a room per session. Reuse needs the queue cleared, so that is what the button does.

### How it was settled

1. **What it does:** empties the room's queue, deletes its `queuePauses` rows, and commands the player to clear `historyJSON` — a room handed back in the state a new one arrives in. A pause left over from last night would silently keep a singer out of the rotation with nothing on screen to explain it, hence the second delete.
2. **Where the button lives:** the Edit Room dialog, next to Remove Room, labelled **Reset for New Night**. It targets a `roomId` rather than the sender's own room, so an admin can reset a room they are not signed in to — which is the between-nights case.
3. **Who may press it:** admins. `ROOM_RESET_REQUEST` checks `sock.user.isAdmin`, the same gate `ROOM_PREFS_PUSH_REQUEST` uses.
4. **Confirmed** with a `confirm()`, matching Remove Room and Remove User.

The queue is a database write pushed with `QUEUE_PUSH`; the played list is not in the database, so it takes a command — the player stamps `_lastHistoryResetTime` and `PlayerController` empties `historyJSON` and pushes its status, the same path a skip takes.

---

## Music Trivia — how it was built

**Status:** shipped

Rounds between singers, sourced from the [Open Trivia Database](https://opentdb.com/),
music category. The spec is above in git history; this is what was decided
where the spec left a question open, and why.

### The eight open questions, settled

1. **Four answer colours joined the token file**, as a deliberate, tested
   addition: `--ans-1..4` with `-hi`/`-lo` stops and matching key faces. They
   are answer *channels*, not signals — nothing is ever "in the `--ans-2`
   state" — so they sit outside the vu/standby/alert family the palette test
   counts and carry a closure assertion of their own. Every lit stop measures
   4.84–4.86:1 against `--ink`, the same footing `--alert-key-hi` already had,
   so no answer reads louder than its peers. Crimson, moss, indigo and plum:
   dark and mid-chroma rather than the spec's literal red/blue/green/purple,
   because amber and teal are spoken for and confectionery colours do not
   belong on a graphite faceplate.

2. **Colour is the third channel, not the only one.** Each key carries a
   numeral and a fixed position in a 2×2 grid, identical on the phone and the
   screen. `AnswerKey` is one shared component for exactly this reason: key 3
   cannot come out one colour in one place and another elsewhere. A test
   asserts the four stay at least 60° apart in hue.

3. **A trivia round is a real queue row.** `queue` gained a `type` column
   (`'song'` / `'trivia'`) with `songId` and `userId` made nullable — the row
   type, which the spec's own note called the cleaner of the two options, in
   preference to a reserved system user and a synthetic media type. Migration
   012 rebuilds the table (SQLite cannot drop `NOT NULL` in place); 013 adds
   the `datePlayed` marker that makes "the round waiting" a thing the server
   can query rather than infer, since play history lives only in the running
   player.
   `Queue.get`'s three `INNER JOIN`s became `LEFT JOIN`s, with the filter they
   were silently doing — a song whose media has gone is not playable and must
   not appear — written out in the `WHERE` clause rather than lost. On the
   wire a round carries `songId`/`userId` of `0` and a `userDisplayName` of
   "Trivia", so every consumer that filters by singer or looks a song up keeps
   working untouched, and the four places that must behave differently use the
   `isTriviaItem` guard.

4. **The rotation spaces a round exactly as it spaces a singer.** The round
   carries `userId` 0 on the wire, and `getRoundRobinQueue` does not special-
   case it at all — it goes through the same round-robin as everyone else, so
   it comes up once per lap however deep the queue gets.
   *This was got wrong first.* The round was pinned to the back of the queue,
   which looks right with two songs waiting and is useless with fifteen: on a
   real queue it sat an hour out and the room would never have reached it.
   Being a participant rather than a pinned row is what "takes its turn in the
   rotation" actually means.
   `getMyRotation` is the one place that does skip it, because it counts
   *singers* — a round is a turn, but it is nobody's turn, so counting it
   would make the rotation read one longer than the number of people in it.

5. **"Always exactly one" is enforced by the server, in the queue itself.**
   `Trivia.syncQueue` compares and acts: one pending row when trivia is on,
   none when it is off. `Queue.addTrivia` is idempotent — it returns the
   existing pending row rather than adding a second — so two clients racing
   cannot queue two rounds. It is called on queue add, on room update, on
   connect, and as each round closes. `Trivia.startRound` refuses any queueId
   that is not the pending row, so a player that reloads and replays back
   through the queue cannot re-ask a round the room already answered.

5b. **A round is five questions, not one.** The queue row is held for all
   five: each has its own countdown, its own id (so a tap landing during a
   reveal cannot score against the next question) and a short reveal of the
   right answer; the scoreboard waits for the last one. The row is only
   requeued, and the player only moves on, once the fifth is done. A thin
   cache asks a shorter round rather than no round at all.
   *Cost:* at the default 20-second answer time a round is a little over two
   minutes between singers. The countdown is a room pref, so a host who wants
   it tighter has the dial.

6. **Questions are cached in SQLite and prefetched at server start**, in
   batches of 50, honouring the one-request-per-five-seconds limit with
   margin. `encode=base64` rather than an entity decoder. The session token
   lives in memory only — the cache's unique index on the question text and
   its `dateUsed` column are what actually stop repeats, so nothing is lost on
   restart. Token expiry (code 3) and category exhaustion (code 4) both
   re-request and retry once. **When the cache runs dry it replays the
   question seen longest ago** rather than stopping; when it is empty
   altogether the round is skipped silently, because a party mid-song is the
   wrong place for an error.

7. **Scores live in `triviaScores`**, per room per user, created on a player's
   first answer — so absence from the table *is* "hasn't played", which is
   what the scoreboard rule needed. They survive a restart and are cleared
   only by the reset button. Removing a room clears them too, since they
   reference it.

8. **Everyone in the room may answer**, queued or not — giving the quiet
   guests something to play is the point. One answer each, first press counts.

### Where it lives

- `server/Trivia/Questions.ts` — the OpenTDB client; a round fetches its five questions when it starts
- `server/Trivia/Trivia.ts` — the pending-round invariant, round state, answers, scores
- `server/lib/schemas/012`, `013` — the queue row type and its played marker
- `src/components/AnswerKey/` — the four keys, shared by both surfaces
- `src/components/TriviaDialog/` — the phone's answer pad
- `src/routes/Player/components/PlayerTrivia/` — the question screen and scoreboard
- `src/routes/Queue/components/QueueTriviaItem/` — the round's row in the queue
- `src/lib/useTriviaStage.ts` — when a round is on screen and when it has expired

### Still open

- Scoring is one point per correct answer. No speed bonus, no difficulty
  weighting — worth revisiting only if a party finds ties boring.
- A host cannot skip a round in progress; the countdown is the only way out.
- A round contributes nothing to the wait estimates on the queue rows. It is
  under 30 seconds against songs of three or four minutes, and the countdown
  length is a room pref the guests' clients are not sent.
- Migration 012 was edited after it had already been applied to a running
  development database, which is why 013 exists as a separate file. Migrations
  are immutable once they have run anywhere.

---

## Song Battles — how it was built

**Status:** shipped

Two singers share one turn and each picks the other's song. Negotiated on the
phones, run by the server, judged by the room.

### How it was settled

1. **A battle is one queue row, not two.** Migration 016 adds nullable
   `opponentUserId` and `opponentSongId` to `queue` and `type` gains
   `'battle'`, so the row already carries the challenger in the columns every
   existing consumer reads. A client that has not been taught about battles
   sees a normal song row for the challenger rather than nothing, which is the
   same graceful-degradation trade trivia's `userId 0` made. No foreign keys
   on the two new columns, deliberately: `User.remove` deletes rows where
   somebody is *either* fighter, and a constraint would have made that a
   different, larger conversation about cascade order.

2. **The challenger's next turn becomes the battle, in place.** One `UPDATE`
   converts the row, so it keeps its exact slot in the `prevQueueId` chain and
   the battle costs the challenger the turn they already had rather than
   adding one to the queue. Everybody behind them keeps their place. Only when
   the offered row is gone, already played, or not theirs does a new row go on
   the tail, reusing `Queue.add`'s existing subselect.

3. **Each side chooses the other's song, and neither sees the choice early.**
   The challenger picks for the opponent as part of throwing the challenge;
   the opponent picks for the challenger only after accepting. That ordering
   is what makes declining meaningful — you find out what you would have to
   sing before you agree to sing it.

4. **One negotiation per room at a time.** A second pair trying to set up a
   battle in the same moment is refused with a message rather than queued.
   One negotiation, one stage, no race for the same row. It is a real UX
   ceiling; on a floor big enough to notice, an invite would need to be keyed
   per pair rather than per room.

5. **The server owns every beat boundary.** Nine of them — `versus`, `intro1`,
   `sing1`, `intro2`, `sing2`, `judge`, `meter1`, `meter2`, `winner` — each
   emitted as one `BattleTurn` carrying its own `endsAt`, so a phone joining
   mid-battle lands on the right beat and every screen agrees on the clock. A
   singing beat ends at its deadline *or* when the player reports the song
   ran out, whichever is first. Six of them on a player that cannot hear the
   room: `judge` sits in `CROWD_BEATS` with the two meters, because the
   question and the answer go together — on its own it was five seconds of
   asking who wins immediately before announcing a nil-all draw, which reads
   as a crashed screen rather than as a rule.

6. **Two minutes per song, about five minutes per battle.** `BATTLE_SING_MS`
   caps each side at 120s and the eight surrounding beats add 65s. That is two
   songs of queue time spent on one turn, which the wait estimates on the
   queue rows now count.

7. **Names, avatars and song titles are read from the database, never from the
   JWT.** A token can be a month old, so a renamed singer or a changed avatar
   would be stale on the very screen the other fighter is looking at.

8. **The private half of the negotiation never reaches the player.** Invite
   emits skip any socket carrying `_lastPlayerStatus` even when its user id
   matches, because the player display is usually signed in as the host, who
   also sings — a challenge appearing on the television in front of the room
   is a bug, not a feature.

9. **No new colour tokens.** The challenger takes `--ans-1` (crimson) and the
   opponent `--ans-2` (moss), the two answer channels trivia already measured
   for contrast and hue separation. The palette stays closed.

10. **The room decides, by volume, and only where the browser allows it.**
    Scoring reads the player's microphone, which browsers only grant on a
    secure origin — in practice a player opened at `http://localhost` on the
    machine running the server. The player says up front whether it can hear
    the room; when it cannot, the two metering beats are skipped entirely and
    the battle ends level. Documented in the room editor and in the app docs,
    because a silent draw looks exactly like a broken feature.

11. **The room is shown the number it is shouting at.** The metering beats used
    to draw a bouncing bar and nothing else, and the bar is a level while the
    verdict is the mean of the loudest quarter of the beat — two different
    measurements, one of them invisible. The grade is now sampled on the same
    100ms paint as the bar and set beside it, and the opponent's beat carries
    the challenger's grade as a target. It can fall as well as rise, because
    the loudest quarter of a longer beat is a different quarter, and that is
    the honest reading rather than a bug to smooth away.

12. **The phones caption the fight.** Five minutes of one queue row is two
    songs of everybody else's waiting, and until `BattleStrip` the phones said
    nothing at all for the whole of it — the queue showed a row that was
    somehow still current and the header showed a wait that had stopped
    moving. One row in the chrome under Your Turn, in the deck's language
    rather than the television's: an arcade splash is illegible at that size,
    and a modal that owns the phone for five minutes is worse than silence.
    The same strip for everyone, fighters included — a fighter is holding a
    microphone, not a phone.

13. **Both fighters' songs count as sung.** `User.addPlay` recorded
    `queue.userId` and `queue.songId`, which is the challenger's half of the
    row; the opponent sang for two minutes and it never reached
    `songHistory`. Fixed in `addPlay` rather than at the call site, because
    that is the single path every song departs the stage through.

### Where it lives

- `server/Battle/Battle.ts` — invite negotiation, the singer list, and the beat machine
- `server/Battle/socket.ts` — one handler per `server/BATTLE_*` action
- `server/lib/schemas/016-queue-battle.sql` — the two nullable opponent columns
- `server/Queue/Queue.ts` — per-fighter media resolution, `setBattle`/`addBattle`, `isOwner` widened to the opponent
- `server/User/User.ts` — `addPlay`'s second statement, the opponent's half of a battle row
- `src/store/modules/battle.ts` — the eager slice and the `getBattlePick` selector the library asks
- `src/lib/useBattleStage.ts` — which beat is on screen, how much of it is left, and which fighter it belongs to
- `src/components/Header/BattleStrip/` — the same battle, captioned on every phone

### Still open

- **Nothing marks a battle row played.** Trivia stamps `datePlayed` so a
  player reload cannot re-ask a round; a battle has no equivalent, so a player
  that reloads and walks back over the row will run all nine beats again.
  `Queue.setTriviaPlayed` is the pattern if it turns up in practice.
- **A paused opponent is still pulled on stage.** `getRoundRobinQueue` drops a
  row when the *challenger* is paused and not when the opponent is, and
  `getMyUpcoming`'s paused branch loses sight of the battle altogether. Whether
  pausing should cancel a pending battle is undecided.
- **Anyone in the room can post a score for either side**, and the last one in
  wins. The only "is this the player" tell in the codebase is
  `_lastPlayerStatus`, and gating on it would make a battle unwinnable on a
  player that had not yet sent a status.
- **Half a battle cannot be transposed.** Migration 016 added no second
  `keyChange` column, so `opponentKeyChange` is hard-coded 0.
- **`Queue.get`'s chain walk still crashes** when a filtered-out row is not the
  tail — a pre-existing bug that battles make more likely, since a battle needs
  *both* songs to survive a rescan. Worth its own fix: skip rows whose
  `prevQueueId` is missing and re-point.
