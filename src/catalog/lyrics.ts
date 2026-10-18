/**
 * Lyrics: LRC parsing (the timed format artists and lyric services export), plain text, and
 * demo lyrics for the seed catalog timed to each song's form (verse / hook sections).
 */
import { mulberry32 } from '../lib/random';
import { barCount, barSeconds, sectionOf } from '../player/synth';
import type { GenreId, Track } from './types';

export interface LyricLine {
  /** Seconds, or null when the lyrics aren't synced. */
  time: number | null;
  /** Empty text marks an instrumental gap. */
  text: string;
}

export interface Lyrics {
  lines: LyricLine[];
  synced: boolean;
  source: 'lrc' | 'plain' | 'demo';
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

// --- demo lyrics ----------------------------------------------------------------------------------

type Mood = 'love' | 'party' | 'street' | 'faith';

const MOOD: Record<GenreId, Mood | null> = {
  kompa: 'love',
  zouk: 'love',
  rnb: 'love',
  afrobeats: 'party',
  amapiano: 'party',
  dancehall: 'party',
  rara: 'party',
  'rap-kreyol': 'street',
  drill: 'street',
  'hip-hop': 'street',
  gospel: 'faith',
  reggae: 'faith',
  electronic: null,
};

const VERSES: Record<Mood, string[]> = {
  love: [
    'Lavi a dous lè w bò kote m',
    'Late night calls and your voice on repeat',
    'Kè m bat pou ou chak swa',
    'Hold me close till the sunrise',
    'Ou se limyè ki klere chemen m',
    'Slow dance in a crowded room',
    'Mwen la pou ou, pa bezwen pè',
    'Every song on the radio sounds like you',
    'Danse avè m jis jou a ouvè',
    "I don't need the world if I got you",
    'Lanmou sa a pa fasil, men m rete',
    'Your perfume still on my jacket',
  ],
  party: [
    'Tout moun kanpe, fè bri a monte',
    'Turn it up, let the whole block feel it',
    'Mizik la nan san m, li pa janm fini',
    'Dance like nobody counting the hours',
    'Soley la cho, men nou pi cho',
    'From Miami down to Pétion-Ville',
    'DJ a pa kite nou repoze',
    'Hands in the air when the drum come in',
    'Nou fèt pou nou danse, se sa nou konnen',
    'Weekend started on a Tuesday',
    'Konpa, kanaval, tout lari a vivan',
    'Bass so heavy that the windows shaking',
  ],
  street: [
    'Nou soti anba, kounye a nou anlè',
    'Mama prayed for the day that we made it',
    'Pa kite pèsonn di w ou pa kapab',
    'Moving quiet, but the numbers loud',
    'Nou travay di, nou pa janm kraze',
    'Every scar is a story I’m telling',
    'Flag on my back, ancestors with me',
    'Island heart in a cold, cold city',
    'Mwen sonje lè nou pa t gen anyen',
    'Came up the hard way, no shortcuts',
    'Lari a te lekòl mwen',
    'Now the whole world listening',
  ],
  faith: [
    'Bondye ban m fòs pou m kontinye',
    'Kept the faith when the road got heavy',
    'Leve tèt ou, pa janm bese',
    'Morning light on the mountain',
    'Ayiti cheri, m pote w nan kè m',
    'Every storm gotta pass',
    'Lespwa a la menm lè lapli tonbe',
    'Hold on, hold on a little longer',
    'Nou pa janm poukont nou',
    'Grace found me in the dark',
    'Mache dousman, men pa janm kanpe',
    'Lift your voice over the water',
  ],
};

const HOOKS: Record<Mood, string[]> = {
  love: ['Pa kite m ale, pa kite m ale', "You're the only one I need", 'Rete la avè m', 'All night, all mine'],
  party: ['Tout moun leve men nou anlè', "Turn it up, don't stop", 'Fè bri a monte', 'We go dance till the morning'],
  street: ['Nou la, nou pap bouje', 'From the bottom, now we up', 'Respekte non an', 'Real ones only in the circle'],
  faith: ['Leve tèt ou, Bondye la', 'Lift it up, lift it high', 'Mwen pap janm lage', 'Grace carried me through'],
};

function demoLyrics(t: Track): Lyrics | null {
  const mood = MOOD[t.genre];
  if (!mood || t.recipe.form === 'loop') return null;
  const r = mulberry32((t.recipe.seed ^ 0x51ed27) >>> 0);
  const pick = <T,>(list: T[]) => list.splice(Math.floor(r() * list.length), 1)[0];
  const verses = [...VERSES[mood]];
  const hookPool = [...HOOKS[mood]];
  const hook = [t.title, pick(hookPool), `${t.title}, oh`, pick(hookPool)];
  const barDur = barSeconds(t.recipe);
  const total = barCount(t.recipe, t.duration);
  const lines: LyricLine[] = [];
  let hookLine = 0;
  let prev = '';
  for (let bar = 0; bar < total; bar++) {
    const section = sectionOf(bar, total);
    const time = Math.round(bar * barDur * 100) / 100;
    if (section !== prev && (section === 'intro' || section === 'break' || section === 'outro')) lines.push({ time, text: '' });
    if (section === 'hook' && prev !== 'hook') hookLine = 0;
    prev = section;
    if (bar % 2) continue;
    if (section === 'verse') {
      if (!verses.length) verses.push(...VERSES[mood]);
      lines.push({ time, text: pick(verses) });
    } else if (section === 'hook') lines.push({ time, text: hook[hookLine++ % hook.length] });
  }
  return { lines, synced: true, source: 'demo' };
}

const cache = new Map<string, Lyrics | null>();

export function lyricsFor(t: Track): Lyrics | null {
  const key = `${t.id}|${t.uploaded || t.published ? 1 : 0}|${t.duration}|${t.lyrics ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  // Real songs (your uploads, published songs) never get made-up demo lyrics.
  const l = t.lyrics ? parseLyrics(t.lyrics) : t.uploaded || t.published ? null : demoLyrics(t);
  cache.set(key, l);
  return l;
}
