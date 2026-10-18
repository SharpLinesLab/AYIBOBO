import type { AddressInfo } from 'node:net';
import { createApp, type AppConfig } from '../server/app';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from '../server/db';
import { LocalDiskStorage } from '../server/storage';

export const TEST_SECRET = 'test-secret-0123456789abcdef0123456789';

/** An API server on a random port with an in-memory database, plus a tiny cookie-keeping client. */
export async function startServer(extra: Partial<AppConfig> = {}) {
  const db = new Db(null);
  await db.init();
  const uploadsDir = mkdtempSync(join(tmpdir(), 'asf-uploads-'));
  const storage = new LocalDiskStorage(uploadsDir);
  await storage.init();
  const app = createApp({ db, sessionSecret: TEST_SECRET, bcryptRounds: 4, storage, ...extra });
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { db, base, uploadsDir, storage, close: () => server.close(), client: () => client(base) };
}

export type Client = ReturnType<typeof client>;

/** fetch with one cookie jar, like a browser tab. */
function client(base: string) {
  let cookie = '';
  const keep = (r: Response) => {
    const set = r.headers.get('set-cookie');
    if (set) {
      const pair = set.split(';')[0];
      cookie = pair.endsWith('=') ? '' : pair;
    }
    return r;
  };
  const req = (path: string, init: RequestInit = {}) =>
    fetch(base + path, { ...init, headers: { ...(init.headers as Record<string, string>), ...(cookie ? { cookie } : {}) } }).then(keep);
  return {
    get: (path: string, headers: Record<string, string> = {}) => req(path, { headers }),
    post: (path: string, body?: unknown, headers: Record<string, string> = {}) =>
      req(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body ?? {}) }),
    send: (path: string, init: RequestInit) => req(path, init),
    get cookie() {
      return cookie;
    },
  };
}
