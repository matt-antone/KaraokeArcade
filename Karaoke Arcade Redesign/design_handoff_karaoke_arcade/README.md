# Handoff: KaraokeArcade — Phone Controller + TV Player Screen

## Overview
KaraokeArcade is a bar karaoke system with two surfaces:
- **Phone (controller)** — each guest joins the room, picks a character avatar, browses/queues songs, plays Trivia and Singer Battle, and sees scores.
- **TV (player screen)** — the venue display: idle/join crowd, "now singing" stages, trivia rounds, battle rounds, winners and the night's leaderboard.

Flow: **Insert token → Join (returning / new / guest) → Pick character → Scoring tutorial → Modes** (Songs, Queue, Trivia, Singer Battle, Account, Scores).

## About the Design Files
The files in this bundle are **design references built in HTML** — prototypes showing intended look and behavior, not production code. Recreate them in the target codebase's environment (React, Vue, native, etc.) using its patterns. If no environment exists, choose an appropriate stack (suggested: React + a realtime channel such as WebSockets for phone↔TV sync).

The `.dc.html` files open directly in a browser (they load `support.js`). All styling is inline; lift values straight from the markup.

## Fidelity
**High-fidelity.** Final colors, type, spacing, copy and animations. Recreate pixel-accurately.

## Canvas sizes
- Phone: **390 × 844** artboards.
- TV: designed at **960 × 540**, which is 1920 × 1080 at 50%. Double every TV measurement for production.

## Screens

### Phone — Onboarding (`Arcade Flow v2` section 2a)
- **01 Insert token** — Top HUD row (padding 20px 24px, Silkscreen 14px): `1UP` #ff2e88 · venue name "Loveshack" #d8ccff · `Credits N` #7ef9d0. Logo 300px wide, 72px from top. Slot plate (`assets/slot-plate.svg`, 136px) right-aligned 52px in; caption "1 token · 1 singer" Silkscreen 11px #ff8a1e. Draggable token (`assets/token.svg`, 116px) bottom-left; drop on slot inserts (slot glows on hover-over). Prompt "Insert token" Silkscreen 24px #ffd600 blinking (1.1s steps(1)); helper "Drag the token into the slot" 15px #d8ccff.
- **01b Token rejected**, **01c Room full** — error states on the same shell.
- **02 Join as** — three paths: returning (sign in), new account, guest.
- **02b Forgot password**.
- **03 Character select** — theme tabs (Default / Halloween), 8 characters per theme, tap to pick.
- **03b How scoring works** — tutorial with glow-burst value animations (see Animations).

### Phone — Library & Queue (2b)
- **04 Library · songs**, **04b Search results**, **04c No results**, **04d Starred songs**, **06 Artists**. Header: logo 30px tall, padding 16px 20px. Tap a song to queue/unqueue; ★ stars a song.
- **07 Queue**, **07b Empty queue**, **07c My songs paused** (pause II), **07d You're up next** alert (character location art at 35% opacity over #0b0618).
- Bottom tab bar uses `assets/icons/{songs,queue,me,scores,admin}.svg`.

