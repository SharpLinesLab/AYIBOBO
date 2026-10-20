import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promotionsRepo } from '../server/promotions';
import { royaltiesRepo } from '../server/royalties';
import { PACKAGES, injectPromoted, isoDay, packageEndDate, perDayCents, utcDay } from '../src/lib/promotionRules';
import { startServer, type Client } from './harness';

const DAY = 86_400_000;

describe('promotion rules', () => {
  it('reads dates as UTC days', () => {
    expect(utcDay('2026-10-20')).toBe(Date.UTC(2026, 9, 20));
    expect(utcDay('2026-02-30')).toBeNull();
    expect(utcDay('20-10-2026')).toBeNull();
    expect(isoDay(Date.UTC(2026, 9, 20, 23, 59))).toBe('2026-10-20');
  });

  it('sells three packages: 1 day $5, 3 days $12, 7 days $25 (best value)', () => {
    expect(PACKAGES.map((p) => [p.id, p.days, p.defaultCents, !!p.bestValue])).toEqual([
      ['day1', 1, 500, false],
      ['day3', 3, 1200, false],
      ['day7', 7, 2500, true],
    ]);
    expect(PACKAGES.map((p) => perDayCents({ days: p.days, priceCents: p.defaultCents }))).toEqual([500, 400, 357]);
  });

  it('ends a package on start + days − 1, both days included', () => {
    expect(packageEndDate('2026-10-20', 1)).toBe('2026-10-20');
    expect(packageEndDate('2026-10-20', 3)).toBe('2026-10-22');
    expect(packageEndDate('2026-10-20', 7)).toBe('2026-10-26');
    expect(packageEndDate('2026-12-30', 3)).toBe('2027-01-01');
    expect(packageEndDate('2028-02-27', 3)).toBe('2028-02-29');
    expect(packageEndDate('2026-02-30', 3)).toBeNull();
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
  const promote = (c: Client, trackId: string, packageId: string, from: number) => c.post('/api/promotions', { trackId, packageId, startDate: date(from) });
  const setPrices = (c: Client, prices: unknown) => c.send('/api/admin/promotions/packages', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prices }) });
  type P = { id: string; trackId: string; status: string; startsAt: number; endsAt: number; days: number; priceCents: number };
  const allPromotions = async () => (await (await admin.get('/api/admin/promotions')).json()).promotions as P[];

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
    expect((await promote(srv.client(), 's1', 'day1', 0)).status).toBe(401);
    for (const trackId of ['p1', 'o1', 'nope']) {
      const r = await promote(artist, trackId, 'day1', 0);
      expect([r.status, (await r.json()).code]).toEqual([400, 'not_published']);
    }
  });

  it('needs a package and a first day that isn’t in the past', async () => {
    // A free-form day count isn't a way to buy anymore.
    const r = await artist.post('/api/promotions', { trackId: 's1', startDate: date(0), endDate: date(4) });
    expect([r.status, (await r.json()).code]).toEqual([400, 'invalid_package']);
    // (Straight to the repository from here: the creation endpoint is rate-limited.)
    expect(repo.create(id.star, 's1', 'day2', date(0))).toBe('invalid_package');
    expect(repo.create(id.star, 's1', 'day3', 'tomorrow')).toBe('invalid_dates');
    expect(repo.create(id.star, 's1', 'day3', date(-1))).toBe('in_past');
    expect(repo.create(id.star, 's1', 'day3', date(366))).toBe('too_far');
  });

  it('stores the package’s price, not a per-day price, and ends the package on its last day', async () => {
    const mine = await (await artist.get('/api/promotions/mine')).json();
    expect(mine.packages).toEqual([
      { id: 'day1', days: 1, priceCents: 500 },
      { id: 'day3', days: 3, priceCents: 1200 },
      { id: 'day7', days: 7, priceCents: 2500 },
    ]);
    const r = await promote(artist, 's1', 'day7', 0);
    expect(r.status).toBe(201);
    const { promotion } = await r.json();
    // 2500, not 7 × 500.
    expect(promotion).toMatchObject({ trackId: 's1', title: 'Song s1', artistId: id.star, artistName: 'Star', startsAt: today, endsAt: today + 7 * DAY, days: 7, status: 'pending_payment', priceCents: 2500, stripePaymentId: null, activatedAt: null });
    // 1200, not 3 × 500; the last day is the 3rd, counted in UTC days.
    const three = (await (await promote(artist, 's2', 'day3', 0)).json()).promotion;
    expect(three).toMatchObject({ startsAt: today, endsAt: today + 3 * DAY, days: 3, priceCents: 1200 });
    expect(isoDay(three.endsAt - DAY)).toBe(packageEndDate(date(0), 3));
    const one = repo.create(id.star, 's3', 'day1', date(30)) as P;
    expect(one).toMatchObject({ startsAt: today + 30 * DAY, endsAt: today + 31 * DAY, days: 1, priceCents: 500 });
    expect(repo.cancel(one.id)).toMatchObject({ status: 'cancelled' });
    expect((await (await other.get('/api/promotions/mine')).json()).promotions).toEqual([]);
  });

  it('refuses overlapping promotions of the same song; cancelling frees the dates', async () => {
    // s1 holds days 0–6 (7-day package).
    for (const [pkg, from] of [['day1', 6], ['day3', 5], ['day7', 0], ['day1', 0]] as const) {
      const clash = await promote(artist, 's1', pkg, from);
      expect([clash.status, (await clash.json()).code]).toEqual([409, 'overlap']);
    }
    expect((await promote(artist, 's1', 'day3', 7)).status).toBe(201); // starts the day after
    expect((await promote(artist, 's3', 'day7', 0)).status).toBe(201); // another song, same days
    const later = (await allPromotions()).find((p) => p.trackId === 's1' && p.startsAt === today + 7 * DAY)!;
    expect((await promote(artist, 's1', 'day1', 8)).status).toBe(409);
    expect((await admin.post(`/api/admin/promotions/${later.id}/cancel`)).status).toBe(200);
    expect((await promote(artist, 's1', 'day1', 8)).status).toBe(201);
    // Clean up s3 for the next tests.
    const s3 = (await allPromotions()).find((p) => p.trackId === 's3' && p.status === 'pending_payment')!;
    expect((await admin.post(`/api/admin/promotions/${s3.id}/cancel`)).status).toBe(200);
  });

  it('editing package prices changes only promotions created afterwards', async () => {
    const before = JSON.stringify(await allPromotions());
    for (const bad of [null, [], {}, { day2: 600 }, { day1: 0 }, { day1: -5 }, { day1: 1.5 }, { day1: '700' }, { day1: 100_001 }, { day1: 600, day3: 0 }]) {
      const r = await setPrices(admin, bad);
      expect([r.status, (await r.json()).code]).toEqual([400, 'invalid_prices']);
    }
    // All or nothing: the refused { day1: 600, day3: 0 } changed nothing.
    expect((await (await artist.get('/api/promotions/mine')).json()).packages[0].priceCents).toBe(500);

    const r = await setPrices(admin, { day1: 600, day3: 1500, day7: 3000 });
    expect(await r.json()).toEqual({ ok: true, packages: [
      { id: 'day1', days: 1, priceCents: 600 },
      { id: 'day3', days: 3, priceCents: 1500 },
      { id: 'day7', days: 7, priceCents: 3000 },
    ] });
    expect((await setPrices(admin, { day7: 2800 })).status).toBe(200); // one at a time works too
    expect(JSON.stringify(await allPromotions())).toBe(before);

    const { promotion } = await (await promote(artist, 's3', 'day3', 1)).json();
    expect(promotion).toMatchObject({ startsAt: today + DAY, endsAt: today + 4 * DAY, priceCents: 1500 });
    expect((await (await artist.get('/api/promotions/mine')).json()).packages.map((p: { priceCents: number }) => p.priceCents)).toEqual([600, 1500, 2800]);
    // The retired per-day rate is gone.
    expect((await admin.send('/api/admin/promotions/rate', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"rateCents":700}' })).status).toBe(404);
  });

  it('is managed by admins only', async () => {
    for (const c of [srv.client(), artist]) {
      expect((await c.get('/api/admin/promotions')).status).toBe(404);
      expect((await c.post('/api/admin/promotions/x/activate')).status).toBe(404);
      expect((await c.post('/api/admin/promotions/x/cancel')).status).toBe(404);
      expect((await setPrices(c, { day1: 1 })).status).toBe(404);
    }
    expect((await admin.post('/api/admin/promotions/nope/activate')).status).toBe(404);
  });

  it('boosts only active promotions inside their dates, and counts their revenue apart from royalties', async () => {
    const royalties = royaltiesRepo(srv.db);
    const at = today + DAY / 2;
    const royaltyView = () => JSON.stringify([royalties.summary(isoDay(at).slice(0, 7), at), royalties.status(id.star, at), royalties.dashboard(id.star, at), royalties.periods()]);
    const before = royaltyView();
    const all = async () => (await (await admin.get('/api/admin/promotions')).json()) as { revenueCents: number; promotions: P[] };
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
    const s3 = (await all()).promotions.find((p) => p.trackId === 's3' && p.status === 'pending_payment')!;
    expect((await (await admin.post(`/api/admin/promotions/${s3.id}/activate`)).json()).promotion.status).toBe('scheduled');
    expect(await promoted()).toEqual(['s1']);
    expect((await all()).revenueCents).toBe(2500 + 1500);

    // The calendar moves it along: scheduled → active → ended.
    expect(repo.activeTrackIds(today + DAY + 1)).toEqual(['s1', 's3']);
    expect(repo.activeTrackIds(today + 4 * DAY)).toEqual(['s1']);
    expect((await all()).promotions.find((p) => p.id === s3.id)!.status).toBe('ended');

    // A song taken off ASF isn't boosted even while its promotion runs.
    srv.db.sql.prepare("UPDATE uploads SET status = 'rejected' WHERE id = 's1'").run();
    expect(await promoted()).toEqual([]);
    srv.db.sql.prepare("UPDATE uploads SET status = 'approved' WHERE id = 's1'").run();

    // Cancelling stops it and takes it out of revenue; ended ones can't be cancelled.
    expect((await admin.post(`/api/admin/promotions/${s1.id}/cancel`)).status).toBe(200);
    expect(await promoted()).toEqual([]);
    expect((await all()).revenueCents).toBe(1500);
    const ended = await admin.post(`/api/admin/promotions/${s3.id}/cancel`);
    expect([ended.status, (await ended.json()).code]).toEqual([409, 'not_cancellable']);

    // None of this touched royalties.
    expect(royaltyView()).toBe(before);
  });

  it('can’t activate a promotion whose dates are over', () => {
    const p = repo.create(id.star, 's2', 'day1', date(20));
    expect(typeof p).toBe('object');
    expect(repo.activate((p as { id: string }).id, today + 30 * DAY)).toBe('expired');
  });

  it('rate-limits new promotions like other writes', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await promote(other, 'o1', 'day1', 40 + i)).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
