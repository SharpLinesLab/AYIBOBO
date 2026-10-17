import type { BoardId, LeaderboardState, Listing, Payment, RankedEntry } from './types';

export const MIN_BID = 10;
export const MAX_BID = 999_999;
/** Taking #1 costs at least this much more than the current #1. */
export const TOP_PREMIUM = 5;
/** Taking any other rank costs at least this much more than its holder. */
export const RANK_INCREMENT = 1;

const DAY_MS = 86_400_000;

export function startOfUtcDay(t: number): number {
  return Math.floor(t / DAY_MS) * DAY_MS;
}

/** `YYYY-MM-DD` for the UTC calendar day containing `t`. */
export function utcDayKey(t: number): string {
  return new Date(startOfUtcDay(t)).toISOString().slice(0, 10);
}

export function dayKeyToStart(key: string): number {
  const t = Date.parse(`${key}T00:00:00.000Z`);
  if (Number.isNaN(t)) throw new Error(`Invalid day key: ${key}`);
  return t;
}

export function shiftDayKey(key: string, days: number): string {
  return utcDayKey(dayKeyToStart(key) + days * DAY_MS);
}

export interface Window {
  /** Inclusive start (ms). */
  from?: number;
  /** Exclusive end (ms). */
  to?: number;
}

/**
 * Rank listings by total spend inside a time window. Higher totals rank higher; equal totals keep
 * chronological order — whoever reached the board first (earliest payment in the window) stays above.
 */
export function computeBoard(state: LeaderboardState, window: Window = {}): RankedEntry[] {
  const byId = new Map<string, Listing>(state.listings.map((l) => [l.id, l]));
  const agg = new Map<string, { total: number; since: number; last: number; seq: number }>();
  state.payments.forEach((p, seq) => {
    if (window.from !== undefined && p.at < window.from) return;
    if (window.to !== undefined && p.at >= window.to) return;
    if (!byId.has(p.listingId)) return;
    const a = agg.get(p.listingId);
    if (a) {
      a.total += p.amount;
      if (p.at < a.since || (p.at === a.since && seq < a.seq)) {
        a.since = p.at;
        a.seq = seq;
      }
      a.last = Math.max(a.last, p.at);
    } else {
      agg.set(p.listingId, { total: p.amount, since: p.at, last: p.at, seq });
    }
  });
  const rows = [...agg.entries()].map(([id, a]) => ({ listing: byId.get(id)!, ...a }));
  rows.sort((x, y) => y.total - x.total || x.since - y.since || x.seq - y.seq);
  return rows.map((r, i) => ({ listing: r.listing, rank: i + 1, total: r.total, since: r.since, lastPaidAt: r.last }));
}

export function boardWindow(board: BoardId, now: number): Window {
  return board === 'today' ? { from: startOfUtcDay(now) } : {};
}

export function getBoard(state: LeaderboardState, board: BoardId, now: number): RankedEntry[] {
  return computeBoard(state, boardWindow(board, now));
}

/** Frozen snapshot of a single UTC calendar day. */
export function getArchiveBoard(state: LeaderboardState, dayKey: string): RankedEntry[] {
  const from = dayKeyToStart(dayKey);
  return computeBoard(state, { from, to: from + DAY_MS });
}

/** Minimum total needed to take `rank` on a board (+$5 for #1, +$1 otherwise, $10 floor). */
export function minBidForRank(entries: RankedEntry[], rank: number): number {
  const holder = entries[rank - 1];
  if (!holder) return MIN_BID;
  const inc = rank === 1 ? TOP_PREMIUM : RANK_INCREMENT;
  return Math.min(MAX_BID, Math.max(MIN_BID, holder.total + inc));
}

export interface RankProjection {
  rank: number;
  /** True when this amount would land on #1 but doesn't clear the +$5 premium. */
  belowTopPremium: boolean;
  /** Minimum total to take #1 from the current holder. */
  minForTop: number;
}

/**
 * Where a listing would land with `amount` as its board total. `selfId` (when topping up) is
 * excluded from the competition and keeps its own tie-break seniority.
 */
export function projectRank(entries: RankedEntry[], amount: number, selfId?: string, now = Date.now()): RankProjection {
  const self = selfId ? entries.find((e) => e.listing.id === selfId) : undefined;
  const others = entries.filter((e) => e.listing.id !== selfId);
  const selfSince = self?.since ?? now;
  let ahead = 0;
  for (const o of others) {
    if (o.total > amount || (o.total === amount && o.since <= selfSince)) ahead++;
  }
  const rank = ahead + 1;
  const holder = entries[0];
  const selfIsTop = !!holder && holder.listing.id === selfId;
  const minForTop = holder ? (selfIsTop ? holder.total + RANK_INCREMENT : holder.total + TOP_PREMIUM) : MIN_BID;
  const belowTopPremium = rank === 1 && !!holder && !selfIsTop && amount < holder.total + TOP_PREMIUM;
  return { rank: belowTopPremium ? 2 : rank, belowTopPremium, minForTop: Math.min(MAX_BID, minForTop) };
}

/**
 * Step the hero amount by ±1, skipping the dead band between the #1 total and #1 + $5
 * (amounts that would sort first without paying the premium).
 */
export function stepAmount(entries: RankedEntry[], amount: number, dir: 1 | -1, floor: number, selfId?: string): number {
  let next = clampBid(amount + dir, floor);
  const holder = entries[0];
  if (holder && holder.listing.id !== selfId) {
    const top = holder.total;
    if (next > top && next < top + TOP_PREMIUM) next = dir > 0 ? top + TOP_PREMIUM : top;
  }
  return clampBid(next, floor);
}

export function clampBid(amount: number, floor = MIN_BID): number {
  if (!Number.isFinite(amount)) return floor;
  return Math.min(MAX_BID, Math.max(floor, Math.round(amount)));
}

export function totalOnBoard(entries: RankedEntry[], listingId: string): number {
  return entries.find((e) => e.listing.id === listingId)?.total ?? 0;
}

export function rankOnBoard(entries: RankedEntry[], listingId: string): number | null {
  return entries.find((e) => e.listing.id === listingId)?.rank ?? null;
}

/** Board as it stood immediately after a given payment (for activity feed "at #N"). */
export function rankAfterPayment(state: LeaderboardState, payment: Payment, board: BoardId): number | null {
  const idx = state.payments.indexOf(payment);
  const upto: LeaderboardState = {
    listings: state.listings,
    payments: state.payments.filter((p, i) => p.at < payment.at || (p.at === payment.at && i <= idx)),
  };
  const window = boardWindow(board, payment.at);
  return rankOnBoard(computeBoard(upto, { ...window, to: payment.at + 1 }), payment.listingId);
}
