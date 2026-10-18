import { readdirSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sniffAudio, sniffImage } from '../server/uploads';
import { FILES, uploadForm } from './fixtures';
import { startServer, type Client } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;
let artist: Client;
let listener: Client;

async function account(role: 'artist' | 'listener', email: string) {
  const c = srv.client();
  const r = await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: email.split('@')[0], role });
  expect(r.status).toBe(201);
  return c;
}
const upload = (c: Client, form = uploadForm()) => c.send('/api/uploads', { method: 'POST', body: form });
const files = (dir: string) => readdirSync(join(srv.uploadsDir, dir));

beforeAll(async () => {
  srv = await startServer({ uploadLimits: { audio: 4096, cover: 3000 } });
  artist = await account('artist', 'tiga@example.com');
  listener = await account('listener', 'fan@example.com');
});
afterAll(() => srv.close());

describe('file type checks', () => {
  it('recognizes audio and images by content', () => {
    expect(sniffAudio(FILES.mp3)).toBe('audio/mpeg');
    expect(sniffAudio(FILES.mp3Frame)).toBe('audio/mpeg');
    expect(sniffAudio(FILES.wav)).toBe('audio/wav');
    expect(sniffAudio(FILES.ogg)).toBe('audio/ogg');
    expect(sniffAudio(FILES.m4a)).toBe('audio/mp4');
    for (const f of [FILES.text, FILES.png, FILES.webp, FILES.jpg]) expect(sniffAudio(f)).toBeNull();
    expect(sniffImage(FILES.png)).toBe('image/png');
    expect(sniffImage(FILES.jpg)).toBe('image/jpeg');
    expect(sniffImage(FILES.webp)).toBe('image/webp');
    for (const f of [FILES.text, FILES.mp3, FILES.wav]) expect(sniffImage(f)).toBeNull();
  });
});

describe('POST /api/uploads', () => {
  it('requires an artist (or admin) session', async () => {
    expect((await upload(srv.client())).status).toBe(401);
    expect((await upload(listener)).status).toBe(403);
    expect((await srv.client().get('/api/uploads/mine')).status).toBe(401);
    expect((await listener.get('/api/uploads/mine')).status).toBe(403);
  });

  it('stores an artist upload as pending', async () => {
    const r = await upload(artist);
    expect(r.status).toBe(201);
    const { upload: u } = await r.json();
    expect(u).toMatchObject({ title: 'Lanmou Lakay', genre: 'kompa', status: 'pending', duration: 183.4 });
    expect(files('audio')).toContain(u.id);
    expect(files('covers')).toContain(u.id);
    expect(files('tmp')).toEqual([]);
    const mine = await (await artist.get('/api/uploads/mine')).json();
    expect(mine.uploads.map((x: { id: string }) => x.id)).toContain(u.id);
  });

  it('accepts MP3, WAV, M4A and OGG and every cover format', async () => {
    for (const [audio, cover] of [
      [FILES.wav, FILES.jpg],
      [FILES.m4a, FILES.webp],
      [FILES.ogg, FILES.png],
      [FILES.mp3Frame, FILES.png],
    ]) {
      expect((await upload(artist, uploadForm({ audio, cover }))).status).toBe(201);
    }
  });

  it('checks file contents, not names, and leaves nothing behind when it refuses', async () => {
    const before = [files('audio').length, files('covers').length];
    const cases: [Parameters<typeof uploadForm>[0], number, string][] = [
      [{ audio: FILES.text, audioName: 'song.mp3' }, 415, 'invalid_audio'],
      [{ audio: FILES.png, audioName: 'song.wav' }, 415, 'invalid_audio'],
      [{ cover: FILES.mp3 }, 415, 'invalid_cover'],
      [{ audio: Buffer.concat([FILES.mp3, Buffer.alloc(4096)]) }, 413, 'audio_too_large'],
      [{ cover: Buffer.concat([FILES.png, Buffer.alloc(2048)]) }, 413, 'cover_too_large'],
      [{ audio: null }, 400, 'missing_audio'],
      [{ cover: null }, 400, 'missing_cover'],
      [{ fields: { title: '  ' } }, 400, 'invalid_title'],
      [{ fields: { genre: 'polka' } }, 400, 'invalid_genre'],
      [{ fields: { duration: 'abc' } }, 400, 'invalid_duration'],
    ];
    for (const [form, status, code] of cases) {
      const r = await upload(artist, uploadForm(form));
      expect(r.status, code).toBe(status);
      expect((await r.json()).code).toBe(code);
    }
    expect([files('audio').length, files('covers').length]).toEqual(before);
    expect(files('tmp')).toEqual([]);
  });

  it('refuses non-multipart bodies and oversized requests up front', async () => {
    expect((await artist.post('/api/uploads', { title: 'x' })).status).toBe(415);
    // Declares 10 MB (over audio + cover caps): refused before any of the body is read.
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(`${srv.base}/api/uploads`, {
        method: 'POST',
        headers: { cookie: artist.cookie, 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(10 * 1024 * 1024) },
      });
      req.on('response', (res) => {
        resolve(res.statusCode ?? 0);
        req.destroy();
      });
      req.on('error', reject);
      req.write('--x\r\n');
    });
    expect(status).toBe(413);
  });

  it('cleans up when the client disconnects mid-upload', async () => {
    const req = request(`${srv.base}/api/uploads`, {
      method: 'POST',
      headers: { cookie: artist.cookie, 'content-type': 'multipart/form-data; boundary=XX', 'content-length': '100000' },
    });
    req.on('error', () => {});
    req.write('--XX\r\nContent-Disposition: form-data; name="audio"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\nID3' + 'a'.repeat(1000));
    await expect.poll(() => files('tmp').length).toBe(1); // being written
    req.destroy();
    await expect.poll(() => files('tmp')).toEqual([]);
  });

  it('only shows each artist their own uploads', async () => {
    const other = await account('artist', 'other@example.com');
    expect((await (await other.get('/api/uploads/mine')).json()).uploads).toEqual([]);
  });
});
