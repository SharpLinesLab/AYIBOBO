import { useRef, useState, type PointerEvent } from 'react';
import type { Track } from '../../catalog/types';
import { fmtTime, useMusic, usePlayerState, usePosition } from '../../music';
import { seek } from '../../player/engine';
import { t } from '../../i18n';

/**
 * Scrubbable waveform. For the current track it shows progress and seeks on click/drag; for any
 * other track, clicking starts it at that point. Hover shows a time tooltip.
 */
export function Waveform({ track, context, height = 72 }: { track: Track; context?: Track[]; height?: number }) {
  const m = useMusic();
  const s = usePlayerState();
  const { position } = usePosition();
  const isCurrent = s.current?.id === track.id;
  const peaks = m.peaks(track);
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const progress = drag ?? (isCurrent ? position / track.duration : 0);

  const fraction = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const commit = (f: number) => {
    if (isCurrent) seek(f * track.duration);
    else {
      m.toggle(track, context);
      // Seek once the new item has started.
      requestAnimationFrame(() => seek(f * track.duration));
    }
  };
  const comments = (m.library.comments[track.id] ?? []).filter((c) => c.position !== undefined);

  return (
    <div
      className={`wave${isCurrent ? ' is-current' : ''}`}
      ref={ref}
      style={{ height }}
      role="slider"
      tabIndex={0}
      aria-label={t('browse.wave.seek', { title: track.title })}
      aria-valuemin={0}
      aria-valuemax={Math.round(track.duration)}
      aria-valuenow={Math.round(progress * track.duration)}
      aria-valuetext={fmtTime(progress * track.duration)}
      onKeyDown={(e) => {
        if (!isCurrent) return;
        if (e.key === 'ArrowRight') seek(position + 5);
        if (e.key === 'ArrowLeft') seek(position - 5);
      }}
      onPointerMove={(e) => {
        const f = fraction(e);
        setHover(f);
        if (drag !== null) setDrag(f);
      }}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setDrag(fraction(e));
      }}
      onPointerUp={(e) => {
        const f = fraction(e);
        setDrag(null);
        commit(f);
      }}
    >
      <div className="wave__bars">
        {peaks.map((p, i) => {
          const f = i / peaks.length;
          return (
            <span
              key={i}
              className={`${f < progress ? 'is-played' : ''}${hover !== null && f < hover && f >= progress ? ' is-hover' : ''}`}
              style={{ height: `${Math.max(6, p * 100)}%` }}
            />
          );
        })}
      </div>
      {comments.map((c) => (
        <span key={c.id} className="wave__pin" style={{ left: `${(c.position! / track.duration) * 100}%` }} title={`${c.author}: ${c.text}`} />
      ))}
      {hover !== null && (
        <span className="wave__tip" style={{ left: `${hover * 100}%` }}>
          {fmtTime(hover * track.duration)}
        </span>
      )}
      <span className="wave__time wave__time--l num">{fmtTime(progress * track.duration)}</span>
      <span className="wave__time wave__time--r num">{fmtTime(track.duration)}</span>
    </div>
  );
}
