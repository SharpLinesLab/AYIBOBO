import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import type { Track } from '../catalog/types';
import { fmtDate, fmtNumber, t } from '../i18n';
import { compact, dayKey, useMusic } from '../music';
import { Cover } from '../components/music/bits';
import { PageHead } from './Browse';

type Range = 7 | 28 | 365;
const RANGES: Range[] = [7, 28, 365];
const rangeKey = (r: Range) => `player.studio.range.${r}` as const;
const lastKey = (r: Range) => `player.studio.last.${r}` as const;
const vsPrevKey = (r: Range) => `player.studio.vsPrev.${r}` as const;
const DAY = 86_400_000;
/** Daily play history covers ~400 days, so period-over-period deltas exist up to 28 days. */
const MAX_HISTORY = 400;

const fmtInt = (n: number) => fmtNumber(Math.round(n));
const fmtDay = (at: number, withYear = false) => fmtDate(at, { day: true, month: 'short', year: withYear });

// --- data ------------------------------------------------------------------------------------------

interface SongStat {
  track: Track;
  streams: number;
  prev: number | null;
  trend: number[];
}

function useStudioData(tracks: Track[], range: Range) {
  const m = useMusic();
  return useMemo(() => {
    const span = range * 2 <= MAX_HISTORY ? range * 2 : range;
    // Complete days only (through yesterday) so a half-counted today doesn't read as a drop.
    const end = m.now - DAY;
    const local = (t: Track, days: number) => {
      const out: number[] = [];
      for (let d = days - 1; d >= 0; d--) out.push(m.library.daily[dayKey(end - d * DAY)]?.[t.id] ?? 0);
      return out;
    };
    const perTrack = tracks.map((t) => ({ t, days: local(t, span) }));
    const total = new Array(span).fill(0);
    perTrack.forEach(({ days }) => days.forEach((v, i) => (total[i] += v)));
    const cur = total.slice(-range);
    const prevSlice = span > range ? total.slice(0, range) : null;
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const songs: SongStat[] = perTrack
      .map(({ t, days }) => {
        const c = days.slice(-range);
        return { track: t, streams: sum(c), prev: span > range ? sum(days.slice(0, range)) : null, trend: bucket(c, range) };
      })
      .filter((s) => s.streams > 0 || s.track.uploaded)
      .sort((a, b) => b.streams - a.streams);
    // Chart points: daily for 7/28 days, weekly for 12 months.
    const step = range === 365 ? 7 : 1;
    const points: { t: number; v: number; label: string }[] = [];
    for (let i = cur.length; i > 0; i -= step) {
      const from = Math.max(0, i - step);
      const last = end - (cur.length - i) * DAY;
      const first = last - (i - from - 1) * DAY;
      points.unshift({ t: last, v: sum(cur.slice(from, i)), label: step === 1 ? fmtDay(last, false) : `${fmtDay(first)} – ${fmtDay(last)}` });
    }
    return { streams: sum(cur), prev: prevSlice ? sum(prevSlice) : null, points, songs };
  }, [tracks, range, m.now, m.library.daily]);
}

/** Compress a daily series to ≤ 14 points for a sparkline. */
function bucket(days: number[], range: Range): number[] {
  const size = range === 7 ? 1 : range === 28 ? 2 : 28;
  const out: number[] = [];
  for (let i = 0; i < days.length; i += size) out.push(days.slice(i, i + size).reduce((a, b) => a + b, 0));
  return out;
}

