import { execFileSync } from 'node:child_process';
import { crc32, deflateSync } from 'node:zlib';
import { expect, test as setup } from '@playwright/test';
import { ARTIST_A, ARTIST_B, BASE_URL, SERVER_ENV, SONGS, SONG_GENRE, SONG_SECONDS } from './data';

/**
 * Publish the test songs (see data.ts) the way real ones are: artist accounts upload them and an
 * admin approves them. Safe to run again against the same database: anything already there stays.
 */
const PASSWORD = 'e2e long enough password';
const RATE = 22_050;

/** A quiet two-note tone, as 16-bit mono WAV, so the browser has real audio to decode and play. */
function wav(seed: number): { file: Buffer; peaks: number[] } {
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
function png(rgb: [number, number, number]): Buffer {
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

/** Sign up (or, on a re-run, sign in) and return the session cookie. */
async function session(email: string, role: 'artist' | 'listener', displayName: string): Promise<string> {
  const post = (path: string, body: object) => fetch(`${BASE_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let res = await post('/api/auth/signup', { email, password: PASSWORD, displayName, role });
  if (res.status === 409) res = await post('/api/auth/login', { email, password: PASSWORD });
  expect(res.ok, `${email}: ${res.status}`).toBe(true);
  return res.headers.get('set-cookie')!.split(';')[0];
}

async function api<T>(path: string, cookie: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: { ...init.headers, cookie } });
  expect(res.ok, `${init.method ?? 'GET'} ${path}: ${res.status}`).toBe(true);
  return (await res.json()) as T;
}

setup('publish the test songs', async () => {
  const artists = {
    [ARTIST_A]: await session('artist-a@e2e.test', 'artist', ARTIST_A),
    [ARTIST_B]: await session('artist-b@e2e.test', 'artist', ARTIST_B),
  };
  // Accounts can't make themselves admins; the server's own command does it.
  const admin = await session('admin@e2e.test', 'listener', 'E2E Admin');
  execFileSync(process.execPath, ['dist-server/manage.js', 'set-role', 'admin@e2e.test', 'admin'], { env: { ...process.env, ...SERVER_ENV }, stdio: 'pipe' });

  type Item = { id: string; title: string };
  const pending = async () => (await api<{ uploads: Item[] }>('/api/admin/uploads', admin)).uploads;
  const approved = async () => (await api<{ tracks: Item[] }>('/api/catalog/uploads', admin)).tracks;
  const have = new Set([...(await pending()), ...(await approved())].map((u) => u.title));

  for (const [i, s] of SONGS.entries()) {
    if (have.has(s.title)) continue;
    const audio = wav(i);
    const form = new FormData();
    form.append('title', s.title);
    form.append('genre', SONG_GENRE);
    form.append('duration', String(SONG_SECONDS));
    form.append('peaks', JSON.stringify(audio.peaks));
    form.append('audio', new Blob([new Uint8Array(audio.file)], { type: 'audio/wav' }), `${s.title}.wav`);
    form.append('cover', new Blob([new Uint8Array(png([40 + i * 50, 120, 200 - i * 40]))], { type: 'image/png' }), 'cover.png');
    await api('/api/uploads', artists[s.artist], { method: 'POST', body: form });
  }
  const titles = new Set<string>(SONGS.map((s) => s.title));
  for (const u of await pending()) if (titles.has(u.title)) await api(`/api/admin/uploads/${u.id}/approve`, admin, { method: 'POST' });

  expect((await approved()).map((t) => t.title).sort()).toEqual([...titles].sort());
});
