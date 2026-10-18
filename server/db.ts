import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Subscriber {
  email: string;
  at: number;
}

export interface DbShape {
  version: 2;
  subscribers: Subscriber[];
}

/**
 * Tiny JSON-file datastore with atomic writes and serialized mutations. Fine for a single
 * instance; swap for Postgres/SQLite behind the same interface when you scale horizontally.
 */
export class Db {
  private data!: DbShape;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file: string | null) {}

  async init(): Promise<void> {
    if (this.file) {
      try {
        const raw = JSON.parse(await readFile(this.file, 'utf8')) as { subscribers?: Subscriber[] };
        // Older data files also held the retired Boost Board; only the subscriber list carries over.
        this.data = { version: 2, subscribers: Array.isArray(raw.subscribers) ? raw.subscribers : [] };
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
    this.data = { version: 2, subscribers: [] };
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

  private async flush(): Promise<void> {
    if (!this.file) return;
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data));
    await rename(tmp, this.file);
  }
}
