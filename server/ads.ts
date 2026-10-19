/**
 * Audio ads for the free tier. Admins upload short ads (up to 30 seconds) and choose when they
 * run and how often (weight). Players ask `GET /api/ads/next` between songs: it picks an active ad
 * in its date window, weighted at random, never more than 3 plays per ad per listener per day,
 * and logs the play. Premium accounts never get one.
 */
import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { Express, Request, RequestHandler, Response } from 'express';
import { currentUser, sameOrigin } from './auth';
import type { Db } from './db';
import type { Storage } from './storage';
import { readUpload, sendStored, UploadError, type UploadLimits } from './uploads';

/** Longest ad, in seconds. */
export const MAX_AD_SECONDS = 30;
/** An ad plays at most this many times per listener per (UTC) day. */
export const DAILY_CAP = 3;
const MAX_WEIGHT = 100;
const MAX_TEXT = 100;
const DAY = 86_400_000;

/** Error codes the admin page shows in the visitor's language. */
export type AdErrorCode = 'invalid_title' | 'invalid_advertiser' | 'invalid_duration' | 'invalid_weight' | 'invalid_dates';

export interface AdRecord {
  id: string;
  title: string;
  advertiserName: string;
  audioType: string;
  audioSize: number;
  duration: number;
  weight: number;
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
  createdAt: number;
}

interface Row {
  id: string;
  title: string;
  advertiser_name: string;
  audio_type: string;
  audio_size: number;
  duration: number;
  weight: number;
  active: number;
  starts_at: number | null;
  ends_at: number | null;
  created_at: number;
}

const toAd = (r: Row): AdRecord => ({
  id: r.id,
  title: r.title,
  advertiserName: r.advertiser_name,
  audioType: r.audio_type,
  audioSize: r.audio_size,
  duration: r.duration,
  weight: r.weight,
  active: r.active === 1,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  createdAt: r.created_at,
});

/** Pick one ad, each with probability weight / total weight. `rand` is in [0, 1). */
export function pickWeighted<T extends { weight: number }>(items: T[], rand = Math.random()): T | null {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let at = rand * total;
  for (const x of items) {
    at -= x.weight;
    if (at < 0) return x;
  }
  return items.at(-1) ?? null;
}

const startOfUtcDay = (t: number) => Math.floor(t / DAY) * DAY;
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Who's listening, for the daily cap: the account when signed in; otherwise the browser's random
 * listener id (the `x-asf-listener` header) or, without one, a hash of the IP address.
 */
function listenerKey(req: Request, res: Response): string {
  const user = currentUser(res);
  if (user) return `u:${user.id}`;
  const header = req.headers['x-asf-listener'];
  if (typeof header === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(header)) return `a:${header}`;
  return `ip:${createHash('sha256').update(req.ip ?? '').digest('hex').slice(0, 32)}`;
}

// --- fields -----------------------------------------------------------------------------------

class AdFieldError extends Error {
  constructor(readonly code: AdErrorCode) {
    super(code);
  }
}

const oneLine = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '');

/** A time in ms (number or numeric string); empty means "no limit". */
function time(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new AdFieldError('invalid_dates');
  return Math.round(n);
}

/** Validate the editable fields; `partial` allows leaving any of them out (PATCH). */
function cleanFields(f: Record<string, unknown>, partial: boolean) {
  const out: Partial<Pick<AdRecord, 'title' | 'advertiserName' | 'weight' | 'active' | 'startsAt' | 'endsAt'>> = {};
  if (!partial || 'title' in f) {
    const v = oneLine(f.title);
    if (!v || v.length > MAX_TEXT) throw new AdFieldError('invalid_title');
    out.title = v;
  }
  if (!partial || 'advertiserName' in f) {
    const v = oneLine(f.advertiserName);
    if (!v || v.length > MAX_TEXT) throw new AdFieldError('invalid_advertiser');
    out.advertiserName = v;
  }
  if (!partial || 'weight' in f) {
    const v = f.weight === undefined || f.weight === '' ? 1 : Number(f.weight);
    if (!Number.isInteger(v) || v < 1 || v > MAX_WEIGHT) throw new AdFieldError('invalid_weight');
    out.weight = v;
  }
  if (!partial || 'active' in f) out.active = f.active === true || f.active === '1' || f.active === 'true';
  if (!partial || 'startsAt' in f) out.startsAt = time(f.startsAt);
  if (!partial || 'endsAt' in f) out.endsAt = time(f.endsAt);
  return out;
}

