import { describe, expect, it } from 'vitest';
import { coverUrl } from '../src/catalog/covers';
import { lifetimePlays, playsInWindow, trackChart, trending } from '../src/catalog/plays';
import { searchCatalog } from '../src/catalog/search';
import { createCatalog } from '../src/catalog/seed';
import { barCount, sectionOf, synthPeaks } from '../src/player/synth';
import { parseRoute } from '../src/store';

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
  it('parses music and leaderboard routes', () => {
    expect(parseRoute('')).toEqual({ page: 'home' });
    expect(parseRoute('#/song/tr-x')).toEqual({ page: 'song', id: 'tr-x' });
    expect(parseRoute('#/charts/albums/month')).toEqual({ page: 'charts', kind: 'albums', window: 'month' });
    expect(parseRoute('#/charts')).toEqual({ page: 'charts', kind: 'songs', window: 'week' });
    expect(parseRoute('#/genres/kompa')).toEqual({ page: 'genre', id: 'kompa' });
    expect(parseRoute('#/search/ayiti%20ch%C3%A9rie')).toEqual({ page: 'search', q: 'ayiti chérie' });
    expect(parseRoute('#/library')).toEqual({ page: 'library', tab: 'likes' });
    expect(parseRoute('#/leaderboard')).toEqual({ page: 'leaderboard' });
    expect(parseRoute('#/daily/2026-10-16')).toEqual({ page: 'daily', day: '2026-10-16' });
  });
});
