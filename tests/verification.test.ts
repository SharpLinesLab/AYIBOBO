import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uploadForm } from './fixtures';
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
const ask = (c: Client, message?: string) => c.post('/api/account/verification', message === undefined ? {} : { message });
const mine = async () => (await (await artist.get('/api/account/verification')).json()).request;
const queue = async () => (await (await admin.get('/api/admin/verification')).json()).requests as { id: string; userId: string; artistName: string; message: string | null }[];
const me = async (c: Client) => (await (await c.get('/api/auth/me')).json()).user;

beforeAll(async () => {
  srv = await startServer();
  artist = await account('artist', 'tiga@example.com', 'tiga account');
  listener = await account('listener', 'fan@example.com', 'fan');
  admin = await account('listener', 'boss@example.com', 'boss');
  srv.db.sql.prepare("UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'").run();
});
afterAll(() => srv.close());

describe('artist verification', () => {
  it('starts unverified, with no request', async () => {
    expect((await me(artist)).verified).toBe(false);
    expect(await mine()).toBeNull();
  });

  it('is for artists (and admins) only', async () => {
    expect((await ask(listener)).status).toBe(403);
    expect((await ask(srv.client())).status).toBe(401);
    expect((await listener.get('/api/account/verification')).status).toBe(403);
  });

  it('allows one pending request at a time, with optional proof up to 1000 characters', async () => {
    const tooLong = await ask(artist, 'x'.repeat(1001));
    expect([tooLong.status, (await tooLong.json()).code]).toEqual([400, 'invalid_message']);
    const r = await ask(artist, ' instagram.com/tiga\npress: example.com/story ');
    expect(r.status).toBe(201);
    expect((await r.json()).request).toMatchObject({ status: 'pending', message: 'instagram.com/tiga\npress: example.com/story', reviewedAt: null });
    const again = await ask(artist);
    expect([again.status, (await again.json()).code]).toEqual([409, 'already_pending']);
    expect(await mine()).toMatchObject({ status: 'pending' });
  });

  it('is reviewed by admins only', async () => {
    for (const c of [srv.client(), listener, artist]) {
      expect((await c.get('/api/admin/verification')).status).toBe(404);
      expect((await c.post('/api/admin/verification/whatever/approve')).status).toBe(404);
    }
    const [req] = await queue();
    expect(req).toMatchObject({ artistName: 'tiga account', displayName: 'tiga account', email: 'tiga@example.com', bio: null, avatarUrl: null, message: 'instagram.com/tiga\npress: example.com/story', status: 'pending' });
    expect(typeof (req as unknown as { requestedAt: number }).requestedAt).toBe('number');
  });

  it('can be rejected, and the artist can then ask again', async () => {
    const [req] = await queue();
    expect((await admin.post(`/api/admin/verification/${req.id}/reject`)).status).toBe(200);
    expect((await admin.post(`/api/admin/verification/${req.id}/reject`)).status).toBe(409);
    expect(await mine()).toMatchObject({ id: req.id, status: 'rejected' });
    expect((await me(artist)).verified).toBe(false);
    expect(await queue()).toEqual([]);
    expect((await ask(artist, 'Second try')).status).toBe(201);
  });

  it('marks the account verified when approved, in the account and in the catalog', async () => {
    // A published song, so the artist is in the catalog.
    const up = await artist.send('/api/uploads', { method: 'POST', body: uploadForm() });
    await admin.post(`/api/admin/uploads/${(await up.json()).upload.id}/approve`);
    const artistInCatalog = async () => (await (await fetch(`${srv.base}/api/catalog/uploads`)).json()).tracks[0].artist;
    expect((await artistInCatalog()).verified).toBe(false);

    const [req] = await queue();
    expect(req.message).toBe('Second try');
    expect((await admin.post(`/api/admin/verification/${req.id}/approve`)).status).toBe(200);
    expect((await me(artist)).verified).toBe(true);
    expect(await mine()).toMatchObject({ status: 'approved' });
    expect((await artistInCatalog()).verified).toBe(true);
    const again = await ask(artist);
    expect([again.status, (await again.json()).code]).toEqual([409, 'already_verified']);
  });
});
