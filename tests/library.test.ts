import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emptyWireLibrary, type WireLibrary, type WirePlaylist } from '../src/lib/libraryWire';
import { startServer, type Client } from './harness';

let srv: Awaited<ReturnType<typeof startServer>>;

async function signup(email: string): Promise<Client> {
  const c = srv.client();
  expect((await c.post('/api/auth/signup', { email, password: 'long enough pw', displayName: email.split('@')[0] })).status).toBe(201);
  return c;
}
async function login(email: string): Promise<Client> {
  const c = srv.client();
  expect((await c.post('/api/auth/login', { email, password: 'long enough pw' })).status).toBe(200);
  return c;
}
const lib = async (c: Client): Promise<WireLibrary> => (await (await c.get('/api/library')).json()).library;
const ops = (c: Client, list: unknown[]) => c.post('/api/library/ops', { ops: list });
const cover = { template: 'orb' as const, palette: ['#111111', '#222222', '#333333'] as [string, string, string], seed: 7 };
const playlist = (id: string, trackIds: string[], extra: Record<string, unknown> = {}): WirePlaylist => ({ id, title: 'Road trip', curator: 'Me', trackIds, cover, createdAt: 1_760_000_000_000, updatedAt: 1_760_000_000_000, ...extra });

beforeAll(async () => {
  srv = await startServer();
});
afterAll(() => srv.close());

