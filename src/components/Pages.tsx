import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CATEGORIES, categoryById } from '../lib/categories';
import { formatDayKey, usd } from '../lib/format';
import { MAX_BID, MIN_BID, getArchiveBoard, getBoard, shiftDayKey, utcDayKey } from '../lib/ranking';
import type { CategoryId } from '../lib/types';
import { useApp } from '../store';
import { Board } from './Board';
import { BoardToggle, LivePill } from './Chrome';
import { FeaturedCarousel } from './FeaturedCarousel';
import { HeroClaim } from './HeroClaim';
import { ChevronLeft, ChevronRight } from './icons';
import { PreviewButton } from './PreviewButton';
import { Thumb } from './Thumb';

export function HomePage() {
  const { boards, board, filter, highlightId } = useApp();
  const entries = boards[board];
  const isCategory = filter !== 'all' && filter !== 'leaderboards' && filter !== 'explore';
  const visible = isCategory ? entries.filter((e) => e.listing.category === filter) : entries;

  return (
    <>
      <FeaturedCarousel />
      <div className="claim-panel">
        <LivePill />
        <BoardToggle />
        <HeroClaim />
      </div>
      {filter === 'leaderboards' ? (
        <CategoryLeaderboards />
      ) : filter === 'explore' ? (
        <Explore />
      ) : (
        <section id="board" aria-labelledby="board-title">
          <div className="board-head">
            <h2 id="board-title">
              {board === 'all' ? 'All-time leaderboard' : 'Today’s leaderboard'}
              {isCategory && <span className="muted"> · {categoryById(filter as CategoryId).label}</span>}
            </h2>
            <span>{board === 'all' ? 'lifetime spend' : 'since 00:00 UTC'}</span>
          </div>
          {visible.length ? (
            <Board entries={visible} allEntries={entries} highlightId={highlightId} />
          ) : (
            <div className="empty">
              <b>{board === 'today' ? 'Nobody has bid today yet' : 'No listings here yet'}</b>
              Claim #1 for <span className="num">{usd(MIN_BID)}</span> — be the first.
            </div>
          )}
        </section>
      )}
    </>
  );
}

