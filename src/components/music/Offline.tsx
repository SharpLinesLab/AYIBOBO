import { useState } from 'react';
import type { Track } from '../../catalog/types';
import { useMusic } from '../../music';
import { useOnline, useServiceWorker } from '../../offline';
import { useApp } from '../../store';
import { DownloadIcon } from '../icons';

/** Download / Downloaded toggle for a song, album or playlist. */
export function DownloadButton({ tracks, label, compact }: { tracks: Track[]; label: string; compact?: boolean }) {
  const m = useMusic();
  const { toast } = useApp();
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const done = tracks.length > 0 && tracks.every((t) => m.isDownloaded(t.id));
  const busy = progress !== null;

  const run = async () => {
    if (busy || !tracks.length) return;
    if (done) {
      await m.removeDownloads(tracks.map((t) => t.id));
      toast('Removed from downloads');
      return;
    }
    try {
      setProgress([0, tracks.length]);
      await m.download(tracks, (d, n) => setProgress([d, n]));
      toast(tracks.length === 1 ? 'Downloaded — plays without a connection' : `Downloaded ${tracks.length} songs`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setProgress(null);
    }
  };

  const text = busy ? (progress[1] ? `Downloading ${progress[0]}/${progress[1]}` : 'Downloading…') : done ? 'Downloaded' : 'Download';
  return (
    <button
      type="button"
      className={`${compact ? 'icon-toggle' : 'btn-glass'} dl-btn${done ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}
      onClick={() => void run()}
      aria-pressed={done}
      aria-label={compact ? `${done ? 'Remove download of' : 'Download'} ${label}` : undefined}
      title={done ? 'Saved for offline — click to remove' : 'Save for offline listening'}
    >
      <span className="dl-btn__icon" aria-hidden>
        <DownloadIcon width={16} height={16} />
      </span>
      {!compact && <span>{text}</span>}
    </button>
  );
}

/** Small green marker next to downloaded songs. */
export function DownloadedMark() {
  return (
    <span className="dl-mark" title="Downloaded" aria-label="Downloaded">
      <DownloadIcon width={11} height={11} />
    </span>
  );
}

/** Offline notice + "new version ready" prompt. */
export function ConnectionBanner() {
  const online = useOnline();
  const sw = useServiceWorker();
  if (sw.updateReady)
    return (
      <div className="conn conn--update" role="status">
        <span>A new version of ASF is ready.</span>
        <button className="btn-accent btn-sm" onClick={sw.applyUpdate}>
          Refresh
        </button>
      </div>
    );
  if (!online)
    return (
      <div className="conn" role="status">
        <b>You’re offline.</b> <span>The ASF catalog, your uploads and your downloads still play. Boost Board and sharing need a connection.</span>
      </div>
    );
  return null;
}
