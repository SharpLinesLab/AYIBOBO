/**
 * Music app state: the catalog (seed + your uploads), your library (likes, follows, playlists,
 * reposts, recently played, comments) and helpers to turn tracks into playable queue items.
 * Library data is stored per browser in localStorage; uploaded audio in IndexedDB.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { coverUrl, makeCover } from './catalog/covers';
import { lifetimePlays } from './catalog/plays';
import { createCatalog } from './catalog/seed';
import type { Album, Artist, Catalog, Playlist, Track } from './catalog/types';
import { deleteAudio, loadAudio } from './catalog/uploads';
import { getPosition, getState, onPlay, playQueue, subscribe, subscribePosition, toggleItem, type Playable, type PlayerState } from './player/engine';
import { synthPeaks } from './player/synth';

export interface Comment {
  id: string;
  author: string;
  text: string;
  at: number;
  /** Track position in seconds the comment was left at. */
  position?: number;
}

export interface Library {
  likes: string[];
  likedAlbums: string[];
  likedPlaylists: string[];
  follows: string[];
  reposts: string[];
  playlists: Playlist[];
  recents: string[];
  plays: Record<string, number>;
  comments: Record<string, Comment[]>;
  uploads: Track[];
  displayName: string;
}

const LIB_KEY = 'asf:library';
const EMPTY: Library = {
  likes: [],
  likedAlbums: [],
  likedPlaylists: [],
  follows: [],
  reposts: [],
  playlists: [],
  recents: [],
  plays: {},
  comments: {},
  uploads: [],
  displayName: '',
};

function readLibrary(): Library {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Library>) };
  } catch {
    /* corrupted / blocked */
  }
  return EMPTY;
}

function writeLibrary(l: Library) {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(l));
  } catch {
    /* storage full */
  }
}

const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [id, ...list]);

export interface MusicContextValue {
  catalog: Catalog;
  now: number;
  library: Library;
  track: (id: string) => Track | undefined;
  artist: (id: string) => Artist | undefined;
  album: (id: string) => Album | undefined;
  playlist: (id: string) => Playlist | undefined;
  tracksOf: (ids: string[]) => Track[];
  artistTracks: (artistId: string) => Track[];
  artistNames: (t: Track) => string;
  toPlayable: (t: Track) => Playable;
  play: (tracks: Track[], start?: number) => void;
  /** Toggle play/pause for `t`, using `context` as the queue when starting. */
  toggle: (t: Track, context?: Track[]) => void;
  peaks: (t: Track) => number[];
  totalPlays: (t: Track) => number;
  followerCount: (a: Artist) => number;
  isLiked: (id: string) => boolean;
  toggleLike: (id: string) => void;
  toggleRepost: (id: string) => void;
  toggleFollow: (id: string) => void;
  toggleLikeAlbum: (id: string) => void;
  toggleLikePlaylist: (id: string) => void;
  createPlaylist: (title: string, trackIds?: string[]) => Playlist;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addComment: (trackId: string, text: string, position?: number) => void;
  addUpload: (t: Track) => void;
  deleteUpload: (id: string) => Promise<void>;
  setDisplayName: (n: string) => void;
}

const Ctx = createContext<MusicContextValue | null>(null);

export function useMusic(): MusicContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMusic outside MusicProvider');
  return v;
}