function CategoryLeaderboards() {
  const { boards, board, setFilter, openDetail } = useApp();
  const entries = boards[board];
  return (
    <section aria-labelledby="lb-title">
      <div className="section-head">
        <h2 id="lb-title">Leaderboards by category</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {board === 'all' ? 'all-time' : 'today'} · global ranks
        </span>
      </div>
      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const top = entries.filter((e) => e.listing.category === c.id).slice(0, 3);
          return (
            <div className="cat-card" key={c.id}>
              <div className="cat-card__head">
                <h3>
                  {c.icon} {c.label}
                </h3>
                <button className="link-btn link-btn--accent" onClick={() => setFilter(c.id)}>
                  View all
                </button>
              </div>
              {top.length ? (
                <ol className="mini-list">
                  {top.map((e) => (
                    <li key={e.listing.id}>
                      <button className="mini-row" onClick={() => openDetail(e.listing.id)}>
                        <span className="mini-row__rank">#{e.rank}</span>
                        <Thumb art={e.listing.artwork} size="sm" />
                        <span className="mini-row__title">
                          {e.listing.title}
                          <span className="mini-row__sub">{e.listing.display}</span>
                        </span>
                        <span className="mini-row__amt">{usd(e.total)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Open spot — be the first {c.label.toLowerCase()} listing.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Horizontal, swipeable row with arrow buttons (scroll-snap). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current;
    if (el) setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(update, [children]);
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  return (
    <div className="hrow">
      {!edges.start && (
        <button className="hrow__arrow hrow__arrow--prev" onClick={() => page(-1)} aria-label={`Scroll ${label} left`}>
          <ChevronLeft />
        </button>
      )}
      <div className="hrow__track" ref={ref} role="list" aria-label={label} onScroll={update}>
        {children}
      </div>
      {!edges.end && (
        <button className="hrow__arrow hrow__arrow--next" onClick={() => page(1)} aria-label={`Scroll ${label} right`}>
          <ChevronRight />
        </button>
      )}
    </div>
  );
}

function Explore() {
  const { snapshot, boards, now, openDetail } = useApp();
  const rankOf = new Map(boards.all.map((e) => [e.listing.id, e]));
  const newest = [...snapshot.state.listings].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const week = now - 7 * 86_400_000;
  const rising = getBoard({ ...snapshot.state, payments: snapshot.state.payments.filter((p) => p.at >= week) }, 'all', now).slice(0, 6);

  const tile = (id: string) => {
    const e = rankOf.get(id);
    if (!e) return null;
    const l = e.listing;
    return (
      <div className="cat-card hrow__item" role="listitem" key={l.id}>
        <div className="row">
          <Thumb art={l.artwork} />
          <div style={{ minWidth: 0 }}>
            <button className="feed__title" onClick={() => openDetail(l.id)}>
              {l.title}
            </button>
            <div className="mini-row__sub">
              #{e.rank} · {usd(e.total)} · {categoryById(l.category).label}
            </div>
          </div>
        </div>
        <p className="card__desc">{l.description}</p>
        <div>
          <PreviewButton listing={l} />
        </div>
      </div>
    );
  };

  return (
    <section aria-labelledby="explore-title">
      <div className="section-head">
        <h2 id="explore-title">Rising this week</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          most spend in the last 7 days
        </span>
      </div>
      <Row label="Rising this week">{rising.map((e) => tile(e.listing.id))}</Row>
      <div className="section-head">
        <h2>Newest listings</h2>
      </div>
      <Row label="Newest listings">{newest.map((l) => tile(l.id))}</Row>
    </section>
  );
}

export function DailyPage({ day }: { day?: string }) {
  const { snapshot, now, navigate } = useApp();
  const today = utcDayKey(now);
  const key = day && day <= today ? day : today;
  const entries = useMemo(() => getArchiveBoard(snapshot.state, key), [snapshot.state, key]);
  const firstDay = useMemo(() => utcDayKey(Math.min(...snapshot.state.payments.map((p) => p.at), now)), [snapshot.state.payments, now]);

  return (
    <div className="prose" style={{ maxWidth: 680 }}>
      <h1>Daily archive</h1>
      <p>
        Every UTC calendar day gets its own frozen board. Each payment counts toward the day it was made, the Today board and the
        All-time board at the same time.
      </p>
      <div className="daily-nav">
        <button className="icon-btn" disabled={key <= firstDay} onClick={() => navigate(`#/daily/${shiftDayKey(key, -1)}`)} aria-label="Previous day">
          <ChevronLeft />
        </button>
        <strong>
          {formatDayKey(key)}
          {key === today && <span className="badge" style={{ marginLeft: 8 }}>live</span>}
        </strong>
        <button className="icon-btn" disabled={key >= today} onClick={() => navigate(`#/daily/${shiftDayKey(key, 1)}`)} aria-label="Next day">
          <ChevronRight />
        </button>
      </div>
      {entries.length ? (
        <Board entries={entries} allEntries={entries} highlightId={null} />
      ) : (
        <div className="empty">
          <b>No bids on this day</b>
          Days without payments have an empty board.
        </div>
      )}
    </div>
  );
}

export function CategoriesPage() {
  const { boards, setFilter, navigate } = useApp();
  return (
    <div className="prose" style={{ maxWidth: 980 }}>
      <h1>Categories</h1>
      <p>Twelve corners of music on the web. Ranks are global — a category view simply filters the main board.</p>
      <div className="cat-grid" style={{ marginTop: 20 }}>
        {CATEGORIES.map((c) => {
          const list = boards.all.filter((e) => e.listing.category === c.id);
          const spend = list.reduce((s, e) => s + e.total, 0);
          const top = list[0];
          return (
            <button
              key={c.id}
              className="cat-card"
              onClick={() => {
                setFilter(c.id);
                navigate('#/leaderboard');
              }}
            >
              <div className="cat-card__head">
                <span className="row">
                  <span className="cat-card__icon" aria-hidden>
                    {c.icon}
                  </span>
                  <h3>{c.label}</h3>
                </span>
                <span className="muted num" style={{ fontSize: 12.5 }}>
                  {list.length} listed
                </span>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {top ? (
                  <>
                    Top: <b style={{ color: 'var(--text)' }}>{top.listing.title}</b> at <span className="accent num">#{top.rank}</span> ·{' '}
                    <span className="num">{usd(spend)}</span> total
                  </>
                ) : (
                  'No listings yet — claim the first spot.'
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="prose">
      <h1>A leaderboard you can simply buy your way onto.</h1>
      <p>
        <strong>soundbid.lol</strong> is a public, pay-to-rank leaderboard for music on the web — standalone artist sites, browser DAWs and
        VSTs, sample libraries, indie labels, beat stores, pressing plants, sync libraries and the communities around them.
      </p>
      <p>
        There’s no algorithm deciding who gets seen, no playlist curator to win over and no ad network in the middle. The rule is the same for a
        bedroom producer and a funded startup: <strong>rank is strictly what you pay.</strong>
      </p>
      <h2>How it works</h2>
      <ol>
        <li>Paste your site, release link (Bandcamp, Spotify, SoundCloud…) or @handle.</li>
        <li>
          Pick an amount — the headline tells you which rank it buys in real time. #1 costs the current #1 plus <code>$5</code>.
        </li>
        <li>Pay. Your listing animates into place on the All-time board, today’s board and today’s archive.</li>
        <li>Want to climb later? Enter the same link again and pay only the difference.</li>
      </ol>
      <h2>Why music?</h2>
      <p>
        Discovery for independent music is mediated by recommendation engines that reward scale. A transparent, pay-what-it-takes board is
        crude — and that’s the point. Everyone can see exactly why a listing is where it is.
      </p>
      <h2>Listening, not just reading</h2>
      <p>
        Listings can include a short audio preview — a synth preset demo, a sample pack teaser or a featured track — playable right on the
        board without leaving the page.
      </p>
    </div>
  );
}

export function RulesPage() {
  return (
    <div className="prose">
      <h1>Rules</h1>
      <p>The same rules apply to every listing. They are enforced by the server at checkout, not just by the interface.</p>

      <h2>1. One payment, three boards</h2>
      <div className="rule-card">
        <ul>
          <li>
            <strong>All-time</strong> — lifetime cumulative spend per listing. Never expires.
          </li>
          <li>
            <strong>Today</strong> — spend since 00:00 UTC today. Resets at midnight UTC.
          </li>
          <li>
            <strong>Daily archive</strong> — a frozen snapshot of every UTC calendar day.
          </li>
        </ul>
      </div>

      <h2>2. Amounts & outbidding</h2>
      <div className="rule-card">
        <ul>
          <li>
            Whole US dollars only. Minimum <code>{usd(MIN_BID)}</code> for a new listing, maximum <code>{usd(MAX_BID)}</code>, <code>$1</code>{' '}
            increments.
          </li>
          <li>
            <strong>Taking #1</strong> costs at least <code>$5</code> more than the current #1 on that board (#1 at <code>$17,001</code> →{' '}
            <code>$17,006</code>).
          </li>
          <li>
            <strong>Any other rank</strong> costs at least <code>$1</code> more than the listing holding it (#4 at <code>$13,005</code> →{' '}
            <code>$13,006</code>).
          </li>
          <li>
            <strong>Ties</strong> stay in chronological order — the listing that got there first keeps the higher rank.
          </li>
        </ul>
      </div>

      <h2>3. Raising your rank</h2>
      <div className="rule-card">
        <ul>
          <li>Enter a link that’s already listed and it’s recognized automatically.</li>
          <li>
            Choose a new total at least <code>$1</code> above the current one; you’re charged only the difference.
          </li>
          <li>
            A different link always pays its full amount — nobody can take over someone else’s spend by paying the difference.
          </li>
        </ul>
      </div>

      <h2>4. Links</h2>
      <div className="rule-card">
        <ul>
          <li>
            Tracking, referral and affiliate parameters (<code>utm_*</code>, <code>ref</code>, <code>si</code>, <code>fbclid</code>…) are removed.
          </li>
          <li>
            Short links (<code>bit.ly</code>, <code>linktr.ee</code>, <code>ffm.to</code>, <code>lnk.to</code>…) are resolved to their destination.
          </li>
          <li>
            Regular sites are keyed by domain. Shared music platforms are keyed by path, so every artist, release, pack and plugin gets its own
            listing: <code>artist.bandcamp.com</code>, <code>open.spotify.com/artist/…</code>, <code>soundcloud.com/artist</code>,{' '}
            <code>splice.com/sounds/packs/…</code>, <code>gumroad.com/l/…</code>.
          </li>
          <li>
            <code>@handles</code> are listed as X profiles.
          </li>
          <li>Private chat invites (Discord, Telegram, WhatsApp, Signal…) and NSFW / adult links are not allowed.</li>
        </ul>
      </div>

      <h2 id="faq">FAQ</h2>
      <div className="rule-card">
        <details className="faq">
          <summary>Can I get a refund if someone outbids me?</summary>
          <p>No. Payments are final and rank is never guaranteed — that’s the game. Your spend stays on your listing forever on the All-time board.</p>
        </details>
        <details className="faq">
          <summary>Do I need an account?</summary>
          <p>No. Your listing is identified by its normalized link. Anyone can top up any listing — which only ever moves it up.</p>
        </details>
        <details className="faq">
          <summary>Can I change my title, description or audio preview?</summary>
          <p>Metadata is scraped from your site at first claim. Contact us from the domain’s email to request an update.</p>
        </details>
        <details className="faq">
          <summary>What counts as a click?</summary>
          <p>Every outbound click from the board or a details page to your link. The counter is public.</p>
        </details>
        <details className="faq">
          <summary>Why did my rank change without me doing anything?</summary>
          <p>Someone else paid more. Higher cumulative payments rank higher automatically.</p>
        </details>
        <details className="faq">
          <summary>Which currency and payment methods?</summary>
          <p>US dollars via Stripe Checkout — cards, Apple Pay and Google Pay where available.</p>
        </details>
      </div>
    </div>
  );
}