describe('library sync API', () => {
  it('needs a session for every route', async () => {
    const anon = srv.client();
    expect((await anon.get('/api/library')).status).toBe(401);
    expect((await anon.post('/api/library/ops', { ops: [{ op: 'like', kind: 'track', id: 't1' }] })).status).toBe(401);
    expect((await anon.post('/api/library/merge', { mergeId: 'd1', library: emptyWireLibrary() })).status).toBe(401);
  });

  it('shows a like made in one session in another session of the same account', async () => {
    const phone = await signup('maya@example.com');
    const laptop = await login('maya@example.com');
    expect((await ops(phone, [{ op: 'like', kind: 'track', id: 'tr-lanmou' }, { op: 'follow', id: 'ar-tiga' }, { op: 'play', trackId: 'tr-lanmou', at: Date.now() }])).status).toBe(200);
    const seen = await lib(laptop);
    expect(seen.likes.track).toEqual(['tr-lanmou']);
    expect(seen.follows).toEqual(['ar-tiga']);
    expect(seen.plays).toMatchObject([{ trackId: 'tr-lanmou', count: 1 }]);
    // And back: unliking on the laptop shows up on the phone.
    await ops(laptop, [{ op: 'unlike', kind: 'track', id: 'tr-lanmou' }, { op: 'putPlaylist', playlist: playlist('pl-me-a', ['tr-1', 'tr-2']) }]);
    const back = await lib(phone);
    expect(back.likes.track).toEqual([]);
    expect(back.playlists.map((p) => [p.id, p.trackIds])).toEqual([['pl-me-a', ['tr-1', 'tr-2']]]);
    await ops(phone, [{ op: 'deletePlaylist', id: 'pl-me-a' }]);
    expect((await lib(laptop)).playlists).toEqual([]);
  });

  it('unites a device library with the account on first sign-in, losing nothing on either side', async () => {
    const a = await signup('jo@example.com');
    await ops(a, [
      { op: 'like', kind: 'track', id: 'server-song' },
      { op: 'like', kind: 'track', id: 'both-song' },
      { op: 'follow', id: 'server-artist' },
      { op: 'putPlaylist', playlist: playlist('pl-me-shared', ['s1', 's2'], { title: 'Old title', updatedAt: 1_760_000_000_000 }) },
      { op: 'putPlaylist', playlist: playlist('pl-me-server', ['x']) },
      { op: 'play', trackId: 'both-song', at: Date.now() },
    ]);
    const device: WireLibrary = {
      likes: { track: ['device-song', 'both-song'], album: ['al-1'], playlist: ['pl-kompa'] },
      follows: ['device-artist', 'server-artist'],
      playlists: [playlist('pl-me-shared', ['s2', 's3'], { title: 'New title', updatedAt: 1_760_000_500_000 }), playlist('pl-me-device', ['d1'])],
      plays: [
        { trackId: 'both-song', count: 4, lastPlayed: Date.now() - 1000 },
        { trackId: 'device-only', count: 2, lastPlayed: Date.now() - 5000 },
      ],
    };
    const b = await login('jo@example.com');
    const r = await b.post('/api/library/merge', { mergeId: 'dev-phone', library: device });
    expect(r.status).toBe(200);
    const merged: WireLibrary = (await r.json()).library;
    expect(new Set(merged.likes.track)).toEqual(new Set(['server-song', 'both-song', 'device-song']));
    expect(merged.likes.album).toEqual(['al-1']);
    expect(merged.likes.playlist).toEqual(['pl-kompa']);
    expect(new Set(merged.follows)).toEqual(new Set(['server-artist', 'device-artist']));
    const shared = merged.playlists.find((p) => p.id === 'pl-me-shared')!;
    expect(shared.title).toBe('New title');
    expect(shared.trackIds).toEqual(['s1', 's2', 's3']);
    expect(merged.playlists.map((p) => p.id).sort()).toEqual(['pl-me-device', 'pl-me-server', 'pl-me-shared']);
    expect(Object.fromEntries(merged.plays.map((p) => [p.trackId, p.count]))).toEqual({ 'both-song': 5, 'device-only': 2 });

    // A retried merge from the same device changes nothing (no doubled plays).
    const again: WireLibrary = (await (await b.post('/api/library/merge', { mergeId: 'dev-phone', library: device })).json()).library;
    expect(Object.fromEntries(again.plays.map((p) => [p.trackId, p.count]))).toEqual({ 'both-song': 5, 'device-only': 2 });
    expect(await lib(a)).toEqual(again);
  });

  it('keeps each account to its own library', async () => {
    const x = await signup('x@example.com');
    const y = await signup('y@example.com');
    await ops(y, [{ op: 'like', kind: 'track', id: 'y-secret' }, { op: 'putPlaylist', playlist: playlist('pl-me-y', ['y1']) }]);
    // X can't see Y's library, and X's changes (even to the same ids) never touch Y's.
    expect((await lib(x)).likes.track).toEqual([]);
    await ops(x, [{ op: 'unlike', kind: 'track', id: 'y-secret' }, { op: 'deletePlaylist', id: 'pl-me-y' }, { op: 'like', kind: 'track', id: 'x-song' }]);
    await x.post('/api/library/merge', { mergeId: 'dev-x', library: { ...emptyWireLibrary(), follows: ['x-artist'] } });
    const yLib = await lib(y);
    expect(yLib.likes.track).toEqual(['y-secret']);
    expect(yLib.playlists.map((p) => p.id)).toEqual(['pl-me-y']);
    expect(yLib.follows).toEqual([]);
    // There's no way to name another user: query strings and body fields are ignored.
    expect((await (await x.get('/api/library?userId=whatever')).json()).library.likes.track).toEqual(['x-song']);
  });

  it('refuses malformed changes as a whole and cross-site requests', async () => {
    const c = await signup('strict@example.com');
    const bad = [
      [{ op: 'like', kind: 'track', id: 'ok' }, { op: 'like', kind: 'nope', id: 'x' }],
      [{ op: 'like', kind: 'track', id: '../../etc' }],
      [{ op: 'putPlaylist', playlist: playlist('pl-me-1', [], { cover: { ...cover, palette: ['red'] } }) }],
      [{ op: 'drop table' }],
      [],
      Array.from({ length: 201 }, () => ({ op: 'follow', id: 'a' })),
    ];
    for (const list of bad) expect((await ops(c, list)).status).toBe(400);
    expect((await lib(c)).likes.track).toEqual([]); // nothing from the half-valid batch was applied
    expect((await c.post('/api/library/merge', { mergeId: 'd', library: { likes: { track: 'nope' } } })).status).toBe(400);
    expect((await c.post('/api/library/ops', { ops: [{ op: 'follow', id: 'a' }] }, { origin: 'https://evil.example' })).status).toBe(403);
  });
});
