import type { Track } from '../../catalog/types';
import { compact, fmtTime, useMusic } from '../../music';
import { PauseIcon, PlayIcon } from '../icons';
import { Cover, Eq, ExplicitBadge, LikeButton, useIsCurrent } from './bits';
import { TrackMenu } from './TrackMenu';
import { DownloadedMark } from './Offline';
import { useOnline } from '../../offline';

export interface TrackRowProps {
  track: Track;
  /** Queue to play when this row starts playback. */
  context: Track[];
  index: number;
  showCover?: boolean;
  plays?: number;
  /** Chart movement: positive = up, negative = down, null = new. */
  change?: number | null;
  playlistId?: string;
  showAlbum?: boolean;
}

export function ArtistLinks({ track }: { track: Track }) {
  const m = useMusic();
  const main = m.artist(track.artistId);
  const feats = (track.featuring ?? []).map((id) => m.artist(id)).filter((a) => !!a);
  return (
    <span className="artist-links">
      {main ? <a href={`#/artist/${main.id}`}>{main.name}</a> : <span>{m.library.displayName || 'You'}</span>}
      {feats.length > 0 && (
        <>
          {' '}
          feat.{' '}
          {feats.map((a, i) => (
            <span key={a!.id}>
              {i > 0 && ', '}
              <a href={`#/artist/${a!.id}`}>{a!.name}</a>
            </span>
          ))}
        </>
      )}
    </span>
  );
}

export function TrackRow({ track, context, index, showCover = true, plays, change, playlistId, showAlbum }: TrackRowProps) {
  const m = useMusic();
  const { current, playing } = useIsCurrent([track.id]);
  const album = showAlbum && track.albumId ? m.album(track.albumId) : undefined;
  const online = useOnline();
  const unavailable = !online && !m.availableOffline(track);
  return (
    <div
      className={`trow${current ? ' is-current' : ''}${unavailable ? ' is-unavailable' : ''}`}
      title={unavailable ? 'Not downloaded — needs a connection' : undefined}
      role="listitem"
      onDoubleClick={() => m.toggle(track, context)}
    >
      <div className="trow__index">
        <span className="trow__num">{current ? <Eq paused={!playing} /> : index}</span>
        <button type="button" className="trow__play" aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`} onClick={() => m.toggle(track, context)}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
      {change !== undefined && (
        <span className={`trow__change ${change === null ? 'is-new' : change > 0 ? 'is-up' : change < 0 ? 'is-down' : ''}`} title="Change vs previous period">
          {change === null ? 'NEW' : change > 0 ? `▲${change}` : change < 0 ? `▼${-change}` : '–'}
        </span>
      )}
      {showCover && <Cover spec={track.cover} size={44} className="trow__cover" />}
      <div className="trow__main">
        <a className="trow__title" href={`#/song/${track.id}`}>
          {track.title}
          {track.explicit && <ExplicitBadge />}
        </a>
        <span className="trow__sub">
          {m.isDownloaded(track.id) && <DownloadedMark />}
          <ArtistLinks track={track} />
          {album && (
            <>
              {' · '}
              <a href={`#/album/${album.id}`}>{album.title}</a>
            </>
          )}
        </span>
      </div>
      <span className="trow__plays num" title="Plays">
        {compact(plays ?? m.totalPlays(track))}
      </span>
      <div className="trow__actions">
        <LikeButton id={track.id} />
        <TrackMenu track={track} playlistId={playlistId} />
      </div>
      <span className="trow__time num">{fmtTime(track.duration)}</span>
    </div>
  );
}

/** Column header row (#, Title, Plays, duration) aligned with TrackRow. */
export function TrackListHeader({ showCover = true, withChange = false }: { showCover?: boolean; withChange?: boolean }) {
  return (
    <div className="trow trow--head" aria-hidden>
      <span className="trow__index">#</span>
      {withChange && <span className="trow__change" />}
      {showCover && <span className="trow__cover-spacer" />}
      <span className="trow__main">Title</span>
      <span className="trow__plays">Plays</span>
      <span className="trow__actions-spacer" />
      <span className="trow__time">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Duration">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
    </div>
  );
}

export function TrackList({ tracks, startIndex = 1, header, ...rest }: { tracks: Track[]; startIndex?: number; header?: boolean } & Omit<TrackRowProps, 'track' | 'context' | 'index'>) {
  return (
    <div className="tlist" role="list">
      {header && <TrackListHeader showCover={rest.showCover !== false} withChange={rest.change !== undefined} />}
      {tracks.map((t, i) => (
        <TrackRow key={t.id} track={t} context={tracks} index={startIndex + i} {...rest} />
      ))}
    </div>
  );
}
