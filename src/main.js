import { initGfx, clear, blitFull, text, WIDTH } from './gfx.js';
import { textures, loadPreloadingScreen, loadAll } from './assets.js';
import { Audio } from './audio.js';
import { attachInput, endTick } from './input.js';
import { clock, TICK_MS } from './clock.js';
import { App } from './app.js';

const canvas = document.getElementById('screen');
const ctx = initGfx(canvas);
const audio = new Audio();

function drawPreloading(message) {
  clear('#000');
  blitFull(textures[100], 100, 20, 612, 532);
  text(message, WIDTH / 2, 570, { size: 20 });
}

// Browsers only allow audio after a user gesture, so (unlike the original)
// the game waits for a click or key press once loading finishes.
function waitForStart() {
  return new Promise((resolve) => {
    const go = () => {
      window.removeEventListener('keydown', go);
      canvas.removeEventListener('pointerdown', go);
      resolve();
    };
    window.addEventListener('keydown', go);
    canvas.addEventListener('pointerdown', go);
  });
}

// 50 Hz fixed tick like the original SetTimer(20 ms); one render per tick.
function run(app) {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(now - last, 250);
    last = now;
    let ticked = false;
    while (acc >= TICK_MS) {
      acc -= TICK_MS;
      clock.tick++;
      app.tick();
      endTick();
      ticked = true;
    }
    if (ticked) app.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function main() {
  clear('#000');
  await loadPreloadingScreen();
  drawPreloading('Loading...');
  await loadAll(audio, (p) => drawPreloading(`Loading... ${Math.round(p * 100)}%`));
  drawPreloading('Click or press any key to start');
  await waitForStart();
  // Don't await: sounds started while resuming are simply queued, and input
  // must be live immediately.
  audio.resume();

  const app = new App(audio);
  attachInput(window, (vk) => app.key(vk));
  app.start();
  run(app);
}

main().catch((err) => {
  console.error(err);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  text(`Failed to start: ${err.message}`, WIDTH / 2, 300, { color: '#f66', size: 18 });
  text('Run "npm run convert" and serve this folder over HTTP.', WIDTH / 2, 330, { color: '#ccc', size: 16 });
});
