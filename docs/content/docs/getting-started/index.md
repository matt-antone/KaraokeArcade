---
title: Getting Started
description: Getting started with KaraokeArcade and KaraokeArcade Server
---

You need three things to start with KaraokeArcade:

- **Songs**: KaraokeArcade plays MP4 video files, and MP3 or M4A audio files with the lyrics in a CDG file next to them ([MP3+G](https://en.wikipedia.org/wiki/MP3%2BG){{% icon-external %}}), loose or zipped. See the <a href='{{< ref "faq#where-can-i-download-karaoke-songs" >}}'>F.A.Q.</a> for places to get songs.

- **Server**: a Windows PC, a Mac, a Raspberry Pi or a NAS. KaraokeArcade Server runs on almost anything. It serves the app and your media files.

- **Player**: the machine connected to your TV and speakers. It runs the player in a browser. It can be the server machine, but it does not have to be.

You do not need a microphone. The player only outputs music, so your audio setup can be as simple or as complex as you like. The one exception is crowd-noise battle scoring. See the <a href='{{< ref "faq#recommended-audio-microphone-setup" >}}'>F.A.Q.</a>.

## 1. Install KaraokeArcade Server

On the machine that serves the app and your media files, <a href='{{< ref "docs/karaokearcade-server#installation" >}}'>install and run KaraokeArcade Server</a>. Then come back here.

## 2. Open the server URL

When the server runs, open the app at the **server URL** in a browser.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>The app is made for a phone. Use your phone for everything after this first setup.</p>
</aside>

## 3. Create the admin account

The first screen is **First run**. Type a name and a strong password, pick a security question and answer it, then push the start button.

<div class="row">
  {{% img "new/first-run.jpg" "First run" /%}}
  {{% img "new/select-singer.jpg" "Select your singer" /%}}
</div>

Store the password somewhere safe. Admins manage users, rooms, the player and the media folders. The security question lets you reset the password from the sign-in screen.

Next, **select your singer**. This is the character the room sees as you. Then read **How to score** and push **Continue**.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>KaraokeArcade Server stores all data on <strong>your server only</strong>.</p>
</aside>

## 4. Add a media folder

The library is empty. Push **Add media folders**, or open the **Admin** tab.

<div class="row">
  {{% img "new/library-empty.jpg" "An empty library" /%}}
  {{% img "new/admin.jpg" "The Admin tab" /%}}
</div>

In the **Media folders** panel, push **Add folder** and pick the folder that holds your songs. The scanner starts at once.

## 5. Queue a song

When the scan is done, the **Songs** tab lists your artists and songs. If they do not appear, make sure the files are named **"Artist - Title"** and are a <a href='{{< ref "docs/karaokearcade-server#media-files" >}}'>supported format</a>.

<div class="row">
  {{% img "new/library.jpg" "The library" /%}}
  {{% img "new/queue.jpg" "The queue" /%}}
</div>

Tap a song to queue it. Your turn card at the top shows your place. Tap the song again to take it back out.

## 6. Start the player

The player is part of the app. It runs fullscreen on the machine connected to your TV and speakers. On that machine, open the **server URL** and sign in with your admin account.

Open the **Admin** tab. The **Player** panel says **No player in room**. Push **Open player here**.

<div class="row">
  {{% img "new/tv-join.jpg" "The TV before the first song" "1x" /%}}
</div>

<aside class="info" role="note">
  {{% icon-info %}}
  <p>You can also go to <code>/player</code>. A browser without fullscreen support still runs a player. It just does not fill the screen.</p>
</aside>

The TV shows **Scan to play** with the room's QR code. Push **Start** on the TV. The first song plays.

<div class="row">
  {{% img "new/tv-playing.jpg" "A song on the TV" "1x" /%}}
</div>

<aside class="info" role="note">
  {{% icon-info %}}
  <p>Push Start on the player itself, not on a phone. A browser does not play sound until somebody taps the page. See the <a href="{{< ref "faq#enabling-autoplay" >}}">F.A.Q.</a> to allow autoplay.</p>
</aside>

## 7. Next steps

Guests scan the QR code on the TV to join. Read the <a href="{{< ref "docs/karaokearcade-app" >}}">app documentation</a> for the turn card, trivia, singer battles, points and the admin panels.

Found a bug or have a request? Open an <a href="https://github.com/matt-antone/KaraokeArcade/issues" rel="noopener">issue</a>{{% icon-external %}}.

KaraokeArcade is a fork of <a href="https://github.com/bhj/KaraokeEternal" rel="noopener">Karaoke Eternal</a>{{% icon-external %}}. If you can, please [sponsor the upstream project](https://www.karaoke-eternal.com/sponsor).
