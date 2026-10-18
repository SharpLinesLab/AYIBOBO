/**
 * Interface language: English, French and Haitian Creole (Kreyòl).
 *
 * - English is the source of truth (`locales/en`); French and Kreyòl dictionaries must have exactly
 *   the same keys — TypeScript fails the build if one is missing.
 * - Strings live in namespaces (`common`, `browse`, `pages`, `player`); keys are
 *   `namespace.name`. `{name}` placeholders are filled from `vars`.
 * - Plurals: keys ending in `_one` / `_other` (plus `_many` where French needs it), picked with
 *   `plural(base, n)`.
 * - French and Kreyòl load on demand; English ships with the app.
 * - Browsers have no Kreyòl (`ht`) locale data, so Kreyòl month/day names and relative times are
 *   written out here; numbers follow French conventions (as in Haiti).
 */
import { useSyncExternalStore } from 'react';
import { dict as en } from './locales/en';

export type Lang = 'en' | 'fr' | 'ht';
export type Key = keyof typeof en;
type Dict = Record<Key, string>;
type PluralBase = { [K in Key]: K extends `${infer B}_other` ? B : never }[Key];

export const LANGS: { id: Lang; label: string; english: string }[] = [
  { id: 'ht', label: 'Kreyòl', english: 'Haitian Creole' },
  { id: 'fr', label: 'Français', english: 'French' },
  { id: 'en', label: 'English', english: 'English' },
];

const STORE_KEY = 'asf:lang';
let lang: Lang = 'en';
let dict: Dict = en;
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

/** Saved choice, else the browser's preferred languages, else English. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === 'en' || saved === 'fr' || saved === 'ht') return saved;
  } catch {
    /* storage blocked */
  }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.toLowerCase().split('-')[0];
    if (base === 'ht') return 'ht';
    if (base === 'fr') return 'fr';
    if (base === 'en') return 'en';
  }
  return 'en';
}

async function load(l: Lang): Promise<Dict> {
  if (l === 'fr') return (await import('./locales/fr')).dict;
  if (l === 'ht') return (await import('./locales/ht')).dict;
  return en;
}

/** Load a language's strings and make it current (call before first render, and on switch). */
export async function setLang(l: Lang, persist = true): Promise<void> {
  dict = await load(l);
  lang = l;
  document.documentElement.lang = l;
  if (persist) {
    try {
      localStorage.setItem(STORE_KEY, l);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => lang,
  );
}

function fill(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Translate a key. Falls back to English, then to the key itself. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  return fill(dict[key] ?? en[key] ?? key, vars);
}

const pluralRules = new Map<string, Intl.PluralRules>();

/** Pick `${base}_one|_many|_other` for `n`; `{n}` is filled with the formatted number. */
export function plural(base: PluralBase, n: number, vars?: Record<string, string | number>): string {
  const loc = lang === 'en' ? 'en' : 'fr'; // Kreyòl plurals behave like French here (0 and 1 are singular)
  let pr = pluralRules.get(loc);
  if (!pr) pluralRules.set(loc, (pr = new Intl.PluralRules(loc)));
  const rule = pr.select(n);
  const pick = (k: string) => (dict as Record<string, string>)[k] ?? (en as Record<string, string>)[k];
  const s = pick(`${base}_${rule}`) ?? pick(`${base}_other`) ?? base;
  return fill(s, { n: fmtNumber(n), ...vars });
}

// --- formatting ---------------------------------------------------------------------------------

/** Intl locale for numbers: Kreyòl follows French conventions (1 234,5). */
export function numberLocale(): string {
  return lang === 'en' ? 'en-US' : lang === 'fr' ? 'fr-FR' : 'fr-HT';
}

export function fmtNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: digits }).format(n);
}

/**
 * 1.2K / 3.4M style, with no space before the suffix in any language. French and Kreyòl keep the
 * decimal comma (1,2K) and write billions as Md (milliard / milya).
 */
