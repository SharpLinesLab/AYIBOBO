import type { Album, Artist, Catalog, Playlist, Track } from './types';
import { genreById } from './genres';

export interface CatalogResults {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function score(fields: string[], q: string): number {
  let best = 0;
  fields.forEach((f, i) => {
    const v = norm(f);
    const w = i === 0 ? 3 : 1;
    if (v === q) best = Math.max(best, 100 * w);
    else if (v.startsWith(q)) best = Math.max(best, 60 * w);
    else if (v.split(/\s+/).some((word) => word.startsWith(q))) best = Math.max(best, 40 * w);
    else if (v.includes(q)) best = Math.max(best, 20 * w);
  });
  return best;
}

/** Accent-insensitive search across the catalog ("ayiti" finds "Ayiti Chérie"). */
export function searchCatalog(c: Catalog, raw: string, limit = 20): CatalogResults {
  const q = norm(raw.trim());
  if (!q) return { tracks: [], artists: [], albums: [], playlists: [] };
  const names = new Map(c.artists.map((a) => [a.id, a.name]));
  const rank = <T,>(items: T[], fields: (x: T) => string[]) =>
    items
      .map((x) => ({ x, s: score(fields(x), q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((r) => r.x);
  return {
    tracks: rank(c.tracks, (t) => [t.title, names.get(t.artistId) ?? '', genreById(t.genre).label, ...(t.featuring ?? []).map((id) => names.get(id) ?? '')]),
    artists: rank(c.artists, (a) => [a.name, a.location, ...a.genres.map((g) => genreById(g).label)]),
    albums: rank(c.albums, (a) => [a.title, names.get(a.artistId) ?? '']),
    playlists: rank(c.playlists, (p) => [p.title, p.curator, p.description]),
  };
}
