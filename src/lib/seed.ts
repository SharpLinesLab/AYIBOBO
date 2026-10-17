import { generateArtwork, generatePreview, mulberry32 } from './metadata';
import { prettyDisplay } from './normalize';
import { startOfUtcDay } from './ranking';
import type { Artwork, CategoryId, LeaderboardState, Listing, Payment, SynthPreview } from './types';

interface SeedListing {
  key: string;
  url: string;
  title: string;
  tagline: string;
  description: string;
  category: CategoryId;
  total: number;
  clicks: number;
  /** Days since the listing was first paid. */
  age: number;
  style: SynthPreview['style'];
  art: [string, string];
  glyph?: string;
  /** Dollars paid today (part of `total`). */
  today?: number;
  /** Hours ago of the most recent non-today payment (keeps the activity feed lively). */
  recentHours?: number;
}

// All listings are fictional demo data — no real company has paid for these ranks.
const SEED: SeedListing[] = [
  {
    key: 'stemforge.ai',
    url: 'https://stemforge.ai',
    title: 'StemForge',
    tagline: 'AI stem splitter for vocals, drums & bass',
    description:
      'Drop in any mixed track and get studio-clean vocals, drums, bass and instruments back in seconds. Built for remixers, DJs and music teachers, with batch processing and lossless WAV export.',
    category: 'ai',
    total: 17001,
    clicks: 67060,
    age: 212,
    style: 'arp',
    art: ['#18181B', '#E86C52'],
    glyph: 'SF',
    recentHours: 30,
  },
  {
    key: 'tapedeck.studio',
    url: 'https://tapedeck.studio',
    title: 'Tapedeck',
    tagline: 'The browser DAW for collaborative sessions',
    description:
      'A full multitrack DAW that runs in a browser tab. Invite collaborators with a link, track live together and bounce stems straight to your distributor — no installs, no dongles.',
    category: 'daws',
    total: 15250,
    clicks: 52310,
    age: 188,
    style: 'pluck',
    art: ['#4338CA', '#818CF8'],
    glyph: 'TD',
  },
  {
    key: 'grainfield.audio',
    url: 'https://grainfield.audio',
    title: 'Grainfield',
    tagline: 'Royalty-free sample pack marketplace',
    description:
      'Thousands of royalty-free loops, one-shots and construction kits from independent sound designers. Credits roll over and every sample is cleared for commercial release.',
    category: 'samples',
    total: 14120,
    clicks: 48775,
    age: 176,
    style: 'beat',
    art: ['#92400E', '#FBBF24'],
    glyph: 'GF',
    recentHours: 52,
  },
  {
    key: 'velvetstatic.com',
    url: 'https://velvetstatic.com',
    title: 'Velvet Static Records',
    tagline: 'Indie label for dream pop & left-field electronic',
    description:
      'Brooklyn-born independent label releasing dream pop, shoegaze and left-field electronic on limited-run vinyl. Open demo inbox and artist-friendly 50/50 splits.',
    category: 'labels',
    total: 13005,
    clicks: 21940,
    age: 160,
    style: 'pad',
    art: ['#BE185D', '#FB7185'],
    glyph: 'VS',
  },
  {
    key: 'lumenmodular.com',
    url: 'https://lumenmodular.com',
    title: 'Lumen Modular',
    tagline: 'Boutique Eurorack modules, handmade in Montréal',
    description:
      'Small-batch Eurorack oscillators, filters and quirky modulation sources, hand-assembled and tested one at a time. Open-source firmware and lifetime repairs.',
    category: 'synths',
    total: 11480,
    clicks: 18402,
    age: 151,
    style: 'bass',
    art: ['#0F766E', '#5EEAD4'],
    glyph: 'LM',
  },
  {
    key: 'pressplant.fm',
    url: 'https://pressplant.fm',
    title: 'PressPlant',
    tagline: 'Crowdfunded vinyl pressing for independent artists',
    description:
      'Launch a pre-order campaign and only press when you hit your goal. Test pressings, jackets, inserts and fulfilment handled — artists keep their masters and their margin.',
    category: 'vinyl',
    total: 9875,
    clicks: 15990,
    age: 140,
    style: 'lofi',
    art: ['#1F2937', '#F5B5A6'],
    glyph: 'PP',
    recentHours: 76,
  },
  {
    key: 'cuesheet.co',
    url: 'https://cuesheet.co',
    title: 'Cuesheet',
    tagline: 'Pre-cleared sync licensing library',
    description:
      'A one-stop, pre-cleared catalog of independent music for film, TV, games and ads. Transparent licence tiers, stems on every track, and 70% of every fee goes to the artist.',
    category: 'sync',
    total: 8640,
    clicks: 12455,
    age: 133,
    style: 'pad',
    art: ['#111827', '#6B7280'],
    glyph: 'CS',
  },
  {
    key: 'nightbus.bandcamp.com',
    url: 'https://nightbus.bandcamp.com',
    title: 'Night Bus',
    tagline: "New LP 'Sodium Lights' out now on Bandcamp",
    description:
      'Glasgow four-piece making rain-soaked post-punk for the last ride home. Name-your-price downloads, limited translucent-orange vinyl and a live session EP.',
    category: 'artist',
    total: 7300,
    clicks: 9870,
    age: 120,
    style: 'lofi',
    art: ['#F59E0B', '#EF4444'],
    glyph: 'NB',
  },
  {
    key: 'deepcuts.radio',
    url: 'https://deepcuts.radio',
    title: 'Deep Cuts Radio',
    tagline: '24/7 human-curated independent radio',
    description:
      'Non-stop independent radio programmed entirely by human DJs — no playlists picked by a model, no payola. Every track links straight to the artist’s own store.',
    category: 'streaming',
    total: 6250,
    clicks: 11230,
    age: 104,
    style: 'lofi',
    art: ['#0EA5E9', '#22D3EE'],
    glyph: 'DC',
    recentHours: 20,
  },
  {
    key: 'beatvault.store',
    url: 'https://beatvault.store',
    title: 'BeatVault',
    tagline: 'Lease beats from 400+ independent producers',
    description:
      'Shop leases and exclusives from hundreds of independent producers with clear, plain-English contracts. Instant stems, tagged previews and split sheets generated for you.',
    category: 'beats',
    total: 5480,
    clicks: 8760,
    age: 96,
    style: 'beat',
    art: ['#7C3AED', '#F472B6'],
    glyph: 'BV',
  },
  {
    key: 'backline.live',
    url: 'https://backline.live',
    title: 'Backline',
    tagline: 'Fan-first ticketing for small venues',
    description:
      'Ticketing built for 50- to 800-cap rooms: flat fees, face-value resale only and payouts the morning after the show. Door scanning works offline in basements.',
    category: 'live',
    total: 4990,
    clicks: 6120,
    age: 88,
    style: 'beat',
    art: ['#16A34A', '#A3E635'],
    glyph: 'BL',
    recentHours: 41,
  },
  {
    key: 'patchbay.community',
    url: 'https://patchbay.community',
    title: 'Patchbay',
    tagline: 'Forum & feedback circles for bedroom producers',
    description:
      'A friendly forum and weekly feedback circles for producers at every level. Post a work-in-progress, get three thoughtful critiques, give three back.',
    category: 'community',
    total: 4200,
    clicks: 7340,
    age: 75,
    style: 'pluck',
    art: ['#E86C52', '#F5B5A6'],
    glyph: 'PB',
  },
  {
    key: 'gumroad.com/l/halcyonverb',
    url: 'https://gumroad.com/l/halcyonverb',
    title: 'Halcyon Verb',
    tagline: 'Shimmer reverb plugin · VST3 / AU / AAX',
    description:
      'A lush shimmer and freeze reverb from a one-person plugin studio. Pitch-shifted tails, ducking and a CPU-light “tape” mode. Pay what you want, free updates forever.',
    category: 'daws',
    total: 3800,
    clicks: 5210,
    age: 64,
    style: 'pad',
    art: ['#4338CA', '#F5B5A6'],
    glyph: 'HV',
  },
  {
    key: 'soundcloud.com/kaimori',
    url: 'https://soundcloud.com/kaimori',
    title: 'Kai Mori',
    tagline: 'Lo-fi house & late-night edits on SoundCloud',
    description:
      'Osaka-based producer posting a new lo-fi house edit every Friday. Free downloads for followers, stems available for remixers.',
    category: 'artist',
    total: 3500,
    clicks: 4980,
    age: 55,
    style: 'lofi',
    art: ['#18181B', '#6B7280'],
    glyph: 'KM',
    recentHours: 64,
  },
  {
    key: 'drumcartel.com',
    url: 'https://drumcartel.com',
    title: 'Drum Cartel',
    tagline: 'Drum kits & one-shots for trap and drill',
    description:
      'Hard-hitting drum kits, 808s and one-shots processed on analog gear. Every kit ships with MIDI grooves and a royalty-free licence.',
    category: 'samples',
    total: 2875,
    clicks: 4410,
    age: 47,
    style: 'beat',
    art: ['#111827', '#EF4444'],
    glyph: 'DC',
  },
  {
    key: 'lyriclab.ai',
    url: 'https://lyriclab.ai',
    title: 'LyricLab',
    tagline: 'AI co-writer for hooks, rhymes & toplines',
    description:
      'A songwriting notebook with an AI rhyme and melody assistant. Suggests internal rhymes, counts syllables against your beat and never claims ownership of your lyrics.',
    category: 'ai',
    total: 2200,
    clicks: 3860,
    age: 38,
    style: 'arp',
    art: ['#0EA5E9', '#818CF8'],
    glyph: 'LL',
  },
  {
    key: 'aurelia.world',
    url: 'https://aurelia.world',
    title: 'Aurelia',
    tagline: 'Interactive 3D album world & EPK',
    description:
      'Walk through the new record as an explorable 3D world in your browser — each room unlocks a track, liner notes and a press kit download.',
    category: 'artist',
    total: 1640,
    clicks: 2950,
    age: 29,
    style: 'pad',
    art: ['#BE185D', '#818CF8'],
    glyph: 'AU',
    today: 10,
  },
  {
    key: 'loopcrate.co',
    url: 'https://loopcrate.co',
    title: 'LoopCrate',
    tagline: 'Loop & sample kits',
    description:
      'Genre-spanning loop kits — afro house, amapiano, kompa and drill — recorded with live players and delivered key- and tempo-labelled.',
    category: 'samples',
    total: 1250,
    clicks: 2310,
    age: 21,
    style: 'beat',
    art: ['#F59E0B', '#E86C52'],
    glyph: 'LC',
    today: 15,
  },
  {
    key: 'fuzzhouse.shop',
    url: 'https://fuzzhouse.shop',
    title: 'Fuzzhouse',
    tagline: 'Hand-wired fuzz & delay pedals',
    description:
      'Point-to-point wired fuzz, octave and tape-delay pedals built in a garage in Detroit. Every enclosure is hand-painted, every pedal has a name.',
    category: 'synths',
    total: 900,
    clicks: 1475,
    age: 12,
    style: 'bass',
    art: ['#92400E', '#F5B5A6'],
    glyph: 'FH',
    today: 10,
  },
  {
    key: 'open.spotify.com/artist/4Zq8MaraOkoyeDemo01x',
    url: 'https://open.spotify.com/artist/4Zq8MaraOkoyeDemo01x',
    title: 'Mara Okoye',
    tagline: 'Afro-soul singer-songwriter on Spotify',
    description:
      'Lagos-to-London singer-songwriter blending afro-soul, highlife guitar and gospel harmonies. Debut EP “Harmattan” out now.',
    category: 'artist',
    total: 600,
    clicks: 1120,
    age: 6,
    style: 'lofi',
    art: ['#16A34A', '#FBBF24'],
    glyph: 'MO',
  },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function splitAmount(total: number, parts: number, rand: () => number): number[] {
  if (parts <= 1 || total < parts * 10) return [total];
  const weights = Array.from({ length: parts }, () => 0.4 + rand());
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.max(10, Math.floor((total * w) / sum)));
  out[0] += total - out.reduce((a, b) => a + b, 0);
  if (out[0] < 10) return [total];
  return out;
}

