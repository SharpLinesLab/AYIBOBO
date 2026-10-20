/**
 * Promoted tracks in the browser: the songs boosted in feeds right now, the artist's own
 * promotions (#/account, Promote tab) and the admin view (#/admin, Promotions tab).
 */
import { useSyncExternalStore } from 'react';
import type { PromotionStatus } from './promotionRules';

export interface Promotion {
  id: string;
  trackId: string;
  title: string;
  artistId: string;
  artistName: string;
  startsAt: number;
  /** Exclusive: midnight UTC after the last day. */
  endsAt: number;
  days: number;
  status: PromotionStatus;
  priceCents: number;
  stripePaymentId: string | null;
  createdAt: number;
  activatedAt: number | null;
  cancelledAt: number | null;
}

/** Server error codes plus `rate_limited` and `unknown`; shown via `account.promote.error.*`. */
export type PromotionError = 'not_published' | 'invalid_dates' | 'in_past' | 'too_long' | 'too_far' | 'overlap' | 'not_found' | 'not_pending' | 'expired' | 'not_cancellable' | 'invalid_rate' | 'rate_limited' | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; error: PromotionError };

async function send<T>(path: string, method: string, body: object | undefined, pick: (b: Record<string, unknown>) => T): Promise<Result<T>> {
  try {
    const res = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    const out = (await res.json()) as Record<string, unknown> & { ok: boolean; code?: PromotionError };
    return out.ok ? { ok: true, value: pick(out) } : { ok: false, error: out.code ?? 'unknown' };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const myPromotions = () => get<{ rateCents: number; promotions: Promotion[] }>('/api/promotions/mine');
export const createPromotion = (trackId: string, startDate: string, endDate: string) =>
  send('/api/promotions', 'POST', { trackId, startDate, endDate }, (b) => b.promotion as Promotion);

export const adminPromotions = () => get<{ rateCents: number; revenueCents: number; promotions: Promotion[] }>('/api/admin/promotions');
export const activatePromotion = (id: string) => send(`/api/admin/promotions/${encodeURIComponent(id)}/activate`, 'POST', undefined, (b) => b.promotion as Promotion);
export const cancelPromotion = (id: string) => send(`/api/admin/promotions/${encodeURIComponent(id)}/cancel`, 'POST', undefined, (b) => b.promotion as Promotion);
export const setPromotionRate = (rateCents: number) => send('/api/admin/promotions/rate', 'PUT', { rateCents }, (b) => b.rateCents as number);

// --- feeds and badges -------------------------------------------------------------------------------

/** How long a fetched list of promoted songs is reused. */
const TTL = 60_000;
const NONE: string[] = [];
let cache: { at: number; ids: string[]; set: ReadonlySet<string> } | null = null;
let loading: Promise<string[]> | null = null;
const listeners = new Set<() => void>();

/**
 * Fetch the songs promoted right now (active, paid, inside their dates: /api/promoted decides),
 * unless a fresh list is cached. Catalog ids (`srv-…`), in a random order so every promotion gets
 * its turn in feeds. Every card, row and feed reads this one list.
 */
export function loadPromoted(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.ids);
  loading ??= get<{ trackIds?: string[] }>('/api/promoted')
    .then((b) => {
      const ids = (b?.trackIds ?? []).map((id) => `srv-${id}`);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      cache = { at: Date.now(), ids, set: new Set(ids) };
      listeners.forEach((l) => l());
      return ids;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(l: () => void) {
  listeners.add(l);
  void loadPromoted();
  return () => listeners.delete(l);
}
const ids = () => cache?.ids ?? NONE;

/** The songs promoted right now ([] on static hosting, offline, or while loading). */
export function usePromotedIds(): string[] {
  return useSyncExternalStore(subscribe, ids, ids);
}

/** Whether a catalog track is promoted right now: it then carries the "Promoted" badge wherever it's listed. */
export function useIsPromoted(trackId: string): boolean {
  const has = () => !!cache?.set.has(trackId);
  return useSyncExternalStore(subscribe, has, has);
}
