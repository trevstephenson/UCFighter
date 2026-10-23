# UC Fighter (browser rebuild)

A JavaScript rebuild of *UC Fighter* (October 2004), a two-player fighting game
originally written in C++ on Direct3D 8 / DirectSound 8 / DirectInput 8. The
source was lost; the game logic here was reconstructed by decompiling the
shipped `UCFighter.exe` (see [docs/reverse-engineering.md](docs/reverse-engineering.md)).

No build step or dependencies; only Node.js (for asset conversion and a local
web server) and a modern browser.

## Running

```sh
npm run convert   # reads C:\Program Files (x86)\UC Fighter\data -> ./assets
npm start         # http://localhost:8080/
```

`convert` takes an optional path if the game is installed elsewhere:
`node tools/convert-assets.mjs "D:\Games\UC Fighter\data"`.

The conversion turns the 24-bit BMPs into PNGs (about 150 MB down to 22 MB),
applies the original pure-green transparency key, lower-cases all file names,
and copies the WAVs as they are. To get fight music, drop audio files into
`data\music` before converting (or straight into `assets/music/` and list them
in `tracks.json`). The original help screen advertised this feature, but the
installer shipped the folder empty.

## Controls

| | Player One (left) | Player Two (right) |
|---|---|---|
| Jump | W | ↑ |
| Left / Right | A / D | ← / → |
| Attack 1–4 | T / Y / U / G | Numpad 1 / 2 / 3 / 0 (or J / K / L / I) |
| Block | H | Numpad . (or O) |
| Confirm on select screen | T | Numpad 1 (or J) |

N skips the intro and credits, F1 toggles help, P pauses, and Esc returns to the
title screen.

## Faithful to the original

Gameplay timing and rules are taken from the executable, not approximated:

- 50 Hz fixed tick, 800×600 screen, point-sampled scaling.
- Matches are best of 3. After a knockout the winner walks over and performs
  a fatality, followed by victory and defeat poses. The game then returns to
  character select; there is no match-winner screen.
- The original's quirks are kept as-is:
  - Hits land on either side of the attacker within its range.
  - A blocked attack connects again every tick, pushing the blocker back
    20 px each time.
  - You can jump out of an attack.
  - Fighters can walk through each other.

## Differences from the original

- **Click to start.** Browsers block audio until a user gesture, so the
  preloading screen waits for a click or key press.
- **Esc.** In the original, Esc quit to the desktop. Here it returns to the title screen.
- **No numpad?** J/K/L/I/O work as alternates for Player Two's numpad keys.
- **Quick taps.** A key pressed and released within a single 20 ms tick still
  registers. Held keys don't auto-repeat for one-shot actions like pause.
- **Unused content.** The executable contains an "Ending Score" screen
  that nothing ever reaches. It is not rebuilt, and neither are the unused
  `hit.wav`, `Miss.wav` and per-character `hurt1.wav` files.

## Layout

```
index.html            page shell, scales the 800x600 canvas to the window
src/main.js           boot, asset loading, 50 Hz loop
src/app.js            screen states: intro, credits, game, help, pause
src/game.js           match flow (select -> rounds -> select)
src/select.js         character select
src/fight.js          a round: input, hits, camera scroll, KO sequence, HUD
src/fighter.js        fighter animation/physics/actions
src/blood.js          blood particle emitters
src/gfx.js            D3D-style textured-quad blits on canvas 2D
src/audio.js          WebAudio sounds and optional music
src/input.js          virtual-key table polled each tick
tools/convert-assets.mjs, tools/serve.mjs
```
