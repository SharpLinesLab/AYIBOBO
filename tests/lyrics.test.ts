import { describe, expect, it } from 'vitest';
import { activeLine, lyricsFor, parseLyrics, toLrc } from '../src/catalog/lyrics';
import { dailyPlays, playsInWindow } from '../src/catalog/plays';
import { createCatalog } from '../src/catalog/seed';
import { parseRoute } from '../src/store';

const NOW = Date.parse('2026-10-17T15:00:00Z');
const cat = createCatalog(NOW);

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

  it('gives seed songs synced demo lyrics inside the song, with the title in the hook', () => {
    const t = cat.tracks.find((x) => x.genre === 'kompa')!;
    const l = lyricsFor(t)!;
    expect(l.synced).toBe(true);
    expect(l.lines.length).toBeGreaterThan(8);
    expect(l.lines.every((x) => x.time! >= 0 && x.time! < t.duration)).toBe(true);
    expect(l.lines.some((x) => x.text === t.title)).toBe(true);
    const times = l.lines.map((x) => x.time!);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(lyricsFor({ ...t, uploaded: true })).toBeNull();
  });
});

describe('studio data', () => {
  it('daily plays add up to the window totals', () => {
    const t = cat.tracks[0];
    const days = dailyPlays(t, NOW, 28);
    expect(days).toHaveLength(28);
    const sum = days.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - playsInWindow(t, NOW, 28))).toBeLessThanOrEqual(28);
  });

  it('routes settings and studio pages', () => {
    expect(parseRoute('#/settings')).toEqual({ page: 'settings' });
    expect(parseRoute('#/studio')).toEqual({ page: 'studio', artistId: undefined });
    expect(parseRoute('#/studio/me')).toEqual({ page: 'studio', artistId: 'me' });
  });
});
