---
title: Getting Started
description: Getting started with KaraokeArcade and KaraokeArcade Server
---

You'll want to have a few things to get started with KaraokeArcade:

- **Songs**: KaraokeArcade supports MP4 video files as well as MP3 audio files that have lyrics in an accompanying CDG file (commonly known as [MP3+G](https://en.wikipedia.org/wiki/MP3%2BG){{% icon-external %}}). See the <a href='{{< ref "faq#where-can-i-download-karaoke-songs" >}}'>F.A.Q.</a> if you're looking for songs!

- **Server**: This can be a Windows PC, Mac, or a dedicated server like a Raspberry Pi or NAS. KaraokeArcade Server runs on pretty much anything to serve the web app and your media files.

- **Player**: This will be the system that is connected to your display and speakers, running KaraokeArcade's player in a browser. It could be the same system as the server, but because the player is fully browser-based it doesn't need to be.

Microphones are *not* required since the player itself only outputs music - this allows your audio setup to be as simple or complex as you like. See the <a href='{{< ref "faq#recommended-audio-microphone-setup" >}}'>F.A.Q.</a> for more information.

## 1. Install KaraokeArcade Server

On the system that will serve the web app and your media files, <a href='{{< ref "docs/karaokearcade-server#installation" >}}'>install and run KaraokeArcade Server</a>, then head back here and continue.

## 2. Browse to the Server URL

Once the server is running, browse to the web app at the **server URL**.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>Since the app is designed for mobile, it's recommended to use your phone for the best experience once you're finished with the initial setup here.</p>
</aside>

## 3. Create Admin Account

Since this is your first time with KaraokeArcade, you'll be asked to create your **admin** account.

Make sure you use a strong password and store it someplace safe, since admins can manage users, rooms, preferences and more.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>KaraokeArcade Server stores all data on <strong>your server only</strong>.</p>
</aside>

## 4. Add Media Folders

Once signed in, you'll see an (unsurprisingly) empty library. Head to the Settings view by following the "Add media folders" link or tapping the knob icon in the bottom navigation area (it's there because you're an admin):

<div class="row">
  {{% img "app-settings.png" "Settings view" /%}}
</div>

In the **Preferences** panel, select **Media Folders** and add the folder(s) containing your songs.

## 5. Queue a Song

Once the media scanner is finished, you should see your artists/songs back over in the Library view. If they aren't appearing, make sure your media files are named using the **"Artist - Title"** convention and are a <a href='{{< ref "docs/karaokearcade-server#media-files" >}}'>supported format</a>.

<div class="row">
  {{% img "app-library.png" "Library view" /%}}
</div>

In the Library view, queue a song by tapping an artist, then tapping a song. Go ahead and queue a few - the songs will glow to indicate they're queued. Pretty simple, right?

You can do a lot more in the Library view, but for now let's play some music!

## 6. Start the Player

KaraokeArcade's player is just another part of the browser app, but it's meant to run fullscreen on the system connected to your display and speakers. If you aren't using the system you intend to use as the player, go to it now, browse to the **server URL**, and sign in with your admin account.

Go to **Settings**, where the **Player** panel reports **"no player in room"**. Press **Open Player Here** to start one in a new tab.

<aside class="info" role="note">
  {{% icon-info %}}
  <p>You can also navigate to <code>/player</code> directly. Browsers without fullscreen support can still run a player, they just won't fill the screen.</p>
</aside>

<div class="row">
  {{% img "app-player.jpg" "Player view" /%}}
</div>

Now that there's a player in the room, the playback and display controls appear in that same **Settings > Player** panel, along with the **Show Join Code** button for getting everyone else's phones into the room.

Go ahead and press play in the player to start the party!

<aside class="info" role="note">
  {{% icon-info %}}
  <p>Starting playback inside the player (rather than on a remote device) helps avoid browser auto-play restrictions. See the <a href="{{< ref "faq#enabling-autoplay" >}}">F.A.Q.</a> for more on how to enable auto-play in your browser.</p>
</aside>


## 7. Next Steps

To get the most out of KaraokeArcade, continue with the <a href="{{< ref "docs/karaokearcade-app" >}}">app documentation</a>. Seriously, there's quite a bit going on beneath the surface!

Found a bug or have a request? Open an <a href="https://github.com/matt-antone/KaraokeArcade/issues" rel="noopener">issue</a>{{% icon-external %}}.

KaraokeArcade is a fork of <a href="https://github.com/bhj/KaraokeEternal" rel="noopener">Karaoke Eternal</a>{{% icon-external %}}; if you are able, please consider [sponsoring the upstream project](https://www.karaoke-eternal.com/sponsor) that made this possible.

Now, go get singing!
