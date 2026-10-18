import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db';

export interface AppConfig {
  db: Db;
  staticDir?: string;
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
function rateLimit(bucket: string, perWindow: number, windowMs: number) {
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

  app.use(express.json({ limit: '32kb' }));

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
