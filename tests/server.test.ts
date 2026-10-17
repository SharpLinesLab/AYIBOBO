import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { Db } from '../server/db';
import { simulateMetadata } from '../src/lib/metadata';
import type { StateResponse } from '../src/lib/api';

let base = '';
let close: () => void;

beforeAll(async () => {
  const db = new Db(null, true);
  await db.init();
  const app = createApp({
    db,
    publicUrl: 'http://test',
    allowSimulatedPayments: true,
    resolver: async (u) => (u.includes('bit.ly/sf') ? 'https://stemforge.ai/?utm_source=bitly' : u),
    scraper: async (t) => simulateMetadata(t),
  });
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

const draft = { title: 'Server Test', tagline: 'tag', description: 'desc', category: 'labels', artwork: { from: '#000000', to: '#ffffff', glyph: 'ST' } };

describe('API server', () => {
  it('reports health and seeded state', async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true, stripe: false, simulated: true });
    const s = (await (await fetch(`${base}/api/state`)).json()) as StateResponse;
    expect(s.state.listings).toHaveLength(20);
    expect(s.stats.history).toHaveLength(14);
  });

  it('resolves shorteners server-side', async () => {
    const r = await json(post('/api/resolve', { input: 'bit.ly/sf' }));
    expect(r.key).toBe('stemforge.ai');
    const bad = await json(post('/api/resolve', { input: 'discord.gg/x' }));
    expect(bad.ok).toBe(false);
  });

  it('applies a simulated checkout and enforces the rules server-side', async () => {
    const ok = await json(post('/api/checkout', { input: 'serverlabel.com?utm_source=x', board: 'all', amount: 13006, draft }));
    expect(ok.kind).toBe('applied');
    expect(ok.quote.ranks.all.after).toBe(4);

    const band = await post('/api/checkout', { input: 'another.fm', board: 'all', amount: 17003, draft });
    expect(band.status).toBe(409);
    expect((await json(band)).suggested).toBe(17006);

    const topup = await json(post('/api/checkout', { input: 'https://www.serverlabel.com/about', board: 'all', amount: 13010, draft }));
    expect(topup.kind).toBe('applied');
    expect(topup.quote.charge).toBe(4);
    expect(topup.quote.mode).toBe('topup');

    const invalid = await post('/api/checkout', { input: 'x.fm', board: 'all', amount: 10.5, draft });
    expect(invalid.status).toBe(400);
    const badDraft = await post('/api/checkout', { input: 'x.fm', board: 'all', amount: 10, draft: { ...draft, category: 'nope' } });
    expect(badDraft.status).toBe(400);
  });

  it('counts clicks', async () => {
    const s = (await (await fetch(`${base}/api/state`)).json()) as StateResponse;
    const l = s.state.listings[0];
    expect((await post('/api/click', { listingId: l.id })).status).toBe(200);
    const s2 = (await (await fetch(`${base}/api/state`)).json()) as StateResponse;
    expect(s2.state.listings.find((x) => x.id === l.id)!.clicks).toBe(l.clicks + 1);
    expect((await post('/api/click', { listingId: 'nope' })).status).toBe(404);
  });
});
