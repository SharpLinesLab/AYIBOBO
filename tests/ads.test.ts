import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pickWeighted } from '../server/ads';
import { FILES } from './fixtures';
import { startServer, type Client } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;
let admin: Client;
let listener: Client;

async function account(role: 'artist' | 'listener', email: string) {
  const c = srv.client();
  expect((await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: email.split('@')[0], role })).status).toBe(201);
  return c;
}
function adForm(fields: Record<string, string> = {}, audio: Buffer | null = FILES.wav, extra?: (f: FormData) => void) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ title: 'Kafe Lakay', advertiserName: 'Lakay Coffee', duration: '20', weight: '1', active: '1', ...fields })) f.append(k, v);
  if (audio) f.append('audio', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'ad.wav');
  extra?.(f);
  return f;
}
const createAd = async (fields: Record<string, string> = {}) => {
  const r = await admin.send('/api/admin/ads', { method: 'POST', body: adForm(fields) });
  expect(r.status).toBe(201);
  return (await r.json()).ad as { id: string; active: boolean; playsByDay: { day: string; plays: number }[] };
};
const patch = (id: string, body: unknown) => admin.send(`/api/admin/ads/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
/** Ask for the next ad as a signed-out browser with this listener id. */
const nextAd = (id = 'listener-0000000000001') => fetch(`${srv.base}/api/ads/next`, { headers: { 'x-asf-listener': id } });
const clearAds = async () => {
  for (const a of (await (await admin.get('/api/admin/ads')).json()).ads) await admin.send(`/api/admin/ads/${a.id}`, { method: 'DELETE' });
};

beforeAll(async () => {
  srv = await startServer();
  listener = await account('listener', 'fan@example.com');
  admin = await account('listener', 'boss@example.com');
  srv.db.sql.prepare("UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'").run();
});
afterAll(() => srv.close());

describe('ad administration', () => {
  it('is for admins only', async () => {
    for (const c of [srv.client(), listener]) {
      expect((await c.get('/api/admin/ads')).status).toBe(404);
      expect((await c.send('/api/admin/ads', { method: 'POST', body: adForm() })).status).toBe(404);
      expect((await c.send('/api/admin/ads/x', { method: 'DELETE' })).status).toBe(404);
    }
  });

  it('validates uploads with the song pipeline, 30 seconds at most, leaving nothing behind', async () => {
    for (const [form, status, code] of [
      [adForm({ title: '' }), 400, 'invalid_title'],
      [adForm({ advertiserName: ' ' }), 400, 'invalid_advertiser'],
      [adForm({ duration: '31' }), 400, 'invalid_duration'],
      [adForm({ weight: '0' }), 400, 'invalid_weight'],
      [adForm({ startsAt: '2000', endsAt: '1000' }), 400, 'invalid_dates'],
      [adForm({}, FILES.text), 415, 'invalid_audio'],
      [adForm({}, null), 400, 'missing_audio'],
      [adForm({}, FILES.wav, (f) => f.append('cover', new Blob([new Uint8Array(FILES.png)]), 'c.png')), 400, 'unexpected_file'],
    ] as const) {
      const r = await admin.send('/api/admin/ads', { method: 'POST', body: form });
      expect([r.status, (await r.json()).code], code).toEqual([status, code]);
    }
    expect(readdirSync(join(srv.uploadsDir, 'ads'))).toEqual([]);
    expect(readdirSync(join(srv.uploadsDir, 'tmp'))).toEqual([]);
  });

  it('stores an ad, previews it for admins and serves it while active', async () => {
    const ad = await createAd();
    expect(ad).toMatchObject({ active: true });
    expect(ad.playsByDay).toHaveLength(7);
    expect(ad.playsByDay.every((d) => d.plays === 0)).toBe(true);
    const preview = await admin.get(`/api/admin/ads/${ad.id}/audio`);
    expect(Buffer.from(await preview.arrayBuffer()).equals(FILES.wav)).toBe(true);
    expect((await fetch(`${srv.base}/api/ads/${ad.id}/audio`)).status).toBe(200);
    expect((await patch(ad.id, { active: false })).status).toBe(200);
    expect((await fetch(`${srv.base}/api/ads/${ad.id}/audio`)).status).toBe(404);
    await clearAds();
  });

  it('edits, and deletes the file and play history', async () => {
    const ad = await createAd();
    const r = await patch(ad.id, { title: 'New title', weight: 5, startsAt: null, endsAt: null });
    expect((await r.json()).ad).toMatchObject({ title: 'New title', weight: 5, advertiserName: 'Lakay Coffee' });
    expect((await (await patch(ad.id, { weight: 101 })).json()).code).toBe('invalid_weight');
    expect((await (await patch(ad.id, { startsAt: 5000, endsAt: 4000 })).json()).code).toBe('invalid_dates');
    await nextAd();
    expect((await admin.send(`/api/admin/ads/${ad.id}`, { method: 'DELETE' })).status).toBe(200);
    expect(existsSync(join(srv.uploadsDir, 'ads', ad.id))).toBe(false);
    expect(srv.db.sql.prepare('SELECT COUNT(*) AS n FROM ad_plays WHERE ad_id = ?').get(ad.id)).toEqual({ n: 0 });
    expect((await patch(ad.id, { active: true })).status).toBe(404);
  });
});

describe('GET /api/ads/next', () => {
  it('answers 204 when there is nothing to play', async () => {
    await clearAds();
    expect((await nextAd()).status).toBe(204);
    await createAd({ active: '' }); // inactive
    expect((await nextAd()).status).toBe(204);
    await clearAds();
    const day = 86_400_000;
    await createAd({ startsAt: String(Date.now() + day) }); // not started
    await createAd({ endsAt: String(Date.now() - day) }); // over
    expect((await nextAd()).status).toBe(204);
    await clearAds();
  });

  it('plays an ad at most 3 times a day per listener, and logs every play', async () => {
    const ad = await createAd({ startsAt: String(Date.now() - 1000), endsAt: String(Date.now() + 60_000) });
    for (let i = 0; i < 3; i++) {
      const r = await nextAd('listener-aaaaaaaaaaaaaaa');
      expect(r.status).toBe(200);
      expect((await r.json()).ad).toEqual({ id: ad.id, title: 'Kafe Lakay', advertiserName: 'Lakay Coffee', duration: 20, audioUrl: `/api/ads/${ad.id}/audio` });
    }
    expect((await nextAd('listener-aaaaaaaaaaaaaaa')).status).toBe(204);
    // Someone else still hears it; so does a signed-in listener (counted by account).
    expect((await nextAd('listener-bbbbbbbbbbbbbbb')).status).toBe(200);
    for (let i = 0; i < 3; i++) expect((await listener.get('/api/ads/next')).status).toBe(200);
    expect((await listener.get('/api/ads/next')).status).toBe(204);
    const plays = srv.db.sql.prepare('SELECT user_id, listener FROM ad_plays WHERE ad_id = ?').all(ad.id) as { user_id: string | null; listener: string }[];
    expect(plays).toHaveLength(7);
    expect(plays.filter((p) => p.user_id).length).toBe(3);
    const today = (await (await admin.get('/api/admin/ads')).json()).ads[0].playsByDay.at(-1);
    expect(today).toEqual({ day: new Date().toISOString().slice(0, 10), plays: 7 });
    await clearAds();
  });

  it('never plays ads for premium listeners', async () => {
    await createAd();
    srv.db.sql.prepare("UPDATE users SET tier = 'premium' WHERE email = 'fan@example.com'").run();
    expect((await (await listener.get('/api/auth/me')).json()).user.tier).toBe('premium');
    expect((await listener.get('/api/ads/next')).status).toBe(204);
    srv.db.sql.prepare("UPDATE users SET tier = 'free' WHERE email = 'fan@example.com'").run();
    await clearAds();
  });

  it('picks ads by weight', () => {
    const items = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];
    expect(pickWeighted(items, 0)!.id).toBe('a');
    expect(pickWeighted(items, 0.24)!.id).toBe('a');
    expect(pickWeighted(items, 0.25)!.id).toBe('b');
    expect(pickWeighted(items, 0.999)!.id).toBe('b');
    expect(pickWeighted([], 0.5)).toBeNull();
  });
});
