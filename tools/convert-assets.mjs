// Converts the original UC Fighter data folder into browser-friendly assets.
//
//   node tools/convert-assets.mjs ["C:\Program Files (x86)\UC Fighter\data"]
//
// - 24-bit BMPs become RGBA PNGs. The original loaded every texture with
//   D3DXCreateTextureFromFileEx(..., ColorKey = 0xFF00FF00), so pure green
//   (0,255,0) pixels become fully transparent here.
// - WAVs are copied unchanged (all are plain PCM).
// - Anything in data/music is copied and listed in assets/music/tracks.json
//   (the original picked a random file from that folder each fight).
//
// Output paths are lower-cased so the web build doesn't depend on the
// mixed-case filenames that only worked on a case-insensitive filesystem.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] ?? 'C:\\Program Files (x86)\\UC Fighter\\data');
const out = path.join(root, 'assets');

if (!fs.existsSync(src)) {
  console.error(`Data folder not found: ${src}`);
  process.exit(1);
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    raw[o] = 1; // Sub filter: compresses large flat colour areas well
    for (let x = 0; x < stride; x++) {
      const cur = rgba[y * stride + x];
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      raw[o + 1 + x] = (cur - left) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function decodeBmp(buf) {
  if (buf.toString('ascii', 0, 2) !== 'BM') throw new Error('not a BMP');
  const offset = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const rawHeight = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);
  if (bpp !== 24 || compression !== 0) throw new Error(`unsupported BMP ${bpp}bpp/${compression}`);
  const height = Math.abs(rawHeight);
  const bottomUp = rawHeight > 0;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = offset + (bottomUp ? height - 1 - y : y) * rowSize;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 3;
      const d = (y * width + x) * 4;
      const b = buf[s], g = buf[s + 1], r = buf[s + 2];
      if (r === 0 && g === 255 && b === 0) continue; // colour key -> transparent black
      rgba[d] = r;
      rgba[d + 1] = g;
      rgba[d + 2] = b;
      rgba[d + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const tracks = [];
let count = 0;
for (const file of walk(src)) {
  const rel = path.relative(src, file).toLowerCase();
  const ext = path.extname(rel);
  const isMusic = rel.startsWith('music' + path.sep);
  let dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (isMusic) {
    fs.copyFileSync(file, dest);
    tracks.push(path.basename(rel));
  } else if (ext === '.bmp') {
    const { width, height, rgba } = decodeBmp(fs.readFileSync(file));
    dest = dest.slice(0, -4) + '.png';
    fs.writeFileSync(dest, encodePng(width, height, rgba));
  } else if (ext === '.wav') {
    fs.copyFileSync(file, dest);
  } else {
    continue;
  }
  count++;
  console.log(`${rel} -> ${path.relative(root, dest)}`);
}

fs.mkdirSync(path.join(out, 'music'), { recursive: true });
fs.writeFileSync(path.join(out, 'music', 'tracks.json'), JSON.stringify(tracks, null, 2) + '\n');
console.log(`\nConverted ${count} files into ${out} (${tracks.length} music tracks).`);
