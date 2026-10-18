import { Component, useEffect, useLayoutEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { genreById, isGenreId } from '../../catalog/genres';
import { useMusic } from '../../music';
import { useApp, type Route } from '../../store';

const BRAND = 'ASF — Ayiti Sakap Fet';

function titleFor(route: Route, m: ReturnType<typeof useMusic>): string {
  switch (route.page) {
    case 'home':
      return `${BRAND} · Music`;
    case 'trending':
      return route.genre && isGenreId(route.genre) ? `Trending ${genreById(route.genre).label}` : 'Trending';
    case 'charts':
      return `Top ${route.kind === 'songs' ? 'Songs' : 'Albums'}`;
    case 'genres':
      return 'Genres';
    case 'genre':
      return isGenreId(route.id) ? genreById(route.id).label : 'Not found';
    case 'song': {
      const t = m.track(route.id);
      return t ? `${t.title} — ${m.artistNames(t)}` : 'Song not found';
    }
    case 'album': {
      const a = m.album(route.id);
      return a ? `${a.title} — ${m.artist(a.artistId)?.name ?? ''}` : 'Album not found';
    }
    case 'artist':
      return m.artist(route.id)?.name ?? 'Artist not found';
    case 'playlist':
      return m.playlist(route.id)?.title ?? 'Playlist not found';
    case 'library':
      return 'Your library';
    case 'search':
      return route.q ? `Search: ${route.q}` : 'Search';
    case 'upload':
      return 'Upload music';
    case 'settings':
      return 'Settings';
    case 'studio': {
      const a = route.artistId ? m.artist(route.artistId) : undefined;
      return a ? `${a.name} · Artist Studio` : 'Artist Studio';
    }
    case 'leaderboard':
      return 'Boost Board';
    case 'daily':
      return 'Daily archive · Boost Board';
    case 'categories':
      return 'Categories · Boost Board';
    case 'about':
      return 'About';
    case 'rules':
      return 'Rules & FAQ';
    case 'notfound':
      return 'Page not found';
  }
}

/**
 * Per-route side effects that make a hash-routed SPA behave like real pages:
 *  - document title per page (tabs, history, screen readers)
 *  - scroll to top on new navigation, restore the previous position on Back/Forward
 *  - move focus to the main region after navigation so keyboard/screen-reader users land on the new content
 */
export function RouteEffects({ hash }: { hash: string }) {
  const { route } = useApp();
  const m = useMusic();
  const positions = useRef(new Map<number, number>());
  const counter = useRef(0);
  const lastHash = useRef(hash);

  const title = titleFor(route, m);
  useEffect(() => {
    document.title = route.page === 'home' ? title : `${title} · ASF`;
  }, [title, route.page]);

  // Remember scroll per history entry.
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const idx = (history.state as { asfIdx?: number } | null)?.asfIdx;
        if (idx !== undefined) positions.current.set(idx, window.scrollY);
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useLayoutEffect(() => {
    const st = history.state as { asfIdx?: number } | null;
    const known = st?.asfIdx !== undefined && positions.current.has(st.asfIdx);
    if (st?.asfIdx === undefined) {
      counter.current = Math.max(counter.current, ...positions.current.keys(), 0) + 1;
      history.replaceState({ ...(st ?? {}), asfIdx: counter.current }, '', location.href);
    }
    if (hash.startsWith('#/faq')) {
      window.setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 30);
    } else if (known) {
      const y = positions.current.get(st!.asfIdx!)!;
      // Wait for the page to lay out before restoring.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' })));
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    // Only after an actual navigation (not on first load) so the skip link stays the first Tab stop.
    if (lastHash.current !== hash) document.getElementById('content')?.focus({ preventScroll: true });
    lastHash.current = hash;
  }, [hash]);

  return null;
}

/** Catches render errors so one broken page never blanks the whole app. */
export class ErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>This page hit an unexpected error. Your music and library are safe.</p>
        <div className="row">
          <button className="btn-accent" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <a className="btn-glass" href="#/">
            Go to Discover
          </a>
        </div>
      </div>
    );
  }
}
