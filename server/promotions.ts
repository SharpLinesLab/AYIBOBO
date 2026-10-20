/**
 * Promoted tracks: artists buy a package (1, 3 or 7 days at a fixed price) to boost one of their
 * published songs in the Discover and genre feeds. Until Stripe is connected, a new promotion waits in pending_payment and
 * an admin activates it by hand (a test path). Promotion revenue is kept entirely apart from
 * royalties: the royalty code never reads these tables, and nothing here touches royalty_*.
 */
import { randomUUID } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { PACKAGES, PROMOTION_RULES, packageById, utcDay, type PricedPackage, type PromotionStatus } from '../src/lib/promotionRules';
import { currentUser, requireRole, sameOrigin } from './auth';
import type { Db } from './db';

const DAY = 86_400_000;
/** Each package's price lives in settings under this prefix plus its id. */
const PRICE_KEY = 'promotion_package_cents:';

/** Error codes the browser shows in the visitor's language (`account.promote.error.*` / `admin.promotions.error.*`). */
export type PromotionError = 'not_published' | 'invalid_package' | 'invalid_dates' | 'in_past' | 'too_far' | 'overlap' | 'not_found' | 'not_pending' | 'expired' | 'not_cancellable' | 'invalid_prices';

interface Row {
  id: string;
  track_id: string;
  artist_id: string;
  starts_at: number;
  ends_at: number;
  status: PromotionStatus;
  price_cents: number;
  stripe_payment_id: string | null;
  created_at: number;
  activated_at: number | null;
  cancelled_at: number | null;
  title: string;
  artist_name: string | null;
}

export interface Promotion {
  id: string;
  trackId: string;
  title: string;
  artistId: string;
  artistName: string;
  startsAt: number;
  /** Exclusive: midnight UTC after the last day. */
  endsAt: number;
  days: number;
  status: PromotionStatus;
  priceCents: number;
  stripePaymentId: string | null;
  createdAt: number;
  activatedAt: number | null;
  cancelledAt: number | null;
}

const toPromotion = (r: Row): Promotion => ({
  id: r.id,
  trackId: r.track_id,
  title: r.title,
  artistId: r.artist_id,
  artistName: r.artist_name ?? '',
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  days: Math.round((r.ends_at - r.starts_at) / DAY),
  status: r.status,
  priceCents: r.price_cents,
  stripePaymentId: r.stripe_payment_id,
  createdAt: r.created_at,
  activatedAt: r.activated_at,
  cancelledAt: r.cancelled_at,
});

const SELECT = `SELECT p.*, u.title, COALESCE(u.artist_name, a.artist_name, a.display_name) AS artist_name
  FROM promotions p JOIN uploads u ON u.id = p.track_id JOIN users a ON a.id = p.artist_id`;

