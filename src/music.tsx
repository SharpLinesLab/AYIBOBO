/**
 * Music app state: the catalog (songs artists published on ASF + your uploads), your library
 * (likes, follows, playlists, reposts, recently played, comments) and helpers to turn tracks into
 * playable queue items.
 * Library data is stored per browser in localStorage; uploaded audio in IndexedDB. While you're
 * signed in, likes, follows, playlists and play history also sync to your account (lib/librarySync).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { coverUrl, makeCover } from './catalog/covers';
import { CATALOG_CHANGED, fetchPublished, toCatalog, type PublishedTrack } from './lib/serverCatalog';
import { useAccount } from './lib/account';
import { librarySync } from './lib/librarySync';
import { createMixes } from './catalog/mixes';
import type { Album, Artist, Catalog, Playlist, Track } from './catalog/types';
import { deleteAudio, loadAudio } from './catalog/uploads';
import { getPosition, getState, onPlay, playQueue, setAutoplayProvider, subscribe, subscribePosition, toggleItem, type Playable, type PlayerState } from './player/engine';
import { synthPeaks } from './player/synth';
import { isStreamed, removeFromOffline, saveForOffline } from './offline';
import { fmtCompact, t } from './i18n';

export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

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
  /** Track ids saved for offline listening. */
  downloads: string[];
  /** Your plays per day (`YYYY-MM-DD` → track id → count), for the artist dashboard. */
  daily: Record<string, Record<string, number>>;
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
  downloads: [],
  daily: {},
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
  play: (tracks: Track[], start?: number, from?: number) => void;
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
  deleteUpload: (id: string) => Promise<void>;
  setDisplayName: (n: string) => void;
  /** Lyrics (plain text or LRC) for one of your uploads. */
  setLyrics: (trackId: string, text: string) => void;
  isDownloaded: (id: string) => boolean;
  /** Can this track play with no connection? (uploaded or downloaded) */
  availableOffline: (t: Track) => boolean;
  /** Save tracks for offline (fetches streamed audio + artwork). */
  download: (tracks: Track[], onProgress?: (done: number, total: number) => void) => Promise<void>;
  removeDownloads: (ids: string[]) => Promise<void>;
}

const Ctx = createContext<MusicContextValue | null>(null);

export function useMusic(): MusicContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMusic outside MusicProvider');
  return v;
}

