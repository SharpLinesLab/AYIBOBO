/**
 * Lyrics: LRC parsing (the timed format artists and lyric services export) and plain text.
 */
import type { Track } from './types';

export interface LyricLine {
  /** Seconds, or null when the lyrics aren't synced. */
  time: number | null;
  /** Empty text marks an instrumental gap. */
  text: string;
}

export interface Lyrics {
  lines: LyricLine[];
  synced: boolean;
  source: 'lrc' | 'plain';
}

const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** Parse LRC (`[mm:ss.xx] line`, several stamps per line allowed) or plain text. */
export function parseLyrics(text: string): Lyrics | null {
  const raw = text.replace(/\r/g, '').split('\n');
  let offset = 0;
  const timed: LyricLine[] = [];
  const plain: LyricLine[] = [];
  for (const line of raw) {
    const meta = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i.exec(line);
    if (meta) {
      offset = Number(meta[1]) / 1000;
      continue;
    }
    if (/^\s*\[[a-z]+:.*\]\s*$/i.test(line)) continue; // [ar:…], [ti:…] tags
    const stamps = [...line.matchAll(STAMP)];
    const body = line.replace(STAMP, '').trim();
    if (stamps.length) {
      for (const m of stamps) {
        const frac = m[3] ? Number(m[3]) / 10 ** m[3].length : 0;
        timed.push({ time: Number(m[1]) * 60 + Number(m[2]) + frac, text: body });
      }
    } else if (body) plain.push({ time: null, text: body });
  }
  if (timed.length) {
    // LRC offset is added to every timestamp ("+" = lyrics appear earlier).
    const lines = timed.map((l) => ({ ...l, time: Math.max(0, l.time! - offset) })).sort((a, b) => a.time - b.time);
    return { lines, synced: true, source: 'lrc' };
  }
  return plain.length ? { lines: plain, synced: false, source: 'plain' } : null;
}

function stamp(sec: number): string {
  const cs = Math.round(sec * 100);
  return `[${String(Math.floor(cs / 6000)).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}]`;
}

export function toLrc(lines: LyricLine[]): string {
  return lines.map((l) => (l.time === null ? l.text : `${stamp(l.time)}${l.text ? ` ${l.text}` : ''}`)).join('\n');
}

/** Index of the line being sung at `pos` (−1 before the first line). */
export function activeLine(lines: LyricLine[], pos: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].time;
    if (t === null || t > pos + 0.15) break;
    idx = i;
  }
  return idx;
}

const cache = new Map<string, Lyrics | null>();

export function lyricsFor(t: Track): Lyrics | null {
  const key = `${t.id}|${t.lyrics ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  const l = t.lyrics ? parseLyrics(t.lyrics) : null;
  cache.set(key, l);
  return l;
}
