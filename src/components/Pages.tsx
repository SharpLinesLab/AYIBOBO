import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t, plural } from '../i18n';
import { CATEGORIES, categoryById } from '../lib/categories';
import { formatDayKey, usd } from '../lib/format';
import { MAX_BID, MIN_BID, getArchiveBoard, getBoard, shiftDayKey, utcDayKey } from '../lib/ranking';
import type { CategoryId } from '../lib/types';
import { useApp } from '../store';
import { Board } from './Board';
import { BoardToggle, LivePill, rich } from './Chrome';
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
              {t(board === 'all' ? 'boost.pages.home.allTime' : 'boost.pages.home.today')}
              {isCategory && <span className="muted"> · {categoryById(filter as CategoryId).label}</span>}
            </h2>
            <span>{t(board === 'all' ? 'boost.pages.home.lifetimeSpend' : 'boost.pages.home.sinceMidnight')}</span>
          </div>
          {visible.length ? (
            <Board entries={visible} allEntries={entries} highlightId={highlightId} />
          ) : (
            <div className="empty">
              <b>{t(board === 'today' ? 'boost.pages.home.emptyToday' : 'boost.pages.home.emptyAll')}</b>
              {rich(t('boost.pages.home.emptyCta'), { amount: <span className="num">{usd(MIN_BID)}</span> })}
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
        <h2 id="lb-title">{t('boost.pages.lb.title')}</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {t(board === 'all' ? 'boost.pages.lb.subAll' : 'boost.pages.lb.subToday')}
        </span>
      </div>
      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const top = entries.filter((e) => e.listing.category === c.id).slice(0, 3);
          return (
            <div className="cat-card" key={c.id}>
              <div className="cat-card__head">
                <h2 className="cat-card__h">
                  {c.icon} {c.label}
                </h2>
                <button className="link-btn link-btn--accent" onClick={() => setFilter(c.id)}>
                  {t('common.action.viewAll')}
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
                  {t('boost.pages.lb.openSpot', { category: c.label.toLowerCase(), name: c.label })}
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
        <button className="hrow__arrow hrow__arrow--prev" onClick={() => page(-1)} aria-label={t('boost.pages.row.scrollLeft', { label })}>
          <ChevronLeft />
        </button>
      )}
      <div className="hrow__track" ref={ref} role="list" aria-label={label} onScroll={update}>
        {children}
      </div>
      {!edges.end && (
        <button className="hrow__arrow hrow__arrow--next" onClick={() => page(1)} aria-label={t('boost.pages.row.scrollRight', { label })}>
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
        <h2 id="explore-title">{t('boost.pages.explore.rising')}</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {t('boost.pages.explore.risingSub')}
        </span>
      </div>
      <Row label={t('boost.pages.explore.rising')}>{rising.map((e) => tile(e.listing.id))}</Row>
      <div className="section-head">
        <h2>{t('boost.pages.explore.newest')}</h2>
      </div>
      <Row label={t('boost.pages.explore.newest')}>{newest.map((l) => tile(l.id))}</Row>
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
      <h1>{t('boost.pages.board.daily')}</h1>
      <p>{t('boost.pages.daily.intro')}</p>
      <div className="daily-nav">
        <button className="icon-btn" disabled={key <= firstDay} onClick={() => navigate(`#/daily/${shiftDayKey(key, -1)}`)} aria-label={t('boost.pages.daily.prev')}>
          <ChevronLeft />
        </button>
        <strong>
          {formatDayKey(key)}
          {key === today && <span className="badge" style={{ marginLeft: 8 }}>{t('boost.pages.daily.live')}</span>}
        </strong>
        <button className="icon-btn" disabled={key >= today} onClick={() => navigate(`#/daily/${shiftDayKey(key, 1)}`)} aria-label={t('boost.pages.daily.next')}>
          <ChevronRight />
        </button>
      </div>
      {entries.length ? (
        <Board entries={entries} allEntries={entries} highlightId={null} />
      ) : (
        <div className="empty">
          <b>{t('boost.pages.daily.emptyTitle')}</b>
          {t('boost.pages.daily.emptyBody')}
        </div>
      )}
    </div>
  );
}

export function CategoriesPage() {
  const { boards, setFilter, navigate } = useApp();
  return (
    <div className="prose" style={{ maxWidth: 980 }}>
      <h1>{t('boost.pages.cats.title')}</h1>
      <p>{t('boost.pages.cats.intro')}</p>
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
                  <h2 className="cat-card__h">{c.label}</h2>
                </span>
                <span className="muted num" style={{ fontSize: 12.5 }}>
                  {plural('boost.pages.cats.listed', list.length)}
                </span>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {top ? (
                  rich(t('boost.pages.cats.top'), {
                    title: <b style={{ color: 'var(--text)' }}>{top.listing.title}</b>,
                    rank: <span className="accent num">#{top.rank}</span>,
                    amount: <span className="num">{usd(spend)}</span>,
                  })
                ) : (
                  t('boost.pages.cats.empty')
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
      <h1>{t('boost.pages.about.title')}</h1>
      <p>{rich(t('boost.pages.about.p1'), { site: <strong>soundbid.lol</strong> })}</p>
      <p>{rich(t('boost.pages.about.p2'), { rule: <strong>{t('boost.pages.about.rule')}</strong> })}</p>
      <h2>{t('boost.pages.about.howTitle')}</h2>
      <ol>
        <li>{t('boost.pages.about.how1')}</li>
        <li>{rich(t('boost.pages.about.how2'), { step: <code>{usd(5)}</code> })}</li>
        <li>{t('boost.pages.about.how3')}</li>
        <li>{t('boost.pages.about.how4')}</li>
      </ol>
      <h2>{t('boost.pages.about.whyTitle')}</h2>
      <p>{t('boost.pages.about.why')}</p>
      <h2>{t('boost.pages.about.listenTitle')}</h2>
      <p>{t('boost.pages.about.listen')}</p>
    </div>
  );
}

const codes = (items: string[]) =>
  items.map((c, i) => (
    <Fragment key={c}>
      {i > 0 && ', '}
      <code>{c}</code>
    </Fragment>
  ));

const FAQ = [
  ['boost.pages.faq.q1', 'boost.pages.faq.a1'],
  ['boost.pages.faq.q2', 'boost.pages.faq.a2'],
  ['boost.pages.faq.q3', 'boost.pages.faq.a3'],
  ['boost.pages.faq.q4', 'boost.pages.faq.a4'],
  ['boost.pages.faq.q5', 'boost.pages.faq.a5'],
  ['boost.pages.faq.q6', 'boost.pages.faq.a6'],
] as const;

export function RulesPage() {
  const step = <code>{usd(1)}</code>;
  return (
    <div className="prose">
      <h1>{t('boost.pages.rules.title')}</h1>
      <p>{t('boost.pages.rules.intro')}</p>

      <h2>{t('boost.pages.rules.r1Title')}</h2>
      <div className="rule-card">
        <ul>
          <li>
            <strong>{t('boost.pages.board.allTime')}</strong> {t('boost.pages.rules.r1AllTime')}
          </li>
          <li>
            <strong>{t('boost.pages.board.today')}</strong> {t('boost.pages.rules.r1Today')}
          </li>
          <li>
            <strong>{t('boost.pages.board.daily')}</strong> {t('boost.pages.rules.r1Daily')}
          </li>
        </ul>
      </div>

      <h2>{t('boost.pages.rules.r2Title')}</h2>
      <div className="rule-card">
        <ul>
          <li>{rich(t('boost.pages.rules.r2Whole'), { min: <code>{usd(MIN_BID)}</code>, max: <code>{usd(MAX_BID)}</code>, step })}</li>
          <li>
            {rich(t('boost.pages.rules.r2First'), {
              label: <strong>{t('boost.pages.rules.r2FirstLabel')}</strong>,
              step: <code>{usd(5)}</code>,
              from: <code>{usd(17_001)}</code>,
              to: <code>{usd(17_006)}</code>,
            })}
          </li>
          <li>
            {rich(t('boost.pages.rules.r2Other'), {
              label: <strong>{t('boost.pages.rules.r2OtherLabel')}</strong>,
              step,
              from: <code>{usd(13_005)}</code>,
              to: <code>{usd(13_006)}</code>,
            })}
          </li>
          <li>{rich(t('boost.pages.rules.r2Ties'), { label: <strong>{t('boost.pages.rules.r2TiesLabel')}</strong> })}</li>
        </ul>
      </div>

      <h2>{t('boost.pages.rules.r3Title')}</h2>
      <div className="rule-card">
        <ul>
          <li>{t('boost.pages.rules.r3Recognized')}</li>
          <li>{rich(t('boost.pages.rules.r3NewTotal'), { step })}</li>
          <li>{t('boost.pages.rules.r3Different')}</li>
        </ul>
      </div>

      <h2>{t('boost.pages.rules.r4Title')}</h2>
      <div className="rule-card">
        <ul>
          <li>{rich(t('boost.pages.rules.r4Tracking'), { params: codes(['utm_*', 'ref', 'si', 'fbclid']) })}</li>
          <li>{rich(t('boost.pages.rules.r4Short'), { links: codes(['bit.ly', 'linktr.ee', 'ffm.to', 'lnk.to']) })}</li>
          <li>
            {rich(t('boost.pages.rules.r4Keyed'), {
              examples: codes(['artist.bandcamp.com', 'open.spotify.com/artist/…', 'soundcloud.com/artist', 'splice.com/sounds/packs/…', 'gumroad.com/l/…']),
            })}
          </li>
          <li>{rich(t('boost.pages.rules.r4Handles'), { handles: <code>@handles</code> })}</li>
          <li>{t('boost.pages.rules.r4Private')}</li>
        </ul>
      </div>

      <h2 id="faq">{t('boost.pages.faq.title')}</h2>
      <div className="rule-card">
        {FAQ.map(([q, a]) => (
          <details className="faq" key={q}>
            <summary>{t(q)}</summary>
            <p>{t(a)}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
