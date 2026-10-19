import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { royaltiesRepo, type RoyaltiesRepo } from '../server/royalties';
import { ROYALTY_RULES, artistPayout, artistPool, eligibilityCriteria, isEligible, periodOf, periodRange } from '../src/lib/royaltyMath';
import { startServer, type Client } from './harness';

describe('earnings formula', () => {
  it('artist_pool = 0.80 × (subscription_revenue − stripe_fees), rounded to cents', () => {
    expect(artistPool(10_000, 320)).toBe(7744);
    expect(artistPool(100, 3.2)).toBe(77.44);
    expect(artistPool(0.1, 0.02)).toBe(0.06); // 0.064 → 0.06
    expect(artistPool(0.1, 0.01)).toBe(0.07); // 0.072 → 0.07
    expect(artistPool(19.99, 0)).toBe(15.99); // 15.992
    expect(artistPool(50, 50)).toBe(0);
    expect(artistPool(10, 20)).toBe(0); // fees above revenue: nothing, never negative
  });

  it('artist_payout = artist_streams / total_eligible_streams × artist_pool, rounded to cents', () => {
    expect(artistPayout(500, 1000, 7744)).toBe(3872);
    expect(artistPayout(1, 3, 100)).toBe(33.33);
    expect(artistPayout(2, 3, 100)).toBe(66.67);
    expect(artistPayout(1, 3, 0.01)).toBe(0);
    expect(artistPayout(1000, 1000, 77.44)).toBe(77.44);
  });

  it('pays nothing without streams or a pool', () => {
    expect(artistPayout(0, 1000, 100)).toBe(0);
    expect(artistPayout(10, 0, 100)).toBe(0);
    expect(artistPayout(10, 100, 0)).toBe(0);
    expect(artistPayout(Number.NaN, 100, 100)).toBe(0);
  });

  it('never pays more than the pool to one artist', () => {
    expect(artistPayout(2000, 1000, 50)).toBe(50);
  });

  it('shares add up to the pool, give or take rounding', () => {
    const pool = artistPool(12_345.67, 401.23);
    const streams = [512, 731, 1999, 7];
    const total = streams.reduce((a, b) => a + b, 0);
    const paid = streams.reduce((sum, s) => sum + artistPayout(s, total, pool), 0);
    expect(Math.abs(paid - pool)).toBeLessThanOrEqual(streams.length * 0.005 + 1e-9);
  });
});

describe('eligibility rules', () => {
  const ok = { verified: true, premiumStreams90d: 500, publishedTracks: 3, activeStrikes: 0 };
  it('needs all four', () => {
    expect(isEligible(eligibilityCriteria(ok))).toBe(true);
    expect(eligibilityCriteria({ ...ok, verified: false })).toMatchObject({ verified: false, streams: true, tracks: true, noStrikes: true });
    expect(isEligible(eligibilityCriteria({ ...ok, premiumStreams90d: 499 }))).toBe(false);
    expect(isEligible(eligibilityCriteria({ ...ok, publishedTracks: 2 }))).toBe(false);
    expect(isEligible(eligibilityCriteria({ ...ok, activeStrikes: 1 }))).toBe(false);
  });

  it('works in UTC calendar months', () => {
    expect(periodOf(Date.UTC(2026, 9, 31, 23, 59))).toBe('2026-10');
    expect(periodRange('2026-12')).toEqual({ start: Date.UTC(2026, 11, 1), end: Date.UTC(2027, 0, 1) });
    expect(periodRange('2026-13')).toBeNull();
    expect(periodRange('nope')).toBeNull();
  });
});

