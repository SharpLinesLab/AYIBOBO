import { GENRES, genreById } from './genres';
import type { Artist, GenreId, Playlist, Track } from './types';
import { hashString, mulberry32 } from '../lib/metadata';

/**
 * Personal mixes ("ASF Mix 1…6"): one per genre you listen to most, falling back to the most
 * popular genres. Each mix blends that genre's strongest tracks in a stable shuffled order.
 */
export function createMixes(tracks: Track[], artists: Artist[], likedIds: string[], recentIds: string[]): Playlist[] {
  const weight = new Map<GenreId, number>();
  const byId = new Map(tracks.map((t) => [t.id, t]));
  for (const id of likedIds) {
    const t = byId.get(id);
    if (t) weight.set(t.genre, (weight.get(t.genre) ?? 0) + 3);
  }
  for (const id of recentIds) {
    const t = byId.get(id);
    if (t) weight.set(t.genre, (weight.get(t.genre) ?? 0) + 1);
  }
  const popularity = new Map<GenreId, number>();
  for (const t of tracks) popularity.set(t.genre, (popularity.get(t.genre) ?? 0) + t.popularity);
  const genres = GENRES.map((g) => g.id)
    .filter((g) => tracks.some((t) => t.genre === g))
    .sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0) || (popularity.get(b) ?? 0) - (popularity.get(a) ?? 0))
    .slice(0, 6);

  return genres.map((g, i) => {
    const pool = tracks.filter((t) => t.genre === g && !t.uploaded).sort((a, b) => b.popularity - a.popularity).slice(0, 30);
    const r = mulberry32(hashString(`mix:${g}`));
    const ids = pool.map((t) => ({ t, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.t.id);
    const leads = artists.filter((a) => a.genres.includes(g)).sort((a, b) => b.followers - a.followers).slice(0, 3);
    const names = leads.map((a) => a.name);
    const genre = genreById(g);
    return {
      id: `mix-${g}`,
      title: `ASF Mix ${i + 1}`,
      curator: 'Made for you',
      description: `${genre.label} — ${names.slice(0, 2).join(', ')}${names.length > 2 ? ' and more' : ''}`,
      trackIds: ids,
      cover: {
        template: 'mix',
        palette: ['#0b0c0f', genre.colors[0], genre.colors[1]],
        seed: hashString(`mixcover:${g}`),
        figures: leads.map((a) => a.avatar.seed),
      },
      followers: 0,
      editorial: false,
    };
  });
}