// --- charts ----------------------------------------------------------------------------------------

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Single-series area chart with a crosshair tooltip (pointer and arrow keys) and a table view. */
function StreamsChart({ points, title }: { points: { t: number; v: number; label: string }[]; title: string }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  const H = 260;
  const pad = { l: 48, r: 14, t: 14, b: 28 };
  const max = Math.max(1, ...points.map((p) => p.v));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(1, width - pad.l - pad.r);
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = points.length ? `${line}L${x(points.length - 1).toFixed(1)},${pad.t + ih}L${x(0).toFixed(1)},${pad.t + ih}Z` : '';
  const xTicks = points.length ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (points.length - 1))).filter((v, i, a) => a.indexOf(v) === i) : [];
  const pick = (e: RPointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const f = (e.clientX - r.left - pad.l) / iw;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(f * (points.length - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  };
  const hp = hover !== null ? points[hover] : null;
  return (
    <div className="schart">
      <div className="schart__bar">
        <h2 className="panel-title" id={id}>
          {title}
        </h2>
        <button className="link-btn" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {t(table ? 'player.studio.showChart' : 'player.studio.showTable')}
        </button>
      </div>
      {table ? (
        <div className="schart__table">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('player.studio.period')}</th>
                <th scope="col">{t('player.studio.streams')}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.t}>
                  <td>{p.label}</td>
                  <td className="num">{fmtInt(p.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="schart__plot" ref={box}>
          {width > 0 && (
            <svg
              width={width}
              height={H}
              role="img"
              aria-labelledby={id}
              aria-describedby={`${id}-d`}
              tabIndex={0}
              onKeyDown={onKey}
              onFocus={() => setHover((h) => h ?? points.length - 1)}
              onBlur={() => setHover(null)}
              onPointerMove={pick}
              onPointerDown={pick}
              onPointerLeave={() => setHover(null)}
            >
              <desc id={`${id}-d`}>
                {points.length
                  ? t('player.studio.chartDesc', { n: fmtInt(points.reduce((s, p) => s + p.v, 0)), from: points[0].label, to: points[points.length - 1].label })
                  : t('player.studio.noData')}
              </desc>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="schart__grid" />
                  <text x={pad.l - 8} y={y(t)} className="schart__tick" textAnchor="end" dominantBaseline="middle">
                    {compact(t)}
                  </text>
                </g>
              ))}
              {xTicks.map((i) => (
                <text key={i} x={x(i)} y={H - 8} className="schart__tick" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
                  {fmtDay(points[i].t)}
                </text>
              ))}
              <path d={area} className="schart__area" />
              <path d={line} className="schart__line" />
              {points.length > 0 && <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].v)} r={4} className="schart__dot" />}
              {hp && hover !== null && (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="schart__cross" />
                  <circle cx={x(hover)} cy={y(hp.v)} r={5} className="schart__dot" />
                </g>
              )}
            </svg>
          )}
          {hp && hover !== null && (
            <div className="schart__tip" style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: Math.max(0, y(hp.v) - 64) }} role="status">
              <span>{hp.label}</span>
              <b className="num">{t('player.studio.streamsN', { n: fmtInt(hp.v) })}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 26;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length < 2 ? w / 2 : 2 + (i / (values.length - 1)) * (w - 4), h - 3 - (v / max) * (h - 6)]);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="spark" aria-hidden>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} />
      {last && <circle cx={last[0]} cy={last[1]} r={3} />}
    </svg>
  );
}

function Delta({ cur, prev, label }: { cur: number; prev: number | null; label: string }) {
  if (prev === null || prev <= 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`kpi__delta${up ? ' is-up' : ' is-down'}`}>
      <span aria-hidden>{up ? '▲' : '▼'}</span> {t('player.pct', { n: fmtNumber(Math.abs(pct), pct > -10 && pct < 10 ? 1 : 0) })} <span className="muted">{label}</span>
    </span>
  );
}

// --- page ------------------------------------------------------------------------------------------

