/**
 * Promoted tracks: the rules shared by the server and the browser (no imports). Artists buy a
 * package (a fixed number of days at a fixed price) to boost a published song in feeds. Promotion
 * money is ASF's alone: it is separate from royalties and never reaches the royalty pool or payouts.
 */

export type PromotionStatus = 'pending_payment' | 'active' | 'scheduled' | 'ended' | 'cancelled';

export type PackageId = 'day1' | 'day3' | 'day7';

export interface PromotionPackage {
  id: PackageId;
  days: number;
  /** Price until an admin sets another, in cents. */
  defaultCents: number;
  /** Shown as "Best value". */
  bestValue?: boolean;
}

/** The packages on sale. Their prices live in the settings table (see server/promotions.ts). */
export const PACKAGES: readonly PromotionPackage[] = [
  { id: 'day1', days: 1, defaultCents: 500 },
  { id: 'day3', days: 3, defaultCents: 1200 },
  { id: 'day7', days: 7, defaultCents: 2500, bestValue: true },
];

export const packageById = (id: unknown): PromotionPackage | undefined => PACKAGES.find((p) => p.id === id);

/** A package with its current price, as the server sends it. */
export interface PricedPackage {
  id: PackageId;
  days: number;
  priceCents: number;
}

export const PROMOTION_RULES = {
  /** Highest package price an admin can set, in cents ($1,000). */
  maxPackageCents: 100_000,
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

/** The last day (`YYYY-MM-DD`, UTC) of a promotion of `days` days from `startDate`, both included; null for a bad date. */
export function packageEndDate(startDate: string, days: number): string | null {
  const start = utcDay(startDate);
  return start === null ? null : isoDay(start + (days - 1) * DAY);
}

/** Price per day, in cents (rounded), so packages can be compared. */
export const perDayCents = (p: { priceCents: number; days: number }) => Math.round(p.priceCents / p.days);

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
