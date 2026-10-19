import { describe, expect, it } from 'vitest';
import { AdSchedule } from '../src/player/adBreaks';

const MIN = 60_000;

describe('ad breaks', () => {
  it('are due after 4 songs, then count again from zero', () => {
    const s = new AdSchedule();
    for (let i = 0; i < 3; i++) s.songStarted();
    expect(s.due()).toBe(false);
    s.songStarted();
    expect(s.due()).toBe(true);
    s.breakTaken();
    expect(s.due()).toBe(false);
  });

  it('are due after 15 minutes of listening, whichever comes first', () => {
    const s = new AdSchedule();
    s.songStarted();
    s.listen(14 * MIN);
    expect(s.due()).toBe(false);
    s.listen(MIN);
    expect(s.due()).toBe(true);
  });

  it('are due after more than 6 skips within an hour', () => {
    const s = new AdSchedule();
    const t0 = 1_000_000_000;
    for (let i = 0; i < 6; i++) s.skipped(t0 + i * MIN);
    expect(s.due(t0 + 6 * MIN)).toBe(false);
    s.skipped(t0 + 6 * MIN);
    expect(s.due(t0 + 6 * MIN)).toBe(true);
    // Skips older than an hour no longer count.
    expect(s.due(t0 + 61 * MIN)).toBe(false);
  });

  it('ignore negative listening time', () => {
    const s = new AdSchedule();
    s.listen(-20 * MIN);
    s.listen(15 * MIN);
    expect(s.due()).toBe(true);
  });
});
