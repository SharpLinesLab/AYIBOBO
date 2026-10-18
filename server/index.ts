import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { Db } from './db';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const port = Number(env.PORT ?? 8787);
const isProd = env.NODE_ENV === 'production';

/** Refuse to start with a configuration that would take fake or misrouted payments in production. */
function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
  } catch {
    return true; // not a valid URL — treat as unusable
  }
}

if (isProd && !env.STRIPE_SECRET_KEY && env.ALLOW_SIMULATED_PAYMENTS === 'true') {
  fail('Simulated payments are enabled in production (ALLOW_SIMULATED_PAYMENTS=true without STRIPE_SECRET_KEY). Set STRIPE_SECRET_KEY, or unset ALLOW_SIMULATED_PAYMENTS.');
}
if (isProd && env.STRIPE_SECRET_KEY && (!env.PUBLIC_URL || isLocalUrl(env.PUBLIC_URL))) {
  fail('STRIPE_SECRET_KEY is set but PUBLIC_URL is missing or points at localhost — Stripe would redirect buyers to the wrong place. Set PUBLIC_URL to the public https:// address.');
}
if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️  STRIPE_WEBHOOK_SECRET is not set — paid checkouts will never be applied to the board.');
}

const db = new Db(resolve(env.DATA_FILE ?? './data/db.json'), env.SEED_DEMO !== 'false');
await db.init();

const app = createApp({
  db,
  stripeSecretKey: env.STRIPE_SECRET_KEY || undefined,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || undefined,
  publicUrl: (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
  allowSimulatedPayments: env.ALLOW_SIMULATED_PAYMENTS ? env.ALLOW_SIMULATED_PAYMENTS === 'true' : !isProd,
  // dist-server/index.js -> ../dist ; server/index.ts (tsx) -> ../dist
  staticDir: resolve(here, '../dist'),
});

app.listen(port, () => {
  console.log(`ASF Charts server listening on http://localhost:${port}`);
});