export function MusicProvider({ now, children }: { now: number; children: ReactNode }) {
  // The seed is built once per session so ids/timestamps stay stable while the app is open.
  const [seed] = useState(() => createCatalog(Date.now()));
  const [library, setLibrary] = useState<Library>(readLibrary);
  const [uploadUrls, setUploadUrls] = useState<Record<string, string>>({});

  const update = useCallback((fn: (l: Library) => Library) => {
    setLibrary((prev) => {
      const next = fn(prev);
      writeLibrary(next);
      return next;
    });
  }, []);

  // Rehydrate uploaded audio from IndexedDB into object URLs (created once per upload, revoked on delete).
  const uploadIds = library.uploads.map((t) => t.id).join('|');
  useEffect(() => {
    let cancelled = false;
    const ids = uploadIds ? uploadIds.split('|') : [];
    (async () => {
      const add: Record<string, string> = {};
      for (const id of ids) {
        for (const key of [id, `${id}:cover`]) {
          if (uploadUrls[key]) continue;
          const blob = await loadAudio(key);
          if (blob) add[key] = URL.createObjectURL(blob);
        }
      }
      if (cancelled) {
        Object.values(add).forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setUploadUrls((prev) => {
        const next: Record<string, string> = {};
        for (const id of ids)
          for (const key of [id, `${id}:cover`]) if (prev[key] || add[key]) next[key] = prev[key] ?? add[key];
        for (const [key, u] of Object.entries(prev)) if (!next[key]) URL.revokeObjectURL(u);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [uploadIds]);

  const catalog: Catalog = useMemo(() => {
    const uploads = library.uploads.map((t) => {
      const art = uploadUrls[`${t.id}:cover`];
      return { ...t, audioUrl: uploadUrls[t.id], cover: art ? { ...t.cover, imageUrl: art } : t.cover };
    });
    return {
      artists: seed.artists,
      tracks: [...uploads, ...seed.tracks],
      albums: seed.albums,
      playlists: [...library.playlists, ...seed.playlists],
    };
  }, [seed, library.uploads, library.playlists, uploadUrls]);

  const maps = useMemo(
    () => ({
      tracks: new Map(catalog.tracks.map((t) => [t.id, t])),
      artists: new Map(catalog.artists.map((a) => [a.id, a])),
      albums: new Map(catalog.albums.map((a) => [a.id, a])),
      playlists: new Map(catalog.playlists.map((p) => [p.id, p])),
    }),
    [catalog],
  );

  const artistNames = useCallback(
    (t: Track) => {
      const main = maps.artists.get(t.artistId)?.name ?? library.displayName ?? 'You';
      const feats = (t.featuring ?? []).map((id) => maps.artists.get(id)?.name).filter(Boolean);
      return feats.length ? `${main} feat. ${feats.join(', ')}` : main || 'You';
    },
    [maps, library.displayName],
  );

  const toPlayable = useCallback(
    (t: Track): Playable => ({
      id: t.id,
      title: t.title,
      subtitle: artistNames(t),
      artwork: coverUrl(t.cover),
      duration: t.duration,
      source: t.audioUrl ? { kind: 'file', url: t.audioUrl } : { kind: 'synth', recipe: t.recipe },
      href: `#/song/${t.id}`,
      subtitleHref: maps.artists.has(t.artistId) ? `#/artist/${t.artistId}` : '#/library/uploads',
    }),
    [artistNames, maps],
  );

  // Count plays & recents for real tracks.
  useEffect(
    () =>
      onPlay((p) => {
        if (p.preview) return;
        update((l) => ({
          ...l,
          plays: { ...l.plays, [p.id]: (l.plays[p.id] ?? 0) + 1 },
          recents: [p.id, ...l.recents.filter((x) => x !== p.id)].slice(0, 50),
        }));
      }),
    [update],
  );

  const value: MusicContextValue = useMemo(() => {
    const tracksOf = (ids: string[]) => ids.map((id) => maps.tracks.get(id)).filter((t): t is Track => !!t);
    return {
      catalog,
      now,
      library,
      track: (id) => maps.tracks.get(id),
      artist: (id) => maps.artists.get(id),
      album: (id) => maps.albums.get(id),
      playlist: (id) => maps.playlists.get(id),
      tracksOf,
      artistTracks: (artistId) => catalog.tracks.filter((t) => t.artistId === artistId || t.featuring?.includes(artistId)),
      artistNames,
      toPlayable,
      play: (tracks, start = 0) => playQueue(tracks.map(toPlayable), start),
      toggle: (t, context) => {
        const q = (context ?? [t]).map(toPlayable);
        toggleItem(toPlayable(t), q);
      },
      peaks: (t) => t.peaks ?? synthPeaks(t.recipe, t.duration),
      totalPlays: (t) => (library.plays[t.id] ?? 0) + (t.uploaded ? 0 : lifetimeCache(t, now)),
      followerCount: (a) => a.followers + (library.follows.includes(a.id) ? 1 : 0),
      isLiked: (id) => library.likes.includes(id),
      toggleLike: (id) => update((l) => ({ ...l, likes: toggleIn(l.likes, id) })),
      toggleRepost: (id) => update((l) => ({ ...l, reposts: toggleIn(l.reposts, id) })),
      toggleFollow: (id) => update((l) => ({ ...l, follows: toggleIn(l.follows, id) })),
      toggleLikeAlbum: (id) => update((l) => ({ ...l, likedAlbums: toggleIn(l.likedAlbums, id) })),
      toggleLikePlaylist: (id) => update((l) => ({ ...l, likedPlaylists: toggleIn(l.likedPlaylists, id) })),
      createPlaylist: (title, trackIds = []) => {
        const id = `pl-me-${Date.now().toString(36)}`;
        const pl: Playlist = {
          id,
          title: title.trim().slice(0, 60) || 'My playlist',
          curator: library.displayName || 'You',
          description: '',
          trackIds,
          cover: makeCover(Date.now() % 100000, { text: title.slice(0, 18) }),
          followers: 0,
          editorial: false,
          owned: true,
        };
        update((l) => ({ ...l, playlists: [pl, ...l.playlists] }));
        return pl;
      },
      addToPlaylist: (pid, tid) =>
        update((l) => ({ ...l, playlists: l.playlists.map((p) => (p.id === pid && !p.trackIds.includes(tid) ? { ...p, trackIds: [...p.trackIds, tid] } : p)) })),
      removeFromPlaylist: (pid, tid) =>
        update((l) => ({ ...l, playlists: l.playlists.map((p) => (p.id === pid ? { ...p, trackIds: p.trackIds.filter((x) => x !== tid) } : p)) })),
      deletePlaylist: (pid) => update((l) => ({ ...l, playlists: l.playlists.filter((p) => p.id !== pid) })),
      addComment: (tid, text, position) =>
        update((l) => ({
          ...l,
          comments: {
            ...l.comments,
            [tid]: [{ id: `c${Date.now().toString(36)}`, author: l.displayName || 'You', text: text.trim().slice(0, 500), at: Date.now(), position }, ...(l.comments[tid] ?? [])],
          },
        })),
      addUpload: (t) => update((l) => ({ ...l, uploads: [t, ...l.uploads] })),
      deleteUpload: async (id) => {
        await deleteAudio(id);
        await deleteAudio(`${id}:cover`);
        update((l) => ({ ...l, uploads: l.uploads.filter((t) => t.id !== id), likes: l.likes.filter((x) => x !== id) }));
      },
      setDisplayName: (n) => update((l) => ({ ...l, displayName: n.trim().slice(0, 40) })),
    };
  }, [catalog, maps, now, library, artistNames, toPlayable, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Lifetime plays are a 400-day sum; cache per track per hour.
const lifeMemo = new Map<string, number>();
function lifetimeCache(t: Track, now: number): number {
  const k = `${t.id}|${Math.floor(now / 3_600_000)}`;
  let v = lifeMemo.get(k);
  if (v === undefined) {
    v = lifetimePlays(t, now);
    lifeMemo.set(k, v);
  }
  return v;
}

// --- player hooks ---------------------------------------------------------------------------------

export function usePlayerState(): PlayerState {
  return useSyncExternalStore(subscribe, getState);
}

/** Current position/duration, updated every animation frame while playing. */
export function usePosition(): { position: number; duration: number } {
  const [s, setS] = useState(() => ({ position: getPosition(), duration: getState().current?.duration ?? 0 }));
  useEffect(() => subscribePosition((position, duration) => setS({ position, duration })), []);
  return s;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
