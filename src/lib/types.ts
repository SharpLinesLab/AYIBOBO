export type CategoryId =
  | 'streaming'
  | 'daws'
  | 'samples'
  | 'ai'
  | 'artist'
  | 'labels'
  | 'beats'
  | 'vinyl'
  | 'live'
  | 'community'
  | 'sync'
  | 'synths';

export type BoardId = 'all' | 'today';

/** Procedural audio preview recipe, rendered with the Web Audio API (no audio files needed). */
export interface SynthPreview {
  kind: 'synth';
  style: 'arp' | 'pad' | 'beat' | 'lofi' | 'bass' | 'pluck';
  /** Root note as MIDI number. */
  root: number;
  bpm: number;
  seed: number;
}

export interface FilePreview {
  kind: 'file';
  url: string;
}

export type AudioPreview = SynthPreview | FilePreview;

export interface Artwork {
  /** Two-color gradient used for the generated thumbnail. */
  from: string;
  to: string;
  /** Short glyph or initials drawn on the thumbnail. */
  glyph: string;
  /** Optional remote image (favicon / artwork). Falls back to the generated thumb on error. */
  imageUrl?: string;
}

export interface Listing {
  id: string;
  /** Normalized identity key (see normalize.ts). Unique per listing. */
  key: string;
  /** Canonical outbound URL (tracking stripped). */
  url: string;
  /** Clean display domain / handle, e.g. `stemforge.ai` or `soundcloud.com/kaimori`. */
  display: string;
  title: string;
  tagline: string;
  description: string;
  category: CategoryId;
  artwork: Artwork;
  preview?: AudioPreview;
  clicks: number;
  createdAt: number;
}

export interface Payment {
  id: string;
  listingId: string;
  /** Whole US dollars actually charged for this payment. */
  amount: number;
  at: number;
}

export interface LeaderboardState {
  listings: Listing[];
  payments: Payment[];
}

export interface RankedEntry {
  listing: Listing;
  rank: number;
  total: number;
  /** Time of the listing's first payment on this board (used for tie-breaks). */
  since: number;
  /** Time of the most recent payment on this board. */
  lastPaidAt: number;
}
