/**
 * Demo catalog. Every artist, release and playlist here is fictional; audio is synthesized live
 * from each track's recipe, and artwork is generated (see covers.ts).
 */
import { t, type Key } from '../i18n';
import { hashString, mulberry32 } from '../lib/random';
import { applyArtwork } from './artwork';
import { PALETTES, makeCover } from './covers';
import { STAGE_PALETTES } from './poster';
import type { Album, Artist, Catalog, GenreId, Playlist, Track } from './types';

const DAY = 86_400_000;

interface ArtistSeed {
  name: string;
  location: string;
  genres: GenreId[];
  verified?: boolean;
  followers: number;
}

const ARTISTS: ArtistSeed[] = [
  { name: 'Lavi Soley', location: 'Port-au-Prince, HT', genres: ['kompa', 'zouk'], verified: true, followers: 412_000 },
  { name: 'Tiga Blaze', location: 'Cap-Haïtien, HT', genres: ['rap-kreyol', 'drill'], verified: true, followers: 655_000 },
  { name: 'Nadège Fleur', location: 'Montréal, QC', genres: ['zouk', 'rnb'], verified: true, followers: 288_000 },
  { name: 'Kreyòl Kingz', location: 'Miami, FL', genres: ['rap-kreyol', 'hip-hop'], followers: 190_000 },
  { name: 'Mano Jakmel', location: 'Jacmel, HT', genres: ['rara', 'afrobeats'], followers: 97_000 },
  { name: 'Sisi Lune', location: 'Lagos ⇄ Brooklyn', genres: ['afrobeats', 'rnb'], verified: true, followers: 530_000 },
  { name: 'DJ Bèlè', location: 'Brooklyn, NY', genres: ['amapiano', 'electronic'], verified: true, followers: 341_000 },
  { name: 'Port Lights', location: 'Pétion-Ville, HT', genres: ['electronic'], followers: 64_000 },
  { name: 'Ti Pòl', location: 'Kingston ⇄ Delmas', genres: ['dancehall'], followers: 158_000 },
  { name: 'Marlo Vibe', location: 'Boston, MA', genres: ['drill', 'hip-hop'], followers: 221_000 },
  { name: 'Chœur Lumière', location: 'Les Cayes, HT', genres: ['gospel'], followers: 88_000 },
  { name: 'Roots Lakay', location: 'Gonaïves, HT', genres: ['reggae'], followers: 73_000 },
  { name: 'Azeline', location: 'Paris, FR', genres: ['rnb'], verified: true, followers: 276_000 },
  { name: 'Kalfou', location: 'Léogâne, HT', genres: ['rara', 'electronic'], followers: 41_000 },
  { name: 'Zenn & Saj', location: 'Accra ⇄ Miami', genres: ['afrobeats', 'amapiano'], followers: 145_000 },
  { name: 'Okap Express', location: 'Cap-Haïtien, HT', genres: ['kompa'], followers: 118_000 },
  { name: 'Nova Dlo', location: 'Atlanta, GA', genres: ['rnb', 'hip-hop'], followers: 66_000 },
  { name: 'Laj Mizik', location: 'Santo Domingo ⇄ Hinche', genres: ['dancehall', 'electronic'], followers: 52_000 },
];

