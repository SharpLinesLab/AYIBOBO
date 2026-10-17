import { detectCategory } from './categories';
import type { NormalizedTarget } from './normalize';
import type { Artwork, AudioPreview, CategoryId, SynthPreview } from './types';

export interface SiteMetadata {
  title: string;
  tagline: string;
  description: string;
  category: CategoryId;
  artwork: Artwork;
  preview?: AudioPreview;
  /** Where the data came from: a real HTML fetch (server) or the local simulation. */
  source: 'scraped' | 'simulated';
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRADIENTS: [string, string][] = [
  ['#E86C52', '#F5B5A6'],
  ['#1F2937', '#E86C52'],
  ['#7C3AED', '#F472B6'],
  ['#0EA5E9', '#22D3EE'],
  ['#16A34A', '#A3E635'],
  ['#F59E0B', '#EF4444'],
  ['#111827', '#6B7280'],
  ['#BE185D', '#FB7185'],
  ['#0F766E', '#5EEAD4'],
  ['#4338CA', '#818CF8'],
  ['#92400E', '#FBBF24'],
  ['#18181B', '#F5B5A6'],
];

const STYLE_BY_CATEGORY: Record<CategoryId, SynthPreview['style']> = {
  streaming: 'lofi',
  daws: 'pluck',
  samples: 'beat',
  ai: 'arp',
  artist: 'lofi',
  labels: 'pad',
  beats: 'beat',
  vinyl: 'lofi',
  live: 'beat',
  community: 'pluck',
  sync: 'pad',
  synths: 'bass',
};

export function generateArtwork(seedText: string, title: string): Artwork {
  const h = hashString(seedText);
  const [from, to] = GRADIENTS[h % GRADIENTS.length];
  const words = title.replace(/^@/, '').split(/[\s.\-_/]+/).filter(Boolean);
  const glyph = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
  return { from, to, glyph };
}

export function generatePreview(seedText: string, category: CategoryId): AudioPreview {
  const h = hashString(`preview:${seedText}`);
  const rand = mulberry32(h);
  return {
    kind: 'synth',
    style: STYLE_BY_CATEGORY[category],
    root: 45 + Math.floor(rand() * 12),
    bpm: 84 + Math.floor(rand() * 56),
    seed: h,
  };
}

function titleCase(s: string): string {
  return s
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const PLATFORM_LABEL: [RegExp, string][] = [
  [/bandcamp\.com/, 'on Bandcamp'],
  [/open\.spotify\.com/, 'on Spotify'],
  [/soundcloud\.com/, 'on SoundCloud'],
  [/music\.apple\.com/, 'on Apple Music'],
  [/youtube\.com/, 'on YouTube'],
  [/splice\.com/, 'on Splice'],
  [/gumroad\.com/, 'on Gumroad'],
  [/beatstars\.com/, 'on BeatStars'],
  [/audiomack\.com/, 'on Audiomack'],
  [/x\.com/, 'on X'],
  [/instagram\.com/, 'on Instagram'],
  [/linktr\.ee/, 'on Linktree'],
];

const TAGLINES: Record<CategoryId, string[]> = {
  streaming: ['Independent music discovery', 'Hand-picked radio, no algorithm'],
  daws: ['Plugins made by producers', 'Mix tools for the bedroom & the big room'],
  samples: ['Royalty-free loops & one-shots', 'Drum kits and sample packs'],
  ai: ['AI tools for musicians', 'Machine-learning studio assistant'],
  artist: ['Official artist site', 'New music, tour dates & EPK'],
  labels: ['Independent record label', 'Releases, roster & demos'],
  beats: ['Lease & exclusive beats', 'Instrumentals for artists'],
  vinyl: ['Records, cassettes & merch', 'Small-batch vinyl & apparel'],
  live: ['Shows, tickets & tour dates', 'Live music ticketing'],
  community: ['A community for music makers', 'Feedback, collabs & forums'],
  sync: ['Music for film, TV & ads', 'Pre-cleared sync catalog'],
  synths: ['Synths, modules & studio gear', 'Boutique hardware instruments'],
};

/**
 * Deterministic "scrape" used by the browser demo. The server replaces this with a real fetch of
 * OpenGraph / <title> / favicon data (see server/scrape.ts) and falls back to it on failure.
 */
export function simulateMetadata(target: NormalizedTarget): SiteMetadata {
  const segments = target.key.split(/[/?]/);
  const platform = PLATFORM_LABEL.find(([re]) => re.test(target.host))?.[1];
  let base: string;
  if (target.kind === 'handle') base = target.display;
  else if (platform && segments.length > 1) base = titleCase(segments[segments.length - 1].replace(/^@/, ''));
  else if (/\.bandcamp\.com$|\.gumroad\.com$/.test(target.host)) base = titleCase(target.host.split('.')[0]);
  else base = titleCase(target.host.split('.').slice(0, -1).join(' '));
  if (/^[A-Za-z0-9]{18,}$/.test(base.replace(/\s/g, ''))) base = 'Untitled release';

  const category = detectCategory(target.host, `${target.key} ${base}`);
  const rand = mulberry32(hashString(target.key));
  const pool = TAGLINES[category];
  const tagline = platform ? `${pool[0]} ${platform}` : pool[Math.floor(rand() * pool.length)];
  const description = `${base} — ${tagline.toLowerCase()}. Listed on the public music leaderboard at ${target.display}.`;
  return {
    title: base,
    tagline,
    description,
    category,
    artwork: generateArtwork(target.key, base),
    preview: generatePreview(target.key, category),
    source: 'simulated',
  };
}
