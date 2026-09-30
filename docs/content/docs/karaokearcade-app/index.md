---
title: KaraokeArcade (the app)
description: Documentation for KaraokeArcade (the app)
---

KaraokeArcade runs in the browser on each guest's phone. Nobody installs anything. The app is built for touch. A mouse works in a desktop browser: click and drag to swipe.

The bottom bar has four tabs for everyone: **Songs**, **Queue**, **Me** and **Scores**. Admins get a fifth tab, **Admin**. The player is not a tab. The host sets it up once from [Admin](#admin-admin-only).

- [Join a room](#join-a-room)
- [Your turn card](#your-turn-card)
- [Songs](#songs)
- [Queue](#queue)
- [Me](#me)
- [Scores](#scores)
- [Trivia](#trivia)
- [Singer Battle](#singer-battle)
- [Admin (admin only)](#admin-admin-only)
- [Player](#player)

## Join a room

1. Scan the QR code on the TV.
2. Drag the token into the slot.
3. Under **Join as**, pick **Returning user**, **New user** or **Guest**. The room decides which of these it offers.
4. Type your name. Push the start button.
5. Select your singer.
6. Read **How to score**. Push **Continue**.

<div class="row">
  {{% img "new/select-singer.jpg" "Select your singer" /%}}
  {{% img "new/how-to-score.jpg" "How to score" /%}}
</div>

Your singer is you everywhere: in the queue, on the TV when you are up next, on the trivia podium and in a battle. To change it later, open the **Me** tab and push **Change singer**.

The first person to open a new server sees **First run** instead. That screen makes the admin account. See <a href='{{< ref "docs/getting-started" >}}'>Getting Started</a>.

## Your turn card

The header on every screen shows your singer, your name, your points tonight and your place on the board. Under it, your turn card shows your next song, the wait until your turn and a meter that fills as your turn comes near.

<div class="row">
  {{% img "new/queue.jpg" "Your turn card with a song queued" /%}}
  {{% img "new/up-next.jpg" "You're up next" /%}}
</div>

- **II** pauses your songs. The rotation skips you. Your songs stay on hold. Push the yellow key to resume.
- **VS** starts a Singer Battle challenge. See [Singer Battle](#singer-battle).
- Under one minute out, a full-screen **You're up next** alert takes over. Push **I'm ready**, or **Not yet** to pause your songs.

## Songs

The Songs tab is the library. Search by artist or title. Push the star key to show only your starred songs. The two tabs list the library by **Songs** or by **Artists**.

<div class="row">
  {{% img "new/library.jpg" "The library" /%}}
  {{% img "new/library-queued.jpg" "A queued song and a played song" /%}}
</div>

- Tap a song to queue it. Tap your own queued song again to take it back out.
- A song that somebody else queued says **Queued**.
- A song that was sung tonight is dimmed. It comes back when the host stops the room.
- Push the star on a row to star that song. The number on the star counts the stars from the whole room.
- If the room is paused or stopped, rows are disabled with a note.

A trailing `[...]` group in the filename shows as tags next to the artist. When a song has more than one media file, admins see a count after the title. The file in the media folder highest in the [Media folders](#media-folders) list plays.

## Queue

The Queue tab shows the stage and the rotation. The **Now singing** banner shows who is on stage, on their own stage, with the song. When the stage is empty, the banner says so.

<div class="row">
  {{% img "new/queue-now-singing.jpg" "Now singing" /%}}
</div>

The three tabs under the banner:

- **Queue**: the room's rotation, in order, with a number on each row
- **Me**: your own upcoming songs, plus what you sang
- **History**: what the room sang tonight, newest first

The rotation is round-robin. A latecomer sings after the next singer, however long the queue was. A paused singer is skipped until they resume. A trivia round and a battle each have a row in the queue, and each costs one turn.

Swipe a row to the left to see its keys:

- **Settings** (gear): opens [Song settings](#song-settings) for that song
- **Top**: moves the song to be that singer's next song. It does not move the singer in the rotation. Admin only.
- **Remove**: removes an upcoming song

Admins can manage anyone's songs. A standard user or a guest can manage only their own. A song that was sung is locked and has no keys.

When a standard user or a guest signs out, their upcoming songs leave the queue. An admin's songs stay.

### The Me tab

The Me tab is your own list. Hold a row to drag it. The order of your own songs is yours to set. The rotation between singers stays automatic. Swipe a row for its keys.

### Song settings

**Key** shifts a song up or down by up to six semitones. The tempo does not change. The key belongs to your place in the queue, not to the song. Two singers can hold the same track in two keys on the same night. When you queue the same song again later, it comes back in the key you used last.

## Me

The Me tab shows your singer on their own stage. Push **Change singer** to pick another one.

<div class="row">
  {{% img "new/me.jpg" "The Me tab" /%}}
</div>

**Points tonight** lists where your points came from: songs sung, battles won, battles played and trivia. See [Scores](#scores).

**Profile** lets you change your name, your password and your security question. Your name is what the queue and the TV show. You do not need your current password to make a change.

If you forget your password, push **Forgot password?** on the sign-in screen. Type your name and answer your security question. Five wrong answers lock the reset for 15 minutes. An account with no security question needs an admin to reset the password.

Under the profile: the room you are in, with a **Leave** key, and your **song history**. History is kept per song, so it carries from one night to the next.

## Scores

Each room keeps one board for the night. Everyone who joins the room is on the board at zero. The Scores tab shows the board, with your own place and points at the top.

<div class="row">
  {{% img "new/scores.jpg" "Tonight's scores" /%}}
</div>

| Turn | Points |
| --- | --- |
| A song sung to the end | 150 |
| A trivia question: easy / medium / hard | 100 / 200 / 500 |
| A battle won | 1000 |
| A battle lost or drawn | 250 |

A turn that the host skips pays nothing. The TV shows the board between songs. When the host stops the room, the board clears.

## Trivia

Trivia gives the room a game between two singers. The audience can play. Nobody needs a song queued. The host turns trivia on per room in the [room editor](#rooms).

<div class="row">
  {{% img "new/trivia-phone.jpg" "A trivia question on a phone" /%}}
</div>

When trivia is on, one trivia round waits in the queue like a singer does. It comes round about once per lap. As one round is asked, the next one joins the back of the rotation.

A round asks **five questions**: two easy, two medium and one hard, in that order. Every phone shows the question, a countdown and four answer keys. The first key you tap counts. The TV shows the same question, and the players' singers stand on podiums under it.

After each question the right answer stays on screen for about six seconds. A right answer makes your singer do a victory. A wrong answer knocks your singer down. After the fifth question the TV shows the winner, then the next singer is on.

<div class="row">
  {{% img "new/tv-trivia.jpg" "A question on the TV" "1x" /%}}
  {{% img "new/tv-trivia-reveal.jpg" "The answer" "1x" /%}}
</div>

Room options:

- **Play trivia rounds**: turns rounds on for this room
- **Answer time**: how long a question stays open, from 5 to 60 seconds. The default is 20.
- **Reset scores**: clears this room's board

Questions come from the [Open Trivia Database](https://opentdb.com/){{% icon-external %}}, music category. The server fetches them live when a round comes up. If the server cannot reach the internet, the round is skipped. A session token stops repeats. A server restart forgets the token. Question content is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/){{% icon-external %}}. The TV shows the attribution during each round.

## Singer Battle

A battle is one turn with two singers in it. Each singer picks the other one's song. The host turns battles on per room in the [room editor](#rooms).

<div class="row">
  {{% img "new/battle-pick-opponent.jpg" "Pick your opponent" /%}}
</div>

1. Push **VS** in the header.
2. Pick your opponent from the singers in the room.
3. The library opens in picking mode. Tap the song **they** sing.
4. Their phone shows the challenge, with the song. It stays open for **30 seconds**.
5. If they accept, the library opens on their phone. They tap the song **you** sing.
6. If they decline, or the time runs out, your phone says **No contest**.

Each singer's own character is the one on stage. You do not pick your opponent's.

The battle takes over the challenger's next queued song and keeps its place in the rotation. If the challenger has nothing queued, the battle joins the back of the queue.

On the TV, the battle runs as one sequence:

<div class="row">
  {{% img "new/tv-battle-versus.jpg" "Versus" "1x" /%}}
  {{% img "new/tv-battle-intro.jpg" "On stage next" "1x" /%}}
</div>

1. **Versus**: both singers, both songs, a countdown, then **Begin**.
2. The challenger's turn, then the opponent's turn. **Each song is capped at two minutes.**
3. The room decides. See [Deciding the winner](#deciding-the-winner).
4. The verdict: the winner's victory, the loser's knockdown, and the points.

<div class="row">
  {{% img "new/tv-battle-sing.jpg" "A round" "1x" /%}}
  {{% img "new/tv-battle-vote.jpg" "The vote" "1x" /%}}
  {{% img "new/tv-battle-winner.jpg" "The verdict" "1x" /%}}
</div>

A whole battle takes about five minutes and costs one place in the queue.

### Deciding the winner

**By vote (the default).** After both songs, every phone in the room shows two keys, one per singer. The two singers cannot vote. One vote each. The vote is open for 30 seconds. The split fills live on the TV as the votes come in.

**By crowd noise.** Turn on **Judge singer battles by crowd noise** in the room editor. The player listens through its microphone while the room cheers for each singer in turn. The louder cheer wins.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>Crowd scoring needs a microphone. A browser gives a page a microphone only on a secure origin. So it works on a player opened at <code>http://localhost</code> on the server machine, and not at a LAN address. If a room is set to crowd noise and its player cannot hear, those battles are a draw.</p>
</aside>

The winner gets 1000 points. The loser gets 250. On a draw both get 250. A battle that the host skips before the verdict pays nothing. The loser's phone offers a **Rematch**.

### Singer sets

The default set has eight singers. A Halloween set has eight more. An admin can add a set: put a folder of singers next to the default one under `assets/battle/fighters`, then turn it on per room in the room editor. [CharacterAssetGenerator](https://github.com/matt-antone/CharacterAssetGenerator){{% icon-external %}} makes the sprite sheets a singer is made of.

## Admin (admin only)

The Admin tab holds four panels: **Rooms**, **Users**, **Player** and **Media folders**.

<div class="row">
  {{% img "new/admin.jpg" "The Admin tab" /%}}
</div>

### Rooms

KaraokeArcade uses rooms to keep sessions apart. Each room has its own queue and its own board. Guests pick a room when they sign in.

Each room's row has two keys:

- **Play / Pause**: a playing room offers Pause; a paused or stopped room offers Play. In a paused room the player stops, and nobody new can sign in or queue. Nothing is lost.
- **Stop**: with a confirmation, empties the queue, resumes paused singers, clears the played list and clears the board. Use it to reset a room for a new night.

Tap the room name to open the room editor:

<div class="row">
  {{% img "new/edit-room.jpg" "The room editor" /%}}
  {{% img "new/edit-room-games-on.jpg" "Trivia and battle options" /%}}
</div>

- **Name** and an optional **password**
- **Users**: allow new standard users and/or new guests. By default only existing accounts can join.
- **QR code**: show the join code on the TV, include the room password, and set its size and opacity
- **Trivia**: see [Trivia](#trivia)
- **Singer Battle**: see [Singer Battle](#singer-battle), plus which singer sets the room offers

<aside class="warn" role="note">
  {{% icon-warn %}}
  <p>Do not remove a room while a night runs. Removing a room removes its queue and signs out everyone in it.</p>
</aside>

### Users

The Users panel lists accounts with their singers. Admins can create, edit or remove users, and filter the list by room.

### Player panel

The Player panel is the only place the player is managed from.

<div class="row">
  {{% img "new/admin-player.jpg" "The Player panel" /%}}
  {{% img "new/join-code.jpg" "The join code" /%}}
</div>

- **Open player here**: opens the player in a new tab on this machine. Do this on the machine connected to the TV and the speakers.
- **Show join code**: shows the room's QR code and link.
- **Transport**: play/pause, **Next** and volume, shown when a player is connected. **Next** is the one skip for every kind of turn. A skip during a battle ends the battle for the room.
- **ReplayGain (clip-safe)**: uses [ReplayGain](https://en.wikipedia.org/wiki/ReplayGain){{% icon-external %}} tags to even out volume between songs. Turn it on only when your media is tagged.
- **Display**: the visualizer (on/off, presets, sensitivity) and the lyrics size and background. Video background keying is set per media folder.

### Media folders

Add the folders that hold your songs. See <a href='{{< ref "docs/karaokearcade-server#media-files" >}}'>supported media files</a>. Drag the folders to change their order. When a song has more than one media file, the file in the highest folder plays.

## Player

The player is part of the app. It runs fullscreen on the machine connected to the TV and the speakers. The latest versions of Chrome, Edge, Firefox and Safari are supported.

<div class="row">
  {{% img "new/tv-join.jpg" "Scan to play" "1x" /%}}
  {{% img "new/tv-playing.jpg" "A song on the TV" "1x" /%}}
  {{% img "new/tv-scores.jpg" "Tonight's scores on the TV" "1x" /%}}
</div>

To start a player, sign in as an admin on the machine that drives the TV, then push **Open player here** in [Admin › Player](#player-panel). You can also go to `/player`.

The TV shows these screens:

- **Scan to play**: the join code and the room. One figure stands in the room for each singer who is in, as the singer they picked, up to forty.
- **Tonight's scores**: every singer of the night as a card, best first. It takes turns with the join screen while the room waits.
- **On stage next**: the next singer, on their own stage, with their song. The three singers after them show at the bottom.
- **A song**: the lyrics, with the singer beside them and a progress bar at the top.
- Trivia rounds and battles take over the whole screen. See [Trivia](#trivia) and [Singer Battle](#singer-battle).

<aside class="info" role="note">
  {{% icon-info %}}
  <p>Push <strong>Start</strong> on the player itself, not on a phone. A browser does not play sound until somebody taps the page. See the <a href="{{< ref "faq#enabling-autoplay" >}}">F.A.Q.</a> to allow autoplay in your browser.</p>
</aside>