const TITLES = [
  'Lanmou Pa Fasil', 'Soley Leve', 'Bèl Ti Fanm', 'Lakay Se Lakay', 'Midnight in Pétion-Ville', 'Dife', 'Rele M', 'Kè M Kontan',
  'Zanmi', 'Lavi Bèl', 'Pa Kite M', 'Danse Avè M', 'Lanmè', 'Fanmi', 'Pwomès', 'Rasin', 'Lalin', 'Kanaval', 'Bon Bagay', 'Gade M',
  'Sou Beton', 'No Sleep in Jacmel', 'Island Gold', 'Velvet Night', 'Overtime', 'Golden Hour', 'Moving Different', 'Wave Runner',
  'City Lights', 'Patience', 'Higher Ground', 'Pressure', 'Blessings', 'Run It Up', 'Mango Season', 'Salt Water', 'Back Home',
  'Slow Wine', 'Late Checkout', 'Ayiti Chérie', 'Tanbou', 'Vaksin', 'Ti Kabann', 'Rive Ou Rive', 'Ou Se Pa M', 'Lapli',
  'Lò M Wè W', 'Kite Yo Pale', 'Pa Gen Pwoblèm', 'Sezon Lanmou', 'Lespwa', 'Toujou La', 'Fè M Konfyans', 'Ale Vini', 'Grenn Pwomès',
  'Dlo Nan Je', 'Koulè', 'Mache Ansanm', 'Bri Kouri', 'Banm Nouvèl', 'Gwo Lajounen', 'Nwit Blanch', 'Kenbe Fèm', 'Tèt Ansanm',
  'Afro Sunday', 'Shekere', 'Honey Glaze', 'Lagos to Labadie', 'Blue Hour', 'Piano Wine', 'Log Drum Love', 'Sunset Boulevard',
  'Riddim Ting', 'Session', 'Bus Stop', 'Turn It Up', 'Badman Ting', 'Zero Stress', 'Gully Side', 'Fire Inna Di Place',
  'Cold Nights', 'Slide', 'No Hook', 'Ten Toes', 'Opps Outside', 'Brick by Brick', 'Day One', 'Real Ones', 'Trenches to Penthouse',
  'Silk', 'Wrong Number', 'Stay a While', 'Undertow', 'Satellite', 'Pillow Talk', 'Fever', 'Gravity', 'Slow Motion',
  'Glory', 'Mèsi Jezi', 'Lafwa', 'Beni', 'Amen Lakay', 'One Drop', 'Jah Guide', 'Roots Rock Lakay', 'Freedom Road',
  'Tonnè', 'Kata', 'Bann Nan Lari', 'Ochan', 'Neon Kanaval', 'Night Drive', 'Static Sea', 'Afterglow', 'Halo',
  'Kreyòl Flow', 'Kapab', 'Tout Moun', 'Sa Nou Ye', 'Rich Lakay', 'Ti Chans', 'Bouje', 'Pa Fè Bri', 'Okap', 'Nan Lari a',
];

const ALBUM_NAMES = [
  'Sezon Soley', 'Okap Stories', 'Velvet Island', 'Little Haiti Tapes', 'Kanaval Forever', 'Moonlit Lagos', 'Brooklyn Bèlè',
  'Lights Over Port', 'Delmas Riddim', 'Night Shift', 'Lumière', 'Roots & Rasin', 'Minuit', 'Kalfou', 'Twin Flames', 'Direk',
  'Water Signs', 'Frontera',
];

/** Release blurbs, read in the interface language (`catalog.desc.N`). */
const DESCRIPTIONS = 7;
const description = (r: () => number) => t(`catalog.desc.${Math.floor(r() * DESCRIPTIONS)}` as Key);

const SCALE_BY_GENRE: Record<GenreId, 'minor' | 'major'> = {
  kompa: 'major',
  'rap-kreyol': 'minor',
  afrobeats: 'major',
  amapiano: 'minor',
  dancehall: 'minor',
  'hip-hop': 'minor',
  drill: 'minor',
  rnb: 'minor',
  zouk: 'minor',
  reggae: 'major',
  gospel: 'major',
  rara: 'minor',
  electronic: 'minor',
};