// --- routes -----------------------------------------------------------------------------------

export interface AdRoutesConfig {
  db: Db;
  storage: Storage;
  limits: UploadLimits;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

export function registerAdRoutes(app: Express, cfg: AdRoutesConfig) {
  const { db, storage } = cfg;
  const get = (id: string) => {
    const r = db.sql.prepare('SELECT * FROM ads WHERE id = ?').get(id) as Row | undefined;
    return r ? toAd(r) : null;
  };
  const notFound = (res: Response) => res.status(404).json({ ok: false, error: 'Not found' });
  const fail = (res: Response, e: unknown) => {
    if (e instanceof AdFieldError || e instanceof UploadError) res.status(e instanceof UploadError ? e.status : 400).json({ ok: false, code: e.code });
    else throw e;
  };

  /** Plays per UTC day for the last 7 days, oldest first. */
  const playsByDay = (adId: string, now = Date.now()) => {
    const from = startOfUtcDay(now) - 6 * DAY;
    const rows = db.sql.prepare('SELECT played_at FROM ad_plays WHERE ad_id = ? AND played_at >= ?').all(adId, from) as { played_at: number }[];
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(day(r.played_at), (counts.get(day(r.played_at)) ?? 0) + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = day(from + i * DAY);
      return { day: d, plays: counts.get(d) ?? 0 };
    });
  };
  const forAdmin = (a: AdRecord) => ({ ...a, audioUrl: `/api/admin/ads/${a.id}/audio`, playsByDay: playsByDay(a.id) });

  // --- listeners -----------------------------------------------------------------------------------

