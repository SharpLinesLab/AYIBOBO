import { Suspense, lazy, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

// The queue (drag-to-reorder) and full-screen player load on demand, with the motion library.
const QueueList = lazy(() => import('./Queue').then((m) => ({ default: m.QueueList })));
import { t } from '../../i18n';
import { compact, fmtTime, useMusic, usePlayerState, usePosition } from '../../music';
import {
  cycleRepeat,
  getAnalyser,
  jumpTo,
  next,
  prev,
  seek,
  setSleepTimer,
  setVolume,
  toggle,
  toggleMute,
  toggleShuffle,
} from '../../player/engine';
import { CloseIcon, ExpandIcon, MoonSleepIcon, MuteIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, QueueIcon, RepeatIcon, ShuffleIcon, VolumeIcon } from '../icons';
import { Cover, LikeButton } from '../music/bits';
import { useArtPalette } from '../../catalog/color';
import type { CoverSpec } from '../../catalog/types';
import { LyricsView, hasLyrics } from '../music/Lyrics';
import { SoundButton } from '../music/SoundPanel';

export type NpTab = 'wave' | 'lyrics' | 'queue';

/** Thin seek bar used in the player bar. */
export function SeekBar() {
  const { position, duration } = usePosition();
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const f = drag ?? (duration ? position / duration : 0);
  const at = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  return (
    <div className="seek">
      <span className="num seek__t">{fmtTime(f * duration)}</span>
      <div
        className="seek__track"
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={t('player.seek')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(f * duration)}
        aria-valuetext={fmtTime(f * duration)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(position + 5);
          if (e.key === 'ArrowLeft') seek(position - 5);
        }}
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          setDrag(at(e));
        }}
        onPointerMove={(e) => drag !== null && setDrag(at(e))}
        onPointerUp={(e) => {
          seek(at(e) * duration);
          setDrag(null);
        }}
      >
        <span className="seek__fill" style={{ width: `${f * 100}%` }} />
        <span className="seek__knob" style={{ left: `${f * 100}%` }} />
      </div>
      <span className="num seek__t">{fmtTime(duration)}</span>
    </div>
  );
}

export function Transport({ big }: { big?: boolean }) {
  const s = usePlayerState();
  return (
    <div className={`transport${big ? ' transport--big' : ''}`}>
      <button className={`tbtn${s.shuffle ? ' is-on' : ''}`} onClick={toggleShuffle} aria-label={t('common.action.shuffle')} aria-pressed={s.shuffle}>
        <ShuffleIcon />
      </button>
      <button className="tbtn" onClick={prev} aria-label={t('common.action.previous')}>
        <PrevIcon />
      </button>
      <button className="tbtn tbtn--main" onClick={toggle} aria-label={t(s.playing ? 'common.action.pause' : 'common.action.play')} disabled={!s.current}>
        {s.loading ? <span className="spinner" /> : s.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button className="tbtn" onClick={() => next()} aria-label={t('common.action.next')}>
        <NextIcon />
      </button>
      <button className={`tbtn${s.repeat !== 'off' ? ' is-on' : ''}`} onClick={cycleRepeat} aria-label={t(`player.repeat.${s.repeat}`)}>
        <RepeatIcon />
        {s.repeat === 'one' && <span className="tbtn__one">1</span>}
      </button>
    </div>
  );
}

export function VolumeControl() {
  const s = usePlayerState();
  const v = s.muted ? 0 : s.volume;
  return (
    <div className="vol">
      <button className="tbtn" onClick={toggleMute} aria-label={t(s.muted ? 'player.unmute' : 'player.mute')}>
        {v === 0 ? <MuteIcon /> : <VolumeIcon />}
      </button>
      <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => setVolume(Number(e.target.value))} aria-label={t('player.volume')} style={{ ['--v' as string]: `${v * 100}%` }} />
    </div>
  );
}

