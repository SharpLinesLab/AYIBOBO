/**
 * Play history. Seeded tracks get a deterministic daily play curve (rise after release, slow decay,
 * weekly rhythm, a few viral spikes); local plays are added on top. Charts are sums over windows.
 */
import { mulberry32 } from '../lib/random';
import type { Track } from './types';

const DAY = 86_400_000;
const memo = new Map<string, Float64Array>();

/** Plays per day for the last `days` days ending today (index days-1 = today). */
function series(t: Track, today: number, days = 400): Float64Array {
  const key = `${t.id}|${t.releasedAt}|${t.popularity}|${today}`;
  let s = memo.get(key);
  if (s) return s;
  s = new Float64Array(days);
  const r = mulberry32((t.recipe.seed ^ 0x9e3779b9) >>> 0);
  const base = 900 * t.popularity;
  const spikeDay = Math.floor(r() * 60);
  for (let i = 0; i < days; i++) {
    const dayStart = today - (days - 1 - i) * DAY;
    const age = (dayStart - t.releasedAt) / DAY;
    if (age < 0) continue;
    const rise = 1 - Math.exp(-(age + 1) / 2.5);
    const decay = Math.exp(-age / 140) * 0.85 + 0.15;
    const weekday = new Date(dayStart).getUTCDay();
    const weekly = weekday === 5 || weekday === 6 ? 1.25 : 1;
    const spike = Math.abs(days - 1 - i - spikeDay) < 3 && r() < 0.9 ? 1.6 : 1;
    s[i] = base * rise * decay * weekly * spike * (0.85 + r() * 0.3);
  }
  // Today is still in progress.
  memo.set(key, s);
  return s;
}

export function startOfDay(t: number): number {
  return Math.floor(t / DAY) * DAY;
}

/** Synthetic plays in [now - days, now). */
export function playsInWindow(t: Track, now: number, days: number, offsetDays = 0): number {
  if (t.uploaded || t.published) return 0;
  const today = startOfDay(now);
  const s = series(t, today);
  const frac = (now - today) / DAY;
  let sum = 0;
  for (let d = offsetDays; d < offsetDays + days && d < s.length; d++) {
    const v = s[s.length - 1 - d];
    sum += d === 0 ? v * frac : v;
  }
  return Math.round(sum);
}

export function lifetimePlays(t: Track, now: number): number {
  return playsInWindow(t, now, 400);
}

export type ChartWindow = 'day' | 'week' | 'month' | 'year';
export const WINDOW_DAYS: Record<ChartWindow, number> = { day: 1, week: 7, month: 30, year: 365 };

export interface ChartRow {
  track: Track;
  rank: number;
  plays: number;
  /** Positive = climbed, negative = fell, null = new entry. */
  change: number | null;
}

export function trackChart(tracks: Track[], now: number, window: ChartWindow, localPlays: Record<string, number> = {}): ChartRow[] {
  const days = WINDOW_DAYS[window];
  const cur = tracks.map((t) => ({ t, p: playsInWindow(t, now, days) + (localPlays[t.id] ?? 0) }));
  const prev = new Map(
    tracks
      .map((t) => ({ t, p: playsInWindow(t, now, days, days) }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p)
      .map((x, i) => [x.t.id, i + 1]),
  );
  return cur
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p)
    .map((x, i) => {
      const before = prev.get(x.t.id);
      return { track: x.t, rank: i + 1, plays: x.p, change: before ? before - (i + 1) : null };
    });
}

/** Trending = growth: this week vs last week, weighted by volume. */
export function trending(tracks: Track[], now: number): Track[] {
  return tracks
    .map((t) => {
      const a = playsInWindow(t, now, 7);
      const b = playsInWindow(t, now, 7, 7);
      return { t, score: a * (1 + Math.min(4, (a + 1) / (b + 1))) };
    })
    .sort((x, y) => y.score - x.score)
    .map((x) => x.t);
}

/**
 * Daily plays for the last `days` days, oldest first (the last entry is today so far).
 * Uploaded and published tracks have no synthetic history (all zeros).
 */
export function dailyPlays(t: Track, now: number, days: number): number[] {
  if (t.uploaded || t.published) return new Array(days).fill(0);
  const today = startOfDay(now);
  const s = series(t, today);
  const frac = (now - today) / DAY;
  const out: number[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const v = d < s.length ? s[s.length - 1 - d] : 0;
    out.push(Math.round(d === 0 ? v * frac : v));
  }
  return out;
}
