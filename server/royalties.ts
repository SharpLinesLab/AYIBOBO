/**
 * Artist royalties in shadow mode: every play is logged, eligibility is computed when it's read
 * (no background job keeps it up to date), and each closed month is snapshotted into
 * royalty_periods. No money moves yet: payouts are wired to real subscription revenue later.
 */
import type { Express, RequestHandler } from 'express';
import { ROYALTY_RULES, eligibilityCriteria, isEligible, periodOf, periodRange, type EligibilityCriteria } from '../src/lib/royaltyMath';
import { currentUser, requireRole, sameOrigin, type Tier } from './auth';
import type { Db } from './db';

const DAY = 86_400_000;
const WINDOW = ROYALTY_RULES.windowDays * DAY;
/** Seconds a report may run ahead of the server's clock (network delay, timer drift). */
const SLACK = 5;
const STREAM = `seconds_listened >= ${ROYALTY_RULES.minSeconds}`;
const PLAY_ID = /^[\w-]{8,64}$/;
const TRACK_ID = /^[\w:.-]{1,120}$/;

/** An artist's eligibility on a given day, with the numbers behind it. */
export interface ArtistStatus {
  verified: boolean;
  premiumStreams90d: number;
  publishedTracks: number;
  activeStrikes: number;
  criteria: EligibilityCriteria;
  eligible: boolean;
}

export interface ArtistMonth extends ArtistStatus {
  artistId: string;
  artistName: string;
  /** Royalty streams this month, from every listener. */
  streams: number;
  /** The ones from premium listeners: what payouts are shared by. */
  premiumStreams: number;
}

export interface MonthSummary {
  period: string;
  /** Eligibility is evaluated on this day: the end of the month, or now while it's still running. */
  asOf: number;
  totalStreams: number;
  premiumStreams: number;
  eligibleArtists: number;
  /** Premium streams of eligible artists: the denominator of every artist's share. */
  eligibleStreams: number;
  artists: ArtistMonth[];
}

export interface RoyaltyPeriod {
  period: string;
  startsAt: number;
  endsAt: number;
  totalStreams: number;
  premiumStreams: number;
  eligibleArtists: number;
  eligibleStreams: number;
  createdAt: number;
}

