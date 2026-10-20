/**
 * Account administration: the user list, roles, the verified checkmark and policy strikes, plus
 * the numbers on the admin overview. The same strike helpers back `manage strike` / `lift-strikes`.
 */
import { randomUUID } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { ROLES, currentUser, sameOrigin, type Auth, type Role, type Tier } from './auth';
import type { Db } from './db';
import { royaltiesRepo } from './royalties';

/** Longest strike reason, in characters. */
export const MAX_STRIKE_REASON = 500;
/** The user list shows the newest accounts first, at most this many. */
export const USER_LIST_LIMIT = 1000;

/** Record an active policy strike (it stays active until lifted). */
export function issueStrike(db: Db, userId: string, reason: string, now = Date.now()) {
  db.sql.prepare('INSERT INTO policy_strikes (id, user_id, reason, issued_at) VALUES (?, ?, ?, ?)').run(randomUUID(), userId, reason, now);
}

/** Lift every strike on the account that isn't lifted yet; returns how many. */
export function liftStrikes(db: Db, userId: string, now = Date.now()): number {
  return Number(db.sql.prepare('UPDATE policy_strikes SET lifted_at = ? WHERE user_id = ? AND lifted_at IS NULL').run(now, userId).changes);
}

const ACTIVE_STRIKES = '(SELECT COUNT(*) FROM policy_strikes s WHERE s.user_id = u.id AND s.lifted_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > ?))';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  artistName: string | null;
  role: Role;
  verified: boolean;
  tier: Tier;
  createdAt: number;
  activeStrikes: number;
}

export interface AdminUsersConfig {
  db: Db;
  auth: Auth;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

export function registerAdminUserRoutes(app: Express, cfg: AdminUsersConfig) {
  const { db } = cfg;
  const q = db.sql;
  const royalties = royaltiesRepo(db);
  const count = (sql: string, ...args: number[]) => (q.prepare(sql).get(...args) as { n: number }).n;

  // Everyone but admins gets a plain 404, as if none of this existed.
  const adminOnly: RequestHandler = (_req, res, next) => {
    if (currentUser(res)?.role === 'admin') return next();
    res.status(404).json({ ok: false, error: 'Not found' });
  };
  const writeLimit = cfg.rateLimit('admin-users', 120, 60_000);

  const one = (id: string, now = Date.now()): AdminUser | null => {
    const r = q.prepare(`SELECT u.*, ${ACTIVE_STRIKES} AS strikes FROM users u WHERE u.id = ?`).get(now, id) as Record<string, string & number> | undefined;
    return r ? toAdmin(r) : null;
  };
  const toAdmin = (r: Record<string, string & number>): AdminUser => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    artistName: r.artist_name ?? null,
    role: r.role as Role,
    verified: r.verified === 1,
    tier: r.tier as Tier,
    createdAt: r.created_at,
    activeStrikes: r.strikes,
  });

  // The admin overview's numbers. "Today" is the UTC day, as for ad frequency caps.
  app.get('/api/admin/overview', adminOnly, (_req, res) => {
    const now = Date.now();
    const today = Math.floor(now / 86_400_000) * 86_400_000;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      pendingUploads: count("SELECT COUNT(*) AS n FROM uploads WHERE status = 'pending'"),
      pendingVerifications: count("SELECT COUNT(*) AS n FROM verification_requests WHERE status = 'pending'"),
      users: count('SELECT COUNT(*) AS n FROM users'),
      artists: count("SELECT COUNT(*) AS n FROM users WHERE role = 'artist'"),
      royaltyStreamsToday: royalties.streamsBetween(today, now + 1),
      adPlaysToday: count('SELECT COUNT(*) AS n FROM ad_plays WHERE played_at >= ?', today),
    });
  });

  app.get('/api/admin/users', adminOnly, (_req, res) => {
    const now = Date.now();
    const rows = q.prepare(`SELECT u.*, ${ACTIVE_STRIKES} AS strikes FROM users u ORDER BY u.created_at DESC, u.rowid DESC LIMIT ?`).all(now, USER_LIST_LIMIT) as Record<string, string & number>[];
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, total: count('SELECT COUNT(*) AS n FROM users'), users: rows.map(toAdmin) });
  });

  /**
   * Run `fn` on the user in the URL and answer with the updated user (404 if there's none). `fn`
   * returns [status, code] to refuse instead.
   */
  const onUser =
    (fn: (target: AdminUser, body: Record<string, unknown>, me: string) => [number, string] | void): RequestHandler =>
    (req, res) => {
      const target = one(String(req.params.id));
      if (!target) return void res.status(404).json({ ok: false, error: 'Not found' });
      const refused = fn(target, (req.body ?? {}) as Record<string, unknown>, currentUser(res)!.id);
      if (refused) return void res.status(refused[0]).json({ ok: false, code: refused[1] });
      res.json({ ok: true, user: one(target.id) });
    };

  // JSON { role }. Admins can't change their own role, so there's always someone left to undo it.
  app.post(
    '/api/admin/users/:id/role',
    writeLimit,
    sameOrigin,
    adminOnly,
    onUser((target, body, me) => {
      if (!ROLES.includes(body.role as Role)) return [400, 'invalid_role'];
      if (target.id === me) return [409, 'own_role'];
      cfg.auth.setRole(target.email, body.role as Role);
    }),
  );

  // JSON { verified: boolean }: the checkmark, set or taken away directly.
  app.post(
    '/api/admin/users/:id/verified',
    writeLimit,
    sameOrigin,
    adminOnly,
    onUser((target, body) => {
      if (typeof body.verified !== 'boolean') return [400, 'invalid_verified'];
      q.prepare('UPDATE users SET verified = ? WHERE id = ?').run(body.verified ? 1 : 0, target.id);
    }),
  );

  // JSON { reason }: an active policy strike, until it's lifted.
  app.post(
    '/api/admin/users/:id/strikes',
    writeLimit,
    sameOrigin,
    adminOnly,
    onUser((target, body) => {
      const reason = typeof body.reason === 'string' ? body.reason.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
      if (!reason || reason.length > MAX_STRIKE_REASON) return [400, 'invalid_reason'];
      issueStrike(db, target.id, reason);
    }),
  );

  app.post(
    '/api/admin/users/:id/strikes/lift',
    writeLimit,
    sameOrigin,
    adminOnly,
    onUser((target) => {
      liftStrikes(db, target.id);
    }),
  );
}
