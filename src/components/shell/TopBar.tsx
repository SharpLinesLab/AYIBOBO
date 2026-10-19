import { useEffect, useMemo, useRef, useState } from 'react';
import { searchCatalog } from '../../catalog/search';
import { t } from '../../i18n';
import { useMusic } from '../../music';
import { LanguageMenu } from '../LanguagePicker';
import { useApp } from '../../store';
import { SocialLinks } from './Footer';
import { AsfLogo, ChevronLeft, ChevronRight, MoonIcon, SearchIcon, SunIcon, UploadIcon, UserIcon } from '../icons';
import { useAccount } from '../../lib/account';
import { Cover } from '../music/bits';

/** Search box with instant, grouped suggestions (songs, artists, albums, playlists). */
function GlobalSearch() {
  const m = useMusic();
  const { navigate, route } = useApp();
  const [q, setQ] = useState(route.page === 'search' ? route.q : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const res = useMemo(() => searchCatalog(m.catalog, q, 4), [m.catalog, q]);
  const items = useMemo(
    () => [
      ...res.tracks.map((x) => ({ key: x.id, href: `#/song/${x.id}`, title: x.title, sub: `${t('common.kind.song')} · ${m.artistNames(x)}`, cover: x.cover, round: false })),
      ...res.artists.map((a) => ({ key: a.id, href: `#/artist/${a.id}`, title: a.name, sub: t('common.kind.artist'), cover: a.avatar, round: true })),
      ...res.albums.map((a) => ({ key: a.id, href: `#/album/${a.id}`, title: a.title, sub: `${t('common.kind.album')} · ${m.artist(a.artistId)?.name ?? ''}`, cover: a.cover, round: false })),
      ...res.playlists.map((p) => ({ key: p.id, href: `#/playlist/${p.id}`, title: p.title, sub: `${t('common.kind.playlist')} · ${p.curator}`, cover: p.cover, round: false })),
    ],
    [res, m],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    input.current?.blur();
    navigate(href);
  };

  return (
    <div className={`gsearch${open ? ' is-open' : ''}`} ref={wrap}>
      <SearchIcon className="gsearch__icon" />
      <input
        ref={input}
        value={q}
        placeholder={t('common.search.placeholder')}
        aria-label={t('common.search.label')}
        role="combobox"
        aria-expanded={open && q.trim().length > 0}
        aria-controls="gsearch-list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(items.length, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            if (active > 0 && items[active - 1]) go(items[active - 1].href);
            else if (q.trim()) go(`#/search/${encodeURIComponent(q.trim())}`);
          } else if (e.key === 'Escape') {
            setOpen(false);
            input.current?.blur();
          }
        }}
      />
      <kbd className="gsearch__kbd">/</kbd>
      {open && q.trim() && (
        <div className="gsearch__panel" id="gsearch-list" role="listbox">
          <button className={`gsearch__all${active === 0 ? ' is-active' : ''}`} onClick={() => go(`#/search/${encodeURIComponent(q.trim())}`)}>
            <SearchIcon /> {t('common.search.for', { q: q.trim() })}
          </button>
          {items.map((it, i) => (
            <button key={it.key} className={`gsearch__item${active === i + 1 ? ' is-active' : ''}`} role="option" aria-selected={active === i + 1} onMouseEnter={() => setActive(i + 1)} onClick={() => go(it.href)}>
              <Cover spec={it.cover} size={40} round={it.round} />
              <span>
                <b>{it.title}</b>
                <small>{it.sub}</small>
              </span>
            </button>
          ))}
          {items.length === 0 && <p className="gsearch__empty">{t('common.search.noMatches')}</p>}
        </div>
      )}
    </div>
  );
}

/** Sign-in / account link. Hidden when there's no API server (static hosting). */
function AccountButton() {
  const { status, user } = useAccount();
  if (status === 'unavailable') return null;
  const label = t(user ? 'account.top.account' : 'account.top.signIn');
  return (
    <a className={`round-btn${user ? ' is-on' : ''}`} href="#/account" aria-label={label} title={label}>
      <UserIcon width={18} height={18} />
    </a>
  );
}

export function TopBar({ theme, onToggleTheme, onSubscribe }: { theme: 'light' | 'dark'; onToggleTheme: () => void; onSubscribe: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
      <a href="#/" className="topbar__brand" aria-label={t('common.nav.homeShort')}>
        <AsfLogo compact />
      </a>
      <div className="topbar__history">
        <button className="round-btn" onClick={() => history.back()} aria-label={t('common.nav.back')}>
          <ChevronLeft />
        </button>
        <button className="round-btn" onClick={() => history.forward()} aria-label={t('common.nav.forward')}>
          <ChevronRight />
        </button>
      </div>
      <GlobalSearch />
      <div className="topbar__actions">
        <span className="topbar__social">
          <SocialLinks size={18} />
        </span>
        <a className="btn-outline topbar__upload" href="#/account">
          <UploadIcon width={16} height={16} /> {t('common.top.upload')}
        </a>
        <LanguageMenu />
        <AccountButton />
        <button className="round-btn" onClick={onToggleTheme} aria-label={theme === 'dark' ? t('common.top.light') : t('common.top.dark')}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="btn-accent topbar__sub" onClick={onSubscribe}>
          {t('common.top.subscribe')}
        </button>
      </div>
    </header>
  );
}
