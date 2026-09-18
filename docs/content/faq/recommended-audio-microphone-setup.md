---
title: What's the recommended audio/microphone setup?
category: General
weight: 1
---

KaraokeArcade makes no assumptions about audio input so that it can work with any mic setup (including none at all) - the one exception is crowd-noise battle scoring, which listens through the player machine's own microphone if a room switches it on (this needs a secure origin: localhost or https). To mix the player's output (the music) with mics, there are generally 2 approaches:

  - Software mixing: The system running the player uses a USB or Thunderbolt audio interface that has mic(s) connected.
  - Hardware mixer: An external/outboard mixer has mic(s) connected, as well as the audio from the system running the player.
