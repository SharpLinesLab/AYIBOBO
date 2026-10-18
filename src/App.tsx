import { Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createBackend, createLocalBackend, type Backend, type Snapshot } from './backend';
import { stopPreview } from './lib/audio';
import type { BoardId } from './lib/types';
import { MusicProvider } from './music';
import * as player from './player/engine';
import { AppProvider, parseRoute, useBoards, useNow, type AppContextValue, type Filter, type HeroPrefill } from './store';
import { CategoryBar, Footer } from './components/Chrome';
import type { CheckoutRequestState } from './components/CheckoutModal';

// The Boost Board and its dialogs are split into their own chunks; the music app loads without them.
const CheckoutModal = lazy(() => import('./components/CheckoutModal').then((m) => ({ default: m.CheckoutModal })));
const DetailDrawer = lazy(() => import('./components/DetailDrawer').then((m) => ({ default: m.DetailDrawer })));
const StatsModal = lazy(() => import('./components/StatsModal').then((m) => ({ default: m.StatsModal })));
const LeaderboardHome = lazy(() => import('./components/Pages').then((m) => ({ default: m.HomePage })));
const DailyPage = lazy(() => import('./components/Pages').then((m) => ({ default: m.DailyPage })));
const CategoriesPage = lazy(() => import('./components/Pages').then((m) => ({ default: m.CategoriesPage })));
const AboutPage = lazy(() => import('./components/Pages').then((m) => ({ default: m.AboutPage })));
const RulesPage = lazy(() => import('./components/Pages').then((m) => ({ default: m.RulesPage })));
const StudioPage = lazy(() => import('./pages/Studio').then((m) => ({ default: m.StudioPage })));
const TodayWidget = lazy(() => import('./components/Sidebars').then((m) => ({ default: m.TodayWidget })));
const ActivityFeed = lazy(() => import('./components/Sidebars').then((m) => ({ default: m.ActivityFeed })));

function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden /> <span className="sr-only">Loading…</span>
    </div>
  );
}
import { SubscribeModal } from './components/SubscribeModal';
import { Sidebar } from './components/shell/Sidebar';
import { TopBar } from './components/shell/TopBar';
import { SettingsPage } from './pages/Settings';
import { ConnectionBanner } from './components/music/Offline';
import { NowPlaying, NowPlayingPanel, PlayerBar, usePanelOpen, type NpTab } from './components/shell/Player';
import { MobileTabs } from './components/shell/MobileTabs';
import { DiscoverPage } from './pages/Discover';
import { ChartsPage, GenrePage, GenresPage, NotFound, TrendingPage } from './pages/Browse';
import { ErrorBoundary, RouteEffects } from './components/shell/RouteEffects';
import { AlbumPage, ArtistPage, PlaylistPage, SongPage } from './pages/Detail';
import { LibraryPage, SearchPage, UploadPage } from './pages/Library';

type Theme = 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', theme === 'dark' ? '#121417' : '#F4F5F7'));
    try {
      localStorage.setItem('asf:theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function App() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        let b = await createBackend();
        let s: Snapshot;
        try {
          s = await b.load();
        } catch (err) {
          // The API is down: keep the app (and all the music) working on the local demo backend.
          console.warn('Boost Board API unavailable, using local mode', err);
          b = createLocalBackend();
          s = await b.load();
        }
        if (cancelled) return;
        setBackend(b);
        setSnapshot(s);
        unsub = b.subscribe(setSnapshot);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message || 'Failed to load the leaderboard.');
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  if (loadError) {
    return (
      <div className="page">
        <div className="empty" style={{ marginTop: 80 }}>
          <b>We couldn’t load the leaderboard</b>
          {loadError}
        </div>
      </div>
    );
  }
  if (!backend || !snapshot) return <LoadingShell />;
  return <Shell backend={backend} snapshot={snapshot} setSnapshot={setSnapshot} />;
}

