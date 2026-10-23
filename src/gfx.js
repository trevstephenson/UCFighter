// Drawing helpers matching the original UC_* texture blitters.
// All of them map a source rectangle onto a destination quad; a source
// rectangle given "backwards" (x1 < x0) mirrors the image, which is how the
// game flipped sprites and the right-hand health bar.

export const WIDTH = 800;
export const HEIGHT = 600;

let ctx = null;

export function initGfx(canvas) {
  ctx = canvas.getContext('2d');
  // D3D8 defaults to point sampling and the game never changed it.
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function clear(color = '#000') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

// 0x4055e0: draw(tex, srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1)
export function blit(img, sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1) {
  if (!img) return;
  const flipX = (sx1 < sx0) !== (dx1 < dx0);
  const flipY = (sy1 < sy0) !== (dy1 < dy0);
  const sw = Math.abs(sx1 - sx0);
  const sh = Math.abs(sy1 - sy0);
  const dw = Math.abs(dx1 - dx0);
  const dh = Math.abs(dy1 - dy0);
  if (sw === 0 || sh === 0 || dw === 0 || dh === 0) return;
  ctx.save();
  ctx.translate(flipX ? Math.max(dx0, dx1) : Math.min(dx0, dx1), flipY ? Math.max(dy0, dy1) : Math.min(dy0, dy1));
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(img, Math.min(sx0, sx1), Math.min(sy0, sy1), sw, sh, 0, 0, dw, dh);
  ctx.restore();
}

// 0x406530 / 0x406560: whole texture stretched into a rectangle.
export function blitFull(img, x0, y0, x1, y1) {
  if (!img) return;
  blit(img, 0, 0, img.width, img.height, x0, y0, x1, y1);
}

// 0x405870: one frame of a horizontal sprite strip, optionally mirrored.
export function blitFrame(img, frame, frameCount, x0, y0, x1, y1, flip) {
  if (!img) return;
  const fw = img.width / frameCount;
  const a = frame * fw;
  const b = a + fw;
  if (flip) blit(img, b, 0, a, img.height, x0, y0, x1, y1);
  else blit(img, a, 0, b, img.height, x0, y0, x1, y1);
}

export function text(str, x, y, { color = '#fff', size = 22, align = 'center' } = {}) {
  ctx.fillStyle = color;
  ctx.font = `${size}px Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}
