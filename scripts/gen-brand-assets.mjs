/**
 * Generates branded app artwork (icons + splash) with zero image dependencies.
 * Pure-Node PNG writer: sky gradient, sun, floating island emblem.
 *
 * Usage: node scripts/gen-brand-assets.mjs
 * Outputs:
 *   resources/icon-1024.png, icon-512.png, icon-192.png ...... PWA + store
 *   resources/splash-port.png (1080x1920), splash-land.png (1920x1080)
 *   android mipmap dirs: ic_launcher PNGs ................. launcher icons
 *   android drawable dirs: splash.png ...................... splash screens
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- minimal PNG writer (RGBA8) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
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
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- tiny raster helpers ----------
function makeCanvas(w, h) {
  return { w, h, px: new Uint8ClampedArray(w * h * 4) };
}

function fill(c, r, g, b, a = 255) {
  const { w, h, px } = c;
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = r;
    px[i * 4 + 1] = g;
    px[i * 4 + 2] = b;
    px[i * 4 + 3] = a;
  }
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function skyGradient(c, top, bottom) {
  const { w, h, px } = c;
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const r = lerp(top[0], bottom[0], t);
    const g = lerp(top[1], bottom[1], t);
    const b = lerp(top[2], bottom[2], t);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
}

function disc(c, cx, cy, rad, r, g, b, a = 255) {
  const { w, h, px } = c;
  for (let y = Math.max(0, cy - rad); y < Math.min(h, cy + rad); y++) {
    for (let x = Math.max(0, cx - rad); x < Math.min(w, cx + rad); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) {
        const i = (Math.floor(y) * w + Math.floor(x)) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = a;
      }
    }
  }
}

function ellipse(c, cx, cy, rx, ry, r, g, b, a = 255) {
  const { w, h, px } = c;
  for (let y = Math.max(0, cy - ry); y < Math.min(h, cy + ry); y++) {
    for (let x = Math.max(0, cx - rx); x < Math.min(w, cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const i = (Math.floor(y) * w + Math.floor(x)) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = a;
      }
    }
  }
}

// Garden-island emblem centered at (cx, cy) with unit size s.
function emblem(c, cx, cy, s) {
  // sun
  disc(c, cx + s * 0.52, cy - s * 0.52, s * 0.2, 255, 200, 87);
  disc(c, cx + s * 0.52, cy - s * 0.52, s * 0.13, 255, 224, 130);
  // clouds
  ellipse(c, cx - s * 0.55, cy - s * 0.35, s * 0.28, s * 0.11, 255, 255, 255, 230);
  ellipse(c, cx + s * 0.05, cy + s * 0.62, s * 0.24, s * 0.1, 255, 255, 255, 200);
  // island rock underside
  ellipse(c, cx, cy + s * 0.34, s * 0.52, s * 0.3, 110, 74, 44);
  ellipse(c, cx, cy + s * 0.4, s * 0.36, s * 0.24, 84, 55, 32);
  // grass top
  ellipse(c, cx, cy + s * 0.12, s * 0.56, s * 0.2, 82, 209, 43);
  ellipse(c, cx, cy + s * 0.08, s * 0.5, s * 0.15, 106, 226, 63);
  // crops: little sprout rows
  for (const [ox, oy] of [
    [-0.3, 0.02],
    [-0.1, -0.02],
    [0.12, 0.0],
    [0.32, 0.04],
  ]) {
    disc(c, cx + ox * s, cy + oy * s, s * 0.045, 46, 125, 50);
    disc(c, cx + ox * s, cy + (oy - 0.05) * s, s * 0.03, 251, 146, 60);
  }
}

function save(c, path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(c.w, c.h, c.px));
  console.log('wrote', path);
}

function nearest(src, w, h) {
  const out = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.w - 1, Math.floor((x * src.w) / w));
      const sy = Math.min(src.h - 1, Math.floor((y * src.h) / h));
      const si = (sy * src.w + sx) * 4;
      const di = (y * w + x) * 4;
      out.px[di] = src.px[si];
      out.px[di + 1] = src.px[si + 1];
      out.px[di + 2] = src.px[si + 2];
      out.px[di + 3] = src.px[si + 3];
    }
  }
  return out;
}

// ---------- master icon 1024 ----------
const icon = makeCanvas(1024, 1024);
skyGradient(icon, [41, 182, 246], [8, 47, 73]);
emblem(icon, 512, 512, 640);
save(icon, join(root, 'resources/icon-1024.png'));
save(nearest(icon, 512, 512), join(root, 'resources/icon-512.png'));
save(nearest(icon, 192, 192), join(root, 'resources/icon-192.png'));

// ---------- splash: emblem centered on deep background ----------
function splash(w, h) {
  const c = makeCanvas(w, h);
  fill(c, 8, 47, 73);
  const s = Math.min(w, h) * 0.5;
  emblem(c, w / 2, h / 2 - s * 0.08, s);
  return c;
}
const splashPort = splash(1080, 1920);
const splashLand = splash(1920, 1080);
save(splashPort, join(root, 'resources/splash-port.png'));
save(splashLand, join(root, 'resources/splash-land.png'));

// ---------- android mipmap icons ----------
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// adaptive foreground is 108dp canvas
const fgDp = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [d, size] of Object.entries(densities)) {
  const dir = join(root, `android/app/src/main/res/mipmap-${d}`);
  save(nearest(icon, size, size), join(dir, 'ic_launcher.png'));
  save(nearest(icon, size, size), join(dir, 'ic_launcher_round.png'));
  // foreground: emblem centered on transparent 108dp canvas
  const fg = makeCanvas(fgDp[d], fgDp[d]);
  const tmp = makeCanvas(1024, 1024);
  skyGradient(tmp, [41, 182, 246], [8, 47, 73]);
  emblem(tmp, 512, 512, 640);
  const scaled = nearest(tmp, fgDp[d], fgDp[d]);
  save(scaled, join(dir, 'ic_launcher_foreground.png'));
}

// ---------- android splash drawables ----------
const res = join(root, 'android/app/src/main/res');
const portDirs = ['drawable', 'drawable-port-mdpi', 'drawable-port-hdpi', 'drawable-port-xhdpi', 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi'];
const landDirs = ['drawable-land-mdpi', 'drawable-land-hdpi', 'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi'];
for (const d of portDirs) save(splashPort, join(res, d, 'splash.png'));
for (const d of landDirs) save(splashLand, join(res, d, 'splash.png'));

console.log('done.');
