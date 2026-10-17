import type { ClaimQuote, ListingDraft } from './claim';
import type { LiveStats } from './stats';
import type { BoardId, LeaderboardState } from './types';

export interface HealthResponse {
  ok: true;
  stripe: boolean;
  simulated: boolean;
}

export interface StateResponse {
  state: LeaderboardState;
  now: number;
  stats: LiveStats;
}

export interface CheckoutRequest {
  input: string;
  board: BoardId;
  amount: number;
  draft: ListingDraft;
}

export type CheckoutResult =
  | { kind: 'applied'; state: LeaderboardState; listingId: string; paymentId: string; quote: ClaimQuote }
  | { kind: 'redirect'; url: string }
  | { kind: 'error'; error: string; suggested?: number };
