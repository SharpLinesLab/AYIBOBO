/**
 * Songs artists published through the server (approved in moderation), shaped like catalog
 * tracks so every page, the player and offline downloads treat them like any other song.
 */
import { genreById, isGenreId } from '../catalog/genres';
import type { Artist, CoverSpec, GenreId, Track } from '../catalog/types';
import { hashString } from './random';

export interface PublishedTrack {
  id: string;
  title: string;
  genre: GenreId;
  artistId: string;
  artistName: string;
  duration: number;
  peaks: number[] | null;
  releasedAt: number;
  audioUrl: string;
  coverUrl: string;
}

/** Fired after an admin approves a song, so open pages pick it up without a reload. */
export const CATALOG_CHANGED = 'asf:catalog-changed';

/** Approved songs, or [] on static hosting (no API server) or when offline. */
export async function fetchPublished(): Promise<PublishedTrack[]> {
  try {
    const res = await fetch('/api/catalog/uploads');
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return [];
    const body = (await res.json()) as { tracks?: PublishedTrack[] };
    return (body.tracks ?? []).filter((t) => isGenreId(t.genre));
  } catch {
    return [];
  }
}

const palette = (g: GenreId): [string, string, string] => ['#0b0c0f', genreById(g).colors[0], genreById(g).colors[1]];

/** Catalog tracks and artists (one per artist account) for the published songs. */
export function toCatalog(list: PublishedTrack[]): { tracks: Track[]; artists: Artist[] } {
  const artists = new Map<string, Artist>();
  const tracks = list.map((p): Track => {
    const artistId = `ar-srv-${p.artistId}`;
    const seed = hashString(p.id);
    const artist = artists.get(artistId);
    if (!artist) {
      const s = hashString(artistId);
      const spec = (template: CoverSpec['template']): CoverSpec => ({ template, palette: palette(p.genre), seed: s });
      artists.set(artistId, {
        id: artistId,
        name: p.artistName,
        handle: `@${p.artistName.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
        bio: '',
        location: '',
        genres: [p.genre],
        verified: false,
        followers: 0,
        avatar: spec('portrait'),
        banner: spec('stage'),
        poster: spec('poster'),
      });
    } else if (!artist.genres.includes(p.genre)) artist.genres.push(p.genre);
    return {
      id: `srv-${p.id}`,
      title: p.title,
      artistId,
      genre: p.genre,
      duration: p.duration,
      // Unused for playback (the file plays), but every track carries a recipe.
      recipe: { genre: p.genre, bpm: 100, root: 48, seed, scale: 'minor' },
      popularity: 0.3,
      releasedAt: p.releasedAt,
      cover: { template: 'orb', palette: palette(p.genre), seed, imageUrl: p.coverUrl },
      explicit: false,
      description: '',
      audioUrl: p.audioUrl,
      peaks: p.peaks ?? undefined,
      published: true,
    };
  });
  return { tracks, artists: [...artists.values()] };
}