export function promotionsRepo(db: Db) {
  const q = db.sql;

  /** Move paid promotions along with the calendar: scheduled → active → ended. */
  function refresh(now = Date.now()) {
    q.prepare("UPDATE promotions SET status = 'ended' WHERE status IN ('active', 'scheduled') AND ends_at <= ?").run(now);
    q.prepare("UPDATE promotions SET status = 'active' WHERE status = 'scheduled' AND starts_at <= ?").run(now);
  }

  /** Every package with its current price, in cents. */
  function packages(): PricedPackage[] {
    const get = q.prepare('SELECT value FROM settings WHERE key = ?');
    return PACKAGES.map((p) => {
      const n = Number((get.get(PRICE_KEY + p.id) as { value: string } | undefined)?.value);
      return { id: p.id, days: p.days, priceCents: Number.isInteger(n) && n > 0 ? n : p.defaultCents };
    });
  }

  /**
   * Change package prices: `{ day1: 600, … }` in cents, any of the packages. All or nothing.
   * Promotions already created keep the price they were made with.
   */
  function setPrices(prices: unknown, now = Date.now()): PromotionError | PricedPackage[] {
    if (!prices || typeof prices !== 'object' || Array.isArray(prices)) return 'invalid_prices';
    const entries = Object.entries(prices as Record<string, unknown>);
    const ok = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= PROMOTION_RULES.maxPackageCents;
    if (!entries.length || entries.some(([id, v]) => !packageById(id) || !ok(v))) return 'invalid_prices';
    const put = q.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
    db.transaction(() => {
      for (const [id, v] of entries) put.run(PRICE_KEY + id, String(v), now);
    });
    return packages();
  }

  const byId = (id: string) => q.prepare(`${SELECT} WHERE p.id = ?`).get(id) as Row | undefined;

  /**
   * A new promotion of one of the artist's own published songs: a package of days from
   * `startDate` (a UTC day, included). Priced at the package's current price; it waits for payment.
   */
  function create(artistId: string, trackId: unknown, packageId: unknown, startDate: unknown, now = Date.now()): PromotionError | Promotion {
    const track = typeof trackId === 'string' ? (q.prepare("SELECT id FROM uploads WHERE id = ? AND user_id = ? AND status = 'approved'").get(trackId, artistId) as { id: string } | undefined) : undefined;
    if (!track) return 'not_published';
    const pkg = packages().find((p) => p.id === packageId);
    if (!pkg) return 'invalid_package';
    const start = typeof startDate === 'string' ? utcDay(startDate) : null;
    if (start === null) return 'invalid_dates';
    const today = Math.floor(now / DAY) * DAY;
    if (start < today) return 'in_past';
    if (start > today + PROMOTION_RULES.maxLeadDays * DAY) return 'too_far';
    // Exclusive: midnight after the last day.
    const end = start + pkg.days * DAY;
    return db.transaction(() => {
      // Cancelled promotions free their dates; any other one holds them.
      const clash = q.prepare("SELECT 1 FROM promotions WHERE track_id = ? AND status != 'cancelled' AND starts_at < ? AND ends_at > ?").get(track.id, end, start);
      if (clash) return 'overlap' as const;
      const id = randomUUID();
      q.prepare("INSERT INTO promotions (id, track_id, artist_id, starts_at, ends_at, status, price_cents, created_at) VALUES (?, ?, ?, ?, ?, 'pending_payment', ?, ?)").run(
        id,
        track.id,
        artistId,
        start,
        end,
        pkg.priceCents,
        now,
      );
      return toPromotion(byId(id)!);
    });
  }

  function mine(artistId: string, now = Date.now()): Promotion[] {
    refresh(now);
    return (q.prepare(`${SELECT} WHERE p.artist_id = ? ORDER BY p.starts_at DESC, p.created_at DESC`).all(artistId) as unknown as Row[]).map(toPromotion);
  }

  function all(now = Date.now()): Promotion[] {
    refresh(now);
    return (q.prepare(`${SELECT} ORDER BY p.created_at DESC`).all() as unknown as Row[]).map(toPromotion);
  }

  /** Test path until Stripe: an admin marks a pending promotion as paid. */
  function activate(id: string, now = Date.now()): PromotionError | Promotion {
    refresh(now);
    const r = byId(id);
    if (!r) return 'not_found';
    if (r.status !== 'pending_payment') return 'not_pending';
    if (r.ends_at <= now) return 'expired';
    q.prepare('UPDATE promotions SET status = ?, activated_at = ? WHERE id = ?').run(r.starts_at <= now ? 'active' : 'scheduled', now, id);
    return toPromotion(byId(id)!);
  }

  /** Cancel a promotion that hasn't ended; its dates are free again. */
  function cancel(id: string, now = Date.now()): PromotionError | Promotion {
    refresh(now);
    const r = byId(id);
    if (!r) return 'not_found';
    if (r.status === 'ended' || r.status === 'cancelled') return 'not_cancellable';
    q.prepare("UPDATE promotions SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(now, id);
    return toPromotion(byId(id)!);
  }

  /** Promotion revenue collected: paid promotions, less cancelled ones. Never part of royalties. */
  function revenueCents(): number {
    return (q.prepare("SELECT COALESCE(SUM(price_cents), 0) AS n FROM promotions WHERE activated_at IS NOT NULL AND status != 'cancelled'").get() as { n: number }).n;
  }

  /** Songs to boost right now: active promotions inside their dates, of songs still published. */
  function activeTrackIds(now = Date.now()): string[] {
    refresh(now);
    return (
      q
        .prepare(
          `SELECT DISTINCT p.track_id FROM promotions p JOIN uploads u ON u.id = p.track_id
           WHERE p.status = 'active' AND p.starts_at <= ? AND p.ends_at > ? AND u.status = 'approved' ORDER BY p.track_id`,
        )
        .all(now, now) as { track_id: string }[]
    ).map((r) => r.track_id);
  }

  return { refresh, packages, setPrices, create, mine, all, activate, cancel, revenueCents, activeTrackIds };
}

export interface PromotionRoutesConfig {
  db: Db;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

export function registerPromotionRoutes(app: Express, cfg: PromotionRoutesConfig) {
  const repo = promotionsRepo(cfg.db);
  const STATUS: Partial<Record<PromotionError, number>> = { not_found: 404, overlap: 409, not_pending: 409, expired: 409, not_cancellable: 409 };
  const answer = (res: Parameters<RequestHandler>[1], out: PromotionError | Promotion, ok = 200) => {
    if (typeof out === 'string') return void res.status(STATUS[out] ?? 400).json({ ok: false, code: out });
    res.status(ok).json({ ok: true, promotion: out });
  };

  // Public: the songs being promoted right now (upload ids). The browser picks which to show.
  app.get('/api/promoted', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ ok: true, trackIds: repo.activeTrackIds() });
  });

  app.get('/api/promotions/mine', requireRole('artist', 'admin'), (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, packages: repo.packages(), promotions: repo.mine(currentUser(res)!.id) });
  });

  // JSON { trackId, packageId, startDate } (YYYY-MM-DD); the package decides the days and price.
  app.post('/api/promotions', cfg.rateLimit('promotions', 20, 60 * 60_000), sameOrigin, requireRole('artist', 'admin'), (req, res) => {
    answer(res, repo.create(currentUser(res)!.id, req.body?.trackId, req.body?.packageId, req.body?.startDate), 201);
  });

  // --- admins (everyone else gets a plain 404) ---------------------------------------------------

  const adminOnly: RequestHandler = (_req, res, next) => {
    if (currentUser(res)?.role === 'admin') return next();
    res.status(404).json({ ok: false, error: 'Not found' });
  };
  const moderate = cfg.rateLimit('moderate', 120, 60_000);

  app.get('/api/admin/promotions', adminOnly, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, packages: repo.packages(), revenueCents: repo.revenueCents(), promotions: repo.all() });
  });
  app.post('/api/admin/promotions/:id/activate', moderate, sameOrigin, adminOnly, (req, res) => answer(res, repo.activate(String(req.params.id))));
  app.post('/api/admin/promotions/:id/cancel', moderate, sameOrigin, adminOnly, (req, res) => answer(res, repo.cancel(String(req.params.id))));

  // JSON { prices: { day1?, day3?, day7? } } in cents: the prices of new promotions.
  app.put('/api/admin/promotions/packages', moderate, sameOrigin, adminOnly, (req, res) => {
    const out = repo.setPrices(req.body?.prices);
    if (typeof out === 'string') return void res.status(400).json({ ok: false, code: out });
    res.json({ ok: true, packages: out });
  });

  return repo;
}
