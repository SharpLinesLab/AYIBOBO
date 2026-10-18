import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { genreById } from '../catalog/genres';
import { dailyPlays } from '../catalog/plays';
import type { Artist, Track } from '../catalog/types';
import { mulberry32 } from '../lib/metadata';
import { compact, dayKey, useMusic } from '../music';
import { useApp } from '../store';
import { Cover } from '../components/music/bits';
import { PageHead } from './Browse';

type Range = 7 | 28 | 365;
const RANGES: { id: Range; label: string }[] = [
  { id: 7, label: '7 days' },
  { id: 28, label: '28 days' },
  { id: 365, label: '12 months' },
];
const DAY = 86_400_000;
/** The synthetic history covers ~400 days, so period-over-period deltas exist up to 28 days. */
const MAX_HISTORY = 400;

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtDay = (t: number, withYear = false) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });

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
    const perTrack = tracks.map((t) => {
      const synth = dailyPlays(t, m.now, span + 1).slice(0, -1);
      const mine = local(t, span);
      return { t, days: synth.map((v, i) => v + mine[i]) };
    });
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

const CITIES: Record<string, [string, number][]> = {
  base: [
    ['Port-au-Prince, HT', 30],
    ['Miami, US', 24],
    ['New York, US', 22],
    ['Montréal, CA', 14],
    ['Boston, US', 10],
    ['Paris, FR', 9],
    ['Cap-Haïtien, HT', 8],
    ['Orlando, US', 6],
  ],
  afrobeats: [['Lagos, NG', 26], ['London, UK', 18], ['Accra, GH', 12]],
  amapiano: [['Johannesburg, ZA', 30], ['London, UK', 12], ['Lagos, NG', 10]],
  dancehall: [['Kingston, JM', 28], ['Toronto, CA', 14], ['London, UK', 10]],
  reggae: [['Kingston, JM', 24], ['London, UK', 12], ['Toronto, CA', 9]],
  zouk: [['Fort-de-France, MQ', 22], ['Pointe-à-Pitre, GP', 18], ['Paris, FR', 16]],
  drill: [['London, UK', 16], ['Brooklyn, US', 14]],
};

