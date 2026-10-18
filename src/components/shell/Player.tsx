import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { fmtTime, useMusic, usePlayerState, usePosition } from '../../music';
import {
  cycleRepeat,
  getAnalyser,
  jumpTo,
  next,
  prev,
  removeFromQueue,
  seek,
  setSleepTimer,
  setVolume,
  toggle,
  toggleMute,
  toggleShuffle,
  type Playable,
} from '../../player/engine';
import { CloseIcon, CollapseIcon, ExpandIcon, MoonSleepIcon, MuteIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, QueueIcon, RepeatIcon, ShuffleIcon, VolumeIcon } from '../icons';
import { Eq, LikeButton } from '../music/bits';
import { Waveform } from '../music/Waveform';

/** Thin seek bar used in the player bar. */
function SeekBar() {
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
        aria-label="Seek"
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

function Transport({ big }: { big?: boolean }) {
  const s = usePlayerState();
  return (
    <div className={`transport${big ? ' transport--big' : ''}`}>
      <button className={`tbtn${s.shuffle ? ' is-on' : ''}`} onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={s.shuffle}>
        <ShuffleIcon />
      </button>
      <button className="tbtn" onClick={prev} aria-label="Previous">
        <PrevIcon />
      </button>
      <button className="tbtn tbtn--main" onClick={toggle} aria-label={s.playing ? 'Pause' : 'Play'} disabled={!s.current}>
        {s.loading ? <span className="spinner" /> : s.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button className="tbtn" onClick={() => next()} aria-label="Next">
        <NextIcon />
      </button>
      <button className={`tbtn${s.repeat !== 'off' ? ' is-on' : ''}`} onClick={cycleRepeat} aria-label={`Repeat: ${s.repeat}`}>
        <RepeatIcon />
        {s.repeat === 'one' && <span className="tbtn__one">1</span>}
      </button>
    </div>
  );
}

function VolumeControl() {
  const s = usePlayerState();
  const v = s.muted ? 0 : s.volume;
  return (
    <div className="vol">
      <button className="tbtn" onClick={toggleMute} aria-label={s.muted ? 'Unmute' : 'Mute'}>
        {v === 0 ? <MuteIcon /> : <VolumeIcon />}
      </button>
      <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" style={{ ['--v' as string]: `${v * 100}%` }} />
    </div>
  );
}

function SleepTimer() {
  const s = usePlayerState();
  const [open, setOpen] = useState(false);
  const left = s.sleepAt ? Math.max(1, Math.round((s.sleepAt - Date.now()) / 60_000)) : null;
  return (
    <div className="sleep">
      <button className={`tbtn${s.sleepAt ? ' is-on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label="Sleep timer" aria-expanded={open}>
        <MoonSleepIcon />
        {left && <span className="tbtn__badge">{left}m</span>}
      </button>
      {open && (
        <div className="sleep__menu" role="menu">
          {[15, 30, 45, 60].map((m) => (
            <button key={m} role="menuitem" onClick={() => (setSleepTimer(m), setOpen(false))}>
              {m} minutes
            </button>
          ))}
          {s.sleepAt && (
            <button role="menuitem" onClick={() => (setSleepTimer(null), setOpen(false))}>
              Turn off
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QueueList({ onPick }: { onPick?: () => void }) {
  const s = usePlayerState();
  const upNext = s.queue.slice(s.index + 1);
  const row = (p: Playable, current: boolean) => (
    <li key={p.id} className={`qrow${current ? ' is-current' : ''}`}>
      <button className="qrow__main" onClick={() => (jumpTo(p.id), onPick?.())}>
        {p.artwork && <img src={p.artwork} alt="" width={40} height={40} />}
        <span>
          <b>{p.title}</b>
          <small>{p.subtitle}</small>
        </span>
        {current && <Eq paused={!s.playing} />}
      </button>
      {!current && (
        <button className="icon-toggle" onClick={() => removeFromQueue(p.id)} aria-label={`Remove ${p.title} from queue`}>
          <CloseIcon width={16} height={16} />
        </button>
      )}
    </li>
  );
  return (
    <div className="queue">
      {s.current && (
        <>
          <h4>Now playing</h4>
          <ul>{row(s.current, true)}</ul>
        </>
      )}
      <h4>Up next {upNext.length > 0 && <span className="muted">· {upNext.length}</span>}</h4>
      {upNext.length ? <ul>{upNext.map((p) => row(p, false))}</ul> : <p className="muted queue__empty">Nothing queued. Use “⋯ → Add to queue” on any song.</p>}
    </div>
  );
}

/** Frequency bars drawn from the master analyser. */
function Visualizer() {
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

export function NowPlaying({ onClose }: { onClose: () => void }) {
  const s = usePlayerState();
  const m = useMusic();
  const cur = s.current;
  const track = cur ? m.track(cur.id) : undefined;
  const [tab, setTab] = useState<'wave' | 'queue'>('wave');
  const closeBtn = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    // Modal behaviour: focus inside on open, trap Tab, Escape closes, focus returns on close.
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      const f = [...dialog.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  if (!cur) return null;
  return (
    <div className="np" role="dialog" aria-modal="true" aria-label="Now playing" ref={dialog}>
      <div className="np__bg" style={{ backgroundImage: cur.artwork ? `url("${cur.artwork}")` : undefined }} />
      <div className="np__inner">
        <header className="np__head">
          <button className="round-btn" onClick={onClose} aria-label="Close now playing" ref={closeBtn}>
            <CollapseIcon />
          </button>
          <span className="np__label">Now playing</span>
          <div className="segmented np__tabs">
            <button className={tab === 'wave' ? 'is-active' : ''} onClick={() => setTab('wave')}>
              Player
            </button>
            <button className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}>
              Queue
            </button>
          </div>
        </header>
        <div className="np__body">
          <div className={`np__art${s.playing ? ' is-playing' : ''}`}>
            {cur.artwork && <img src={cur.artwork} alt="" />}
          </div>
          <div className="np__side">
            {tab === 'wave' ? (
              <>
                <div className="np__titles">
                  <a href={cur.href} onClick={onClose}>
                    <h2>{cur.title}</h2>
                  </a>
                  <a href={cur.subtitleHref} onClick={onClose} className="np__artist">
                    {cur.subtitle}
                  </a>
                </div>
                <Visualizer />
                {track ? <Waveform track={track} height={84} /> : <SeekBar />}
                <div className="np__controls">
                  {track && <LikeButton id={track.id} />}
                  <Transport big />
                  <SleepTimer />
                </div>
                <VolumeControl />
              </>
            ) : (
              <QueueList />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerBar({ onExpand }: { onExpand: () => void }) {
  const s = usePlayerState();
  const m = useMusic();
  const [queueOpen, setQueueOpen] = useState(false);
  const cur = s.current;
  if (!cur) return null;
  const track = m.track(cur.id);
  return (
    <div className="pbar" role="region" aria-label="Player">
      <div className="pbar__mobile-progress">
        <MobileProgress />
      </div>
      <div className="pbar__now">
        <button className="pbar__art" onClick={onExpand} aria-label="Open now playing">
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
        <SleepTimer />
        <button className={`tbtn${queueOpen ? ' is-on' : ''}`} onClick={() => setQueueOpen((o) => !o)} aria-label="Queue" aria-expanded={queueOpen}>
          <QueueIcon />
        </button>
        <VolumeControl />
        <button className="tbtn" onClick={onExpand} aria-label="Full screen player">
          <ExpandIcon />
        </button>
      </div>
      <button className="pbar__mobile-toggle tbtn tbtn--main" onClick={toggle} aria-label={s.playing ? 'Pause' : 'Play'}>
        {s.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      {queueOpen && (
        <div className="pbar__queue">
          <QueueList onPick={() => undefined} />
        </div>
      )}
    </div>
  );
}

function MobileProgress() {
  const { position, duration } = usePosition();
  return <span style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} />;
}
