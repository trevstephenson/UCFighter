# Reverse-engineering notes

Target: `UCFighter.exe`, 352,256 bytes, 21 Oct 2004, x86 PE,
SHA-256 `8ea56fd9021ee4320dd128bedbab08b2311442e4afe1a2f77f8fa73c7e5093cb`.
Built with MSVC (references `UCFighter.pdb`, not shipped). Analysed with Ghidra
12.1.4 through REA, plus `dumpbin /disasm` for vtable methods Ghidra had not
defined as functions. Addresses below are virtual addresses (image base
0x400000).

The game is built on a small course framework (`UC_err`, `UC_UtilsCreateFonts`,
"Unnamed level subtract 5 marks" at 0x4083f0). Game code lives in
0x401000–0x409380; everything after that is the CRT and statically linked D3DX.

## Engine

| What | Where | Detail |
|---|---|---|
| Window | 0x4046d0 | "UC FIGHTER", 648×507 window, class `SurfaceApp` |
| Device | 0x404500 | D3D8 windowed, back buffer 800×600 (0x320×0x258) |
| Timer | 0x404500 | `SetTimer(hwnd, 1, 20)`: 50 Hz tick |
| Loop | 0x4040b0, 0x403ec0 | WM_TIMER increments tick counter `DAT_00454f54` and calls app tick; the idle loop renders once per tick |
| Keys | 0x403ec0 | WM_KEYDOWN/UP write 1/0 into a 256-byte table at 0x454f60, indexed by virtual-key code; Esc posts quit |
| Textures | 0x404da0, 0x406b30 | `D3DXCreateTextureFromFileEx(..., A8R8G8B8, ColorKey 0xFF00FF00)`: pure green is transparent |
| Blit | 0x4055e0 | `(dev, tex, sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1, alphaBlend)`; reversed source coords mirror the image |
| Strip frame | 0x405870 | frame width = texture width / frame count; mirrors when the fighter faces left |
| Sound | 0x403a90, 0x403d10 | one DirectSound buffer per sound object; play rewinds to 0 |
| Music | 0x402370, 0x409020 | `FindFirstFile("data\music\*")` + DirectShow; random track per fight |

No texture filter state is ever set, so rendering uses D3D8's default point sampling.

## Screen states

App vtable 0x4460f8 (init 0x408160, render 0x408120, key 0x4080b0, tick
0x408140). The state switcher at 0x4077f0 calls exit/enter. Help and pause
just swap the current pointer (0x407890 / 0x407880), so the underlying state
freezes.

| Id | Vtable | Behaviour |
|---|---|---|
| 1 Intro | 0x446038 | plays intro.wav; intro.bmp at (100,20)-(612,532); N / numpad . → game; after 250 ticks → credits |
| 2 Credits | 0x446058 | credits.bmp, same rect; N → game; after 230 ticks → game |
| 3 Game | 0x446078 | owns the match object (vtable 0x4453bc); F1 → help |
| 4 Score | 0x446098 | yellow clear, "Ending Score %d"; unreachable |
| 5 Help | 0x4460b8 | help.bmp at 1:1 from (0,0); F1 returns |
| 8 Paused | 0x4460d8 | paused.bmp at (154,200)-(666,712) over the last frame, no clear; P / F1 returns |

App keydown 0x4080b0 forwards F1 to the current state and enters pause on P
from any state except help and paused.

## Texture table (0x407940)

| Slot | Image |
|---|---|
| 0 | intro |
| 1, 4 | credits |
| 2, 3 | left/right arrow |
| 5 | select background |
| 6 | UC logo |
| 7 | help |
| 8 | paused |
| 10, 11 | bar, bar back |
| 13 | FIGHT |
| 14–16 | Round 1–3 |
| 17 | Victory |
| 18, 19 | Player One / Two labels |
| 20–22 | backgrounds |
| 30 + n | Rob |
| 50 + n | Geoff |
| 70 + n | Trev |
| 82 | Trev's "eski" prop |
| 100 | preloading |

Per-character offset n: 0–3 Attack1–4, 4 Block, 5 Defeat, 6 Fatality, 7 Stance,
8 Victory, 9 Walk, 10 thumbnail2 (dim), 11 thumbnail1 (lit).

## Fighter (constructor 0x402570, 0xb4 bytes)

Notable fields: x/y float at 0x00/0x04, ground y 250 at 0x1c, gravity 4 at
0x20, facing-left byte at 0x08, busy/animation lock at 0x0b, blocking at 0x11,
attack ranges at 0x4c–0x5c, character id at 0xa0, velocities at 0xa4/0xa8/0xac,
airborne at 0xb0, 15 blood emitters from 0x64 (only 14 are updated and drawn).

Ranges `(attack1, attack2, attack3, attack4, fatality)` from 0x401720:

