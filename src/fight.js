import { blit, blitFull } from './gfx.js';
import { textures, musicTracks } from './assets.js';
import { rand } from './clock.js';
import { MusicPlayer } from './audio.js';
import { VK } from './input.js';
import { Fighter, CHARACTER_RANGES } from './fighter.js';

const TEX_BAR = 10;
const TEX_BARBACK = 11;
const TEX_FIGHT = 13; // round N banner is TEX_FIGHT + N
const TEX_VICTORY = 17;
const TEX_PLAYER1 = 18;
const TEX_PLAYER2 = 19;
const TEX_UCLOGO = 6;
const TEX_BACKGROUND = 20;

const SCREEN_EDGE = 600;
const MIN_SCROLL = -1200;

// Player One (help screen: W/A/D, T/Y/U/G, H) starts on the left; Player Two
// (arrows, numpad 1/2/3/0, numpad .) starts on the right. Internally the
// original stored Player Two first (fight+4) and always processes it first,
// so the order of the paired calls below is deliberate.
const P1_KEYS = { up: VK.W, left: VK.A, right: VK.D, attacks: [VK.T, VK.Y, VK.U, VK.G], block: VK.H };
const P2_KEYS = {
  up: VK.UP, left: VK.LEFT, right: VK.RIGHT,
  attacks: [VK.NUMPAD1, VK.NUMPAD2, VK.NUMPAD3, VK.NUMPAD0], block: VK.DECIMAL,
};

// Health bars (0x4014e0 / 0x401510). The two halves are stored differently:
// Player Two's damage counts up from 0, Player One's health counts down.
class Health {
  constructor() {
    this.p2Damage = 0;
    this.p1Health = 100;
  }

  draw() {
    blit(textures[TEX_BARBACK], 0, 0, 512, 512, 80, -65, 336, 191);
    blit(textures[TEX_BAR], 0, 0, 512, 512, 80, -65, this.p1Health * 2.56 + 80, 191);
    blit(textures[TEX_BARBACK], 512, 0, 0, 512, 450, -65, 706, 191);
    blit(textures[TEX_BAR], 512, 0, 0, 512, this.p2Damage * 2.56 + 450, -65, 706, 191);
    blit(textures[TEX_PLAYER1], 0, 0, 128, 32, 80, 20, 208, 52);
    blit(textures[TEX_PLAYER2], 0, 0, 128, 32, 580, 20, 708, 52);
    blit(textures[TEX_UCLOGO], 0, 0, 128, 128, 330, 0, 458, 128);
  }
}

// One round (constructor 0x401720, update 0x401c10, draw 0x401ad0).
export class Fight {
  constructor(audio, round, p1Char, p2Char) {
    this.intro = true; // 0x30
    this.timer = 0; // 0x34
    this.p2 = new Fighter(audio, p2Char, CHARACTER_RANGES[p2Char]); // 0x04
    this.p1 = new Fighter(audio, p1Char, CHARACTER_RANGES[p1Char]); // 0x08
    this.p1.x = 50;
    this.p2.x = 490;
    this.roundSounds = [null, audio.sound('round1'), audio.sound('round2'), audio.sound('round3')];
    this.fightSound = audio.sound('fight');
    this.deathSound = audio.sound('awesomeDeath');
    this.scroll = -200; // 0x24
    this.health = new Health();
    this.round = round; // 0x38
    this.done = false; // 0x00: someone has been knocked out
    this.p2Won = false; // 0x01
    this.finished = false; // 0x02: end-of-round sequence complete
    this.over = false; // 0x31
    this.fatalityStarted = false; // 0x3c
    this.roundAnnounced = false; // 0x3d
    this.fightAnnounced = false; // 0x3e
    this.deathPlayed = false; // 0x3f
    this.music = new MusicPlayer(musicTracks);
    this.background = TEX_BACKGROUND + (rand() % 3);
  }

  // 0x402350
  endRound() {
    if (this.over) return;
    this.over = true;
    this.timer = 0;
  }

