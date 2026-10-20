import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setLang } from '../src/i18n';
import { getState } from '../src/player/engine';

// Two hooks the cards and rows use have no server snapshot; give them plain values here.
vi.mock('../src/music', async (orig) => ({ ...(await orig<typeof import('../src/music')>()), usePlayerState: () => getState() }));
vi.mock('../src/offline', async (orig) => ({ ...(await orig<typeof import('../src/offline')>()), useOnline: () => true }));

const { TrackCard } = await import('../src/components/music/Cards');
const { TrackList } = await import('../src/components/music/TrackRow');
const { loadPromoted } = await import('../src/lib/promotions');
const { toCatalog } = await import('../src/lib/serverCatalog');
const { MusicProvider } = await import('../src/music');
const { AppProvider } = await import('../src/store');
type PublishedTrack = import('../src/lib/serverCatalog').PublishedTrack;

const song = (id: string, title: string): PublishedTrack => ({
  id,
  title,
  genre: 'kompa',
  artistId: 'u1',
  artistName: 'Tiga',
  featuredArtists: null,
  explicit: false,
  artist: { name: 'Tiga', bio: null, avatarUrl: null, verified: false },
  duration: 100,
  peaks: null,
  releasedAt: 1,
  audioUrl: `/api/audio/${id}`,
  coverUrl: `/api/covers/${id}`,
});
// "Baby" is promoted right now; "Other" isn't.
const [baby, other] = toCatalog([song('baby', 'Baby'), song('other', 'Other')]).tracks;

/** Inside the same providers as the app. */
const render = (el: ReactElement) =>
  renderToStaticMarkup(createElement(AppProvider, { value: { now: 0, route: { page: 'home' }, navigate: () => {}, toast: () => {} }, children: createElement(MusicProvider, { now: 0, children: el }) }));
const badges = (html: string) => [...html.matchAll(/class="promo-badge">([^<]*)</g)].map((m) => m[1]);

beforeAll(async () => {
  (globalThis as { document?: unknown }).document = { documentElement: {} };
  // What GET /api/promoted answers: only active, paid promotions inside their dates.
  vi.stubGlobal('fetch', async (url: string) => {
    expect(url).toBe('/api/promoted');
    return new Response(JSON.stringify({ ok: true, trackIds: ['baby'] }), { headers: { 'content-type': 'application/json' } });
  });
  expect(await loadPromoted()).toEqual(['srv-baby']);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await setLang('en', false);
});

describe('the "Promoted" badge', () => {
  it('shows on the card of a song promoted right now, on its artwork next to the rank', () => {
    const html = render(createElement(TrackCard, { track: baby, rank: 1 }));
    expect(badges(html)).toEqual(['Promoted']);
    expect(html).toMatch(/class="mcard__art"[^]*class="mcard__rank">1<\/span><span class="promo-badge">Promoted<\/span><\/a>/);
  });

  it('shows on the row of a song promoted right now, which keeps its number', () => {
    const html = render(createElement(TrackList, { tracks: [other, baby] }));
    expect(badges(html)).toEqual(['Promoted']);
    expect([...html.matchAll(/class="trow__num">([^<]*)</g)].map((m) => m[1])).toEqual(['1', '2']);
    const rows = html.split('role="listitem"');
    expect(rows.find((r) => r.includes('>Baby<'))).toContain('promo-badge');
    expect(rows.find((r) => r.includes('>Other<'))).not.toContain('promo-badge');
  });

  it('doesn’t show for a song that isn’t in the promoted set', () => {
    expect(badges(render(createElement(TrackCard, { track: other })))).toEqual([]);
    expect(badges(render(createElement(TrackList, { tracks: [other] })))).toEqual([]);
  });

  it('is translated like the rest of the interface', async () => {
    await setLang('fr', false);
    expect(badges(render(createElement(TrackCard, { track: baby })))).toEqual(['Sponsorisé']);
    await setLang('ht', false);
    expect(badges(render(createElement(TrackList, { tracks: [baby] })))).toEqual(['Pwomosyon']);
  });
});
