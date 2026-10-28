'use strict';

/**
 * Renders a scaled contact sheet of the generated sprite sheets so the art
 * can be eyeballed without launching VS Code.
 *
 * Usage: node tools/preview.js [characterId] [scale]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { encodePNG, Px } = require('./lib/png');

const ROOT = path.resolve(__dirname, '..');
const charId = process.argv[2] || 'byte';
const scale = parseInt(process.argv[3] || '5', 10);

const dir = path.join(ROOT, 'media', 'sprites', charId);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

function hex(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** Minimal PNG reader for our own encoder output (8-bit RGBA, no interlace). */
function readPNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) {
      throw new Error(`unsupported PNG filter ${filter}`);
    }
    for (let x = 0; x < stride; x++) {
      out[y * stride + x] = raw[y * (stride + 1) + 1 + x];
    }
  }
  const surf = new Px(width, height);
  surf.data.set(out);
  return surf;
}

const FW = manifest.frameWidth;
const FH = manifest.frameHeight;
const states = Object.keys(manifest.states);

// One row per state, frames laid out left to right.
const maxFrames = Math.max(...states.map((s) => manifest.states[s].frames));
const labelW = 6;
const cellW = labelW + maxFrames * (FW * scale + 2) + 4;
const cellH = FH * scale + 8;
const sheet = new Px(cellW, cellH * states.length);

states.forEach((state, row) => {
  const info = manifest.states[state];
  const cy = row * cellH;

  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const dark = ((x >> 3) + (y >> 3)) % 2 === 0;
      sheet.set(x, cy + y, dark ? hex('#20263A') : hex('#181D2E'));
    }
  }

  const strip = readPNG(path.join(dir, info.file));
  for (let f = 0; f < info.frames; f++) {
    const frame = new Px(FW, FH);
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        frame.set(x, y, strip.get(f * FW + x, y));
      }
    }
    sheet.blit(frame.scaled(scale), labelW + f * (FW * scale + 2) + 2, cy + 4);
  }
});

const outFile = path.join(ROOT, 'out', `preview-${charId}.png`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, encodePNG(sheet.width, sheet.height, sheet.data));
console.log(`${outFile} (${sheet.width}x${sheet.height})`);
