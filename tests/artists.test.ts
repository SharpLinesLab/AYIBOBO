import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Db, MIGRATIONS } from '../server/db';
import { FILES, uploadForm } from './fixtures';
import { startServer, type Client } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;
let artist: Client;
let listener: Client;
let admin: Client;

async function account(role: 'artist' | 'listener', email: string, displayName: string) {
  const c = srv.client();
  expect((await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName, role })).status).toBe(201);
  return c;
}
const upload = (fields: Record<string, string>) => artist.send('/api/uploads', { method: 'POST', body: uploadForm({ fields }) });
const putProfile = (c: Client, body: unknown) => c.send('/api/account/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const picture = (file: Buffer, type = 'image/png') => {
  const f = new FormData();
  f.append('picture', new Blob([new Uint8Array(file)], { type }), 'me.png');
  return f;
};
const me = async (c: Client) => (await (await c.get('/api/auth/me')).json()).user;
const catalog = async () => (await (await fetch(`${srv.base}/api/catalog/uploads`)).json()).tracks;

beforeAll(async () => {
  srv = await startServer({ uploadLimits: { cover: 3000 } });
  artist = await account('artist', 'tiga@example.com', 'tiga account');
  listener = await account('listener', 'fan@example.com', 'fan');
  admin = await account('listener', 'boss@example.com', 'boss');
  srv.db.sql.prepare("UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'").run();
});
afterAll(() => srv.close());

describe('track artist, featured artists and explicit', () => {
  it('are stored with the upload and returned by every API that lists it', async () => {
    const r = await upload({ title: 'Lakay', artistName: 'Tiga Blaze', featuredArtists: 'Wendyyy, Joé Dwèt Filé', explicit: '1' });
    expect(r.status).toBe(201);
    const sent = (await r.json()).upload;
    const fields = { title: 'Lakay', artistName: 'Tiga Blaze', featuredArtists: 'Wendyyy, Joé Dwèt Filé', explicit: true };
    expect(sent).toMatchObject(fields);
    expect((await (await artist.get('/api/uploads/mine')).json()).uploads.find((u: { id: string }) => u.id === sent.id)).toMatchObject(fields);
    expect((await (await admin.get('/api/admin/uploads')).json()).uploads.find((u: { id: string }) => u.id === sent.id)).toMatchObject(fields);
    expect((await admin.post(`/api/admin/uploads/${sent.id}/approve`)).status).toBe(200);
    expect((await catalog()).find((t: { id: string }) => t.id === sent.id)).toMatchObject(fields);
  });

  it('are optional: no featured artists and not explicit by default', async () => {
    const sent = (await (await upload({ title: 'Solo', artistName: 'Tiga Blaze' })).json()).upload;
    expect(sent).toMatchObject({ artistName: 'Tiga Blaze', featuredArtists: null, explicit: false });
    const blank = (await (await upload({ title: 'Solo 2', artistName: 'Tiga Blaze', featuredArtists: '   ', explicit: '' })).json()).upload;
    expect(blank).toMatchObject({ featuredArtists: null, explicit: false });
  });

  it('require an artist name and cap the lengths', async () => {
    for (const [fields, code] of [
      [{ title: 'x', artistName: '' }, 'invalid_artist_name'],
      [{ title: 'x', artistName: '  ' }, 'invalid_artist_name'],
      [{ title: 'x', artistName: 'a'.repeat(101) }, 'invalid_artist_name'],
      [{ title: 'x', artistName: 'Tiga', featuredArtists: 'b'.repeat(201) }, 'invalid_featured'],
    ] as const) {
      const r = await upload(fields);
      expect(r.status, code).toBe(400);
      expect((await r.json()).code).toBe(code);
    }
    expect((await upload({ title: 'Edge', artistName: 'a'.repeat(100), featuredArtists: 'b'.repeat(200) })).status).toBe(201);
  });
});

