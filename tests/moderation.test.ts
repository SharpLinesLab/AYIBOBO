import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseRange } from '../server/uploads';
import { FILES, uploadForm } from './fixtures';
import { startServer, type Client } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;
let artist: Client;
let listener: Client;
let admin: Client;

async function account(role: 'artist' | 'listener', email: string) {
  const c = srv.client();
  expect((await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: email.split('@')[0], role })).status).toBe(201);
  return c;
}
async function send(title: string, audio = FILES.mp3): Promise<string> {
  const r = await artist.send('/api/uploads', { method: 'POST', body: uploadForm({ audio, fields: { title } }) });
  expect(r.status).toBe(201);
  return (await r.json()).upload.id;
}
const catalog = async () => (await (await fetch(`${srv.base}/api/catalog/uploads`)).json()).tracks as { id: string; title: string; artistName: string; audioUrl: string; coverUrl: string }[];
const onDisk = (id: string) => existsSync(join(srv.uploadsDir, 'audio', id)) && existsSync(join(srv.uploadsDir, 'covers', id));

beforeAll(async () => {
  srv = await startServer();
  artist = await account('artist', 'tiga@example.com');
  listener = await account('listener', 'fan@example.com');
  admin = await account('listener', 'boss@example.com');
  srv.db.sql.prepare("UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'").run();
});
afterAll(() => srv.close());

describe('moderation', () => {
  it('keeps pending uploads out of the catalog and unservable', async () => {
    const id = await send('Still Pending');
    expect(await catalog()).toEqual([]);
    expect((await fetch(`${srv.base}/api/audio/${id}`)).status).toBe(404);
    expect((await fetch(`${srv.base}/api/covers/${id}`)).status).toBe(404);
  });

  it('answers 404 to everyone but admins', async () => {
    const id = await send('Not Yours To Approve');
    for (const c of [srv.client(), listener, artist]) {
      expect((await c.get('/api/admin/uploads')).status).toBe(404);
      expect((await c.get(`/api/admin/uploads/${id}/audio`)).status).toBe(404);
      expect((await c.post(`/api/admin/uploads/${id}/approve`)).status).toBe(404);
      expect((await c.post(`/api/admin/uploads/${id}/reject`)).status).toBe(404);
    }
    expect(await catalog()).toEqual([]);
  });

  it('lets an admin review, preview and approve', async () => {
    const id = await send('Soley Leve');
    const list = (await (await admin.get('/api/admin/uploads')).json()).uploads as { id: string; title: string; artistName: string; audioUrl: string; coverUrl: string }[];
    const item = list.find((u) => u.id === id)!;
    expect(item).toMatchObject({ title: 'Soley Leve', artistName: 'tiga', status: 'pending' });
    const preview = await admin.get(item.audioUrl);
    expect(preview.status).toBe(200);
    expect(Buffer.from(await preview.arrayBuffer()).equals(FILES.mp3)).toBe(true);
    expect((await admin.get(item.coverUrl)).headers.get('content-type')).toBe('image/png');

    expect((await admin.post(`/api/admin/uploads/${id}/approve`)).status).toBe(200);
    expect((await admin.post(`/api/admin/uploads/${id}/approve`)).status).toBe(409);
    const tracks = await catalog();
    expect(tracks.map((t) => t.id)).toEqual([id]);
    expect(tracks[0]).toMatchObject({ title: 'Soley Leve', artistName: 'tiga', audioUrl: `/api/audio/${id}`, coverUrl: `/api/covers/${id}` });
    const mine = (await (await artist.get('/api/uploads/mine')).json()).uploads as { id: string; status: string }[];
    expect(mine.find((u) => u.id === id)!.status).toBe('approved');
  });

  it('deletes rejected files from disk', async () => {
    const id = await send('Not This One');
    expect(onDisk(id)).toBe(true);
    expect((await admin.post(`/api/admin/uploads/${id}/reject`)).status).toBe(200);
    expect(onDisk(id)).toBe(false);
    expect((await admin.get(`/api/admin/uploads/${id}/audio`)).status).toBe(404);
    expect((await admin.post(`/api/admin/uploads/${id}/approve`)).status).toBe(409);
    expect((await catalog()).some((t) => t.id === id)).toBe(false);
    const mine = (await (await artist.get('/api/uploads/mine')).json()).uploads as { id: string; status: string }[];
    expect(mine.find((u) => u.id === id)!.status).toBe('rejected');
  });
});

describe('GET /api/audio/:id', () => {
  let id = '';
  const audio = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 251));
  audio.write('ID3', 0, 'latin1');

  beforeAll(async () => {
    id = await send('Range Test', audio);
    await admin.post(`/api/admin/uploads/${id}/approve`);
  });

  it('streams the whole file with caching and range headers', async () => {
    const r = await fetch(`${srv.base}/api/audio/${id}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('audio/mpeg');
    expect(r.headers.get('accept-ranges')).toBe('bytes');
    expect(r.headers.get('content-length')).toBe('5000');
    expect(r.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(Buffer.from(await r.arrayBuffer()).equals(audio)).toBe(true);
  });

  it('serves byte ranges so seeking works', async () => {
    const get = (range: string) => fetch(`${srv.base}/api/audio/${id}`, { headers: { range } });
    const cases: [string, number, number][] = [
      ['bytes=0-99', 0, 99],
      ['bytes=4000-', 4000, 4999],
      ['bytes=-500', 4500, 4999],
      ['bytes=4990-9999', 4990, 4999],
    ];
    for (const [range, start, end] of cases) {
      const r = await get(range);
      expect(r.status, range).toBe(206);
      expect(r.headers.get('content-range')).toBe(`bytes ${start}-${end}/5000`);
      expect(Buffer.from(await r.arrayBuffer()).equals(audio.subarray(start, end + 1)), range).toBe(true);
    }
    const bad = await get('bytes=6000-');
    expect(bad.status).toBe(416);
    expect(bad.headers.get('content-range')).toBe('bytes */5000');
  });

  it('answers HEAD and conditional requests without a body', async () => {
    const head = await fetch(`${srv.base}/api/audio/${id}`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe('5000');
    const etag = head.headers.get('etag')!;
    expect((await fetch(`${srv.base}/api/audio/${id}`, { headers: { 'if-none-match': etag } })).status).toBe(304);
  });

  it('parses ranges strictly', () => {
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange('bytes=0-0', 100)).toEqual({ start: 0, end: 0 });
    expect(parseRange('bytes=0-1,5-6', 100)).toBeNull();
    for (const bad of ['bytes=', 'bytes=-', 'bytes=-0', 'bytes=50-10', 'bytes=100-', 'items=0-1']) expect(parseRange(bad, 100), bad).toBe('invalid');
  });

  it('never serves unknown ids', async () => {
    for (const path of ['/api/audio/nope', '/api/audio/..%2F..%2Fasf.db', '/api/covers/nope']) expect((await fetch(srv.base + path)).status).toBe(404);
  });
});
