import { t } from '../../i18n';
import { useApp } from '../../store';
import { ChartIcon, FlameIcon, GridIcon, HomeIcon, LibraryIcon } from '../icons';

const TABS = [
  { href: '#/', label: 'common.nav.discover', pages: ['home'], Icon: HomeIcon },
  { href: '#/trending', label: 'common.nav.trending', pages: ['trending'], Icon: FlameIcon },
  { href: '#/charts', label: 'common.nav.chartsShort', pages: ['charts'], Icon: ChartIcon },
  { href: '#/genres', label: 'common.nav.genres', pages: ['genres', 'genre'], Icon: GridIcon },
  { href: '#/library/likes', label: 'common.nav.library', pages: ['library', 'settings', 'studio'], Icon: LibraryIcon },
] as const;

export function MobileTabs() {
  const { route } = useApp();
  return (
    <nav className="mtabs" aria-label={t('common.nav.sections')}>
      {TABS.map(({ href, label, pages, Icon }) => {
        const on = (pages as readonly string[]).includes(route.page);
        return (
          <a key={href} href={href} className={on ? 'is-active' : ''} aria-current={on ? 'page' : undefined}>
            <Icon />
            <span>{t(label)}</span>
          </a>
        );
      })}
    </nav>
  );
}
