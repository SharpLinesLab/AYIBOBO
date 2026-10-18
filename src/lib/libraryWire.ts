/**
 * The library as it travels between the browser and the server (shared by both sides; no
 * imports, so the server can use it too). Lists are newest first.
 */
import type { CoverSpec } from '../catalog/types';

export type LikeKind = 'track' | 'album' | 'playlist';
export const LIKE_KINDS: readonly LikeKind[] = ['track', 'album', 'playlist'];

/** A playlist you made. Covers are generated designs (no image URLs). */
export interface WirePlaylist {
  id: string;
  title: string;
  curator: string;
  trackIds: string[];
  cover: Pick<CoverSpec, 'template' | 'palette' | 'seed' | 'text' | 'subtext'>;
  createdAt: number;
  updatedAt: number;
}

export interface WirePlay {
  trackId: string;
  count: number;
  lastPlayed: number;
}

export interface WireLibrary {
  likes: Record<LikeKind, string[]>;
  follows: string[];
  playlists: WirePlaylist[];
  /** Most recently played first. */
  plays: WirePlay[];
}

/** One change, sent as it happens while signed in. */
export type LibraryOp =
  | { op: 'like' | 'unlike'; kind: LikeKind; id: string }
  | { op: 'follow' | 'unfollow'; id: string }
  | { op: 'putPlaylist'; playlist: WirePlaylist }
  | { op: 'deletePlaylist'; id: string }
  | { op: 'play'; trackId: string; at: number };

export const LIBRARY_LIMITS = {
  /** Per like kind, and for follows. */
  items: 5000,
  playlists: 500,
  tracksPerPlaylist: 1000,
  plays: 5000,
  opsPerRequest: 200,
} as const;

export const emptyWireLibrary = (): WireLibrary => ({ likes: { track: [], album: [], playlist: [] }, follows: [], playlists: [], plays: [] });
