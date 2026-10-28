'use strict';

/**
 * Procedural pixel-art asset generator.
 *
 * Produces every runtime asset the extension ships with:
 *   media/sprites/<character>/<state>.png   horizontal frame strips
 *   media/sprites/<character>/manifest.json frame timings + palette
 *   media/environments/<env>.png             64x48 scene backdrops
 *   media/icon.png                           128x128 marketplace icon
 *
 * Nothing here is downloaded; every pixel is authored in code so the
 * extension has no remote asset dependency.
 *
 * Sprite construction rules:
 *   - 32x32 grid. The character's feet rest on y = 30, leaving headroom so
 *     the success jump never clips the head or ears.
 *   - Parts are drawn back-to-front (tail, ears, body, limbs, head, props)
 *     so overlapping edges read as one connected figure.
 *   - Ears and other angled shapes are placed as explicit stepped rows
 *     rather than smooth triangles, which is what keeps the result looking
 *     like deliberate pixel art.
 */

const fs = require('fs');
const path = require('path');
const { encodePNG, hexToRgb, Px } = require('./lib/png');

const ROOT = path.resolve(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');

const PAL = {
  outline: '#241B3D',
  bodyDark: '#6D5AA8',
  body: '#A78BFA',
  bodyLight: '#C4B5FD',
  belly: '#DDD6FE',
  cyan: '#67E8F9',
  cyanDark: '#22D3EE',
  cyanDeep: '#0E7490',
  pupil: '#1E1B31',
  green: '#86EFAC',
  greenDark: '#3F7A4E',
  yellow: '#FDE68A',
  red: '#FCA5A5',
  white: '#F9FAFB',
  ink: '#0B1020',
  panel: '#151C2C',
};

const C = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hexToRgb(v)]));

const G = 32; // sprite grid size

/* ================================================================== */
/* Byte - a small purple and cyan robotic cat                          */
/* ================================================================== */

// Resting geometry. The sprite is drawn around these anchors so every
// animation state stays registered to the same ground line.
const BYTE = {
  head: { x: 7, y: 10, w: 18, h: 11, r: 4 },
  plate: { x: 11, y: 13, w: 10, h: 7 },
  body: { x: 8, y: 17, w: 16, h: 11, r: 4 },
  belly: { x: 13, y: 21, w: 6, h: 6 },
  eyeLX: 12,
  eyeRX: 18,
  eyeY: 15,
  footL: 9,
  footR: 18,
};

// Stepped ear rows, relative to the head's top-left corner. The base row
// overlaps the head by one pixel so the ear reads as attached to the skull
// rather than as a separate floating shape.
const BYTE_EARS = [
  { dy: -4, xs: [4, 5] },
  { dy: -3, xs: [4, 5, 6] },
  { dy: -2, xs: [3, 4, 5, 6] },
  { dy: -1, xs: [3, 4, 5, 6] },
  { dy: 0, xs: [3, 4, 5, 6] },
];

const BYTE_EARS_INNER = [
  { dy: -3, xs: [4, 5] },
  { dy: -2, xs: [4, 5] },
  { dy: -1, xs: [4, 5] },
  { dy: 0, xs: [4, 5] },
];

// The tail curls up behind the body's right shoulder so it stays clear of
// the arm and reads as a separate silhouette element.
const BYTE_TAILS = [
  [[25, 20], [28, 18], [30, 15], [29, 12]],
  [[25, 20], [29, 17], [30, 14], [28, 11]],
  [[25, 21], [28, 20], [30, 17], [29, 14]],
];

