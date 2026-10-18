import { useRef, useState } from 'react';
import { fmtCompact, fmtDate, t } from '../i18n';
import { num } from '../lib/format';

export interface Bar {
  label: string;
  value: number;
  /** Today's still-filling bar is drawn lighter. */
  partial?: boolean;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

const shortDay = (key: string) => fmtDate(new Date(`${key}T00:00:00Z`), { day: true, month: 'short', utc: true });

/** Single-series bar chart with per-bar hover tooltip and a hidden data table for screen readers. */
export function BarChart({ title, subtitle, data, unit }: { title: string; subtitle?: string; data: Bar[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const figRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 560;
  const H = 150;
  const padL = 34;
  const padB = 20;
  const plotW = W - padL;
  const plotH = H - padB - 6;
  const max = niceMax(Math.max(4, ...data.map((d) => d.value)));
  const slot = plotW / data.length;
  const barW = Math.max(4, Math.min(22, slot - 6));
  const y = (v: number) => 6 + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart" style={{ margin: 0 }} ref={figRef}>
      <h4>{title}</h4>
      {subtitle && <p>{subtitle}</p>}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('boost.chart.label', { title, n: data.length })} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={padL} x2={W} y1={y(tick)} y2={y(tick)} />
            <text className="axis-label" x={padL - 6} y={y(tick) + 3} textAnchor="end">
              {fmtCompact(Math.round(tick))}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const h = Math.max(d.value > 0 ? 2 : 0, plotH - (y(d.value) - 6));
          const top = 6 + plotH - h;
          const r = Math.min(4, barW / 2, h);
          // Rounded data-end, square baseline.
          const path = h
            ? `M${cx - barW / 2},${6 + plotH} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${6 + plotH} Z`
            : '';
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${shortDay(d.label)}: ${num(d.value)} ${unit}`}>
              <rect x={padL + slot * i} y={0} width={slot} height={H} fill="transparent" />
              {path && <path d={path} className={`bar${d.partial ? ' is-partial' : ''}${hover !== null && hover !== i ? ' is-dim' : ''}`} />}
              {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                <text className="axis-label" x={cx} y={H - 4} textAnchor="middle">
                  {i === data.length - 1 ? t('boost.chart.today') : shortDay(d.label)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && svgRef.current && figRef.current && (() => {
        const fig = figRef.current.getBoundingClientRect();
        const box = svgRef.current.getBoundingClientRect();
        const scale = box.width / W;
        const left = Math.min(fig.width - 80, Math.max(80, box.left - fig.left + (padL + slot * hover + slot / 2) * scale));
        const top = box.top - fig.top + y(data[hover].value) * scale;
        return (
          <div className="tooltip" style={{ left, top }}>
            {hover === data.length - 1 ? t('boost.chart.todaySoFar') : shortDay(data[hover].label)} · <span className="num">{num(data[hover].value)}</span> {unit}
          </div>
        );
      })()}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{shortDay(d.label)}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