export function SleepTimer() {
  const s = usePlayerState();
  const [open, setOpen] = useState(false);
  const left = s.sleepAt ? Math.max(1, Math.round((s.sleepAt - Date.now()) / 60_000)) : null;
  return (
    <div className="sleep">
      <button className={`tbtn${s.sleepAt ? ' is-on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={t('player.sleep.label')} aria-expanded={open}>
        <MoonSleepIcon />
        {left && <span className="tbtn__badge">{t('player.sleep.badge', { n: left })}</span>}
      </button>
      {open && (
        <div className="sleep__menu" role="menu">
          {[15, 30, 45, 60].map((m) => (
            <button key={m} role="menuitem" onClick={() => (setSleepTimer(m), setOpen(false))}>
              {t('player.sleep.minutes', { n: m })}
            </button>
          ))}
          {s.sleepAt && (
            <button role="menuitem" onClick={() => (setSleepTimer(null), setOpen(false))}>
              {t('player.sleep.off')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Frequency bars drawn from the master analyser. */
export function Visualizer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const data = new Uint8Array(128);
    const draw = () => {
      const an = getAnalyser();
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth * dpr;
      const h = c.clientHeight * dpr;
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      if (an) an.getByteFrequencyData(data);
      const bars = 64;
      const gap = 3 * dpr;
      const bw = (w - gap * (bars - 1)) / bars;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ed573';
      for (let i = 0; i < bars; i++) {
        const v = an ? data[Math.floor((i / bars) * 96)] / 255 : 0;
        const bh = Math.max(2 * dpr, v * h);
        ctx.globalAlpha = 0.35 + v * 0.65;
        ctx.fillStyle = accent;
        const x = i * (bw + gap);
        ctx.beginPath();
        ctx.roundRect(x, h - bh, bw, bh, Math.min(bw / 2, 4 * dpr));
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas className="viz" ref={canvas} aria-hidden />;
}

/** Apple Music-style living backdrop: slow-drifting blobs in the artwork's colours. */
export function MeshBackdrop({ spec }: { spec?: CoverSpec }) {
  const [a, b, c] = useArtPalette(spec);
  return (
    <div className="mesh" aria-hidden style={{ ['--m1' as string]: a, ['--m2' as string]: b, ['--m3' as string]: c }}>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

const PANEL_KEY = 'asf:np-panel';

export function usePanelOpen(): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(PANEL_KEY);
      return v === null ? window.innerWidth >= 1440 : v === '1';
    } catch {
      return false;
    }
  });
  return [
    open,
    (v: boolean) => {
      setOpen(v);
      try {
        localStorage.setItem(PANEL_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
  ];
}

/** Spotify-style "Now playing" side panel: artwork, artist card, next up. Wide screens only. */
export function NowPlayingPanel({ onClose, onLyrics }: { onClose: () => void; onLyrics: () => void }) {
  const s = usePlayerState();
  const m = useMusic();
  const cur = s.current;
  if (!cur) return null;
  const track = m.track(cur.id);
  const artist = track ? m.artist(track.artistId) : undefined;
  const next = s.queue[s.index + 1];
  const following = artist ? m.library.follows.includes(artist.id) : false;
  return (
    <aside className="npp" aria-label={t('player.nowPlaying')}>
      <header className="npp__head">
        <a href={cur.href} className="npp__ctx">
          {track?.albumId ? m.album(track.albumId)?.title : t('player.nowPlaying')}
        </a>
        <button className="icon-toggle" onClick={onClose} aria-label={t('player.panel.hide')}>
          <CloseIcon width={16} height={16} />
        </button>
      </header>
      <div className="npp__art">{cur.artwork && <img src={cur.artwork} alt="" />}</div>
      <div className="npp__titles">
        <div>
          <a href={cur.href} className="npp__title">
            {cur.title}
          </a>
          <a href={cur.subtitleHref} className="npp__sub">
            {cur.subtitle}
          </a>
        </div>
        {track && <LikeButton id={track.id} />}
      </div>
      {track && hasLyrics(track) && (
        <section className="npp__lyrics">
          <div className="npp__next-head">
            <b>{t('player.lyrics')}</b>
            <button className="link-btn" onClick={onLyrics}>
              {t('player.panel.showLyrics')}
            </button>
          </div>
          <LyricsView track={track} variant="card" />
        </section>
      )}
      {artist && (
        <section className="npp__artist">
          <div className="npp__artist-img">
            <Cover spec={artist.poster} />
            <span>{t('player.panel.aboutArtist')}</span>
          </div>
          <div className="npp__artist-body">
            <a href={`#/artist/${artist.id}`} className="npp__artist-name">
              {artist.name}
            </a>
            <div className="npp__artist-row">
              <span className="muted">{t('player.panel.followers', { n: compact(m.followerCount(artist)) })}</span>
              <button className={`follow-btn${following ? ' is-on' : ''}`} onClick={() => m.toggleFollow(artist.id)}>
                {t(following ? 'common.action.following' : 'common.action.follow')}
              </button>
            </div>
            <p>{artist.bio}</p>
          </div>
        </section>
      )}
      {next && (
        <section className="npp__next">
          <div className="npp__next-head">
            <b>{t('player.panel.nextInQueue')}</b>
          </div>
          <button className="qrow__main" onClick={() => jumpTo(next.id)}>
            {next.artwork && <img src={next.artwork} alt="" width={40} height={40} />}
            <span>
              <b>{next.title}</b>
              <small>{next.subtitle}</small>
            </span>
          </button>
        </section>
      )}
    </aside>
  );
}

