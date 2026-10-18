/** Artist submissions to the server (reviewed before they're published). */
import type { GenreId } from '../catalog/types';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  title: string;
  genre: GenreId;
  status: SubmissionStatus;
  duration: number;
  createdAt: number;
}

/** Server error codes plus `rate_limited`, `unreadable` (the browser can't decode the file) and `unknown`. */
export type SubmissionError =
  | 'too_large'
  | 'audio_too_large'
  | 'cover_too_large'
  | 'invalid_audio'
  | 'invalid_cover'
  | 'missing_audio'
  | 'missing_cover'
  | 'invalid_title'
  | 'invalid_genre'
  | 'invalid_duration'
  | 'unreadable'
  | 'rate_limited'
  | 'unknown';

/** Same caps as the server, checked first so a big file isn't sent only to be refused. */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_COVER_BYTES = 8 * 1024 * 1024;

export async function submitSong(input: {
  title: string;
  genre: GenreId;
  audio: File;
  cover: File;
  duration: number;
  peaks: number[];
}): Promise<{ ok: true; upload: Submission } | { ok: false; error: SubmissionError }> {
  if (input.audio.size > MAX_AUDIO_BYTES) return { ok: false, error: 'audio_too_large' };
  if (input.cover.size > MAX_COVER_BYTES) return { ok: false, error: 'cover_too_large' };
  const form = new FormData();
  form.append('title', input.title);
  form.append('genre', input.genre);
  form.append('duration', String(input.duration));
  form.append('peaks', JSON.stringify(input.peaks));
  form.append('audio', input.audio);
  form.append('cover', input.cover);
  try {
    const res = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'same-origin' });
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    const body = (await res.json()) as { ok: boolean; upload?: Submission; code?: SubmissionError };
    return body.ok && body.upload ? { ok: true, upload: body.upload } : { ok: false, error: body.code ?? 'unknown' };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

export async function mySubmissions(): Promise<Submission[]> {
  try {
    const res = await fetch('/api/uploads/mine', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as { uploads: Submission[] }).uploads : [];
  } catch {
    return [];
  }
}

/** A pending upload as an admin reviews it (previews come from admin-only URLs). */
export interface ReviewItem extends Submission {
  artistName: string;
  audioType: string;
  audioSize: number;
  audioUrl: string;
  coverUrl: string;
}

export async function pendingReviews(): Promise<ReviewItem[] | null> {
  try {
    const res = await fetch('/api/admin/uploads?status=pending', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as { uploads: ReviewItem[] }).uploads : null;
  } catch {
    return null;
  }
}

export async function moderate(id: string, action: 'approve' | 'reject'): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/uploads/${encodeURIComponent(id)}/${action}`, { method: 'POST', credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}