function drawByte(s, pose) {
  const p = pose;
  const bob = p.bob || 0;
  const dx = p.side || 0;
  const dy = bob;

  const eyes = p.eyes || 'open';
  const headShift = p.headShift || 0;
  const hx = BYTE.head.x + dx + headShift;
  const hy = BYTE.head.y + dy;

  /* ---- tail (behind everything) -------------------------------- */
  const tail = BYTE_TAILS[p.tail % BYTE_TAILS.length];
  for (let i = 0; i < tail.length - 1; i++) {
    s.line(tail[i][0] + dx, tail[i][1] + dy, tail[i + 1][0] + dx, tail[i + 1][1] + dy, C.outline);
  }
  for (let i = 0; i < tail.length - 1; i++) {
    s.line(
      tail[i][0] + dx,
      tail[i][1] + dy - 1,
      tail[i + 1][0] + dx,
      tail[i + 1][1] + dy - 1,
      C.bodyDark
    );
  }
  s.set(tail[tail.length - 1][0] + dx, tail[tail.length - 1][1] + dy - 1, C.cyan);

  /* ---- ears (behind the head, drawn as stepped rows) ----------- */
  for (const ear of [BYTE_EARS, mirrorEars(BYTE_EARS)]) {
    for (const row of ear) {
      for (const x of row.xs) {
        s.set(hx + x, hy + row.dy, C.outline);
      }
    }
  }
  for (const ear of [BYTE_EARS_INNER, mirrorEars(BYTE_EARS_INNER)]) {
    for (const row of ear) {
      for (const x of row.xs) {
        s.set(hx + x, hy + row.dy, C.body);
      }
    }
  }
  // cyan ear tips
  for (const x of BYTE_EARS[1].xs) {
    s.set(hx + x, hy + BYTE_EARS[1].dy, C.cyan);
  }
  for (const x of mirrorEars(BYTE_EARS)[1].xs) {
    s.set(hx + x, hy + BYTE_EARS[1].dy, C.cyan);
  }

  /* ---- body ----------------------------------------------------- */
  const b = BYTE.body;
  s.roundRect(b.x + dx, b.y + dy, b.w, b.h, b.r, C.outline);
  s.roundRect(b.x + 1 + dx, b.y + 1 + dy, b.w - 2, b.h - 1, b.r - 1, C.body);
  s.fillRect(b.x + 1 + dx, b.y + 1 + dy, b.w - 2, 2, C.bodyLight);

  s.fillRect(BYTE.belly.x + dx, BYTE.belly.y + dy, BYTE.belly.w, BYTE.belly.h, C.belly);
  s.fillRect(BYTE.belly.x + dx, BYTE.belly.y + dy, BYTE.belly.w, 1, C.bodyLight);

  // glowing core
  s.set(14 + dx, 24 + dy, C.cyan);
  s.set(15 + dx, 24 + dy, C.cyanDark);
  s.set(14 + dx, 25 + dy, C.cyanDark);

  /* ---- feet ------------------------------------------------------ */
  const footL = p.footL || 0;
  const footR = p.footR || 0;
  s.fillRect(BYTE.footL + dx, 28 + dy + footL, 5, 3, C.outline);
  s.fillRect(BYTE.footL + dx, 28 + dy + footL, 4, 1, C.bodyDark);
  s.fillRect(BYTE.footR + dx, 28 + dy + footR, 5, 3, C.outline);
  s.fillRect(BYTE.footR + dx, 28 + dy + footR, 4, 1, C.bodyDark);

  /* ---- arms (in front of the body) ------------------------------- */
  if (!p.noArms) {
    const armL = p.armL || 0;
    const armR = p.armR || 0;
    const armLOut = Math.min(p.armLOut || 0, 1);
    const armROut = Math.min(p.armROut || 0, 1);

    s.fillRect(4 - armLOut + dx, 20 + dy + armL, 5, 6, C.outline);
    s.fillRect(4 - armLOut + dx, 21 + dy + armL, 4, 4, C.body);
    s.fillRect(4 - armLOut + dx, 21 + dy + armL, 4, 1, C.bodyLight);
    s.set(6 - armLOut + dx, 24 + dy + armL, C.cyan);

    s.fillRect(24 + armROut + dx, 20 + dy + armR, 5, 6, C.outline);
    s.fillRect(24 + armROut + dx, 21 + dy + armR, 4, 4, C.body);
    s.fillRect(24 + armROut + dx, 21 + dy + armR, 4, 1, C.bodyLight);
    s.set(26 + armROut + dx, 24 + dy + armR, C.cyan);
  }

  /* ---- head (in front of the body so the two read as joined) ---- */
  s.roundRect(hx, hy, BYTE.head.w, BYTE.head.h, BYTE.head.r, C.outline);
  s.roundRect(hx + 1, hy + 1, BYTE.head.w - 2, BYTE.head.h - 1, BYTE.head.r - 1, C.body);
  s.roundRect(hx + 1, hy + 1, BYTE.head.w - 2, 5, BYTE.head.r - 1, C.bodyLight);

  // face plate
  s.fillRect(hx + 3, hy + 3, 12, 7, C.ink);
  s.fillRect(hx + 3, hy + 3, 12, 1, C.bodyDark);

  /* ---- eyes ------------------------------------------------------- */
  const eL = hx + BYTE.eyeLX - BYTE.head.x;
  const eR = hx + BYTE.eyeRX - BYTE.head.x;
  const eY = hy + BYTE.eyeY - BYTE.head.y;

  if (eyes === 'closed' || p.blink) {
    s.fillRect(eL, eY + 1, 2, 1, C.cyan);
    s.fillRect(eR, eY + 1, 2, 1, C.cyan);
  } else if (eyes === 'happy') {
    // Upturned arcs, kept apart so the two eyes never merge.
    s.set(eL - 1, eY + 1, C.cyan);
    s.set(eL, eY, C.cyan);
    s.set(eL + 1, eY, C.cyan);
    s.set(eL + 2, eY + 1, C.cyan);
    s.set(eR - 2, eY + 1, C.cyan);
    s.set(eR - 1, eY, C.cyan);
    s.set(eR, eY, C.cyan);
    s.set(eR + 1, eY + 1, C.cyan);
  } else if (eyes === 'concerned') {
    s.fillRect(eL, eY, 2, 3, C.cyan);
    s.fillRect(eR, eY, 2, 3, C.cyan);
    s.set(eL + 1, eY, C.pupil);
    s.set(eR + 1, eY, C.pupil);
    s.set(eL + 2, eY + 3, C.bodyLight);
    s.set(eR + 2, eY + 3, C.bodyLight);
  } else if (eyes === 'wide') {
    s.fillRect(eL - 1, eY - 1, 4, 4, C.cyan);
    s.fillRect(eR - 1, eY - 1, 4, 4, C.cyan);
    s.fillRect(eL, eY, 2, 2, C.pupil);
    s.fillRect(eR, eY, 2, 2, C.pupil);
    s.set(eL, eY, C.white);
    s.set(eR, eY, C.white);
  } else {
    s.fillRect(eL, eY, 2, 2, C.cyan);
    s.fillRect(eR, eY, 2, 2, C.cyan);
    s.set(eL, eY, C.white);
    s.set(eR, eY, C.white);
  }

  // mouth
  const mY = hy + 8;
  if (eyes === 'happy') {
    s.set(hx + 8, mY, C.bodyLight);
    s.set(hx + 9, mY + 1, C.bodyLight);
    s.set(hx + 10, mY + 1, C.bodyLight);
    s.set(hx + 11, mY, C.bodyLight);
  } else if (eyes === 'concerned') {
    s.set(hx + 8, mY + 1, C.bodyLight);
    s.set(hx + 9, mY, C.bodyLight);
    s.set(hx + 10, mY, C.bodyLight);
    s.set(hx + 11, mY + 1, C.bodyLight);
  } else {
    s.fillRect(hx + 8, mY, 3, 1, C.bodyLight);
  }

  // whiskers
  s.set(hx + 1, hy + 6, C.bodyDark);
  s.set(hx + 2, hy + 6, C.bodyDark);
  s.set(hx + 15, hy + 6, C.bodyDark);
  s.set(hx + 16, hy + 6, C.bodyDark);

  /* ---- held props (in front of everything) ----------------------- */
  if (p.keyboard) {
    // Held across the front of the body so it stays legible at small sizes.
    const ky = p.keyboardY || 0;
    s.fillRect(4 + dx, 28 + dy + ky, 24, 4, C.outline);
    s.fillRect(5 + dx, 29 + dy + ky, 22, 2, C.cyanDeep);
    s.fillRect(5 + dx, 29 + dy + ky, 22, 1, C.cyanDark);
    if (p.keyFlash) {
      s.fillRect(7 + dx, 29 + dy + ky, 4, 1, C.cyan);
      s.fillRect(14 + dx, 29 + dy + ky, 4, 1, C.cyan);
      s.fillRect(21 + dx, 29 + dy + ky, 3, 1, C.cyan);
    }
  }
  if (p.document) {
    // Held to the right of the body, below the face plate.
    const docY = p.documentY || 0;
    s.fillRect(23 + dx, 18 + dy + docY, 9, 12, C.outline);
    s.fillRect(24 + dx, 18 + dy + docY, 7, 10, C.white);
    s.fillRect(24 + dx, 18 + dy + docY, 7, 1, C.bodyLight);
    s.fillRect(25 + dx, 20 + dy + docY, 5, 1, C.bodyDark);
    s.fillRect(25 + dx, 22 + dy + docY, 5, 1, C.bodyDark);
    s.fillRect(25 + dx, 24 + dy + docY, 4, 1, C.bodyDark);
  }
  if (p.magnifier) {
    // Raised in the left hand, above the face plate.
    const mx = 1 + dx;
    const my = 2 + dy + (p.magnifierY || 0);
    s.strokeEllipse(mx + 4, my + 4, 4, 4, C.cyan);
    s.fillEllipse(mx + 4, my + 4, 3, 3, [26, 32, 51, 110]);
    s.line(mx + 6, my + 8, mx + 5, my + 12, C.cyanDark);
  }
}

