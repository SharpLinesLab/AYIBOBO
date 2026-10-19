import busboy from 'busboy';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { Express, Request, RequestHandler, Response } from 'express';
import type { GenreId } from '../src/catalog/types';
import { avatarUrl, currentUser, requireRole, sameOrigin } from './auth';
import type { Db } from './db';
import type { Storage } from './storage';

/** Same ids as src/catalog/genres.ts (kept here so the server doesn't load the UI's genre labels). */
export const GENRE_IDS = ['kompa', 'rap-kreyol', 'afrobeats', 'amapiano', 'dancehall', 'hip-hop', 'drill', 'rnb', 'zouk', 'reggae', 'gospel', 'rara', 'electronic'] as const satisfies readonly GenreId[];

export interface UploadLimits {
  /** Bytes. Default 50 MB. */
  audio: number;
  /** Bytes. Default 8 MB. */
  cover: number;
}

export const DEFAULT_LIMITS: UploadLimits = { audio: 50 * 1024 * 1024, cover: 8 * 1024 * 1024 };

export type UploadStatus = 'pending' | 'approved' | 'rejected';

/** Error codes the browser shows in the visitor's language (`account.upload.error.*`). */
export type UploadErrorCode =
  | 'not_multipart'
  | 'too_large'
  | 'audio_too_large'
  | 'cover_too_large'
  | 'invalid_audio'
  | 'invalid_cover'
  | 'missing_audio'
  | 'missing_cover'
  | 'unexpected_file'
  | 'invalid_title'
  | 'invalid_genre'
  | 'invalid_duration'
  | 'invalid_artist_name'
  | 'invalid_featured';

export class UploadError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    readonly status = 400,
  ) {
    super(code);
  }
}

// --- file types, by content ------------------------------------------------------------------

const ascii = (b: Buffer, at: number, s: string) => b.length >= at + s.length && b.toString('latin1', at, at + s.length) === s;

/** MP3, WAV, M4A or OGG from the first bytes of the file; the name and declared type are ignored. */
export function sniffAudio(b: Buffer): string | null {
  if (ascii(b, 0, 'ID3')) return 'audio/mpeg';
  // A bare MPEG audio frame: 11 sync bits, then a layer other than "reserved" (excludes ADTS AAC).
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return 'audio/mpeg';
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE')) return 'audio/wav';
  if (ascii(b, 0, 'OggS')) return 'audio/ogg';
  if (ascii(b, 4, 'ftyp') && ['M4A ', 'M4B ', 'M4P ', 'mp42', 'mp41', 'isom', 'iso2', 'iso5', 'iso6', 'dash'].some((brand) => ascii(b, 8, brand))) return 'audio/mp4';
  return null;
}

/** JPEG, PNG, WebP or AVIF from the first bytes of the file. */
export function sniffImage(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'image/webp';
  if (ascii(b, 4, 'ftyp') && (ascii(b, 8, 'avif') || ascii(b, 8, 'avis'))) return 'image/avif';
  return null;
}

// --- multipart --------------------------------------------------------------------------------

interface Incoming {
  path: string;
  size: number;
  type: string;
}

/** Bytes needed to recognize any supported format. */
const HEAD = 16;

/**
 * Stream a multipart upload (fields + `audio` + `cover` files) to temp files, checking each
 * file's type from its content and stopping as soon as a file goes over its cap. On any error,
 * nothing is left behind on disk. With `cover: false` (ads) only the audio file is accepted.
 */
