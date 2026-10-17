import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ListingDraft } from '../src/lib/claim';
import type { NormalizedTarget } from '../src/lib/normalize';
import { createSeedState } from '../src/lib/seed';
import type { BoardId, LeaderboardState } from '../src/lib/types';

export interface PendingClaim {
  id: string;
  target: NormalizedTarget;
  board: BoardId;
  amount: number;
  charge: number;
  draft: ListingDraft;
  createdAt: number;
}

export interface DbShape {
  version: 1;
  state: LeaderboardState;
  /** Stripe Checkout sessions already applied (idempotency). */
  processed: string[];
  pending: Record<string, PendingClaim>;
  daily: Record<string, { visitors: number; clicks: number }>;
  lifetimeVisitors: number;
  subscribers?: { email: string; at: number }[];
}

/**
 * Tiny JSON-file datastore with atomic writes and serialized mutations. Fine for a single
 * instance; swap for Postgres/SQLite behind the same interface when you scale horizontally.
 */
export class Db {
  private data!: DbShape;
  private queue: Promise<unknown> = Promise.resolve();
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private file: string | null,
    private seedDemo: boolean,
  ) {}

  async init(): Promise<void> {
    if (this.file) {
      try {
        this.data = JSON.parse(await readFile(this.file, 'utf8')) as DbShape;
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
    this.data = {
      version: 1,
      state: this.seedDemo ? createSeedState(Date.now()) : { listings: [], payments: [] },
      processed: [],
      pending: {},
      daily: {},
      lifetimeVisitors: 0,
    };
    await this.flush();
  }

  get(): Readonly<DbShape> {
    return this.data;
  }

  /** Run a mutation exclusively; persisted before the promise resolves. */
  mutate<T>(fn: (d: DbShape) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const result = fn(this.data);
      await this.flush();
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Low-value counters (clicks, visitors) are batched to disk every few seconds. */
  touch(fn: (d: DbShape) => void): void {
    fn(this.data);
    this.dirty = true;
    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) void this.mutate(() => undefined);
    }, 5000);
  }

  private async flush(): Promise<void> {
    this.dirty = false;
    if (!this.file) return;
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data));
    await rename(tmp, this.file);
  }
}