### Phone — Account & System (2b/2c)
- **08 My account**, **08b Tonight's scores**, **08c Leave room**, **09 Admin/Settings** (includes show join code).
- **90 Connection lost** (HUD dims `1UP` to #6e6488), **91 Loading**.

### TV — Player screen (2c)
- **10 Idle / join** — Left 46% dark gradient panel with join instructions/code; right side shows the crowd. Crowd: 40 people, 10 depth rows × 4, random picks from all 16 characters, no usernames, feet visible, front-row heads clipped at top. Rows further back are smaller.
- **11a On stage next**, **11b Video playing** — character on their own location background at singing size (see Characters).
- **14 Tonight's scores** leaderboard.

### Trivia (2c)
- TV: **12a Splash**, **12b Podiums**, **12c Answer reveal**, **12d Winner**. Round pips at top-left (padding 20px 28px).
- Phone: **12e0 Waiting**, **12e Question**, **12f Correct**, **12f2 Wrong**, **12f3 Time's up**, **12g Final (winner)**, **12g2 Final (not winner)**. HUD label "Trivia" #ffd600.

### Singer Battle (2d)
Color roles: **challenger red, opponent green (#7fe3a5), gold (#ffd166) = battle key**. Scoring: **win +1000, play +250**.
- Phone: **13a Pick opponent** (4px gold top bar, "BATTLE" Silkscreen 700 24px #ffd166 with 3px 3px 0 #7a4310 shadow, 3 step pips 18×6), **13b Challenge received** (green bar), **13e Singing now (challenger)**, **13e2 Singing now (opponent)**, **13h Vote** (everyone else), **13h2 Vote locked**, **13j Result (challenger win)**, **13j2 Loss** (grey #6e6488 bar), **13j3 Winner (watchers)**.
- TV: **13c Versus** (two locations split by diagonal clip-path 58%/42%), **13d Ready R1**, **13e Round 1**, **13f Ready R2**, **13g Round 2**, **13h Vote** (50/50 split), **13i Winner**.

## Characters
16 characters: `uploads/default/{belter,crooner,diva,heavyweight,hype-man,idol,outlaw,screamer}` and `uploads/halloween/{babs,brainz,chops,deb,frank,hex,mort,spot}`. Each folder has a `manifest.json`:
- Views: `views/front.png`, `back`, `profile`, `key`, `portrait-34`, `portrait-80`.
- `location.png` 2048×1152 — the character's personal stage background.
- Sprite sheets, 560×560 cells, 8 columns: `sing` 16f @ 8fps, `dance` 24f @ 12fps, `victory` 16f @ 8fps, `ko` 16f @ 8fps. `*-proof.gif` shows intended playback.
- Display sizes: **560px** on result/winner screens, **460px** on singing screens.
- Characters are the user's avatar everywhere (queue rows, scores, battle, trivia podiums).

## Interactions & Behavior
- Token: pointer drag (touch-action none); release over slot → inserted state; else springs back.
- All navigation in `Mobile Demo.dc.html` is wired; dead buttons (pause II, star ★, show join code) route to real screens.
- `TV Demo.dc.html` steps through 10 TV screens incl. both battle singers' full flow.
- Phone and TV are synchronized in production: queue order, now-singing, trivia question/timer, votes and scores are room-level state pushed to all clients.

## Animations (from `<helmet><style>` in Arcade Flow v2)
Signature effect: **glow burst, yellow → pink** — `text-shadow: 0 0 18px #ffd600, 0 0 44px #ff8a1e, 0 0 80px #ff2e88` at peak, scaling ~1.3–1.4 at 35%, settling to scale 1.
- `burst`, `valueburst`, `ptsburst`, `totalglow` — score/value reveals; settle to #ffd600 with `3px 3px 0 #ff2e88`.
- `beginslam` — "BEGIN" word scales 3 → 0.9 → 1.06 → 1, settles #ffd166 with `5px 5px 0 #7a4310`.
- `gameover` — word slams in center, holds, shrinks to top (scale .28).
- `winsin` — winner character drops in with drop-shadow glow.
- `logoout`, `timerin`, `shine` (skewed highlight sweep), `blink` (1.1s steps).
Word art: `uploads/word-begin.png`, `word-game-over.png`, `word-wins.png`, `logo-singer-battle.png`.

## State (suggested)
Room: `venue`, `joinCode`, `queue[]`, `nowSinging`, `mode` (idle | singing | trivia | battle | scores), `leaderboard[]`.
Player: `credits`, `account` (guest | user), `character {theme, id}`, `starred[]`, `paused`.
Trivia: `round`, `question`, `options`, `timer`, `answers{}`, `scores{}`.
Battle: `challenger`, `opponent`, `round (1|2)`, `songs`, `votes{}`, `winner`.
System: `connection` (ok | lost | loading).

## Design Tokens
Colors:
- Ground `#120a24`, deep `#0b0618`, surface `#1b1330`, surface-hover/inactive `#2a1f48`
- Text `#e9e2ff`, secondary `#d8ccff`, muted `#a08fd0`, disabled `#6e6488`
- Amber action `#ff8a1e`, yellow `#ffd600`, pale glow `#fff4b0`
- Magenta `#ff2e88`, mint `#7ef9d0`
- Battle gold `#ffd166` (shadow `#7a4310`), opponent green `#7fe3a5`
- Dark text on amber `#20130a`
Type:
- **Silkscreen** 400/700 — HUD, labels, headings (11, 13, 14, 18, 24, 28, 36px)
- **Chakra Petch** 400–700 — body (15–16px)
- Index page uses Space Grotesk for body.
Effects:
- CRT scanlines overlay on every screen: `repeating-linear-gradient(0deg, rgba(0,0,0,.3) 0 1px, transparent 1px 3px)`, pointer-events none.
- Pixel border: `box-shadow: 0 -4px 0 C, 0 4px 0 C, -4px 0 0 C, 4px 0 0 C` (square corners, no radius).
- Hard offset text shadows (3px 3px 0) instead of blurs, except during glow bursts.
- Radius: 0 throughout.
Spacing: screen padding 20–24px; section gaps 10–14px.

## Assets
- Logo: `logo/approved/karaokearcade-transparent.svg` (full) and `karaokearcade-mark-transparent.svg` (mark). Trimmed tight — add space around them. For charcoal, place on #232526; don't edit the art. The old flat vector logo is deprecated.
- `assets/`: slot-plate.svg, token.svg, logo.svg, mark.svg, icons/*.svg.
- `uploads/default`, `uploads/halloween`: character art (see Characters).

## Files
- `Arcade Flow v2.dc.html` — master design: every screen, organized by flow (2a Onboarding, 2b Library/Queue/Account, 2c TV + Trivia, 2d Singer Battle).
- `Mobile Demo.dc.html` — clickable phone prototype (10 screens).
- `TV Demo.dc.html` — TV prototype (10 screens).
- `Index.dc.html` — demo landing page.
- `support.js` — runtime needed to open the `.dc.html` files locally.
