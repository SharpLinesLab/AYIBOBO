import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { royaltiesRepo } from '../server/royalties';
import { issueStrike, liftStrikes } from '../server/users';
import { startServer, type Client } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;
let admin: Client;
let artist: Client;
let listener: Client;
const ids: Record<string, string> = {};

async function account(email: string, role: 'artist' | 'listener') {
  const c = srv.client();
  const r = await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: email.split('@')[0], role });
  expect(r.status).toBe(201);
  ids[email.split('@')[0]] = (await r.json()).user.id;
  return c;
}
const user = async (id: string) => ((await (await admin.get('/api/admin/users')).json()).users as { id: string }[]).find((u) => u.id === id) as Record<string, unknown>;

beforeAll(async () => {
  srv = await startServer();
  admin = await account('boss@example.com', 'listener');
  srv.db.sql.prepare("UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'").run();
  artist = await account('star@example.com', 'artist');
  listener = await account('fan@example.com', 'listener');
});
afterAll(() => srv.close());

describe('admin overview and users', () => {
  it('is for admins only: everyone else gets 404', async () => {
    for (const c of [srv.client(), listener, artist]) {
      expect((await c.get('/api/admin/overview')).status).toBe(404);
      expect((await c.get('/api/admin/users')).status).toBe(404);
      for (const path of ['role', 'verified', 'strikes', 'strikes/lift']) expect((await c.post(`/api/admin/users/${ids.star}/${path}`, { role: 'admin', verified: true, reason: 'x' })).status).toBe(404);
    }
    expect((await user(ids.star)).role).toBe('artist');
  });

  it('counts what waits for review, accounts, and today’s streams and ad plays', async () => {
    const now = Date.now();
    srv.db.sql.prepare("INSERT INTO verification_requests (id, user_id, status, requested_at) VALUES ('v1', ?, 'pending', ?)").run(ids.star, now);
    srv.db.sql
      .prepare("INSERT INTO uploads (id, user_id, title, genre, status, audio_type, audio_size, cover_type, cover_size, duration, created_at, artist_name) VALUES ('u1', ?, 'x', 'kompa', 'pending', 'audio/mpeg', 1, 'image/png', 1, 100, ?, 'x')")
      .run(ids.star, now);
    const put = srv.db.sql.prepare("INSERT INTO royalty_plays (play_id, user_id, track_id, artist_id, played_at, seconds_listened, listener_tier) VALUES (?, ?, 'u1', ?, ?, ?, 'free')");
    put.run('p-today', ids.fan, ids.star, now, 31);
    put.run('p-short', ids.fan, ids.star, now, 10); // not a stream
    put.run('p-self', ids.star, ids.star, now, 60); // the artist's own play
    put.run('p-old', ids.fan, ids.star, now - 2 * 86_400_000, 60);
    expect(royaltiesRepo(srv.db).streamsBetween(0, now + 1)).toBe(2);
    srv.db.sql.prepare("INSERT INTO ads (id, title, advertiser_name, audio_type, audio_size, duration, created_at) VALUES ('a1', 'ad', 'shop', 'audio/mpeg', 1, 10, ?)").run(now);
    srv.db.sql.prepare("INSERT INTO ad_plays (ad_id, user_id, listener, played_at) VALUES ('a1', NULL, 'a:x', ?), ('a1', NULL, 'a:x', ?)").run(now, now - 2 * 86_400_000);
    const body = await (await admin.get('/api/admin/overview')).json();
    expect(body).toEqual({ ok: true, pendingUploads: 1, pendingVerifications: 1, users: 3, artists: 1, royaltyStreamsToday: 1, adPlaysToday: 1 });
  });

  it('lists every account, newest first, without password hashes', async () => {
    const body = await (await admin.get('/api/admin/users')).json();
    expect(body.total).toBe(3);
    expect(body.users.map((u: { email: string }) => u.email)).toEqual(['fan@example.com', 'star@example.com', 'boss@example.com']);
    expect(body.users[1]).toMatchObject({ id: ids.star, displayName: 'star', artistName: null, role: 'artist', verified: false, tier: 'free', activeStrikes: 0 });
    expect(typeof body.users[1].createdAt).toBe('number');
    expect(JSON.stringify(body)).not.toMatch(/password|hash/);
  });

  it('changes roles, but never the admin’s own', async () => {
    const r = await admin.post(`/api/admin/users/${ids.fan}/role`, { role: 'artist' });
    expect(r.status).toBe(200);
    expect((await r.json()).user).toMatchObject({ id: ids.fan, role: 'artist' });
    expect((await (await listener.get('/api/auth/me')).json()).user.role).toBe('artist'); // takes effect right away
    expect((await admin.post(`/api/admin/users/${ids.fan}/role`, { role: 'owner' })).status).toBe(400);
    const own = await admin.post(`/api/admin/users/${ids.boss}/role`, { role: 'listener' });
    expect([own.status, (await own.json()).code]).toEqual([409, 'own_role']);
    expect((await admin.post('/api/admin/users/nobody/role', { role: 'artist' })).status).toBe(404);
    expect((await admin.post(`/api/admin/users/${ids.fan}/role`, { role: 'listener' }, { origin: 'https://evil.example' })).status).toBe(403);
    await admin.post(`/api/admin/users/${ids.fan}/role`, { role: 'listener' });
    expect((await user(ids.fan)).role).toBe('listener');
  });

  it('sets and takes away the verified checkmark', async () => {
    expect((await admin.post(`/api/admin/users/${ids.star}/verified`, { verified: 'yes' })).status).toBe(400);
    expect((await (await admin.post(`/api/admin/users/${ids.star}/verified`, { verified: true })).json()).user.verified).toBe(true);
    expect((await (await artist.get('/api/auth/me')).json()).user.verified).toBe(true);
    expect((await (await admin.post(`/api/admin/users/${ids.star}/verified`, { verified: false })).json()).user.verified).toBe(false);
  });

  it('issues and lifts policy strikes, which block royalty eligibility while active', async () => {
    const status = () => royaltiesRepo(srv.db).status(ids.star, Date.now() + 1);
    expect((await admin.post(`/api/admin/users/${ids.star}/strikes`, { reason: '  ' })).status).toBe(400);
    expect((await admin.post(`/api/admin/users/${ids.star}/strikes`, { reason: 'x'.repeat(501) })).status).toBe(400);
    let r = await admin.post(`/api/admin/users/${ids.star}/strikes`, { reason: 'Copied someone else’s song' });
    expect((await r.json()).user.activeStrikes).toBe(1);
    await admin.post(`/api/admin/users/${ids.star}/strikes`, { reason: 'Again' });
    expect((await user(ids.star)).activeStrikes).toBe(2);
    expect(status()).toMatchObject({ activeStrikes: 2, criteria: { noStrikes: false } });
    expect(srv.db.sql.prepare('SELECT reason FROM policy_strikes WHERE user_id = ? ORDER BY issued_at, rowid').all(ids.star)).toEqual([{ reason: 'Copied someone else’s song' }, { reason: 'Again' }]);
    r = await admin.post(`/api/admin/users/${ids.star}/strikes/lift`);
    expect((await r.json()).user.activeStrikes).toBe(0);
    expect(status().criteria.noStrikes).toBe(true);
  });

  it('shares its strike helpers with the manage command', () => {
    issueStrike(srv.db, ids.fan, 'cli');
    expect(liftStrikes(srv.db, ids.fan)).toBe(1);
    expect(liftStrikes(srv.db, ids.fan)).toBe(0);
  });
});
