export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const num = (n: number) => Math.round(n).toLocaleString('en-US');

export function relativeTime(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'a minute ago' : `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'an hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  const w = Math.round(d / 7);
  if (d < 30) return w === 1 ? 'last week' : `${w} weeks ago`;
  const mo = Math.round(d / 30);
  if (mo <= 1) return 'last month';
  if (mo < 12) return `${mo} months ago`;
  const y = Math.round(d / 365);
  return y <= 1 ? 'last year' : `${y} years ago`;
}

export function formatDayKey(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Time remaining until the next 00:00 UTC, as `5h 12m`. */
export function untilUtcMidnight(now: number): string {
  const next = Math.floor(now / 86_400_000 + 1) * 86_400_000;
  const mins = Math.max(0, Math.floor((next - now) / 60_000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