/** Mirrors a set of stepped ear rows across the head's vertical centre. */
function mirrorEars(rows) {
  return rows.map((row) => ({
    dy: row.dy,
    xs: row.xs.map((x) => BYTE.head.w - 1 - x).sort((a, b) => a - b),
  }));
}
/* ================================================================== */
/* Pixel - a small floating ghost                                       */
/* ================================================================== */

function drawPixel(s, pose) {
  const p = pose;
  const bob = p.bob || 0;
  const dx = p.side || 0;
  const dy = bob;
  const eyes = p.eyes || 'open';
  const wave = p.wave || 0;

  // small floating wisps trailing behind the ghost
  s.set(3 + dx, 22 + dy, C.bodyLight);
  s.set(4 + dx, 25 + dy, C.body);
  s.set(28 + dx, 22 + dy, C.bodyLight);
  s.set(27 + dx, 25 + dy, C.body);

  // silhouette: dome + body + wavy hem
  s.fillEllipse(16 + dx, 16 + dy, 8, 8, C.outline);
  s.fillRect(8 + dx, 16 + dy, 16, 8, C.outline);
  for (let i = 0; i < 8; i++) {
    const up = wave % 2 === 0 ? i % 2 === 0 : i % 2 === 1;
    s.fillRect(8 + i * 2 + dx, 23 + dy + (up ? 0 : 1), 2, 4, C.outline);
  }

  // inner body
  s.fillEllipse(16 + dx, 16 + dy, 7, 7, C.bodyLight);
  s.fillRect(9 + dx, 16 + dy, 14, 7, C.bodyLight);
  for (let i = 0; i < 7; i++) {
    const up = wave % 2 === 0 ? i % 2 === 1 : i % 2 === 0;
    s.fillRect(9 + i * 2 + dx, 23 + dy + (up ? 0 : 1), 2, 3, C.bodyLight);
  }

  // shading on the lower half
  s.fillEllipse(16 + dx, 19 + dy, 7, 6, C.body);
  s.fillRect(9 + dx, 20 + dy, 14, 5, C.body);
  for (let i = 0; i < 7; i++) {
    const up = wave % 2 === 0 ? i % 2 === 1 : i % 2 === 0;
    s.fillRect(9 + i * 2 + dx, 23 + dy + (up ? 0 : 1), 2, 2, C.body);
  }

  // eyes
  const eY = 14 + dy;
  if (eyes === 'closed') {
    s.fillRect(12 + dx, eY + 1, 3, 1, C.ink);
    s.fillRect(17 + dx, eY + 1, 3, 1, C.ink);
  } else if (eyes === 'happy') {
    s.set(11 + dx, eY + 1, C.ink);
    s.set(12 + dx, eY, C.ink);
    s.set(13 + dx, eY, C.ink);
    s.set(14 + dx, eY + 1, C.ink);
    s.set(17 + dx, eY + 1, C.ink);
    s.set(18 + dx, eY, C.ink);
    s.set(19 + dx, eY, C.ink);
    s.set(20 + dx, eY + 1, C.ink);
  } else {
    s.fillRect(12 + dx, eY, 3, 4, C.ink);
    s.fillRect(17 + dx, eY, 3, 4, C.ink);
    s.set(12 + dx, eY, C.white);
    s.set(17 + dx, eY, C.white);
  }
  if (eyes === 'concerned') {
    s.set(11 + dx, eY, C.ink);
    s.set(21 + dx, eY, C.ink);
  }

  // mouth
  if (eyes === 'happy') {
    s.set(14 + dx, 19 + dy, C.ink);
    s.set(15 + dx, 20 + dy, C.ink);
    s.set(16 + dx, 20 + dy, C.ink);
    s.set(17 + dx, 19 + dy, C.ink);
  } else if (eyes === 'concerned') {
    s.set(14 + dx, 20 + dy, C.ink);
    s.set(15 + dx, 19 + dy, C.ink);
    s.set(16 + dx, 19 + dy, C.ink);
    s.set(17 + dx, 20 + dy, C.ink);
  } else {
    s.fillRect(14 + dx, 19 + dy, 3, 1, C.ink);
  }
}

