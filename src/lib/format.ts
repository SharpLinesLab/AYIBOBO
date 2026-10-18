import { Fragment, createElement, type ReactNode } from 'react';
import { fmtDate, fmtNumber, fmtRelative, fmtUsd } from '../i18n';

/** Money and numbers in the current interface language. */
export const usd = (n: number) => fmtUsd(n);
export const num = (n: number) => fmtNumber(Math.round(n));

/** "2 days ago" in the current interface language. */
export function relativeTime(t: number, now: number): string {
  return fmtRelative(t, now);
}

export function formatDayKey(key: string): string {
  return fmtDate(new Date(`${key}T00:00:00Z`), { weekday: 'short', month: 'short', day: true, year: true, utc: true });
}

/** Time remaining until the next 00:00 UTC, as `5h 12m`. */
export function untilUtcMidnight(now: number): string {
  const next = Math.floor(now / 86_400_000 + 1) * 86_400_000;
  const mins = Math.max(0, Math.floor((next - now) / 60_000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

/**
 * Fill `{name}` placeholders in an already-translated string with React nodes, so markup (bold
 * amounts, links) can sit anywhere the translation puts it: `rich(t('x'), { amount: <b>$5</b> })`.
 */
export function rich(s: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return s.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return createElement(Fragment, { key: i }, m && m[1] in nodes ? nodes[m[1]] : part);
  });
}
