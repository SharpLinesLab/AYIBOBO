import { useMemo } from 'react';
import { GENRES, genreById, isGenreId } from '../catalog/genres';
import { WINDOW_DAYS, playsInWindow, trackChart, trending, type ChartWindow } from '../catalog/plays';
import { coverUrl } from '../catalog/covers';
import { compact, useMusic } from '../music';
import { Cover, PlayAll, Shelf } from '../components/music/bits';
import { AlbumCard, ArtistCard, PlaylistCard } from '../components/music/Cards';
import { TrackList, TrackRow } from '../components/music/TrackRow';

function GenreChips({ base, active }: { base: string; active?: string }) {
  return (
    <div className="chips" role="list">
      <a href={base} className={`chip2${!active ? ' is-active' : ''}`} role="listitem">
        All genres
      </a>
      {GENRES.map((g) => (
        <a key={g.id} href={`${base}/${g.id}`} className={`chip2${active === g.id ? ' is-active' : ''}`} role="listitem">
          {g.label}
        </a>
      ))}
    </div>
  );
}

export function PageHead({ kicker, title, sub, children }: { kicker?: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="phead">
      {kicker && <span className="phead__kicker">{kicker}</span>}
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
      {children}
    </header>
  );
}

export function TrendingPage({ genre }: { genre?: string }) {
  const m = useMusic();
  const g = genre && isGenreId(genre) ? genre : undefined;
  const list = useMemo(() => trending(m.catalog.tracks.filter((t) => !t.uploaded && (!g || t.genre === g)), m.now).slice(0, 50), [m.catalog.tracks, m.now, g]);
  return (
    <div className="page-music">
      <PageHead kicker="Trending" title={g ? `Trending in ${genreById(g).label}` : 'Trending on ASF'} sub="Songs gaining the most plays right now, weighted by week-over-week growth.">
        <div className="phead__actions">
          <PlayAll tracks={list} label="Play trending" />
          <span className="muted">{list.length} songs</span>
        </div>
      </PageHead>
      <GenreChips base="#/trending" active={g} />
      <TrackList tracks={list} plays={undefined} showAlbum />
    </div>
  );
}

const WINDOWS: { id: ChartWindow; label: string }[] = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
];