function LoadingShell() {
  return (
    <div className="page" aria-busy="true">
      <div style={{ maxWidth: 680, margin: '120px auto 0' }} className="stack">
        <span className="skeleton" style={{ height: 44, width: '70%', margin: '0 auto' }} />
        <span className="skeleton" style={{ height: 54, borderRadius: 999 }} />
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="skeleton" style={{ height: 110, borderRadius: 18 }} />
        ))}
      </div>
    </div>
  );
}

function Shell({ backend, snapshot, setSnapshot }: { backend: Backend; snapshot: Snapshot; setSnapshot: (s: Snapshot) => void }) {
  const [theme, toggleTheme] = useTheme();
  const hash = useHashRoute();
  const route = useMemo(() => parseRoute(hash), [hash]);
  const now = useNow(snapshot.offset);
  const boards = useBoards(snapshot, now);
  const [board, setBoard] = useState<BoardId>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [npTab, setNpTab] = useState<NpTab | null>(null);
  const [panelOpen, setPanelOpen] = usePanelOpen();
  const hasPlayer = useSyncExternalStore(player.subscribe, () => !!player.getState().current);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutRequestState | null>(null);
  const [heroPrefill, setHeroPrefill] = useState<HeroPrefill>({ nonce: 0 });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<{ id: string; from: number | null } | null>(null);
  const [highlightFrom, setHighlightFrom] = useState<number | null>(null);

  const navigate = useCallback((h: string) => {
    if (window.location.hash !== h) window.location.hash = h;
  }, []);
  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Stripe return: ?checkout=success|cancel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (!status) return;
    toast(status === 'success' ? 'Payment received — your rank updates as soon as Stripe confirms it.' : 'Checkout cancelled — nothing was charged.');
    params.delete('checkout');
    params.delete('session_id');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    if (status === 'success') void backend.load().then(setSnapshot);
  }, [backend, setSnapshot, toast]);

  // Player keyboard shortcuts: Space play/pause, ←/→ seek, Shift+←/→ prev/next, M mute.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '') || el?.isContentEditable || el?.getAttribute('role') === 'slider') return;
      // Space on a focused button/link should activate it, not toggle playback.
      if (e.key === ' ' && /^(BUTTON|A)$/.test(el?.tagName ?? '')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!player.getState().current) return;
      if (e.key === ' ') {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'ArrowRight' && e.shiftKey) player.next();
      else if (e.key === 'ArrowLeft' && e.shiftKey) player.prev();
      else if (e.key === 'ArrowRight') player.seek(player.getPosition() + 5);
      else if (e.key === 'ArrowLeft') player.seek(player.getPosition() - 5);
      else if (e.key.toLowerCase() === 'm') player.toggleMute();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  useEffect(() => () => stopPreview(), []);

  const value: AppContextValue = {
    backend,
    snapshot,
    now,
    boards,
    board,
    setBoard,
    filter,
    setFilter,
    route,
    navigate,
    openDetail: setDetailId,
    openStats: () => setStatsOpen(true),
    openSearch: () => navigate('#/search'),
    prefillHero: (p) => {
      if (route.page !== 'leaderboard') navigate('#/leaderboard');
      setHeroPrefill((prev) => ({ ...p, nonce: prev.nonce + 1 }));
    },
    heroPrefill,
    openCheckout: (req) => setCheckout(req),
    highlightId,
    highlightFrom,
    setHighlightId,
    setSnapshot,
    toast,
  };

  const closeCheckout = () => {
    setCheckout(null);
    if (claimed) {
      // Reveal the freshly claimed listing on the board it was bought on.
      setFilter('all');
      navigate('#/leaderboard');
      const { id, from } = claimed;
      setClaimed(null);
      // Scroll first (measured without transforms), then start the climb animation.
      window.setTimeout(() => {
        document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightFrom(from);
        setHighlightId(id);
      }, 80);
      window.setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 3200);
    }
  };

  let page: ReactNode;
  switch (route.page) {
    case 'home':
      page = <DiscoverPage />;
      break;
    case 'trending':
      page = <TrendingPage genre={route.genre} />;
      break;
    case 'charts':
      page = <ChartsPage kind={route.kind} window={route.window} />;
      break;
    case 'genres':
      page = <GenresPage />;
      break;
    case 'genre':
      page = <GenrePage id={route.id} />;
      break;
    case 'song':
      page = <SongPage key={route.id} id={route.id} />;
      break;
    case 'album':
      page = <AlbumPage id={route.id} />;
      break;
    case 'artist':
      page = <ArtistPage id={route.id} />;
      break;
    case 'playlist':
      page = <PlaylistPage id={route.id} />;
      break;
    case 'library':
      page = <LibraryPage tab={route.tab} />;
      break;
    case 'search':
      page = <SearchPage q={route.q} />;
      break;
    case 'upload':
      page = <UploadPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'studio':
      page = <StudioPage artistId={route.artistId} />;
      break;
    case 'daily':
      page = <DailyPage day={route.day} />;
      break;
    case 'categories':
      page = <CategoriesPage />;
      break;
    case 'about':
      page = <AboutPage />;
      break;
    case 'rules':
      page = <RulesPage />;
      break;
    case 'notfound':
      page = <NotFound what="page" />;
      break;
    case 'leaderboard':
      page = (
        <div className="lb">
          <CategoryBar />
          <div className="layout">
            <aside className="sidebar sidebar--left" aria-label="Today">
              <TodayWidget />
            </aside>
            <div className="main">
              <LeaderboardHome />
            </div>
            <aside className="sidebar sidebar--right" aria-label="Activity">
              <ActivityFeed />
            </aside>
          </div>
        </div>
      );
      break;
  }

  return (
    <AppProvider value={value}>
      <MusicProvider now={now}>
        <RouteEffects hash={hash} />
        <a
          href="#content"
          className="skip-link"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('content')?.focus();
          }}
        >
          Skip to content
        </a>
        <div className={`app${hasPlayer ? ' has-player' : ''}${panelOpen && hasPlayer ? ' has-panel' : ''}`}>
          <Sidebar />
          <div className="app__main">
            <div id="page-tint-root" aria-hidden />
            <TopBar theme={theme} onToggleTheme={toggleTheme} onSubscribe={() => setSubscribeOpen(true)} />
            <ConnectionBanner />
            <main id="content" className="content" tabIndex={-1} key={route.page === 'leaderboard' ? 'lb' : hash}>
              <ErrorBoundary resetKey={hash}>
                <Suspense fallback={<PageLoading />}>{page}</Suspense>
              </ErrorBoundary>
            </main>
            <Footer showStats={route.page === 'leaderboard'} />
          </div>
          <PlayerBar onExpand={() => setNpTab('wave')} onLyrics={() => setNpTab('lyrics')} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen(!panelOpen)} />
          {panelOpen && hasPlayer && <NowPlayingPanel onClose={() => setPanelOpen(false)} onLyrics={() => setNpTab('lyrics')} />}
          <MobileTabs />
        </div>
        {npTab && <NowPlaying initialTab={npTab} onClose={() => setNpTab(null)} />}

        <Suspense fallback={null}>
        {checkout && (
          <CheckoutModal
            req={checkout}
            onClose={closeCheckout}
            onClaimed={(id, b, from) => {
              setClaimed({ id, from });
              setBoard(b);
            }}
          />
        )}
        {detailId && <DetailDrawer listingId={detailId} onClose={() => setDetailId(null)} />}
        {statsOpen && <StatsModal onClose={() => setStatsOpen(false)} />}
        </Suspense>
        {subscribeOpen && <SubscribeModal onClose={() => setSubscribeOpen(false)} />}
        {toastMsg && (
          <div className="toast" role="status">
            {toastMsg}
          </div>
        )}
      </MusicProvider>
    </AppProvider>
  );
}
