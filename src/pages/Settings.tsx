import { fmtNumber, plural, t } from '../i18n';
import { LanguageChoice } from '../components/LanguagePicker';
import { useMusic, usePlayerState } from '../music';
import { clearOffline, requestPersistence, useOnline, useServiceWorker, useStorageInfo } from '../offline';
import { MAX_CROSSFADE, setAutoplay, setCrossfade } from '../player/engine';
import { useApp } from '../store';
import { PageHead } from './Browse';
import { SoundPanel } from '../components/music/SoundPanel';

function bytes(n: number): string {
  if (n >= 1e9) return `${fmtNumber(n / 1e9, 1)} GB`;
  if (n >= 1e6) return `${fmtNumber(n / 1e6, 1)} MB`;
  return `${fmtNumber(Math.max(0, n / 1e3))} KB`;
}

export function SettingsPage() {
  const m = useMusic();
  const { toast } = useApp();
  const player = usePlayerState();
  const sw = useServiceWorker();
  const online = useOnline();
  const [storage, refresh] = useStorageInfo([m.library.downloads.length]);
  const xf = player.crossfade;

  const offlineText = t(`common.settings.offline.${sw.status}`);

  return (
    <div className="page-music settings">
      <PageHead kicker={t('common.settings.kicker')} title={t('common.settings.title')} sub={t('common.settings.sub')} />

      <section className="card-panel set-group" aria-labelledby="set-lang">
        <h2 className="panel-title" id="set-lang">
          {t('common.lang.label')}
        </h2>
        <p className="muted set-intro">{t('common.lang.hint')}</p>
        <LanguageChoice />
      </section>

      <section className="card-panel set-group" aria-labelledby="set-playback">
        <h2 className="panel-title" id="set-playback">
          {t('common.settings.playback')}
        </h2>
        <div className="set-row">
          <div className="set-row__text">
            <label htmlFor="crossfade" className="set-row__title">
              {t('common.settings.crossfade')}
            </label>
            <p className="muted">{t('common.settings.crossfadeHint')}</p>
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
              aria-valuetext={xf ? t('common.settings.secondsLong', { n: xf }) : t('common.settings.off')}
              style={{ ['--v' as string]: `${(xf / MAX_CROSSFADE) * 100}%` }}
            />
            <output htmlFor="crossfade" className="num">
              {xf ? t('common.settings.seconds', { n: xf }) : t('common.settings.off')}
            </output>
          </div>
        </div>
        <div className="set-row">
          <div className="set-row__text">
            <label htmlFor="autoplay" className="set-row__title">
              {t('common.settings.autoplay')}
            </label>
            <p className="muted">{t('common.settings.autoplayHint')}</p>
          </div>
          <label className="switch">
            <input id="autoplay" type="checkbox" role="switch" checked={player.autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
            <span aria-hidden />
          </label>
        </div>
      </section>

      <section className="card-panel set-group" aria-labelledby="set-sound">
        <h2 className="panel-title" id="set-sound">
          {t('common.settings.sound')}
        </h2>
        <p className="muted set-intro">{t('common.settings.soundHint')}</p>
        <SoundPanel />
      </section>

      <section className="card-panel set-group" aria-labelledby="set-offline">
        <h2 className="panel-title" id="set-offline">
          {t('common.settings.offline')}
        </h2>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">
              {t('common.settings.offlineMode')} <span className={`set-dot${sw.status === 'ready' ? ' is-on' : ''}`} aria-hidden />
            </span>
            <p className="muted">{offlineText}</p>
          </div>
          <span className={`pill2${online ? '' : ' is-warn'}`}>{online ? t('common.settings.online') : t('common.settings.offlineNow')}</span>
        </div>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">{t('common.settings.downloads')}</span>
            <p className="muted">
              {plural('common.settings.downloadsSaved', m.library.downloads.length)}
              {storage ? t('common.settings.storageUsed', { used: bytes(storage.usage) }) : ''}
              {storage?.quota ? t('common.settings.storageOf', { quota: bytes(storage.quota) }) : ''}.
            </p>
          </div>
          <div className="set-row__control">
            <a className="btn-glass btn-sm" href="#/library/downloads">
              {t('common.action.view')}
            </a>
            <button
              className="btn-glass btn-sm"
              disabled={!m.library.downloads.length}
              onClick={async () => {
                if (!confirm(t('common.settings.removeAllConfirm'))) return;
                await m.removeDownloads(m.library.downloads);
                await clearOffline();
                refresh();
                toast(t('common.settings.removed'));
              }}
            >
              {t('common.settings.removeAll')}
            </button>
          </div>
        </div>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">{t('common.settings.protect')}</span>
            <p className="muted">{t('common.settings.protectHint')}</p>
          </div>
          <div className="set-row__control">
            {storage?.persisted ? (
              <span className="pill2 is-ok">{t('common.settings.protected')}</span>
            ) : (
              <button
                className="btn-glass btn-sm"
                onClick={async () => {
                  const ok = await requestPersistence();
                  refresh();
                  toast(ok ? t('common.settings.protectedToast') : t('common.settings.protectDenied'));
                }}
              >
                {t('common.settings.protectBtn')}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card-panel set-group" aria-labelledby="set-creators">
        <h2 className="panel-title" id="set-creators">
          {t('common.settings.forArtists')}
        </h2>
        <div className="set-row">
          <div className="set-row__text">
            <span className="set-row__title">{t('common.nav.studio')}</span>
            <p className="muted">{t('common.settings.studioHint')}</p>
          </div>
          <div className="set-row__control">
            <a className="btn-glass btn-sm" href="#/studio">
              {t('common.action.open')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
