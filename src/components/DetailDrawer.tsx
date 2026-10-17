import { useMemo } from 'react';
import { categoryById } from '../lib/categories';
import { num, relativeTime, usd } from '../lib/format';
import { minBidForRank, totalOnBoard } from '../lib/ranking';
import { listingClickSeries } from '../lib/stats';
import { useApp } from '../store';
import { BarChart } from './BarChart';
import { ArrowUpRight } from './icons';
import { Modal } from './Modal';
import { PreviewButton } from './PreviewButton';
import { Thumb } from './Thumb';

export function DetailDrawer({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const { snapshot, boards, now, backend, prefillHero, setBoard } = useApp();
  const listing = snapshot.state.listings.find((l) => l.id === listingId);

  const history = useMemo(() => {
    let running = 0;
    return snapshot.state.payments
      .filter((p) => p.listingId === listingId)
      .sort((a, b) => a.at - b.at)
      .map((p) => ({ ...p, cumulative: (running += p.amount) }))
      .reverse();
  }, [snapshot.state.payments, listingId]);

  if (!listing) return null;
  const cat = categoryById(listing.category);
  const all = boards.all.find((e) => e.listing.id === listing.id);
  const today = boards.today.find((e) => e.listing.id === listing.id);
  const series = listingClickSeries(listing.id, listing.clicks, listing.createdAt, now);
  const nextRank = all && all.rank > 1 ? all.rank - 1 : null;
  const raiseTo = nextRank ? minBidForRank(boards.all, nextRank) : totalOnBoard(boards.all, listing.id) + 1;

  return (
    <Modal onClose={onClose} label={`${listing.title} details`} variant="drawer">
      <div className="detail-head">
        <Thumb art={listing.artwork} size="lg" label={`${listing.title} artwork`} />
        <div style={{ minWidth: 0 }}>
          <h2>{listing.title}</h2>
          <div className="muted" style={{ fontSize: 14 }}>
            {listing.tagline}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            {cat.icon} <b style={{ color: 'var(--text)' }}>{cat.label}</b> · {listing.display}
          </div>
        </div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <a
          className="cta cta--solid"
          style={{ width: 'auto', padding: '0 20px', height: 42, fontSize: 14 }}
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          onClick={() => backend.click(listing.id)}
        >
          Visit {listing.display.length > 26 ? 'site' : listing.display} <ArrowUpRight width={16} height={16} />
        </a>
        <PreviewButton listing={listing} />
      </div>

      <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>{listing.description}</p>

      <div className="stat-grid">
        <div className="stat">
          <small>🏆 All-time</small>
          <span className="num accent">{all ? `#${all.rank}` : '—'}</span>
          <small>{usd(all?.total ?? 0)}</small>
        </div>
        <div className="stat">
          <small>● Today</small>
          <span className="num accent">{today ? `#${today.rank}` : '—'}</span>
          <small>{usd(today?.total ?? 0)}</small>
        </div>
        <div className="stat">
          <small>Outbound clicks</small>
          <span className="num">{num(listing.clicks)}</span>
        </div>
        <div className="stat">
          <small>Listed</small>
          <span className="num" style={{ fontSize: 16 }}>
            {relativeTime(listing.createdAt, now)}
          </span>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <button
          className="cta"
          onClick={() => {
            setBoard('all');
            prefillHero({ input: listing.key.startsWith('@') ? listing.key : listing.url, amount: raiseTo });
            onClose();
          }}
        >
          {nextRank ? `Raise to #${nextRank} for ${usd(raiseTo)}` : `Raise this listing (+$1 → ${usd(raiseTo)})`}
        </button>
      </div>

      <h3 className="section-title">Daily outbound clicks</h3>
      <BarChart title="Outbound clicks per day" subtitle="Last 14 days (UTC)" data={series.map((d, i) => ({ label: d.day, value: d.clicks, partial: i === series.length - 1 }))} unit="clicks" />

      <h3 className="section-title">Bid history</h3>
      <ul className="history">
        {history.map((p) => (
          <li key={p.id}>
            <span>
              {new Date(p.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}{' '}
              <span className="muted">· {relativeTime(p.at, now)}</span>
            </span>
            <span className="num accent">+{usd(p.amount)}</span>
            <span className="num muted">{usd(p.cumulative)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