/* ================================================================== */
/* Bugsy - a tiny green bug-like robot                                  */
/* ================================================================== */

function drawBugsy(s, pose) {
  const p = pose;
  const bob = p.bob || 0;
  const dx = p.side || 0;
  const dy = bob;
  const eyes = p.eyes || 'open';

  // Antennae. The stalk is drawn in body colour rather than the outline
  // shade so it stays visible against a dark background.
  s.line(13 + dx, 13 + dy, 10 + dx, 5 + dy, C.greenDark);
  s.line(19 + dx, 13 + dy, 22 + dx, 5 + dy, C.greenDark);
  s.set(10 + dx, 4 + dy, C.green);
  s.set(22 + dx, 4 + dy, C.green);
  s.glow(10 + dx, 4 + dy, 3, C.green, 0.35);
  s.glow(22 + dx, 4 + dy, 3, C.green, 0.35);

  // legs
  s.fillRect(9 + dx, 27 + dy, 3, 4, C.greenDark);
  s.fillRect(20 + dx, 27 + dy, 3, 4, C.greenDark);

  // body
  s.roundRect(6 + dx, 10 + dy, 20, 18, 6, C.outline);
  s.roundRect(7 + dx, 11 + dy, 18, 16, 5, C.green);
  s.fillRect(7 + dx, 11 + dy, 18, 4, C.greenDark);
  s.fillRect(7 + dx, 11 + dy, 18, 1, C.green);
  s.fillRect(11 + dx, 21 + dy, 10, 6, C.greenDark);

  // shell markings
  s.fillRect(10 + dx, 16 + dy, 3, 3, C.greenDark);
  s.fillRect(19 + dx, 16 + dy, 3, 3, C.greenDark);
  s.fillRect(15 + dx, 23 + dy, 2, 2, C.green);

  // eyes
  const eY = 14 + dy;
  if (eyes === 'closed') {
    s.fillRect(10 + dx, eY + 1, 3, 1, C.ink);
    s.fillRect(19 + dx, eY + 1, 3, 1, C.ink);
  } else if (eyes === 'happy') {
    s.set(9 + dx, eY + 1, C.ink);
    s.set(10 + dx, eY, C.ink);
    s.set(11 + dx, eY, C.ink);
    s.set(12 + dx, eY + 1, C.ink);
    s.set(19 + dx, eY + 1, C.ink);
    s.set(20 + dx, eY, C.ink);
    s.set(21 + dx, eY, C.ink);
    s.set(22 + dx, eY + 1, C.ink);
  } else if (eyes === 'wide') {
    s.fillRect(9 + dx, eY - 1, 5, 5, C.white);
    s.fillRect(18 + dx, eY - 1, 5, 5, C.white);
    s.fillRect(11 + dx, eY, 2, 3, C.ink);
    s.fillRect(20 + dx, eY, 2, 3, C.ink);
  } else {
    s.fillRect(10 + dx, eY, 3, 3, C.white);
    s.fillRect(19 + dx, eY, 3, 3, C.white);
    s.fillRect(11 + dx, eY + 1, 2, 2, C.ink);
    s.fillRect(20 + dx, eY + 1, 2, 2, C.ink);
  }
  if (eyes === 'concerned') {
    s.set(9 + dx, eY - 1, C.ink);
    s.set(22 + dx, eY - 1, C.ink);
  }

  // mouth
  if (eyes === 'happy') {
    s.set(13 + dx, 19 + dy, C.ink);
    s.fillRect(14 + dx, 20 + dy, 4, 1, C.ink);
    s.set(18 + dx, 19 + dy, C.ink);
  } else {
    s.fillRect(13 + dx, 19 + dy, 6, 1, C.ink);
  }
}

