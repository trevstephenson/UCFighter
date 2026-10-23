// The original kept a 256-entry key-down table indexed by Windows virtual-key
// code (WM_KEYDOWN sets 1, WM_KEYUP sets 0) and the game polled it each tick.

export const VK = {
  LEFT: 0x25, UP: 0x26, RIGHT: 0x27,
  NUMPAD0: 0x60, NUMPAD1: 0x61, NUMPAD2: 0x62, NUMPAD3: 0x63, DECIMAL: 0x6e,
  A: 0x41, D: 0x44, G: 0x47, H: 0x48, N: 0x4e, P: 0x50, T: 0x54, U: 0x55, W: 0x57, Y: 0x59,
  F1: 0x70, ESCAPE: 0x1b,
};

const CODE_TO_VK = {
  ArrowLeft: VK.LEFT, ArrowUp: VK.UP, ArrowRight: VK.RIGHT,
  Numpad0: VK.NUMPAD0, Numpad1: VK.NUMPAD1, Numpad2: VK.NUMPAD2, Numpad3: VK.NUMPAD3,
  NumpadDecimal: VK.DECIMAL,
  KeyA: VK.A, KeyD: VK.D, KeyG: VK.G, KeyH: VK.H, KeyN: VK.N, KeyP: VK.P,
  KeyT: VK.T, KeyU: VK.U, KeyW: VK.W, KeyY: VK.Y,
  F1: VK.F1, Escape: VK.ESCAPE,
  // Not in the original: alternates for keyboards without a numeric keypad.
  KeyJ: VK.NUMPAD1, KeyK: VK.NUMPAD2, KeyL: VK.NUMPAD3, KeyI: VK.NUMPAD0, KeyO: VK.DECIMAL,
};

export const keys = new Uint8Array(256);

// Not in the original: a key released before any tick has polled it stays
// down until the end of the next tick, so very quick taps aren't lost.
const unseen = new Set();
const pendingRelease = new Set();

export function endTick() {
  unseen.clear();
  for (const vk of pendingRelease) keys[vk] = 0;
  pendingRelease.clear();
}

export function attachInput(target, onKeyDown) {
  target.addEventListener('keydown', (e) => {
    const vk = CODE_TO_VK[e.code];
    if (vk === undefined) return;
    e.preventDefault();
    if (!keys[vk]) unseen.add(vk);
    keys[vk] = 1;
    pendingRelease.delete(vk);
    if (!e.repeat) onKeyDown(vk);
  });
  target.addEventListener('keyup', (e) => {
    const vk = CODE_TO_VK[e.code];
    if (vk === undefined) return;
    e.preventDefault();
    if (unseen.has(vk)) pendingRelease.add(vk);
    else keys[vk] = 0;
  });
  target.addEventListener('blur', () => {
    keys.fill(0);
    unseen.clear();
    pendingRelease.clear();
  });
}