export function fmtCompact(n: number): string {
  const sep = lang === 'en' ? '.' : ',';
  const short = (v: number, suffix: string) => `${v.toFixed(1).replace(/\.0$/, '').replace('.', sep)}${suffix}`;
  if (n >= 999_950_000) return short(n / 1e9, lang === 'en' ? 'B' : 'Md');
  if (n >= 999_500) return short(n / 1e6, 'M');
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return short(n / 1e3, 'K');
  return String(n);
}

const HT_MONTHS = ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'];
const HT_MONTHS_SHORT = ['jan', 'fev', 'mas', 'avr', 'me', 'jen', 'jiy', 'out', 'sep', 'okt', 'nov', 'des'];
const HT_DAYS = ['dimanch', 'lendi', 'madi', 'mèkredi', 'jedi', 'vandredi', 'samdi'];
const HT_DAYS_SHORT = ['dim', 'len', 'mad', 'mèk', 'jed', 'van', 'sam'];

export interface DateOpts {
  day?: boolean;
  month?: 'short' | 'long';
  year?: boolean;
  weekday?: 'short' | 'long';
  utc?: boolean;
}

/** Localized date, e.g. "Oct 18, 2026" / "18 oct. 2026" / "18 okt 2026". */
export function fmtDate(t: number | Date, o: DateOpts = { day: true, month: 'short', year: true }): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  if (lang === 'ht') {
    const get = (utc: () => number, local: () => number) => (o.utc ? utc() : local());
    const day = get(() => d.getUTCDate(), () => d.getDate());
    const mon = get(() => d.getUTCMonth(), () => d.getMonth());
    const yr = get(() => d.getUTCFullYear(), () => d.getFullYear());
    const wd = get(() => d.getUTCDay(), () => d.getDay());
    const parts: string[] = [];
    if (o.weekday) parts.push(`${(o.weekday === 'long' ? HT_DAYS : HT_DAYS_SHORT)[wd]},`);
    if (o.day) parts.push(String(day));
    if (o.month) parts.push((o.month === 'long' ? HT_MONTHS : HT_MONTHS_SHORT)[mon]);
    if (o.year) parts.push(String(yr));
    return parts.join(' ');
  }
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    ...(o.weekday ? { weekday: o.weekday } : {}),
    ...(o.day ? { day: 'numeric' } : {}),
    ...(o.month ? { month: o.month } : {}),
    ...(o.year ? { year: 'numeric' } : {}),
    ...(o.utc ? { timeZone: 'UTC' } : {}),
  });
}

type Unit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
const HT_UNITS: Record<Unit, string> = { minute: 'minit', hour: 'èdtan', day: 'jou', week: 'semèn', month: 'mwa', year: 'ane' };
const HT_LAST: Partial<Record<Unit, string>> = { day: 'yè', week: 'semèn pase', month: 'mwa pase', year: 'ane pase' };

/** "2 days ago" / "il y a 2 jours" / "sa gen 2 jou". */
export function fmtRelative(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return lang === 'en' ? 'just now' : lang === 'fr' ? 'à l’instant' : 'kounye a';
  const m = Math.round(s / 60);
  const h = Math.round(m / 60);
  const d = Math.round(h / 24);
  const [n, unit]: [number, Unit] =
    m < 60 ? [m, 'minute'] : h < 24 ? [h, 'hour'] : d < 7 ? [d, 'day'] : d < 30 ? [Math.round(d / 7), 'week'] : d < 365 ? [Math.max(1, Math.round(d / 30)), 'month'] : [Math.round(d / 365), 'year'];
  if (lang === 'ht') {
    if (n === 1 && HT_LAST[unit]) return HT_LAST[unit]!;
    return `sa gen ${n} ${HT_UNITS[unit]}`;
  }
  return new Intl.RelativeTimeFormat(lang === 'fr' ? 'fr' : 'en', { numeric: 'auto' }).format(-n, unit);
}
