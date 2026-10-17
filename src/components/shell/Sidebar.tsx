import { useMusic } from '../../music';
import { useApp } from '../../store';
import { AsfLogo, ChartIcon, ClockIcon, FlameIcon, GridIcon, HeartLine, HomeIcon, ListIcon, TrophyIcon, UploadIcon, UsersIcon } from '../icons';
import { Cover } from '../music/bits';

export const MAIN_NAV = [
  { href: '#/', label: 'Discover', page: 'home', Icon: HomeIcon },
  { href: '#/trending', label: 'Trending', page: 'trending', Icon: FlameIcon },
  { href: '#/charts', label: 'Top Charts', page: 'charts', Icon: ChartIcon },
  { href: '#/genres', label: 'Genres', page: 'genres', Icon: GridIcon },
  { href: '#/leaderboard', label: 'Boost Board', page: 'leaderboard', Icon: TrophyIcon },
] as const;

const LIB_NAV = [
  { href: '#/library/likes', label: 'Liked songs', tab: 'likes', Icon: HeartLine },
  { href: '#/library/playlists', label: 'Playlists', tab: 'playlists', Icon: ListIcon },
  { href: '#/library/following', label: 'Following', tab: 'following', Icon: UsersIcon },
  { href: '#/library/recent', label: 'Recently played', tab: 'recent', Icon: ClockIcon },
  { href: '#/library/uploads', label: 'My uploads', tab: 'uploads', Icon: UploadIcon },
] as const;

export function Sidebar() {
  const { route } = useApp();
  const m = useMusic();
  const active = (page: string) => route.page === page || (page === 'genres' && route.page === 'genre');
  return (
    <aside className="side" aria-label="Main navigation">
      <a href="#/" className="side__brand" aria-label="ASF home">
        <AsfLogo />
      </a>
      <nav className="side__group">
        {MAIN_NAV.map(({ href, label, page, Icon }) => (
          <a key={href} href={href} className={`side__link${active(page) ? ' is-active' : ''}`} aria-current={active(page) ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
            {page === 'leaderboard' && <span className="side__pill">$</span>}
          </a>
        ))}
      </nav>
      <div className="side__label">Your library</div>
      <nav className="side__group">
        {LIB_NAV.map(({ href, label, tab, Icon }) => {
          const on = route.page === 'library' && route.tab === tab;
          const count = tab === 'likes' ? m.library.likes.length : tab === 'uploads' ? m.library.uploads.length : 0;
          return (
            <a key={href} href={href} className={`side__link${on ? ' is-active' : ''}`}>
              <Icon />
              <span>{label}</span>
              {count > 0 && <span className="side__count">{count}</span>}
            </a>
          );
        })}
      </nav>
      {m.library.playlists.length > 0 && (
        <>
          <div className="side__label">Your playlists</div>
          <nav className="side__group side__playlists">
            {m.library.playlists.slice(0, 8).map((p) => (
              <a key={p.id} href={`#/playlist/${p.id}`} className={`side__pl${route.page === 'playlist' && route.id === p.id ? ' is-active' : ''}`}>
                <Cover spec={p.cover} size={32} />
                <span>{p.title}</span>
              </a>
            ))}
          </nav>
        </>
      )}
      <a className="side__upload" href="#/upload">
        <UploadIcon /> Upload music
      </a>
      <div className="side__promo">
        <b>Boost your release</b>
        <span>Claim a rank on the public Boost Board — rank is strictly what you pay.</span>
        <a href="#/leaderboard">Open Boost Board →</a>
      </div>
    </aside>
  );
}
