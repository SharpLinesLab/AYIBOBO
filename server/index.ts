import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { Db } from './db';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const port = Number(env.PORT ?? 8787);

const db = new Db(resolve(env.DATA_FILE ?? './data/db.json'));
await db.init();

const app = createApp({
  db,
  // dist-server/index.js -> ../dist ; server/index.ts (tsx) -> ../dist
  staticDir: resolve(here, '../dist'),
});

app.listen(port, () => {
  console.log(`ASF server listening on http://localhost:${port}`);
});
