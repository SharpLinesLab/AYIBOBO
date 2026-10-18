import { motion, useDragControls } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useMusic, usePlayerState } from '../../music';
import { CollapseIcon } from '../icons';
import { LikeButton } from '../music/bits';
import { LyricsView } from '../music/Lyrics';
import { SoundButton } from '../music/SoundPanel';
import { Waveform } from '../music/Waveform';
import { MeshBackdrop, SeekBar, SleepTimer, Transport, Visualizer, VolumeControl, type NpTab } from './Player';
import { QueueList } from './Queue';

export function NowPlaying({ onClose, initialTab = 'wave' }: { onClose: () => void; initialTab?: NpTab }) {
  const s = usePlayerState();
  const m = useMusic();
  const cur = s.current;
  const track = cur ? m.track(cur.id) : undefined;
  const [tab, setTab] = useState<NpTab>(initialTab);
  const drag = useDragControls();
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
    <motion.div
      className={`np np--${tab}`}
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      ref={dialog}
      // Swipe down from the header (or the grab bar) to close, like a native player sheet.
      drag="y"
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 140 || info.velocity.y > 700) onClose();
      }}
    >
      <MeshBackdrop spec={track?.cover} />
      <div className="np__inner">
        <span className="np__grab" aria-hidden onPointerDown={(e) => drag.start(e)} />
        <header className="np__head" onPointerDown={(e) => !(e.target as HTMLElement).closest('button,a') && drag.start(e)}>
          <button className="round-btn" onClick={onClose} aria-label="Close now playing" ref={closeBtn}>
            <CollapseIcon />
          </button>
          <span className="np__label">Now playing</span>
          <div className="segmented np__tabs">
            <button className={tab === 'wave' ? 'is-active' : ''} onClick={() => setTab('wave')}>
              Player
            </button>
            <button className={tab === 'lyrics' ? 'is-active' : ''} onClick={() => setTab('lyrics')}>
              Lyrics
            </button>
            <button className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}>
              Queue
            </button>
          </div>
        </header>
        <div className="np__body">
          <div className={`np__art${s.playing ? ' is-playing' : ''}`} onPointerDown={(e) => drag.start(e)}>
            {cur.artwork && <img src={cur.artwork} alt="" draggable={false} />}
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
                  <div className="np__extras">
                    <SoundButton />
                    <SleepTimer />
                  </div>
                </div>
                <VolumeControl />
              </>
            ) : tab === 'lyrics' ? (
              <>
                <div className="np__titles np__titles--sm">
                  <h2>{cur.title}</h2>
                  <span className="np__artist">{cur.subtitle}</span>
                </div>
                {track ? <LyricsView track={track} variant="full" /> : <p className="muted">No lyrics for previews.</p>}
                <SeekBar />
                <div className="np__controls">
                  {track && <LikeButton id={track.id} />}
                  <Transport />
                  <SleepTimer />
                </div>
              </>
            ) : (
              <QueueList />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

