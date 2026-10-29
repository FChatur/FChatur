/// <reference types="node" />
import { deflateSync } from 'node:zlib';
import type { Bitmap } from '../../src/art/bitmap';

/** Minimal PNG encoder (RGBA, 8-bit) for art review tools. Optional nearest-neighbour upscaling. */
export function encodePng(b: Bitmap, scale = 1): Buffer {
  const w = b.w * scale;
  const h = b.h * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const si = (Math.floor(y / scale) * b.w + Math.floor(x / scale)) * 4;
      raw.set(b.data.subarray(si, si + 4), row + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Animated PNG (APNG): every frame the same size, `delays` in milliseconds, looping forever. */
export function encodeApng(frames: Bitmap[], delays: number[], scale = 1): Buffer {
  const w = frames[0].w * scale;
  const h = frames[0].h * scale;
  const raw = (b: Bitmap) => {
    const out = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
      const row = y * (w * 4 + 1);
      for (let x = 0; x < w; x++) {
        const si = (Math.floor(y / scale) * b.w + Math.floor(x / scale)) * 4;
        out.set(b.data.subarray(si, si + 4), row + 1 + x * 4);
      }
    }
    return deflateSync(out);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  actl.writeUInt32BE(0, 4);
  const chunks = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('acTL', actl)];
  let seq = 0;
  frames.forEach((f, i) => {
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(w, 4);
    fctl.writeUInt32BE(h, 8);
    fctl.writeUInt32BE(0, 12);
    fctl.writeUInt32BE(0, 16);
    fctl.writeUInt16BE(delays[i] ?? 100, 20);
    fctl.writeUInt16BE(1000, 22);
    fctl[24] = 0; // dispose: none
    fctl[25] = 0; // blend: source (replace)
    chunks.push(chunk('fcTL', fctl));
    const data = raw(f);
    if (i === 0) chunks.push(chunk('IDAT', data));
    else {
      const seqBuf = Buffer.alloc(4);
      seqBuf.writeUInt32BE(seq++, 0);
      chunks.push(chunk('fdAT', Buffer.concat([seqBuf, data])));
    }
  });
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}
