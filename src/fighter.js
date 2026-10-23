import { blitFrame, blitFull } from './gfx.js';
import { textures } from './assets.js';
import { clock } from './clock.js';
import { BloodEmitter } from './blood.js';

export const ROB = 30;
export const GEOFF = 50;
export const TREV = 70;

// Offsets from a character's base texture slot.
const TEX = {
  ATTACK1: 0, ATTACK2: 1, ATTACK3: 2, ATTACK4: 3, BLOCK: 4, DEFEAT: 5,
  FATALITY: 6, STANCE: 7, VICTORY: 8, WALK: 9,
};
const ESKI_TEXTURE = 82;

// Frame sequences from .data (0x450044..0x4500b0). The hurt and single-frame
// pose tables point at zero-initialised memory, so they always show frame 0.
const SEQ_ATTACK = [0, 1, 2, 3, 2, 1, 0];
const SEQ_STANCE = [0, 1, 2, 3, 2, 1];
const SEQ_WALK = [0, 1];
const SEQ_FATALITY = [0, 1, 2, 3, 4, 5, 6, 7];
const SEQ_HURT = [0, 0];
const SEQ_POSE = [0];

// Attack ranges passed to the fighter constructor (0x401720):
// attack 1-4, then the fatality reach.
export const CHARACTER_RANGES = {
  [ROB]: [50, 75, 100, 100, 500],
  [GEOFF]: [75, 75, 75, 100, 500],
  [TREV]: [75, 75, 50, 100, 500],
};

const EMITTERS = 15;
const DRAWN_EMITTERS = 14; // the original only updates/draws 14 of its 15

// Fighter (constructor 0x402570, 0xb4 bytes). Field names follow the struct
// offsets noted alongside each one.
export class Fighter {
  constructor(audio, charId, ranges) {
    this.charId = charId; // 0xa0
    this.ranges = ranges; // 0x4c..0x5c
    this.x = 50; // 0x00
    this.y = 250; // 0x04
    this.groundY = 250; // 0x1c
    this.gravity = 4; // 0x20
    this.facingLeft = true; // 0x08
    this.attacking = false; // 0x09
    this.hitLanded = false; // 0x0a
    this.busy = false; // 0x0b: animation lock
    this.range = 0; // 0x0c
    this.wasHit = false; // 0x10
    this.blocking = false; // 0x11
    this.fatalityDone = false; // 0x12
    this.frame = 0; // 0x24
    this.seq = SEQ_STANCE; // 0x28/0x2c
    this.stripFrames = 4; // 0x30
    this.animTex = TEX.STANCE; // 0x38
    this.frameDuration = 3; // 0x3c
    this.vxLeft = 0; // 0xa4: subtracted from x while airborne; walk-left impulse when negative
    this.vy = 0; // 0xa8
    this.vxRight = 0; // 0xac
    this.airborne = false; // 0xb0
    this.knocked = false; // 0xb1: hit in mid-air, allowed to "jump" again
    this.fatalityActive = false; // 0xb2
    this.bleeding = false; // 0xb3
    this.hurtSound = audio.sound('hurt'); // 0x40
    this.exertSound = audio.sound('exert'); // 0x44
    this.agonySound = audio.sound('agony'); // 0x14
    this.emitters = Array.from({ length: EMITTERS }, () => new BloodEmitter());
  }

  setAnim(tex, seq, stripFrames, frameDuration) {
    this.animTex = tex;
    this.seq = seq;
    this.stripFrames = stripFrames;
    this.frameDuration = frameDuration;
  }

  // 0x402930
  stance() {
    if (this.busy) return;
    this.attacking = false;
    this.blocking = false;
    this.setAnim(TEX.STANCE, SEQ_STANCE, 4, 3);
  }

  // 0x402970
  block() {
    this.blocking = true;
    if (this.busy) return;
    this.busy = true;
    this.frame = 0;
    this.attacking = false;
    this.setAnim(TEX.BLOCK, SEQ_POSE, 1, 7);
  }

  // 0x4029b0
  victory() {
    if (this.busy) return;
    this.frame = 0;
    this.busy = true;
    this.fatalityActive = false;
    this.blocking = false;
    this.attacking = false;
    this.hitLanded = false;
    this.setAnim(TEX.VICTORY, SEQ_POSE, 1, 6);
  }

  // 0x402a00
  defeat() {
    this.bleeding = true;
    this.frame = 0;
    this.busy = true;
    this.blocking = false;
    this.attacking = false;
    this.hitLanded = false;
    this.setAnim(TEX.DEFEAT, SEQ_POSE, 1, 6);
  }

