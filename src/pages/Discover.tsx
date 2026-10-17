import { useEffect, useMemo, useState } from 'react';
import { GENRES } from '../catalog/genres';
import { trackChart, trending } from '../catalog/plays';
import type { Album, Track } from '../catalog/types';
import { coverUrl } from '../catalog/covers';
import { compact, useMusic, usePlayerState } from '../music';
import { pause, resume } from '../player/engine';
import { useApp } from '../store';
import { usd } from '../lib/format';
import { PauseIcon, PlayIcon } from '../components/icons';
import { Cover, HeartIcon, Shelf } from '../components/music/bits';
import { AlbumCard, ArtistCard, GenreTile, PlaylistCard, TrackCard, Verified } from '../components/music/Cards';
import { TrackRow } from '../components/music/TrackRow';
import { Thumb } from '../components/Thumb';

type Feature = { kind: 'album'; album: Album; tracks: Track[] } | { kind: 'single'; track: Track; tracks: Track[] };

function HeroCarousel({ items }: { items: Feature[] }) {
  const m = useMusic();
  const s = usePlayerState();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const n = items.length;
  useEffect(() => {
    if (hold || n < 2) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % n), 7000);
    return () => clearTimeout(t);
  }, [i, hold, n]);
  if (!n) return null;
  return (
    <section className="hero2" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} aria-roledescription="carousel" aria-label="Featured releases">
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
            <div className="hero2__bg" style={{ backgroundImage: `url("${coverUrl(cover)}")` }} />
            <a href={href} className="hero2__art" tabIndex={active ? 0 : -1}>
              <Cover spec={cover} alt={title} />
            </a>
            <div className="hero2__body">
              <span className="hero2__kicker">
                {f.kind === 'album' ? (f.album.type === 'ep' ? 'New EP' : f.album.type === 'mixtape' ? 'New mixtape' : 'New album') : 'New single'}
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
              <p className="hero2__desc">{f.kind === 'album' ? f.album.description : `${f.track.description} ${compact(m.totalPlays(f.track))} plays so far.`}</p>
              <div className="hero2__actions">
                <button
                  className="btn-accent btn-lg"
                  tabIndex={active ? 0 : -1}
                  onClick={() => (isCur ? (s.playing ? pause() : resume()) : m.play(f.tracks, 0))}
                >
                  {playing ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} />}
                  {playing ? 'Pause' : 'Play now'}
                </button>
                <button
                  className={`btn-glass btn-lg${saved ? ' is-on' : ''}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => (f.kind === 'album' ? m.toggleLikeAlbum(f.album.id) : m.toggleLike(f.track.id))}
                >
                  <HeartIcon filled={saved} /> {saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </article>
        );
      })}
      <div className="hero2__dots" role="tablist">
        {items.map((_, k) => (
          <button key={k} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} className={k === i ? 'is-active' : ''} onClick={() => setI(k)}>
            {k === i && !hold && <span key={i} />}
          </button>
        ))}
      </div>
    </section>
  );
}

function BoostSpotlight() {
  const { boards, openDetail } = useApp();
  const top = boards.all.slice(0, 3);
  if (!top.length) return null;
  return (
    <section className="boost-spot">
      <div className="boost-spot__copy">
        <span className="badge-gold">Boost Board</span>
        <h2>Rank is strictly what you pay.</h2>
        <p>No algorithm, no gatekeepers. Put your site, release or @handle on the public board — #1 costs the current #1 plus $5.</p>
        <a className="btn-accent" href="#/leaderboard">
          Claim a rank
        </a>
      </div>
      <ol className="boost-spot__list">
        {top.map((e) => (
          <li key={e.listing.id}>
            <button onClick={() => openDetail(e.listing.id)}>
              <span className="boost-spot__rank">#{e.rank}</span>
              <Thumb art={e.listing.artwork} size="sm" />
              <span className="boost-spot__name">
                <b>{e.listing.title}</b>
                <small>{e.listing.display}</small>
              </span>
              <span className="boost-spot__amt num">{usd(e.total)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DiscoverPage() {
  const m = useMusic();
  const { catalog, now, library } = m;

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
    return { trend: trend.slice(0, 14), chart, features, rising: rising.slice(0, 10), releases };
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
      <HeroCarousel items={data.features} />

      <div className="genre-strip" role="list" aria-label="Genres">
        {GENRES.map((g) => (
          <GenreTile key={g.id} id={g.id} />
        ))}
      </div>

      {recent.length > 0 && (
        <Shelf title="Jump back in" subtitle="Recently played" href="#/library/recent">
          {recent.map((t) => (
            <TrackCard key={t.id} track={t} context={recent} />
          ))}
        </Shelf>
      )}

      <Shelf title="Trending now" subtitle="The fastest-rising songs on ASF this week" href="#/trending">
        {data.trend.map((t, i) => (
          <TrackCard key={t.id} track={t} context={data.trend} rank={i + 1} />
        ))}
      </Shelf>

      <section className="split">
        <div className="split__main">
          <header className="shelf__head">
            <div>
              <h2>Top songs this week</h2>
              <p>Ranked by plays over the last 7 days</p>
            </div>
            <a className="shelf__all" href="#/charts/songs/week">
              Full chart
            </a>
          </header>
          <div className="tlist tlist--two" role="list">
            {data.chart.map((r) => (
              <TrackRow key={r.track.id} track={r.track} context={chartTracks} index={r.rank} plays={r.plays} change={r.change} />
            ))}
          </div>
        </div>
      </section>

      <Shelf title="New releases" subtitle="Fresh albums, EPs and singles">
        {data.releases.map((r) => (r.kind === 'album' ? <AlbumCard key={r.a.id} album={r.a} /> : <TrackCard key={r.t.id} track={r.t} />))}
      </Shelf>

      {forYou.length > 0 && (
        <Shelf title="Made for you" subtitle="Based on the songs you’ve liked">
          {forYou.map((t) => (
            <TrackCard key={t.id} track={t} context={forYou} />
          ))}
        </Shelf>
      )}

      <Shelf title="Featured playlists" subtitle="Curated by ASF Editorial">
        {catalog.playlists
          .filter((p) => p.editorial)
          .map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
      </Shelf>

      <BoostSpotlight />

      <Shelf title="Artists to watch" subtitle="Rising voices across the diaspora">
        {data.rising.map((a) => (
          <ArtistCard key={a.id} artist={a} />
        ))}
      </Shelf>
    </div>
  );
}
