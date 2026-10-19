import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Db } from './db';

export type Role = 'listener' | 'artist' | 'admin';
export const ROLES: readonly Role[] = ['listener', 'artist', 'admin'];

/** A user as the API returns it — never includes the password hash. */
export interface User {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  createdAt: number;
}

export interface AuthConfig {
  /** Signs session ids before they are stored. At least 32 characters in production. */
  sessionSecret: string;
  /** bcrypt cost factor (default 12; tests use a low value to stay fast). */
  bcryptRounds?: number;
  sessionTtlMs?: number;
}

/** Machine-readable error codes; the browser shows them in the visitor's language. */
export type AuthError = 'invalid_email' | 'weak_password' | 'long_password' | 'invalid_name' | 'invalid_role' | 'email_taken' | 'invalid_credentials' | 'invalid_token';

/** Password reset links work for an hour. */
export const RESET_TTL_MS = 60 * 60_000;

export const SESSION_COOKIE = 'asf_session';
const DAY = 86_400_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** bcrypt only reads the first 72 bytes of a password; longer ones are refused, not silently cut. */
const MAX_PASSWORD_BYTES = 72;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  display_name: string;
  created_at: number;
}

const toUser = (r: UserRow): User => ({ id: r.id, email: r.email, role: r.role, displayName: r.display_name, createdAt: r.created_at });

/** Why a new password can't be used, or null if it's fine. */
function passwordProblem(password: string): 'weak_password' | 'long_password' | null {
  if (password.length < 8) return 'weak_password';
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) return 'long_password';
  return null;
}

export const normalizeEmail = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 254) : '');

export function createAuth(db: Db, cfg: AuthConfig) {
  const rounds = cfg.bcryptRounds ?? 12;
  const ttl = cfg.sessionTtlMs ?? 30 * DAY;
  // Compared against when the email is unknown, so a login takes as long either way.
  const dummyHash = bcrypt.hashSync(randomBytes(16).toString('hex'), rounds);
  const sign = (token: string) => createHmac('sha256', cfg.sessionSecret).update(token).digest('hex');

  const byEmail = (email: string) => db.sql.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;

  function userById(id: string): User | null {
    const r = db.sql.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return r ? toUser(r) : null;
  }

  async function signup(input: { email?: unknown; password?: unknown; displayName?: unknown; role?: unknown }): Promise<User | AuthError> {
    const email = normalizeEmail(input.email);
    if (!EMAIL.test(email)) return 'invalid_email';
    const password = typeof input.password === 'string' ? input.password : '';
    const weak = passwordProblem(password);
    if (weak) return weak;
    const role = input.role ?? 'listener';
    // Anyone can sign up as a listener or an artist (artist uploads are moderated); admins are
    // only ever made with the server's `set-role` command.
    if (role !== 'listener' && role !== 'artist') return 'invalid_role';
    const name = typeof input.displayName === 'string' ? input.displayName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    if (!name || name.length > 60) return 'invalid_name';
    if (byEmail(email)) return 'email_taken';
    const user: User = { id: randomUUID(), email, role, displayName: name, createdAt: Date.now() };
    const hash = await bcrypt.hash(password, rounds);
    try {
      db.sql
        .prepare('INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(user.id, user.email, hash, user.role, user.displayName, user.createdAt);
    } catch {
      return 'email_taken'; // a parallel sign-up with the same email won the race
    }
    return user;
  }

  async function login(emailIn: unknown, passwordIn: unknown): Promise<User | null> {
    const email = normalizeEmail(emailIn);
    const password = typeof passwordIn === 'string' ? passwordIn : '';
    const row = email ? byEmail(email) : undefined;
    const ok = await bcrypt.compare(password, row?.password_hash ?? dummyHash);
    return row && ok && password ? toUser(row) : null;
  }

  /** Start a session; returns the cookie value. Only an HMAC of it is stored. */
  function createSession(userId: string): string {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    db.sql.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    db.sql.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sign(token), userId, now, now + ttl);
    return token;
  }

  function userForToken(token: string | undefined): User | null {
    if (!token || token.length > 200) return null;
    const row = db.sql
      .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND s.expires_at > ?')
      .get(sign(token), Date.now()) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  function destroySession(token: string | undefined): void {
    if (token) db.sql.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sign(token));
  }

  // --- password reset ---------------------------------------------------------------------------

  /** Reset tokens are 32 random bytes, so a plain SHA-256 is enough to store them safely. */
  const resetHash = (token: string) => createHash('sha256').update(token).digest('hex');

  /**
   * A fresh single-use reset token for this email, or null if there's no such account. Any
   * earlier token for the account stops working. The caller must answer the same either way.
   */
  function createResetToken(emailIn: unknown, now = Date.now()): { token: string; user: User } | null {
    const row = byEmail(normalizeEmail(emailIn));
    if (!row) return null;
    const token = randomBytes(32).toString('base64url');
    db.transaction(() => {
      db.sql.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at <= ?').run(row.id, now);
      db.sql.prepare('INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(resetHash(token), row.id, now, now + RESET_TTL_MS);
    });
    return { token, user: toUser(row) };
  }

  /**
   * Set a new password with a reset token. The token is deleted once used (and expired ones are
   * swept), and every session of the account is signed out. A too-short password is refused
   * without using up the token, so the person can try again.
   */
  async function resetPassword(tokenIn: unknown, passwordIn: unknown): Promise<User | AuthError> {
    const now = Date.now();
    db.sql.prepare('DELETE FROM password_resets WHERE expires_at <= ?').run(now);
    const token = typeof tokenIn === 'string' && tokenIn.length <= 200 ? tokenIn : '';
    const reset = token ? (db.sql.prepare('SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?').get(resetHash(token), now) as { user_id: string } | undefined) : undefined;
    if (!reset) return 'invalid_token';
    const password = typeof passwordIn === 'string' ? passwordIn : '';
    const weak = passwordProblem(password);
    if (weak) return weak;
    const hash = await bcrypt.hash(password, rounds);
    const used = db.transaction(() => {
      // Delete first: if two requests race with the same token, only one gets to use it.
      const del = db.sql.prepare('DELETE FROM password_resets WHERE token_hash = ?').run(resetHash(token));
      if (del.changes === 0) return false;
      db.sql.prepare('DELETE FROM password_resets WHERE user_id = ?').run(reset.user_id);
      db.sql.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, reset.user_id);
      db.sql.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
      return true;
    });
    if (!used) return 'invalid_token';
    return userById(reset.user_id)!;
  }

  function setRole(email: string, role: Role): User | null {
    db.sql.prepare('UPDATE users SET role = ? WHERE email = ?').run(role, normalizeEmail(email));
    const r = byEmail(normalizeEmail(email));
    return r ? toUser(r) : null;
  }

  return { signup, login, createSession, userForToken, destroySession, userById, setRole, createResetToken, resetPassword, ttl };
}

