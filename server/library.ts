import type { Express, RequestHandler } from 'express';
import type { CoverTemplate } from '../src/catalog/types';
import { LIBRARY_LIMITS, LIKE_KINDS, emptyWireLibrary, type LibraryOp, type LikeKind, type WireLibrary, type WirePlay, type WirePlaylist } from '../src/lib/libraryWire';
import { currentUser, requireRole, sameOrigin } from './auth';
import type { Db } from './db';

/** Refuse a request whose library data doesn't have the expected shape. */
export class LibraryError extends Error {}

const ID = /^[\w:.-]{1,120}$/;
const HEX = /^#[0-9a-f]{3,8}$/i;
const TEMPLATES: readonly CoverTemplate[] = ['orb', 'sun', 'rings', 'waves', 'grid', 'type', 'split', 'photo', 'portrait', 'poster', 'stage', 'mix'];

const id = (v: unknown): string => {
  if (typeof v !== 'string' || !ID.test(v)) throw new LibraryError('invalid id');
  return v;
};
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const time = (v: unknown, now: number): number => {
  const n = Number(v);
  // Clamp to a sane window: never in the future, never before ASF existed.
  return Number.isFinite(n) ? Math.min(now, Math.max(Date.UTC(2020, 0, 1), Math.round(n))) : now;
};
const kind = (v: unknown): LikeKind => {
  if (!LIKE_KINDS.includes(v as LikeKind)) throw new LibraryError('invalid kind');
  return v as LikeKind;
};
const ids = (v: unknown, max: number): string[] => {
  if (!Array.isArray(v) || v.length > max) throw new LibraryError('invalid list');
  return [...new Set(v.map(id))];
};

function playlist(v: unknown, now: number): WirePlaylist {
  const p = (v ?? {}) as Record<string, unknown>;
  const c = (p.cover ?? {}) as Record<string, unknown>;
  const palette = Array.isArray(c.palette) && c.palette.length === 3 && c.palette.every((x) => typeof x === 'string' && HEX.test(x)) ? (c.palette as [string, string, string]) : null;
  if (!TEMPLATES.includes(c.template as CoverTemplate) || !palette || !Number.isFinite(Number(c.seed))) throw new LibraryError('invalid cover');
  const created = time(p.createdAt, now);
  return {
    id: id(p.id),
    title: text(p.title, 60) || 'Playlist',
    curator: text(p.curator, 60),
    trackIds: ids(p.trackIds, LIBRARY_LIMITS.tracksPerPlaylist),
    cover: { template: c.template as CoverTemplate, palette, seed: Number(c.seed), ...(c.text ? { text: text(c.text, 40) } : {}), ...(c.subtext ? { subtext: text(c.subtext, 40) } : {}) },
    createdAt: created,
    updatedAt: Math.max(created, time(p.updatedAt, now)),
  };
}

/** Validate one change; throws LibraryError if it's malformed. */
export function parseOp(v: unknown, now = Date.now()): LibraryOp {
  const o = (v ?? {}) as Record<string, unknown>;
  switch (o.op) {
    case 'like':
    case 'unlike':
      return { op: o.op, kind: kind(o.kind), id: id(o.id) };
    case 'follow':
    case 'unfollow':
      return { op: o.op, id: id(o.id) };
    case 'putPlaylist':
      return { op: 'putPlaylist', playlist: playlist(o.playlist, now) };
    case 'deletePlaylist':
      return { op: 'deletePlaylist', id: id(o.id) };
    case 'play':
      return { op: 'play', trackId: id(o.trackId), at: time(o.at, now) };
    default:
      throw new LibraryError('invalid op');
  }
}

/** Validate a whole library (sent once per device, on its first sign-in). */
export function parseLibrary(v: unknown, now = Date.now()): WireLibrary {
  const l = (v ?? {}) as Record<string, unknown>;
  const likes = (l.likes ?? {}) as Record<string, unknown>;
  if (!Array.isArray(l.playlists) || l.playlists.length > LIBRARY_LIMITS.playlists) throw new LibraryError('invalid playlists');
  if (!Array.isArray(l.plays) || l.plays.length > LIBRARY_LIMITS.plays) throw new LibraryError('invalid plays');
  return {
    likes: { track: ids(likes.track ?? [], LIBRARY_LIMITS.items), album: ids(likes.album ?? [], LIBRARY_LIMITS.items), playlist: ids(likes.playlist ?? [], LIBRARY_LIMITS.items) },
    follows: ids(l.follows ?? [], LIBRARY_LIMITS.items),
    playlists: l.playlists.map((p) => playlist(p, now)),
    plays: l.plays.map((p): WirePlay => {
      const x = (p ?? {}) as Record<string, unknown>;
      const count = Math.floor(Number(x.count));
      if (!Number.isFinite(count) || count < 1 || count > 1_000_000) throw new LibraryError('invalid play count');
      return { trackId: id(x.trackId), count, lastPlayed: time(x.lastPlayed, now) };
    }),
  };
}

