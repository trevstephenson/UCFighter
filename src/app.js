import { blit, blitFull, clear } from './gfx.js';
import { textures } from './assets.js';
import { VK, keys } from './input.js';
import { Game } from './game.js';

const INTRO = 1;
const CREDITS = 2;
const GAME = 3;
const HELP = 5;
const PAUSED = 8;

// Screen states. Each mirrors one vtable in the original:
// { enter, exit, render, key(vk), tick }.

class IntroState {
  constructor(app) {
    this.app = app;
    this.music = app.audio.sound('intro');
  }

  enter() {
    this.music.play();
    this.counter = 0;
  }

  render() {
    clear('#000');
    blitFull(textures[0], 100, 20, 612, 532);
  }

  key(vk) {
    if (vk === VK.N || vk === VK.DECIMAL) this.app.changeState(GAME);
  }

  tick() {
    if (++this.counter > 250) this.app.changeState(CREDITS);
  }
}

class CreditsState {
  constructor(app) {
    this.app = app;
  }

  enter() {
    this.counter = 0;
  }

  render() {
    clear('#000');
    blitFull(textures[1], 100, 20, 612, 532);
  }

  key(vk) {
    if (vk === VK.N || vk === VK.DECIMAL) this.app.changeState(GAME);
  }

  tick() {
    if (++this.counter > 230) this.app.changeState(GAME);
  }
}

class GameState {
  constructor(app) {
    this.app = app;
  }

  enter() {
    this.game = new Game(this.app.audio);
  }

  exit() {
    this.game?.fight?.music.stop();
    this.game = null;
  }

  render() {
    this.game.render();
  }

  key(vk) {
    if (vk === VK.F1) this.app.showHelp();
  }

  tick() {
    this.game.tick(keys);
  }
}

class HelpState {
  constructor(app) {
    this.app = app;
  }

  render() {
    clear('#000');
    blit(textures[7], 0, 0, 1024, 1024, 0, 0, 1024, 1024);
  }

  key(vk) {
    if (vk === VK.F1) this.app.restoreState();
  }
}

class PausedState {
  constructor(app) {
    this.app = app;
  }

  // Drawn over whatever the previous state last rendered; no clear.
  render() {
    blit(textures[8], 0, 0, 512, 512, 154, 200, 666, 712);
  }

  key(vk) {
    if (vk === VK.P || vk === VK.F1) this.app.restoreState();
  }
}

// Application object (vtable 0x4460f8) and state switcher (0x4077f0).
export class App {
  constructor(audio) {
    this.audio = audio;
    this.states = {
      [INTRO]: new IntroState(this),
      [CREDITS]: new CreditsState(this),
      [GAME]: new GameState(this),
      [HELP]: new HelpState(this),
      [PAUSED]: new PausedState(this),
    };
    this.stateId = 0;
    this.prevId = 0;
  }

  get state() {
    return this.states[this.stateId];
  }

  start() {
    this.changeState(INTRO);
  }

  changeState(id) {
    if (id === this.stateId) return;
    this.state?.exit?.();
    this.prevId = this.stateId;
    this.stateId = id;
    this.state.enter?.();
  }

  // Help and pause are overlays: the underlying state is frozen, not exited.
  showHelp() {
    if (this.stateId === HELP || this.stateId === PAUSED) return;
    this.prevId = this.stateId;
    this.stateId = HELP;
  }

  pause() {
    if (this.stateId === HELP || this.stateId === PAUSED) return;
    this.prevId = this.stateId;
    this.stateId = PAUSED;
  }

  restoreState() {
    this.stateId = this.prevId;
  }

  // 0x4080b0
  key(vk) {
    if (vk === VK.ESCAPE) {
      // The original quit to the desktop; here we return to the title.
      this.states[GAME].exit();
      this.stateId = 0;
      this.changeState(INTRO);
    } else if (vk === VK.P && this.stateId !== PAUSED) {
      this.pause();
    } else {
      this.state.key?.(vk);
    }
  }

  tick() {
    this.state.tick?.();
  }

  render() {
    this.state.render();
  }
}
