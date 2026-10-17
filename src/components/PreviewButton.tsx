import { useEffect, useState } from 'react';
import { PREVIEW_SECONDS, getPlayerState, subscribePlayer, togglePreview } from '../lib/audio';
import type { Listing } from '../lib/types';
import { PauseIcon, PlayIcon } from './icons';

export function usePlayer() {
  const [s, setS] = useState(getPlayerState);
  useEffect(() => subscribePlayer(setS), []);
  return s;
}

export function PreviewButton({ listing }: { listing: Listing }) {
  const player = usePlayer();
  if (!listing.preview) return null;
  const playing = player.playingId === listing.id;
  const remaining = Math.ceil(PREVIEW_SECONDS * (1 - player.progress));
  return (
    <button
      type="button"
      className={`preview${playing ? ' is-playing' : ''}`}
      onClick={() => togglePreview(listing.id, listing.preview!)}
      aria-label={playing ? `Stop preview of ${listing.title}` : `Play a ${PREVIEW_SECONDS}-second preview of ${listing.title}`}
      aria-pressed={playing}
    >
      <span className="preview__btn">{playing ? <PauseIcon /> : <PlayIcon />}</span>
      {playing ? (
        <>
          <span className="eq" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="preview__bar" aria-hidden>
            <span className="preview__fill" style={{ width: `${player.progress * 100}%` }} />
          </span>
          <span className="num">0:{String(remaining).padStart(2, '0')}</span>
        </>
      ) : (
        <span>Preview</span>
      )}
    </button>
  );
}
