import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { attachUser, clearSessionCookie, createAuth, currentUser, readCookie, sameOrigin, SESSION_COOKIE, sessionCookie } from './auth';
import type { Db } from './db';
import { logResetLink, resetLink, type ResetLinkSender } from './mail';
import type { Storage } from './storage';
import { registerLibraryRoutes } from './library';
import { registerAdRoutes } from './ads';
import { registerProfileRoutes } from './profile';
import { registerVerificationRoutes } from './verification';
import { DEFAULT_LIMITS, registerUploadRoutes, type UploadLimits } from './uploads';

export interface AppConfig {
  db: Db;
  staticDir?: string;
  /** Signs session ids (see server/index.ts for the production check). */
  sessionSecret: string;
  /** bcrypt cost; tests lower it. */
  bcryptRounds?: number;
  /** Where uploaded audio and covers are kept. */
  storage: Storage;
  /** The site's public address, used in password-reset links (default http://localhost). */
  publicUrl?: string;
  /** Delivers password-reset links (default: write them to the server log). */
  sendResetLink?: ResetLinkSender;
  /** Upload size caps in bytes (defaults: 50 MB audio, 8 MB cover). */
  uploadLimits?: Partial<UploadLimits>;
}

/**
 * Content-Security-Policy. No inline scripts (the theme bootstrap is /theme-init.js); covers and
 * uploads use data:/blob: URLs and real artwork may come from any https: host.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Minimal fixed-window rate limiter keyed by IP + bucket. RATE_LIMIT_MULTIPLIER scales every limit
 * (e.g. for end-to-end tests where many browsers share one IP); it defaults to 1.
 */
export function rateLimit(bucket: string, perWindow: number, windowMs: number) {
  const limit = perWindow * Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1);
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      if (hits.size > 50_000) hits.clear();
      return next();
    }
    if (++h.n > limit) {
      res.status(429).json({ ok: false, error: 'Too many requests — slow down a little.' });
      return;
    }
    next();
  };
}

export function createApp(cfg: AppConfig) {
  const { db } = cfg;
  const auth = createAuth(db, { sessionSecret: cfg.sessionSecret, bcryptRounds: cfg.bcryptRounds });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', CSP);
    next();
  });

  // A whole library is sent once per device when it's first linked to an account.
  app.use('/api/library', express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', attachUser(auth));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/newsletter', rateLimit('newsletter', 5, 60_000), async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
      return;
    }
    await db.mutate((d) => {
      d.subscribers ??= [];
      if (!d.subscribers.some((s) => s.email === email)) d.subscribers.push({ email, at: Date.now() });
    });
    res.json({ ok: true });
  });

  // Always answers { ok: true }, so it can't be used to discover who is subscribed.
  app.post('/api/newsletter/unsubscribe', rateLimit('newsletter-unsubscribe', 5, 60_000), async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    if (email) {
      await db.mutate((d) => {
        if (d.subscribers) d.subscribers = d.subscribers.filter((s) => s.email !== email);
      });
    }
    res.json({ ok: true });
  });

  // --- accounts --------------------------------------------------------------------------------

  // Secure only when the site is served over HTTPS (PUBLIC_URL): over plain HTTP, e.g. a staging
  // server, browsers would drop the cookie and nobody could stay signed in.
  const secureCookies = (cfg.publicUrl ?? '').startsWith('https://');
  const startSession = (res: Response, userId: string) => res.setHeader('Set-Cookie', sessionCookie(auth.createSession(userId), auth.ttl, secureCookies));

  app.post('/api/auth/signup', rateLimit('signup', 10, 60 * 60_000), sameOrigin, async (req, res) => {
    const out = await auth.signup(req.body ?? {});
    if (typeof out === 'string') {
      res.status(out === 'email_taken' ? 409 : 400).json({ ok: false, code: out });
      return;
    }
    startSession(res, out.id);
    res.status(201).json({ ok: true, user: out });
  });

  app.post('/api/auth/login', rateLimit('login', 10, 60_000), sameOrigin, async (req, res) => {
    const user = await auth.login(req.body?.email, req.body?.password);
    if (!user) {
      // Same answer for an unknown email and a wrong password.
      res.status(401).json({ ok: false, code: 'invalid_credentials' });
      return;
    }
    startSession(res, user.id);
    res.json({ ok: true, user });
  });

  app.post('/api/auth/logout', rateLimit('logout', 30, 60_000), sameOrigin, (req, res) => {
    auth.destroySession(readCookie(req, SESSION_COOKIE));
    res.setHeader('Set-Cookie', clearSessionCookie(secureCookies));
    res.json({ ok: true });
  });

  // Always the same answer, whether or not there's an account for this email (no enumeration).
  // The link is sent after the response, so a slow mail provider can't reveal it by timing either.
  app.post('/api/auth/reset-request', rateLimit('reset-request', 5, 60 * 60_000), sameOrigin, (req, res) => {
    const reset = auth.createResetToken(req.body?.email);
    res.json({ ok: true });
    if (reset) {
      const send = cfg.sendResetLink ?? logResetLink;
      void Promise.resolve()
        .then(() => send(reset.user.email, resetLink(cfg.publicUrl ?? 'http://localhost', reset.token)))
        .catch((e) => console.error('password reset delivery failed', e));
    }
  });

  app.post('/api/auth/reset', rateLimit('reset', 10, 60 * 60_000), sameOrigin, async (req, res) => {
    const out = await auth.resetPassword(req.body?.token, req.body?.password);
    if (typeof out === 'string') {
      res.status(400).json({ ok: false, code: out });
      return;
    }
    // Every session of the account was signed out, this browser's included.
    res.setHeader('Set-Cookie', clearSessionCookie(secureCookies));
    res.json({ ok: true });
  });

  // 200 with user: null when signed out, so the app can ask on every load without an error.
  app.get('/api/auth/me', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, user: currentUser(res) });
  });

  // --- artist uploads ----------------------------------------------------------------------------

  const uploads = registerUploadRoutes(app, { db, storage: cfg.storage, limits: cfg.uploadLimits, rateLimit });

  // --- artist profiles ---------------------------------------------------------------------------

  registerProfileRoutes(app, { db, storage: cfg.storage, maxPicture: cfg.uploadLimits?.cover ?? DEFAULT_LIMITS.cover, userById: auth.userById, rateLimit });
  registerVerificationRoutes(app, { db, rateLimit });

  // --- audio ads (free tier) ---------------------------------------------------------------------

  registerAdRoutes(app, { db, storage: cfg.storage, limits: uploads.limits, rateLimit });

  // --- library sync ------------------------------------------------------------------------------

  registerLibraryRoutes(app, { db, rateLimit });

  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
  });

  if (cfg.staticDir && existsSync(cfg.staticDir)) {
    const dir = cfg.staticDir;
    app.use(
      express.static(dir, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, path) => {
          if (/\/assets\//.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          // The service worker must revalidate so updates roll out promptly.
          else if (/sw\.js$/.test(path)) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    // The HTML shell must always revalidate so a new deploy is picked up immediately.
    app.get(/.*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(dir, 'index.html'));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  });

  return app;
}
