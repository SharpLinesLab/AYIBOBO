import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { Db } from './db';
import { LocalDiskStorage } from './storage';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const port = Number(env.PORT ?? 8787);
const isProd = env.NODE_ENV === 'production';

/** Refuse to start with a configuration that would be unsafe in production. */
function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

let sessionSecret = env.SESSION_SECRET ?? '';
if (isProd && sessionSecret.length < 32) {
  fail('SESSION_SECRET must be set to a random string of at least 32 characters in production (e.g. `openssl rand -base64 48`). Without it, sign-in sessions could be forged.');
}
// Password-reset links point here. Taking it from the request instead would let a forged Host
// header send people to someone else's site.
const publicUrl = (env.PUBLIC_URL ?? '').replace(/\/$/, '');
if (isProd && !/^https?:\/\/[^\s/]+/.test(publicUrl)) {
  fail('PUBLIC_URL must be set in production to the site\'s public address, e.g. https://asf.example (used in password-reset links).');
}
if (!sessionSecret) {
  sessionSecret = randomBytes(32).toString('hex');
  console.warn('⚠️  SESSION_SECRET is not set — using a random one, so everyone is signed out when the server restarts.');
}

// SQLite database; DATA_FILE is the old JSON store, whose subscribers are copied in on first start.
const db = new Db(resolve(env.DATABASE_FILE ?? './data/asf.db'), { legacyJsonFile: resolve(env.DATA_FILE ?? './data/db.json') });
await db.init();

// Uploaded audio and covers; /data/uploads in Docker (the /data volume).
const storage = new LocalDiskStorage(resolve(env.UPLOADS_DIR ?? './data/uploads'));
try {
  await storage.init();
} catch (e) {
  fail(`UPLOADS_DIR (${env.UPLOADS_DIR ?? './data/uploads'}) can't be created or written: ${(e as Error).message}`);
}

const app = createApp({
  db,
  storage,
  publicUrl: publicUrl || `http://localhost:${port}`,
  sessionSecret,
  // dist-server/index.js -> ../dist ; server/index.ts (tsx) -> ../dist
  staticDir: resolve(here, '../dist'),
});

app.listen(port, () => {
  console.log(`ASF server listening on http://localhost:${port}`);
});
