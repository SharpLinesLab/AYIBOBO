import { forwardRef } from 'react';
import { categoryById } from '../lib/categories';
import { num, relativeTime, usd } from '../lib/format';
import { minBidForRank } from '../lib/ranking';
import type { RankedEntry } from '../lib/types';
import { useApp } from '../store';
import { PreviewButton } from './PreviewButton';
import { Thumb } from './Thumb';

interface Props {
  entry: RankedEntry;
  entries: RankedEntry[];
  highlight?: boolean;
}

export const ListingCard = forwardRef<HTMLLIElement, Props>(function ListingCard({ entry, entries, highlight }, ref) {
  const { now, openDetail, prefillHero, backend } = useApp();
  const { listing, rank, total } = entry;
  const cat = categoryById(listing.category);
  const claimFor = minBidForRank(entries, rank);
  return (
    <li ref={ref} className={`card${rank <= 3 ? ' is-top' : ''}${highlight ? ' is-highlight' : ''}`} data-id={listing.id}>
      <Thumb art={listing.artwork} label={`${listing.title} artwork`} />
      <div className="card__body">
        <div className="card__head">
          <span className="card__rank">#{rank}</span>
          <div className="card__title">
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              onClick={() => backend.click(listing.id)}
              onAuxClick={() => backend.click(listing.id)}
            >
              {listing.title}
            </a>
            {listing.tagline && <span className="card__tagline"> · {listing.tagline}</span>}
          </div>
          <span className="card__total">{usd(total)}</span>
        </div>
        {listing.description && <p className="card__desc">{listing.description}</p>}
        {listing.preview && (
          <div className="card__row">
            <PreviewButton listing={listing} />
          </div>
        )}
      </div>
      <div className="card__meta">
        <span aria-hidden>{cat.icon}</span>
        <b>{cat.label}</b>
        <span className="sep">·</span>
        <span>{relativeTime(entry.lastPaidAt, now)}</span>
        <span className="sep">·</span>
        <span>{listing.display}</span>
        <span className="sep">·</span>
        <span className="num">{num(listing.clicks)} clicks</span>
        <span className="sep">·</span>
        <button type="button" className="link-btn" onClick={() => openDetail(listing.id)}>
          see details
        </button>
        <span className="sep">·</span>
        <button type="button" className="link-btn link-btn--accent" onClick={() => prefillHero({ amount: claimFor })}>
          claim this rank for <span className="num">{usd(claimFor)}</span>
        </button>
      </div>
    </li>
  );
});
