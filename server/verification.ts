/**
 * Artist verification. Artists ask to be verified (with optional proof, such as links to their
 * socials or press); an admin approves or rejects each request. Approval marks the account as
 * verified, which shows as a checkmark next to the artist's name.
 */
import { randomUUID } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { avatarUrl, currentUser, requireRole, sameOrigin } from './auth';
import type { Db } from './db';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

/** Longest message, in characters. */
export const MAX_VERIFICATION_MESSAGE = 1000;

/** Error codes the browser shows in the visitor's language (`account.verify.error.*`). */
export type VerificationErrorCode = 'invalid_message' | 'already_pending' | 'already_verified';

interface Row {
  id: string;
  user_id: string;
  status: VerificationStatus;
  message: string | null;
  requested_at: number;
  reviewed_at: number | null;
}

/** What an artist sees about their own request. */
const forArtist = (r: Row) => ({ id: r.id, status: r.status, message: r.message, requestedAt: r.requested_at, reviewedAt: r.reviewed_at });

/** Keeps line breaks (proof is often one link per line); other control characters become spaces. */
const multiLine = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim() : '');

export interface VerificationRoutesConfig {
  db: Db;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

export function registerVerificationRoutes(app: Express, cfg: VerificationRoutesConfig) {
  const { db } = cfg;
  const latest = (userId: string) =>
    db.sql.prepare('SELECT * FROM verification_requests WHERE user_id = ? ORDER BY requested_at DESC, rowid DESC LIMIT 1').get(userId) as Row | undefined;
  const fail = (res: Parameters<RequestHandler>[1], status: number, code: VerificationErrorCode) => res.status(status).json({ ok: false, code });

  // The artist's latest request (null if they never asked); `verified` is on the account itself.
  app.get('/api/account/verification', requireRole('artist', 'admin'), (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const r = latest(currentUser(res)!.id);
    res.json({ ok: true, request: r ? forArtist(r) : null });
  });

  // JSON { message } (optional proof). One pending request at a time; verified artists can't ask again.
  app.post('/api/account/verification', cfg.rateLimit('verification', 10, 60 * 60_000), sameOrigin, requireRole('artist', 'admin'), (req, res) => {
    const user = currentUser(res)!;
    if (user.verified) return void fail(res, 409, 'already_verified');
    const message = multiLine(req.body?.message);
    if (message.length > MAX_VERIFICATION_MESSAGE) return void fail(res, 400, 'invalid_message');
    const id = randomUUID();
    try {
      db.sql
        .prepare("INSERT INTO verification_requests (id, user_id, status, message, requested_at) VALUES (?, ?, 'pending', ?, ?)")
        .run(id, user.id, message || null, Date.now());
    } catch {
      return void fail(res, 409, 'already_pending'); // the one-pending-per-artist index
    }
    res.status(201).json({ ok: true, request: forArtist(latest(user.id)!) });
  });

  // --- review (admins only; everyone else gets a plain 404, as if it didn't exist) -------------

  const adminOnly: RequestHandler = (_req, res, next) => {
    if (currentUser(res)?.role === 'admin') return next();
    res.status(404).json({ ok: false, error: 'Not found' });
  };

  app.get('/api/admin/verification', adminOnly, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const rows = db.sql
      .prepare(
        `SELECT v.*, u.email, u.display_name, u.artist_name, u.bio, u.avatar_type, u.avatar_at
         FROM verification_requests v JOIN users u ON u.id = v.user_id
         WHERE v.status = 'pending' ORDER BY v.requested_at ASC`,
      )
      .all() as unknown as (Row & { email: string; display_name: string; artist_name: string | null; bio: string | null; avatar_type: string | null; avatar_at: number | null })[];
    res.json({
      ok: true,
      requests: rows.map((r) => ({
        ...forArtist(r),
        userId: r.user_id,
        artistName: r.artist_name ?? r.display_name,
        displayName: r.display_name,
        email: r.email,
        bio: r.bio,
        avatarUrl: r.avatar_type && r.avatar_at ? avatarUrl(r.user_id, r.avatar_at) : null,
      })),
    });
  });

  const review = (status: 'approved' | 'rejected'): RequestHandler => (req, res) => {
    const r = db.sql.prepare('SELECT * FROM verification_requests WHERE id = ?').get(String(req.params.id)) as Row | undefined;
    if (!r) return void res.status(404).json({ ok: false, error: 'Not found' });
    if (r.status !== 'pending') return void res.status(409).json({ ok: false, code: 'not_pending' });
    db.transaction(() => {
      db.sql.prepare('UPDATE verification_requests SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?').run(status, Date.now(), currentUser(res)!.id, r.id);
      if (status === 'approved') db.sql.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(r.user_id);
    });
    res.json({ ok: true });
  };
  app.post('/api/admin/verification/:id/approve', cfg.rateLimit('moderate', 120, 60_000), sameOrigin, adminOnly, review('approved'));
  app.post('/api/admin/verification/:id/reject', cfg.rateLimit('moderate', 120, 60_000), sameOrigin, adminOnly, review('rejected'));
}
