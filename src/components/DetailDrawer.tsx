import { useMemo } from 'react';
import { categoryById } from '../lib/categories';
import { fmtDate, t } from '../i18n';
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
    <Modal onClose={onClose} label={t('boost.detail.label', { title: listing.title })} variant="drawer">
      <div className="detail-head">
        <Thumb art={listing.artwork} size="lg" label={t('boost.card.artwork', { title: listing.title })} />
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
          {listing.display.length > 26 ? t('boost.detail.visitSite') : t('boost.detail.visit', { site: listing.display })} <ArrowUpRight width={16} height={16} />
        </a>
        <PreviewButton listing={listing} />
      </div>

      <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>{listing.description}</p>

      <div className="stat-grid">
        <div className="stat">
          <small>🏆 {t('boost.board.all')}</small>
          <span className="num accent">{all ? `#${all.rank}` : '—'}</span>
          <small>{usd(all?.total ?? 0)}</small>
        </div>
        <div className="stat">
          <small>● {t('boost.board.today')}</small>
          <span className="num accent">{today ? `#${today.rank}` : '—'}</span>
          <small>{usd(today?.total ?? 0)}</small>
        </div>
        <div className="stat">
          <small>{t('boost.detail.outbound')}</small>
          <span className="num">{num(listing.clicks)}</span>
        </div>
        <div className="stat">
          <small>{t('boost.detail.listed')}</small>
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
          {nextRank ? t('boost.detail.raiseTo', { rank: nextRank, amount: usd(raiseTo) }) : t('boost.detail.raiseBy', { step: usd(1), amount: usd(raiseTo) })}
        </button>
      </div>

      <h3 className="section-title">{t('boost.detail.dailyClicks')}</h3>
      <BarChart title={t('boost.stats.clicksChart')} subtitle={t('boost.detail.chartSub')} data={series.map((d, i) => ({ label: d.day, value: d.clicks, partial: i === series.length - 1 }))} unit={t('boost.stats.unitClicks')} />

      <h3 className="section-title">{t('boost.detail.history')}</h3>
      <ul className="history">
        {history.map((p) => (
          <li key={p.id}>
            <span>
              {fmtDate(p.at, { day: true, month: 'short', year: true, utc: true })}{' '}
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
