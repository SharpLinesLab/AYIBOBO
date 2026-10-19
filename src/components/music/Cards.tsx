import { genreById } from '../../catalog/genres';
import type { Album, Artist, Playlist, Track } from '../../catalog/types';
import { compact, useMusic } from '../../music';
import { plural, t } from '../../i18n';
import { Cover, ExplicitBadge, PlayAll, useIsCurrent, Verified } from './bits';

export { Verified } from './bits';
import { ArtistLinks } from './TrackRow';

export function TrackCard({ track, context, rank }: { track: Track; context?: Track[]; rank?: number }) {
  const m = useMusic();
  const { current } = useIsCurrent([track.id]);
  return (
    <div className={`mcard${current ? ' is-current' : ''}`} role="listitem">
      <a className="mcard__art" href={`#/song/${track.id}`}>
        <span className="sr-only">{track.title}</span>
        <Cover spec={track.cover} />
        {rank !== undefined && <span className="mcard__rank">{rank}</span>}
      </a>
      <span className="mcard__play">
        <PlayAllSingle track={track} context={context} />
      </span>
      <a className="mcard__title" href={`#/song/${track.id}`}>
        {track.title}
        {track.explicit && <ExplicitBadge />}
      </a>
      <span className="mcard__sub">
        <ArtistLinks track={track} />
      </span>
      <span className="mcard__meta">{plural('common.count.plays', m.totalPlays(track), { n: compact(m.totalPlays(track)) })}</span>
    </div>
  );
}

/** Card play button that queues the surrounding context but starts from this track. */
function PlayAllSingle({ track, context }: { track: Track; context?: Track[] }) {
  const m = useMusic();
  const { current, playing } = useIsCurrent([track.id]);
  return (
    <button
      type="button"
      className={`play-btn play-btn--md${playing ? ' is-playing' : ''}`}
      aria-label={t(playing ? 'common.action.pauseName' : 'common.action.playName', { name: track.title })}
      onClick={(e) => {
        e.stopPropagation();
        m.toggle(track, context);
      }}
      data-current={current || undefined}
    >
      {playing ? (
        <svg viewBox="0 0 10 10" aria-hidden>
          <rect x="1.8" y="1.2" width="2.3" height="7.6" rx="0.6" fill="currentColor" />
          <rect x="5.9" y="1.2" width="2.3" height="7.6" rx="0.6" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 10 10" aria-hidden>
          <path d="M2.4 1.2v7.6L8.8 5z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

export function AlbumCard({ album }: { album: Album }) {
  const m = useMusic();
  const artist = m.artist(album.artistId);
  const tracks = m.tracksOf(album.trackIds);
  return (
    <div className="mcard" role="listitem">
      <a className="mcard__art" href={`#/album/${album.id}`}>
        <span className="sr-only">{album.title}</span>
        <Cover spec={album.cover} />
      </a>
      <span className="mcard__play">
        <PlayAll tracks={tracks} size="md" label={t('common.action.playName', { name: album.title })} />
      </span>
      <a className="mcard__title" href={`#/album/${album.id}`}>
        {album.title}
      </a>
      <span className="mcard__sub">{artist && <a href={`#/artist/${artist.id}`}>{artist.name}</a>}</span>
      <span className="mcard__meta">
        {t(album.type === 'ep' ? 'common.kind.ep' : album.type === 'mixtape' ? 'common.kind.mixtape' : 'common.kind.album')} · {new Date(album.releasedAt).getFullYear()}
      </span>
    </div>
  );
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const m = useMusic();
  const tracks = m.tracksOf(playlist.trackIds);
  return (
    <div className="mcard" role="listitem">
      <a className="mcard__art" href={`#/playlist/${playlist.id}`}>
        <span className="sr-only">{playlist.title}</span>
        <Cover spec={playlist.cover} />
      </a>
      <span className="mcard__play">
        <PlayAll tracks={tracks} size="md" label={t('common.action.playName', { name: playlist.title })} />
      </span>
      <a className="mcard__title" href={`#/playlist/${playlist.id}`}>
        {playlist.title}
      </a>
      <span className="mcard__sub">{playlist.id.startsWith('mix-') ? playlist.description : playlist.curator}</span>
      <span className="mcard__meta">{plural('common.count.songs', playlist.trackIds.length)}</span>
    </div>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  const m = useMusic();
  const following = m.library.follows.includes(artist.id);
  return (
    <div className="mcard mcard--artist" role="listitem">
      <a className="mcard__art" href={`#/artist/${artist.id}`}>
        <span className="sr-only">{artist.name}</span>
        <Cover spec={artist.avatar} round />
        <span className="mcard__initials" aria-hidden>
          {artist.name
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)}
        </span>
      </a>
      <a className="mcard__title" href={`#/artist/${artist.id}`}>
        {artist.name}
        {artist.verified && <Verified />}
      </a>
      <span className="mcard__meta">{plural('common.count.followers', m.followerCount(artist), { n: compact(m.followerCount(artist)) })}</span>
      <button type="button" className={`follow-btn${following ? ' is-on' : ''}`} onClick={() => m.toggleFollow(artist.id)}>
        {following ? t('common.action.following') : t('common.action.follow')}
      </button>
    </div>
  );
}

/** Genre tile backed by the genre's lead artist imagery, tinted with the genre colors. */
export function GenreTile({ id }: { id: Parameters<typeof genreById>[0] }) {
  const m = useMusic();
  const g = genreById(id);
  const lead = [...m.catalog.artists].filter((a) => a.genres[0] === id || a.genres.includes(id)).sort((a, b) => b.followers - a.followers)[0];
  return (
    <a className="genre-tile" href={`#/genres/${g.id}`} style={{ ['--g1' as string]: g.colors[0], ['--g2' as string]: g.colors[1] }}>
      {lead && <Cover spec={lead.poster} className="genre-tile__img" />}
      <span>{g.label}</span>
    </a>
  );
}

/** Tall tour-poster card for artist spotlights; name set in HTML for crisp typography. */
export function PosterCard({ artist }: { artist: Artist }) {
  const m = useMusic();
  const following = m.library.follows.includes(artist.id);
  const top = m.artistTracks(artist.id).filter((t) => t.artistId === artist.id);
  return (
    <div className="poster" role="listitem">
      <a href={`#/artist/${artist.id}`} className="poster__link">
        <Cover spec={artist.poster} className="poster__img" />
        <span className="poster__shade" aria-hidden />
        <span className="poster__text">
          <span className="poster__kicker">{genreById(artist.genres[0]).label} · {artist.location.split(',')[0]}</span>
          <span className="poster__name">
            {artist.name}
            {artist.verified && <Verified />}
          </span>
          <span className="poster__meta">{plural('common.count.followers', m.followerCount(artist), { n: compact(m.followerCount(artist)) })}</span>
        </span>
      </a>
      <span className="poster__actions">
        <PlayAll tracks={top} size="sm" label={t('common.action.playName', { name: artist.name })} />
        <button type="button" className={`follow-btn${following ? ' is-on' : ''}`} onClick={() => m.toggleFollow(artist.id)}>
          {following ? t('common.action.following') : t('common.action.follow')}
        </button>
      </span>
    </div>
  );
}
