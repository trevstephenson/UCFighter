// Global tick counter (DAT_00454f54). Incremented on every 20 ms WM_TIMER
// message, including while paused; sprite animations step on it.
export const TICK_MS = 20;
export const clock = { tick: 0 };

// rand() replacement; the original seeded the CRT rand() with time().
export function rand() {
  return Math.floor(Math.random() * 0x8000);
}
