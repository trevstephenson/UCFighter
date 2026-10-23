import { blit } from './gfx.js';
import { textures } from './assets.js';
import { VK } from './input.js';
import { Fighter, ROB, GEOFF, TREV } from './fighter.js';

const CHARACTERS = [ROB, GEOFF, TREV];
const ARROW_X = [65, 265, 465];
const THUMB_X = [130, 330, 530];
const TEX_SELECT_BG = 5;
const TEX_LEFT_ARROW = 2;
const TEX_RIGHT_ARROW = 3;
const OFFSCREEN = 1000;

// Per-player cursor state.
class Cursor {
  constructor() {
    this.index = 0;
    this.moving = false;
    this.moveTimer = 0;
    this.confirmed = false;
    this.arrowX = 0;
  }
}

// Character select screen (constructor 0x402f30, update 0x403400,
// draw 0x4031f0). Player Two's cursor is stored and processed first.
export class SelectScreen {
  constructor(audio) {
    this.done = false;
    this.p2 = new Cursor(); // 0x18: arrows, numpad 1 confirms
    this.p1 = new Cursor(); // 0x1c: A/D, T confirms
    this.highlight = [false, false, false];
    // Player Two's previews stand on the right facing left; Player One's on
    // the left facing right. Unselected previews are parked off screen.
    this.p2Previews = CHARACTERS.map((c) => new Fighter(audio, c, [10, 10, 10, 10, 10]));
    this.p1Previews = CHARACTERS.map((c) => new Fighter(audio, c, [10, 10, 10, 10, 10]));
    for (const f of this.allPreviews()) f.stance();
    for (const f of this.p1Previews) f.facingLeft = false;
    this.selectSound = audio.sound('select');
    this.selectedSound = audio.sound('selected');
  }

  allPreviews() {
    return [...this.p2Previews, ...this.p1Previews];
  }

  get p1Char() {
    return CHARACTERS[this.p1.index];
  }

  get p2Char() {
    return CHARACTERS[this.p2.index];
  }

  moveCursor(c, keys, left, right, confirm) {
    if (!c.moving && !c.confirmed) {
      if (keys[right]) {
        c.index++;
        c.moving = true;
      } else if (keys[left]) {
        c.index--;
        c.moving = true;
      } else if (keys[confirm]) {
        c.confirmed = true;
        this.selectedSound.play();
      }
      if (c.index === 3) c.index = 0;
      if (c.index === -1) c.index = 2;
    }
    c.arrowX = ARROW_X[c.index];
    // After a move the cursor locks for ~10 ticks, then plays the tick sound.
    if (c.moving) {
      if (c.moveTimer > 10) {
        c.moveTimer = 0;
        c.moving = false;
        this.selectSound.play();
      }
      c.moveTimer++;
    }
  }

  update(keys) {
    this.moveCursor(this.p2, keys, VK.LEFT, VK.RIGHT, VK.NUMPAD1);
    this.moveCursor(this.p1, keys, VK.A, VK.D, VK.T);

    for (let i = 0; i < 3; i++) this.highlight[i] = this.p1.index === i || this.p2.index === i;

    for (const f of this.allPreviews()) f.x = OFFSCREEN;
    this.p2Previews[this.p2.index].x = 400;
    this.p1Previews[this.p1.index].x = 100;

    if (this.p1.confirmed && this.p2.confirmed) this.done = true;

    for (const f of this.allPreviews()) f.update();
  }

  draw() {
    blit(textures[TEX_SELECT_BG], 0, 0, 1024, 1024, 0, 0, 1024, 1024);
    CHARACTERS.forEach((c, i) => {
      // Slot +10 is thumbnail2 (dim), +11 is thumbnail1 (highlighted).
      const thumb = textures[c + 10 + (this.highlight[i] ? 1 : 0)];
      blit(thumb, 0, 0, 256, 256, THUMB_X[i], 120, THUMB_X[i] + 128, 248);
    });
    // The background has "P1"/"P2" labels beside these two rows.
    const a2 = this.p2.arrowX;
    const a1 = this.p1.arrowX;
    blit(textures[TEX_LEFT_ARROW], 0, 0, 64, 64, a2, 135, a2 + 64, 199);
    blit(textures[TEX_RIGHT_ARROW], 0, 0, 64, 64, a1, 105, a1 + 64, 169);
    for (const f of this.allPreviews()) f.draw();
  }
}
