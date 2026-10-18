/**
 * Real artwork, auto-discovered from src/assets/artwork (see the README there). Anything found
 * overrides the generated art; missing files simply fall back to the generative designs.
 */
import type { Catalog, CoverSpec } from './types';

const files = import.meta.glob<string>('../assets/artwork/**/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' });

const byName = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const m = /artwork\/(artists|releases)\/(.+)\.(?:jpe?g|png|webp|avif)$/i.exec(path);
  if (m) byName.set(`${m[1]}/${m[2]}`, url);
}

const withImage = (spec: CoverSpec, url: string | undefined): CoverSpec => (url ? { ...spec, imageUrl: url } : spec);

export function hasRealArtwork(): boolean {
  return byName.size > 0;
}

export function applyArtwork(c: Catalog): Catalog {
  if (!byName.size) return c;
  const releaseArt = (id: string) => byName.get(`releases/${id}`);
  return {
    artists: c.artists.map((a) => {
      const photo = byName.get(`artists/${a.id}`);
      const poster = byName.get(`artists/${a.id}-poster`) ?? photo;
      const banner = byName.get(`artists/${a.id}-banner`) ?? poster;
      return { ...a, avatar: withImage(a.avatar, photo ?? poster), poster: withImage(a.poster, poster), banner: withImage(a.banner, banner) };
    }),
    albums: c.albums.map((al) => ({ ...al, cover: withImage(al.cover, releaseArt(al.id)) })),
    tracks: c.tracks.map((t) => ({ ...t, cover: withImage(t.cover, releaseArt(t.id) ?? (t.albumId ? releaseArt(t.albumId) : undefined)) })),
    playlists: c.playlists.map((p) => ({ ...p, cover: withImage(p.cover, releaseArt(p.id)) })),
  };
}
