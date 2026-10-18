import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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
  | { page: 'settings' }
  | { page: 'studio'; artistId?: string }
  | { page: 'privacy' }
  | { page: 'terms' }
  | { page: 'copyright' }
  | { page: 'notfound' };

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
    case 'settings':
      return { page: 'settings' };
    case 'studio':
      return { page: 'studio', artistId: a };
    case 'privacy':
      return { page: 'privacy' };
    case 'terms':
      return { page: 'terms' };
    case 'copyright':
      return { page: 'copyright' };
    case undefined:
    case 'discover':
      return { page: 'home' };
    default:
      return { page: 'notfound' };
  }
}

export interface AppContextValue {
  /** Current time, re-read every 15 s (drives "2 days ago" labels and charts). */
  now: number;
  route: Route;
  navigate: (hash: string) => void;
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

/** Wall clock that re-renders every `interval` ms. */
export function useNow(interval = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
