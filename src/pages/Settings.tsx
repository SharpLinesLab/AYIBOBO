import { useMusic, usePlayerState } from '../music';
import { clearOffline, requestPersistence, useOnline, useServiceWorker, useStorageInfo } from '../offline';
import { MAX_CROSSFADE, setAutoplay, setCrossfade } from '../player/engine';
import { useApp } from '../store';
import { PageHead } from './Browse';
import { SoundPanel } from '../components/music/SoundPanel';

function bytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${Math.max(0, Math.round(n / 1e3))} KB`;
}

export function SettingsPage() {
  const m = useMusic();
  const { toast } = useApp();
  const player = usePlayerState();
  const sw = useServiceWorker();
  const online = useOnline();
  const [storage, refresh] = useStorageInfo([m.library.downloads.length]);
  const xf = player.crossfade;

  const offlineText = {
    ready: 'Ready — ASF opens and plays with no connection on this device.',
    installing: 'Getting ready… ASF is saving itself for offline use.',
    dev: 'Offline mode turns on in the production build.',
    unsupported: 'This browser can’t run ASF offline. Try a current version of Chrome, Edge, Safari or Firefox.',
    error: 'Offline mode couldn’t start. Reload the page to try again.',
  }[sw.status];

  return (
    <div className="page-music settings">
      <PageHead kicker="Settings" title="Settings" sub="Saved on this device." />

      <section className="card-panel set-group" aria-labelledby="set-playback">
        <h2 className="panel-title" id="set-playback">
          Playback
        </h2>
        <div className="set-row">
          <div className="set-row__text">
            <label htmlFor="crossfade" className="set-row__title">
              Crossfade
            </label>
            <p className="muted">Blend the end of each song into the start of the next. When it’s off, songs play back to back with no gap.</p>
          </div>
          <div className="set-row__control set-slider">
            <input
              id="crossfade"
              type="range"
              min={0}
              max={MAX_CROSSFADE}
              step={1}
              value={xf}
              onChange={(e) => setCrossfade(Number(e.target.value))}
              aria-valuetext={xf ? `${xf} seconds` : 'Off'}
              style={{ ['--v' as string]: `${(xf / MAX_CROSSFADE) * 100}%` }}
            />
            <output htmlFor="crossfade" className="num">
              {xf ? `${xf} s` : 'Off'}
            </output>
          </div>
        </div>
        <div className="set-row">
          <div className="set-row__text">
            <label htmlFor="autoplay" className="set-row__title">
              Autoplay
            </label>
            <p className="muted">When your music ends, keep listening with similar songs.</p>
          </div>
          <label className="switch">
            <input id="autoplay" type="checkbox" role="switch" checked={player.autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
            <span aria-hidden />
          </label>
        </div>
      </section>

      <section className="card-panel set-group" aria-labelledby="set-sound">
        <h2 className="panel-title" id="set-sound">
          Sound
        </h2>
        <p className="muted set-intro">Shape how everything sounds: equalizer presets, a bass boost, or sped-up and slowed + reverb versions of any song.</p>
        <SoundPanel />
      </section>

      <section className="card-panel set-group" aria-labelledby="set-offline">
        <h2 className="panel-title" id="set-offline">
          Offline
        </h2>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">
              Offline mode <span className={`set-dot${sw.status === 'ready' ? ' is-on' : ''}`} aria-hidden />
            </span>
            <p className="muted">{offlineText}</p>
          </div>
          <span className={`pill2${online ? '' : ' is-warn'}`}>{online ? 'Online' : 'Offline now'}</span>
        </div>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">Downloads</span>
            <p className="muted">
              {m.library.downloads.length} {m.library.downloads.length === 1 ? 'song' : 'songs'} saved
              {storage ? ` · ${bytes(storage.usage)} used on this device${storage.quota ? ` of ${bytes(storage.quota)} available` : ''}` : ''}.
            </p>
          </div>
          <div className="set-row__control">
            <a className="btn-glass btn-sm" href="#/library/downloads">
              View
            </a>
            <button
              className="btn-glass btn-sm"
              disabled={!m.library.downloads.length}
              onClick={async () => {
                if (!confirm('Remove all downloads from this device?')) return;
                await m.removeDownloads(m.library.downloads);
                await clearOffline();
                refresh();
                toast('Downloads removed');
              }}
            >
              Remove all
            </button>
          </div>
        </div>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">Protect downloads</span>
            <p className="muted">Ask the browser not to clear your downloads and uploads when the device runs low on space.</p>
          </div>
          <div className="set-row__control">
            {storage?.persisted ? (
              <span className="pill2 is-ok">Protected</span>
            ) : (
              <button
                className="btn-glass btn-sm"
                onClick={async () => {
                  const ok = await requestPersistence();
                  refresh();
                  toast(ok ? 'Downloads are protected' : 'Your browser decides this automatically — keep using ASF and it usually grants it.');
                }}
              >
                Protect
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card-panel set-group" aria-labelledby="set-creators">
        <h2 className="panel-title" id="set-creators">
          For artists
        </h2>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">Artist Studio</span>
            <p className="muted">Streams, listeners, top songs and where your audience is.</p>
          </div>
          <div className="set-row__control">
            <a className="btn-glass btn-sm" href="#/studio">
              Open
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