export function MusicProvider({ now, children }: { now: number; children: ReactNode }) {
  const [library, setLibrary] = useState<Library>(readLibrary);
  const [uploadUrls, setUploadUrls] = useState<Record<string, string>>({});

  const update = useCallback((fn: (l: Library) => Library) => {
    setLibrary((prev) => {
      const next = fn(prev);
      writeLibrary(next);
      return next;
    });
  }, []);

  // Account sync. Changes are diffed after each render; the account's copy, when it arrives,
  // replaces the synced part of the library without being sent back.
  const libRef = useRef(library);
  const prevLib = useRef(library);
  const fromServer = useRef(new WeakSet<Library>());
  useEffect(() => {
    librarySync.attach({
      get: () => libRef.current,
      replace: (next) => {
        fromServer.current.add(next);
        libRef.current = next;
        writeLibrary(next);
        setLibrary(next);
      },
    });
  }, []);
  useEffect(() => {
    if (!fromServer.current.has(library)) librarySync.record(prevLib.current, library);
    prevLib.current = library;
    libRef.current = library;
  }, [library]);
  const account = useAccount();
  const userId = account.user?.id;
  useEffect(() => {
    if (userId) void librarySync.start(userId);
    else if (account.status === 'ready') librarySync.stop();
  }, [userId, account.status]);
  useEffect(() => {
    const resume = () => document.visibilityState === 'visible' && void librarySync.resume();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
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

  // Songs artists published through the server; refreshed when an admin approves one.
  const [published, setPublished] = useState<PublishedTrack[]>([]);
  useEffect(() => {
    const load = () => void fetchPublished().then(setPublished);
    load();
    window.addEventListener(CATALOG_CHANGED, load);
    return () => window.removeEventListener(CATALOG_CHANGED, load);
  }, []);
  const server = useMemo(() => toCatalog(published), [published]);

  // Personal mixes follow your likes (not every play, so they don't reshuffle mid-listen).
  const likesKey = library.likes.join('|');
  const mixes = useMemo(() => createMixes(server.tracks, server.artists, library.likes, []), [server, likesKey]);

  const catalog: Catalog = useMemo(() => {
    const uploads = library.uploads.map((t) => {
      const art = uploadUrls[`${t.id}:cover`];
      return { ...t, audioUrl: uploadUrls[t.id], cover: art ? { ...t.cover, imageUrl: art } : t.cover };
    });
    return {
      artists: server.artists,
      tracks: [...uploads, ...server.tracks],
      albums: [],
      playlists: [...library.playlists, ...mixes],
    };
  }, [library.uploads, library.playlists, uploadUrls, mixes, server]);

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
    (tr: Track) => {
      // Published songs carry their own credit; otherwise it's the artist (or you, for your uploads).
      const main = tr.artistName ?? maps.artists.get(tr.artistId)?.name ?? library.displayName ?? t('common.word.you');
      const feats = tr.featuredArtists ? [tr.featuredArtists] : (tr.featuring ?? []).map((id) => maps.artists.get(id)?.name).filter(Boolean);
      return feats.length ? `${main} ${t('browse.feat')} ${feats.join(', ')}` : main || t('common.word.you');
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

  // Autoplay: when the queue runs out, continue with songs like the last one — same artist and
  // collaborators first, then the same genre — skipping what was just played.
  useEffect(() => {
    setAutoplayProvider((last, queue) => {
      const t = maps.tracks.get(last.id);
      if (!t) return [];
      const recent = new Set([...queue.map((q) => q.id), ...library.recents.slice(0, 30)]);
      const people = new Set([t.artistId, ...(t.featuring ?? [])]);
      const liked = new Set(library.likes);
      const score = (x: Track) => {
        let v = 0;
        if (people.has(x.artistId) || x.featuring?.some((a) => people.has(a))) v += 3;
        if (x.genre === t.genre) v += 2;
        if (liked.has(x.id)) v += 1.5;
        v += Math.min(1.5, x.popularity / 4);
        return v + Math.random() * 1.2; // a little variety each time
      };
      return catalog.tracks
        .filter((x) => !recent.has(x.id) && !x.uploaded && x.id !== t.id)
        .map((x) => ({ x, v: score(x) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 10)
        .map(({ x }) => toPlayable(x));
    });
  }, [catalog, maps, library.recents, library.likes, toPlayable]);

  // Count plays & recents for real tracks.
  useEffect(
    () =>
      onPlay((p) => {
        if (p.preview) return;
        update((l) => {
          const day = dayKey(Date.now());
          const today = l.daily[day] ?? {};
          // Keep about a year of daily history.
          const days = Object.keys(l.daily).sort().slice(-400);
          const daily = Object.fromEntries(days.map((d) => [d, l.daily[d]]));
          daily[day] = { ...today, [p.id]: (today[p.id] ?? 0) + 1 };
          return {
            ...l,
            plays: { ...l.plays, [p.id]: (l.plays[p.id] ?? 0) + 1 },
            recents: [p.id, ...l.recents.filter((x) => x !== p.id)].slice(0, 50),
            daily,
          };
        });
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
      play: (tracks, start = 0, from = 0) => playQueue(tracks.map(toPlayable), start, from),
      toggle: (t, context) => {
        const q = (context ?? [t]).map(toPlayable);
        toggleItem(toPlayable(t), q);
      },
      peaks: (t) => t.peaks ?? synthPeaks(t.recipe, t.duration),
      totalPlays: (t) => library.plays[t.id] ?? 0,
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
          title: title.trim().slice(0, 60) || t('player.music.myPlaylist'),
          curator: library.displayName || t('common.word.you'),
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
            [tid]: [{ id: `c${Date.now().toString(36)}`, author: l.displayName || t('common.word.you'), text: text.trim().slice(0, 500), at: Date.now(), position }, ...(l.comments[tid] ?? [])],
          },
        })),
      deleteUpload: async (id) => {
        await deleteAudio(id);
        await deleteAudio(`${id}:cover`);
        update((l) => ({ ...l, uploads: l.uploads.filter((t) => t.id !== id), likes: l.likes.filter((x) => x !== id) }));
      },
      setDisplayName: (n) => update((l) => ({ ...l, displayName: n.trim().slice(0, 40) })),
      isDownloaded: (id) => library.downloads.includes(id),
      availableOffline: (t) => !isStreamed(t.audioUrl) || library.downloads.includes(t.id),
      download: async (tracks, onProgress) => {
        const streamed = tracks.filter((t) => isStreamed(t.audioUrl));
        const art = tracks.map((t) => t.cover.imageUrl).filter((u): u is string => !!u);
        await saveForOffline(
          streamed.map((t) => t.audioUrl!),
          [...new Set(art)],
          onProgress,
        );
        const ids = tracks.map((t) => t.id);
        update((l) => ({ ...l, downloads: [...ids.filter((id) => !l.downloads.includes(id)), ...l.downloads] }));
      },
      removeDownloads: async (ids) => {
        const urls = ids.map((id) => maps.tracks.get(id)?.audioUrl).filter(isStreamed);
        await removeFromOffline(urls);
        update((l) => ({ ...l, downloads: l.downloads.filter((x) => !ids.includes(x)) }));
      },
      setLyrics: (tid, text) =>
        update((l) => ({ ...l, uploads: l.uploads.map((t) => (t.id === tid ? { ...t, lyrics: text.trim().slice(0, 20_000) || undefined } : t)) })),
    };
  }, [catalog, maps, now, library, artistNames, toPlayable, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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

/** 1.2K-style counts in the current interface language. */
export function compact(n: number): string {
  return fmtCompact(n);
}
