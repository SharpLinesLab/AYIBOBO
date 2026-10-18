import { describe, expect, it } from 'vitest';
import { coverUrl } from '../src/catalog/covers';
import { lifetimePlays, playsInWindow, trackChart, trending } from '../src/catalog/plays';
import { searchCatalog } from '../src/catalog/search';
import { createCatalog } from '../src/catalog/seed';
import { barCount, sectionOf, synthPeaks } from '../src/player/synth';
import { parseRoute } from '../src/store';
import { fmtCompact, setLang } from '../src/i18n';
import { dict as en } from '../src/i18n/locales/en';
import { dict as fr } from '../src/i18n/locales/fr';
import { dict as ht } from '../src/i18n/locales/ht';

const NOW = Date.parse('2026-10-17T15:00:00Z');
const cat = createCatalog(NOW);

describe('catalog seed', () => {
  it('is deterministic and internally consistent', () => {
    const again = createCatalog(NOW);
    expect(again.tracks.map((t) => t.id)).toEqual(cat.tracks.map((t) => t.id));
    const ids = new Set(cat.tracks.map((t) => t.id));
    expect(ids.size).toBe(cat.tracks.length);
    const artistIds = new Set(cat.artists.map((a) => a.id));
    for (const t of cat.tracks) {
      expect(artistIds.has(t.artistId)).toBe(true);
      expect(t.duration).toBeGreaterThan(60);
    }
    for (const a of cat.albums) for (const id of a.trackIds) expect(ids.has(id)).toBe(true);
    for (const p of cat.playlists) for (const id of p.trackIds) expect(ids.has(id)).toBe(true);
  });

  it('never repeats a song title', () => {
    const titles = cat.tracks.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('renders covers as SVG data URIs', () => {
    const url = coverUrl(cat.albums[0].cover);
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(url)).toContain('<svg');
  });
});

describe('plays & charts', () => {
  it('has no plays before release and counts up after', () => {
    const t = cat.tracks[0];
    expect(playsInWindow({ ...t, releasedAt: NOW + 86_400_000 }, NOW, 30)).toBe(0);
    expect(lifetimePlays(t, NOW)).toBeGreaterThan(0);
  });

  it('ranks charts by plays and reports movement', () => {
    const rows = trackChart(cat.tracks, NOW, 'week');
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].plays).toBeGreaterThanOrEqual(rows[i].plays);
    expect(rows[0].rank).toBe(1);
    expect(rows.some((r) => r.change !== 0)).toBe(true);
  });

  it('adds local plays on top of the synthetic history', () => {
    const last = trackChart(cat.tracks, NOW, 'day').at(-1)!;
    const boosted = trackChart(cat.tracks, NOW, 'day', { [last.track.id]: 10_000_000 });
    expect(boosted[0].track.id).toBe(last.track.id);
  });

  it('trending returns every eligible track once', () => {
    const tr = trending(cat.tracks, NOW);
    expect(new Set(tr.map((t) => t.id)).size).toBe(cat.tracks.length);
  });
});

describe('search', () => {
  it('is accent-insensitive and ranks title prefixes first', () => {
    const r = searchCatalog(cat, 'ayiti cherie');
    expect(r.tracks[0].title.startsWith('Ayiti Chérie')).toBe(true);
    expect(searchCatalog(cat, 'kreyol').playlists.some((p) => p.title === 'Rap Kreyòl Heat')).toBe(true);
    expect(searchCatalog(cat, 'tiga').artists[0].name).toBe('Tiga Blaze');
    expect(searchCatalog(cat, '   ').tracks).toHaveLength(0);
  });
});

describe('song structure', () => {
  it('has intro, hook and outro sections and matching waveform peaks', () => {
    const t = cat.tracks[0];
    const total = barCount(t.recipe, t.duration);
    expect(sectionOf(0, total)).toBe('intro');
    expect(sectionOf(total - 1, total)).toBe('outro');
    expect(Array.from({ length: total }, (_, i) => sectionOf(i, total))).toContain('hook');
    const peaks = synthPeaks(t.recipe, t.duration);
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
    // The retired Boost Board pages now show "page not found".
    for (const old of ['#/leaderboard', '#/boost', '#/daily/2026-10-16', '#/categories', '#/about', '#/rules', '#/faq']) expect(parseRoute(old)).toEqual({ page: 'notfound' });
  });
});

describe('catalog copy', () => {
  const copy = (c: typeof cat) => [
    ...c.artists.map((a) => a.bio),
    ...c.albums.map((a) => a.description),
    ...c.tracks.map((t) => t.description),
    ...c.playlists.flatMap((p) => [p.description, p.curator, p.cover.subtext ?? '']),
  ];

  it('resolves every bio and description to real text', () => {
    for (const s of copy(cat)) expect(s).not.toMatch(/catalog\./);
  });

  it('is fully translated in French and Kreyòl', async () => {
    // setLang marks <html lang>; the unit tests run without a DOM.
    (globalThis as { document?: unknown }).document = { documentElement: {} };
    const english = new Set(Object.entries(en).filter(([k]) => k.startsWith('catalog.')).map(([, v]) => v));
    for (const [lang, d] of [['fr', fr], ['ht', ht]] as const) {
      for (const [k, v] of Object.entries(d)) if (k.startsWith('catalog.')) expect(english.has(v), `${lang} ${k}`).toBe(false);
      await setLang(lang, false);
      const c = createCatalog(NOW);
      expect(c.tracks.map((t) => t.id)).toEqual(cat.tracks.map((t) => t.id));
      for (const s of copy(c)) expect(s.split(/(?<=\.) /).some((part) => english.has(part)), `${lang}: ${s}`).toBe(false);
    }
    await setLang('en', false);
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