/* ================================================================== */
/* Frame builders - one per animation state                            */
/* ================================================================== */

function strip(drawFn, frames) {
  const s = new Px(G * frames.length, G);
  frames.forEach((pose, i) => {
    const sub = new Px(G, G);
    drawFn(sub, pose);
    s.blit(sub, i * G, 0);
  });
  return s;
}

function byteStates() {
  const states = {};

  states.idle = strip(drawByte, [
    { bob: 0, tail: 0 },
    { bob: -1, tail: 1 },
    { bob: -1, tail: 2 },
    { bob: 0, tail: 1 },
    { bob: 0, tail: 0, blink: true },
    { bob: -1, tail: 0 },
    { bob: -1, tail: 1 },
    { bob: 0, tail: 2 },
  ]);

  states.think = strip(drawByte, [
    { bob: 0, tail: 0, eyes: 'wide' },
    { bob: -1, tail: 1, eyes: 'wide' },
    { bob: -1, tail: 2, eyes: 'wide', headShift: 1 },
    { bob: 0, tail: 1, eyes: 'wide', headShift: 1 },
    { bob: 0, tail: 0, eyes: 'wide' },
    { bob: -1, tail: 0, eyes: 'wide', headShift: -1 },
  ]);

  states.type = strip(drawByte, [
    { bob: 0, tail: 0, keyboard: true, armL: 0, armR: 1 },
    { bob: -1, tail: 1, keyboard: true, armL: 1, armR: 0, keyFlash: true },
    { bob: 0, tail: 0, keyboard: true, armL: 0, armR: 1 },
    { bob: -1, tail: 2, keyboard: true, armL: 1, armR: 0 },
    { bob: 0, tail: 1, keyboard: true, armL: 0, armR: 1, keyFlash: true },
    { bob: -1, tail: 0, keyboard: true, armL: 1, armR: 0 },
    { bob: 0, tail: 2, keyboard: true, armL: 0, armR: 1 },
    { bob: -1, tail: 1, keyboard: true, armL: 1, armR: 0, keyFlash: true },
  ]);

  states.code = strip(drawByte, [
    { bob: 0, tail: 0, keyboard: true, armL: 0, armR: 0, eyes: 'wide' },
    { bob: -1, tail: 1, keyboard: true, armL: 1, armR: 0, eyes: 'wide', keyFlash: true },
    { bob: -1, tail: 2, keyboard: true, armL: 0, armR: 1, eyes: 'wide' },
    { bob: 0, tail: 1, keyboard: true, armL: 1, armR: 1, eyes: 'wide', keyFlash: true },
    { bob: -1, tail: 2, keyboard: true, armL: 0, armR: 1, eyes: 'wide' },
    { bob: 0, tail: 0, keyboard: true, armL: 1, armR: 0, eyes: 'wide', keyFlash: true },
    { bob: -1, tail: 1, keyboard: true, armL: 0, armR: 0, eyes: 'wide' },
    { bob: -1, tail: 2, keyboard: true, armL: 1, armR: 1, eyes: 'wide' },
  ]);

  states.review = strip(drawByte, [
    { bob: 0, tail: 0, document: true, magnifier: true },
    { bob: -1, tail: 1, document: true, magnifier: true, magnifierY: -1 },
    { bob: -1, tail: 2, document: true, magnifier: true, magnifierY: 0 },
    { bob: 0, tail: 1, document: true, magnifier: true, magnifierY: -1 },
  ]);

  states.success = strip(drawByte, [
    { bob: 0, tail: 0, eyes: 'happy', armLOut: 1, armROut: 1, armL: -3, armR: -3 },
    { bob: -3, tail: 1, eyes: 'happy', armLOut: 1, armROut: 1, armL: -4, armR: -4 },
    { bob: -4, tail: 2, eyes: 'happy', armLOut: 1, armROut: 1, armL: -5, armR: -5 },
    { bob: -2, tail: 1, eyes: 'happy', armLOut: 1, armROut: 1, armL: -4, armR: -4 },
    { bob: 0, tail: 0, eyes: 'happy', armLOut: 1, armROut: 1, armL: -2, armR: -2 },
    { bob: 0, tail: 0, eyes: 'happy', armLOut: 0, armROut: 0, armL: 0, armR: 0 },
  ]);

  states.error = strip(drawByte, [
    { bob: 0, tail: 0, eyes: 'concerned' },
    { bob: -1, tail: 1, eyes: 'concerned' },
    { bob: 0, tail: 0, eyes: 'concerned' },
    { bob: -1, tail: 1, eyes: 'concerned' },
  ]);

  states.wait = strip(drawByte, [
    { bob: 0, tail: 0 },
    { bob: 0, tail: 1 },
    { bob: -1, tail: 2 },
    { bob: 0, tail: 1 },
    { bob: 0, tail: 0 },
    { bob: 0, tail: 2 },
  ]);

  states.pause = strip(drawByte, [
    { bob: 0, tail: 0, footL: 1, footR: 1 },
    { bob: 0, tail: 1, footL: 1, footR: 1 },
    { bob: 1, tail: 1, footL: 1, footR: 1 },
    { bob: 1, tail: 2, footL: 1, footR: 1 },
    { bob: 0, tail: 2, footL: 1, footR: 1 },
    { bob: 0, tail: 0, footL: 1, footR: 1 },
  ]);

  states.sleep = strip(drawByte, [
    { bob: 1, tail: 0, eyes: 'closed' },
    { bob: 2, tail: 1, eyes: 'closed' },
    { bob: 2, tail: 1, eyes: 'closed' },
    { bob: 1, tail: 0, eyes: 'closed' },
  ]);

  return states;
}

