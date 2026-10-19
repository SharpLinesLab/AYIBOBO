import { describe, expect, it } from 'vitest';
import { activeLine, lyricsFor, parseLyrics, toLrc } from '../src/catalog/lyrics';
import { toCatalog } from '../src/lib/serverCatalog';
import { parseRoute } from '../src/store';

const [song] = toCatalog([
  { id: 'l1', title: 'Lakay', genre: 'kompa', artistId: 'u1', artistName: 'Ròz Mapou', duration: 200, peaks: null, releasedAt: 1, audioUrl: '/a', coverUrl: '/c' },
]).tracks;

describe('lyrics', () => {
  it('parses LRC with fractions, repeated stamps, tags and offset', () => {
    const l = parseLyrics('[ar:Someone]\n[offset:+500]\n[00:12.50]First\n[00:05]Intro line\n[01:02.3][01:30.25]Hook\nnot timed')!;
    expect(l.synced).toBe(true);
    expect(l.lines.map((x) => [x.time, x.text])).toEqual([
      [4.5, 'Intro line'],
      [12, 'First'],
      [61.8, 'Hook'],
      [89.75, 'Hook'],
    ]);
  });

  it('treats text without timestamps as unsynced', () => {
    const l = parseLyrics('One\n\nTwo  \n')!;
    expect(l.synced).toBe(false);
    expect(l.lines).toEqual([
      { time: null, text: 'One' },
      { time: null, text: 'Two' },
    ]);
    expect(parseLyrics('  \n')).toBeNull();
  });

  it('round-trips through toLrc', () => {
    const lines = [
      { time: 3.21, text: 'a' },
      { time: 65.5, text: 'b' },
    ];
    expect(toLrc(lines)).toBe('[00:03.21] a\n[01:05.50] b');
    expect(parseLyrics(toLrc(lines))!.lines).toEqual(lines);
  });

  it('finds the line being sung', () => {
    const lines = [
      { time: 2, text: 'a' },
      { time: 5, text: 'b' },
      { time: 9, text: 'c' },
    ];
    expect(activeLine(lines, 1)).toBe(-1);
    expect(activeLine(lines, 5)).toBe(1);
    expect(activeLine(lines, 100)).toBe(2);
  });

  it('shows only the lyrics an artist added, never made-up ones', () => {
    expect(lyricsFor(song)).toBeNull();
    expect(lyricsFor({ ...song, uploaded: true })).toBeNull();
    const l = lyricsFor({ ...song, lyrics: '[00:01.00] Lakay se lakay\n[00:04.50] Nou la' })!;
    expect(l.source).toBe('lrc');
    expect(l.lines.map((x) => x.text)).toEqual(['Lakay se lakay', 'Nou la']);
  });
});

describe('studio', () => {
  it('routes settings and studio pages', () => {
    expect(parseRoute('#/settings')).toEqual({ page: 'settings' });
    expect(parseRoute('#/studio')).toEqual({ page: 'studio', artistId: undefined });
    expect(parseRoute('#/studio/me')).toEqual({ page: 'studio', artistId: 'me' });
  });
});
