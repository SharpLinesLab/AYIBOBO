import { useState } from 'react';
import type { Track } from '../../catalog/types';
import { useMusic } from '../../music';
import { useOnline, useServiceWorker } from '../../offline';
import { useApp } from '../../store';
import { DownloadIcon } from '../icons';
import { plural, t } from '../../i18n';

/** Download / Downloaded toggle for a song, album or playlist. */
export function DownloadButton({ tracks, label, compact }: { tracks: Track[]; label: string; compact?: boolean }) {
  const m = useMusic();
  const { toast } = useApp();
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const done = tracks.length > 0 && tracks.every((x) => m.isDownloaded(x.id));
  const busy = progress !== null;

  const run = async () => {
    if (busy || !tracks.length) return;
    if (done) {
      await m.removeDownloads(tracks.map((x) => x.id));
      toast(t('pages.offline.removed'));
      return;
    }
    try {
      setProgress([0, tracks.length]);
      await m.download(tracks, (d, n) => setProgress([d, n]));
      toast(tracks.length === 1 ? t('pages.offline.downloadedOne') : plural('pages.offline.downloadedMany', tracks.length));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pages.offline.failed'));
    } finally {
      setProgress(null);
    }
  };

  const text = busy
    ? progress[1]
      ? t('pages.offline.downloadingProgress', { done: progress[0], total: progress[1] })
      : t('pages.offline.downloading')
    : done
      ? t('pages.offline.downloaded')
      : t('common.action.download');
  return (
    <button
      type="button"
      className={`${compact ? 'icon-toggle' : 'btn-glass'} dl-btn${done ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}
      onClick={() => void run()}
      aria-pressed={done}
      aria-label={compact ? t(done ? 'pages.offline.removeName' : 'pages.offline.downloadName', { name: label }) : undefined}
      title={done ? t('pages.offline.savedTitle') : t('pages.offline.saveTitle')}
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
    <span className="dl-mark" title={t('pages.offline.downloaded')} aria-label={t('pages.offline.downloaded')}>
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
        <span>{t('pages.offline.updateReady')}</span>
        <button className="btn-accent btn-sm" onClick={sw.applyUpdate}>
          {t('pages.offline.refresh')}
        </button>
      </div>
    );
  if (!online)
    return (
      <div className="conn" role="status">
        <b>{t('pages.offline.youreOffline')}</b> <span>{t('pages.offline.offlineBody')}</span>
      </div>
    );
  return null;
}
