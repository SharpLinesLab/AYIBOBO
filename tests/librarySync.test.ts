import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { diffOps, fromWire, LibrarySync, toWire } from '../src/lib/librarySync';
import type { WireLibrary } from '../src/lib/libraryWire';
import type { Library } from '../src/music';
import { startServer, type Client } from './harness';

const lib = (over: Partial<Library> = {}): Library => ({
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
  ...over,
});
const mine = (id: string, trackIds: string[], title = 'Mine') => ({
  id,
  title,
  curator: 'Me',
  description: '',
  trackIds,
  cover: { template: 'orb' as const, palette: ['#111111', '#222222', '#333333'] as [string, string, string], seed: 3 },
  followers: 0,
  editorial: false,
  owned: true,
});

/** A browser: its own localStorage, its own cookie jar, its own library state, one sync controller. */
function device(client: Client, library: Library) {
  const storage = new Map<string, string>();
  const state = { library, requests: [] as string[] };
  const sync = new LibrarySync();
  sync.attach({ get: () => state.library, replace: (next) => void (state.library = next) });
  const use = () => {
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) });
    vi.stubGlobal('fetch', (path: string, init?: RequestInit) => {
      state.requests.push(`${init?.method ?? 'GET'} ${path}`);
      return client.send(path, { ...init, headers: init?.headers as Record<string, string> });
    });
  };
  /** A change made in the app (MusicProvider records the diff the same way). */
  const change = (fn: (l: Library) => Library) => {
    use();
    const prev = state.library;
    state.library = fn(prev);
    sync.record(prev, state.library);
  };
  return { state, sync, storage, use, change };
}

let srv: Awaited<ReturnType<typeof startServer>>;
async function account(email: string) {
  const c = srv.client();
  await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: 'U' });
  const r = await c.get('/api/auth/me');
  return { client: c, id: (await r.json()).user.id as string };
}
async function session(email: string) {
  const c = srv.client();
  await c.post('/api/auth/login', { email, password: 'long enough pw' });
  return c;
}
const serverLib = async (c: Client): Promise<WireLibrary> => (await (await c.get('/api/library')).json()).library;

