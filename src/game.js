import { clear } from './gfx.js';
import { SelectScreen } from './select.js';
import { Fight } from './fight.js';

const SELECTING = 1;
const FIGHTING = 2;

// Match controller (vtable 0x4453bc: enter 0x403670, render 0x4036e0,
// tick 0x403790). Best of three; after the match it returns to select.
export class Game {
  constructor(audio) {
    this.audio = audio;
    this.select = new SelectScreen(audio);
    this.fight = null;
    this.state = SELECTING;
    this.round = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
  }

  newFight() {
    this.fight = new Fight(this.audio, this.round, this.select.p1Char, this.select.p2Char);
  }

  backToSelect() {
    this.state = SELECTING;
    this.select = new SelectScreen(this.audio);
    this.round = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
  }

  tick(keys) {
    if (this.state === SELECTING) {
      this.select.update(keys);
      if (this.select.done) {
        this.newFight();
        this.state = FIGHTING;
      }
      return;
    }

    const fight = this.fight;
    fight.update(keys);
    if (!fight.done) return;
    fight.endRound();
    if (!fight.finished) return;

    if (fight.p2Won) this.p2Wins++;
    else this.p1Wins++;

    // The original only checks Player One's tally after round 2: 2 means
    // they won both, 0 means Player Two did.
    const matchOver = this.round === 3 || (this.round === 2 && (this.p1Wins === 2 || this.p1Wins === 0));
    if (matchOver) {
      this.backToSelect();
    } else {
      this.round++;
      this.newFight();
    }
  }

  render() {
    clear('#000');
    if (this.state === SELECTING) this.select.draw();
    else this.fight.draw();
  }
}
