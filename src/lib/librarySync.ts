/**
 * Keeps your library (likes, follows, playlists, play history) in your account while you're
 * signed in, so it follows you across devices.
 *
 * - A device's first sign-in merges: its library and the account's are united, nothing is lost.
 * - After that the server is the source of truth: each change is sent as a small "op", and the
 *   account's copy is pulled back on sign-in and when the tab comes back into view.
 * - Signed out, nothing is sent; the device keeps its own copy and works exactly as before.
 *
 * Reposts, comments, downloads, device uploads and the display name stay on the device.
 */
import type { Playlist } from '../catalog/types';
import type { Library } from '../music';
import { emptyWireLibrary, LIBRARY_LIMITS, type LibraryOp, type LikeKind, type WireLibrary, type WirePlaylist } from './libraryWire';

const OWNER_KEY = 'asf:library-owner';
const DEVICE_KEY = 'asf:device-id';
const PENDING_KEY = 'asf:library-pending';

const LIKE_FIELDS: [LikeKind, 'likes' | 'likedAlbums' | 'likedPlaylists'][] = [
  ['track', 'likes'],
  ['album', 'likedAlbums'],
  ['playlist', 'likedPlaylists'],
];

// --- conversions (pure) -------------------------------------------------------------------------

/** When a playlist was made, from its `pl-me-<base36 time>` id. */
const createdFromId = (id: string, fallback: number) => {
  const n = parseInt(id.replace(/^pl-me-/, ''), 36);
  return Number.isFinite(n) && n > 1_500_000_000_000 && n <= fallback ? n : fallback;
};

function toWirePlaylist(p: Playlist, now: number, updatedAt = createdFromId(p.id, now)): WirePlaylist {
  const { template, palette, seed, text, subtext } = p.cover;
  const createdAt = createdFromId(p.id, now);
  return {
    id: p.id,
    title: p.title,
    curator: p.curator,
    trackIds: p.trackIds,
    cover: { template, palette, seed, ...(text ? { text } : {}), ...(subtext ? { subtext } : {}) },
    createdAt,
    updatedAt: Math.max(createdAt, updatedAt),
  };
}

const fromWirePlaylist = (p: WirePlaylist): Playlist => ({
  id: p.id,
  title: p.title,
  curator: p.curator,
  description: '',
  trackIds: p.trackIds,
  cover: p.cover,
  followers: 0,
  editorial: false,
  owned: true,
});

/** The synced part of a browser library, in the server's shape. */
export function toWire(l: Library, now = Date.now()): WireLibrary {
  const w = emptyWireLibrary();
  for (const [kind, field] of LIKE_FIELDS) w.likes[kind] = l[field].slice(0, LIBRARY_LIMITS.items);
  w.follows = l.follows.slice(0, LIBRARY_LIMITS.items);
  w.playlists = l.playlists.filter((p) => p.owned !== false).slice(0, LIBRARY_LIMITS.playlists).map((p) => toWirePlaylist(p, now));
  // Local history has no timestamps: keep "recently played" order, everything else older.
  const recent = new Map(l.recents.map((id, i) => [id, now - i * 1000]));
  w.plays = Object.entries(l.plays)
    .filter(([, count]) => count > 0)
    .map(([trackId, count], i) => ({ trackId, count, lastPlayed: recent.get(trackId) ?? now - 30 * 86_400_000 - i * 1000 }))
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .slice(0, LIBRARY_LIMITS.plays);
  return w;
}

/** The browser library with its synced part replaced by the account's copy. */
export function fromWire(l: Library, w: WireLibrary): Library {
  return {
    ...l,
    likes: w.likes.track,
    likedAlbums: w.likes.album,
    likedPlaylists: w.likes.playlist,
    follows: w.follows,
    playlists: w.playlists.map(fromWirePlaylist),
    plays: Object.fromEntries(w.plays.map((p) => [p.trackId, p.count])),
    recents: w.plays.slice(0, 50).map((p) => p.trackId),
  };
}

/** The changes between two versions of the library, as ops for the server. */
export function diffOps(prev: Library, next: Library, now = Date.now()): LibraryOp[] {
  const ops: LibraryOp[] = [];
  for (const [kind, field] of LIKE_FIELDS) {
    if (prev[field] === next[field]) continue;
    const before = new Set(prev[field]);
    const after = new Set(next[field]);
    for (const id of [...next[field]].reverse()) if (!before.has(id)) ops.push({ op: 'like', kind, id });
    for (const id of prev[field]) if (!after.has(id)) ops.push({ op: 'unlike', kind, id });
  }
  if (prev.follows !== next.follows) {
    const before = new Set(prev.follows);
    const after = new Set(next.follows);
    for (const id of [...next.follows].reverse()) if (!before.has(id)) ops.push({ op: 'follow', id });
    for (const id of prev.follows) if (!after.has(id)) ops.push({ op: 'unfollow', id });
  }
  if (prev.playlists !== next.playlists) {
    const before = new Map(prev.playlists.map((p) => [p.id, p]));
    const after = new Set(next.playlists.map((p) => p.id));
    for (const p of next.playlists) if (p.owned !== false && before.get(p.id) !== p) ops.push({ op: 'putPlaylist', playlist: toWirePlaylist(p, now, now) });
    for (const p of prev.playlists) if (!after.has(p.id)) ops.push({ op: 'deletePlaylist', id: p.id });
  }
  if (prev.plays !== next.plays) {
    for (const [trackId, count] of Object.entries(next.plays)) {
      const added = Math.min(50, count - (prev.plays[trackId] ?? 0));
      for (let i = 0; i < added; i++) ops.push({ op: 'play', trackId, at: now });
    }
  }
  return ops;
}

