/**
 * Artist royalties: the rules and the earnings formula, shared by the server and the browser (no
 * imports). Pre-launch "shadow mode": streams are counted and eligibility is computed, but no
 * money moves until subscriptions go live.
 */

export const ROYALTY_RULES = {
  /** A play counts as a royalty stream once the listener has heard this many seconds of it. */
  minSeconds: 30,
  /** Premium-listener royalty streams an artist needs in the trailing window to qualify. */
  minPremiumStreams: 500,
  windowDays: 90,
  /** Published (approved) songs an artist needs to qualify. */
  minPublishedTracks: 3,
  /** Share of net subscription revenue (after Stripe fees) that goes to artists. */
  artistShare: 0.8,
} as const;

/** Everything an artist needs to qualify; all four must be true. */
export interface EligibilityCriteria {
  verified: boolean;
  streams: boolean;
  tracks: boolean;
  noStrikes: boolean;
}

export function eligibilityCriteria(a: { verified: boolean; premiumStreams90d: number; publishedTracks: number; activeStrikes: number }): EligibilityCriteria {
  return {
    verified: a.verified,
    streams: a.premiumStreams90d >= ROYALTY_RULES.minPremiumStreams,
    tracks: a.publishedTracks >= ROYALTY_RULES.minPublishedTracks,
    noStrikes: a.activeStrikes === 0,
  };
}

export const isEligible = (c: EligibilityCriteria) => c.verified && c.streams && c.tracks && c.noStrikes;

const cents = (usd: number) => Math.round(usd * 100);

/** artist_pool = 0.80 × (subscription_revenue − stripe_fees), in USD rounded to cents (never below 0). */
export function artistPool(subscriptionRevenue: number, stripeFees: number): number {
  const net = cents(subscriptionRevenue) - cents(stripeFees);
  return net > 0 ? Math.round(net * ROYALTY_RULES.artistShare) / 100 : 0;
}

/** artist_payout = artist_streams / total_eligible_streams × artist_pool, in USD rounded to cents. */
export function artistPayout(artistStreams: number, totalEligibleStreams: number, pool: number): number {
  if (!(totalEligibleStreams > 0) || !(artistStreams > 0) || !(pool > 0)) return 0;
  return Math.round((Math.min(artistStreams, totalEligibleStreams) * cents(pool)) / totalEligibleStreams) / 100;
}

/** UTC calendar month `YYYY-MM` containing `t`. */
export const periodOf = (t: number) => new Date(t).toISOString().slice(0, 7);

/** [start, end) of a `YYYY-MM` period in ms (UTC), or null if it isn't one. */
export function periodRange(period: string): { start: number; end: number } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return { start: Date.UTC(y, mo, 1), end: Date.UTC(y, mo + 1, 1) };
}
