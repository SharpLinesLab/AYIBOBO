import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BRAND, socialUrl } from '../brand';
import { CATEGORIES } from '../lib/categories';
import { num, usd } from '../lib/format';
import { searchListings } from '../lib/search';
import { totalRevenue } from '../lib/stats';
import type { BoardId } from '../lib/types';
import { useApp, type Filter } from '../store';
import { AsfLogo, FacebookIcon, InstagramIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon, XIcon, YoutubeIcon } from './icons';
import { Thumb } from './Thumb';

const NAV = [
  { href: '#/', label: 'Home', page: 'home' },
  { href: '#/daily', label: 'Daily', page: 'daily' },
  { href: '#/categories', label: 'Categories', page: 'categories' },
  { href: '#/about', label: 'About', page: 'about' },
  { href: '#/rules', label: 'Rules', page: 'rules' },
] as const;

export function SocialLinks({ size = 20 }: { size?: number }) {
  const items = [
    { k: 'facebook' as const, label: 'Facebook', Icon: FacebookIcon },
    { k: 'instagram' as const, label: 'Instagram', Icon: InstagramIcon },
    { k: 'youtube' as const, label: 'YouTube', Icon: YoutubeIcon },
    { k: 'x' as const, label: 'X', Icon: XIcon },
  ];
  return (
    <span className="social">
      {items.map(({ k, label, Icon }) => (
        <a key={k} href={socialUrl(k)} target="_blank" rel="noopener noreferrer" aria-label={`${BRAND.short} on ${label}`} className="social__link">
          <Icon width={size} height={size} />
        </a>
      ))}
    </span>
  );
}

/** Nav search pill: expands on focus with instant suggestions as you type. */
function NavSearch() {
  const { snapshot, boards, openDetail, openSearch } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => searchListings(snapshot.state.listings, boards.all, q, 6), [snapshot.state.listings, boards.all, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (id: string) => {
    setOpen(false);
    setQ('');
    openDetail(id);
  };

  return (
    <div className={`nav-search${open ? ' is-open' : ''}`} ref={wrap}>
      <input
        value={q}
        placeholder="Search…"
        aria-label="Search listings"
        role="combobox"
        aria-expanded={open}
        aria-controls="nav-suggest"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(hits.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && hits[active]) {
            choose(hits[active].listing.id);
          } else if (e.key === 'Escape') {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <button className="nav-search__icon" aria-label="Open search" onClick={openSearch}>
        <SearchIcon />
      </button>
      {open && (
        <ul className="nav-suggest" id="nav-suggest" role="listbox">
          <li className="nav-suggest__label">{q.trim() ? 'Suggestions' : 'Top ranked'}</li>
          {hits.map((h, i) => (
            <li key={h.listing.id} role="option" aria-selected={i === active}>
              <button className={i === active ? 'is-active' : ''} onMouseEnter={() => setActive(i)} onClick={() => choose(h.listing.id)}>
                <Thumb art={h.listing.artwork} size="sm" />
                <span className="nav-suggest__text">
                  <b>{h.listing.title}</b>
                  <small>{h.listing.display}</small>
                </span>
                {h.entry && <span className="nav-suggest__rank">#{h.entry.rank}</span>}
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="nav-suggest__empty">No matches for “{q}”.</li>}
        </ul>
      )}
    </div>
  );
}

export function TopNav({ theme, onToggleTheme, onSubscribe }: { theme: 'light' | 'dark'; onToggleTheme: () => void; onSubscribe: () => void }) {
  const { route, openSearch, setFilter, navigate } = useApp();
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
        <a href="#/" className="brand" aria-label={`${BRAND.product} home`}>
          <AsfLogo />
        </a>
        <nav className="nav__links" aria-label="Primary">
          {NAV.map((n) =>
            n.page === 'categories' ? (
              <div key={n.href} className="nav__dropdown">
                <a href={n.href} className={`nav__link${route.page === n.page ? ' is-active' : ''}`} aria-haspopup="true">
                  {n.label}
                </a>
                <div className="nav__menu-panel" role="menu">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      role="menuitem"
                      onClick={() => {
                        setFilter(c.id);
                        navigate('#/');
                        (document.activeElement as HTMLElement | null)?.blur();
                      }}
                    >
                      <span aria-hidden>{c.icon}</span> {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <a key={n.href} href={n.href} className={`nav__link${route.page === n.page ? ' is-active' : ''}`} aria-current={route.page === n.page ? 'page' : undefined}>
                {n.label}
              </a>
            ),
          )}
        </nav>
        <div className="nav__actions">
          <NavSearch />
          <button className="icon-btn nav__search-btn" onClick={openSearch} aria-label="Search (press /)">
            <SearchIcon />
          </button>
          <span className="nav__social">
            <SocialLinks />
          </span>
          <button className="icon-btn" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="subscribe-btn" onClick={onSubscribe}>
            Subscribe
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
            <button onClick={onSubscribe}>Subscribe</button>
            <div className="mobile-menu__social">
              <SocialLinks size={18} />
            </div>
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
      <div className="footer__brand">
        <AsfLogo />
      </div>
      <nav className="footer__links" aria-label="Footer">
        <a href="#/about">Advertise</a>
        <a href="#/rules">Terms &amp; Rules</a>
        <a href="#/faq">FAQ</a>
        <button onClick={openStats}>Live stats</button>
        <a href="#/daily">Daily archive</a>
        <a href={BRAND.contactEmail ? `mailto:${BRAND.contactEmail}` : '#/about'}>Contact</a>
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
      <div className="footer__social">
        <SocialLinks size={18} />
      </div>
      <p className="footer__fine">
        <span className="mode-badge">
          {backend.mode === 'local' ? '● Demo mode — payments simulated, saved in this browser' : backend.stripe ? '● Live — payments via Stripe' : '● Server mode — payments simulated'}
        </span>
      </p>
      <p className="footer__fine">
        © {new Date().getFullYear()} {BRAND.short} — {BRAND.name}. All rights reserved. Listings shown in the demo are fictional.
      </p>
    </footer>
  );
}
