import { useEffect, useMemo, useState } from 'react';
import { GENRES } from '../catalog/genres';
import { trackChart, trending } from '../catalog/plays';
import type { Album, CoverSpec, Track } from '../catalog/types';
import { PageTint, QuickPicks, StreamCard } from '../components/music/premium';
import { coverUrl } from '../catalog/covers';
import { compact, useMusic, usePlayerState } from '../music';
import { pause, resume } from '../player/engine';
import { plural, t } from '../i18n';
import { PauseIcon, PlayIcon } from '../components/icons';
import { Cover, HeartIcon, Shelf } from '../components/music/bits';
import { AlbumCard, ArtistCard, GenreTile, PlaylistCard, PosterCard, TrackCard, Verified } from '../components/music/Cards';
import { TrackRow } from '../components/music/TrackRow';

type Feature = { kind: 'album'; album: Album; tracks: Track[] } | { kind: 'single'; track: Track; tracks: Track[] };

function HeroCarousel({ items }: { items: Feature[] }) {
  const m = useMusic();
  const s = usePlayerState();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const n = items.length;
  useEffect(() => {
    if (hold || n < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % n), 7000);
    return () => clearTimeout(t);
  }, [i, hold, n]);
  if (!n) return null;
  return (
    <section className="hero2" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} aria-roledescription={t('browse.hero.carousel')} aria-label={t('browse.hero.label')}>
      {items.map((f, k) => {
        const active = k === i;
        const cover = f.kind === 'album' ? f.album.cover : f.track.cover;
        const title = f.kind === 'album' ? f.album.title : f.track.title;
        const artistId = f.kind === 'album' ? f.album.artistId : f.track.artistId;
        const artist = m.artist(artistId);
        const href = f.kind === 'album' ? `#/album/${f.album.id}` : `#/song/${f.track.id}`;
        const ids = f.tracks.map((t) => t.id);
        const isCur = !!s.current && ids.includes(s.current.id);
        const playing = isCur && s.playing;
        const saved = f.kind === 'album' ? m.library.likedAlbums.includes(f.album.id) : m.isLiked(f.track.id);
        return (
          <article key={href} className={`hero2__slide${active ? ' is-active' : ''}`} aria-hidden={!active}>
            <div className="hero2__bg" style={{ backgroundImage: `url("${coverUrl(artist ? artist.banner : cover)}")` }} />
            <a href={href} className="hero2__art" tabIndex={active ? 0 : -1}>
              <Cover spec={cover} alt={title} />
            </a>
            <div className="hero2__body">
              <span className="hero2__kicker">
                {t(f.kind === 'album' ? (f.album.type === 'ep' ? 'browse.hero.newEp' : f.album.type === 'mixtape' ? 'browse.hero.newMixtape' : 'browse.hero.newAlbum') : 'browse.hero.newSingle')}
              </span>
              <h1 className="hero2__title">
                <a href={href} tabIndex={active ? 0 : -1}>
                  {title}
                </a>
              </h1>
              {artist && (
                <a className="hero2__artist" href={`#/artist/${artist.id}`} tabIndex={active ? 0 : -1}>
                  <Cover spec={artist.avatar} size={28} round />
                  {artist.name}
                  {artist.verified && <Verified />}
                </a>
              )}
              <p className="hero2__desc">{f.kind === 'album' ? f.album.description : `${f.track.description} ${plural('browse.hero.playsSoFar', m.totalPlays(f.track), { n: compact(m.totalPlays(f.track)) })}`}</p>
              <div className="hero2__actions">
                <button
                  className="btn-accent btn-lg"
                  tabIndex={active ? 0 : -1}
                  onClick={() => (isCur ? (s.playing ? pause() : resume()) : m.play(f.tracks, 0))}
                >
                  {playing ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} />}
                  {playing ? t('common.action.pause') : t('browse.hero.playNow')}
                </button>
                <button
                  className={`btn-glass btn-lg${saved ? ' is-on' : ''}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => (f.kind === 'album' ? m.toggleLikeAlbum(f.album.id) : m.toggleLike(f.track.id))}
                >
                  <HeartIcon filled={saved} /> {saved ? t('common.action.saved') : t('common.action.save')}
                </button>
              </div>
            </div>
          </article>
        );
      })}
      <div className="hero2__dots" role="tablist">
        {items.map((_, k) => (
          <button key={k} role="tab" aria-selected={k === i} aria-label={t('browse.hero.slide', { n: k + 1 })} className={k === i ? 'is-active' : ''} onClick={() => setI(k)}>
            {k === i && !hold && <span key={i} />}
          </button>
        ))}
      </div>
    </section>
  );
}

export function DiscoverPage() {
  const m = useMusic();
  const { catalog, now, library } = m;
  const [tint, setTint] = useState<CoverSpec | undefined>(undefined);
  const mixes = catalog.playlists.filter((p) => p.id.startsWith('mix-'));
  const stream = useMemo(
    () => [...catalog.tracks].filter((t) => !t.albumId).sort((a, b) => b.releasedAt - a.releasedAt).slice(0, 4),
    [catalog.tracks],
  );

  const data = useMemo(() => {
    const byDate = [...catalog.tracks].filter((t) => !t.uploaded).sort((a, b) => b.releasedAt - a.releasedAt);
    const trend = trending(catalog.tracks.filter((t) => !t.uploaded), now);
    const chart = trackChart(catalog.tracks, now, 'week', library.plays).slice(0, 10);
    const newAlbums = [...catalog.albums].sort((a, b) => b.releasedAt - a.releasedAt);
    const features: Feature[] = [];
    for (const al of newAlbums.slice(0, 2)) features.push({ kind: 'album', album: al, tracks: m.tracksOf(al.trackIds) });
    for (const t of byDate.filter((t) => !t.albumId).slice(0, 2)) features.push({ kind: 'single', track: t, tracks: [t] });
    const rising = [...catalog.artists]
      .map((a) => ({ a, s: catalog.tracks.filter((t) => t.artistId === a.id).reduce((sum, t) => sum + (trend.indexOf(t) < 30 ? 1 : 0), 0) }))
      .sort((x, y) => y.s - x.s || x.a.followers - y.a.followers)
      .map((x) => x.a);
    const releases = [...newAlbums.slice(0, 6).map((a) => ({ kind: 'album' as const, a })), ...byDate.filter((t) => !t.albumId).slice(0, 8).map((t) => ({ kind: 'track' as const, t }))].sort(
      (x, y) => (y.kind === 'album' ? y.a.releasedAt : y.t.releasedAt) - (x.kind === 'album' ? x.a.releasedAt : x.t.releasedAt),
    );
    const spotlight = [...catalog.artists].sort((a, b) => b.followers - a.followers).slice(0, 10);
    return { trend: trend.slice(0, 14), chart, features, rising: rising.slice(0, 10), releases, spotlight };
  }, [catalog, now, library.plays, m]);

  const recent = m.tracksOf(library.recents).slice(0, 12);
  const liked = m.tracksOf(library.likes);
  const forYou = useMemo(() => {
    if (!liked.length) return [];
    const genres = new Set(liked.map((t) => t.genre));
    return catalog.tracks.filter((t) => genres.has(t.genre) && !library.likes.includes(t.id)).sort((a, b) => b.popularity - a.popularity).slice(0, 12);
  }, [liked, catalog.tracks, library.likes]);
  const chartTracks = data.chart.map((r) => r.track);

  return (
    <div className="page-music">
      <PageTint spec={tint} color={tint ? undefined : '#1d6b45'} />
      <QuickPicks onTint={setTint} />

      <HeroCarousel items={data.features} />

      <nav className="genre-strip" aria-label={t('common.nav.genres')}>
        {GENRES.map((g) => (
          <GenreTile key={g.id} id={g.id} />
        ))}
      </nav>

      {recent.length > 0 && (
        <Shelf title={t('browse.discover.jumpBack')} subtitle={t('common.nav.recent')} href="#/library/recent">
          {recent.map((t) => (
            <TrackCard key={t.id} track={t} context={recent} />
          ))}
        </Shelf>
      )}

      <Shelf title={t('browse.discover.trending')} subtitle={t('browse.discover.trendingSub')} href="#/trending">
        {data.trend.map((t, i) => (
          <TrackCard key={t.id} track={t} context={data.trend} rank={i + 1} />
        ))}
      </Shelf>

      <Shelf title={t('browse.discover.spotlight')} subtitle={t('browse.discover.spotlightSub')}>
        {data.spotlight.map((a) => (
          <PosterCard key={a.id} artist={a} />
        ))}
      </Shelf>

      <section className="split">
        <div className="split__main">
          <header className="shelf__head">
            <div>
              <h2>{t('browse.discover.topSongs')}</h2>
              <p>{t('browse.discover.topSongsSub')}</p>
            </div>
            <a className="shelf__all" href="#/charts/songs/week">
              {t('browse.discover.fullChart')}
            </a>
          </header>
          <div className="tlist tlist--two" role="list">
            {data.chart.map((r) => (
              <TrackRow key={r.track.id} track={r.track} context={chartTracks} index={r.rank} plays={r.plays} change={r.change} />
            ))}
          </div>
        </div>
      </section>

      <Shelf title={t('browse.discover.newReleases')} subtitle={t('browse.discover.newReleasesSub')}>
        {data.releases.map((r) => (r.kind === 'album' ? <AlbumCard key={r.a.id} album={r.a} /> : <TrackCard key={r.t.id} track={r.t} />))}
      </Shelf>

      {forYou.length > 0 && (
        <Shelf title={t('browse.discover.forYou')} subtitle={t('browse.discover.forYouSub')}>
          {forYou.map((t) => (
            <TrackCard key={t.id} track={t} context={forYou} />
          ))}
        </Shelf>
      )}

      <Shelf title={t('browse.discover.mixes')} subtitle={t('browse.discover.mixesSub')}>
        {mixes.map((p) => (
          <PlaylistCard key={p.id} playlist={p} />
        ))}
      </Shelf>

      <section aria-labelledby="stream-title">
        <header className="shelf__head">
          <div>
            <h2 id="stream-title">{t('browse.discover.community')}</h2>
            <p>{t('browse.discover.communitySub')}</p>
          </div>
        </header>
        <div className="stream-list">
          {stream.map((t) => (
            <StreamCard key={t.id} track={t} context={stream} />
          ))}
        </div>
      </section>

      <Shelf title={t('browse.discover.featured')} subtitle={t('browse.discover.featuredSub')}>
        {catalog.playlists
          .filter((p) => p.editorial)
          .map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
      </Shelf>

      <Shelf title={t('browse.discover.toWatch')} subtitle={t('browse.discover.toWatchSub')}>
        {data.rising.map((a) => (
          <ArtistCard key={a.id} artist={a} />
        ))}
      </Shelf>
    </div>
  );
}