export function royaltiesRepo(db: Db) {
  const q = db.sql;
  const count = (sql: string, ...args: (string | number)[]) => (q.prepare(sql).get(...args) as { n: number }).n;
  const streams = (artistId: string, from: number, to: number, premiumOnly: boolean) =>
    count(`SELECT COUNT(*) AS n FROM royalty_plays WHERE artist_id = ? AND played_at >= ? AND played_at < ? AND ${STREAM}${premiumOnly ? " AND listener_tier = 'premium'" : ''}`, artistId, from, to);

  /**
   * Log a play, or update it: the browser reports the same `playId` as listening goes on, and the
   * row keeps the longest time heard. The time can't exceed the song's length, nor the real time
   * since the first report. Only published songs are logged. The tier is the listener's when the
   * play started.
   */
  function logPlay(user: { id: string; tier: Tier }, playId: string, trackId: string, seconds: number, now = Date.now()): 'logged' | 'unknown_track' | 'conflict' {
    const track = q.prepare("SELECT user_id, duration FROM uploads WHERE id = ? AND status = 'approved'").get(trackId) as { user_id: string; duration: number } | undefined;
    if (!track) return 'unknown_track';
    const max = Math.ceil(track.duration) + SLACK;
    const heard = Math.max(0, Math.floor(seconds));
    const row = q.prepare('SELECT user_id, track_id, played_at FROM royalty_plays WHERE play_id = ?').get(playId) as { user_id: string | null; track_id: string; played_at: number } | undefined;
    if (!row) {
      q.prepare('INSERT INTO royalty_plays (play_id, user_id, track_id, artist_id, played_at, seconds_listened, listener_tier) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        playId,
        user.id,
        trackId,
        track.user_id,
        now,
        Math.min(heard, max, SLACK),
        user.tier,
      );
      return 'logged';
    }
    if (row.user_id !== user.id || row.track_id !== trackId) return 'conflict';
    const elapsed = Math.floor((now - row.played_at) / 1000) + SLACK;
    q.prepare('UPDATE royalty_plays SET seconds_listened = MAX(seconds_listened, ?) WHERE play_id = ?').run(Math.min(heard, max, elapsed), playId);
    return 'logged';
  }

  /** Eligibility as of `at`: the trailing 90 days of premium streams, songs published and strikes active then. */
  function status(artistId: string, at = Date.now()): ArtistStatus {
    const user = q.prepare('SELECT verified FROM users WHERE id = ?').get(artistId) as { verified: number } | undefined;
    const numbers = {
      // There's no verification history: this is the account's current checkmark.
      verified: user?.verified === 1,
      premiumStreams90d: streams(artistId, at - WINDOW, at, true),
      publishedTracks: count("SELECT COUNT(*) AS n FROM uploads WHERE user_id = ? AND status = 'approved' AND COALESCE(reviewed_at, created_at) < ?", artistId, at),
      activeStrikes: count(
        'SELECT COUNT(*) AS n FROM policy_strikes WHERE user_id = ? AND issued_at < ? AND (lifted_at IS NULL OR lifted_at >= ?) AND (expires_at IS NULL OR expires_at > ?)',
        artistId,
        at,
        at,
        at,
      ),
    };
    const criteria = eligibilityCriteria(numbers);
    return { ...numbers, criteria, eligible: isEligible(criteria) };
  }

  /** What an artist sees on #/account. */
  function dashboard(artistId: string, now = Date.now()) {
    const month = periodRange(periodOf(now))!;
    return {
      period: periodOf(now),
      streamsThisMonth: streams(artistId, month.start, now + 1, false),
      streams90d: streams(artistId, now - WINDOW, now + 1, false),
      ...status(artistId, now + 1),
    };
  }

  /** A month's royalty streams and every artist's share of them (eligibility as of the month's end). */
  function summary(period: string, now = Date.now()): MonthSummary | null {
    const range = periodRange(period);
    if (!range) return null;
    const asOf = Math.min(now + 1, range.end);
    const ids = (
      q.prepare(`SELECT DISTINCT artist_id FROM royalty_plays WHERE played_at >= ? AND played_at < ? AND ${STREAM}`).all(Math.min(range.start, asOf - WINDOW), asOf) as { artist_id: string }[]
    ).map((r) => r.artist_id);
    const name = q.prepare('SELECT COALESCE(artist_name, display_name) AS name FROM users WHERE id = ?');
    const artists = ids
      .map((artistId): ArtistMonth => ({
        artistId,
        artistName: (name.get(artistId) as { name: string } | undefined)?.name ?? artistId,
        streams: streams(artistId, range.start, asOf, false),
        premiumStreams: streams(artistId, range.start, asOf, true),
        ...status(artistId, asOf),
      }))
      .filter((a) => a.streams > 0 || a.eligible)
      .sort((a, b) => b.premiumStreams - a.premiumStreams || b.streams - a.streams || a.artistName.localeCompare(b.artistName));
    const eligible = artists.filter((a) => a.eligible);
    return {
      period,
      asOf,
      totalStreams: count(`SELECT COUNT(*) AS n FROM royalty_plays WHERE played_at >= ? AND played_at < ? AND ${STREAM}`, range.start, asOf),
      premiumStreams: count(`SELECT COUNT(*) AS n FROM royalty_plays WHERE played_at >= ? AND played_at < ? AND ${STREAM} AND listener_tier = 'premium'`, range.start, asOf),
      eligibleArtists: eligible.length,
      eligibleStreams: eligible.reduce((n, a) => n + a.premiumStreams, 0),
      artists,
    };
  }

  /**
   * Write a closed month's totals into royalty_periods, once. Running it again for the same month
   * changes nothing; a month that hasn't ended yet isn't written.
   */
  function snapshot(period: string, now = Date.now()): 'created' | 'exists' | 'open' | 'invalid' {
    const range = periodRange(period);
    if (!range) return 'invalid';
    if (range.end > now) return 'open';
    return db.transaction(() => {
      if (q.prepare('SELECT 1 FROM royalty_periods WHERE period = ?').get(period)) return 'exists';
      const s = summary(period, now)!;
      q.prepare('INSERT INTO royalty_periods (period, starts_at, ends_at, total_streams, premium_streams, eligible_artists, eligible_streams, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        period,
        range.start,
        range.end,
        s.totalStreams,
        s.premiumStreams,
        s.eligibleArtists,
        s.eligibleStreams,
        now,
      );
      const put = q.prepare(
        `INSERT INTO royalty_period_artists (period, artist_id, artist_name, streams, premium_streams, premium_streams_90d, published_tracks, verified, active_strikes, eligible)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const a of s.artists) put.run(period, a.artistId, a.artistName, a.streams, a.premiumStreams, a.premiumStreams90d, a.publishedTracks, a.verified ? 1 : 0, a.activeStrikes, a.eligible ? 1 : 0);
      return 'created';
    });
  }

  /** Snapshot every closed month that has none yet, from the first logged play (or last month) on. */
  function snapshotClosedMonths(now = Date.now()): string[] {
    const last = periodRange(periodOf(now))!.start - 1;
    const first = (q.prepare('SELECT MIN(played_at) AS t FROM royalty_plays').get() as { t: number | null }).t;
    const written: string[] = [];
    for (let t = Math.min(first ?? last, last); t <= last; t = periodRange(periodOf(t))!.end) {
      if (snapshot(periodOf(t), now) === 'created') written.push(periodOf(t));
    }
    return written;
  }

  function periods(): RoyaltyPeriod[] {
    return (q.prepare('SELECT * FROM royalty_periods ORDER BY period DESC').all() as Record<string, number & string>[]).map((r) => ({
      period: r.period,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      totalStreams: r.total_streams,
      premiumStreams: r.premium_streams,
      eligibleArtists: r.eligible_artists,
      eligibleStreams: r.eligible_streams,
      createdAt: r.created_at,
    }));
  }

  return { logPlay, status, dashboard, summary, snapshot, snapshotClosedMonths, periods };
}

export type RoyaltiesRepo = ReturnType<typeof royaltiesRepo>;

/**
 * The monthly snapshot job: runs at start-up and then every hour, writing any closed month that
 * isn't in royalty_periods yet (so a server that was down on the 1st catches up). Idempotent.
 */
export function startRoyaltySnapshots(repo: RoyaltiesRepo, everyMs = 60 * 60_000): () => void {
  const run = () => {
    try {
      const written = repo.snapshotClosedMonths();
      if (written.length) console.log(`royalties: snapshot written for ${written.join(', ')} (pre-launch, no money moved)`);
    } catch (e) {
      console.error('royalty snapshot failed', e);
    }
  };
  run();
  const timer = setInterval(run, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}

export interface RoyaltyRoutesConfig {
  db: Db;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

export function registerRoyaltyRoutes(app: Express, cfg: RoyaltyRoutesConfig) {
  const repo = royaltiesRepo(cfg.db);

  // JSON { playId, trackId, seconds }: the signed-in listener played a published song. Sent when it
  // starts, again at 30 seconds and when it stops; each report updates the same play.
  app.post('/api/plays', cfg.rateLimit('plays', 1200, 60 * 60_000), sameOrigin, requireRole(), (req, res) => {
    const { playId, trackId, seconds } = (req.body ?? {}) as Record<string, unknown>;
    const n = Number(seconds);
    if (typeof playId !== 'string' || !PLAY_ID.test(playId) || typeof trackId !== 'string' || !TRACK_ID.test(trackId) || !Number.isFinite(n) || n < 0 || n > 86_400) {
      return void res.status(400).json({ ok: false, code: 'invalid_play' });
    }
    const out = repo.logPlay(currentUser(res)!, playId, trackId, n);
    if (out === 'unknown_track') return void res.status(404).json({ ok: false, error: 'Not found' });
    if (out === 'conflict') return void res.status(409).json({ ok: false, code: 'conflict' });
    res.status(204).end();
  });

  app.get('/api/account/royalties', requireRole('artist', 'admin'), (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, preLaunch: true, ...repo.dashboard(currentUser(res)!.id) });
  });

  // Read-only. Everyone but admins gets a plain 404, as if it didn't exist.
  app.get('/api/admin/royalties', (req, res) => {
    if (currentUser(res)?.role !== 'admin') return void res.status(404).json({ ok: false, error: 'Not found' });
    const period = typeof req.query.period === 'string' && req.query.period ? req.query.period : periodOf(Date.now());
    const summary = repo.summary(period);
    if (!summary) return void res.status(400).json({ ok: false, code: 'invalid_period' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, preLaunch: true, summary, periods: repo.periods() });
  });

  return repo;
}
