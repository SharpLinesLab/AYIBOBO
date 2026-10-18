import { useEffect, useRef, useState } from 'react';
import { togglePreview } from '../lib/audio';
import { t } from '../i18n';
import { categoryLabel } from '../lib/categories';
import { rich, usd } from '../lib/format';
import { minBidForRank } from '../lib/ranking';
import type { Listing } from '../lib/types';
import { useApp } from '../store';
import { PauseIcon, PlayIcon, ShareIcon } from './icons';
import { usePlayer } from './PreviewButton';

const INTERVAL = 6500;

/** Featured banner: the top 3 of the active board, fading between slides; auto-plays, swipeable. */
export function FeaturedCarousel() {
  const { boards, board, openDetail, prefillHero, toast, backend } = useApp();
  const entries = (boards[board].length ? boards[board] : boards.all).slice(0, 3);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const player = usePlayer();
  const drag = useRef<{ x: number; id: number } | null>(null);
  const count = entries.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const playingHere = entries.some((e) => e.listing.id === player.playingId);

  useEffect(() => {
    if (paused || playingHere || count < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL);
    return () => clearTimeout(timer);
  }, [index, paused, playingHere, count]);

  if (!count) return null;
  const go = (i: number) => setIndex(((i % count) + count) % count);

  const share = async (l: Listing) => {
    const data = { title: t('boost.featured.shareTitle', { title: l.title }), text: l.tagline, url: l.url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(l.url);
      toast(t('boost.featured.copied'));
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <section
      className="featured"
      aria-roledescription="carousel"
      aria-label={t('boost.featured.label')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(current + 1);
        if (e.key === 'ArrowLeft') go(current - 1);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') drag.current = { x: e.clientX, id: e.pointerId };
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (d && Math.abs(e.clientX - d.x) > 40) go(current + (e.clientX < d.x ? 1 : -1));
      }}
    >
      {entries.map((e, i) => {
        const l = e.listing;
        const active = i === current;
        const playing = player.playingId === l.id;
        return (
          <article
            key={l.id}
            className={`featured__slide${active ? ' is-active' : ''}`}
            aria-hidden={!active}
            aria-roledescription="slide"
            aria-label={t('boost.featured.slide', { i: i + 1, n: count })}
            style={{ ['--art-from' as string]: l.artwork.from, ['--art-to' as string]: l.artwork.to }}
          >
            <div className="featured__art" aria-hidden>
              <span>{l.artwork.glyph}</span>
            </div>
            <div className="featured__body">
              <span className="featured__kicker">
                {t(board === 'all' ? 'boost.featured.kickerAll' : 'boost.featured.kickerToday', { rank: e.rank, category: categoryLabel(l.category) })}
              </span>
              <h2 className="featured__title">{l.title}</h2>
              <p className="featured__desc">{l.tagline || l.description}</p>
              <div className="featured__actions">
                {l.preview && (
                  <button className="btn-watch" tabIndex={active ? 0 : -1} onClick={() => togglePreview(l)}>
                    {playing ? <PauseIcon width={12} height={12} /> : <PlayIcon width={12} height={12} />}
                    {playing ? t('common.action.pause') : t('boost.featured.playPreview')}
                  </button>
                )}
                <button className="btn-ghost" tabIndex={active ? 0 : -1} onClick={() => share(l)}>
                  <ShareIcon width={15} height={15} /> {t('common.action.share')}
                </button>
                <a
                  className="btn-ghost"
                  tabIndex={active ? 0 : -1}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  onClick={() => backend.click(l.id)}
                >
                  {t('boost.featured.visit')} ↗
                </a>
              </div>
              <div className="featured__meta">
                <span className="featured__amount num">{usd(e.total)}</span>
                <button className="link-btn" tabIndex={active ? 0 : -1} onClick={() => openDetail(l.id)}>
                  {t('boost.card.details')}
                </button>
                <button className="link-btn link-btn--accent" tabIndex={active ? 0 : -1} onClick={() => prefillHero({ amount: minBidForRank(boards[board], e.rank) })}>
                  {rich(t('boost.featured.take', { rank: e.rank }), { amount: <span className="num">{usd(minBidForRank(boards[board], e.rank))}</span> })}
                </button>
              </div>
            </div>
          </article>
        );
      })}
      {count > 1 && (
        <div className="featured__dots" role="tablist" aria-label={t('boost.featured.choose')}>
          {entries.map((e, i) => (
            <button
              key={e.listing.id}
              role="tab"
              aria-selected={i === current}
              aria-label={t('boost.featured.show', { rank: e.rank, title: e.listing.title })}
              className={i === current ? 'is-active' : ''}
              onClick={() => go(i)}
            >
              {i === current && !paused && !playingHere && <span className="featured__dot-fill" key={index} style={{ animationDuration: `${INTERVAL}ms` }} />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
