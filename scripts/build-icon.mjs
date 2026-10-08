// Generate the Windows ICO from our two-primitive SVG; no new dependency needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
const pointsText = /<polygon points="([^"]+)" fill="#ffffff"/.exec(svg)?.[1];
if (!pointsText || !svg.includes('rx="56" fill="#0284c7"')) throw new Error('Unsupported icon geometry.');
const points = pointsText.split(' ').map(point => point.split(',').map(Number));
function inside(x, y) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function png(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let red = 0, green = 0, blue = 0, alpha = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const px = (x + (sx + 0.5) / 4) * 256 / size;
      const py = (y + (sy + 0.5) / 4) * 256 / size;
      const dx = Math.max(64 - px, px - 192, 0), dy = Math.max(64 - py, py - 192, 0);
      if (dx * dx + dy * dy > 56 * 56) continue;
      const white = inside(px, py);
      red += white ? 255 : 2; green += white ? 255 : 132; blue += white ? 255 : 199;
      alpha++;
    }
    const offset = y * (1 + size * 4) + 1 + x * 4;
    if (alpha) {
      raw[offset] = Math.round(red / alpha); raw[offset + 1] = Math.round(green / alpha);
      raw[offset + 2] = Math.round(blue / alpha); raw[offset + 3] = Math.round(alpha * 255 / 16);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const sizes = [16, 32, 48, 256], images = sizes.map(png);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i] === 256 ? 0 : sizes[i]; header[entry + 1] = header[entry];
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([header, ...images]));
console.log('Generated build/icon.ico (16, 32, 48, 256 px).');
