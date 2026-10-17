import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { Db } from './db';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const port = Number(env.PORT ?? 8787);
const isProd = env.NODE_ENV === 'production';

if (isProd && !env.STRIPE_SECRET_KEY && env.ALLOW_SIMULATED_PAYMENTS === 'true') {
  console.warn('⚠️  Running in production with simulated payments enabled. Set STRIPE_SECRET_KEY for real checkout.');
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
