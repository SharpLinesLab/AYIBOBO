import { Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { MusicProvider } from './music';
import * as player from './player/engine';
import { AppProvider, parseRoute, useNow, type AppContextValue } from './store';
import { Footer } from './components/shell/Footer';

const NowPlaying = lazy(() => import('./components/shell/NowPlaying').then((m) => ({ default: m.NowPlaying })));
const StudioPage = lazy(() => import('./pages/Studio').then((m) => ({ default: m.StudioPage })));

function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden /> <span className="sr-only">{t('player.app.loading')}</span>
    </div>
  );
}
import { SubscribeModal } from './components/SubscribeModal';
import { Sidebar } from './components/shell/Sidebar';
import { TopBar } from './components/shell/TopBar';
import { SettingsPage } from './pages/Settings';
import { PrivacyPage } from './pages/legal/Privacy';
import { TermsPage } from './pages/legal/Terms';
import { CopyrightPage } from './pages/legal/Copyright';
import { PaletteHost } from './components/shell/PaletteHost';
import { t, useLang } from './i18n';
import { ShareHost } from './components/music/Share';
import { ConnectionBanner } from './components/music/Offline';
import { PlayerBar, UpNextPanel, usePanelOpen, type NpTab } from './components/shell/Player';
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
    // Commit navigations immediately (not as transitions) so pages respond instantly; pages
    // animate themselves in with CSS.
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function App() {
  const lang = useLang();
  // Switching language re-renders the whole interface with the new strings (playback carries on).
  return <Shell key={lang} />;
}

function Shell() {
  const [theme, toggleTheme] = useTheme();
  const hash = useHashRoute();
  const route = useMemo(() => parseRoute(hash), [hash]);
  const now = useNow();
  const [npTab, setNpTab] = useState<NpTab | null>(null);
  const [panelOpen, setPanelOpen] = usePanelOpen();
  const hasPlayer = useSyncExternalStore(player.subscribe, () => !!player.getState().current);
  // Once something plays, fetch the full-screen player and queue in the background so they open instantly.
  useEffect(() => {
    if (hasPlayer) void import('./components/shell/NowPlaying');
  }, [hasPlayer]);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const navigate = useCallback((h: string) => {
    if (window.location.hash !== h) window.location.hash = h;
  }, []);
  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

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

  const value: AppContextValue = { now, route, navigate, toast };

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
    case 'privacy':
      page = <PrivacyPage />;
      break;
    case 'terms':
      page = <TermsPage />;
      break;
    case 'copyright':
      page = <CopyrightPage />;
      break;
    case 'studio':
      page = <StudioPage artistId={route.artistId} />;
      break;
    case 'notfound':
      page = <NotFound what="page" />;
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
          {t('common.nav.skip')}
        </a>
        <div className={`app${hasPlayer ? ' has-player' : ''}${panelOpen && hasPlayer ? ' has-panel' : ''}`}>
          <Sidebar />
          <div className="app__main">
            <div id="page-tint-root" aria-hidden />
            <TopBar theme={theme} onToggleTheme={toggleTheme} onSubscribe={() => setSubscribeOpen(true)} />
            <ConnectionBanner />
            <main id="content" className="content" tabIndex={-1} key={hash}>
              <ErrorBoundary resetKey={hash}>
                <Suspense fallback={<PageLoading />}>{page}</Suspense>
              </ErrorBoundary>
            </main>
            <Footer />
          </div>
          <PlayerBar onExpand={() => setNpTab('wave')} onLyrics={() => setNpTab('lyrics')} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen(!panelOpen)} />
          {panelOpen && hasPlayer && <UpNextPanel onClose={() => setPanelOpen(false)} />}
          <MobileTabs />
        </div>
        <ShareHost />
        <PaletteHost onToggleTheme={toggleTheme} onLyrics={() => setNpTab('lyrics')} />
        {npTab && (
          <Suspense fallback={null}>
            <NowPlaying initialTab={npTab} onClose={() => setNpTab(null)} />
          </Suspense>
        )}

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
