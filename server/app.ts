import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Stripe from 'stripe';
import type { CheckoutResult, HealthResponse, StateResponse } from '../src/lib/api';
import { isCategoryId } from '../src/lib/categories';
import { applyClaim, applyPaidCharge, newId, quoteClaim, type ListingDraft } from '../src/lib/claim';
import { generateArtwork, generatePreview } from '../src/lib/metadata';
import { resolveAndNormalize, type NormalizedTarget } from '../src/lib/normalize';
import { MAX_BID, startOfUtcDay, utcDayKey } from '../src/lib/ranking';
import type { AudioPreview, Artwork, BoardId } from '../src/lib/types';
import type { Db, PendingClaim } from './db';
import { resolveOneHop, scrapeMetadata } from './net';

export interface AppConfig {
  db: Db;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  publicUrl: string;
  allowSimulatedPayments: boolean;
  staticDir?: string;
  /** Injectable for tests. */
  resolver?: (url: string) => Promise<string>;
  scraper?: typeof scrapeMetadata;
}

const HEX = /^#[0-9a-f]{3,8}$/i;

function sanitizeDraft(raw: unknown, target: NormalizedTarget): ListingDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
  if (!isCategoryId(d.category)) return null;
  const title = str(d.title, 80) || target.display;
  const a = (d.artwork ?? {}) as Record<string, unknown>;
  const fallbackArt = generateArtwork(target.key, title);
  const artwork: Artwork = {
    from: typeof a.from === 'string' && HEX.test(a.from) ? a.from : fallbackArt.from,
    to: typeof a.to === 'string' && HEX.test(a.to) ? a.to : fallbackArt.to,
    glyph: str(a.glyph, 3) || fallbackArt.glyph,
  };
  if (typeof a.imageUrl === 'string' && /^https:\/\/[^\s"'<>]+$/.test(a.imageUrl) && a.imageUrl.length < 600) artwork.imageUrl = a.imageUrl;
  let preview: AudioPreview | undefined;
  const p = d.preview as Record<string, unknown> | undefined;
  if (p?.kind === 'file' && typeof p.url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(p.url) && p.url.length < 600) {
    preview = { kind: 'file', url: p.url };
  } else if (p?.kind === 'synth') {
    preview = generatePreview(target.key, d.category);
  }
  return { title, tagline: str(d.tagline, 80), description: str(d.description, 400), category: d.category, artwork, preview };
}

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
  const stripe = cfg.stripeSecretKey ? new Stripe(cfg.stripeSecretKey) : null;
  const resolver = cfg.resolver ?? resolveOneHop;
  const scrape = cfg.scraper ?? scrapeMetadata;
  const presence = new Map<string, number>();
  let visitorsTodayIds = new Set<string>();
  let visitorsDay = utcDayKey(Date.now());

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  // Stripe needs the raw body to verify signatures — register before the JSON parser.
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    if (!stripe || !cfg.stripeWebhookSecret) {
      res.status(404).end();
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, req.headers['stripe-signature'] as string, cfg.stripeWebhookSecret);
    } catch {
      res.status(400).send('Invalid signature');
      return;
    }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') await fulfil(session);
    }
    res.json({ received: true });
  });

  async function fulfil(session: Stripe.Checkout.Session) {
    const claimId = session.metadata?.claimId;
    if (!claimId) return;
    await db.mutate((d) => {
      if (d.processed.includes(session.id)) return;
      const pending: PendingClaim | undefined = d.pending[claimId];
      if (!pending) return;
      const paid = Math.round((session.amount_total ?? pending.charge * 100) / 100);
      const applied = applyPaidCharge(d.state, pending.target, paid, pending.draft, Date.now(), `pay_${session.id}`);
      d.state = applied.state;
      d.processed.push(session.id);
      delete d.pending[claimId];
    });
  }

  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { ok: true, stripe: !!stripe, simulated: !stripe && cfg.allowSimulatedPayments };
    res.json(body);
  });

  app.get('/api/state', (_req, res) => {
    const now = Date.now();
    const d = db.get();
    const history = Array.from({ length: 14 }, (_, i) => {
      const day = utcDayKey(startOfUtcDay(now) - (13 - i) * 86_400_000);
      return { day, visitors: d.daily[day]?.visitors ?? 0, clicks: d.daily[day]?.clicks ?? 0 };
    });
    const cutoff = now - 90_000;
    let online = 0;
    for (const [id, t] of presence) {
      if (t >= cutoff) online++;
      else presence.delete(id);
    }
    const body: StateResponse = {
      state: d.state,
      now,
      stats: {
        online: Math.max(1, online),
        visitorsToday: history[13].visitors,
        visitorsLifetime: d.lifetimeVisitors,
        clicksToday: history[13].clicks,
        history,
      },
    };
    res.setHeader('Cache-Control', 'no-store');
    res.json(body);
  });

  app.post('/api/ping', rateLimit('ping', 30, 60_000), (req, res) => {
    const id = typeof req.body?.visitorId === 'string' ? req.body.visitorId.slice(0, 64) : '';
    if (!id) {
      res.status(400).json({ ok: false });
      return;
    }
    presence.set(id, Date.now());
    const today = utcDayKey(Date.now());
    if (today !== visitorsDay) {
      visitorsDay = today;
      visitorsTodayIds = new Set();
    }
    if (!visitorsTodayIds.has(id)) {
      visitorsTodayIds.add(id);
      db.touch((d) => {
        d.daily[today] ??= { visitors: 0, clicks: 0 };
        d.daily[today].visitors++;
        d.lifetimeVisitors++;
      });
    }
    res.json({ ok: true });
  });

  app.post('/api/click', rateLimit('click', 60, 60_000), (req, res) => {
    const id = req.body?.listingId;
    if (typeof id !== 'string' || !db.get().state.listings.some((l) => l.id === id)) {
      res.status(404).json({ ok: false });
      return;
    }
    const today = utcDayKey(Date.now());
    db.touch((d) => {
      const l = d.state.listings.find((x) => x.id === id);
      if (l) l.clicks++;
      d.daily[today] ??= { visitors: 0, clicks: 0 };
      d.daily[today].clicks++;
    });
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

  app.post('/api/resolve', rateLimit('resolve', 60, 60_000), async (req, res) => {
    const input = typeof req.body?.input === 'string' ? req.body.input.slice(0, 500) : '';
    res.json(await resolveAndNormalize(input, resolver));
  });

  app.post('/api/metadata', rateLimit('metadata', 20, 60_000), async (req, res) => {
    const input = typeof req.body?.input === 'string' ? req.body.input.slice(0, 500) : '';
    const target = await resolveAndNormalize(input, resolver);
    if (!target.ok) {
      res.status(400).json({ ok: false, error: target.error });
      return;
    }
    res.json(await scrape(target));
  });

  app.post('/api/checkout', rateLimit('checkout', 20, 60_000), async (req, res) => {
    const send = (r: CheckoutResult, status = 200) => res.status(status).json(r);
    const { input, board, amount, draft } = req.body ?? {};
    if (typeof input !== 'string' || (board !== 'all' && board !== 'today') || !Number.isInteger(amount) || amount < 1 || amount > MAX_BID) {
      send({ kind: 'error', error: 'Invalid checkout request.' }, 400);
      return;
    }
    const target = await resolveAndNormalize(input.slice(0, 500), resolver);
    if (!target.ok) {
      send({ kind: 'error', error: target.error }, 400);
      return;
    }
    const clean = sanitizeDraft(draft, target);
    if (!clean) {
      send({ kind: 'error', error: 'Invalid listing details.' }, 400);
      return;
    }

    if (!stripe) {
      if (!cfg.allowSimulatedPayments) {
        send({ kind: 'error', error: 'Payments are not configured on this server.' }, 503);
        return;
      }
      const result = await db.mutate((d) => {
        const r = applyClaim(d.state, target, board as BoardId, amount, clean, Date.now());
        if ('state' in r) d.state = r.state;
        return r;
      });
      if (!('state' in result)) {
        send({ kind: 'error', error: result.error, suggested: result.suggested }, 409);
        return;
      }
      send({ kind: 'applied', state: db.get().state, listingId: result.listing.id, paymentId: result.payment.id, quote: result.quote });
      return;
    }

    const quote = quoteClaim(db.get().state, target.key, board as BoardId, amount, Date.now());
    if (!quote.ok) {
      send({ kind: 'error', error: quote.error, suggested: quote.suggested }, 409);
      return;
    }
    const claimId = newId('clm');
    await db.mutate((d) => {
      // Drop abandoned claims older than a day.
      for (const [id, p] of Object.entries(d.pending)) if (p.createdAt < Date.now() - 86_400_000) delete d.pending[id];
      d.pending[claimId] = { id: claimId, target, board: board as BoardId, amount, charge: quote.charge, draft: clean, createdAt: Date.now() };
    });
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: quote.charge * 100,
              product_data: {
                name: `${quote.mode === 'topup' ? 'Raise rank' : 'Claim rank'}: ${target.display}`.slice(0, 120),
                description: `New ${board === 'all' ? 'all-time' : 'today'} total $${amount.toLocaleString('en-US')} on ASF Charts`,
              },
            },
          },
        ],
        metadata: { claimId, key: target.key.slice(0, 450), board, amount: String(amount) },
        success_url: `${cfg.publicUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cfg.publicUrl}/?checkout=cancel`,
      });
      send({ kind: 'redirect', url: session.url! });
    } catch (e) {
      console.error('stripe checkout error', e);
      send({ kind: 'error', error: 'Could not start checkout. Please try again.' }, 502);
    }
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