export function ChartsPage({ kind, window }: { kind: 'songs' | 'albums'; window: ChartWindow }) {
  const m = useMusic();
  const rows = useMemo(() => trackChart(m.catalog.tracks, m.now, window, window === 'year' ? m.library.plays : {}).slice(0, 100), [m.catalog.tracks, m.now, window, m.library.plays]);
  const albums = useMemo(() => {
    const days = WINDOW_DAYS[window];
    return m.catalog.albums
      .map((a) => ({ a, plays: m.tracksOf(a.trackIds).reduce((s, t) => s + playsInWindow(t, m.now, days), 0) }))
      .filter((x) => x.plays > 0)
      .sort((x, y) => y.plays - x.plays);
  }, [m, window]);
  const tracks = rows.map((r) => r.track);
  return (
    <div className="page-music">
      <PageHead kicker="Top charts" title={kind === 'songs' ? 'Top Songs' : 'Top Albums'} sub="Updated continuously. Arrows show movement versus the previous period.">
        <div className="phead__actions">
          {kind === 'songs' && <PlayAll tracks={tracks.slice(0, 50)} label="Play the chart" />}
          <div className="segmented">
            <a className={kind === 'songs' ? 'is-active' : ''} href={`#/charts/songs/${window}`}>
              Songs
            </a>
            <a className={kind === 'albums' ? 'is-active' : ''} href={`#/charts/albums/${window}`}>
              Albums
            </a>
          </div>
        </div>
      </PageHead>
      <div className="chips" role="list">
        {WINDOWS.map((w) => (
          <a key={w.id} href={`#/charts/${kind}/${w.id}`} className={`chip2${window === w.id ? ' is-active' : ''}`} role="listitem">
            {w.label}
          </a>
        ))}
      </div>
      {kind === 'songs' ? (
        <div className="tlist" role="list">
          {rows.map((r) => (
            <TrackRow key={r.track.id} track={r.track} context={tracks} index={r.rank} plays={r.plays} change={r.change} showAlbum />
          ))}
        </div>
      ) : (
        <ol className="alist">
          {albums.map(({ a, plays }, i) => {
            const artist = m.artist(a.artistId);
            return (
              <li key={a.id} className="alist__row">
                <span className="alist__rank num">{i + 1}</span>
                <a href={`#/album/${a.id}`}>
                  <Cover spec={a.cover} size={56} />
                </a>
                <span className="alist__main">
                  <a className="alist__title" href={`#/album/${a.id}`}>
                    {a.title}
                  </a>
                  <span className="muted">
                    {artist && <a href={`#/artist/${artist.id}`}>{artist.name}</a>} · {a.trackIds.length} songs
                  </span>
                </span>
                <span className="num muted">{compact(plays)} plays</span>
                <PlayAll tracks={m.tracksOf(a.trackIds)} size="sm" label={`Play ${a.title}`} />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function GenresPage() {
  const m = useMusic();
  return (
    <div className="page-music">
      <PageHead kicker="Browse" title="Genres & moods" sub="From kompa to drill — dive into the sounds of Haiti and the diaspora." />
      <div className="genre-grid">
        {GENRES.map((g) => {
          const artists = m.catalog.artists.filter((a) => a.genres.includes(g.id)).sort((a, b) => b.followers - a.followers).slice(0, 3);
          return (
            <a key={g.id} href={`#/genres/${g.id}`} className="genre-card" style={{ ['--g1' as string]: g.colors[0], ['--g2' as string]: g.colors[1] }}>
              {artists[0] && <Cover spec={artists[0].poster} className="genre-card__img" />}
              <h3>{g.label}</h3>
              <p>{g.blurb}</p>
              <span className="genre-card__faces">
                {artists.map((a) => (
                  <Cover key={a.id} spec={a.avatar} size={30} round />
                ))}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function GenrePage({ id }: { id: string }) {
  const m = useMusic();
  if (!isGenreId(id)) return <NotFound what="genre" />;
  const g = genreById(id);
  const tracks = trending(m.catalog.tracks.filter((t) => t.genre === id && !t.uploaded), m.now);
  const artists = m.catalog.artists.filter((a) => a.genres.includes(id)).sort((a, b) => b.followers - a.followers);
  const albums = m.catalog.albums.filter((a) => m.tracksOf(a.trackIds).some((t) => t.genre === id));
  const playlists = m.catalog.playlists.filter((p) => p.editorial && m.tracksOf(p.trackIds).some((t) => t.genre === id));
  return (
    <div className="page-music">
      <header className="ghead" style={{ ['--g1' as string]: g.colors[0], ['--g2' as string]: g.colors[1] }}>
        {artists[0] && <div className="ghead__img" style={{ backgroundImage: `url("${coverUrl(artists[0].banner)}")` }} />}
        <span className="phead__kicker">Genre</span>
        <h1>{g.label}</h1>
        <p>{g.blurb}</p>
        <div className="phead__actions">
          <PlayAll tracks={tracks.slice(0, 30)} label={`Play ${g.label}`} />
          <span>
            {tracks.length} songs · {artists.length} artists
          </span>
        </div>
      </header>
      <section>
        <header className="shelf__head">
          <div>
            <h2>Top {g.label} songs</h2>
          </div>
          <a className="shelf__all" href={`#/trending/${id}`}>
            See all
          </a>
        </header>
        <TrackList tracks={tracks.slice(0, 10)} showAlbum />
      </section>
      {albums.length > 0 && (
        <Shelf title="Albums & EPs">
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </Shelf>
      )}
      <Shelf title="Artists">
        {artists.map((a) => (
          <ArtistCard key={a.id} artist={a} />
        ))}
      </Shelf>
      {playlists.length > 0 && (
        <Shelf title="Playlists">
          {playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Shelf>
      )}
    </div>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <div className="page-music">
      <div className="empty-state">
        <h2>We couldn’t find that {what}</h2>
        <p>It may have been removed, or the link is wrong.</p>
        <a className="btn-accent" href="#/">
          Back to Discover
        </a>
      </div>
    </div>
  );
}
