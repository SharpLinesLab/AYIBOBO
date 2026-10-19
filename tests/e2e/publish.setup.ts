import { execFileSync } from 'node:child_process';
import { expect, test as setup } from '@playwright/test';
import { ARTIST_A, ARTIST_B, BASE_URL, SERVER_ENV, SONGS, SONG_GENRE, SONG_SECONDS } from './data';
import { png, wav } from './media';

/**
 * Publish the test songs (see data.ts) the way real ones are: artist accounts upload them and an
 * admin approves them. Safe to run again against the same database: anything already there stays.
 */
const PASSWORD = 'e2e long enough password';

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
    form.append('artistName', s.artist);
    if ('featured' in s) form.append('featuredArtists', s.featured);
    if ('explicit' in s) form.append('explicit', '1');
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