  // 0x402a40: does not check busy, so you can jump out of an attack.
  jump(left, up, right) {
    if (this.y !== this.groundY && !this.knocked) return;
    this.exertSound.play();
    this.knocked = false;
    this.airborne = true;
    this.vxLeft = left;
    this.vy = up;
    this.vxRight = right;
  }

  // 0x402aa0 / 0x402af0 / 0x402b50 / 0x402bb0
  attack(n) {
    if (this.busy) return;
    this.exertSound.play();
    this.busy = true;
    this.attacking = true;
    this.frame = 0;
    this.blocking = false;
    this.hitLanded = false;
    this.range = this.ranges[n];
    this.setAnim(TEX.ATTACK1 + n, SEQ_ATTACK, 4, 2);
  }

  // 0x402c10
  fatality() {
    if (this.busy) return;
    this.exertSound.play();
    this.fatalityActive = true;
    this.busy = true;
    this.attacking = true;
    this.frame = 0;
    this.hitLanded = false;
    this.blocking = false;
    this.range = this.ranges[4];
    this.setAnim(TEX.FATALITY, SEQ_FATALITY, 8, 3);
  }

  // 0x402c70: a walk is an impulse that decays by gravity each grounded tick
  // (20+16+12+8+4 = 60px per step).
  walk(dx) {
    if (this.busy || this.airborne) return;
    this.frame = 0;
    this.busy = true;
    this.blocking = false;
    this.attacking = false;
    this.hitLanded = false;
    this.setAnim(TEX.WALK, SEQ_WALK, 4, 3);
    if (dx > 0) this.vxRight = dx;
    else this.vxLeft = dx;
  }

  // 0x402cd0: the 20px knockback applies even when blocking.
  hurt() {
    if (!this.blocking) {
      this.busy = true;
      this.frame = 0;
      this.attacking = false;
      this.setAnim(TEX.STANCE, SEQ_HURT, 4, 10);
    }
    this.x += this.facingLeft ? 20 : -20;
  }

  // 0x402d80
  takeHit() {
    this.hurt();
    if (this.blocking) return;
    this.wasHit = true;
    this.hurtSound.play();
    this.spawnBlood();
    if (this.y < this.groundY) {
      this.knocked = true;
      if (this.facingLeft) this.jump(0, 30, 25);
      else this.jump(25, 30, 0);
    }
  }

  // 0x402d30
  spawnBlood() {
    const emitter = this.emitters.find((e) => e.isFree());
    emitter?.start(Math.trunc(this.x), Math.trunc(this.y), 500, this.facingLeft);
  }

  // 0x402de0
  update() {
    if (clock.tick % this.frameDuration === 1) this.frame++;
    if (this.frame >= this.seq.length) {
      if (this.fatalityActive) {
        this.frame = 7; // hold the last fatality frame
        this.busy = false;
        this.fatalityDone = true;
      }
      if (this.frame >= this.seq.length && !this.fatalityActive) {
        this.busy = false;
        this.frame = 0;
      }
    }

    if (this.airborne) {
      const vy = this.vy;
      this.vy -= this.gravity;
      this.y -= vy;
      this.x = this.x - this.vxLeft + this.vxRight;
    }
    if (this.y > this.groundY) this.y = this.groundY;
    const grounded = this.y === this.groundY;
    if (grounded) this.airborne = false;
    if (this.vxRight > 0 && grounded) {
      const v = this.vxRight;
      this.vxRight -= this.gravity;
      this.x += v;
    }
    if (this.vxLeft < 0 && grounded) {
      const v = this.vxLeft;
      this.vxLeft += this.gravity;
      this.x += v;
    }

    for (let i = 0; i < DRAWN_EMITTERS; i++) this.emitters[i].update();
    if (this.bleeding) this.spawnBlood();
  }

  // 0x4027e0
  draw() {
    for (let i = 0; i < DRAWN_EMITTERS; i++) this.emitters[i].draw();
    const tex = textures[this.charId + this.animTex];
    const frame = this.seq[this.frame] ?? 0;
    blitFrame(tex, frame, this.stripFrames, this.x, this.y, this.x + 256, this.y + 256, this.facingLeft);

    // Trev's fatality overlays an extra prop sprite.
    if (this.fatalityActive && this.charId === TREV) {
      const eski = textures[ESKI_TEXTURE];
      if (this.facingLeft) blitFull(eski, this.x + 128, this.y + 236, this.x + 256, this.y + 300);
      else blitFull(eski, this.x + 44, this.y + 236, this.x + 172, this.y + 300);
    }
  }
}