const BPM: Record<GenreId, [number, number]> = {
  kompa: [112, 124],
  'rap-kreyol': [136, 148],
  afrobeats: [100, 110],
  amapiano: [110, 114],
  dancehall: [92, 102],
  'hip-hop': [86, 96],
  drill: [140, 146],
  rnb: [68, 84],
  zouk: [92, 100],
  reggae: [70, 78],
  gospel: [72, 92],
  rara: [112, 122],
  electronic: [120, 128],
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Build the demo catalog relative to `now` so "new releases" always look fresh. */
export function createCatalog(now: number): Catalog {
  const artists: Artist[] = [];
  const tracks: Track[] = [];
  const albums: Album[] = [];
  const titles = [...TITLES];
  let titleCursor = 0;
  // Titles never repeat: once the list wraps, later uses become remixes / live versions.
  const nextTitle = () => {
    const i = titleCursor++;
    return titles[i % titles.length] + ['', ' (Remix)', ' (Live)', ' II'][Math.floor(i / titles.length) % 4];
  };

  ARTISTS.forEach((a, ai) => {
    const id = `ar-${slug(a.name)}`;
    const seed = hashString(id);
    const r = mulberry32(seed);
    const stage = STAGE_PALETTES[ai % STAGE_PALETTES.length];
    artists.push({
      id,
      name: a.name,
      handle: `@${slug(a.name).replace(/-/g, '')}`,
      bio: t(`catalog.bio.${slug(a.name)}` as Key),
      location: a.location,
      genres: a.genres,
      verified: !!a.verified,
      followers: a.followers,
      avatar: { template: 'portrait', palette: stage, seed },
      banner: { template: 'stage', palette: stage, seed },
      poster: { template: 'poster', palette: stage, seed },
    });

    const pop = a.followers / 100_000;
    const releaseCount = a.followers > 250_000 ? 2 : 1;
    for (let k = 0; k < releaseCount; k++) {
      const albumId = `al-${slug(a.name)}-${k + 1}`;
      const albumName = ALBUM_NAMES[(ai + k * 7) % ALBUM_NAMES.length];
      const n = 4 + Math.floor(r() * 5);
      const released = now - Math.floor((k === 0 ? 3 + r() * 120 : 140 + r() * 400) * DAY);
      const type: Album['type'] = n <= 5 ? 'ep' : a.genres.includes('rap-kreyol') || a.genres.includes('drill') ? 'mixtape' : 'album';
      // Lead releases are photo covers built around the artist; the rest use editorial designs.
      const cover =
        k === 0 || r() < 0.4
          ? { template: 'photo' as const, palette: stage, seed: hashString(albumId), figureSeed: seed, text: albumName, subtext: a.name }
          : makeCover(hashString(albumId), { palette: PALETTES[(ai + k * 5) % PALETTES.length], text: r() < 0.5 ? albumName : undefined, subtext: a.name });
      const ids: string[] = [];
      for (let t = 0; t < n; t++) {
        const tr = makeTrack(`${albumId}-${t + 1}`, nextTitle(), a, ai, id, released, pop * (t === 0 ? 1.6 : 1 - t * 0.06), cover, albumId);
        tracks.push(tr);
        ids.push(tr.id);
      }
      albums.push({
        id: albumId,
        title: albumName,
        artistId: id,
        type,
        trackIds: ids,
        releasedAt: released,
        cover,
        description: `${t(`catalog.release.${type}`, { name: a.name })} ${description(r)}`,
      });
    }
    const singles = 1 + Math.floor(r() * 3);
    for (let s = 0; s < singles; s++) {
      const sid = `tr-${slug(a.name)}-single-${s + 1}`;
      const released = now - Math.floor((s === 0 ? r() * 10 : 12 + r() * 200) * DAY);
      const title = nextTitle();
      const cover =
        s === 0 && r() < 0.6
          ? { template: 'photo' as const, palette: stage, seed: hashString(sid), figureSeed: seed, text: title, subtext: a.name }
          : makeCover(hashString(sid), { text: r() < 0.35 ? title : undefined, subtext: r() < 0.35 ? a.name : undefined });
      tracks.push(makeTrack(sid, title, a, ai, id, released, pop * (s === 0 ? 1.9 : 0.9), cover));
    }
  });

  // Features: sprinkle collaborations between artists that share a genre.
  const fr = mulberry32(99);
  for (const t of tracks) {
    if (fr() < 0.16) {
      const others = artists.filter((x) => x.id !== t.artistId && x.genres.includes(t.genre));
      if (others.length) t.featuring = [others[Math.floor(fr() * others.length)].id];
    }
  }

  const playlists = createPlaylists(tracks);
  return applyArtwork({ artists, tracks, albums, playlists });
}

function makeTrack(
  id: string,
  title: string,
  a: ArtistSeed,
  ai: number,
  artistId: string,
  releasedAt: number,
  popularity: number,
  cover: Track['cover'],
  albumId?: string,
): Track {
  const seed = hashString(id);
  const r = mulberry32(seed);
  const genre = a.genres[Math.floor(r() * a.genres.length)];
  const [lo, hi] = BPM[genre];
  return {
    id: albumId ? `tr-${id}` : id,
    title,
    artistId,
    albumId,
    genre,
    duration: 128 + Math.floor(r() * 90),
    recipe: { genre, bpm: lo + Math.floor(r() * (hi - lo + 1)), root: 43 + ((ai * 5 + Math.floor(r() * 12)) % 12), seed, scale: SCALE_BY_GENRE[genre] },
    popularity: Math.max(0.05, popularity * (0.6 + r() * 0.8)),
    releasedAt,
    cover,
    explicit: (genre === 'rap-kreyol' || genre === 'drill' || genre === 'hip-hop') && r() < 0.7,
    description: description(r),
  };
}

// Descriptions are `catalog.playlist.<slug>` in the interface language.
const EDITORIAL: { title: string; genres: GenreId[]; text: string; palette: number }[] = [
  { title: 'Kompa Kings', genres: ['kompa', 'zouk'], text: 'KOMPA KINGS', palette: 0 },
  { title: 'Rap Kreyòl Heat', genres: ['rap-kreyol', 'drill'], text: 'RAP KREYÒL', palette: 13 },
  { title: 'Afro Wave', genres: ['afrobeats', 'amapiano'], text: 'AFRO WAVE', palette: 2 },
  { title: 'Late Night R&B', genres: ['rnb', 'zouk'], text: 'LATE NIGHT', palette: 9 },
  { title: 'Kanaval Mode', genres: ['rara', 'dancehall', 'electronic'], text: 'KANAVAL', palette: 4 },
  { title: 'Sunday Praise', genres: ['gospel', 'reggae'], text: 'SUNDAY', palette: 10 },
  { title: 'Drill & Pressure', genres: ['drill', 'hip-hop'], text: 'PRESSURE', palette: 12 },
  { title: 'Lakay Chill', genres: ['zouk', 'reggae', 'rnb', 'kompa'], text: 'LAKAY CHILL', palette: 7 },
];

function createPlaylists(tracks: Track[]): Playlist[] {
  const out: Playlist[] = EDITORIAL.map((e, i) => {
    const pool = tracks.filter((t) => e.genres.includes(t.genre)).sort((a, b) => b.popularity - a.popularity);
    const r = mulberry32(500 + i);
    const ids = pool.slice(0, 16).sort(() => r() - 0.5).map((t) => t.id);
    return {
      id: `pl-${slug(e.title)}`,
      title: e.title,
      curator: t('catalog.curator'),
      description: t(`catalog.playlist.${slug(e.title)}` as Key),
      trackIds: ids,
      cover: makeCover(700 + i, { template: i % 2 ? 'type' : 'orb', palette: PALETTES[e.palette], text: e.text, subtext: t('catalog.cover.playlist') }),
      followers: Math.round(20_000 + r() * 180_000),
      editorial: true,
    };
  });
  const newest = [...tracks].sort((a, b) => b.releasedAt - a.releasedAt).slice(0, 20).map((t) => t.id);
  out.unshift({
    id: 'pl-new-heat-friday',
    title: 'New Heat Friday',
    curator: t('catalog.curator'),
    description: t('catalog.playlist.new-heat-friday'),
    trackIds: newest,
    cover: makeCover(777, { template: 'sun', palette: PALETTES[2], text: 'NEW HEAT', subtext: t('catalog.cover.everyFriday') }),
    followers: 238_400,
    editorial: true,
  });
  return out;
}
