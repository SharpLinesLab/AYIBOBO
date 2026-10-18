import { useMemo, useRef } from 'react';
import { t } from '../i18n';
import { relativeTime, rich, untilUtcMidnight, usd } from '../lib/format';
import { MIN_BID, computeBoard, rankOnBoard } from '../lib/ranking';
import { useApp } from '../store';
import { Thumb } from './Thumb';
import { togglePreview } from '../lib/audio';
import type { Listing } from '../lib/types';
import { PauseIcon, PlayIcon } from './icons';
import { usePlayer } from './PreviewButton';

function MiniPlay({ listing }: { listing: Listing }) {
  const player = usePlayer(listing.id);
  if (!listing.preview) return <span />;
  const playing = player.playingId === listing.id;
  return (
    <button
      className={`mini-play${playing ? ' is-playing' : ''}`}
      aria-label={playing ? t('common.action.pauseName', { name: listing.title }) : t('boost.preview.playShort', { title: listing.title })}
      onClick={() => togglePreview(listing)}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

export function TodayWidget() {
  const { boards, now, setBoard, openDetail, navigate } = useApp();
  const top = boards.today.slice(0, 3);
  return (
    <section className="widget" aria-labelledby="today-title">
      <div className="widget__head">
        <h3 id="today-title">{t('boost.today.title')}</h3>
        <button
          className="link-btn link-btn--accent"
          onClick={() => {
            navigate('#/leaderboard');
            setBoard('today');
            window.setTimeout(() => document.getElementById('board')?.scrollIntoView({ behavior: 'smooth' }), 50);
          }}
        >
          {t('boost.today.seeAll')}
        </button>
      </div>
      {top.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          {rich(t('boost.today.empty'), { amount: <span className="num">{usd(MIN_BID)}</span> })}
        </p>
      ) : (
        <ol className="mini-list">
          {top.map((e) => (
            <li key={e.listing.id} className="mini-row-wrap">
              <button className="mini-row" onClick={() => openDetail(e.listing.id)}>
                <span className="mini-row__rank">#{e.rank}</span>
                <Thumb art={e.listing.artwork} size="sm" />
                <span className="mini-row__title">
                  {e.listing.title}
                  <span className="mini-row__sub">{e.listing.display}</span>
                </span>
                <span className="mini-row__amt">{usd(e.total)}</span>
              </button>
              <MiniPlay listing={e.listing} />
            </li>
          ))}
        </ol>
      )}
      <p className="hero__fine" style={{ marginTop: 10 }}>
        {rich(t('boost.today.resets'), { time: <span className="num">{untilUtcMidnight(now)}</span> })}
      </p>
    </section>
  );
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const { snapshot, now, openDetail } = useApp();
  const seen = useRef(new Set<string>());
  const first = useRef(true);

  const items = useMemo(() => {
    const { state } = snapshot;
    const byId = new Map(state.listings.map((l) => [l.id, l]));
    const ordered = state.payments.map((p, i) => ({ p, i })).sort((a, b) => b.p.at - a.p.at || b.i - a.i);
    return ordered.slice(0, limit).map(({ p, i }) => {
      const before = state.payments.filter((q, j) => q.at < p.at || (q.at === p.at && j < i));
      const after = [...before, p];
      const rankAfter = rankOnBoard(computeBoard({ listings: state.listings, payments: after }), p.listingId);
      const rankBefore = rankOnBoard(computeBoard({ listings: state.listings, payments: before }), p.listingId);
      return { payment: p, listing: byId.get(p.listingId)!, rankAfter, jump: rankBefore && rankAfter ? rankBefore - rankAfter : 0, isNew: !rankBefore };
    });
  }, [snapshot, limit]);

  const fresh = new Set<string>();
  for (const it of items) {
    if (!seen.current.has(it.payment.id)) {
      if (!first.current) fresh.add(it.payment.id);
      seen.current.add(it.payment.id);
    }
  }
  first.current = false;

  return (
    <section className="widget" aria-labelledby="activity-title">
      <div className="widget__head">
        <h3 id="activity-title">{t('boost.activity.title')}</h3>
        <small>
          <span className="live-dot" style={{ display: 'inline-block', marginRight: 6 }} />
          {t('boost.activity.live')}
        </small>
      </div>
      <ul className="feed" aria-live="polite">
        {items.map(({ payment, listing, rankAfter, jump, isNew }) => (
          <li key={payment.id} className={fresh.has(payment.id) ? 'is-new' : ''}>
            <Thumb art={listing.artwork} size="sm" />
            <div style={{ minWidth: 0 }}>
              <button className="feed__title" onClick={() => openDetail(listing.id)}>
                {listing.title}
              </button>
              {listing.tagline && <span className="muted"> — {listing.tagline}</span>}
              <div className="feed__meta">
                {rich(t(isNew ? 'boost.activity.joined' : 'boost.activity.at'), { rank: <b>#{rankAfter}</b> })} · <b>{usd(payment.amount)}</b> · {relativeTime(payment.at, now)}
                {jump > 0 && <span className="jump">↑{jump}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