  update(keys) {
    const { p1, p2 } = this;

    if (!this.over) {
      if (this.intro) {
        p2.stance();
        p1.stance();
        if (this.timer < 70) {
          if (!this.roundAnnounced) this.roundSounds[this.round].play();
          this.roundAnnounced = true;
        } else if (this.timer < 120) {
          if (!this.fightAnnounced) {
            this.fightSound.play();
            this.music.playRandom();
          }
          this.fightAnnounced = true;
        } else if (this.timer < 150) {
          this.intro = false;
        }
        this.timer++;
      } else {
        this.handleInput(p2, keys, P2_KEYS);
        this.handleInput(p1, keys, P1_KEYS);
      }
    } else {
      this.updateRoundOver();
    }

    p2.update();
    p1.update();

    if (p2.x <= p1.x) {
      p2.facingLeft = false;
      p1.facingLeft = true;
    } else {
      p2.facingLeft = true;
      p1.facingLeft = false;
    }

    if (this.checkHit(p2, p1)) this.health.p1Health -= 4;
    if (this.checkHit(p1, p2)) this.health.p2Damage += 4;

    this.scrollRight(p2, p1);
    this.scrollRight(p1, p2);
    this.scrollLeft(p2, p1);
    this.scrollLeft(p1, p2);
    if (this.scroll > 0) this.scroll = 0;
    if (this.scroll < MIN_SCROLL) this.scroll = MIN_SCROLL;

    const h = this.health;
    if (h.p2Damage > 100 || h.p1Health < 0) {
      if (h.p1Health < 0) this.p2Won = true;
      this.done = true;
    }
  }

  handleInput(f, keys, { up, left, right, attacks, block }) {
    if (!keys[up]) {
      if (keys[right]) f.walk(20);
      else if (keys[left]) f.walk(-20);
    } else if (keys[left]) {
      f.jump(15, 40, 0);
    } else if (keys[right]) {
      f.jump(0, 40, 15);
    } else {
      f.jump(0, 40, 0);
    }

    const n = attacks.findIndex((k) => keys[k]);
    if (n >= 0) f.attack(n);
    else if (keys[block]) f.block();
    else f.stance();
  }

  updateRoundOver() {
    const { p1, p2 } = this;
    const winner = this.p2Won ? p2 : p1;
    const loser = this.p2Won ? p1 : p2;

    this.timer++;
    if (this.timer > 600) {
      this.finished = true;
      this.music.stop();
    } else if (this.timer > 400) {
      if (!this.deathPlayed) {
        this.deathSound.play();
        this.deathPlayed = true;
      }
      winner.victory();
      loser.defeat();
    } else if (this.timer > 150) {
      if (!this.fatalityStarted) {
        this.fatalityStarted = true;
        winner.fatality();
        loser.agonySound.play();
      }
      if (p2.fatalityDone) p1.defeat();
      if (p1.fatalityDone) p2.defeat();
    } else {
      // The winner walks up to the loser and stops 75px away.
      if (loser.x < winner.x - 75 || winner.x + 75 < loser.x) winner.walk(winner.facingLeft ? -15 : 15);
      else winner.stance();
      if (!winner.facingLeft) {
        if (loser.x < winner.x + 70) winner.x = loser.x - 75;
      } else if (winner.x - 70 < loser.x) {
        winner.x = loser.x + 75;
      }
      loser.stance();
    }
  }

  // Hits land anywhere within range on either side; there is no facing
  // check. A blocked hit doesn't set hitLanded, so it keeps connecting (and
  // pushing the blocker back 20px) every tick for the rest of the attack.
  checkHit(a, d) {
    if (!a.busy || !a.attacking || a.hitLanded) return false;
    const inFront = d.x <= a.x + a.range && a.x <= d.x;
    const behind = a.x - a.range <= d.x && d.x <= a.x;
    if (!((inFront || behind) && a.y - 30 <= d.y)) return false;
    const damaged = !d.blocking;
    if (damaged) a.hitLanded = true;
    d.takeHit();
    return damaged;
  }

  // Pushing against the screen edge scrolls the stage and slides the
  // opponent the other way (0x402140-0x402320).
  scrollRight(f, other) {
    if (f.x > SCREEN_EDGE) {
      if (other.x > 0) {
        this.scroll = Math.trunc(this.scroll - (f.x - SCREEN_EDGE));
        if (this.scroll > MIN_SCROLL) other.x -= f.x - SCREEN_EDGE;
      }
      f.x = SCREEN_EDGE;
    }
  }

  scrollLeft(f, other) {
    if (f.x < 0) {
      if (other.x < SCREEN_EDGE) {
        this.scroll = Math.trunc(this.scroll - f.x);
        if (this.scroll < 0) other.x += -f.x;
      }
      f.x = 0;
    }
  }

  draw() {
    blitFull(textures[this.background], this.scroll, 0, this.scroll + 2048, 800);
    this.p2.draw();
    this.p1.draw();
    this.health.draw();
    if (this.intro) {
      const banner = this.timer < 70 ? TEX_FIGHT + this.round : TEX_FIGHT;
      blit(textures[banner], 0, 0, 512, 512, 170, 100, 682, 612);
    }
    if (this.over && this.timer > 50) {
      blit(textures[TEX_VICTORY], 0, 0, 512, 512, 170, 100, 682, 612);
    }
  }
}
