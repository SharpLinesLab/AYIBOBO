/**
 * Promoted tracks: the rules shared by the server and the browser (no imports). Artists pay a flat
 * per-day rate to boost a published song in feeds. Promotion money is separate from royalties and
 * never reaches the royalty pool or artist payouts.
 */

export type PromotionStatus = 'pending_payment' | 'active' | 'scheduled' | 'ended' | 'cancelled';

export const PROMOTION_RULES = {
  /** Default price per day, in cents ($5), until an admin sets another. */
  defaultRateCents: 500,
  /** Highest per-day rate an admin can set, in cents. */
  maxRateCents: 100_000,
  /** Longest promotion, in days. */
  maxDays: 90,
  /** How far ahead a promotion can start, in days. */
  maxLeadDays: 365,
  /** Promoted songs per feed, at most. */
  feedSlots: 2,
} as const;

const DAY = 86_400_000;

/** Midnight UTC of a `YYYY-MM-DD` date, or null if it isn't a real date. */
export function utcDay(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(t).toISOString().slice(0, 10) === date ? t : null;
}

/** `YYYY-MM-DD` (UTC) of a time. */
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Days from a start date to an end date, both included (0 if the end is before the start). */
export function promotionDays(startDate: string, endDate: string): number {
  const a = utcDay(startDate);
  const b = utcDay(endDate);
  return a === null || b === null || b < a ? 0 : Math.round((b - a) / DAY) + 1;
}

/** Total price in cents: the flat per-day rate × days. */
export const promotionPrice = (rateCents: number, days: number) => Math.max(0, Math.round(rateCents)) * Math.max(0, Math.floor(days));

/**
 * A feed with promoted songs mixed in: at most `slots` of them, none that already appear in the
 * feed, placed after the 1st and the 4th organic song (or at the end of a shorter feed).
 */
export function injectPromoted<T extends { id: string }>(organic: T[], promoted: T[], slots: number = PROMOTION_RULES.feedSlots): { item: T; promoted: boolean }[] {
  const have = new Set(organic.map((t) => t.id));
  const picks: T[] = [];
  for (const p of promoted) {
    if (picks.length >= slots) break;
    if (!have.has(p.id)) {
      have.add(p.id);
      picks.push(p);
    }
  }
  const out = organic.map((item) => ({ item, promoted: false }));
  [1, 5].slice(0, picks.length).forEach((at, i) => out.splice(Math.min(at, out.length), 0, { item: picks[i], promoted: true }));
  return out;
}
