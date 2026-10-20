import type { Track } from '../../catalog/types';
import { compact, fmtTime, useMusic } from '../../music';
import { PauseIcon, PlayIcon } from '../icons';
import { Cover, Eq, ExplicitBadge, LikeButton, PromotedBadge, useIsCurrent, Verified } from './bits';
import { TrackMenu } from './TrackMenu';
import { DownloadedMark } from './Offline';
import { useOnline } from '../../offline';
import { t } from '../../i18n';
import { useIsPromoted } from '../../lib/promotions';

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
  /** A feed's promoted slot: it takes no chart position. (Any song promoted right now shows the badge.) */
  promoted?: boolean;
}

export function ArtistLinks({ track }: { track: Track }) {
  const m = useMusic();
  const main = m.artist(track.artistId);
  const feats = (track.featuring ?? []).map((id) => m.artist(id)).filter((a) => !!a);
  // Published songs carry their own credit, linked to the uploader's artist page.
  const name = track.artistName ?? main?.name;
  return (
    <span className="artist-links">
      {main ? <a href={`#/artist/${main.id}`}>{name}</a> : <span>{name ?? (m.library.displayName || t('common.word.you'))}</span>}
      {main?.verified && <Verified />}
      {track.featuredArtists && (
        <>
          {' '}
          {t('browse.feat')} {track.featuredArtists}
        </>
      )}
      {feats.length > 0 && (
        <>
          {' '}
          {t('browse.feat')}{' '}
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

export function TrackRow({ track, context, index, showCover = true, plays, change, playlistId, showAlbum, promoted }: TrackRowProps) {
  const m = useMusic();
  const { current, playing } = useIsCurrent([track.id]);
  const isPromoted = useIsPromoted(track.id) || !!promoted;
  const album = showAlbum && track.albumId ? m.album(track.albumId) : undefined;
  const online = useOnline();
  const unavailable = !online && !m.availableOffline(track);
  return (
    <div
      className={`trow${current ? ' is-current' : ''}${unavailable ? ' is-unavailable' : ''}`}
      title={unavailable ? t('browse.row.unavailable') : undefined}
      role="listitem"
      onDoubleClick={() => m.toggle(track, context)}
    >
      <div className="trow__index">
        <span className="trow__num">{current ? <Eq paused={!playing} /> : promoted ? '' : index}</span>
        <button type="button" className="trow__play" aria-label={t(playing ? 'common.action.pauseName' : 'common.action.playName', { name: track.title })} onClick={() => m.toggle(track, context)}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
      {change !== undefined && (
        <span className={`trow__change ${change === null ? 'is-new' : change > 0 ? 'is-up' : change < 0 ? 'is-down' : ''}`} title={t('browse.row.change')}>
          {change === null ? t('common.word.new') : change > 0 ? `▲${change}` : change < 0 ? `▼${-change}` : '–'}
        </span>
      )}
      {showCover && <Cover spec={track.cover} size={44} className="trow__cover" />}
      <div className="trow__main">
        <a className="trow__title" href={`#/song/${track.id}`}>
          {track.title}
          {track.explicit && <ExplicitBadge />}
        </a>
        <span className="trow__sub">
          {isPromoted && <PromotedBadge />}
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
      <span className="trow__plays num" title={t('browse.col.plays')}>
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
      <span className="trow__main">{t('browse.col.title')}</span>
      <span className="trow__plays">{t('browse.col.plays')}</span>
      <span className="trow__actions-spacer" />
      <span className="trow__time">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-label={t('browse.col.duration')}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
    </div>
  );
}

/** `promotedIds`: rows marked as promoted; they don't count toward the numbering. */
export function TrackList({
  tracks,
  startIndex = 1,
  header,
  promotedIds,
  ...rest
}: { tracks: Track[]; startIndex?: number; header?: boolean; promotedIds?: ReadonlySet<string> } & Omit<TrackRowProps, 'track' | 'context' | 'index' | 'promoted'>) {
  let n = startIndex;
  return (
    <div className="tlist" role="list">
      {header && <TrackListHeader showCover={rest.showCover !== false} withChange={rest.change !== undefined} />}
      {tracks.map((t) => {
        const promoted = !!promotedIds?.has(t.id);
        return <TrackRow key={t.id} track={t} context={tracks} index={promoted ? 0 : n++} promoted={promoted} {...rest} />;
      })}
    </div>
  );
}
