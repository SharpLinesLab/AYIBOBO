import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Backend, Snapshot } from './backend';
import { getBoard } from './lib/ranking';
import type { BoardId, CategoryId, RankedEntry } from './lib/types';

export type Filter = 'all' | 'leaderboards' | 'explore' | CategoryId;

export type Route =
  | { page: 'home' }
  | { page: 'daily'; day?: string }
  | { page: 'categories' }
  | { page: 'about' }
  | { page: 'rules' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'daily':
      return { page: 'daily', day: /^\d{4}-\d{2}-\d{2}$/.test(parts[1] ?? '') ? parts[1] : undefined };
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