function pixelStates() {
  const states = {};

  states.idle = strip(drawPixel, [
    { bob: 0, wave: 0 },
    { bob: -1, wave: 1 },
    { bob: -1, wave: 0 },
    { bob: 0, wave: 1 },
    { bob: 0, wave: 0, eyes: 'closed' },
    { bob: -1, wave: 0 },
  ]);

  states.think = strip(drawPixel, [
    { bob: 0, wave: 0, eyes: 'wide' },
    { bob: -2, wave: 1, eyes: 'wide' },
    { bob: -3, wave: 0, eyes: 'wide' },
    { bob: -2, wave: 1, eyes: 'wide' },
  ]);

  states.type = strip(drawPixel, [
    { bob: 0, wave: 0 },
    { bob: -1, wave: 1 },
    { bob: -1, wave: 0 },
    { bob: 0, wave: 1 },
    { bob: -1, wave: 0 },
    { bob: 0, wave: 1 },
  ]);

  states.code = strip(drawPixel, [
    { bob: 0, wave: 0, eyes: 'wide' },
    { bob: -2, wave: 1, eyes: 'wide' },
    { bob: -3, wave: 0, eyes: 'wide' },
    { bob: -2, wave: 1, eyes: 'wide' },
    { bob: -1, wave: 0, eyes: 'wide' },
    { bob: 0, wave: 1, eyes: 'wide' },
  ]);

  states.review = strip(drawPixel, [
    { bob: 0, wave: 0 },
    { bob: -1, wave: 1 },
    { bob: 0, wave: 0 },
  ]);

  states.success = strip(drawPixel, [
    { bob: -3, wave: 0, eyes: 'happy' },
    { bob: -5, wave: 1, eyes: 'happy' },
    { bob: -6, wave: 0, eyes: 'happy' },
    { bob: -4, wave: 1, eyes: 'happy' },
    { bob: -1, wave: 0, eyes: 'happy' },
    { bob: 0, wave: 1, eyes: 'happy' },
  ]);

  states.error = strip(drawPixel, [
    { bob: 1, wave: 0, eyes: 'concerned' },
    { bob: 0, wave: 1, eyes: 'concerned' },
    { bob: 1, wave: 0, eyes: 'concerned' },
  ]);

  states.wait = strip(drawPixel, [
    { bob: 0, wave: 0 },
    { bob: 1, wave: 1 },
    { bob: 0, wave: 0 },
  ]);

  states.pause = strip(drawPixel, [
    { bob: 1, wave: 0 },
    { bob: 2, wave: 1 },
    { bob: 2, wave: 0 },
    { bob: 1, wave: 1 },
  ]);

  states.sleep = strip(drawPixel, [
    { bob: 2, wave: 0, eyes: 'closed' },
    { bob: 3, wave: 1, eyes: 'closed' },
    { bob: 3, wave: 0, eyes: 'closed' },
    { bob: 2, wave: 1, eyes: 'closed' },
  ]);

  return states;
}

function bugsyStates() {
  const states = {};

  states.idle = strip(drawBugsy, [
    { bob: 0 },
    { bob: -1 },
    { bob: -1 },
    { bob: 0 },
    { bob: 0, eyes: 'closed' },
    { bob: -1 },
  ]);

  states.think = strip(drawBugsy, [
    { bob: 0, eyes: 'wide' },
    { bob: -1, eyes: 'wide' },
    { bob: -2, eyes: 'wide' },
    { bob: -1, eyes: 'wide' },
  ]);

  states.type = strip(drawBugsy, [
    { bob: 0 },
    { bob: -1 },
    { bob: 0 },
    { bob: -1 },
    { bob: 0 },
    { bob: -1 },
  ]);

  states.code = strip(drawBugsy, [
    { bob: 0, eyes: 'wide' },
    { bob: -1, eyes: 'wide' },
    { bob: -2, eyes: 'wide' },
    { bob: -1, eyes: 'wide' },
    { bob: 0, eyes: 'wide' },
    { bob: -1, eyes: 'wide' },
  ]);

  states.review = strip(drawBugsy, [
    { bob: 0 },
    { bob: -1 },
    { bob: 0 },
  ]);

  states.success = strip(drawBugsy, [
    { bob: -2, eyes: 'happy' },
    { bob: -4, eyes: 'happy' },
    { bob: -5, eyes: 'happy' },
    { bob: -3, eyes: 'happy' },
    { bob: -1, eyes: 'happy' },
    { bob: 0, eyes: 'happy' },
  ]);

  states.error = strip(drawBugsy, [
    { bob: 1, eyes: 'concerned' },
    { bob: 0, eyes: 'concerned' },
    { bob: 1, eyes: 'concerned' },
  ]);

  states.wait = strip(drawBugsy, [
    { bob: 0 },
    { bob: 0 },
    { bob: -1 },
    { bob: 0 },
  ]);

  states.pause = strip(drawBugsy, [
    { bob: 1 },
    { bob: 2 },
    { bob: 2 },
    { bob: 1 },
  ]);

  states.sleep = strip(drawBugsy, [
    { bob: 2, eyes: 'closed' },
    { bob: 3, eyes: 'closed' },
    { bob: 3, eyes: 'closed' },
    { bob: 2, eyes: 'closed' },
  ]);

  return states;
}

