import { useApp } from '../../store';
import { ChartIcon, FlameIcon, HomeIcon, LibraryIcon, TrophyIcon } from '../icons';

const TABS = [
  { href: '#/', label: 'Discover', pages: ['home', 'genres', 'genre'], Icon: HomeIcon },
  { href: '#/trending', label: 'Trending', pages: ['trending'], Icon: FlameIcon },
  { href: '#/charts', label: 'Charts', pages: ['charts'], Icon: ChartIcon },
  { href: '#/leaderboard', label: 'Boost', pages: ['leaderboard', 'daily'], Icon: TrophyIcon },
  { href: '#/library/likes', label: 'Library', pages: ['library', 'upload'], Icon: LibraryIcon },
];

export function MobileTabs() {
  const { route } = useApp();
  return (
    <nav className="mtabs" aria-label="Sections">
      {TABS.map(({ href, label, pages, Icon }) => {
        const on = pages.includes(route.page);
        return (
          <a key={href} href={href} className={on ? 'is-active' : ''} aria-current={on ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
