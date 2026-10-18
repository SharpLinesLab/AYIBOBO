import { t } from '../../i18n';
import { useMusic } from '../../music';
import { useApp } from '../../store';
import { AsfLogo, ChartIcon, ClockIcon, DownloadIcon, FlameIcon, GearIcon, GridIcon, HeartLine, HomeIcon, ListIcon, StudioIcon, UploadIcon, UsersIcon } from '../icons';
import { Cover } from '../music/bits';

export const MAIN_NAV = [
  { href: '#/', label: 'common.nav.discover', page: 'home', Icon: HomeIcon },
  { href: '#/trending', label: 'common.nav.trending', page: 'trending', Icon: FlameIcon },
  { href: '#/charts', label: 'common.nav.charts', page: 'charts', Icon: ChartIcon },
  { href: '#/genres', label: 'common.nav.genres', page: 'genres', Icon: GridIcon },
] as const;

const LIB_NAV = [
  { href: '#/library/likes', label: 'common.nav.likes', tab: 'likes', Icon: HeartLine },
  { href: '#/library/playlists', label: 'common.nav.playlists', tab: 'playlists', Icon: ListIcon },
  { href: '#/library/following', label: 'common.nav.following', tab: 'following', Icon: UsersIcon },
  { href: '#/library/recent', label: 'common.nav.recent', tab: 'recent', Icon: ClockIcon },
  { href: '#/library/downloads', label: 'common.nav.downloads', tab: 'downloads', Icon: DownloadIcon },
  { href: '#/library/uploads', label: 'common.nav.uploads', tab: 'uploads', Icon: UploadIcon },
] as const;

export function Sidebar() {
  const { route } = useApp();
  const m = useMusic();
  const active = (page: string) => route.page === page || (page === 'genres' && route.page === 'genre');
  return (
    <aside className="side" aria-label={t('common.nav.main')}>
      <a href="#/" className="side__brand">
        <span className="sr-only">{t('common.nav.home')}</span>
        <AsfLogo />
      </a>
      <nav className="side__group" aria-label={t('common.nav.browse')}>
        {MAIN_NAV.map(({ href, label, page, Icon }) => (
          <a key={href} href={href} className={`side__link${active(page) ? ' is-active' : ''}`} aria-current={active(page) ? 'page' : undefined}>
            <Icon />
            <span>{t(label)}</span>
          </a>
        ))}
      </nav>
      <div className="side__label">{t('common.nav.yourLibrary')}</div>
      <nav className="side__group" aria-label={t('common.nav.yourLibrary')}>
        {LIB_NAV.map(({ href, label, tab, Icon }) => {
          const on = route.page === 'library' && route.tab === tab;
          const count = tab === 'likes' ? m.library.likes.length : tab === 'uploads' ? m.library.uploads.length : tab === 'downloads' ? m.library.downloads.length : 0;
          return (
            <a key={href} href={href} className={`side__link${on ? ' is-active' : ''}`}>
              <Icon />
              <span>{t(label)}</span>
              {count > 0 && <span className="side__count">{count}</span>}
            </a>
          );
        })}
      </nav>
      {m.library.playlists.length > 0 && (
        <>
          <div className="side__label">{t('common.nav.yourPlaylists')}</div>
          <nav className="side__group side__playlists" aria-label={t('common.nav.yourPlaylists')}>
            {m.library.playlists.slice(0, 8).map((p) => (
              <a key={p.id} href={`#/playlist/${p.id}`} className={`side__pl${route.page === 'playlist' && route.id === p.id ? ' is-active' : ''}`}>
                <Cover spec={p.cover} size={32} />
                <span>{p.title}</span>
              </a>
            ))}
          </nav>
        </>
      )}
      <div className="side__label">{t('common.nav.creators')}</div>
      <nav className="side__group" aria-label={t('common.nav.creators')}>
        <a href="#/studio" className={`side__link${route.page === 'studio' ? ' is-active' : ''}`} aria-current={route.page === 'studio' ? 'page' : undefined}>
          <StudioIcon />
          <span>{t('common.nav.studio')}</span>
        </a>
        <a href="#/settings" className={`side__link${route.page === 'settings' ? ' is-active' : ''}`} aria-current={route.page === 'settings' ? 'page' : undefined}>
          <GearIcon />
          <span>{t('common.nav.settings')}</span>
        </a>
      </nav>
      <a className="side__upload" href="#/upload">
        <UploadIcon /> {t('common.nav.uploadMusic')}
      </a>
    </aside>
  );
}
