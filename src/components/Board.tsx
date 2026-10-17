import { useLayoutEffect, useRef } from 'react';
import { useApp } from '../store';
import type { RankedEntry } from '../lib/types';
import { ListingCard } from './ListingCard';

/**
 * Ranked list with FLIP animation: when ranks change, cards glide from their old position to
 * the new one instead of jumping.
 */
export function Board({ entries, allEntries, highlightId }: { entries: RankedEntry[]; allEntries: RankedEntry[]; highlightId: string | null }) {
  const nodes = useRef(new Map<string, HTMLLIElement>());
  const prevTops = useRef(new Map<string, number>());
  const { highlightFrom } = useApp();

  // After a claim, replay the climb from the listing's old rank (or from the bottom when new).
  useLayoutEffect(() => {
    if (!highlightId) return;
    const el = nodes.current.get(highlightId);
    const idx = entries.findIndex((e) => e.listing.id === highlightId);
    if (!el || idx < 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const fromIdx = highlightFrom ? highlightFrom - 1 : entries.length;
    const dy = Math.max(-700, Math.min(700, (fromIdx - idx) * (el.offsetHeight + 10)));
    if (Math.abs(dy) < 2) return;
    el.style.zIndex = '5';
    const anim = el.animate([{ transform: `translateY(${dy}px) scale(0.98)`, opacity: 0.6 }, { transform: 'none', opacity: 1 }], {
      duration: 1000,
      delay: 450,
      easing: 'cubic-bezier(.2,.9,.3,1)',
      fill: 'backwards',
    });
    anim.onfinish = () => (el.style.zIndex = '');
  }, [highlightId]);

  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, number>();
    nodes.current.forEach((el, id) => {
      const top = el.offsetTop;
      next.set(id, top);
      const prev = prevTops.current.get(id);
      if (reduce) return;
      if (prev === undefined) {
        if (prevTops.current.size > 0 && id === highlightId) {
          el.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)' });
        }
        return;
      }
      const dy = prev - top;
      if (Math.abs(dy) > 1) {
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
          duration: Math.min(900, 380 + Math.abs(dy) * 0.25),
          easing: 'cubic-bezier(.2,.9,.3,1)',
        });
      }
    });
    prevTops.current = next;
  });

  return (
    <ol className="board" aria-label="Leaderboard">
      {entries.map((e) => (
        <ListingCard
          key={e.listing.id}
          entry={e}
          entries={allEntries}
          highlight={e.listing.id === highlightId}
          ref={(el) => {
            if (el) nodes.current.set(e.listing.id, el);
            else nodes.current.delete(e.listing.id);
          }}
        />
      ))}
    </ol>
  );
}