/* ================================================================== */
/* Environments - 64x48 backdrops                                       */
/* ================================================================== */

const EW = 64;
const EH = 48;

function environment(kind) {
  const s = new Px(EW, EH);

  if (kind === 'cozyDesk') {
    s.fillRect(0, 0, EW, 34, hexToRgb('#1B2236'));
    s.fillRect(0, 0, EW, 2, hexToRgb('#232C44'));
    for (let x = 0; x < EW; x += 8) {
      s.fillRect(x, 4, 1, 30, hexToRgb('#161C2D'));
    }
    s.fillRect(42, 6, 18, 16, hexToRgb('#0E7490'));
    s.fillRect(42, 6, 18, 1, hexToRgb('#67E8F9'));
    s.fillRect(51, 6, 1, 16, hexToRgb('#1B2236'));
    s.fillRect(42, 14, 18, 1, hexToRgb('#1B2236'));
    s.fillRect(56, 9, 2, 2, hexToRgb('#FDE68A'));
    s.fillRect(46, 17, 2, 2, hexToRgb('#FDE68A'));
    s.fillRect(43, 21, 19, 2, hexToRgb('#0B1020'));
    s.fillRect(0, 34, EW, EH - 34, hexToRgb('#2A2036'));
    s.fillRect(0, 34, EW, 1, hexToRgb('#3A2C48'));
    for (let x = 0; x < EW; x += 6) {
      s.fillRect(x, 38, 3, 1, hexToRgb('#332742'));
    }
    s.fillRect(2, 30, 28, 2, hexToRgb('#5B4636'));
    s.fillRect(2, 32, 28, 2, hexToRgb('#3E3025'));
    s.fillRect(4, 34, 3, 12, hexToRgb('#3E3025'));
    s.fillRect(25, 34, 3, 12, hexToRgb('#3E3025'));
    s.fillRect(8, 18, 18, 12, hexToRgb('#151C2C'));
    s.fillRect(9, 19, 16, 10, hexToRgb('#0B1020'));
    s.fillRect(10, 20, 8, 1, hexToRgb('#67E8F9'));
    s.fillRect(10, 22, 12, 1, hexToRgb('#A78BFA'));
    s.fillRect(10, 24, 6, 1, hexToRgb('#4B5563'));
    s.fillRect(10, 26, 9, 1, hexToRgb('#4B5563'));
    s.fillRect(15, 30, 4, 2, hexToRgb('#151C2C'));
    s.fillRect(4, 26, 4, 4, hexToRgb('#86EFAC'));
    s.fillRect(5, 27, 2, 2, hexToRgb('#0B1020'));
    s.fillRect(36, 26, 5, 5, hexToRgb('#8B5E3C'));
    s.fillRect(37, 21, 3, 5, hexToRgb('#86EFAC'));
    s.set(36, 20, hexToRgb('#86EFAC'));
    s.set(40, 22, hexToRgb('#86EFAC'));
  } else if (kind === 'nightStudio') {
    s.fillRect(0, 0, EW, 34, hexToRgb('#0D1224'));
    s.fillRect(0, 0, EW, 2, hexToRgb('#141B33'));
    s.fillRect(6, 5, 30, 20, hexToRgb('#0A0F20'));
    s.fillRect(6, 5, 30, 1, hexToRgb('#1E2A4A'));
    for (const [x, y] of [
      [10, 9],
      [16, 13],
      [22, 8],
      [28, 15],
      [32, 11],
      [13, 19],
      [25, 20],
    ]) {
      s.set(x, y, hexToRgb('#E5E7EB'));
    }
    s.set(30, 7, hexToRgb('#FDE68A'));
    s.fillRect(6, 20, 30, 5, hexToRgb('#141B33'));
    for (let i = 0; i < 6; i++) {
      s.fillRect(8 + i * 5, 21, 2, 2, hexToRgb('#67E8F9'));
    }
    s.fillRect(0, 34, EW, EH - 34, hexToRgb('#131A2E'));
    s.fillRect(0, 34, EW, 1, hexToRgb('#1B2440'));
    s.fillRect(40, 30, 22, 2, hexToRgb('#2A3550'));
    s.fillRect(40, 32, 22, 2, hexToRgb('#1B2440'));
    s.fillRect(42, 34, 3, 12, hexToRgb('#1B2440'));
    s.fillRect(56, 34, 3, 12, hexToRgb('#1B2440'));
    s.fillRect(44, 18, 16, 12, hexToRgb('#11182B'));
    s.fillRect(45, 19, 14, 10, hexToRgb('#0A0F20'));
    s.fillRect(46, 21, 7, 1, hexToRgb('#A78BFA'));
    s.fillRect(46, 23, 10, 1, hexToRgb('#67E8F9'));
    s.fillRect(46, 25, 5, 1, hexToRgb('#3B4A6B'));
    s.fillRect(50, 30, 4, 2, hexToRgb('#11182B'));
    s.fillRect(60, 22, 2, 10, hexToRgb('#2A3550'));
    s.fillRect(57, 19, 8, 3, hexToRgb('#FDE68A'));
  } else {
    s.fillRect(0, 0, EW, 32, hexToRgb('#10203A'));
    s.fillRect(0, 0, EW, 8, hexToRgb('#16305A'));
    s.fillEllipse(52, 10, 5, 5, hexToRgb('#FDE68A'));
    s.fillEllipse(14, 32, 16, 9, hexToRgb('#16324A'));
    s.fillEllipse(46, 33, 18, 10, hexToRgb('#1B3A52'));
    s.fillRect(0, 32, EW, EH - 32, hexToRgb('#1E3D2B'));
    s.fillRect(0, 32, EW, 1, hexToRgb('#2A5238'));
    for (let x = 2; x < EW; x += 7) {
      s.fillRect(x, 36 + ((x % 3) * 2), 1, 3, hexToRgb('#2A5238'));
      s.fillRect(x + 2, 40 + (x % 4), 1, 2, hexToRgb('#2A5238'));
    }
    for (const [x, y] of [
      [8, 38],
      [22, 42],
      [44, 37],
      [56, 41],
    ]) {
      s.fillRect(x, y, 1, 4, hexToRgb('#2A5238'));
      s.set(x, y, hexToRgb('#FCA5A5'));
      s.set(x - 1, y, hexToRgb('#FCA5A5'));
      s.set(x + 1, y, hexToRgb('#FCA5A5'));
      s.set(x, y - 1, hexToRgb('#FCA5A5'));
      s.set(x, y + 1, hexToRgb('#FDE68A'));
    }
    s.fillRect(4, 22, 3, 12, hexToRgb('#5B4636'));
    s.fillEllipse(6, 18, 7, 6, hexToRgb('#2A6B3C'));
    s.fillEllipse(11, 21, 5, 4, hexToRgb('#2A6B3C'));
  }

  return s;
}

