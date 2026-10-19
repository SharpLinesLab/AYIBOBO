import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface Subscriber {
  email: string;
  at: number;
}

/** The newsletter view of the store, as `get` / `mutate` see it. */
export interface DbShape {
  subscribers: Subscriber[];
}

/**
 * Schema migrations, applied in order; `PRAGMA user_version` records how many have run. Append
 * new steps, never edit old ones.
 */
export const MIGRATIONS: string[] = [
  // 1: newsletter subscribers + key/value metadata
  `CREATE TABLE subscribers (email TEXT PRIMARY KEY, at INTEGER NOT NULL);
   CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // 2: accounts and sessions (session ids are stored as HMACs, never in the clear)
  `CREATE TABLE users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('listener', 'artist', 'admin')),
     display_name TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     id_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);`,
  // 3: artist uploads. Files live in storage (see storage.ts); rows keep the moderation record.
  `CREATE TABLE uploads (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     genre TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
     audio_type TEXT NOT NULL,
     audio_size INTEGER NOT NULL,
     cover_type TEXT NOT NULL,
     cover_size INTEGER NOT NULL,
     duration REAL NOT NULL,
     peaks TEXT,
     created_at INTEGER NOT NULL,
     reviewed_at INTEGER,
     reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL
   );
   CREATE INDEX uploads_status ON uploads(status, created_at);
   CREATE INDEX uploads_user ON uploads(user_id);`,
  // 4: each account's library (likes, follows, playlists, play history), synced across devices
  `CREATE TABLE library_likes (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     kind TEXT NOT NULL CHECK (kind IN ('track', 'album', 'playlist')),
     item_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, kind, item_id)
   );
   CREATE TABLE library_follows (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     artist_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, artist_id)
   );
   CREATE TABLE library_playlists (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     id TEXT NOT NULL,
     title TEXT NOT NULL,
     curator TEXT NOT NULL,
     track_ids TEXT NOT NULL,
     cover TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, id)
   );
   CREATE TABLE library_plays (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     track_id TEXT NOT NULL,
     count INTEGER NOT NULL,
     last_played INTEGER NOT NULL,
     PRIMARY KEY (user_id, track_id)
   );
   CREATE TABLE library_merges (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     merge_id TEXT NOT NULL,
     merged_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, merge_id)
   );`,
  // 5: password reset tokens (only a SHA-256 hash is stored; one live token per account)
  `CREATE TABLE password_resets (
     token_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   );
   CREATE INDEX password_resets_user ON password_resets(user_id);`,
  // 6: artist identity. Each upload credits its own artist name (existing ones get the uploader's
  // display name), optional featured artists and an explicit flag; accounts get an artist profile
  // (name, bio, and a picture kept in storage under avatars/<user id>).
  `ALTER TABLE uploads ADD COLUMN artist_name TEXT;
   ALTER TABLE uploads ADD COLUMN featured_artists TEXT;
   ALTER TABLE uploads ADD COLUMN explicit INTEGER NOT NULL DEFAULT 0 CHECK (explicit IN (0, 1));
   UPDATE uploads SET artist_name = (SELECT display_name FROM users WHERE users.id = uploads.user_id);
   ALTER TABLE users ADD COLUMN artist_name TEXT;
   ALTER TABLE users ADD COLUMN bio TEXT;
   ALTER TABLE users ADD COLUMN avatar_type TEXT;
   ALTER TABLE users ADD COLUMN avatar_at INTEGER;`,
  // 7: artist verification. Artists ask (with optional proof); an admin approves or rejects. At
  // most one pending request per artist, enforced by the partial unique index.
  `ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1));
   CREATE TABLE verification_requests (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
     message TEXT,
     requested_at INTEGER NOT NULL,
     reviewed_at INTEGER,
     reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL
   );
   CREATE UNIQUE INDEX verification_one_pending ON verification_requests(user_id) WHERE status = 'pending';
   CREATE INDEX verification_status ON verification_requests(status, requested_at);`,
];

export interface DbOptions {
  /** The old JSON datastore; its subscribers are copied in once, on first start. */
  legacyJsonFile?: string;
}

/**
 * SQLite datastore (node:sqlite, built into Node 22 — no native build step). `get` / `mutate` /
 * `touch` keep the newsletter code unchanged; other features use `sql` with prepared statements.
 * Mutations are serialized, so a read-modify-write never interleaves with another.
 */
export class Db {
  readonly sql: DatabaseSync;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    file: string | null,
    private opts: DbOptions = {},
  ) {
    if (file) mkdirSync(dirname(file), { recursive: true });
    this.sql = new DatabaseSync(file ?? ':memory:');
    this.sql.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (file) this.sql.exec('PRAGMA journal_mode = WAL;');
  }

  async init(): Promise<void> {
    const { user_version: version } = this.sql.prepare('PRAGMA user_version').get() as { user_version: number };
    for (let v = version; v < MIGRATIONS.length; v++) {
      this.transaction(() => {
        this.sql.exec(MIGRATIONS[v]);
        this.sql.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
    this.importLegacyJson();
  }

  /** Run `fn` in a transaction: all of it is saved, or none of it. */
  transaction<T>(fn: () => T): T {
    this.sql.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.sql.exec('COMMIT');
      return out;
    } catch (e) {
      this.sql.exec('ROLLBACK');
      throw e;
    }
  }

  get(): Readonly<DbShape> {
    return { subscribers: this.sql.prepare('SELECT email, at FROM subscribers ORDER BY at, email').all() as unknown as Subscriber[] };
  }

  /** Run a mutation exclusively; saved before the promise resolves. */
  mutate<T>(fn: (d: DbShape) => T): Promise<T> {
    const run = this.queue.then(() => {
      const before = this.get().subscribers;
      const d: DbShape = { subscribers: before.map((s) => ({ ...s })) };
      const result = fn(d);
      this.transaction(() => this.syncSubscribers(before, d.subscribers));
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Fire-and-forget mutation for low-value writes (still serialized and saved). */
  touch(fn: (d: DbShape) => void): void {
    void this.mutate(fn).catch((e) => console.error('db touch failed', e));
  }

  close(): void {
    this.sql.close();
  }

  private syncSubscribers(before: Subscriber[], after: Subscriber[]): void {
    const keep = new Set(after.map((s) => s.email));
    const del = this.sql.prepare('DELETE FROM subscribers WHERE email = ?');
    for (const s of before) if (!keep.has(s.email)) del.run(s.email);
    const put = this.sql.prepare('INSERT INTO subscribers (email, at) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET at = excluded.at');
    for (const s of after) put.run(s.email, s.at);
  }

  /** Copy subscribers from the pre-SQLite JSON file, once. The file itself is left in place. */
  private importLegacyJson(): void {
    const file = this.opts.legacyJsonFile;
    if (!file || !existsSync(file)) return;
    if (this.sql.prepare("SELECT 1 FROM meta WHERE key = 'legacy_json_imported'").get()) return;
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { subscribers?: unknown };
    const list = Array.isArray(raw.subscribers) ? raw.subscribers : [];
    this.transaction(() => {
      const put = this.sql.prepare('INSERT OR IGNORE INTO subscribers (email, at) VALUES (?, ?)');
      for (const s of list as Partial<Subscriber>[]) {
        if (typeof s?.email === 'string' && s.email) put.run(s.email.trim().toLowerCase(), Number(s.at) || Date.now());
      }
      this.sql.prepare("INSERT INTO meta (key, value) VALUES ('legacy_json_imported', ?)").run(String(Date.now()));
    });
  }
}
