import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Backend, Snapshot } from './backend';
import { getBoard } from './lib/ranking';
import type { BoardId, CategoryId, RankedEntry } from './lib/types';

export type Filter = 'all' | 'leaderboards' | 'explore' | CategoryId;

export type Route =
  | { page: 'home' }
  | { page: 'trending'; genre?: string }
  | { page: 'charts'; kind: 'songs' | 'albums'; window: 'day' | 'week' | 'month' | 'year' }
  | { page: 'genres' }
  | { page: 'genre'; id: string }
  | { page: 'song'; id: string }
  | { page: 'album'; id: string }
  | { page: 'artist'; id: string }
  | { page: 'playlist'; id: string }
  | { page: 'library'; tab: string }
  | { page: 'search'; q: string }
  | { page: 'upload' }
  | { page: 'leaderboard' }
  | { page: 'daily'; day?: string }
  | { page: 'categories' }
  | { page: 'about' }
  | { page: 'rules' };

export function parseRoute(hash: string): Route {
  const [path] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const [head, a, b] = parts;
  switch (head) {
    case 'trending':
      return { page: 'trending', genre: a };
    case 'charts': {
      const kind = a === 'albums' ? 'albums' : 'songs';
      const window = b === 'day' || b === 'month' || b === 'year' ? b : 'week';
      return { page: 'charts', kind, window };
    }
    case 'genres':
      return a ? { page: 'genre', id: a } : { page: 'genres' };
    case 'song':
      return a ? { page: 'song', id: a } : { page: 'home' };
    case 'album':
      return a ? { page: 'album', id: a } : { page: 'home' };
    case 'artist':
      return a ? { page: 'artist', id: a } : { page: 'home' };
    case 'playlist':
      return a ? { page: 'playlist', id: a } : { page: 'home' };
    case 'library':
      return { page: 'library', tab: a ?? 'likes' };
    case 'search':
      return { page: 'search', q: a ?? '' };
    case 'upload':
      return { page: 'upload' };
    case 'leaderboard':
    case 'boost':
      return { page: 'leaderboard' };
    case 'daily':
      return { page: 'daily', day: /^\d{4}-\d{2}-\d{2}$/.test(a ?? '') ? a : undefined };
    case 'categories':
      return { page: 'categories' };
    case 'about':
      return { page: 'about' };
    case 'rules':
    case 'faq':
      return { page: 'rules' };
    default:
      return { page: 'home' };
  }
}

export interface HeroPrefill {
  input?: string;
  amount?: number;
  /** Bumped on every prefill so the hero reacts even to identical values. */
  nonce: number;
}

export interface AppContextValue {
  backend: Backend;
  snapshot: Snapshot;
  /** Source-of-truth time (server-corrected). Ticks every 15s. */
  now: number;
  boards: Record<BoardId, RankedEntry[]>;
  board: BoardId;
  setBoard: (b: BoardId) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  route: Route;
  navigate: (hash: string) => void;
  openDetail: (listingId: string) => void;
  openStats: () => void;
  openSearch: () => void;
  /** Pre-fill the hero widget (quick-bid / raise) and scroll to it. */
  prefillHero: (p: Omit<HeroPrefill, 'nonce'>) => void;
  heroPrefill: HeroPrefill;
  openCheckout: (req: { input: string; amount: number; board: BoardId; category?: CategoryId }) => void;
  highlightId: string | null;
  /** Rank the highlighted listing held before its claim (null = new listing), for the climb animation. */
  highlightFrom: number | null;
  setHighlightId: (id: string | null) => void;
  setSnapshot: (s: Snapshot) => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Clock corrected by the backend's offset, re-rendering every `interval` ms. */
export function useNow(offset: number, interval = 15_000): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = window.setInterval(() => setNow(Date.now() + offset), interval);
    return () => clearInterval(id);
  }, [offset, interval]);
  return now;
}

export function useBoards(snapshot: Snapshot | null, now: number): Record<BoardId, RankedEntry[]> {
  // Re-rank when data changes or the UTC day rolls over.
  const day = Math.floor(now / 86_400_000);
  return useMemo(() => {
    if (!snapshot) return { all: [], today: [] };
    return { all: getBoard(snapshot.state, 'all', now), today: getBoard(snapshot.state, 'today', now) };
  }, [snapshot, day]);
}
