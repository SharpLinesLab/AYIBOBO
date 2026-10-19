import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachUser, createAuth, requireRole } from '../server/auth';
import { TEST_SECRET, startServer } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(() => srv.close());

const signup = (c = srv.client(), body: Record<string, unknown> = {}) =>
  c.post('/api/auth/signup', { email: 'artist@example.com', password: 'correct horse battery', displayName: 'Tiga', role: 'artist', ...body });

describe('accounts', () => {
  it('signs up, sets a hardened session cookie and never returns the password', async () => {
    const c = srv.client();
    const r = await signup(c);
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.user).toMatchObject({ email: 'artist@example.com', role: 'artist', displayName: 'Tiga' });
    expect(JSON.stringify(body)).not.toMatch(/password|correct horse/);
    const set = r.headers.get('set-cookie') ?? '';
    expect(set).toMatch(/^asf_session=[\w-]{40,};/);
    for (const flag of ['HttpOnly', 'SameSite=Lax', 'Path=/']) expect(set).toContain(flag);
    expect((await (await c.get('/api/auth/me')).json()).user.email).toBe('artist@example.com');
  });

  it('marks the session cookie Secure only when the site is served over HTTPS', async () => {
    for (const [publicUrl, secure] of [['https://asf.example', true], ['http://staging.asf.example', false], [undefined, false]] as const) {
      const own = await startServer({ publicUrl });
      const c = own.client();
      const set = (await c.post('/api/auth/signup', { email: 'a@example.com', password: 'correct horse battery', displayName: 'A' })).headers.get('set-cookie') ?? '';
      const cleared = (await c.post('/api/auth/logout')).headers.get('set-cookie') ?? '';
      for (const cookie of [set, cleared]) expect(/;\s*Secure(;|$)/.test(cookie), `${publicUrl}: ${cookie}`).toBe(secure);
      own.close();
    }
  });

  it('stores only a bcrypt hash and only an HMAC of the session id', async () => {
    const row = srv.db.sql.prepare("SELECT password_hash FROM users WHERE email = 'artist@example.com'").get() as { password_hash: string };
    expect(row.password_hash).toMatch(/^\$2[aby]\$\d\d\$/);
    expect(row.password_hash).not.toContain('correct horse');
    const c = srv.client();
    await c.post('/api/auth/login', { email: 'artist@example.com', password: 'correct horse battery' });
    const token = c.cookie.split('=')[1];
    const stored = srv.db.sql.prepare('SELECT id_hash FROM sessions').all() as { id_hash: string }[];
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.some((s) => s.id_hash === token)).toBe(false);
  });

  it('rejects bad sign-ups', async () => {
    const cases: [Record<string, unknown>, number, string][] = [
      [{ email: 'artist@example.com' }, 409, 'email_taken'],
      [{ email: 'ARTIST@example.com ' }, 409, 'email_taken'],
      [{ email: 'nope' }, 400, 'invalid_email'],
      [{ email: 'x@example.com', password: 'short' }, 400, 'weak_password'],
      [{ email: 'x@example.com', password: 'é'.repeat(40) }, 400, 'long_password'],
      [{ email: 'x@example.com', displayName: '  ' }, 400, 'invalid_name'],
      [{ email: 'x@example.com', role: 'admin' }, 400, 'invalid_role'],
    ];
    for (const [body, status, code] of cases) {
      const r = await signup(srv.client(), body);
      expect(r.status, code).toBe(status);
      expect((await r.json()).code).toBe(code);
    }
  });

  it('logs in and out', async () => {
    const c = srv.client();
    const r = await c.post('/api/auth/login', { email: ' Artist@Example.com', password: 'correct horse battery' });
    expect(r.status).toBe(200);
    expect((await (await c.get('/api/auth/me')).json()).user.role).toBe('artist');
    const before = c.cookie;
    const out = await c.post('/api/auth/logout');
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await (await c.get('/api/auth/me')).json()).user).toBeNull();
    // The old cookie no longer works either: the session was deleted on the server.
    const replay = await fetch(`${srv.base}/api/auth/me`, { headers: { cookie: before } });
    expect((await replay.json()).user).toBeNull();
  });

  it('rejects a wrong password and an unknown email the same way', async () => {
    for (const body of [
      { email: 'artist@example.com', password: 'wrong password!' },
      { email: 'nobody@example.com', password: 'correct horse battery' },
      { email: 'artist@example.com', password: '' },
    ]) {
      const c = srv.client();
      const r = await c.post('/api/auth/login', body);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ ok: false, code: 'invalid_credentials' });
      expect(r.headers.get('set-cookie')).toBeNull();
    }
  });

  it('ignores forged session cookies and refuses cross-site requests', async () => {
    const forged = await fetch(`${srv.base}/api/auth/me`, { headers: { cookie: 'asf_session=forged-token' } });
    expect((await forged.json()).user).toBeNull();
    const r = await srv.client().post('/api/auth/login', { email: 'artist@example.com', password: 'correct horse battery' }, { origin: 'https://evil.example' });
    expect(r.status).toBe(403);
  });

  it('rate-limits sign-in attempts', async () => {
    const own = await (await import('./harness')).startServer();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await own.client().post('/api/auth/login', { email: 'a@example.com', password: 'x' })).status;
    expect(last).toBe(429);
    own.close();
  });
});

describe('protected routes', () => {
  it('reject requests without a session (401) or with the wrong role (403)', async () => {
    const { db } = srv;
    const auth = createAuth(db, { sessionSecret: TEST_SECRET, bcryptRounds: 4 });
    const app = express();
    app.use(attachUser(auth));
    app.get('/artists', requireRole('artist', 'admin'), (_req, res) => void res.json({ ok: true }));
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/artists`;

    expect((await fetch(url)).status).toBe(401);
    const listener = await auth.signup({ email: 'fan@example.com', password: 'listener pass 1', displayName: 'Fan' });
    if (typeof listener === 'string') throw new Error(listener);
    expect((await fetch(url, { headers: { cookie: `asf_session=${auth.createSession(listener.id)}` } })).status).toBe(403);
    const artist = await auth.login('artist@example.com', 'correct horse battery');
    expect((await fetch(url, { headers: { cookie: `asf_session=${auth.createSession(artist!.id)}` } })).status).toBe(200);
    server.close();
  });
});
