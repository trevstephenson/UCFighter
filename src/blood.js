import { blit } from './gfx.js';
import { bloodTexture } from './assets.js';
import { rand } from './clock.js';

const PARTICLES = 20;

// Blood spray emitter (constructor 0x401000, 0x21c bytes). Particles are
// simulated in an un-mirrored space starting 150px right of the fighter's
// origin and are mirrored at draw time when the fighter faces right.
export class BloodEmitter {
  constructor() {
    this.floor = 0;
    this.gravity = 3;
    this.baseX = 0;
    this.active = false;
    this.facingLeft = false;
    this.particles = Array.from({ length: PARTICLES }, () => ({
      x: 0, y: 0, vy: 0, vx: 0, alive: false, life: 0,
    }));
  }

  // 0x401090
  start(x, y, floor, facingLeft) {
    this.facingLeft = facingLeft;
    for (const p of this.particles) {
      p.x = x + 150;
      p.y = y + 30;
      p.vy = 10 - (rand() % 5);
      p.life = 10;
      p.alive = true;
      p.vx = 15 - (rand() % 5);
    }
    this.floor = floor;
    this.baseX = x;
    this.active = true;
  }

  // 0x401310: true when the emitter can be reused.
  isFree() {
    let free = true;
    if (this.active) {
      for (const p of this.particles) if (p.alive) free = false;
      this.active = !free;
    }
    return free;
  }

  // 0x401280: particles fly until they hit the floor, then linger 10 ticks.
  update() {
    for (const p of this.particles) {
      if (p.y - p.vy < this.floor) {
        p.y -= p.vy;
        p.vy -= this.gravity;
        p.x += p.vx;
      } else {
        p.y = this.floor;
        if (p.life > 0) p.life--;
        else p.alive = false;
      }
    }
  }

  // 0x401150
  draw() {
    for (const p of this.particles) {
      if (!p.alive) continue;
      const x = this.facingLeft ? p.x : this.baseX * 2 + 250 - p.x;
      blit(bloodTexture, 0, 0, 16, 16, x, p.y, x + 16, p.y + 16);
    }
  }
}