export function readUpload(req: Request, storage: Storage, limits: UploadLimits, opts: { cover: false }): Promise<{ fields: Record<string, string>; audio: Incoming }>;
export function readUpload(req: Request, storage: Storage, limits: UploadLimits, opts?: { cover: true }): Promise<{ fields: Record<string, string>; audio: Incoming; cover: Incoming }>;
export function readUpload(req: Request, storage: Storage, limits: UploadLimits, opts: { cover: boolean } = { cover: true }): Promise<{ fields: Record<string, string>; audio: Incoming; cover?: Incoming }> {
  const allowed = (name: string): name is 'audio' | 'cover' => name === 'audio' || (opts.cover && name === 'cover');
  return new Promise((resolve, reject) => {
    let bb: busboy.Busboy;
    try {
      bb = busboy({ headers: req.headers, limits: { files: 2, fields: 12, parts: 14, fieldSize: 16 * 1024, fileSize: Math.max(limits.audio, limits.cover) + 1 } });
    } catch {
      reject(new UploadError('not_multipart', 415));
      return;
    }
    const fields: Record<string, string> = {};
    const files: Partial<Record<'audio' | 'cover', Incoming>> = {};
    const temps: string[] = [];
    const writes: Promise<void>[] = [];
    /** Stop every file still being written (client gone or form broken). */
    const stoppers: (() => void)[] = [];
    let failure: UploadError | null = null;
    const fail = (e: UploadError) => {
      failure ??= e;
    };

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('file', (name, stream) => {
      if (!allowed(name) || files[name] || failure) {
        if (!allowed(name)) fail(new UploadError('unexpected_file'));
        stream.resume();
        return;
      }
      const kind = name;
      const cap = limits[kind];
      const sniff = kind === 'audio' ? sniffAudio : sniffImage;
      const invalid = new UploadError(kind === 'audio' ? 'invalid_audio' : 'invalid_cover', 415);
      writes.push(
        (async () => {
          const path = await storage.tempPath();
          temps.push(path);
          const out = createWriteStream(path);
          let size = 0;
          let head = Buffer.alloc(0);
          let type: string | null = null;
          let stopped = false;
          await new Promise<void>((done) => {
            stoppers.push(() => {
              stopped = true;
              out.destroy();
              done();
            });
            const stop = (e: UploadError) => {
              fail(e);
              if (stopped) return;
              stopped = true;
              stream.resume(); // drain the rest of this part without keeping it
              out.end();
            };
            out.on('close', done);
            out.on('error', () => {
              fail(new UploadError('too_large', 500));
              done();
            });
            stream.on('data', (chunk: Buffer) => {
              if (stopped) return;
              size += chunk.length;
              if (size > cap) return stop(new UploadError(kind === 'audio' ? 'audio_too_large' : 'cover_too_large', 413));
              if (!type) {
                head = Buffer.concat([head, chunk]);
                if (head.length >= HEAD) {
                  type = sniff(head);
                  if (!type) return stop(invalid);
                }
              }
              if (!out.write(chunk)) {
                stream.pause();
                out.once('drain', () => stream.resume());
              }
            });
            stream.on('limit', () => stop(new UploadError(kind === 'audio' ? 'audio_too_large' : 'cover_too_large', 413)));
            stream.on('end', () => {
              if (stopped) return;
              type ??= sniff(head);
              if (!type) fail(invalid);
              out.end();
            });
          });
          if (!stopped && type) files[kind] = { path, size, type };
        })(),
      );
    });

    const cleanup = () => Promise.all(temps.map((p) => rm(p, { force: true })));
    let settled = false;
    const finish = async () => {
      if (settled) return;
      settled = true;
      await Promise.all(writes);
      const { audio, cover } = files;
      const err = failure ?? (!audio ? new UploadError('missing_audio') : opts.cover && !cover ? new UploadError('missing_cover') : null);
      if (err || !audio) {
        await cleanup();
        reject(err);
        return;
      }
      resolve({ fields, audio, cover });
    };
    // A broken form or a client that disconnects mid-upload: stop writing and clean up.
    const abort = (e: UploadError) => {
      fail(e);
      req.unpipe(bb);
      stoppers.forEach((s) => s());
      void finish();
    };
    bb.on('error', () => abort(new UploadError('not_multipart', 400)));
    bb.on('close', () => void finish());
    req.on('close', () => {
      if (!req.complete) abort(new UploadError('not_multipart', 400));
    });
    req.pipe(bb);
  });
}

// --- records ----------------------------------------------------------------------------------

export interface UploadRecord {
  id: string;
  userId: string;
  /** The artist this song is credited to (set per upload). */
  artistName: string;
  /** Free text, e.g. "Wendyyy, Joé Dwèt Filé"; null when nobody is featured. */
  featuredArtists: string | null;
  explicit: boolean;
  /** The uploader's artist profile, shown on their artist page. */
  profile: { name: string; bio: string | null; avatarUrl: string | null; verified: boolean };
  title: string;
  genre: GenreId;
  status: UploadStatus;
  audioType: string;
  audioSize: number;
  coverType: string;
  duration: number;
  peaks: number[] | null;
  createdAt: number;
  reviewedAt: number | null;
}