export type Auth = ReturnType<typeof createAuth>;

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * The session cookie: not readable by scripts and not sent on cross-site requests. `secure` makes
 * it HTTPS-only; pass it whenever the site is served over HTTPS (browsers drop Secure cookies
 * set over plain HTTP).
 */
export function sessionCookie(token: string, maxAgeMs: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
}

export const clearSessionCookie = (secure: boolean) => `${SESSION_COOKIE}=; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=0`;

/** The signed-in user for this request, if any (set by `attachUser`). */
export const currentUser = (res: Response): User | null => (res.locals.user as User | undefined) ?? null;

export function attachUser(auth: Auth) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.user = auth.userForToken(readCookie(req, SESSION_COOKIE));
    next();
  };
}

/** 401 without a session; 403 when the user's role isn't allowed. */
export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = currentUser(res);
    if (!user) {
      res.status(401).json({ ok: false, code: 'unauthenticated', error: 'Sign in first.' });
      return;
    }
    if (roles.length && !roles.includes(user.role)) {
      res.status(403).json({ ok: false, code: 'forbidden', error: 'You don’t have access to this.' });
      return;
    }
    next();
  };
}

/**
 * Refuse state-changing requests sent from another site. SameSite=Lax already keeps the session
 * cookie off cross-site POSTs; this also covers browsers that don't honour it.
 */
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      /* invalid origin */
    }
    // req.host honours X-Forwarded-Host behind the trusted proxy.
    if (host !== req.host) {
      res.status(403).json({ ok: false, code: 'forbidden', error: 'Cross-site request refused.' });
      return;
    }
  }
  next();
}