/* ================================================================== */
/* Icon                                                                   */
/* ================================================================== */

function iconSurface() {
  const s = new Px(32, 32);
  s.roundRect(0, 0, 32, 32, 6, hexToRgb('#151C2C'));
  s.roundRect(1, 1, 30, 30, 5, hexToRgb('#1E2740'));
  s.fillTriangle(6, 12, 9, 4, 13, 12, hexToRgb('#A78BFA'));
  s.fillTriangle(25, 12, 22, 4, 18, 12, hexToRgb('#A78BFA'));
  s.fillTriangle(8, 11, 9, 6, 11, 11, hexToRgb('#67E8F9'));
  s.fillTriangle(23, 11, 22, 6, 20, 11, hexToRgb('#67E8F9'));
  s.roundRect(5, 10, 22, 17, 6, hexToRgb('#241B3D'));
  s.roundRect(6, 11, 20, 15, 5, hexToRgb('#A78BFA'));
  s.roundRect(6, 11, 20, 5, 5, hexToRgb('#C4B5FD'));
  s.fillRect(9, 15, 14, 8, hexToRgb('#0B1020'));
  s.fillRect(11, 17, 4, 4, hexToRgb('#67E8F9'));
  s.fillRect(18, 17, 4, 4, hexToRgb('#67E8F9'));
  s.fillRect(11, 17, 2, 2, hexToRgb('#E5E7EB'));
  s.fillRect(18, 17, 2, 2, hexToRgb('#E5E7EB'));
  s.fillRect(15, 21, 2, 1, hexToRgb('#C4B5FD'));
  return s;
}

/* ================================================================== */
/* Output                                                                 */
/* ================================================================== */

const STATE_TIMINGS = {
  idle: { duration: 220, loop: true },
  think: { duration: 180, loop: true },
  type: { duration: 95, loop: true },
  code: { duration: 95, loop: true },
  review: { duration: 200, loop: true },
  success: { duration: 75, loop: false },
  error: { duration: 200, loop: true },
  wait: { duration: 220, loop: true },
  pause: { duration: 260, loop: true },
  sleep: { duration: 320, loop: true },
};

const CHARACTERS = {
  byte: { name: 'Byte', personality: 'curious, energetic, focused', states: byteStates() },
  pixel: { name: 'Pixel', personality: 'calm, mysterious, playful', states: pixelStates() },
  bugsy: { name: 'Bugsy', personality: 'enthusiastic, hardworking, easily excited', states: bugsyStates() },
};

function writePNG(file, surface) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(surface.width, surface.height, surface.data));
}

function main() {
  for (const [id, def] of Object.entries(CHARACTERS)) {
    const dir = path.join(MEDIA, 'sprites', id);
    const manifest = {
      id,
      name: def.name,
      personality: def.personality,
      frameWidth: G,
      frameHeight: G,
      states: {},
    };
    for (const [state, surface] of Object.entries(def.states)) {
      writePNG(path.join(dir, `${state}.png`), surface);
      manifest.states[state] = {
        file: `${state}.png`,
        frames: surface.width / G,
        duration: STATE_TIMINGS[state].duration,
        loop: STATE_TIMINGS[state].loop,
      };
    }
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`sprites/${id}: ${Object.keys(def.states).length} states`);
  }

  for (const kind of ['cozyDesk', 'nightStudio', 'pixelGarden']) {
    writePNG(path.join(MEDIA, 'environments', `${kind}.png`), environment(kind));
    console.log(`environments/${kind}.png`);
  }

  writePNG(path.join(MEDIA, 'icon.png'), iconSurface().scaled(4));
  console.log('icon.png');
}

main();
