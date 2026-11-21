// Временные иконки: белая шайба на тёмно-синем фоне. Запуск: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const cx = size / 2, cy = size / 2, r = size * 0.32, h = size * 0.07;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const puck = dx * dx + dy * dy <= r * r;
      const stick = Math.abs(dy + dx * 0.6) < h && dx > r * 0.6 && dx < size * 0.46;
      const [R, G, B] = puck || stick ? [255, 255, 255] : [11, 42, 74];
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = R; raw[o + 1] = G; raw[o + 2] = B;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [180, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), png(s));
