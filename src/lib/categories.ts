import { t } from '../i18n';
import type { CategoryId } from './types';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
}

const DEFS: [CategoryId, string][] = [
  ['streaming', '📡'],
  ['daws', '🎛️'],
  ['samples', '🥁'],
  ['ai', '✨'],
  ['artist', '🎤'],
  ['labels', '💿'],
  ['beats', '🎧'],
  ['vinyl', '📀'],
  ['live', '🎟️'],
  ['community', '💬'],
  ['sync', '🎬'],
  ['synths', '🎹'],
];

/** Category label in the current interface language. */
export function categoryLabel(id: CategoryId): string {
  return t(`boost.cat.${id}`);
}

/** `label` is resolved on every read, so it always follows the current language. */
export const CATEGORIES: Category[] = DEFS.map(([id, icon]) => ({
  id,
  icon,
  get label() {
    return categoryLabel(id);
  },
}));

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id: CategoryId): Category {
  return BY_ID.get(id) ?? CATEGORIES[0];
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && BY_ID.has(value as CategoryId);
}

const KEYWORDS: [CategoryId, RegExp][] = [
  ['ai', /\b(ai|a\.i\.|stem|stems|splitter|separat|neural|generat|mastering ai|vocal remover)\b|\.ai\b/i],
  ['sync', /\b(sync|licens|music library|production music|cue|placement|royalty[- ]free music)/i],
  ['samples', /\b(sample|samples|loops?|one[- ]shots?|drum kits?|sound ?kits?|presets?|packs?)\b/i],
  ['daws', /\b(daw|plugin|plug-in|vst|au|aax|reverb|compressor|eq|mixing|effect|daw)\b/i],
  ['synths', /\b(synth|synthesizer|modular|eurorack|pedal|gear|keyboard|drum machine|hardware)/i],
  ['beats', /\b(beats?|instrumentals?|type beat|leases?|producer store)\b/i],
  ['vinyl', /\b(vinyl|pressing|merch|cassette|records? store|lathe|apparel|tee)\b/i],
  ['live', /\b(tickets?|ticketing|tour|concerts?|gigs?|live|venue|festival)\b/i],
  ['labels', /\b(label|records|recordings|imprint|roster)\b/i],
  ['community', /\b(community|forum|collective|club|network|members|discussion)\b/i],
  ['streaming', /\b(stream|radio|discover|playlist|podcast|listen)\b/i],
  ['artist', /\b(artist|band|singer|songwriter|rapper|dj|epk|official site|musician|album|ep|single)\b/i],
];

const PLATFORM_CATEGORY: [RegExp, CategoryId][] = [
  [/(^|\.)bandcamp\.com/, 'artist'],
  [/^open\.spotify\.com/, 'artist'],
  [/^soundcloud\.com/, 'artist'],
  [/^music\.apple\.com/, 'artist'],
  [/^audiomack\.com/, 'artist'],
  [/^youtube\.com/, 'artist'],
  [/^beatstars\.com/, 'beats'],
  [/^airbit\.com/, 'beats'],
  [/^splice\.com/, 'samples'],
  [/^pluginboutique\.com/, 'daws'],
  [/^kvraudio\.com/, 'daws'],
  [/(^|\.)gumroad\.com/, 'daws'],
  [/^discogs\.com/, 'vinyl'],
  [/^reverb\.com/, 'synths'],
];

/** Heuristic category detection from a host and any text we managed to scrape. */
export function detectCategory(host: string, text: string): CategoryId {
  for (const [id, re] of KEYWORDS) {
    if (re.test(text)) return id;
  }
  for (const [re, id] of PLATFORM_CATEGORY) {
    if (re.test(host)) return id;
  }
  const hostWords = host.replace(/[.\-/@]/g, ' ');
  for (const [id, re] of KEYWORDS) {
    if (re.test(hostWords)) return id;
  }
  return 'artist';
}
