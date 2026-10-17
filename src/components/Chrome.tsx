import { useEffect, useState, type ReactNode } from 'react';
import { CATEGORIES } from '../lib/categories';
import { num, usd } from '../lib/format';
import { totalRevenue } from '../lib/stats';
import type { BoardId } from '../lib/types';
import { useApp, type Filter } from '../store';
import { Logo, MenuIcon, MoonIcon, SearchIcon, SunIcon } from './icons';

const NAV = [
  { href: '#/daily', label: 'Daily', page: 'daily' },
  { href: '#/categories', label: 'Categories', page: 'categories' },
  { href: '#/about', label: 'About', page: 'about' },
  { href: '#/rules', label: 'Rules', page: 'rules' },
] as const;

export function TopNav({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { route, openSearch } = useApp();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setMenu(false), [route]);

  return (
    <header className={`nav${scrolled ? ' is-scrolled' : ''}`}>
      <div className="nav__inner">
        <a href="#/" className="brand" aria-label="soundbid.lol home">
          <Logo />
          <span>
            soundbid<span className="brand__tld">.lol</span>
          </span>
        </a>
        <nav className="nav__links" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={`nav__link${route.page === n.page ? ' is-active' : ''}`} aria-current={route.page === n.page ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="nav__actions">
          <button className="icon-btn" onClick={openSearch} aria-label="Search (press /)">
            <SearchIcon />
          </button>
          <button className="icon-btn" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <span className="nav__menu">
            <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu">
              <MenuIcon />
            </button>
          </span>
        </div>
        {menu && (
          <nav className="mobile-menu" aria-label="Mobile">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export function CategoryBar() {
  const { filter, setFilter, navigate, route } = useApp();
  const pick = (f: Filter) => {
    setFilter(f);
    if (route.page !== 'home') navigate('#/');
  };
  const chip = (f: Filter, label: string, icon?: string) => (
    <button key={f} className={`chip${filter === f && route.page === 'home' ? ' is-active' : ''}`} onClick={() => pick(f)} aria-pressed={filter === f}>
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </button>
  );
  return (
    <div className="filter-bar">
      <div className="filter-bar__track" role="toolbar" aria-label="Filter listings">
        {chip('all', 'All')}
        {chip('leaderboards', 'Leaderboards')}
        {chip('explore', 'Explore')}
        <span className="chip__divider" aria-hidden />
        {CATEGORIES.map((c) => chip(c.id, c.label, c.icon))}
      </div>
    </div>
  );
}

export function LivePill() {
  const { snapshot, openStats } = useApp();
  return (
    <div className="live-pill" role="status">
      <span className="live-dot" aria-hidden />
      <span>
        <b className="num">{num(snapshot.stats.online)}</b> online
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="num">{num(snapshot.stats.visitorsToday)}</span> visitors today
      </span>
      <span aria-hidden>·</span>
      <button className="live-pill__stats" onClick={openStats}>
        stats →
      </button>
    </div>
  );
}

export function BoardToggle() {
  const { board, setBoard } = useApp();
  const opt = (b: BoardId, label: ReactNode) => (
    <button role="tab" aria-selected={board === b} className={board === b ? 'is-active' : ''} onClick={() => setBoard(b)}>
      {label}
    </button>
  );
  return (
    <div className="segmented" role="tablist" aria-label="Leaderboard timeframe">
      {opt('all', <>🏆 All-time</>)}
      {opt(
        'today',
        <>
          <span className="dot" /> Today
        </>,
      )}
    </div>
  );
}

export function Footer() {
  const { snapshot, backend, openStats, toast } = useApp();
  const { state, stats } = snapshot;
  return (
    <footer className="footer">
      <div className="milestones">
        <div className="milestone">
          <span className="num">{num(stats.visitorsLifetime)}</span>
          <small>visitors</small>
        </div>
        <div className="milestone">
          <span className="num">{usd(totalRevenue(state))}</span>
          <small>total revenue</small>
        </div>
        <div className="milestone">
          <span className="num">{num(state.listings.length)}</span>
          <small>music websites listed</small>
        </div>
      </div>
      <nav className="footer__links" aria-label="Footer">
        <a href="#/rules">Rules</a>
        <a href="#/faq">FAQ</a>
        <button onClick={openStats}>Live stats</button>
        <a href="#/about">About</a>
        <a href="#/daily">Daily archive</a>
        {backend.reset && (
          <button
            onClick={() => {
              backend.reset!();
              toast('Demo data reset.');
            }}
          >
            Reset demo
          </button>
        )}
      </nav>
      <p className="footer__fine">
        <span className="mode-badge">{backend.mode === 'local' ? '● Demo mode — payments simulated, saved in this browser' : backend.stripe ? '● Live — payments via Stripe' : '● Server mode — payments simulated'}</span>
      </p>
      <p className="footer__fine">
        soundbid.lol — a public pay-to-rank leaderboard for music on the web. No algorithms, no gatekeepers. Listings shown in the demo are fictional.
      </p>
    </footer>
  );
}
