import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promotionsRepo } from '../server/promotions';
import { royaltiesRepo } from '../server/royalties';
import { PROMOTION_RULES, injectPromoted, isoDay, promotionDays, promotionPrice, utcDay } from '../src/lib/promotionRules';
import { startServer, type Client } from './harness';

const DAY = 86_400_000;

describe('promotion rules', () => {
  it('reads dates as UTC days and counts both ends', () => {
    expect(utcDay('2026-10-20')).toBe(Date.UTC(2026, 9, 20));
    expect(utcDay('2026-02-30')).toBeNull();
    expect(utcDay('20-10-2026')).toBeNull();
    expect(isoDay(Date.UTC(2026, 9, 20, 23, 59))).toBe('2026-10-20');
    expect(promotionDays('2026-10-20', '2026-10-20')).toBe(1);
    expect(promotionDays('2026-10-20', '2026-10-26')).toBe(7);
    expect(promotionDays('2026-12-30', '2027-01-02')).toBe(4);
    expect(promotionDays('2026-10-20', '2026-10-19')).toBe(0);
    expect(promotionDays('nope', '2026-10-19')).toBe(0);
  });

  it('prices a promotion at a flat rate per day', () => {
    expect(PROMOTION_RULES.defaultRateCents).toBe(500);
    expect(promotionPrice(500, 7)).toBe(3500);
    expect(promotionPrice(799, 3)).toBe(2397);
    expect(promotionPrice(500, 0)).toBe(0);
  });

  const s = (id: string) => ({ id });
  const ids = (feed: { item: { id: string }; promoted: boolean }[]) => feed.map((x) => (x.promoted ? `*${x.item.id}` : x.item.id));

  it('mixes at most 2 promoted songs into a feed, after the 1st and 4th songs', () => {
    const organic = ['a', 'b', 'c', 'd', 'e', 'f'].map(s);
    expect(ids(injectPromoted(organic, [s('x'), s('y'), s('z')]))).toEqual(['a', '*x', 'b', 'c', 'd', '*y', 'e', 'f']);
    expect(ids(injectPromoted(organic, [s('x')]))).toEqual(['a', '*x', 'b', 'c', 'd', 'e', 'f']);
    expect(ids(injectPromoted(organic, []))).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('never repeats a song that is already in the feed (or twice)', () => {
    const organic = ['a', 'b', 'c', 'd', 'e'].map(s);
    expect(ids(injectPromoted(organic, [s('c'), s('x'), s('x'), s('a'), s('y')]))).toEqual(['a', '*x', 'b', 'c', 'd', '*y', 'e']);
    expect(ids(injectPromoted(organic, [s('a'), s('e')]))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('works with short or empty feeds', () => {
    expect(ids(injectPromoted([s('a')], [s('x'), s('y')]))).toEqual(['a', '*x', '*y']);
    expect(ids(injectPromoted([], [s('x'), s('y')]))).toEqual(['*x', '*y']);
  });
});

describe('promotions on the server', () => {
  let srv: Awaited<ReturnType<typeof startServer>>;
  let repo: ReturnType<typeof promotionsRepo>;
  let artist: Client;
  let other: Client;
  let admin: Client;
  const id: Record<string, string> = {};
  const today = Math.floor(Date.now() / DAY) * DAY;
  const date = (offset: number) => isoDay(today + offset * DAY);

  async function account(email: string, role: 'artist' | 'listener') {
    const c = srv.client();
    const r = await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: email.split('@')[0], role });
    id[email.split('@')[0]] = (await r.json()).user.id;
    return c;
  }
  const publish = (uploadId: string, owner: string, status = 'approved') =>
    srv.db.sql
      .prepare(
        `INSERT INTO uploads (id, user_id, title, genre, status, audio_type, audio_size, cover_type, cover_size, duration, created_at, reviewed_at, artist_name)
         VALUES (?, ?, ?, 'kompa', ?, 'audio/mpeg', 1, 'image/png', 1, 180, 1, 1, 'Star')`,
      )
      .run(uploadId, owner, `Song ${uploadId}`, status);
  const promote = (c: Client, trackId: string, from: number, to: number) => c.post('/api/promotions', { trackId, startDate: date(from), endDate: date(to) });

  beforeAll(async () => {
    srv = await startServer();
    repo = promotionsRepo(srv.db);
    artist = await account('star@example.com', 'artist');
    other = await account('other@example.com', 'artist');
    admin = await account('boss@example.com', 'listener');
    srv.db.sql.prepare("UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'").run();
    publish('s1', id.star);
    publish('s2', id.star);
    publish('s3', id.star);
    publish('p1', id.star, 'pending');
    publish('o1', id.other);
  });
  afterAll(() => srv.close());

  it('lets artists promote only their own published songs', async () => {
    expect((await promote(srv.client(), 's1', 0, 2)).status).toBe(401);
    for (const trackId of ['p1', 'o1', 'nope']) {
      const r = await promote(artist, trackId, 0, 2);
      expect([r.status, (await r.json()).code]).toEqual([400, 'not_published']);
    }
  });

  it('checks the dates', async () => {
    const code = async (body: object) => (await (await artist.post('/api/promotions', { trackId: 's1', ...body })).json()).code;
    expect(await code({ startDate: date(3), endDate: date(2) })).toBe('invalid_dates');
    expect(await code({ startDate: 'tomorrow', endDate: date(2) })).toBe('invalid_dates');
    expect(await code({ startDate: date(-1), endDate: date(2) })).toBe('in_past');
    expect(await code({ startDate: date(0), endDate: date(90) })).toBe('too_long');
    expect(await code({ startDate: date(366), endDate: date(367) })).toBe('too_far');
  });

  it('starts as pending payment, priced at the per-day rate', async () => {
    const r = await promote(artist, 's1', 0, 6);
    expect(r.status).toBe(201);
    const { promotion } = await r.json();
    expect(promotion).toMatchObject({ trackId: 's1', title: 'Song s1', artistId: id.star, artistName: 'Star', startsAt: today, endsAt: today + 7 * DAY, days: 7, status: 'pending_payment', priceCents: 3500, stripePaymentId: null, activatedAt: null });
    const mine = await (await artist.get('/api/promotions/mine')).json();
    expect(mine.rateCents).toBe(500);
    expect(mine.promotions.map((p: { id: string }) => p.id)).toEqual([promotion.id]);
    expect((await (await other.get('/api/promotions/mine')).json()).promotions).toEqual([]);
  });

  it('refuses overlapping dates for the same song; cancelling frees them', async () => {
    const clash = await promote(artist, 's1', 6, 10);
    expect([clash.status, (await clash.json()).code]).toEqual([409, 'overlap']);
    expect((await promote(artist, 's1', 7, 10)).status).toBe(201); // starts the day after
    expect((await promote(artist, 's2', 0, 6)).status).toBe(201); // another song, same days
    const pending = (await (await admin.get('/api/admin/promotions')).json()).promotions.find((p: { trackId: string; startsAt: number }) => p.trackId === 's1' && p.startsAt === today + 7 * DAY);
    expect((await admin.post(`/api/admin/promotions/${pending.id}/cancel`)).status).toBe(200);
    expect((await promote(artist, 's1', 8, 9)).status).toBe(201);
  });

  it('keeps the price a promotion was made with when the rate changes', async () => {
    for (const bad of [0, -5, 1.5, '700', 100_001]) expect((await admin.send('/api/admin/promotions/rate', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rateCents: bad }) })).status).toBe(400);
    const r = await admin.send('/api/admin/promotions/rate', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rateCents: 700 }) });
    expect(await r.json()).toEqual({ ok: true, rateCents: 700 });
    const { promotion } = await (await promote(artist, 's3', 1, 2)).json();
    expect(promotion.priceCents).toBe(1400);
    const all = (await (await admin.get('/api/admin/promotions')).json()).promotions as { trackId: string; priceCents: number }[];
    expect(all.find((p) => p.trackId === 's2')!.priceCents).toBe(3500);
    expect((await (await artist.get('/api/promotions/mine')).json()).rateCents).toBe(700);
  });

  it('is managed by admins only', async () => {
    for (const c of [srv.client(), artist]) {
      expect((await c.get('/api/admin/promotions')).status).toBe(404);
      expect((await c.post('/api/admin/promotions/x/activate')).status).toBe(404);
      expect((await c.post('/api/admin/promotions/x/cancel')).status).toBe(404);
      expect((await c.send('/api/admin/promotions/rate', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"rateCents":1}' })).status).toBe(404);
    }
    expect((await admin.post('/api/admin/promotions/nope/activate')).status).toBe(404);
  });

  it('boosts only active promotions inside their dates, and counts their revenue apart from royalties', async () => {
    const royalties = royaltiesRepo(srv.db);
    const at = today + DAY / 2;
    const royaltyView = () => JSON.stringify([royalties.summary(isoDay(at).slice(0, 7), at), royalties.status(id.star, at), royalties.dashboard(id.star, at), royalties.periods()]);
    const before = royaltyView();
    const all = async () => (await (await admin.get('/api/admin/promotions')).json()) as { revenueCents: number; promotions: { id: string; trackId: string; status: string; startsAt: number; priceCents: number }[] };
    const promoted = async () => (await (await srv.client().get('/api/promoted')).json()).trackIds;

    // Waiting for payment: not in feeds, no revenue.
    expect(await promoted()).toEqual([]);
    expect((await all()).revenueCents).toBe(0);

    const s1 = (await all()).promotions.find((p) => p.trackId === 's1' && p.startsAt === today)!;
    const r = await admin.post(`/api/admin/promotions/${s1.id}/activate`);
    expect((await r.json()).promotion).toMatchObject({ status: 'active', activatedAt: expect.any(Number) });
    const again = await admin.post(`/api/admin/promotions/${s1.id}/activate`);
    expect([again.status, (await again.json()).code]).toEqual([409, 'not_pending']);
    // Starts tomorrow: paid, but scheduled and not in feeds yet.
    const s3 = (await all()).promotions.find((p) => p.trackId === 's3')!;
    expect((await (await admin.post(`/api/admin/promotions/${s3.id}/activate`)).json()).promotion.status).toBe('scheduled');
    expect(await promoted()).toEqual(['s1']);
    expect((await all()).revenueCents).toBe(3500 + 1400);

    // The calendar moves it along: scheduled → active → ended.
    expect(repo.activeTrackIds(today + DAY + 1)).toEqual(['s1', 's3']);
    expect(repo.activeTrackIds(today + 3 * DAY)).toEqual(['s1']);
    expect((await all()).promotions.find((p) => p.id === s3.id)!.status).toBe('ended');

    // A song taken off ASF isn't boosted even while its promotion runs.
    srv.db.sql.prepare("UPDATE uploads SET status = 'rejected' WHERE id = 's1'").run();
    expect(await promoted()).toEqual([]);
    srv.db.sql.prepare("UPDATE uploads SET status = 'approved' WHERE id = 's1'").run();

    // Cancelling stops it and takes it out of revenue; ended ones can't be cancelled.
    expect((await admin.post(`/api/admin/promotions/${s1.id}/cancel`)).status).toBe(200);
    expect(await promoted()).toEqual([]);
    expect((await all()).revenueCents).toBe(1400);
    const ended = await admin.post(`/api/admin/promotions/${s3.id}/cancel`);
    expect([ended.status, (await ended.json()).code]).toEqual([409, 'not_cancellable']);

    // None of this touched royalties.
    expect(royaltyView()).toBe(before);
  });

  it('can’t activate a promotion whose dates are over', () => {
    const p = repo.create(id.star, 's2', date(20), date(21));
    expect(typeof p).toBe('object');
    expect(repo.activate((p as { id: string }).id, today + 30 * DAY)).toBe('expired');
  });

  it('rate-limits new promotions like other writes', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await promote(other, 'o1', 40 + i, 40 + i)).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
