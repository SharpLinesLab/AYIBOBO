import { useMemo } from 'react';
import { GENRES, genreById, isGenreId } from '../catalog/genres';
import { WINDOW_DAYS, playsInWindow, trackChart, trending, type ChartWindow } from '../catalog/plays';
import { coverUrl } from '../catalog/covers';
import { PageTint } from '../components/music/premium';
import { compact, useMusic } from '../music';
import { plural, t, type Key } from '../i18n';
import { Cover, PlayAll, Shelf } from '../components/music/bits';
import { AlbumCard, ArtistCard } from '../components/music/Cards';
import { TrackList, TrackListHeader, TrackRow } from '../components/music/TrackRow';
import { injectPromoted } from '../lib/promotionRules';
import { usePromotedIds } from '../lib/promotions';

function GenreChips({ base, active }: { base: string; active?: string }) {
  return (
    <nav className="chips" aria-label={t('browse.filter')}>
      <a href={base} className={`chip2${!active ? ' is-active' : ''}`} aria-current={!active ? 'page' : undefined}>
        {t('browse.allGenres')}
      </a>
      {GENRES.map((g) => (
        <a key={g.id} href={`${base}/${g.id}`} className={`chip2${active === g.id ? ' is-active' : ''}`} aria-current={active === g.id ? 'page' : undefined}>
          {g.label}
        </a>
      ))}
    </nav>
  );
}

/** Shown where a list of songs would be when there's nothing to list yet. */
function NoSongs() {
  return (
    <div className="empty-state">
      <h2>{t('browse.empty.title')}</h2>
      <p>{t('browse.empty.body')}</p>
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
      <PageHead kicker={t('common.nav.trending')} title={g ? t('browse.trending.titleGenre', { genre: genreById(g).label }) : t('browse.trending.title')} sub={t('browse.trending.sub')}>
        <div className="phead__actions">
          <PlayAll tracks={list} label={t('browse.trending.playAll')} />
          <span className="muted">{plural('common.count.songs', list.length)}</span>
        </div>
      </PageHead>
      <GenreChips base="#/trending" active={g} />
      {list.length ? <TrackList tracks={list} plays={undefined} showAlbum /> : <NoSongs />}
    </div>
  );
}

