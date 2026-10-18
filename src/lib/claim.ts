import { t } from '../i18n';
import { usd } from './format';
import { MAX_BID, MIN_BID, getBoard, projectRank, rankOnBoard, totalOnBoard } from './ranking';
import type { NormalizedTarget } from './normalize';
import type { Artwork, AudioPreview, BoardId, CategoryId, LeaderboardState, Listing, Payment } from './types';

export interface RankChange {
  before: number | null;
  after: number;
  totalBefore: number;
  totalAfter: number;
}

export interface ClaimQuote {
  ok: true;
  mode: 'new' | 'topup';
  board: BoardId;
  key: string;
  listing?: Listing;
  /** Target total on the chosen board. */
  targetTotal: number;
  /** Current total on the chosen board (0 for new listings). */
  currentTotal: number;
  /** What the buyer pays now: full amount for new listings, the difference for top-ups. */
  charge: number;
  ranks: Record<BoardId, RankChange>;
}

export type ClaimErrorCode = 'not_integer' | 'below_min' | 'above_max' | 'not_above_current' | 'top_premium';

export interface ClaimError {
  ok: false;
  code: ClaimErrorCode;
  error: string;
  /** A valid amount the UI can offer instead. */
  suggested?: number;
}

export type ClaimQuoteResult = ClaimQuote | ClaimError;

export function findListingByKey(state: LeaderboardState, key: string): Listing | undefined {
  return state.listings.find((l) => l.key === key);
}

/**
 * Price a claim. `amount` is the desired *total* on `board`.
 *  - New URL: pays the full amount (min $10). Nobody can take over another listing's spend.
 *  - Existing URL: target must beat its current total by ≥ $1; only the difference is charged.
 *  - Landing on #1 requires ≥ current #1 + $5.
 */
export function quoteClaim(
  state: LeaderboardState,
  key: string,
  board: BoardId,
  amount: number,
  now: number,
): ClaimQuoteResult {
  if (!Number.isInteger(amount)) return { ok: false, code: 'not_integer', error: t('boost.claimErr.notInteger') };
  if (amount > MAX_BID) return { ok: false, code: 'above_max', error: t('boost.claimErr.aboveMax', { max: usd(MAX_BID) }), suggested: MAX_BID };

  const listing = findListingByKey(state, key);
  const boards: Record<BoardId, ReturnType<typeof getBoard>> = {
    all: getBoard(state, 'all', now),
    today: getBoard(state, 'today', now),
  };
  const entries = boards[board];
  const currentTotal = listing ? totalOnBoard(entries, listing.id) : 0;

  if (currentTotal > 0 && amount <= currentTotal) {
    return {
      ok: false,
      code: 'not_above_current',
      error: t('boost.claimErr.notAboveCurrent', { current: usd(currentTotal), min: usd(currentTotal + 1) }),
      suggested: currentTotal + 1,
    };
  }
  if (amount < MIN_BID) {
    return { ok: false, code: 'below_min', error: t('boost.claimErr.belowMin', { min: usd(MIN_BID) }), suggested: MIN_BID };
  }

  const projection = projectRank(entries, amount, listing?.id, now);
  if (projection.belowTopPremium) {
    return {
      ok: false,
      code: 'top_premium',
      error: t('boost.claimErr.topPremium', { min: usd(projection.minForTop), premium: usd(5) }),
      suggested: projection.minForTop,
    };
  }

  const charge = amount - currentTotal;
  if (charge + (listing ? totalOnBoard(boards.all, listing.id) : 0) > MAX_BID) {
    return { ok: false, code: 'above_max', error: t('boost.claimErr.lifetimeMax', { max: usd(MAX_BID) }) };
  }

  const ranks = {} as Record<BoardId, RankChange>;
  for (const b of ['all', 'today'] as BoardId[]) {
    const before = listing ? totalOnBoard(boards[b], listing.id) : 0;
    const after = before + charge;
    const p = projectRank(boards[b], after, listing?.id, now);
    ranks[b] = {
      before: listing ? rankOnBoard(boards[b], listing.id) : null,
      // projectRank reports #2 for a dead-band total; the real sort still puts it first. Only the
      // *other* board can hit this, the chosen board was validated above.
      after: p.belowTopPremium ? 1 : p.rank,
      totalBefore: before,
      totalAfter: after,
    };
  }

  return {
    ok: true,
    mode: listing ? 'topup' : 'new',
    board,
    key,
    listing,
    targetTotal: amount,
    currentTotal,
    charge,
    ranks,
  };
}

export interface ListingDraft {
  title: string;
  tagline: string;
  description: string;
  category: CategoryId;
  artwork: Artwork;
  preview?: AudioPreview;
}

export interface ApplyResult {
  state: LeaderboardState;
  listing: Listing;
  payment: Payment;
  quote: ClaimQuote;
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `${prefix}_${rand}`;
}

/**
 * Re-quote and apply a paid claim. Always re-validates against the current state, so a stale
 * client quote can never under-charge.
 */
export function applyClaim(
  state: LeaderboardState,
  target: NormalizedTarget,
  board: BoardId,
  amount: number,
  draft: ListingDraft,
  now: number,
  paymentId = newId('pay'),
): ApplyResult | ClaimError {
  const quote = quoteClaim(state, target.key, board, amount, now);
  if (!quote.ok) return quote;

  const applied = applyPaidCharge(state, target, quote.charge, draft, now, paymentId);
  return { ...applied, quote: { ...quote, listing: applied.listing } };
}

/**
 * Record a payment that has already been captured (e.g. a Stripe webhook). The money is final,
 * so the paid amount is credited even if the board moved between quote and payment.
 */
export function applyPaidCharge(
  state: LeaderboardState,
  target: NormalizedTarget,
  charge: number,
  draft: ListingDraft,
  now: number,
  paymentId: string,
): { state: LeaderboardState; listing: Listing; payment: Payment } {
  let listing = findListingByKey(state, target.key);
  let listings = state.listings;
  if (!listing) {
    listing = {
      id: newId('lst'),
      key: target.key,
      url: target.url,
      display: target.display,
      title: draft.title.trim().slice(0, 80) || target.display,
      tagline: draft.tagline.trim().slice(0, 80),
      description: draft.description.trim().slice(0, 400),
      category: draft.category,
      artwork: draft.artwork,
      preview: draft.preview,
      clicks: 0,
      createdAt: now,
    };
    listings = [...listings, listing];
  }
  const payment: Payment = { id: paymentId, listingId: listing.id, amount: charge, at: now };
  return { state: { listings, payments: [...state.payments, payment] }, listing, payment };
}