// --- storage helpers ----------------------------------------------------------------------------

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

function deviceId(): string {
  let id = read(DEVICE_KEY);
  if (!id) {
    id = `dev-${crypto.randomUUID()}`;
    write(DEVICE_KEY, id);
  }
  return id;
}

async function call(path: string, body?: unknown): Promise<{ status: number; library?: WireLibrary } | null> {
  try {
    const res = await fetch(path, body === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = res.headers.get('content-type')?.includes('application/json') ? ((await res.json()) as { library?: WireLibrary }) : {};
    return { status: res.status, library: json.library };
  } catch {
    return null; // offline: try again later
  }
}

// --- the sync controller ------------------------------------------------------------------------

export interface SyncHooks {
  /** The library as it is now. */
  get: () => Library;
  /** Replace the library with the account's copy (must not be sent back as changes). */
  replace: (next: Library) => void;
}

/** One per app; MusicProvider wires it to the library state. */
export class LibrarySync {
  private hooks: SyncHooks | null = null;
  private userId: string | null = null;
  private ready = false;
  private flushing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPull = 0;

  attach(hooks: SyncHooks) {
    this.hooks = hooks;
  }

  /** Changes waiting to be sent; kept in storage so a reload doesn't lose them. */
  private get pending(): { userId: string; ops: LibraryOp[] } | null {
    try {
      return JSON.parse(read(PENDING_KEY) ?? 'null') as { userId: string; ops: LibraryOp[] } | null;
    } catch {
      return null;
    }
  }

  private set pending(v: { userId: string; ops: LibraryOp[] } | null) {
    write(PENDING_KEY, v && v.ops.length ? JSON.stringify(v) : null);
  }

  /** Signed in as `userId`: merge on this device's first sign-in, otherwise pull the account's copy. */
  async start(userId: string): Promise<void> {
    if (this.userId === userId && this.ready) return;
    this.userId = userId;
    this.ready = false;
    if (this.pending && this.pending.userId !== userId) this.pending = null;
    const owner = read(OWNER_KEY);
    let r: Awaited<ReturnType<typeof call>>;
    if (!owner) {
      // Never linked to an account: unite this device's library with the account's.
      r = await call('/api/library/merge', { mergeId: deviceId(), library: toWire(this.hooks!.get()) });
    } else {
      // Linked before (to this account, or to someone else who signed out here): the account's
      // copy wins. Another person's leftover library is never merged into yours.
      if (owner === userId) await this.flush(true);
      r = await call('/api/library');
    }
    if (this.userId !== userId) return; // signed out meanwhile
    if (!r || r.status !== 200 || !r.library) return; // offline or server trouble: try again later
    write(OWNER_KEY, userId);
    this.hooks!.replace(fromWire(this.hooks!.get(), r.library));
    this.lastPull = Date.now();
    this.ready = true;
    void this.flush();
  }

  /** Signed out: stop syncing. The device keeps its copy; nothing more is sent. */
  stop() {
    this.userId = null;
    this.ready = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  /** The library changed on this device. */
  record(prev: Library, next: Library) {
    if (!this.userId) return; // signed out: changes stay on this device
    const ops = diffOps(prev, next);
    if (!ops.length) return;
    const p = this.pending;
    this.pending = { userId: this.userId, ops: [...(p?.userId === this.userId ? p.ops : []), ...ops].slice(-2000) };
    if (this.ready && !this.timer) this.timer = setTimeout(() => void this.flush(), 400);
  }

  /** Send queued changes now (also before signing out). */
  async flush(force = false): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.flushing) return this.flushing;
    if (!this.userId || (!this.ready && !force)) return;
    this.flushing = (async () => {
      while (this.userId) {
        const p = this.pending;
        if (!p || p.userId !== this.userId || !p.ops.length) break;
        const batch = p.ops.slice(0, LIBRARY_LIMITS.opsPerRequest);
        const r = await call('/api/library/ops', { ops: batch });
        if (!r || r.status >= 500 || r.status === 429) break; // keep them; retry later
        // Sent (200), refused as malformed (400, retrying won't help), or signed out (401/403).
        const now = this.pending;
        this.pending = now && now.userId === p.userId ? { userId: p.userId, ops: now.ops.slice(batch.length) } : now;
        if (r.status === 401 || r.status === 403) break;
      }
    })();
    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  /** Back online or back in view: finish a sign-in sync that couldn't reach the server, or pull. */
  async resume(): Promise<void> {
    if (this.userId && !this.ready) await this.start(this.userId);
    else await this.pull();
  }

  /** Pick up changes made on other devices (when the tab comes back into view). */
  async pull(): Promise<void> {
    if (!this.userId || !this.ready || Date.now() - this.lastPull < 30_000) return;
    await this.flush();
    if (this.pending?.ops.length) return; // don't overwrite changes that haven't been sent
    const userId = this.userId;
    const r = await call('/api/library');
    if (this.userId !== userId || this.pending?.ops.length || !r?.library || r.status !== 200) return;
    this.lastPull = Date.now();
    this.hooks!.replace(fromWire(this.hooks!.get(), r.library));
  }
}

export const librarySync = new LibrarySync();