const WINDOWS: { id: ChartWindow; label: Key }[] = [
  { id: 'day', label: 'browse.window.day' },
  { id: 'week', label: 'browse.window.week' },
  { id: 'month', label: 'browse.window.month' },
  { id: 'year', label: 'browse.window.year' },
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
      <PageHead kicker={t('browse.charts.kicker')} title={kind === 'songs' ? t('browse.charts.songsTitle') : t('browse.charts.albumsTitle')} sub={t('browse.charts.sub')}>
        <div className="phead__actions">
          {kind === 'songs' && <PlayAll tracks={tracks.slice(0, 50)} label={t('browse.charts.playAll')} />}
          <div className="segmented">
            <a className={kind === 'songs' ? 'is-active' : ''} href={`#/charts/songs/${window}`}>
              {t('browse.charts.songs')}
            </a>
            <a className={kind === 'albums' ? 'is-active' : ''} href={`#/charts/albums/${window}`}>
              {t('browse.charts.albums')}
            </a>
          </div>
        </div>
      </PageHead>
      <nav className="chips" aria-label={t('browse.filter')}>
        {WINDOWS.map((w) => (
          <a key={w.id} href={`#/charts/${kind}/${w.id}`} className={`chip2${window === w.id ? ' is-active' : ''}`} aria-current={window === w.id ? 'page' : undefined}>
            {t(w.label)}
          </a>
        ))}
      </nav>
      {(kind === 'songs' ? !rows.length : !albums.length) ? (
        <div className="empty-state">
          <h2>{t('browse.charts.empty')}</h2>
        </div>
      ) : kind === 'songs' ? (
        <div className="tlist" role="list">
          <TrackListHeader withChange />
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
                <a href={`#/album/${a.id}`} aria-label={a.title} tabIndex={-1}>
                  <Cover spec={a.cover} size={56} />
                </a>
                <span className="alist__main">
                  <a className="alist__title" href={`#/album/${a.id}`}>
                    {a.title}
                  </a>
                  <span className="muted">
                    {artist && <a href={`#/artist/${artist.id}`}>{artist.name}</a>} · {plural('common.count.songs', a.trackIds.length)}
                  </span>
                </span>
                <span className="num muted">{plural('common.count.plays', plays, { n: compact(plays) })}</span>
                <PlayAll tracks={m.tracksOf(a.trackIds)} size="sm" label={t('common.action.playName', { name: a.title })} />
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
      <PageHead kicker={t('common.nav.browse')} title={t('browse.genres.title')} sub={t('browse.genres.sub')} />
      <div className="genre-grid">
        {GENRES.map((g) => {
          const artists = m.catalog.artists.filter((a) => a.genres.includes(g.id)).sort((a, b) => b.followers - a.followers).slice(0, 3);
          return (
            <a key={g.id} href={`#/genres/${g.id}`} className="genre-card" style={{ ['--g1' as string]: g.colors[0], ['--g2' as string]: g.colors[1] }}>
              {artists[0] && <Cover spec={artists[0].poster} className="genre-card__img" />}
              <h2>{g.label}</h2>
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
  const promotedIds = usePromotedIds();
  if (!isGenreId(id)) return <NotFound what="genre" />;
  const g = genreById(id);
  const tracks = trending(m.catalog.tracks.filter((t) => t.genre === id && !t.uploaded), m.now);
  const artists = m.catalog.artists.filter((a) => a.genres.includes(id)).sort((a, b) => b.followers - a.followers);
  const albums = m.catalog.albums.filter((a) => m.tracksOf(a.trackIds).some((t) => t.genre === id));
  // The top songs, with up to 2 promoted songs of this genre that aren't already among them.
  const feed = injectPromoted(
    tracks.slice(0, 10),
    m.tracksOf(promotedIds).filter((t) => t.genre === id),
  );
  const promoted = new Set(feed.filter((x) => x.promoted).map((x) => x.item.id));
  return (
    <div className="page-music">
      <PageTint color={g.colors[0]} />
      <header className="ghead" style={{ ['--g1' as string]: g.colors[0], ['--g2' as string]: g.colors[1] }}>
        {artists[0] && <div className="ghead__img" style={{ backgroundImage: `url("${coverUrl(artists[0].banner)}")` }} />}
        <span className="phead__kicker">{t('browse.genre.kicker')}</span>
        <h1>{g.label}</h1>
        <p>{g.blurb}</p>
        <div className="phead__actions">
          <PlayAll tracks={tracks.slice(0, 30)} label={t('common.action.playName', { name: g.label })} />
          <span>
            {plural('common.count.songs', tracks.length)} · {plural('browse.count.artists', artists.length)}
          </span>
        </div>
      </header>
      {tracks.length ? (
        <section>
          <header className="shelf__head">
            <div>
              <h2>{t('browse.genre.top', { genre: g.label })}</h2>
            </div>
            <a className="shelf__all" href={`#/trending/${id}`}>
              {t('common.action.viewAll')}
            </a>
          </header>
          <TrackList tracks={feed.map((x) => x.item)} promotedIds={promoted} showAlbum />
        </section>
      ) : (
        <NoSongs />
      )}
      {albums.length > 0 && (
        <Shelf title={t('browse.genre.albums')}>
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </Shelf>
      )}
      {artists.length > 0 && (
        <Shelf title={t('browse.genre.artists')}>
          {artists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Shelf>
      )}
    </div>
  );
}

const NOT_FOUND: Record<string, Key> = {
  page: 'browse.notFound.page',
  song: 'browse.notFound.song',
  album: 'browse.notFound.album',
  playlist: 'browse.notFound.playlist',
  artist: 'browse.notFound.artist',
  genre: 'browse.notFound.genre',
};

export function NotFound({ what }: { what: string }) {
  return (
    <div className="page-music">
      <div className="empty-state">
        <h1>{t(NOT_FOUND[what] ?? 'browse.notFound.page')}</h1>
        <p>{t('browse.notFound.body')}</p>
        <a className="btn-accent" href="#/">
          {t('browse.notFound.back')}
        </a>
      </div>
    </div>
  );
}
