import { crc32, deflateSync } from 'node:zlib';
import { SONG_SECONDS } from './data';

const RATE = 22_050;

/** A quiet two-note tone, as 16-bit mono WAV, so the browser has real audio to decode and play. */
export function wav(seed: number): { file: Buffer; peaks: number[] } {
  const n = RATE * SONG_SECONDS;
  const file = Buffer.alloc(44 + n * 2);
  file.write('RIFF', 0, 'latin1');
  file.writeUInt32LE(36 + n * 2, 4);
  file.write('WAVEfmt ', 8, 'latin1');
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20); // PCM
  file.writeUInt16LE(1, 22); // mono
  file.writeUInt32LE(RATE, 24);
  file.writeUInt32LE(RATE * 2, 28);
  file.writeUInt16LE(2, 32);
  file.writeUInt16LE(16, 34);
  file.write('data', 36, 'latin1');
  file.writeUInt32LE(n * 2, 40);
  const peaks = new Array<number>(160).fill(0);
  for (let i = 0; i < n; i++) {
    const s = i / RATE;
    const level = 0.15 + 0.1 * Math.sin(s * 0.7 + seed);
    const v = level * (Math.sin(2 * Math.PI * (220 + seed * 20) * s) + 0.5 * Math.sin(2 * Math.PI * 330 * s)) / 1.5;
    file.writeInt16LE(Math.round(v * 32_767), 44 + i * 2);
    const p = Math.floor((i / n) * peaks.length);
    peaks[p] = Math.max(peaks[p], Math.abs(v));
  }
  const top = Math.max(...peaks);
  return { file, peaks: peaks.map((p) => Math.round((p / top) * 1000) / 1000) };
}

/** A solid-colour 64×64 PNG cover. */
export function png(rgb: [number, number, number]): Buffer {
  const size = 64;
  const row = Buffer.from([0, ...Array.from({ length: size }, () => rgb).flat()]);
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