export function PlayerBar({
  onExpand,
  onLyrics,
  panelOpen,
  onTogglePanel,
}: {
  onExpand: () => void;
  onLyrics: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const s = usePlayerState();
  const m = useMusic();
  const [queueOpen, setQueueOpen] = useState(false);
  const cur = s.current;
  if (!cur) return null;
  const track = m.track(cur.id);
  return (
    <div className="pbar" role="region" aria-label={t('player.region')}>
      <div className="pbar__mobile-progress">
        <MobileProgress />
      </div>
      <div className="pbar__now">
        <button className="pbar__art" onClick={onExpand} aria-label={t('player.openNowPlaying')}>
          {cur.artwork && <img src={cur.artwork} alt="" />}
          <span className="pbar__expand">
            <ExpandIcon />
          </span>
        </button>
        <div className="pbar__titles">
          <a href={cur.href} className="pbar__title">
            {cur.title}
          </a>
          <a href={cur.subtitleHref} className="pbar__sub">
            {cur.subtitle}
          </a>
        </div>
        {track && <LikeButton id={track.id} />}
      </div>
      <div className="pbar__center">
        <Transport />
        <SeekBar />
      </div>
      <div className="pbar__right">
        <button className="tbtn" onClick={onLyrics} aria-label={t('player.lyrics')} disabled={!track || !hasLyrics(track)}>
          <MicIcon />
        </button>
        <SoundButton />
        <SleepTimer />
        <button className={`tbtn${queueOpen ? ' is-on' : ''}`} onClick={() => setQueueOpen((o) => !o)} aria-label={t('player.queue')} aria-expanded={queueOpen}>
          <QueueIcon />
        </button>
        <button className={`tbtn npp-toggle${panelOpen ? ' is-on' : ''}`} onClick={onTogglePanel} aria-label={t('player.nowPlayingView')} aria-pressed={panelOpen}>
          <PanelIcon />
        </button>
        <VolumeControl />
        <button className="tbtn" onClick={onExpand} aria-label={t('player.fullScreen')}>
          <ExpandIcon />
        </button>
      </div>
      <button className="pbar__mobile-toggle tbtn tbtn--main" onClick={toggle} aria-label={t(s.playing ? 'common.action.pause' : 'common.action.play')}>
        {s.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      {queueOpen && (
        <div className="pbar__queue">
          <Suspense fallback={null}>
            <QueueList />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function MobileProgress() {
  const { position, duration } = usePosition();
  return <span style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} />;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M15 4v16" />
    </svg>
  );
}
