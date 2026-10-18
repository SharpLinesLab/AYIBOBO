import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { Db } from '../server/db';

let base = '';
let close: () => void;
let db: Db;

beforeAll(async () => {
  db = new Db(null);
  await db.init();
  const app = createApp({ db });
  await new Promise<void>((resolve) => {
    const server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      close = () => server.close();
      resolve();
    });
  });
});
afterAll(() => close?.());

type Json = any;
const json = async (r: Response | Promise<Response>): Promise<Json> => (await r).json();
const post = (path: string, body: unknown) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('API server', () => {
  it('reports health and sends security headers', async () => {
    const r = await fetch(`${base}/api/health`);
    expect(await r.json()).toEqual({ ok: true });
    const csp = r.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('no longer serves the retired Boost Board API', async () => {
    for (const path of ['/api/state', '/api/checkout', '/api/stripe/webhook', '/api/ping', '/api/click', '/api/resolve', '/api/metadata']) {
      const r = path === '/api/state' ? await fetch(base + path) : await post(path, {});
      expect(r.status, path).toBe(404);
    }
  });

  it('accepts newsletter sign-ups and rejects bad emails', async () => {
    expect((await post('/api/newsletter', { email: 'fan@example.com' })).status).toBe(200);
    expect((await post('/api/newsletter', { email: 'nope' })).status).toBe(400);
  });

  it('unsubscribes from the newsletter and always answers ok', async () => {
    const emails = () => db.mutate((d) => (d.subscribers ?? []).map((s) => s.email));
    await post('/api/newsletter', { email: 'leaver@example.com' });
    expect(await emails()).toContain('leaver@example.com');
    const r = await post('/api/newsletter/unsubscribe', { email: ' Leaver@Example.com ' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(await emails()).not.toContain('leaver@example.com');
    expect(await emails()).toContain('fan@example.com');
    // Unknown or missing addresses get the same answer.
    expect(await json(post('/api/newsletter/unsubscribe', { email: 'never@example.com' }))).toEqual({ ok: true });
    expect(await json(post('/api/newsletter/unsubscribe', {}))).toEqual({ ok: true });
  });
});
