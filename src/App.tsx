import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBackend, type Backend, type Snapshot } from './backend';
import { stopPreview } from './lib/audio';
import type { BoardId } from './lib/types';
import { AppProvider, parseRoute, useBoards, useNow, type AppContextValue, type Filter, type HeroPrefill } from './store';
import { CategoryBar, Footer, TopNav } from './components/Chrome';
import { CheckoutModal, type CheckoutRequestState } from './components/CheckoutModal';
import { DetailDrawer } from './components/DetailDrawer';
import { AboutPage, CategoriesPage, DailyPage, HomePage, RulesPage } from './components/Pages';
import { SearchModal } from './components/SearchModal';
import { ActivityFeed, TodayWidget } from './components/Sidebars';
import { StatsModal } from './components/StatsModal';
import { SubscribeModal } from './components/SubscribeModal';

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
        const b = await createBackend();
        const s = await b.load();
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
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Scroll to top on page change; jump to the FAQ for #/faq.
  useEffect(() => {
    if (hash.startsWith('#/faq')) {
      window.setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 30);
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [route.page, hash]);

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

  // Keyboard: "/" or Cmd/Ctrl+K opens search.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setSearchOpen(true);
      }
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
    openSearch: () => setSearchOpen(true),
    prefillHero: (p) => {
      if (route.page !== 'home') navigate('#/');
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
      navigate('#/');
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

  let page;
  switch (route.page) {
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
    default:
      page = <HomePage />;
  }

  return (
    <AppProvider value={value}>
      <a href="#board" className="sr-only">
        Skip to leaderboard
      </a>
      <TopNav theme={theme} onToggleTheme={toggleTheme} onSubscribe={() => setSubscribeOpen(true)} />
      <CategoryBar />
      <main className="page">
        {route.page === 'home' ? (
          <div className="layout">
            <aside className="sidebar sidebar--left" aria-label="Today">
              <TodayWidget />
            </aside>
            <div className="main">{page}</div>
            <aside className="sidebar sidebar--right" aria-label="Activity">
              <ActivityFeed />
            </aside>
          </div>
        ) : (
          page
        )}
      </main>
      <Footer />

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
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {subscribeOpen && <SubscribeModal onClose={() => setSubscribeOpen(false)} />}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </AppProvider>
  );
}
