import { useEffect, useRef, useState, type ReactNode } from 'react';
import { generatedCoverUrl } from '../../catalog/covers';
import type { CoverSpec, Track } from '../../catalog/types';
import { useMusic, usePlayerState } from '../../music';
import { pause, resume } from '../../player/engine';
import { t } from '../../i18n';
import { ChevronLeft, ChevronRight, PauseIcon, PlayIcon } from '../icons';

export function Cover({ spec, size, round, className = '', alt = '' }: { spec: CoverSpec; size?: number; round?: boolean; className?: string; alt?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = spec.imageUrl && failed !== spec.imageUrl ? spec.imageUrl : generatedCoverUrl(spec);
  return (
    <img
      className={`cover${round ? ' cover--round' : ''}${spec.imageUrl && failed !== spec.imageUrl ? ' cover--photo' : ''} ${className}`}
      src={src}
      onError={() => spec.imageUrl && setFailed(spec.imageUrl)}
      alt={alt}
      width={size}
      height={size}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

/** Animated "now playing" bars. */
export function Eq({ paused }: { paused?: boolean }) {
  return (
    <span className={`np-eq${paused ? ' is-paused' : ''}`} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** True when the player's current item is one of `ids`. */
export function useIsCurrent(ids: string[]): { current: boolean; playing: boolean } {
  const s = usePlayerState();
  const current = !!s.current && ids.includes(s.current.id);
  return { current, playing: current && s.playing };
}

/** Big round play button for a track or a collection of tracks. */
export function PlayAll({ tracks, size = 'lg', label }: { tracks: Track[]; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const { play } = useMusic();
  const ids = tracks.map((t) => t.id);
  const { current, playing } = useIsCurrent(ids);
  const s = usePlayerState();
  return (
    <button
      type="button"
      className={`play-btn play-btn--${size}${playing ? ' is-playing' : ''}`}
      aria-label={playing ? t('common.action.pause') : label ?? t('common.action.play')}
      disabled={!tracks.length}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (current) (s.playing ? pause : resume)();
        else play(tracks, 0);
      }}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

export function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.7 1.2-1.6 2.8-2.7 4.8-2.7 3.6 0 5.8 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
    </svg>
  );
}

export function RepostIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}

export function LikeButton({ id, withLabel }: { id: string; withLabel?: boolean }) {
  const { isLiked, toggleLike } = useMusic();
  const liked = isLiked(id);
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      className={`icon-toggle${liked ? ' is-on' : ''}${withLabel ? ' icon-toggle--label' : ''}`}
      aria-pressed={liked}
      aria-label={liked ? t('browse.unlike') : t('common.action.like')}
      onClick={(e) => {
        e.stopPropagation();
        toggleLike(id);
        if (!liked) setPop((p) => p + 1);
      }}
    >
      <span key={pop} className={pop ? 'heart-pop' : ''}>
        <HeartIcon filled={liked} />
      </span>
      {withLabel && <span>{liked ? t('common.action.liked') : t('common.action.like')}</span>}
    </button>
  );
}

/** Checkmark for verified artists. */
export function Verified() {
  return (
    <svg className="verified" viewBox="0 0 24 24" width="15" height="15" aria-label={t('common.word.verified')} role="img">
      <path
        fill="currentColor"
        d="M12 1.5l2.4 1.8 3-.2.9 2.9 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-.9 2.9-3-.2L12 22.5l-2.4-1.8-3 .2-.9-2.9-2.5-1.7.9-2.9-.9-2.9 2.5-1.7.9-2.9 3 .2z"
      />
      <path d="M8 12.2l2.6 2.6L16.2 9" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExplicitBadge() {
  return (
    <span className="explicit" title={t('common.word.explicit')} aria-label={t('common.word.explicit')}>
      E
    </span>
  );
}

/** Horizontal, swipeable shelf with a header and arrow buttons. */
export function Shelf({ title, subtitle, href, children }: { title: string; subtitle?: string; href?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current;
    if (el) setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: 'smooth' });
  return (
    <section className="shelf">
      <header className="shelf__head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="shelf__nav">
          {href && (
            <a className="shelf__all" href={href}>
              {t('common.action.viewAll')}
            </a>
          )}
          <button className="round-btn" disabled={edges.start} onClick={() => page(-1)} aria-label={t('browse.shelf.scrollLeft', { title })}>
            <ChevronLeft />
          </button>
          <button className="round-btn" disabled={edges.end} onClick={() => page(1)} aria-label={t('browse.shelf.scrollRight', { title })}>
            <ChevronRight />
          </button>
        </div>
      </header>
      <div className="shelf__track" ref={ref} onScroll={update} role="list">
        {children}
      </div>
    </section>
  );
}
