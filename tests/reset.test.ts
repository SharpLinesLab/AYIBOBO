import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;
const sent: { email: string; link: string }[] = [];
const PW = 'original password';

beforeAll(async () => {
  // Many requests from one test IP; the limits themselves are checked at the end with a fresh server.
  process.env.RATE_LIMIT_MULTIPLIER = '20';
  srv = await startServer({ publicUrl: 'https://asf.example', sendResetLink: (email, link) => void sent.push({ email, link }) });
  delete process.env.RATE_LIMIT_MULTIPLIER;
  await srv.client().post('/api/auth/signup', { email: 'rose@example.com', password: PW, displayName: 'Rose' });
});
afterAll(() => srv.close());

/** Ask for a reset and return the token from the link that was "sent". */
async function requestToken(email = 'rose@example.com'): Promise<string> {
  const before = sent.length;
  expect((await srv.client().post('/api/auth/reset-request', { email })).status).toBe(200);
  await expect.poll(() => sent.length).toBe(before + 1);
  const { link } = sent[sent.length - 1];
  expect(link).toMatch(/^https:\/\/asf\.example\/#\/reset\/[\w-]{43}$/);
  return link.split('/').pop()!;
}
const reset = (token: string, password = 'brand new password') => srv.client().post('/api/auth/reset', { token, password });
const login = (password: string) => srv.client().post('/api/auth/login', { email: 'rose@example.com', password });
const tokens = () => (srv.db.sql.prepare('SELECT COUNT(*) AS n FROM password_resets').get() as { n: number }).n;

describe('password reset', () => {
  it('answers the same whether or not the account exists', async () => {
    const answers = [];
    for (const email of ['rose@example.com', 'nobody@example.com', 'ROSE@example.com', 'not an email', '']) {
      const r = await srv.client().post('/api/auth/reset-request', { email });
      answers.push([r.status, await r.text(), r.headers.get('set-cookie')]);
    }
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
    expect(answers[0]).toEqual([200, '{"ok":true}', null]);
    await new Promise((r) => setTimeout(r, 50));
    expect(sent.map((s) => s.email)).toEqual(['rose@example.com', 'rose@example.com']); // only real accounts get a link
  });

  it('stores tokens hashed, one live token per account', async () => {
    const token = await requestToken();
    const rows = srv.db.sql.prepare('SELECT token_hash, expires_at, created_at FROM password_resets').all() as { token_hash: string; expires_at: number; created_at: number }[];
    expect(rows).toHaveLength(1); // the earlier requests' tokens were replaced
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].expires_at - rows[0].created_at).toBe(60 * 60_000);
  });

  it('sets the new password: it works and the old one stops working; everyone is signed out', async () => {
    const signedIn = srv.client();
    await signedIn.post('/api/auth/login', { email: 'rose@example.com', password: PW });
    const token = await requestToken();
    const r = await reset(token);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect((await login('brand new password')).status).toBe(200);
    expect((await login(PW)).status).toBe(401);
    expect((await (await signedIn.get('/api/auth/me')).json()).user).toBeNull();
    expect(tokens()).toBe(0); // deleted after use
  });

  it('rejects a used token', async () => {
    const token = await requestToken();
    expect((await reset(token, 'third password!')).status).toBe(200);
    const again = await reset(token, 'fourth password!');
    expect(again.status).toBe(400);
    expect((await again.json()).code).toBe('invalid_token');
    expect((await login('fourth password!')).status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const token = await requestToken();
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    for (const bad of [flipped, token.slice(1), `${token}x`, '', 'x'.repeat(300)]) {
      const r = await reset(bad);
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe('invalid_token');
    }
    expect(tokens()).toBe(1); // the real one is untouched
    expect((await reset(token, 'after tamper ok')).status).toBe(200);
  });

  it('rejects an expired token and deletes it', async () => {
    const token = await requestToken();
    srv.db.sql.prepare('UPDATE password_resets SET expires_at = ?').run(Date.now() - 1);
    const r = await reset(token);
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe('invalid_token');
    expect(tokens()).toBe(0);
  });

  it('keeps the token when the new password is too short, so the person can retry', async () => {
    const token = await requestToken();
    const r = await reset(token, 'short');
    expect((await r.json()).code).toBe('weak_password');
    expect((await reset(token, 'long enough now')).status).toBe(200);
  });

  it('refuses cross-site requests and rate-limits both endpoints hard', async () => {
    expect((await srv.client().post('/api/auth/reset', { token: 'x', password: 'whatever!!' }, { origin: 'https://evil.example' })).status).toBe(403);
    const own = await startServer({ sendResetLink: () => {} });
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await own.client().post('/api/auth/reset-request', { email: `a${i}@example.com` })).status);
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[6]).toBe(429);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await own.client().post('/api/auth/reset', { token: 'x', password: 'whatever!!' })).status;
    expect(last).toBe(429);
    own.close();
  });
});
