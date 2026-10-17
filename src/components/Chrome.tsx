import type { ReactNode } from 'react';
import { BRAND, socialUrl } from '../brand';
import { CATEGORIES } from '../lib/categories';
import { num, usd } from '../lib/format';
import { totalRevenue } from '../lib/stats';
import type { BoardId } from '../lib/types';
import { useApp, type Filter } from '../store';
import { AsfLogo, FacebookIcon, InstagramIcon, XIcon, YoutubeIcon } from './icons';

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

export function CategoryBar() {
  const { filter, setFilter, navigate, route } = useApp();
  const pick = (f: Filter) => {
    setFilter(f);
    if (route.page !== 'leaderboard') navigate('#/leaderboard');
  };
  const chip = (f: Filter, label: string, icon?: string) => (
    <button key={f} className={`chip${filter === f && route.page === 'leaderboard' ? ' is-active' : ''}`} onClick={() => pick(f)} aria-pressed={filter === f}>
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

export function Footer({ showStats = true }: { showStats?: boolean }) {
  const { snapshot, backend, openStats, toast } = useApp();
  const { state, stats } = snapshot;
  return (
    <footer className="footer">
      {showStats && (
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
      )}
      <div className="footer__brand">
        <AsfLogo />
      </div>
      <nav className="footer__links" aria-label="Footer">
        <a href="#/leaderboard">Boost Board</a>
        <a href="#/upload">Upload</a>
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
