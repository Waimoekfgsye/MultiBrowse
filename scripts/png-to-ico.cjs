/**
 * Generate a proper ICO file for electron-builder + NSIS.
 * - 16x16, 32x32, 48x48: raw BMP (NSIS-compatible)
 * - 256x256: raw BMP (electron-builder requires 256x256 minimum)
 * 
 * Draws the MultiBrowse shield+checkmark logo procedurally.
 */
const fs = require('fs');
const path = require('path');

const outputPath = process.argv[3] || path.join(__dirname, '..', 'build', 'icon.ico');
const outDir = path.dirname(outputPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Brand colors
const GOLD = { r: 0xe8, g: 0xd4, b: 0x4d, a: 0xff };
const DARK = { r: 0x0a, g: 0x0a, b: 0x0f, a: 0xff };
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2);
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function drawShieldIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const s = size / 48;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / s;
      const ny = y / s;

      // Round rect background
      const margin = 2;
      const radius = 10;
      const rx = nx - margin;
      const ry = ny - margin;
      const rw = 48 - margin * 2;
      const rh = 48 - margin * 2;
      let insideRoundRect = false;

      if (rx >= 0 && rx <= rw && ry >= 0 && ry <= rh) {
        const inCorner = (
          (rx < radius && ry < radius && dist(rx, ry, radius, radius) > radius) ||
          (rx > rw - radius && ry < radius && dist(rx, ry, rw - radius, radius) > radius) ||
          (rx < radius && ry > rh - radius && dist(rx, ry, radius, rh - radius) > radius) ||
          (rx > rw - radius && ry > rh - radius && dist(rx, ry, rw - radius, rh - radius) > radius)
        );
        insideRoundRect = !inCorner;
      }

      let color = TRANSPARENT;

      if (insideRoundRect) {
        const shieldCx = 24;
        const shieldTop = 8;
        const shieldBot = 40;
        const shieldHalfW = 13;
        const relY = (ny - shieldTop) / (shieldBot - shieldTop);

        let shieldWidth = 0;
        if (relY >= 0 && relY <= 1) {
          if (relY < 0.55) {
            shieldWidth = shieldHalfW;
          } else {
            const taper = (relY - 0.55) / 0.45;
            shieldWidth = shieldHalfW * (1 - taper * taper);
          }
        }

        const distFromCenter = Math.abs(nx - shieldCx);
        const edgeThickness = size >= 128 ? 1.2 : (size > 20 ? 1.8 : 2.5);
        const onShieldEdge = shieldWidth > 0 && Math.abs(distFromCenter - shieldWidth) < edgeThickness;
        const onShieldTop = relY >= -0.02 && relY <= 0.02 && distFromCenter < shieldWidth;
        const insideShield = shieldWidth > 0 && distFromCenter < shieldWidth;

        if (onShieldEdge || onShieldTop) {
          color = GOLD;
        } else if (insideShield) {
          const checkThickness = size >= 128 ? 1.2 : (size > 20 ? 1.8 : 2.2);
          const cd1 = distToSegment(nx, ny, 18, 26, 22, 30);
          const cd2 = distToSegment(nx, ny, 22, 30, 31, 19);
          color = (cd1 < checkThickness || cd2 < checkThickness) ? GOLD : DARK;
        } else {
          color = DARK;
        }
      }

      // ICO BMP is bottom-up, BGRA
      const row = (size - 1 - y);
      const offset = (row * size + x) * 4;
      pixels[offset] = color.b;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.r;
      pixels[offset + 3] = color.a;
    }
  }

  return pixels;
}

function createBmpEntry(size) {
  const pixels = drawShieldIcon(size);
  const bitmapDataSize = size * size * 4;

  // BITMAPINFOHEADER — 40 bytes
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);  // doubled for ICO (includes AND mask height)
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(bitmapDataSize, 20);

  // AND mask — 1 bit per pixel, rows padded to 4 bytes
  const andRowBytes = Math.ceil(size / 8);
  const andRowPadded = Math.ceil(andRowBytes / 4) * 4;
  const andMask = Buffer.alloc(andRowPadded * size, 0);

  return Buffer.concat([header, pixels, andMask]);
}

// Generate ICO with 4 sizes (256 required by electron-builder)
const sizes = [16, 32, 48, 256];
const entries = sizes.map(size => createBmpEntry(size));

// ICO file header
const numImages = sizes.length;
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(numImages, 4);

// Directory entries
let dataOffset = 6 + numImages * 16;
const directory = Buffer.alloc(numImages * 16);

for (let i = 0; i < numImages; i++) {
  const size = sizes[i];
  const entryData = entries[i];

  // ICO spec: 0 means 256
  directory.writeUInt8(size < 256 ? size : 0, i * 16);
  directory.writeUInt8(size < 256 ? size : 0, i * 16 + 1);
  directory.writeUInt8(0, i * 16 + 2);
  directory.writeUInt8(0, i * 16 + 3);
  directory.writeUInt16LE(1, i * 16 + 4);
  directory.writeUInt16LE(32, i * 16 + 6);
  directory.writeUInt32LE(entryData.length, i * 16 + 8);
  directory.writeUInt32LE(dataOffset, i * 16 + 12);

  dataOffset += entryData.length;
}

const ico = Buffer.concat([icoHeader, directory, ...entries]);
fs.writeFileSync(outputPath, ico);
console.log('ICO created: ' + outputPath + ' (' + ico.length + ' bytes, sizes: ' + sizes.join(', ') + 'px)');
