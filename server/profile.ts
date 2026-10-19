/**
 * Artist profiles: the name an artist's songs are credited to by default (their display name
 * until they set one), an optional bio and an optional picture. Artists edit their own on
 * #/account; the picture is public, like their songs.
 */
import busboy from 'busboy';
import { rm, writeFile } from 'node:fs/promises';
import type { Express, Request, RequestHandler } from 'express';
import { currentUser, requireRole, sameOrigin, type User } from './auth';
import type { Db } from './db';
import type { Storage } from './storage';
import { MAX_ARTIST_NAME, sendStored, sniffImage } from './uploads';

export const MAX_BIO = 500;

/** Error codes the browser shows in the visitor's language (`account.profile.error.*`). */
export type ProfileErrorCode = 'invalid_artist_name' | 'invalid_bio' | 'not_multipart' | 'missing_picture' | 'invalid_picture' | 'picture_too_large';

class ProfileError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    readonly status = 400,
  ) {
    super(code);
  }
}

const oneLine = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '');
/** Like oneLine, but keeps line breaks (a bio can have paragraphs). */
const multiLine = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim() : '');

/** Read the multipart `picture` file into memory (at most `max` bytes). */
function readPicture(req: Request, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let bb: busboy.Busboy;
    try {
      bb = busboy({ headers: req.headers, limits: { files: 1, fields: 0, parts: 1, fileSize: max + 1 } });
    } catch {
      reject(new ProfileError('not_multipart', 415));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let found = false;
    let failure: ProfileError | null = null;
    bb.on('file', (name, stream) => {
      if (name !== 'picture' || found) return void stream.resume();
      found = true;
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > max) failure ??= new ProfileError('picture_too_large', 413);
        else chunks.push(chunk);
      });
    });
    bb.on('error', () => reject(new ProfileError('not_multipart')));
    bb.on('close', () => (failure ? reject(failure) : found ? resolve(Buffer.concat(chunks)) : reject(new ProfileError('missing_picture'))));
    req.pipe(bb);
  });
}

export interface ProfileRoutesConfig {
  db: Db;
  storage: Storage;
  /** Largest picture, in bytes (the same cap as song covers). */
  maxPicture: number;
  userById: (id: string) => User | null;
  rateLimit: (bucket: string, perWindow: number, windowMs: number) => RequestHandler;
}

export function registerProfileRoutes(app: Express, cfg: ProfileRoutesConfig) {
  const { db, storage } = cfg;
  const fail = (res: Parameters<RequestHandler>[1], e: unknown) => {
    if (e instanceof ProfileError) res.status(e.status).json({ ok: false, code: e.code });
    else throw e;
  };

  // JSON { artistName, bio }. Empty values clear them (the name falls back to the display name).
  app.put('/api/account/profile', cfg.rateLimit('profile', 30, 60_000), sameOrigin, requireRole('artist', 'admin'), (req, res) => {
    try {
      const artistName = oneLine(req.body?.artistName);
      if (artistName.length > MAX_ARTIST_NAME) throw new ProfileError('invalid_artist_name');
      const bio = multiLine(req.body?.bio);
      if (bio.length > MAX_BIO) throw new ProfileError('invalid_bio');
      const id = currentUser(res)!.id;
      db.sql.prepare('UPDATE users SET artist_name = ?, bio = ? WHERE id = ?').run(artistName || null, bio || null, id);
      res.json({ ok: true, user: cfg.userById(id) });
    } catch (e) {
      fail(res, e);
    }
  });

  // Multipart with one `picture` (JPG, PNG, WebP or AVIF, checked by content). Replaces any earlier one.
  app.post('/api/account/avatar', cfg.rateLimit('avatar', 20, 60 * 60_000), sameOrigin, requireRole('artist', 'admin'), async (req, res) => {
    try {
      if (Number(req.headers['content-length']) > cfg.maxPicture + 64 * 1024) throw new ProfileError('picture_too_large', 413);
      const picture = await readPicture(req, cfg.maxPicture);
      const type = sniffImage(picture);
      if (!type) throw new ProfileError('invalid_picture', 415);
      const id = currentUser(res)!.id;
      const temp = await storage.tempPath();
      try {
        await writeFile(temp, picture);
        await storage.putFile(`avatars/${id}`, temp);
      } finally {
        await rm(temp, { force: true }); // already moved unless something failed
      }
      db.sql.prepare('UPDATE users SET avatar_type = ?, avatar_at = ? WHERE id = ?').run(type, Date.now(), id);
      res.json({ ok: true, user: cfg.userById(id) });
    } catch (e) {
      fail(res, e);
    }
  });

  // Remove the picture: the file is deleted and the profile goes back to the generated portrait.
  app.delete('/api/account/avatar', cfg.rateLimit('avatar', 20, 60 * 60_000), sameOrigin, requireRole('artist', 'admin'), async (_req, res) => {
    const id = currentUser(res)!.id;
    await storage.delete(`avatars/${id}`);
    db.sql.prepare('UPDATE users SET avatar_type = NULL, avatar_at = NULL WHERE id = ?').run(id);
    res.json({ ok: true, user: cfg.userById(id) });
  });

  // Public. The URL carries a version (see avatarUrl), so a new picture gets a new address.
  app.get('/api/artists/:id/avatar', (req, res) => {
    const row = db.sql.prepare('SELECT avatar_type FROM users WHERE id = ?').get(String(req.params.id)) as { avatar_type: string | null } | undefined;
    if (!row?.avatar_type) return void res.status(404).json({ ok: false, error: 'Not found' });
    void sendStored(req, res, storage, `avatars/${String(req.params.id)}`, row.avatar_type, 'public, max-age=86400');
  });
}