/**
 * Build the demo leaderboard relative to `now`, so the "Today" board and activity feed always
 * look live. Deterministic for a given `now`.
 */
export function createSeedState(now: number): LeaderboardState {
  const dayStart = startOfUtcDay(now);
  const elapsedToday = Math.max(now - dayStart, 60_000);
  const listings: Listing[] = [];
  const payments: Payment[] = [];

  SEED.forEach((s, i) => {
    const id = `lst_seed_${String(i + 1).padStart(2, '0')}`;
    const rand = mulberry32(1000 + i);
    // Seed history must predate today, so the Today board only holds the explicit today bids.
    const createdAt = Math.min(now - s.age * DAY - Math.floor(rand() * 10 * HOUR), dayStart - 2 * DAY);
    const artwork: Artwork = { ...generateArtwork(s.key, s.title), from: s.art[0], to: s.art[1], glyph: s.glyph ?? s.title.slice(0, 2).toUpperCase() };
    const preview = { ...generatePreview(s.key, s.category), style: s.style } as SynthPreview;
    listings.push({
      id,
      key: s.key,
      url: s.url,
      display: prettyDisplay(s.key),
      title: s.title,
      tagline: s.tagline,
      description: s.description,
      category: s.category,
      artwork,
      preview,
      clicks: s.clicks,
      createdAt,
    });

    const historical = s.total - (s.today ?? 0);
    const parts = 1 + Math.floor(rand() * 4) + (s.total > 8000 ? 2 : 0);
    const amounts = splitAmount(historical, parts, rand);
    const latestRaw =
      s.recentHours !== undefined
        ? Math.min(now - s.recentHours * HOUR, dayStart - HOUR)
        : dayStart - DAY - Math.floor(rand() * Math.min(s.age - 1, 20) * DAY);
    const latest = Math.max(latestRaw, createdAt + HOUR);
    amounts.forEach((amount, j) => {
      const at = j === 0 ? createdAt : createdAt + ((latest - createdAt) * j) / (amounts.length - 1);
      payments.push({ id: `pay_seed_${i + 1}_${j + 1}`, listingId: id, amount, at: Math.round(at) });
    });
    if (s.today) {
      // Spread today's bids over the part of the day that has elapsed: LoopCrate first, then the $10s.
      const order = s.key === 'loopcrate.co' ? 0.25 : s.key === 'aurelia.world' ? 0.5 : 0.8;
      payments.push({ id: `pay_seed_${i + 1}_today`, listingId: id, amount: s.today, at: Math.round(dayStart + elapsedToday * order) });
    }
  });

  payments.sort((a, b) => a.at - b.at);
  return { listings, payments };
}

/** Lifetime visitor count before the demo started, used by the footer milestones. */
export const SEED_LIFETIME_VISITORS = 418_240;