describe('royalty streams on the server', () => {
  let srv: Awaited<ReturnType<typeof startServer>>;
  let repo: RoyaltiesRepo;
  let listener: Client;
  let artist: Client;
  let admin: Client;
  let ids: Record<string, string>;
  const DAY = 86_400_000;

  async function account(email: string, role: 'artist' | 'listener') {
    const c = srv.client();
    expect((await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: email.split('@')[0], role })).status).toBe(201);
    return c;
  }
  const userId = (email: string) => (srv.db.sql.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string }).id;
  const publish = (id: string, owner: string, at: number, status = 'approved') =>
    srv.db.sql
      .prepare(
        `INSERT INTO uploads (id, user_id, title, genre, status, audio_type, audio_size, cover_type, cover_size, duration, created_at, reviewed_at, artist_name)
         VALUES (?, ?, ?, 'kompa', ?, 'audio/mpeg', 1, 'image/png', 1, 180, ?, ?, 'x')`,
      )
      .run(id, owner, id, status, at, at);
  /** `n` royalty streams for `artistId`, at `at`, from a listener of `tier`. */
  const streams = (n: number, trackId: string, artistId: string, at: number, tier: 'free' | 'premium', seconds = 30) => {
    const put = srv.db.sql.prepare('INSERT INTO royalty_plays (play_id, user_id, track_id, artist_id, played_at, seconds_listened, listener_tier) VALUES (?, NULL, ?, ?, ?, ?, ?)');
    srv.db.transaction(() => {
      for (let i = 0; i < n; i++) put.run(`seed-${trackId}-${at}-${tier}-${seconds}-${i}`, trackId, artistId, at, seconds, tier);
    });
  };

  beforeAll(async () => {
    srv = await startServer();
    repo = royaltiesRepo(srv.db);
    listener = await account('fan@example.com', 'listener');
    artist = await account('star@example.com', 'artist');
    await account('other@example.com', 'artist');
    admin = await account('boss@example.com', 'listener');
    srv.db.sql.prepare("UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'").run();
    ids = { fan: userId('fan@example.com'), star: userId('star@example.com'), other: userId('other@example.com') };
    const before = Date.UTC(2026, 0, 1);
    publish('song-1', ids.star, before);
    publish('song-2', ids.star, before);
    publish('song-3', ids.star, before);
    publish('pending-1', ids.star, before, 'pending');
    publish('other-1', ids.other, before);
  });
  afterAll(() => srv.close());

  it('logs plays of published songs for signed-in listeners only', async () => {
    const play = { playId: 'play-0001-abcdef', trackId: 'song-1', seconds: 0 };
    expect((await srv.client().post('/api/plays', play)).status).toBe(401);
    expect((await listener.post('/api/plays', { ...play, trackId: 'pending-1' })).status).toBe(404);
    expect((await listener.post('/api/plays', { ...play, trackId: 'nope' })).status).toBe(404);
    expect((await listener.post('/api/plays', { ...play, seconds: -1 })).status).toBe(400);
    expect((await listener.post('/api/plays', { ...play, playId: 'x' })).status).toBe(400);
    expect((await listener.post('/api/plays', play, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await listener.post('/api/plays', play)).status).toBe(204);
    const row = srv.db.sql.prepare('SELECT * FROM royalty_plays WHERE play_id = ?').get(play.playId);
    expect(row).toMatchObject({ user_id: ids.fan, track_id: 'song-1', artist_id: ids.star, seconds_listened: 0, listener_tier: 'free' });
    expect(Math.abs(Date.now() - (row as { played_at: number }).played_at)).toBeLessThan(5000);
  });

  it('keeps one row per play, however many times it is reported', async () => {
    const play = { playId: 'play-0002-abcdef', trackId: 'song-2', seconds: 0 };
    for (let i = 0; i < 3; i++) expect((await listener.post('/api/plays', play)).status).toBe(204);
    expect((srv.db.sql.prepare("SELECT COUNT(*) AS n FROM royalty_plays WHERE play_id = 'play-0002-abcdef'").get() as { n: number }).n).toBe(1);
    // Someone else can't take over the play, nor move it to another song.
    expect((await artist.post('/api/plays', play)).status).toBe(409);
    expect((await listener.post('/api/plays', { ...play, trackId: 'song-3' })).status).toBe(409);
  });

  it('counts only time that really passed, up to the song’s length', () => {
    const fan = { id: ids.fan, tier: 'premium' as const };
    const t0 = Date.UTC(2026, 5, 1);
    expect(repo.logPlay(fan, 'play-time-1', 'song-1', 40, t0)).toBe('logged');
    const secs = () => (srv.db.sql.prepare("SELECT seconds_listened AS s FROM royalty_plays WHERE play_id = 'play-time-1'").get() as { s: number }).s;
    expect(secs()).toBe(5); // a new play can't claim 40 seconds straight away
    repo.logPlay(fan, 'play-time-1', 'song-1', 40, t0 + 10_000);
    expect(secs()).toBe(15);
    repo.logPlay(fan, 'play-time-1', 'song-1', 31, t0 + 60_000);
    expect(secs()).toBe(31);
    repo.logPlay(fan, 'play-time-1', 'song-1', 12, t0 + 70_000); // never goes down
    expect(secs()).toBe(31);
    repo.logPlay(fan, 'play-time-1', 'song-1', 5000, t0 + 3_600_000);
    expect(secs()).toBe(185); // 180-second song (+5 seconds of slack)
    // The tier is the listener's when the play started.
    expect(srv.db.sql.prepare("SELECT listener_tier FROM royalty_plays WHERE play_id = 'play-time-1'").get()).toEqual({ listener_tier: 'premium' });
    srv.db.sql.prepare("DELETE FROM royalty_plays WHERE play_id = 'play-time-1'").run();
  });

  it('qualifies an artist only when all four criteria hold, counting premium 30-second streams of the last 90 days', () => {
    const now = Date.UTC(2026, 6, 15);
    const s = (at = now) => repo.status(ids.star, at);
    streams(499, 'song-1', ids.star, now - 10 * DAY, 'premium');
    streams(300, 'song-1', ids.star, now - 10 * DAY, 'free'); // free listeners don't count toward the 500
    streams(50, 'song-1', ids.star, now - 10 * DAY, 'premium', 29); // under 30 seconds: not a stream
    streams(50, 'song-1', ids.star, now - 91 * DAY, 'premium'); // outside the window
    expect(s()).toMatchObject({ premiumStreams90d: 499, publishedTracks: 3, verified: false, activeStrikes: 0, eligible: false });
    streams(1, 'song-2', ids.star, now - 1 * DAY, 'premium');
    expect(s().criteria).toEqual({ verified: false, streams: true, tracks: true, noStrikes: true });
    srv.db.sql.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(ids.star);
    expect(s().eligible).toBe(true);

    // An active strike blocks it; a lifted or expired one doesn't.
    srv.db.sql.prepare("INSERT INTO policy_strikes (id, user_id, reason, issued_at, expires_at, lifted_at) VALUES ('k1', ?, 'spam', ?, NULL, NULL)").run(ids.star, now - DAY);
    expect(s()).toMatchObject({ activeStrikes: 1, eligible: false });
    srv.db.sql.prepare("UPDATE policy_strikes SET lifted_at = ? WHERE id = 'k1'").run(now - 1);
    expect(s().eligible).toBe(true);
    expect(s(now - 2).activeStrikes).toBe(1); // it was active before it was lifted
    srv.db.sql.prepare("INSERT INTO policy_strikes (id, user_id, reason, issued_at, expires_at) VALUES ('k2', ?, 'old', ?, ?)").run(ids.star, now - 30 * DAY, now - DAY);
    expect(s().eligible).toBe(true);

    // Only published songs count.
    srv.db.sql.prepare("UPDATE uploads SET status = 'rejected' WHERE id = 'song-3'").run();
    expect(s()).toMatchObject({ publishedTracks: 2, eligible: false });
    srv.db.sql.prepare("UPDATE uploads SET status = 'approved' WHERE id = 'song-3'").run();
  });

  it('shows artists their streams and checklist, without any money', async () => {
    expect((await listener.get('/api/account/royalties')).status).toBe(403);
    expect((await srv.client().get('/api/account/royalties')).status).toBe(401);
    const body = await (await artist.get('/api/account/royalties')).json();
    expect(body).toMatchObject({ ok: true, preLaunch: true, verified: true, publishedTracks: 3, activeStrikes: 0 });
    expect(Object.keys(body.criteria).sort()).toEqual(['noStrikes', 'streams', 'tracks', 'verified']);
    expect(JSON.stringify(body)).not.toMatch(/payout|usd|amount|pool/i);
    const now = Date.UTC(2026, 6, 15);
    expect(repo.dashboard(ids.star, now)).toMatchObject({ period: '2026-07', streamsThisMonth: 800, streams90d: 800, premiumStreams90d: 500, eligible: true });
  });

  it('summarizes a month for admins only', async () => {
    for (const c of [srv.client(), listener, artist]) expect((await c.get('/api/admin/royalties')).status).toBe(404);
    expect((await admin.get('/api/admin/royalties?period=2026-99')).status).toBe(400);
    streams(100, 'other-1', ids.other, Date.UTC(2026, 6, 3), 'premium');
    const { summary, preLaunch } = await (await admin.get('/api/admin/royalties?period=2026-07')).json();
    expect(preLaunch).toBe(true);
    expect(summary).toMatchObject({ period: '2026-07', totalStreams: 900, premiumStreams: 600, eligibleArtists: 1, eligibleStreams: 500 });
    expect(summary.artists.map((a: { artistName: string; eligible: boolean; premiumStreams: number }) => [a.artistName, a.eligible, a.premiumStreams])).toEqual([
      ['star', true, 500],
      ['other', false, 100],
    ]);
  });

  it('writes each closed month to royalty_periods once; running it again changes nothing', () => {
    const now = Date.UTC(2026, 7, 2); // August 2: July is closed, August isn't
    expect(repo.snapshot('2026-08', now)).toBe('open');
    expect(repo.snapshot('bad', now)).toBe('invalid');
    const first = repo.snapshotClosedMonths(now);
    expect(first).toContain('2026-07');
    expect(first).not.toContain('2026-08');
    const tables = () => [srv.db.sql.prepare('SELECT * FROM royalty_periods ORDER BY period').all(), srv.db.sql.prepare('SELECT * FROM royalty_period_artists ORDER BY period, artist_id').all()];
    const before = JSON.stringify(tables());
    expect(repo.periods().find((p) => p.period === '2026-07')).toMatchObject({ totalStreams: 900, premiumStreams: 600, eligibleArtists: 1, eligibleStreams: 500 });

    // New plays and new strikes later on don't rewrite history.
    streams(1000, 'song-1', ids.star, Date.UTC(2026, 6, 20), 'premium');
    srv.db.sql.prepare("INSERT INTO policy_strikes (id, user_id, reason, issued_at) VALUES ('k3', ?, 'late', ?)").run(ids.star, Date.UTC(2026, 6, 10));
    expect(repo.snapshot('2026-07', now + DAY)).toBe('exists');
    expect(repo.snapshotClosedMonths(now + DAY)).toEqual([]);
    expect(JSON.stringify(tables())).toBe(before);
    expect(srv.db.sql.prepare("SELECT artist_name, streams, premium_streams, eligible FROM royalty_period_artists WHERE period = '2026-07' ORDER BY premium_streams DESC").all()).toEqual([
      { artist_name: 'star', streams: 800, premium_streams: 500, eligible: 1 },
      { artist_name: 'other', streams: 100, premium_streams: 100, eligible: 0 },
    ]);
  });

  it('fills in every month it missed, starting from the first play', () => {
    streams(1, 'song-1', ids.star, Date.UTC(2026, 1, 10), 'free');
    const written = repo.snapshotClosedMonths(Date.UTC(2026, 9, 19));
    // April to July were written above (the first play then was in April).
    expect(written).toEqual(['2026-02', '2026-03', '2026-08', '2026-09']);
    expect(repo.periods().map((p) => p.period)).toEqual(['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02']);
  });

  it('uses the stream rules everywhere', () => {
    expect(ROYALTY_RULES).toMatchObject({ minSeconds: 30, minPremiumStreams: 500, windowDays: 90, minPublishedTracks: 3, artistShare: 0.8 });
  });
});