interface Row {
  id: string;
  user_id: string;
  artist_name: string | null;
  featured_artists: string | null;
  explicit: number;
  display_name: string;
  profile_name: string | null;
  profile_bio: string | null;
  avatar_type: string | null;
  avatar_at: number | null;
  profile_verified: number;
  title: string;
  genre: GenreId;
  status: UploadStatus;
  audio_type: string;
  audio_size: number;
  cover_type: string;
  duration: number;
  peaks: string | null;
  created_at: number;
  reviewed_at: number | null;
}

const toRecord = (r: Row): UploadRecord => ({
  id: r.id,
  userId: r.user_id,
  artistName: r.artist_name ?? r.display_name,
  featuredArtists: r.featured_artists,
  explicit: r.explicit === 1,
  profile: { name: r.profile_name ?? r.display_name, bio: r.profile_bio, avatarUrl: r.avatar_type && r.avatar_at ? avatarUrl(r.user_id, r.avatar_at) : null, verified: r.profile_verified === 1 },
  title: r.title,
  genre: r.genre,
  status: r.status,
  audioType: r.audio_type,
  audioSize: r.audio_size,
  coverType: r.cover_type,
  duration: r.duration,
  peaks: r.peaks ? (JSON.parse(r.peaks) as number[]) : null,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
});

const SELECT = 'SELECT u.*, us.display_name, us.artist_name AS profile_name, us.bio AS profile_bio, us.avatar_type, us.avatar_at, us.verified AS profile_verified FROM uploads u JOIN users us ON us.id = u.user_id';

