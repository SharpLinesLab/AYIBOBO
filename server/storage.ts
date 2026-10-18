import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

/**
 * Where uploaded files live. Keys look like `audio/<id>` or `covers/<id>`. Local disk today;
 * an S3-compatible bucket can implement the same interface later.
 */
export interface Storage {
  /** A fresh path for an incoming upload to be written to before it is accepted. */
  tempPath(): Promise<string>;
  /** Move a finished temp file into storage under `key`. */
  putFile(key: string, tempPath: string): Promise<void>;
  /** Size in bytes, or null if there is no such file. */
  size(key: string): Promise<number | null>;
  /** Read the whole file, or the inclusive byte range [start, end]. */
  read(key: string, range?: { start: number; end: number }): Readable;
  /** Delete a file; missing files are ignored. */
  delete(key: string): Promise<void>;
}

const KEY = /^(audio|covers)\/[A-Za-z0-9-]{1,64}$/;

function check(key: string): string {
  if (!KEY.test(key)) throw new Error(`invalid storage key: ${key}`);
  return key;
}

/** Files on the server's disk under `root` (default /data/uploads in Docker, a mounted volume). */
export class LocalDiskStorage implements Storage {
  constructor(private root: string) {}

  /** Create the folders up front so a read-only or missing volume fails at boot, not mid-upload. */
  async init(): Promise<void> {
    for (const dir of ['audio', 'covers', 'tmp']) await mkdir(join(this.root, dir), { recursive: true });
  }

  async tempPath(): Promise<string> {
    return join(this.root, 'tmp', randomUUID());
  }

  async putFile(key: string, tempPath: string): Promise<void> {
    await rename(tempPath, join(this.root, check(key)));
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(join(this.root, check(key)))).size;
    } catch {
      return null;
    }
  }

  read(key: string, range?: { start: number; end: number }): Readable {
    return createReadStream(join(this.root, check(key)), range);
  }

  async delete(key: string): Promise<void> {
    await rm(join(this.root, check(key)), { force: true });
  }
}