function audience(a: Artist) {
  const r = mulberry32((a.avatar.seed ^ 0x2c1b3c6d) >>> 0);
  const extra = CITIES[a.genres[0]] ?? [];
  const weights = new Map<string, number>();
  for (const [c, w] of [...CITIES.base, ...extra]) weights.set(c, (weights.get(c) ?? 0) + w * (0.6 + r() * 0.8));
  const cities = [...weights].sort((x, y) => y[1] - x[1]).slice(0, 6);
  const sources: [string, number][] = [
    ['Playlists', 30 + r() * 14],
    ['Artist profile & catalog', 18 + r() * 10],
    ['Search', 10 + r() * 6],
    ['Your library & likes', 12 + r() * 8],
    ['Boost Board', 4 + r() * 6],
    ['Other', 4 + r() * 4],
  ];
  const norm = (list: [string, number][]) => {
    const total = list.reduce((s, [, v]) => s + v, 0);
    return list.map(([k, v]) => ({ label: k, share: v / total }));
  };
  return { cities: norm(cities), sources: norm(sources).sort((x, y) => y.share - x.share) };
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
          {table ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {table ? (
        <div className="schart__table">
          <table>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Streams</th>
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
                {points.length ? `${fmtInt(points.reduce((s, p) => s + p.v, 0))} streams from ${points[0].label} to ${points[points.length - 1].label}. Use arrow keys to read each point.` : 'No data'}
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
              <b className="num">{fmtInt(hp.v)} streams</b>
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

function BarList({ rows, title }: { rows: { label: string; share: number }[]; title: string }) {
  const max = Math.max(...rows.map((r) => r.share));
  return (
    <section className="card-panel">
      <h2 className="panel-title">{title}</h2>
      <ul className="barlist">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="barlist__label">{r.label}</span>
            <span className="barlist__track">
              <i style={{ width: `${(r.share / max) * 100}%` }} />
            </span>
            <span className="barlist__value num">{Math.round(r.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Delta({ cur, prev, label }: { cur: number; prev: number | null; label: string }) {
  if (prev === null || prev <= 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`kpi__delta${up ? ' is-up' : ' is-down'}`}>
      <span aria-hidden>{up ? '▲' : '▼'}</span> {Math.abs(pct).toFixed(pct > -10 && pct < 10 ? 1 : 0)}% <span className="muted">vs previous {label}</span>
    </span>
  );
}

// --- page ------------------------------------------------------------------------------------------

export function StudioPage({ artistId }: { artistId?: string }) {
  const m = useMusic();
  const { navigate } = useApp();
  const [range, setRange] = useState<Range>(28);
  const uploads = useMemo(() => m.catalog.tracks.filter((t) => t.uploaded), [m.catalog.tracks]);
  const fallback = uploads.length ? 'me' : (m.library.follows[0] ?? [...m.catalog.artists].sort((a, b) => b.followers - a.followers)[0]?.id);
  const pid = artistId ?? fallback;
  const isMe = pid === 'me';
  const artist = isMe ? undefined : m.artist(pid ?? '');
  const tracks = useMemo(() => (isMe ? uploads : artist ? m.artistTracks(artist.id) : []), [isMe, uploads, artist, m]);
  const data = useStudioData(tracks, range);
  const rangeLabel = RANGES.find((r) => r.id === range)!.label;
  const periodWord = range === 365 ? '12 months' : `${range} days`;

  const profiles = (
    <label className="studio__pick">
      <span className="muted">Profile</span>
      <select className="input" value={pid} onChange={(e) => navigate(`#/studio/${e.target.value}`)}>
        <option value="me">{m.library.displayName || 'You'} — your uploads</option>
        <optgroup label="Demo artist profiles">
          {[...m.catalog.artists]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </optgroup>
      </select>
    </label>
  );

  if (!isMe && !artist)
    return (
      <div className="page-music">
        <PageHead kicker="Artist Studio" title="Profile not found" />
        {profiles}
      </div>
    );

  const name = isMe ? m.library.displayName || 'Your music' : artist!.name;
  const liked = tracks.filter((t) => m.isLiked(t.id)).length;
  const comments = tracks.reduce((s, t) => s + (m.library.comments[t.id]?.length ?? 0), 0);
  const listenRatio = range === 7 ? 0.42 : range === 28 ? 0.31 : 0.14;
  const kpis = isMe
    ? [
        { label: 'Streams', value: data.streams, delta: <Delta cur={data.streams} prev={data.prev} label={periodWord} /> },
        { label: 'Songs', value: uploads.length },
        { label: 'Likes', value: liked },
        { label: 'Comments', value: comments },
      ]
    : [
        { label: 'Streams', value: data.streams, delta: <Delta cur={data.streams} prev={data.prev} label={periodWord} /> },
        { label: 'Listeners', value: Math.round(data.streams * listenRatio) },
        { label: 'Followers', value: m.followerCount(artist!) },
        { label: 'Saves', value: Math.round(data.streams * 0.035) },
      ];
  const aud = artist ? audience(artist) : null;
  const shareMax = Math.max(1, ...data.songs.map((s) => s.streams));

  return (
    <div className="page-music studio">
      <div className="studio__head">
        {artist ? <Cover spec={artist.avatar} size={72} round /> : <span className="studio__me" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>}
        <div className="studio__titles">
          <span className="phead__kicker">Artist Studio</span>
          <h1>{name}</h1>
          <span className="muted">
            {isMe ? 'Your uploads' : `${genreById(artist!.genres[0]).label} · ${artist!.handle}`} ·{' '}
            {isMe ? (
              <a href="#/library/uploads">Manage uploads</a>
            ) : (
              <a href={`#/artist/${artist!.id}`}>View public profile</a>
            )}
          </span>
        </div>
        {profiles}
      </div>

      <div className="studio__filters" role="group" aria-label="Time range">
        <div className="segmented">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'is-active' : ''} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="muted studio__asof">Through yesterday, {fmtDay(m.now - DAY, true)}</span>
      </div>

      {isMe && !uploads.length ? (
        <div className="empty-state card-panel">
          <h2>Upload a song to see your stats</h2>
          <p>Streams, likes and comments on your songs show up here.</p>
          <a className="btn-accent" href="#/upload">
            Upload music
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
            <StreamsChart points={data.points} title={`Streams · last ${rangeLabel}`} />
          </section>

          <section className="card-panel">
            <h2 className="panel-title">Top songs · last {rangeLabel}</h2>
            <div className="studio__table">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="num">
                      #
                    </th>
                    <th scope="col">Song</th>
                    <th scope="col" className="num">
                      Streams
                    </th>
                    <th scope="col" className="studio__col-change num">
                      Change
                    </th>
                    <th scope="col" className="studio__col-trend">
                      Trend
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
                          {ch === null ? '—' : `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(0)}%`}
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

          {aud ? (
            <div className="two-col studio__aud">
              <BarList title="Top cities" rows={aud.cities} />
              <BarList title="Where streams come from" rows={aud.sources} />
            </div>
          ) : null}

          <p className="muted studio__note">
            {isMe
              ? 'Streams of your uploads are counted on this device. Listener counts, cities and stream sources appear once ASF accounts and server-side stats are switched on.'
              : 'Demo profile: the sample catalog’s numbers are simulated so you can explore the Studio. Your own uploads show real plays.'}
          </p>
        </>
      )}
    </div>
  );
}