| Character | Id | Ranges |
|---|---|---|
| Rob | 30 | 50, 75, 100, 100, 500 |
| Geoff | 50 | 75, 75, 75, 100, 500 |
| Trev | 70 | 75, 75, 50, 100, 500 |

Animations: `frame++` when `tick % duration == 1`. Sequence tables are at
0x450044–0x4500b0.

| Action | Fn | Tex | Strip | Ticks/frame | Sequence |
|---|---|---|---|---|---|
| stance | 0x402930 | 7 | 4 | 3 | 0 1 2 3 2 1 |
| block | 0x402970 | 4 | 1 | 7 | 0 |
| victory | 0x4029b0 | 8 | 1 | 6 | 0 |
| defeat | 0x402a00 | 5 | 1 | 6 | 0 (also starts continuous bleeding) |
| attack n | 0x402aa0.. | n | 4 | 2 | 0 1 2 3 2 1 0 |
| fatality | 0x402c10 | 6 | 8 | 3 | 0–7, holds frame 7 |
| walk | 0x402c70 | 9 | 4 | 3 | 0 1 |
| hurt | 0x402cd0 | 7 | 4 | 10 | 0 0 (table in zeroed .data) |

Physics (0x402de0):

- **Jump** `(left, up, right)` (0x402a40) is allowed only when grounded or
  knocked, and does not check busy. While airborne: `y -= vy; vy -= 4;
  x += right - left`.
- **Walk** is an impulse of ±20 that decays by 4 per grounded tick (60 px per
  step).
- **Landing** keeps any rightward velocity as a slide.

Getting hit (0x402d80): fighters are always pushed back 20 px. If not
blocking, they also play the hurt sound and spawn blood, and if airborne they
are knocked into a (0, 30, 25) jump away from the attacker.

Blood (0x401000–0x401310): 20 particles start at (x+150, y+30) with
`vy = 10 - rand%5` and `vx = 15 - rand%5`, falling under gravity 3. Each
lingers 10 ticks on the floor at y=500 and is mirrored when the fighter
faces right.

## Round (0x401720 / update 0x401c10 / draw 0x401ad0)

Player Two (arrows/numpad) is stored first at +4 and starts at x=490. Player
One (WASD/TYUGH) is at +8 and starts at x=50. The camera scroll starts at
-200 and the background is randomly 20–22.

| Phase | Ticks | What happens |
|---|---|---|
| Intro | 0–69 | Round N banner and sound |
| Intro | 70–119 | FIGHT banner and sound, music starts |
| Fight | from 120 | input enabled |

Input per player: up + left/right jumps (15, 40) diagonally, otherwise
left/right walks ±20. Then attack 1–4, block, or stance, in that priority.

Hit test, per attacker A with `busy && attacking && !hitLanded`:

```
(D.x <= A.x + range && A.x <= D.x || A.x - range <= D.x && D.x <= A.x) && A.y - 30 <= D.y
```

An unblocked hit does 4 damage and sets `hitLanded`. The defender's
`takeHit()` runs whether or not they blocked.

Health (0x4014e0): `+0` is Player Two's damage (counts up), `+4` is Player
One's health (counts down). The round ends when damage > 100 or health < 0.

Scrolling: a fighter past x=600 or below x=0 is clamped, and the stage scrolls
(range -1200..0) while the other fighter slides by the same amount. Order:
P2 right edge, P1 right edge, P2 left edge, P1 left edge.

KO sequence (after the round is over):

| Timer | What happens |
|---|---|
| ≤ 150 | winner walks to 75 px from the loser |
| 151 | winner's fatality (500 range, so it always hits) and the loser's agony scream |
| 401 | "awesome death" sound, then victory/defeat poses |
| 601 | round finished, music stops |

The Victory banner shows from timer 51.

HUD (0x401510): bar back and bar fill both stretch the full 512×512 image.

| Element | Rect |
|---|---|
| Left bar | (80,-65)-(80 + 2.56·health, 191) |
| Right bar | mirrored, (450 + 2.56·damage, -65)-(706, 191) |
| Player labels | 128×32 at (80,20) and (580,20) |
| UC logo | (330,0) |

## Match flow (0x403790)

Select → round 1 → round 2. The match ends after round 2 if Player One's
tally is 2 or 0, otherwise after round 3, and then returns to select with
tallies reset.

## Character select (0x402f30 / 0x403400 / 0x4031f0)

| | Player Two | Player One |
|---|---|---|
| Move cursor | ←/→ | A/D |
| Confirm | numpad 1 (plays selected.wav) | T (plays selected.wav) |
| Arrow | left arrow, y 135 | right arrow, y 105 |
| Preview fighter | x=400, facing left | x=100, facing right |

- After a move the cursor locks for 11 ticks, then select.wav plays.
- Arrow x positions are 65, 265 and 465.
- Thumbnails are drawn at x = 130 / 330 / 530 (128×128). A thumbnail is lit
  if either cursor is on it.
