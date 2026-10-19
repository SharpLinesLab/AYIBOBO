/** Tiny files with the right leading bytes for each format (enough for the content checks). */
const pad = (head: number[] | string, total = 2048) => {
  const b = Buffer.alloc(total, 0x11);
  (typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head)).copy(b);
  return b;
};

export const FILES = {
  mp3: pad('ID3\u0004\u0000'),
  mp3Frame: pad([0xff, 0xfb, 0x90, 0x64]),
  wav: pad('RIFF\u0000\u0010\u0000\u0000WAVEfmt '),
  ogg: pad('OggS\u0000\u0002'),
  m4a: pad('\u0000\u0000\u0000 ftypM4A \u0000\u0000\u0000\u0000'),
  png: pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: pad([0xff, 0xd8, 0xff, 0xe0]),
  webp: pad('RIFF\u0000\u0010\u0000\u0000WEBPVP8 '),
  text: pad('This is definitely not audio, even though it is called song.mp3'),
};

export function uploadForm(parts: { audio?: Buffer | null; cover?: Buffer | null; audioName?: string; fields?: Record<string, string> } = {}): FormData {
  const f = new FormData();
  const fields = { title: 'Lanmou Lakay', artistName: 'Tiga', genre: 'kompa', duration: '183.4', peaks: JSON.stringify([0.2, 0.9, 0.5]), ...parts.fields };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  const audio = parts.audio === undefined ? FILES.mp3 : parts.audio;
  const cover = parts.cover === undefined ? FILES.png : parts.cover;
  if (audio) f.append('audio', new Blob([new Uint8Array(audio)], { type: 'audio/mpeg' }), parts.audioName ?? 'song.mp3');
  if (cover) f.append('cover', new Blob([new Uint8Array(cover)], { type: 'image/png' }), 'cover.png');
  return f;
}
