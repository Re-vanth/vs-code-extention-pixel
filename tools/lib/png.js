'use strict';

/**
 * Minimal dependency-free PNG encoder and pixel drawing surface.
 *
 * PNGs are written as 8-bit RGBA (color type 6), non-interlaced, with a
 * single zlib-compressed IDAT chunk. Node's built-in `zlib` supplies the
 * DEFLATE stream.
 */

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba row-major RGBA bytes, width*height*4 long
 * @returns {Buffer} PNG file bytes
 */
function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * An RGBA pixel surface with the small set of primitives needed to author
 * pixel art by hand.
 */
class Px {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  index(x, y) {
    return (y * this.width + x) * 4;
  }

  /** Opaque pixel write. */
  set(x, y, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) {
      return;
    }
    const i = this.index(px, py);
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = color.length > 3 ? color[3] : 255;
  }

  /** Alpha-composited pixel write. */
  blend(x, y, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) {
      return;
    }
    const alpha = (color.length > 3 ? color[3] : 255) / 255;
    if (alpha <= 0) {
      return;
    }
    const i = this.index(px, py);
    const inv = 1 - alpha;
    this.data[i] = Math.round(color[0] * alpha + this.data[i] * inv);
    this.data[i + 1] = Math.round(color[1] * alpha + this.data[i + 1] * inv);
    this.data[i + 2] = Math.round(color[2] * alpha + this.data[i + 2] * inv);
    this.data[i + 3] = Math.max(this.data[i + 3], Math.round(color[3] ?? 255));
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return [0, 0, 0, 0];
    }
    const i = this.index(x, y);
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 0;
    }
    return this.data[this.index(x, y) + 3];
  }

  fillRect(x, y, w, h, color) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, color);
      }
    }
  }

  /** Rounded rectangle with integer corner radii. */
  roundRect(x, y, w, h, r, color) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = dx < r ? r - dx : dx >= w - r ? dx - (w - r - 1) : 0;
        const cy = dy < r ? r - dy : dy >= h - r ? dy - (h - r - 1) : 0;
        if (cx * cx + cy * cy <= r * r) {
          this.set(x + dx, y + dy, color);
        }
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, color) {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const nx = (dx + 0.5) / rx;
        const ny = (dy + 0.5) / ry;
        if (nx * nx + ny * ny <= 1.0) {
          this.set(cx + dx, cy + dy, color);
        }
      }
    }
  }

  /** Ellipse outline of a single pixel thickness. */
  strokeEllipse(cx, cy, rx, ry, color) {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const nx = (dx + 0.5) / rx;
        const ny = (dy + 0.5) / ry;
        if (nx * nx + ny * ny <= 1.0) {
          const outside =
            ((dx + 1.5) / rx) ** 2 + ((dy + 0.5) / ry) ** 2 > 1.0 ||
            ((dx - 0.5) / rx) ** 2 + ((dy + 0.5) / ry) ** 2 > 1.0 ||
            ((dx + 0.5) / rx) ** 2 + ((dy + 1.5) / ry) ** 2 > 1.0 ||
            ((dx + 0.5) / rx) ** 2 + ((dy - 0.5) / ry) ** 2 > 1.0;
          if (outside) {
            this.set(cx + dx, cy + dy, color);
          }
        }
      }
    }
  }

  fillTriangle(x1, y1, x2, y2, x3, y3, color) {
    const minX = Math.floor(Math.min(x1, x2, x3));
    const maxX = Math.ceil(Math.max(x1, x2, x3));
    const minY = Math.floor(Math.min(y1, y2, y3));
    const maxY = Math.ceil(Math.max(y1, y2, y3));
    const area = (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    if (area === 0) {
      return;
    }
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d1 = ((x - x3) * (y2 - y3) - (x2 - x3) * (y - y3)) / area;
        const d2 = ((x - x1) * (y3 - y1) - (x3 - x1) * (y - y1)) / area;
        const d3 = 1 - d1 - d2;
        if (d1 >= 0 && d2 >= 0 && d3 >= 0) {
          this.set(x, y, color);
        }
      }
    }
  }

  line(x0, y0, x1, y1, color) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x, y, color);
      if (x === ex && y === ey) {
        break;
      }
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Soft radial glow used sparingly for emissive pixels. */
  glow(cx, cy, radius, color, strength = 0.5) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist > radius) {
          continue;
        }
        const falloff = 1 - dist / radius;
        this.blend(cx + dx, cy + dy, [
          color[0],
          color[1],
          color[2],
          Math.round(255 * strength * falloff),
        ]);
      }
    }
  }

  /** Copy another surface into this one at an offset (nearest neighbour). */
  blit(src, dx, dy) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const c = src.get(x, y);
        if (c[3] > 0) {
          this.set(dx + x, dy + y, c);
        }
      }
    }
  }

  /** Nearest-neighbour upscale by an integer factor. */
  scaled(factor) {
    const out = new Px(this.width * factor, this.height * factor);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.get(x, y);
        for (let fy = 0; fy < factor; fy++) {
          for (let fx = 0; fx < factor; fx++) {
            out.set(x * factor + fx, y * factor + fy, c);
          }
        }
      }
    }
    return out;
  }
}

module.exports = { encodePNG, hexToRgb, Px };
