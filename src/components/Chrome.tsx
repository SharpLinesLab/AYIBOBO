import type { ReactNode } from 'react';
import { BRAND, socialUrl } from '../brand';
import { t } from '../i18n';
import { CATEGORIES } from '../lib/categories';
import { num, rich, usd } from '../lib/format';
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
        <a key={k} href={socialUrl(k)} target="_blank" rel="noopener noreferrer" aria-label={t('boost.footer.socialOn', { brand: BRAND.short, network: label })} className="social__link">
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
      <div className="filter-bar__track" role="toolbar" aria-label={t('boost.pages.bar.filter')}>
        {chip('all', t('boost.pages.bar.all'))}
        {chip('leaderboards', t('boost.pages.bar.leaderboards'))}
        {chip('explore', t('boost.pages.bar.explore'))}
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
      <span>{rich(t('boost.pages.live.online'), { n: <b className="num">{num(snapshot.stats.online)}</b> })}</span>
      <span aria-hidden>·</span>
      <span>{rich(t('boost.pages.live.visitors'), { n: <span className="num">{num(snapshot.stats.visitorsToday)}</span> })}</span>
      <span aria-hidden>·</span>
      <button className="live-pill__stats" onClick={openStats}>
        {t('boost.pages.live.stats')}
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
    <div className="segmented" role="tablist" aria-label={t('boost.pages.toggle.label')}>
      {opt('all', <>🏆 {t('boost.pages.board.allTime')}</>)}
      {opt(
        'today',
        <>
          <span className="dot" /> {t('boost.pages.board.today')}
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
          <small>{t('boost.footer.visitors')}</small>
        </div>
        <div className="milestone">
          <span className="num">{usd(totalRevenue(state))}</span>
          <small>{t('boost.footer.revenue')}</small>
        </div>
        <div className="milestone">
          <span className="num">{num(state.listings.length)}</span>
          <small>{t('boost.footer.listed')}</small>
        </div>
      </div>
      )}
      <div className="footer__brand">
        <AsfLogo />
      </div>
      <nav className="footer__links" aria-label={t('boost.footer.nav')}>
        <a href="#/leaderboard">{t('common.nav.boost')}</a>
        <a href="#/upload">{t('common.top.upload')}</a>
        <a href="#/about">{t('boost.footer.advertise')}</a>
        <a href="#/rules">{t('boost.footer.terms')}</a>
        <a href="#/faq">{t('boost.footer.faq')}</a>
        <button onClick={openStats}>{t('boost.footer.liveStats')}</button>
        <a href="#/daily">{t('boost.pages.board.daily')}</a>
        <a href={BRAND.contactEmail ? `mailto:${BRAND.contactEmail}` : '#/about'}>{t('boost.footer.contact')}</a>
        {backend.reset && (
          <button
            onClick={() => {
              backend.reset!();
              toast(t('boost.footer.resetDone'));
            }}
          >
            {t('boost.footer.resetDemo')}
          </button>
        )}
      </nav>
      <div className="footer__social">
        <SocialLinks size={18} />
      </div>
      <p className="footer__fine">
        <span className="mode-badge">
          {t(backend.mode === 'local' ? 'boost.footer.modeDemo' : backend.stripe ? 'boost.footer.modeLive' : 'boost.footer.modeServer')}
        </span>
      </p>
      <p className="footer__fine">
        {t('boost.footer.rights', { year: new Date().getFullYear(), short: BRAND.short, name: BRAND.name })}
      </p>
    </footer>
  );
}
