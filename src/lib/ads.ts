/** Audio ads (free tier): the next ad for this listener, and the admin side of managing ads. */

export interface NextAd {
  id: string;
  title: string;
  advertiserName: string;
  duration: number;
  audioUrl: string;
}

export interface AdminAd {
  id: string;
  title: string;
  advertiserName: string;
  duration: number;
  weight: number;
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
  createdAt: number;
  audioUrl: string;
  /** Plays per UTC day for the last 7 days, oldest first (the last one is today). */
  playsByDay: { day: string; plays: number }[];
}

/** Server error codes plus `unreadable` (the browser can't decode the file), `rate_limited` and `unknown`. */
export type AdError =
  | 'invalid_title'
  | 'invalid_advertiser'
  | 'invalid_duration'
  | 'invalid_weight'
  | 'invalid_dates'
  | 'invalid_audio'
  | 'audio_too_large'
  | 'missing_audio'
  | 'unreadable'
  | 'rate_limited'
  | 'unknown';

/** Same cap as the server. */
export const MAX_AD_SECONDS = 30;

const LISTENER_KEY = 'asf:listener';

/** A random id for this browser, so signed-out listeners get the same daily ad cap as accounts. */
function listenerId(): string | null {
  try {
    let id = localStorage.getItem(LISTENER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LISTENER_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** The ad to play now, or null (none due for this listener, premium, or no API server). */
export async function fetchNextAd(): Promise<NextAd | null> {
  try {
    const id = listenerId();
    const res = await fetch('/api/ads/next', { credentials: 'same-origin', headers: id ? { 'x-asf-listener': id } : {} });
    if (res.status !== 200 || !res.headers.get('content-type')?.includes('application/json')) return null;
    return ((await res.json()) as { ad?: NextAd }).ad ?? null;
  } catch {
    return null;
  }
}

// --- admins ------------------------------------------------------------------------------------

type Result = { ok: true; ad: AdminAd } | { ok: false; error: AdError };

async function result(res: Promise<Response>): Promise<Result> {
  try {
    const r = await res;
    if (r.status === 429) return { ok: false, error: 'rate_limited' };
    const body = (await r.json()) as { ok: boolean; ad?: AdminAd; code?: string };
    if (body.ok && body.ad) return { ok: true, ad: body.ad };
    const known: AdError[] = ['invalid_title', 'invalid_advertiser', 'invalid_duration', 'invalid_weight', 'invalid_dates', 'invalid_audio', 'audio_too_large', 'missing_audio'];
    return { ok: false, error: known.includes(body.code as AdError) ? (body.code as AdError) : 'unknown' };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

export async function listAds(): Promise<AdminAd[] | null> {
  try {
    const res = await fetch('/api/admin/ads', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as { ads: AdminAd[] }).ads : null;
  } catch {
    return null;
  }
}

export interface AdFields {
  title: string;
  advertiserName: string;
  weight: number;
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
}

export function createAd(fields: AdFields & { audio: File; duration: number }): Promise<Result> {
  const form = new FormData();
  form.append('title', fields.title);
  form.append('advertiserName', fields.advertiserName);
  form.append('weight', String(fields.weight));
  form.append('duration', String(fields.duration));
  if (fields.active) form.append('active', '1');
  if (fields.startsAt !== null) form.append('startsAt', String(fields.startsAt));
  if (fields.endsAt !== null) form.append('endsAt', String(fields.endsAt));
  form.append('audio', fields.audio);
  return result(fetch('/api/admin/ads', { method: 'POST', body: form, credentials: 'same-origin' }));
}

export function updateAd(id: string, fields: Partial<AdFields>): Promise<Result> {
  return result(
    fetch(`/api/admin/ads/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields) }),
  );
}

export async function deleteAd(id: string): Promise<boolean> {
  try {
    return (await fetch(`/api/admin/ads/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })).ok;
  } catch {
    return false;
  }
}
