/**
 * Promoted tracks in the browser: the songs boosted in feeds right now, the artist's own
 * promotions (#/account, Promote tab) and the admin view (#/admin, Promotions tab).
 */
import { useEffect, useState } from 'react';
import type { PackageId, PricedPackage, PromotionStatus } from './promotionRules';

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
export type PromotionError = 'not_published' | 'invalid_package' | 'invalid_dates' | 'in_past' | 'too_far' | 'overlap' | 'not_found' | 'not_pending' | 'expired' | 'not_cancellable' | 'invalid_prices' | 'rate_limited' | 'unknown';

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

export const myPromotions = () => get<{ packages: PricedPackage[]; promotions: Promotion[] }>('/api/promotions/mine');
export const createPromotion = (trackId: string, packageId: PackageId, startDate: string) =>
  send('/api/promotions', 'POST', { trackId, packageId, startDate }, (b) => b.promotion as Promotion);

export const adminPromotions = () => get<{ packages: PricedPackage[]; revenueCents: number; promotions: Promotion[] }>('/api/admin/promotions');
export const activatePromotion = (id: string) => send(`/api/admin/promotions/${encodeURIComponent(id)}/activate`, 'POST', undefined, (b) => b.promotion as Promotion);
export const cancelPromotion = (id: string) => send(`/api/admin/promotions/${encodeURIComponent(id)}/cancel`, 'POST', undefined, (b) => b.promotion as Promotion);
export const setPackagePrices = (prices: Partial<Record<PackageId, number>>) => send('/api/admin/promotions/packages', 'PUT', { prices }, (b) => b.packages as PricedPackage[]);

// --- feeds ---------------------------------------------------------------------------------------

/** How long a fetched list of promoted songs is reused. */
const TTL = 60_000;
let cache: { at: number; ids: string[] } | null = null;
let loading: Promise<string[]> | null = null;

/** Catalog ids (`srv-…`) of the songs promoted now, in a random order so every promotion gets its turn. */
function load(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.ids);
  loading ??= get<{ trackIds?: string[] }>('/api/promoted')
    .then((b) => {
      const ids = (b?.trackIds ?? []).map((id) => `srv-${id}`);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      cache = { at: Date.now(), ids };
      return ids;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** The songs promoted right now ([] on static hosting, offline, or while loading). */
export function usePromotedIds(): string[] {
  const [ids, setIds] = useState<string[]>(() => cache?.ids ?? []);
  useEffect(() => {
    let live = true;
    void load().then((x) => live && setIds(x));
    return () => {
      live = false;
    };
  }, []);
  return ids;
}