describe('artist profile', () => {
  it('starts empty and is saved, cleared and returned with the account', async () => {
    expect(await me(artist)).toMatchObject({ artistName: null, bio: null, avatarUrl: null });
    const r = await putProfile(artist, { artistName: ' Tiga Blaze ', bio: 'Rap kreyòl from Okap.\nLive every Friday.' });
    expect(r.status).toBe(200);
    expect((await r.json()).user).toMatchObject({ artistName: 'Tiga Blaze', bio: 'Rap kreyòl from Okap.\nLive every Friday.' });
    expect(await me(artist)).toMatchObject({ artistName: 'Tiga Blaze', displayName: 'tiga account' });
    await putProfile(artist, { artistName: '', bio: '' });
    expect(await me(artist)).toMatchObject({ artistName: null, bio: null });
  });

  it('caps the name at 100 and the bio at 500 characters', async () => {
    expect((await (await putProfile(artist, { artistName: 'a'.repeat(101) })).json()).code).toBe('invalid_artist_name');
    expect((await (await putProfile(artist, { bio: 'b'.repeat(501) })).json()).code).toBe('invalid_bio');
    expect((await putProfile(artist, { artistName: 'a'.repeat(100), bio: 'b'.repeat(500) })).status).toBe(200);
  });

  it('is for artists only', async () => {
    expect((await putProfile(listener, { artistName: 'Fan' })).status).toBe(403);
    expect((await putProfile(srv.client(), { artistName: 'Nobody' })).status).toBe(401);
    expect((await listener.send('/api/account/avatar', { method: 'POST', body: picture(FILES.png) })).status).toBe(403);
  });

  it('takes a picture (checked by content and size) and serves it publicly', async () => {
    const bad = await artist.send('/api/account/avatar', { method: 'POST', body: picture(FILES.text) });
    expect([bad.status, (await bad.json()).code]).toEqual([415, 'invalid_picture']);
    const big = await artist.send('/api/account/avatar', { method: 'POST', body: picture(Buffer.concat([FILES.png, Buffer.alloc(4000)])) });
    expect([big.status, (await big.json()).code]).toEqual([413, 'picture_too_large']);

    const r = await artist.send('/api/account/avatar', { method: 'POST', body: picture(FILES.png) });
    expect(r.status).toBe(200);
    const { avatarUrl } = (await r.json()).user;
    expect(avatarUrl).toMatch(/^\/api\/artists\/[\w-]+\/avatar\?v=\d+$/);
    const served = await fetch(srv.base + avatarUrl);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await served.arrayBuffer()).equals(FILES.png)).toBe(true);
    expect((await fetch(`${srv.base}/api/artists/nobody/avatar`)).status).toBe(404);
  });

  it('removes the picture, file and all', async () => {
    const before = (await me(artist)).avatarUrl;
    expect(before).toBeTruthy();
    expect((await listener.send('/api/account/avatar', { method: 'DELETE' })).status).toBe(403);
    const r = await artist.send('/api/account/avatar', { method: 'DELETE' });
    expect(r.status).toBe(200);
    expect((await r.json()).user.avatarUrl).toBeNull();
    expect((await fetch(srv.base + before)).status).toBe(404);
    expect(existsSync(join(srv.uploadsDir, 'avatars', (await me(artist)).id))).toBe(false);
    // A new picture can be added again afterwards.
    expect((await artist.send('/api/account/avatar', { method: 'POST', body: picture(FILES.png) })).status).toBe(200);
  });

  it('names, describes and pictures the artist in the catalog, while each song keeps its own credit', async () => {
    await putProfile(artist, { artistName: 'Tiga Blaze', bio: 'Rap kreyòl from Okap.' });
    const user = await me(artist);
    const track = (await catalog())[0];
    expect(track.artist).toEqual({ name: 'Tiga Blaze', bio: 'Rap kreyòl from Okap.', avatarUrl: user.avatarUrl });
    await putProfile(artist, { artistName: 'Someone Else' });
    expect((await catalog())[0]).toMatchObject({ artistName: 'Tiga Blaze', artist: { name: 'Someone Else' } });
  });
});

describe('migration 6', () => {
  it('backfills existing uploads with the uploader\'s display name', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'asf-db-')), 'asf.db');
    const old = new DatabaseSync(file);
    for (const m of MIGRATIONS.slice(0, 5)) old.exec(m);
    old.exec('PRAGMA user_version = 5');
    old.exec(`INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES ('u1', 'a@example.com', 'x', 'artist', 'Lavi Soley', 1)`);
    old.exec(`INSERT INTO uploads (id, user_id, title, genre, status, audio_type, audio_size, cover_type, cover_size, duration, created_at)
              VALUES ('s1', 'u1', 'Old Song', 'kompa', 'approved', 'audio/mpeg', 1, 'image/png', 1, 100, 1)`);
    old.close();

    const db = new Db(file);
    await db.init();
    expect(db.sql.prepare('SELECT artist_name, featured_artists, explicit FROM uploads').get()).toEqual({ artist_name: 'Lavi Soley', featured_artists: null, explicit: 0 });
    expect(db.sql.prepare('SELECT artist_name, bio, avatar_type FROM users').get()).toEqual({ artist_name: null, bio: null, avatar_type: null });
    db.close();
  });
});