  // 204 when no ad should play: premium, nothing active, or every candidate already hit its cap.
  app.get('/api/ads/next', cfg.rateLimit('ads', 120, 60 * 60_000), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = currentUser(res);
    if (user?.tier === 'premium') return void res.status(204).end();
    const now = Date.now();
    const listener = listenerKey(req, res);
    const candidates = (
      db.sql
        .prepare(
          `SELECT a.* FROM ads a
           WHERE a.active = 1 AND (a.starts_at IS NULL OR a.starts_at <= ?) AND (a.ends_at IS NULL OR a.ends_at > ?)
             AND (SELECT COUNT(*) FROM ad_plays p WHERE p.ad_id = a.id AND p.listener = ? AND p.played_at >= ?) < ?`,
        )
        .all(now, now, listener, startOfUtcDay(now), DAILY_CAP) as unknown as Row[]
    ).map(toAd);
    const ad = pickWeighted(candidates);
    if (!ad) return void res.status(204).end();
    db.sql.prepare('INSERT INTO ad_plays (ad_id, user_id, listener, played_at) VALUES (?, ?, ?, ?)').run(ad.id, user?.id ?? null, listener, now);
    res.json({ ok: true, ad: { id: ad.id, title: ad.title, advertiserName: ad.advertiserName, duration: ad.duration, audioUrl: `/api/ads/${ad.id}/audio` } });
  });

  app.get('/api/ads/:id/audio', (req, res) => {
    const ad = get(String(req.params.id));
    if (!ad || !ad.active) return void notFound(res);
    void sendStored(req, res, storage, `ads/${ad.id}`, ad.audioType, 'public, max-age=3600');
  });

  // --- admins (everyone else gets a plain 404, as if it didn't exist) ----------------------------

  const adminOnly: RequestHandler = (_req, res, next) => {
    if (currentUser(res)?.role === 'admin') return next();
    notFound(res);
  };
  const writeLimit = cfg.rateLimit('ads-admin', 120, 60_000);

  app.get('/api/admin/ads', adminOnly, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const rows = db.sql.prepare('SELECT * FROM ads ORDER BY created_at DESC').all() as unknown as Row[];
    res.json({ ok: true, ads: rows.map(toAd).map(forAdmin) });
  });

  app.get('/api/admin/ads/:id/audio', adminOnly, (req, res) => {
    const ad = get(String(req.params.id));
    if (!ad) return void notFound(res);
    void sendStored(req, res, storage, `ads/${ad.id}`, ad.audioType, 'private, no-store');
  });

  // Multipart: `audio` plus `title`, `advertiserName`, `duration` (seconds, measured by the
  // browser), and optional `weight`, `active`, `startsAt`, `endsAt` (ms).
  app.post('/api/admin/ads', writeLimit, sameOrigin, adminOnly, async (req, res) => {
    let incoming: { fields: Record<string, string>; audio: { path: string; size: number; type: string } } | null = null;
    const id = randomUUID();
    try {
      incoming = await readUpload(req, storage, cfg.limits, { cover: false });
      const fields = cleanFields(incoming.fields, false);
      const duration = Number(incoming.fields.duration);
      if (!Number.isFinite(duration) || duration < 1 || duration > MAX_AD_SECONDS) throw new AdFieldError('invalid_duration');
      if (fields.startsAt !== null && fields.endsAt !== null && fields.endsAt! <= fields.startsAt!) throw new AdFieldError('invalid_dates');
      await storage.putFile(`ads/${id}`, incoming.audio.path);
      db.sql
        .prepare(
          `INSERT INTO ads (id, title, advertiser_name, audio_type, audio_size, duration, weight, active, starts_at, ends_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, fields.title!, fields.advertiserName!, incoming.audio.type, incoming.audio.size, Math.round(duration * 100) / 100, fields.weight!, fields.active ? 1 : 0, fields.startsAt ?? null, fields.endsAt ?? null, Date.now());
      res.status(201).json({ ok: true, ad: forAdmin(get(id)!) });
    } catch (e) {
      if (incoming) {
        await rm(incoming.audio.path, { force: true });
        await storage.delete(`ads/${id}`);
      }
      fail(res, e);
    }
  });

  // JSON with any of: title, advertiserName, weight, active, startsAt, endsAt (null clears a date).
  app.patch('/api/admin/ads/:id', writeLimit, sameOrigin, adminOnly, (req, res) => {
    const ad = get(String(req.params.id));
    if (!ad) return void notFound(res);
    try {
      const f = cleanFields((req.body ?? {}) as Record<string, unknown>, true);
      const next = { ...ad, ...f };
      if (next.startsAt !== null && next.endsAt !== null && next.endsAt <= next.startsAt) throw new AdFieldError('invalid_dates');
      db.sql
        .prepare('UPDATE ads SET title = ?, advertiser_name = ?, weight = ?, active = ?, starts_at = ?, ends_at = ? WHERE id = ?')
        .run(next.title, next.advertiserName, next.weight, next.active ? 1 : 0, next.startsAt, next.endsAt, ad.id);
      res.json({ ok: true, ad: forAdmin(get(ad.id)!) });
    } catch (e) {
      fail(res, e);
    }
  });

  // Deletes the audio file and the ad's play history.
  app.delete('/api/admin/ads/:id', writeLimit, sameOrigin, adminOnly, async (req, res) => {
    const ad = get(String(req.params.id));
    if (!ad) return void notFound(res);
    await storage.delete(`ads/${ad.id}`);
    db.sql.prepare('DELETE FROM ads WHERE id = ?').run(ad.id);
    res.json({ ok: true });
  });
}
