---
title: KaraokeArcade (the app)
description: Documentation for KaraokeArcade (the app)
resources:
- src: 'app-library.png'
  params:
    galleryOrder: 1
- src: 'app-queue.png'
  params:
    galleryOrder: 2
- src: 'app-queue-me.png'
  params:
    galleryOrder: 3
- src: 'app-account.png'
  params:
    galleryOrder: 4
- src: 'app-settings.png'
  params:
    galleryOrder: 5
- src: 'app-player.jpg'
  params:
    galleryOrder: 6
---

KaraokeArcade is a modern mobile browser app that lets everyone join without having to install anything on their phones. It's built for touch, but a mouse is supported in desktop browsers (click and drag to emulate swipe gestures).

The bottom navigation has three destinations for everyone - Library, Queue and My Account - plus Settings for admins. The player is not one of them: it's a room fixture set up once from [Settings](#player-admin-only).

- [Status strip](#status-strip)
- [Library](#library)
- [Queue](#queue)
- [My Account](#my-account)
- [Settings (admin only)](#settings-admin-only)
- [Player](#player)

## Status strip

Once a player is in the room and you have something queued, a status strip appears at the top of every screen. It shows your place in the rotation, how long until your turn (counting down as the player plays), and the song you're up next with. When it's your turn it says so.

The strip also carries the pause key. Pausing keeps your songs in the queue but takes you out of the rotation, so the party moves on without you - useful for a drink run or a phone call. Press it again to resume and you're back in line. While paused, your rows show a pause icon instead of a wait time.

## Library

The library lists available songs organized by artist. The header has a search field with a star toggle that narrows the list to your starred songs, and tabs for browsing by **Artists** or **Songs**.

<div class="row">
  {{% img "app-library.png" "Library view" /%}}
  {{% img "app-library2.png" "Starred songs" /%}}
</div>

Tap an artist to expand it, then tap a song to queue it. Queued songs show `QUEUED` and go inert, and songs already sung tonight are dimmed - one tap is the only way to queue, so there's nothing to undo by accident.

Every song row also has a star, with the number of stars that song has across the room. Starring is how you keep a shortlist; the star toggle in the search row filters down to it.

Songs show their duration, and any tags in the filename's trailing `[...]` group appear next to the artist. When a song has multiple versions (media files), admins see an italicized number after the title, and media in the folder highest in the [Media Folders](#preferences-admin-only) list will be used.

## Queue

The queue view has three tabs:

- **Queue** - the room's rotation: the current song and everything still coming
- **Me** - your own upcoming songs, plus what you've sung
- **History** - what the room has sung tonight, newest first

<div class="row">
  {{% img "app-queue.png" "Queue view" /%}}
</div>

KaraokeArcade automatically manages the queue using a round-robin method for fairness, without penalizing those joining later in the party. For example, a latecomer will be able to sing right after the next-up singer regardless of how long the queue was when they joined. Singers who have [paused](#status-strip) are skipped until they resume.

Swiping left on a song reveals its available actions:

<table class="button-descriptions">
  <tbody>
  <tr>
    <td>
      <svg viewBox="0 0 24 24">
        <path d="M5 4v2h14V4H5zm0 10h4v6h6v-6h4l-7-7-7 7z"/>
      </svg>
    </td>
    <td>Top</td>
    <td>Moves the song to become the next one that user sings. Does *not* affect a user's place in the queue. Admins only, on the Queue tab.</td>
  </tr>
  <tr>
    <td>
      <svg class="danger" viewBox="0 0 24 24">
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8"/>
      </svg>
    </td>
    <td>Replay</td>
    <td>Restarts the current song from the beginning.</td>
  </tr>
  <tr>
    <td>
      <svg class="danger" viewBox="0 0 24 24">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
      </svg>
    </td>
    <td>Skip</td>
    <td>Skips the current song and plays the next one.</td>
  </tr>
  <tr>
    <td>
      <svg class="danger" viewBox="0 0 24 24">
        <path d="M14.12 10.47 12 12.59l-2.13-2.12-1.41 1.41L10.59 14l-2.12 2.12 1.41 1.41L12 15.41l2.12 2.12 1.41-1.41L13.41 14l2.12-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM8 9h8v10H8z"/>
      </svg>
    </td>
    <td>Remove</td>
    <td>Removes an upcoming song.</td>
  </tr>
  </tbody>
</table>

Admins can manage anyone's queued songs, while standard users and guests can only manage their own. Replay and Skip act on the song that's playing right now. Songs already sung are locked and have no actions - use the Library to queue one again.

Signing out removes your upcoming songs from the queue.

### The Me tab

<div class="row">
  {{% img "app-queue-me.png" "The Me tab" /%}}
</div>

The Me tab is your own list. **Drag to reorder** your upcoming songs - the order among your songs is yours to set, while the rotation between singers stays automatic - and **swipe** one aside for its keys: a gear that opens **Song Settings**, and **Remove**. Below the list is a shortcut back to the Library and a **Sung Tonight** panel of your history, where each song can be starred.

### Song Settings

**Key** shifts a song up or down by up to six semitones so it sits in your range, without changing its tempo. The key belongs to your place in the queue rather than to the song, so two singers can hold the same track in different keys on the same night, and a shifted song shows its offset on the row. Queue the same song again later and it comes back in the key you last used it in. A song still in its own key plays completely untouched.

## My Account

The My Account view lets you change your username, password, display name or picture, and sign out.

<div class="row">
  {{% img "app-account.png" "Account view" /%}}
</div>

Below that, **Song History** lists the songs you've sung with the date of each, and lets you star them. History is kept per song rather than per party, so it carries over from one night to the next and survives the library being re-scanned.

## Settings (admin only)

Admins get a fourth navigation entry with everything that configures the party: Rooms, Users, Player and Preferences.

<div class="row">
  {{% img "app-settings.png" "Settings view" /%}}
</div>

- [Rooms (admin only)](#rooms-admin-only)
- [Users (admin only)](#users-admin-only)
- [Player (admin only)](#player-admin-only)
- [Trivia](#trivia)
- [Battle](#battle)
- [Preferences (admin only)](#preferences-admin-only)

### Rooms (admin only)

The Rooms panel allows admins to create, edit or remove rooms.

KaraokeArcade uses "rooms" to organize sessions by time and space (spacetime?) Users choose an open room when signing in, and each room has its own queue. **Start each session with an empty queue** - either create a new room, or reuse one and press **Reset for New Night** first. Set the room to `closed` when finished.

<div class="row">
  {{% img "app-settings-room.png" "Room editor" /%}}
</div>

Rooms have a number of options, including:

- **Name**: The room name users will see when signing in (if more than one open room)
- **Password**: An optional password users will be required to enter when signing in
- **Status**: Rooms can have one of the following statuses:
  - `open` Can be signed in to and have songs queued
  - `closed` Can no longer be signed in to or have more songs queued. When closing, current occupants are unaffected and can continue playing through the existing queue
- **Users**: Only users with existing accounts can join a room by default. You can optionally allow users to join with new accounts and/or as guests
- **QR Code**: Displays a QR code in the room's player that will link users to the app, automatically choosing the room and optionally including the room's password if one is set
- **Trivia**: Plays music trivia rounds between singers. See [Trivia](#trivia)
- **Battle**: Lets singers challenge each other to a head-to-head turn, and chooses how the winner is decided. See [Battle](#battle)

**Reset for New Night** hands a used room back in the state a new one arrives in: its queue is emptied, paused singers are un-paused, and the player's list of what has been sung is cleared, so the whole library is selectable again. Use it instead of creating a room per session. Each singer's own record of everything they have ever sung is separate and is not touched.

<aside class="warn" role="note">
  {{% icon-warn %}}
  <p>Removing a room will also remove its queue, so the history of songs played during that session will be lost.</p>
</aside>

### Users (admin only)

The Users panel allows admins to create, edit or remove users.

<div class="row">
  {{% img "app-settings-user.png" "User editor" /%}}
</div>

### Player (admin only)

The Player panel is the only place the player is managed from. It shows whether a player is connected to your room, and holds:

- **Open Player Here**: Opens the player in a new tab on the machine you're using. Do this on the system connected to your display and speakers.
- **Playback controls**: The room's transport (play/pause, skip and so on), shown once a player is connected.
- **Show Join Code**: Displays the room's QR code and link so singers can join from their phones.
- **ReplayGain (clip-safe)**: [ReplayGain](https://en.wikipedia.org/wiki/ReplayGain){{% icon-external %}} metadata tags allow the player to automatically minimize volume differences between songs, resulting in a better experience for all, and without affecting the dynamic range of each song (no compression). This option should generally only be enabled when you know all of your media is properly tagged. It normally reduces the player's overall volume significantly, so just turn your output up, and/or your mics down.
- **Display**: The player's display options - CDG size and alpha, MP4 alpha, video background keying, and the visualizer and its sensitivity.

### Trivia

Trivia gives the room something to do between singers, and gives the guests who would rather not sing a way to play. Switch it on per room in the room editor.

Once it's on, a **Trivia round sits in the queue like any other turn** and is spaced through the rotation the same way singers are - so it comes round about once per lap, however long the queue gets. There is always exactly one waiting: as one is asked, the next joins the rotation behind it. You can see it coming on the Queue tab.

When the player reaches it, the round asks **five questions** back to back. The screen shows each question and its four answers; every phone in the room shows four coloured keys and nothing else, so the room looks up at the screen together rather than down at a dozen phones. Match your key to the answer on screen, or match the number - each key is numbered 1 to 4 in the same order on both, so the colours are never the only thing telling them apart.

- **Play trivia rounds**: Turns rounds on for this room
- **Answer time**: How long a question stays open, from 5 to 60 seconds
- **Reset scores**: Clears this room's scoreboard and starts it empty again

Anyone in the room can answer, whether or not they have a song queued. You get one answer per question - the first key you press is the one that counts - and when the time is up the screen shows the right answer before moving on to the next question. The scoreboard goes up after the fifth, then the next singer is on. Only people who have answered at least once appear on it.

**Answer time** applies to each question, so a round takes roughly five times that plus the answer reveals - at the default 20 seconds that is a little over two minutes. Turn it down if that is longer than your room wants to wait between singers.

Questions come from the [Open Trivia Database](https://opentdb.com/){{% icon-external %}} (music category), and are cached on the server well ahead of time so a party on a LAN with no internet still plays. The cache is topped up whenever the server can reach the API; if a very long party runs through every music question there is, rounds carry on with the ones seen longest ago. Question content is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/){{% icon-external %}}, and the attribution appears on the player screen during every round.

### Battle

A battle is one turn with two singers in it, and each of them picks the other's song. Switch it on per room in the room editor.

- **Allow singer battles**: Turns battles on for this room
- **Judge singer battles by crowd noise**: Swaps the room vote for the microphone. Off by default - see [Deciding the winner](#deciding-the-winner)

Once it's on, a **Battle** key appears in the [status strip](#status-strip) next to the pause key. Tapping it lists everyone else in the room; pick somebody and the app drops you into the library in *picking for them* mode, where the next song you tap is the one **they** will have to sing. Their phone then shows the challenge - who threw it and what they'd be singing - and it stays open for **45 seconds** before it lapses. Accepting puts them into the library the same way, and the song they pick is the one **you** sing. Neither of you sees the other's choice until the battle is on screen.

Both singers also **pick a fighter** - one of eight, and whoever you pick is who the room watches on stage for your turn. Your own fighter is yours to choose; you do not get a say in your opponent's.

The roster is artwork rather than configuration, so it is fixed at eight. If you want your own, [CharacterAssetGenerator](https://github.com/matt-antone/CharacterAssetGenerator){{% icon-external %}} turns a written brief into the sprite sheets a fighter is made of.

The battle takes over the challenger's next queued song, keeping its exact place in the rotation - so a battle costs the challenger the turn they already had rather than adding one, and nobody waiting behind them moves back. If the challenger has nothing queued, it joins the back of the queue as a new turn. Either singer can back out until both songs are in; after that it's a queue row like any other and the usual swipe actions apply.

When the player reaches it, the TV stops being a lyrics screen and becomes an arcade cabinet: the two fighters square off, the songs are announced, and the row runs as one continuous sequence - each singer introduced and singing in turn, then the verdict. **Each song is capped at two minutes** - it ends at the cap or when the song runs out, whichever comes first - so a whole battle is about five minutes of the night. That's two songs' worth of queue time spent on one turn, which is the trade to know about before switching it on for a room with a long queue.

While a battle is on, every phone in the room carries a strip under the status strip saying who's singing and how long is left on their two minutes.

#### Deciding the winner

The room decides, and there are two ways it can. Which one a room uses is set in the room editor.

**By vote (the default).** After both songs, every phone in the room shows a ballot for thirty seconds: two keys, one per singer. One vote each, and you can vote whether or not you sang or have anything queued. It is silent in both directions - nobody is told who voted for whom, and **nobody sees the count until the verdict**, including the TV. A tally filling up in public collects the undecided behind whoever is ahead, which measures who voted first rather than who sang better.

**By crowd noise.** Switch on **Judge singer battles by crowd noise** and the ballot is replaced by the player listening through the microphone: it takes a reading while the room cheers for each singer in turn, and the loudest one wins. The score climbs on screen as it's measured, and the second singer's turn shows the number they have to beat.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>Crowd scoring needs a microphone, and browsers only hand a page one on a secure origin - so it works on a player opened at <code>http://localhost</code>, on the machine running the server, and not at a LAN address. If a room is set to crowd noise and its player can't hear the room, those battles are decided as a draw. Rooms on the default vote are unaffected: a ballot runs on the phones and needs nothing of the player's machine.</p>
</aside>

### Preferences (admin only)

The Preferences panel holds the **Media Folders** list. Add folders with [supported media files]({{< ref "docs/karaokearcade-server#media-files" >}}) to scan them into the library. You can re-arrange the folder order by dragging and dropping, and when songs have multiple versions the one in the folder highest in the list will be used.

## Player

The player is just another part of the app, and is designed to run fullscreen on the system handling audio/video for a [room](#rooms-admin-only). The latest versions of these browsers are officially supported:

  - Chromium/Chrome/Edge
  - Firefox
  - Safari

<div class="row">
  {{% img "app-player.jpg" "Player view" /%}}
</div>

To start a player, go to the system driving your audio, sign in to the desired room as an admin, and use **Open Player Here** in [Settings > Player](#player-admin-only). You can also navigate to `/player` directly.

Once a player is in the room, the transport and display options in that same panel become the room's controls. Between songs the player runs a short intermission - roughly fifteen seconds - that names and pictures the next singer, so they have time to get to the mic, and shows the room's join QR code while it waits.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>Starting playback inside the player (rather than on a remote device) helps avoid browser auto-play restrictions. See the <a href="{{< ref "faq#enabling-autoplay" >}}">F.A.Q.</a> for more on how to enable auto-play in your browser.</p>
</aside>