export function StudioPage({ artistId }: { artistId?: string }) {
  const m = useMusic();
  const [range, setRange] = useState<Range>(28);
  const uploads = useMemo(() => m.catalog.tracks.filter((t) => t.uploaded), [m.catalog.tracks]);
  const data = useStudioData(uploads, range);
  const rangeLabel = t(lastKey(range));
  const periodWord = t(vsPrevKey(range));

  // Studio shows your own uploads; there are no other profiles.
  if (artistId && artistId !== 'me')
    return (
      <div className="page-music">
        <PageHead kicker={t('common.nav.studio')} title={t('player.studio.notFound')}>
          <a href="#/studio">{t('player.studio.yourMusic')}</a>
        </PageHead>
      </div>
    );

  const name = m.library.displayName || t('player.studio.yourMusic');
  const liked = uploads.filter((t) => m.isLiked(t.id)).length;
  const comments = uploads.reduce((s, t) => s + (m.library.comments[t.id]?.length ?? 0), 0);
  const kpis = [
    { label: t('player.studio.streams'), value: data.streams, delta: <Delta cur={data.streams} prev={data.prev} label={periodWord} /> },
    { label: t('player.studio.songs'), value: uploads.length },
    { label: t('player.studio.likes'), value: liked },
    { label: t('player.studio.comments'), value: comments },
  ];
  const shareMax = Math.max(1, ...data.songs.map((s) => s.streams));

  return (
    <div className="page-music studio">
      <div className="studio__head">
        <span className="studio__me" aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="studio__titles">
          <span className="phead__kicker">{t('common.nav.studio')}</span>
          <h1>{name}</h1>
          <span className="muted">
            {t('player.studio.yourUploads')} · <a href="#/library/uploads">{t('player.studio.manageUploads')}</a>
          </span>
        </div>
      </div>

      <div className="studio__filters" role="group" aria-label={t('player.studio.timeRange')}>
        <div className="segmented">
          {RANGES.map((r) => (
            <button key={r} className={range === r ? 'is-active' : ''} aria-pressed={range === r} onClick={() => setRange(r)}>
              {t(rangeKey(r))}
            </button>
          ))}
        </div>
        <span className="muted studio__asof">{t('player.studio.through', { date: fmtDay(m.now - DAY, true) })}</span>
      </div>

      {!uploads.length ? (
        <div className="empty-state card-panel">
          <h2>{t('player.studio.emptyTitle')}</h2>
          <p>{t('player.studio.emptyBody')}</p>
          <a className="btn-accent" href="#/account">
            {t('common.nav.uploadMusic')}
          </a>
        </div>
      ) : (
        <>
          <div className="kpis">
            {kpis.map((k) => (
              <div className="kpi card-panel" key={k.label}>
                <span className="kpi__label">{k.label}</span>
                <b className="kpi__value">{compact(k.value)}</b>
                {k.delta}
              </div>
            ))}
          </div>

          <section className="card-panel">
            <StreamsChart points={data.points} title={`${t('player.studio.streams')} · ${rangeLabel}`} />
          </section>

          <section className="card-panel">
            <h2 className="panel-title">
              {t('player.studio.topSongs')} · {rangeLabel}
            </h2>
            <div className="studio__table">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="num">
                      #
                    </th>
                    <th scope="col">{t('player.studio.song')}</th>
                    <th scope="col" className="num">
                      {t('player.studio.streams')}
                    </th>
                    <th scope="col" className="studio__col-change num">
                      {t('player.studio.change')}
                    </th>
                    <th scope="col" className="studio__col-trend">
                      {t('player.studio.trend')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.songs.slice(0, 10).map((s, i) => {
                    const ch = s.prev && s.prev > 0 ? ((s.streams - s.prev) / s.prev) * 100 : null;
                    return (
                      <tr key={s.track.id}>
                        <td className="num muted">{i + 1}</td>
                        <td>
                          <a className="studio__song" href={`#/song/${s.track.id}`}>
                            <Cover spec={s.track.cover} size={40} />
                            <span>
                              <b>{s.track.title}</b>
                              <span className="studio__share" aria-hidden>
                                <i style={{ width: `${(s.streams / shareMax) * 100}%` }} />
                              </span>
                            </span>
                          </a>
                        </td>
                        <td className="num">{fmtInt(s.streams)}</td>
                        <td className={`num studio__col-change${ch === null ? '' : ch >= 0 ? ' is-up' : ' is-down'}`}>
                          {ch === null ? '—' : `${ch >= 0 ? '▲' : '▼'} ${t('player.pct', { n: fmtNumber(Math.abs(ch)) })}`}
                        </td>
                        <td className="studio__col-trend">
                          <Sparkline values={s.trend} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <p className="muted studio__note">{t('player.studio.noteMe')}</p>
        </>
      )}
    </div>
  );
}
