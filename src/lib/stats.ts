import { hashString, mulberry32 } from './metadata';
import { startOfUtcDay, utcDayKey } from './ranking';
import type { LeaderboardState } from './types';

export interface DayStat {
  day: string;
  visitors: number;
  clicks: number;
}

export interface LiveStats {
  online: number;
  visitorsToday: number;
  visitorsLifetime: number;
  clicksToday: number;
  /** Last 14 UTC days, oldest first, today last (partial). */
  history: DayStat[];
}

const DAY = 86_400_000;

/** Deterministic, plausible traffic curve for the demo (and for days before the server existed). */
export function syntheticDay(dayKey: string, fraction = 1): DayStat {
  const rand = mulberry32(hashString(`traffic:${dayKey}`));
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 1.18 : 1;
  const visitors = Math.round((2100 + rand() * 900) * weekend * fraction);
  const clicks = Math.round(visitors * (0.32 + rand() * 0.12));
  return { day: dayKey, visitors, clicks };
}

export function syntheticHistory(now: number, days = 14): DayStat[] {
  const today = startOfUtcDay(now);
  const fraction = Math.max(0.02, (now - today) / DAY);
  return Array.from({ length: days }, (_, i) => {
    const t = today - (days - 1 - i) * DAY;
    return syntheticDay(utcDayKey(t), i === days - 1 ? fraction : 1);
  });
}

/** Daily outbound click series for a listing (synthetic history scaled to its lifetime clicks). */
export function listingClickSeries(listingId: string, totalClicks: number, createdAt: number, now: number, days = 14): DayStat[] {
  const rand = mulberry32(hashString(`clicks:${listingId}`));
  const today = startOfUtcDay(now);
  const ageDays = Math.max(1, Math.ceil((now - createdAt) / DAY));
  const perDay = totalClicks / ageDays;
  return Array.from({ length: days }, (_, i) => {
    const t = today - (days - 1 - i) * DAY;
    const before = t + DAY <= createdAt;
    const clicks = before ? 0 : Math.round(perDay * (0.55 + rand() * 0.9) * (i === days - 1 ? Math.max(0.05, (now - today) / DAY) : 1));
    return { day: utcDayKey(t), visitors: 0, clicks };
  });
}

export function totalRevenue(state: LeaderboardState): number {
  return state.payments.reduce((s, p) => s + p.amount, 0);
}
