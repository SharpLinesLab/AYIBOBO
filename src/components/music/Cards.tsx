import { genreById } from '../../catalog/genres';
import type { Album, Artist, Playlist, Track } from '../../catalog/types';
import { compact, useMusic } from '../../music';
import { Cover, ExplicitBadge, PlayAll, useIsCurrent } from './bits';
import { ArtistLinks } from './TrackRow';

export function TrackCard({ track, context, rank }: { track: Track; context?: Track[]; rank?: number }) {
  const m = useMusic();
  const { current } = useIsCurrent([track.id]);
  return (
    <article className={`mcard${current ? ' is-current' : ''}`} role="listitem">
      <a className="mcard__art" href={`#/song/${track.id}`} aria-label={track.title}>
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
      <span className="mcard__meta">{compact(m.totalPlays(track))} plays</span>
    </article>
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
      aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
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
    <article className="mcard" role="listitem">
      <a className="mcard__art" href={`#/album/${album.id}`} aria-label={album.title}>
        <Cover spec={album.cover} />
      </a>
      <span className="mcard__play">
        <PlayAll tracks={tracks} size="md" label={`Play ${album.title}`} />
      </span>
      <a className="mcard__title" href={`#/album/${album.id}`}>
        {album.title}
      </a>
      <span className="mcard__sub">{artist && <a href={`#/artist/${artist.id}`}>{artist.name}</a>}</span>
      <span className="mcard__meta">
        {album.type === 'ep' ? 'EP' : album.type === 'mixtape' ? 'Mixtape' : 'Album'} · {new Date(album.releasedAt).getFullYear()}
      </span>
    </article>
  );
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const m = useMusic();
  const tracks = m.tracksOf(playlist.trackIds);
  return (
    <article className="mcard" role="listitem">
      <a className="mcard__art" href={`#/playlist/${playlist.id}`} aria-label={playlist.title}>
        <Cover spec={playlist.cover} />
      </a>
      <span className="mcard__play">
        <PlayAll tracks={tracks} size="md" label={`Play ${playlist.title}`} />
      </span>
      <a className="mcard__title" href={`#/playlist/${playlist.id}`}>
        {playlist.title}
      </a>
      <span className="mcard__sub">{playlist.curator}</span>
      <span className="mcard__meta">{playlist.trackIds.length} songs</span>
    </article>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  const m = useMusic();
  const following = m.library.follows.includes(artist.id);
  return (
    <article className="mcard mcard--artist" role="listitem">
      <a className="mcard__art" href={`#/artist/${artist.id}`} aria-label={artist.name}>
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
      <span className="mcard__meta">{compact(m.followerCount(artist))} followers</span>
      <button type="button" className={`follow-btn${following ? ' is-on' : ''}`} onClick={() => m.toggleFollow(artist.id)}>
        {following ? 'Following' : 'Follow'}
      </button>
    </article>
  );
}

export function Verified() {
  return (
    <svg className="verified" viewBox="0 0 24 24" width="15" height="15" aria-label="Verified" role="img">
      <path
        fill="currentColor"
        d="M12 1.5l2.4 1.8 3-.2.9 2.9 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-.9 2.9-3-.2L12 22.5l-2.4-1.8-3 .2-.9-2.9-2.5-1.7.9-2.9-.9-2.9 2.5-1.7.9-2.9 3 .2z"
      />
      <path d="M8 12.2l2.6 2.6L16.2 9" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GenreTile({ id }: { id: Parameters<typeof genreById>[0] }) {
  const g = genreById(id);
  return (
    <a className="genre-tile" href={`#/genres/${g.id}`} style={{ background: `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})` }} role="listitem">
      <span>{g.label}</span>
    </a>
  );
}
