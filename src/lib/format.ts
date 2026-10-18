import { fmtRelative } from '../i18n';

/** "2 days ago" in the current interface language. */
export function relativeTime(t: number, now: number): string {
  return fmtRelative(t, now);
}