/** One account's library, always scoped to `userId` — no query here can reach another user's rows. */
export function libraryRepo(db: Db) {
  const q = db.sql;

  function read(userId: string): WireLibrary {
    const lib = emptyWireLibrary();
    for (const r of q.prepare('SELECT kind, item_id FROM library_likes WHERE user_id = ? ORDER BY created_at DESC, rowid DESC').all(userId) as { kind: LikeKind; item_id: string }[]) lib.likes[r.kind].push(r.item_id);
    lib.follows = (q.prepare('SELECT artist_id FROM library_follows WHERE user_id = ? ORDER BY created_at DESC, rowid DESC').all(userId) as { artist_id: string }[]).map((r) => r.artist_id);
    lib.playlists = (q.prepare('SELECT * FROM library_playlists WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Record<string, string & number>[]).map((r) => ({
      id: r.id,
      title: r.title,
      curator: r.curator,
      trackIds: JSON.parse(r.track_ids) as string[],
      cover: JSON.parse(r.cover) as WirePlaylist['cover'],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    lib.plays = (q.prepare('SELECT track_id, count, last_played FROM library_plays WHERE user_id = ? ORDER BY last_played DESC').all(userId) as { track_id: string; count: number; last_played: number }[]).map((r) => ({
      trackId: r.track_id,
      count: r.count,
      lastPlayed: r.last_played,
    }));
    return lib;
  }

  const like = (userId: string, k: LikeKind, item: string, at: number) => q.prepare('INSERT OR IGNORE INTO library_likes (user_id, kind, item_id, created_at) VALUES (?, ?, ?, ?)').run(userId, k, item, at);
  const follow = (userId: string, artist: string, at: number) => q.prepare('INSERT OR IGNORE INTO library_follows (user_id, artist_id, created_at) VALUES (?, ?, ?)').run(userId, artist, at);
  const putPlaylist = (userId: string, p: WirePlaylist) =>
    q
      .prepare(
        `INSERT INTO library_playlists (user_id, id, title, curator, track_ids, cover, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET title = excluded.title, curator = excluded.curator, track_ids = excluded.track_ids, cover = excluded.cover, updated_at = excluded.updated_at`,
      )
      .run(userId, p.id, p.title, p.curator, JSON.stringify(p.trackIds), JSON.stringify(p.cover), p.createdAt, p.updatedAt);

  /** Drop the oldest entries beyond the per-account limits. */
  function prune(userId: string) {
    for (const k of LIKE_KINDS)
      q.prepare('DELETE FROM library_likes WHERE user_id = ? AND kind = ? AND rowid NOT IN (SELECT rowid FROM library_likes WHERE user_id = ? AND kind = ? ORDER BY created_at DESC LIMIT ?)').run(userId, k, userId, k, LIBRARY_LIMITS.items);
    q.prepare('DELETE FROM library_follows WHERE user_id = ? AND rowid NOT IN (SELECT rowid FROM library_follows WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)').run(userId, userId, LIBRARY_LIMITS.items);
    q.prepare('DELETE FROM library_playlists WHERE user_id = ? AND rowid NOT IN (SELECT rowid FROM library_playlists WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?)').run(userId, userId, LIBRARY_LIMITS.playlists);
    q.prepare('DELETE FROM library_plays WHERE user_id = ? AND rowid NOT IN (SELECT rowid FROM library_plays WHERE user_id = ? ORDER BY last_played DESC LIMIT ?)').run(userId, userId, LIBRARY_LIMITS.plays);
  }

  /** Apply changes in order, all or nothing. */
  function apply(userId: string, ops: LibraryOp[], now = Date.now()) {
    db.transaction(() => {
      for (const o of ops) {
        switch (o.op) {
          case 'like':
            like(userId, o.kind, o.id, now);
            break;
          case 'unlike':
            q.prepare('DELETE FROM library_likes WHERE user_id = ? AND kind = ? AND item_id = ?').run(userId, o.kind, o.id);
            break;
          case 'follow':
            follow(userId, o.id, now);
            break;
          case 'unfollow':
            q.prepare('DELETE FROM library_follows WHERE user_id = ? AND artist_id = ?').run(userId, o.id);
            break;
          case 'putPlaylist':
            putPlaylist(userId, o.playlist);
            break;
          case 'deletePlaylist':
            q.prepare('DELETE FROM library_playlists WHERE user_id = ? AND id = ?').run(userId, o.id);
            break;
          case 'play':
            q.prepare(
              `INSERT INTO library_plays (user_id, track_id, count, last_played) VALUES (?, ?, 1, ?)
               ON CONFLICT(user_id, track_id) DO UPDATE SET count = count + 1, last_played = MAX(last_played, excluded.last_played)`,
            ).run(userId, o.trackId, o.at);
            break;
        }
      }
      prune(userId);
    });
  }

  /**
   * Union a device's library into the account so nothing is lost on either side. Each device
   * merges once (`mergeId`); a repeat — e.g. a retry after a dropped response — changes nothing,
   * so play counts are never added twice.
   */
  function merge(userId: string, mergeId: string, local: WireLibrary, now = Date.now()) {
    db.transaction(() => {
      const done = q.prepare('INSERT OR IGNORE INTO library_merges (user_id, merge_id, merged_at) VALUES (?, ?, ?)').run(userId, mergeId, now);
      if (done.changes === 0) return;
      // Oldest first, so the device's newest items end up newest on the server too.
      for (const k of LIKE_KINDS) [...local.likes[k]].reverse().forEach((item, i) => like(userId, k, item, now - local.likes[k].length + i));
      [...local.follows].reverse().forEach((a, i) => follow(userId, a, now - local.follows.length + i));
      const existing = new Map(read(userId).playlists.map((p) => [p.id, p]));
      for (const p of local.playlists) {
        const have = existing.get(p.id);
        // Same playlist on both sides: keep the newer title, and every song from both.
        if (have) putPlaylist(userId, { ...(p.updatedAt > have.updatedAt ? p : have), trackIds: [...new Set([...have.trackIds, ...p.trackIds])].slice(0, LIBRARY_LIMITS.tracksPerPlaylist), createdAt: Math.min(p.createdAt, have.createdAt), updatedAt: Math.max(p.updatedAt, have.updatedAt) });
        else putPlaylist(userId, p);
      }
      for (const p of local.plays)
        q.prepare(
          `INSERT INTO library_plays (user_id, track_id, count, last_played) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, track_id) DO UPDATE SET count = count + excluded.count, last_played = MAX(last_played, excluded.last_played)`,
        ).run(userId, p.trackId, p.count, p.lastPlayed);
      prune(userId);
    });
    return read(userId);
  }

  return { read, apply, merge };
}

export interface LibraryRoutesConfig {
  db: Db;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

/** /api/library: the signed-in user's own library. Every route needs a session. */
export function registerLibraryRoutes(app: Express, cfg: LibraryRoutesConfig) {
  const repo = libraryRepo(cfg.db);
  const signedIn = requireRole();
  const bad = (res: Parameters<RequestHandler>[1], e: unknown) => {
    if (e instanceof LibraryError) res.status(400).json({ ok: false, code: 'invalid_library', error: e.message });
    else throw e;
  };

  app.get('/api/library', cfg.rateLimit('library-read', 120, 60_000), signedIn, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, library: repo.read(currentUser(res)!.id) });
  });

  // A device's first sign-in: union its library with the account's and return the result.
  app.post('/api/library/merge', cfg.rateLimit('library-merge', 20, 60 * 60_000), sameOrigin, signedIn, (req, res) => {
    try {
      const mergeId = id(req.body?.mergeId);
      const library = repo.merge(currentUser(res)!.id, mergeId, parseLibrary(req.body?.library));
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, library });
    } catch (e) {
      bad(res, e);
    }
  });

  // Changes made while signed in, in order (a like, a play, an edited playlist…).
  app.post('/api/library/ops', cfg.rateLimit('library-write', 300, 60_000), sameOrigin, signedIn, (req, res) => {
    try {
      const raw = req.body?.ops;
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIBRARY_LIMITS.opsPerRequest) throw new LibraryError('invalid ops');
      const ops = raw.map((o) => parseOp(o));
      repo.apply(currentUser(res)!.id, ops);
      res.json({ ok: true, applied: ops.length });
    } catch (e) {
      bad(res, e);
    }
  });

  return repo;
}
