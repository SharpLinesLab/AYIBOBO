import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Db } from '../server/db';

const dir = mkdtempSync(join(tmpdir(), 'asf-db-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('SQLite datastore', () => {
  it('keeps the get / mutate / touch interface and persists across restarts', async () => {
    const file = join(dir, 'a.db');
    const db = new Db(file);
    await db.init();
    expect(db.get().subscribers).toEqual([]);
    const n = await db.mutate((d) => {
      d.subscribers.push({ email: 'a@example.com', at: 1 }, { email: 'b@example.com', at: 2 });
      return d.subscribers.length;
    });
    expect(n).toBe(2);
    await db.mutate((d) => {
      d.subscribers = d.subscribers.filter((s) => s.email !== 'a@example.com');
    });
    db.touch((d) => d.subscribers.push({ email: 'c@example.com', at: 3 }));
    await db.mutate(() => undefined); // touch is queued; wait for it
    db.close();

    const again = new Db(file);
    await again.init(); // re-running migrations on an up-to-date file is a no-op
    expect(again.get().subscribers.map((s) => s.email)).toEqual(['b@example.com', 'c@example.com']);
    again.close();
  });

  it('serializes concurrent mutations', async () => {
    const db = new Db(null);
    await db.init();
    await Promise.all(Array.from({ length: 20 }, (_, i) => db.mutate((d) => d.subscribers.push({ email: `u${i}@example.com`, at: i }))));
    expect(db.get().subscribers).toHaveLength(20);
  });

  it('rolls a failed mutation back', async () => {
    const db = new Db(null);
    await db.init();
    await expect(
      db.mutate((d) => {
        d.subscribers.push({ email: 'x@example.com', at: 1 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(db.get().subscribers).toEqual([]);
  });

  it('migrates subscribers from the old JSON file exactly once', async () => {
    const legacy = join(dir, 'db.json');
    writeFileSync(legacy, JSON.stringify({ version: 2, subscribers: [{ email: 'Old@Example.com', at: 5 }, { email: 'two@example.com', at: 6 }, { nope: 1 }] }));
    const file = join(dir, 'm.db');
    const db = new Db(file, { legacyJsonFile: legacy });
    await db.init();
    expect(db.get().subscribers).toEqual([
      { email: 'old@example.com', at: 5 },
      { email: 'two@example.com', at: 6 },
    ]);
    await db.mutate((d) => {
      d.subscribers = d.subscribers.filter((s) => s.email !== 'two@example.com');
    });
    db.close();
    // Restarting doesn't re-import (so unsubscribes stick).
    const again = new Db(file, { legacyJsonFile: legacy });
    await again.init();
    expect(again.get().subscribers.map((s) => s.email)).toEqual(['old@example.com']);
    again.close();
  });
});
