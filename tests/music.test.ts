import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { coverUrl, makeCover } from '../src/catalog/covers';
import { playsInWindow, trackChart, trending } from '../src/catalog/plays';
import { searchCatalog } from '../src/catalog/search';
import type { Catalog } from '../src/catalog/types';
import { toCatalog, type PublishedTrack } from '../src/lib/serverCatalog';
import { MusicProvider } from '../src/music';
import { DiscoverPage } from '../src/pages/Discover';
import { barCount, sectionOf, synthPeaks } from '../src/player/synth';
import { AppProvider, parseRoute } from '../src/store';
import { fmtCompact, setLang } from '../src/i18n';
import { dict as en } from '../src/i18n/locales/en';
import { dict as fr } from '../src/i18n/locales/fr';
import { dict as ht } from '../src/i18n/locales/ht';

const NOW = Date.parse('2026-10-17T15:00:00Z');
const DAY = 86_400_000;

/** Songs as the server publishes them (GET /api/catalog/uploads). */
const song = (id: string, title: string, artistId: string, artistName: string, genre: PublishedTrack['genre'], daysAgo: number): PublishedTrack => ({
  id,
  title,
  genre,
  artistId,
  artistName,
  featuredArtists: null,
  explicit: false,
  artist: { name: artistName, bio: null, avatarUrl: null, verified: false },
  duration: 180,
  peaks: null,
  releasedAt: NOW - daysAgo * DAY,
  audioUrl: `/api/catalog/uploads/${id}/audio`,
  coverUrl: `/api/catalog/uploads/${id}/cover`,
});
const published = toCatalog([
  song('s1', 'Ayiti Chérie', 'u1', 'Ròz Mapou', 'kompa', 3),
  song('s2', 'Lanmè', 'u1', 'Ròz Mapou', 'zouk', 10),
  song('s3', 'Kenbe Fèm', 'u2', 'Twoubadou Lakay', 'rap-kreyol', 1),
]);
const cat: Catalog = { ...published, albums: [], playlists: [] };

describe('covers', () => {
  it('renders generated covers as SVG data URIs', () => {
    const url = coverUrl(makeCover(42, { text: 'Lakay' }));
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(url)).toContain('<svg');
  });
});

describe('plays & charts', () => {
  const [a, b, c] = cat.tracks;

  it('invents no plays for real songs', () => {
    for (const t of cat.tracks) expect(playsInWindow(t, NOW, 365)).toBe(0);
  });

  it('ranks charts by your plays and leaves out songs nobody played', () => {
    const rows = trackChart(cat.tracks, NOW, 'week', { [a.id]: 5, [b.id]: 9 });
    expect(rows.map((r) => [r.track.id, r.rank, r.plays])).toEqual([
      [b.id, 1, 9],
      [a.id, 2, 5],
    ]);
    expect(rows.some((r) => r.track.id === c.id)).toBe(false);
    expect(trackChart(cat.tracks, NOW, 'week')).toEqual([]);
  });

  it('trending returns every eligible track once', () => {
    const tr = trending(cat.tracks, NOW);
    expect(new Set(tr.map((t) => t.id)).size).toBe(cat.tracks.length);
  });
});

describe('search', () => {
  it('is accent-insensitive and ranks title prefixes first', () => {
    expect(searchCatalog(cat, 'ayiti cherie').tracks[0].title).toBe('Ayiti Chérie');
    expect(searchCatalog(cat, 'lanme').tracks[0].title).toBe('Lanmè');
    expect(searchCatalog(cat, 'roz').artists[0].name).toBe('Ròz Mapou');
    expect(searchCatalog(cat, '   ').tracks).toHaveLength(0);
  });
});

describe('song structure', () => {
  it('has intro, hook and outro sections and matching waveform peaks', () => {
    const recipe = { genre: 'kompa' as const, bpm: 118, root: 48, seed: 7, scale: 'major' as const };
    const total = barCount(recipe, 180);
    expect(sectionOf(0, total)).toBe('intro');
    expect(sectionOf(total - 1, total)).toBe('outro');
    expect(Array.from({ length: total }, (_, i) => sectionOf(i, total))).toContain('hook');
    const peaks = synthPeaks(recipe, 180);
    expect(peaks).toHaveLength(160);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(1);
  });
});

describe('routes', () => {
  it('parses music routes', () => {
    expect(parseRoute('')).toEqual({ page: 'home' });
    expect(parseRoute('#/song/tr-x')).toEqual({ page: 'song', id: 'tr-x' });
    expect(parseRoute('#/charts/albums/month')).toEqual({ page: 'charts', kind: 'albums', window: 'month' });
    expect(parseRoute('#/charts')).toEqual({ page: 'charts', kind: 'songs', window: 'week' });
    expect(parseRoute('#/genres/kompa')).toEqual({ page: 'genre', id: 'kompa' });
    expect(parseRoute('#/search/ayiti%20ch%C3%A9rie')).toEqual({ page: 'search', q: 'ayiti chérie' });
    expect(parseRoute('#/library')).toEqual({ page: 'library', tab: 'likes' });
    // The retired Boost Board pages and the old browser-only upload page now show "page not found".
    for (const old of ['#/upload', '#/leaderboard', '#/boost', '#/daily/2026-10-16', '#/categories', '#/about', '#/rules', '#/faq']) expect(parseRoute(old)).toEqual({ page: 'notfound' });
  });
});

describe('with nothing published yet', () => {
  // No API server in unit tests, so the catalog is empty, just as on a brand-new site.
  const render = (page: ReactElement) =>
    renderToStaticMarkup(
      createElement(AppProvider, { value: { now: NOW, route: { page: 'home' }, navigate: () => {}, toast: () => {} }, children: createElement(MusicProvider, { now: NOW, children: page }) }),
    );

  it('Discover shows an empty state instead of shelves', () => {
    const html = render(createElement(DiscoverPage));
    expect(html).toContain(`<h1>${en['browse.empty.title']}</h1>`);
    expect(html).toContain('href="#/account"');
    expect(html).not.toContain(en['browse.discover.trending']);
    expect(html).not.toContain('class="shelf"');
  });
});

describe('the interface', () => {
  it('no longer mentions a demo or fictional catalog, in any language', () => {
    for (const [lang, d] of [['en', en], ['fr', fr], ['ht', ht]] as const) {
      expect(Object.keys(d).filter((k) => k.startsWith('catalog.')), lang).toEqual([]);
      for (const [k, v] of Object.entries(d)) expect(v, `${lang} ${k}`).not.toMatch(/\bd[eé]mo\b|fictional|fictif|editorial|rédaction/i);
    }
  });
});

describe('compact numbers', () => {
  const cases = [5, 1_234, 9_999, 66_100, 661_000, 999_600, 2_400_000, 1_500_000_000];
  it('never put a space before the suffix, in any language', async () => {
    (globalThis as { document?: unknown }).document = { documentElement: {} };
    const out: Record<string, string[]> = {};
    for (const lang of ['en', 'fr', 'ht'] as const) {
      await setLang(lang, false);
      out[lang] = cases.map(fmtCompact);
    }
    await setLang('en', false);
    expect(out.en).toEqual(['5', '1.2K', '10K', '66K', '661K', '1M', '2.4M', '1.5B']);
    expect(out.fr).toEqual(['5', '1,2K', '10K', '66K', '661K', '1M', '2,4M', '1,5Md']);
    expect(out.ht).toEqual(out.fr);
    for (const s of Object.values(out).flat()) expect(s).not.toMatch(/\s/);
  });
});