export function uploadRepo(db: Db) {
  return {
    get(id: string): UploadRecord | null {
      const r = db.sql.prepare(`${SELECT} WHERE u.id = ?`).get(id) as Row | undefined;
      return r ? toRecord(r) : null;
    },
    byUser(userId: string): UploadRecord[] {
      return (db.sql.prepare(`${SELECT} WHERE u.user_id = ? ORDER BY u.created_at DESC`).all(userId) as unknown as Row[]).map(toRecord);
    },
    byStatus(status: UploadStatus): UploadRecord[] {
      return (db.sql.prepare(`${SELECT} WHERE u.status = ? ORDER BY u.created_at ${status === 'pending' ? 'ASC' : 'DESC'}`).all(status) as unknown as Row[]).map(toRecord);
    },
    insert(u: Omit<UploadRecord, 'profile' | 'reviewedAt' | 'status'> & { coverSize: number }): void {
      db.sql
        .prepare(
          `INSERT INTO uploads (id, user_id, artist_name, featured_artists, explicit, title, genre, status, audio_type, audio_size, cover_type, cover_size, duration, peaks, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          u.id,
          u.userId,
          u.artistName,
          u.featuredArtists,
          u.explicit ? 1 : 0,
          u.title,
          u.genre,
          u.audioType,
          u.audioSize,
          u.coverType,
          u.coverSize,
          u.duration,
          u.peaks ? JSON.stringify(u.peaks) : null,
          u.createdAt,
        );
    },
    setStatus(id: string, status: UploadStatus, reviewerId: string): void {
      db.sql.prepare('UPDATE uploads SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?').run(status, Date.now(), reviewerId, id);
    },
  };
}

/** What artists see about their own uploads. */
const mine = (u: UploadRecord) => ({
  id: u.id,
  title: u.title,
  artistName: u.artistName,
  featuredArtists: u.featuredArtists,
  explicit: u.explicit,
  genre: u.genre,
  status: u.status,
  duration: u.duration,
  createdAt: u.createdAt,
});

// --- fields -----------------------------------------------------------------------------------

/** One line of text: control characters become spaces, ends are trimmed. */
const oneLine = (v: string | undefined) => (v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

/** Longest artist name and featured-artists credit, in characters. */
export const MAX_ARTIST_NAME = 100;
export const MAX_FEATURED = 200;

function cleanFields(f: Record<string, string>): {
  title: string;
  artistName: string;
  featuredArtists: string | null;
  explicit: boolean;
  genre: GenreId;
  duration: number;
  peaks: number[] | null;
} {
  const title = oneLine(f.title);
  if (!title || title.length > 100) throw new UploadError('invalid_title');
  const artistName = oneLine(f.artistName);
  if (!artistName || artistName.length > MAX_ARTIST_NAME) throw new UploadError('invalid_artist_name');
  const featuredArtists = oneLine(f.featuredArtists);
  if (featuredArtists.length > MAX_FEATURED) throw new UploadError('invalid_featured');
  const explicit = ['1', 'true', 'on'].includes((f.explicit ?? '').toLowerCase());
  const genre = f.genre as GenreId;
  if (!(GENRE_IDS as readonly string[]).includes(genre)) throw new UploadError('invalid_genre');
  const duration = Number(f.duration);
  if (!Number.isFinite(duration) || duration < 1 || duration > 4 * 3600) throw new UploadError('invalid_duration');
  let peaks: number[] | null = null;
  try {
    const p = JSON.parse(f.peaks ?? 'null') as unknown;
    if (Array.isArray(p) && p.length > 0 && p.length <= 400 && p.every((x) => typeof x === 'number' && x >= 0 && x <= 1)) peaks = p.map((x) => Math.round(x * 1000) / 1000);
  } catch {
    /* optional; the waveform falls back to a generated one */
  }
  return { title, artistName, featuredArtists: featuredArtists || null, explicit, genre, duration: Math.round(duration * 100) / 100, peaks };
}

// --- routes -----------------------------------------------------------------------------------

export interface UploadRoutesConfig {
  db: Db;
  storage: Storage;
  limits?: Partial<UploadLimits>;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

export function registerUploadRoutes(app: Express, cfg: UploadRoutesConfig) {
  const { storage } = cfg;
  const limits: UploadLimits = { ...DEFAULT_LIMITS, ...cfg.limits };
  const repo = uploadRepo(cfg.db);
  const sendError = (res: Response, e: unknown) => {
    if (e instanceof UploadError) res.status(e.status).json({ ok: false, code: e.code });
    else throw e;
  };

  // Artists (and admins) send a song for review: multipart with `audio`, `cover`, `title`,
  // `artistName`, `genre`, `duration` and optional `featuredArtists`, `explicit` and `peaks`.
  // Every upload starts as "pending".
  app.post('/api/uploads', cfg.rateLimit('uploads', 20, 60 * 60_000), sameOrigin, requireRole('artist', 'admin'), async (req, res) => {
    const declared = Number(req.headers['content-length']);
    if (declared > limits.audio + limits.cover + 1024 * 1024) {
      res.status(413).json({ ok: false, code: 'too_large' });
      return;
    }
    let incoming: Awaited<ReturnType<typeof readUpload>> | null = null;
    const id = randomUUID();
    try {
      incoming = await readUpload(req, storage, limits);
      const fields = cleanFields(incoming.fields);
      await storage.putFile(`audio/${id}`, incoming.audio.path);
      await storage.putFile(`covers/${id}`, incoming.cover.path);
      repo.insert({
        id,
        userId: currentUser(res)!.id,
        ...fields,
        audioType: incoming.audio.type,
        audioSize: incoming.audio.size,
        coverType: incoming.cover.type,
        coverSize: incoming.cover.size,
        createdAt: Date.now(),
      });
      res.status(201).json({ ok: true, upload: mine(repo.get(id)!) });
    } catch (e) {
      if (incoming) {
        await Promise.all([rm(incoming.audio.path, { force: true }), rm(incoming.cover.path, { force: true })]);
        // Files already moved into storage before the failure don't stay behind either.
        await Promise.all([storage.delete(`audio/${id}`), storage.delete(`covers/${id}`)]);
      }
      sendError(res, e);
    }
  });

  // An artist's own uploads and where each one is in review.
  app.get('/api/uploads/mine', requireRole('artist', 'admin'), (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, uploads: repo.byUser(currentUser(res)!.id).map(mine) });
  });

  // --- moderation (admins only; everyone else gets a plain 404, as if it didn't exist) ---------

  const adminOnly: RequestHandler = (_req, res, next) => {
    if (currentUser(res)?.role === 'admin') return next();
    res.status(404).json({ ok: false, error: 'Not found' });
  };
  const forAdmin = (u: UploadRecord) => ({
    ...mine(u),
    audioType: u.audioType,
    audioSize: u.audioSize,
    audioUrl: `/api/admin/uploads/${u.id}/audio`,
    coverUrl: `/api/admin/uploads/${u.id}/cover`,
  });

  app.get('/api/admin/uploads', adminOnly, (req, res) => {
    const status = req.query.status === 'approved' || req.query.status === 'rejected' ? req.query.status : 'pending';
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, uploads: repo.byStatus(status).map(forAdmin) });
  });

  // Previews for review, whatever the status (rejected files are already gone).
  app.get('/api/admin/uploads/:id/audio', adminOnly, (req, res) => {
    const u = repo.get(String(req.params.id));
    if (!u || u.status === 'rejected') return void notFound(res);
    void sendStored(req, res, storage, `audio/${u.id}`, u.audioType, 'private, no-store');
  });
  app.get('/api/admin/uploads/:id/cover', adminOnly, (req, res) => {
    const u = repo.get(String(req.params.id));
    if (!u || u.status === 'rejected') return void notFound(res);
    void sendStored(req, res, storage, `covers/${u.id}`, u.coverType, 'private, no-store');
  });

  app.post('/api/admin/uploads/:id/approve', cfg.rateLimit('moderate', 120, 60_000), sameOrigin, adminOnly, (req, res) => {
    const u = repo.get(String(req.params.id));
    if (!u) return void notFound(res);
    if (u.status !== 'pending') return void res.status(409).json({ ok: false, code: 'not_pending' });
    repo.setStatus(u.id, 'approved', currentUser(res)!.id);
    res.json({ ok: true, upload: forAdmin(repo.get(u.id)!) });
  });

  // Rejected files are deleted from storage; the row stays as a record of the decision.
  app.post('/api/admin/uploads/:id/reject', cfg.rateLimit('moderate', 120, 60_000), sameOrigin, adminOnly, async (req, res) => {
    const u = repo.get(String(req.params.id));
    if (!u) return void notFound(res);
    if (u.status !== 'pending') return void res.status(409).json({ ok: false, code: 'not_pending' });
    await storage.delete(`audio/${u.id}`);
    await storage.delete(`covers/${u.id}`);
    repo.setStatus(u.id, 'rejected', currentUser(res)!.id);
    res.json({ ok: true });
  });

  // --- public: approved songs only -------------------------------------------------------------

  app.get('/api/catalog/uploads', (_req, res) => {
    // Revalidate every time (cheap, via ETag) so an approval shows up right away.
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      ok: true,
      tracks: repo.byStatus('approved').map((u) => ({
        id: u.id,
        title: u.title,
        genre: u.genre,
        artistId: u.userId,
        artistName: u.artistName,
        featuredArtists: u.featuredArtists,
        explicit: u.explicit,
        artist: u.profile,
        duration: u.duration,
        peaks: u.peaks,
        releasedAt: u.reviewedAt ?? u.createdAt,
        audioUrl: `/api/audio/${u.id}`,
        coverUrl: `/api/covers/${u.id}`,
      })),
    });
  });

  // An hour of caching: long enough for smooth seeking and replays, short enough that a song
  // taken down (e.g. after a copyright notice) stops being served soon after.
  const PUBLIC_CACHE = 'public, max-age=3600';
  app.get('/api/audio/:id', (req, res) => {
    const u = repo.get(String(req.params.id));
    if (!u || u.status !== 'approved') return void notFound(res);
    void sendStored(req, res, storage, `audio/${u.id}`, u.audioType, PUBLIC_CACHE);
  });
  app.get('/api/covers/:id', (req, res) => {
    const u = repo.get(String(req.params.id));
    if (!u || u.status !== 'approved') return void notFound(res);
    void sendStored(req, res, storage, `covers/${u.id}`, u.coverType, PUBLIC_CACHE);
  });

  return { repo, limits };
}

const notFound = (res: Response) => res.status(404).json({ ok: false, error: 'Not found' });

/** Parse a single `bytes=` range against `size`. null = send it all; 'invalid' = 416. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return header.includes(',') ? null : 'invalid'; // several ranges: send the whole file
  const [, a, b] = m;
  if (!a && !b) return 'invalid';
  let start: number;
  let end: number;
  if (!a) {
    // "bytes=-500": the last 500 bytes
    const n = Number(b);
    if (n === 0) return 'invalid';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(a);
    end = b ? Math.min(Number(b), size - 1) : size - 1;
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

/** Stream a stored file with HTTP Range support, so the player can seek without downloading it all. */
export async function sendStored(req: Request, res: Response, storage: Storage, key: string, type: string, cacheControl: string) {
  const size = await storage.size(key);
  if (size === null) return void notFound(res);
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('ETag', `"${key.replace('/', '-')}-${size}"`);
  if (req.headers['if-none-match'] === res.getHeader('ETag')) return void res.status(304).end();
  const range = parseRange(req.headers.range, size);
  if (range === 'invalid') {
    res.setHeader('Content-Range', `bytes */${size}`);
    return void res.status(416).end();
  }
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
  } else res.setHeader('Content-Length', size);
  if (req.method === 'HEAD') return void res.end();
  const stream = storage.read(key, range ?? undefined);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