beforeAll(async () => {
  srv = await startServer();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => srv.close());

describe('library conversions', () => {
  it('turn changes into ops', () => {
    const a = lib({ likes: ['t1'], follows: ['ar1'], playlists: [mine('pl-me-1', ['x'])], plays: { t1: 2 } });
    const b = { ...a, likes: ['t2', 't1'], follows: [], playlists: [{ ...a.playlists[0], trackIds: ['x', 'y'] }], plays: { t1: 3, t9: 1 } };
    const ops = diffOps(a, b, 1000);
    expect(ops.map((o) => o.op)).toEqual(['like', 'unfollow', 'putPlaylist', 'play', 'play']);
    expect(diffOps(b, { ...b, playlists: [] }).map((o) => o.op)).toEqual(['deletePlaylist']);
    expect(diffOps(a, a)).toEqual([]);
  });

  it('round-trip the synced part and leave the rest of the library alone', () => {
    const local = lib({ likes: ['t1'], likedAlbums: ['al1'], follows: ['ar1'], playlists: [mine('pl-me-1', ['x'])], plays: { t1: 2, t2: 1 }, recents: ['t2', 't1'], reposts: ['keep'], downloads: ['dl'] });
    const back = fromWire(lib({ reposts: ['keep'], downloads: ['dl'] }), toWire(local));
    expect(back).toMatchObject({ likes: ['t1'], likedAlbums: ['al1'], follows: ['ar1'], plays: { t1: 2, t2: 1 }, recents: ['t2', 't1'], reposts: ['keep'], downloads: ['dl'] });
    expect(back.playlists[0]).toMatchObject({ id: 'pl-me-1', trackIds: ['x'], owned: true });
  });
});

describe('sync on this device', () => {
  it('merges on the first sign-in, then follows the account across devices', async () => {
    const { client, id } = await account('sam@example.com');
    // The account already has something from another device.
    await client.post('/api/library/ops', { ops: [{ op: 'like', kind: 'track', id: 'from-phone' }] });

    const laptop = device(client, lib({ likes: ['from-laptop'], playlists: [mine('pl-me-l', ['a'])], plays: { 'from-laptop': 3 }, recents: ['from-laptop'] }));
    laptop.use();
    await laptop.sync.start(id);
    expect(laptop.state.requests).toContain('POST /api/library/merge');
    expect(new Set(laptop.state.library.likes)).toEqual(new Set(['from-phone', 'from-laptop']));
    expect(laptop.state.library.playlists.map((p) => p.id)).toEqual(['pl-me-l']);
    expect(laptop.storage.get('asf:library-owner')).toBe(id);

    // A like on the laptop reaches the account…
    laptop.change((l) => ({ ...l, likes: ['new-like', ...l.likes] }));
    await laptop.sync.flush();
    expect((await serverLib(client)).likes.track).toContain('new-like');

    // …and shows up on a second device (whose own library was empty).
    const tablet = device(await session('sam@example.com'), lib());
    tablet.use();
    await tablet.sync.start(id);
    expect(new Set(tablet.state.library.likes)).toEqual(new Set(['from-phone', 'from-laptop', 'new-like']));
    expect(tablet.state.library.plays).toEqual({ 'from-laptop': 3 });

    // Signing in again on the laptop pulls (the server is now the source of truth), no second merge.
    laptop.state.requests = [];
    const again = new LibrarySync();
    again.attach({ get: () => laptop.state.library, replace: (n) => void (laptop.state.library = n) });
    laptop.use();
    await again.start(id);
    expect(laptop.state.requests).toEqual(['GET /api/library']);
  });

  it('never sends changes made while signed out', async () => {
    const { client, id } = await account('quiet@example.com');
    const d = device(client, lib());
    d.use();
    await d.sync.start(id);
    d.sync.stop(); // signed out
    d.state.requests = [];
    d.change((l) => ({ ...l, likes: ['offline-like'], follows: ['offline-artist'], plays: { x: 5 } }));
    await d.sync.flush();
    await d.sync.pull();
    expect(d.state.requests).toEqual([]);
    expect(d.state.library.likes).toEqual(['offline-like']); // still kept on the device
    const server = await serverLib(client);
    expect(server.likes.track).toEqual([]);
    expect(server.follows).toEqual([]);
    expect(server.plays).toEqual([]);
  });

  it('never merges one person’s leftover library into another account', async () => {
    const a = await account('first@example.com');
    const shared = device(a.client, lib({ likes: ['a-private'] }));
    shared.use();
    await shared.sync.start(a.id);
    shared.sync.stop(); // A signs out; the device keeps A's copy

    const b = await account('second@example.com');
    const bSync = new LibrarySync();
    bSync.attach({ get: () => shared.state.library, replace: (n) => void (shared.state.library = n) });
    vi.stubGlobal('fetch', (path: string, init?: RequestInit) => b.client.send(path, { ...init, headers: init?.headers as Record<string, string> }));
    await bSync.start(b.id);
    expect((await serverLib(b.client)).likes.track).toEqual([]);
    expect(shared.state.library.likes).toEqual([]); // the device now shows B's (empty) library
  });

  it('keeps unsent changes across a reload and sends them later', async () => {
    const { client, id } = await account('flaky@example.com');
    const d = device(client, lib());
    d.use();
    await d.sync.start(id);
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const prev = d.state.library;
    d.state.library = { ...prev, likes: ['while-offline'] };
    d.sync.record(prev, d.state.library);
    await d.sync.flush();
    expect(d.storage.get('asf:library-pending')).toContain('while-offline');
    // "Reload": a fresh controller on the same device picks the queue up and sends it first.
    d.use();
    const fresh = new LibrarySync();
    fresh.attach({ get: () => d.state.library, replace: (n) => void (d.state.library = n) });
    await fresh.start(id);
    expect((await serverLib(client)).likes.track).toEqual(['while-offline']);
    expect(d.state.library.likes).toEqual(['while-offline']);
    expect(d.storage.get('asf:library-pending')).toBeUndefined();
  });
});
