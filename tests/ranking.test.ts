import { describe, expect, it } from 'vitest';
import { applyClaim, quoteClaim } from '../src/lib/claim';
import { normalizeInput, type NormalizedTarget } from '../src/lib/normalize';
import { getArchiveBoard, getBoard, minBidForRank, projectRank, stepAmount, utcDayKey } from '../src/lib/ranking';
import { createSeedState } from '../src/lib/seed';
import type { LeaderboardState } from '../src/lib/types';
import type { ListingDraft } from '../src/lib/claim';

const NOW = Date.parse('2026-10-17T15:00:00Z');
const draft: ListingDraft = {
  title: 'Test',
  tagline: '',
  description: '',
  category: 'artist',
  artwork: { from: '#000', to: '#fff', glyph: 'T' },
};
const target = (raw: string) => normalizeInput(raw) as NormalizedTarget;
const seed = () => createSeedState(NOW);

function claim(state: LeaderboardState, raw: string, amount: number, board: 'all' | 'today' = 'all', at = NOW) {
  const r = applyClaim(state, target(raw), board, amount, draft, at);
  if (!('state' in r)) throw new Error(r.error);
  return r;
}

describe('seed board', () => {
  it('matches the spec tiers', () => {
    const all = getBoard(seed(), 'all', NOW);
    expect(all).toHaveLength(20);
    expect(all[0].total).toBe(17001);
    expect(all[3].total).toBe(13005);
    expect(all[19].total).toBe(600);
    const today = getBoard(seed(), 'today', NOW);
    expect(today.map((e) => e.total)).toEqual([15, 10, 10]);
  });

  it('prices ranks with +$5 for #1 and +$1 otherwise', () => {
    const all = getBoard(seed(), 'all', NOW);
    expect(minBidForRank(all, 1)).toBe(17006);
    expect(minBidForRank(all, 4)).toBe(13006);
    expect(minBidForRank(all, 21)).toBe(10);
  });

  it('projects ranks for hero amounts', () => {
    const all = getBoard(seed(), 'all', NOW);
    expect(projectRank(all, 3501).rank).toBe(14);
    expect(projectRank(all, 17006).rank).toBe(1);
    expect(projectRank(all, 13006).rank).toBe(4);
    expect(projectRank(all, 13005).rank).toBe(5); // tie -> older keeps the rank
    const band = projectRank(all, 17003);
    expect(band.belowTopPremium).toBe(true);
    expect(band.rank).toBe(2);
  });

  it('stepper skips the #1 dead band', () => {
    const all = getBoard(seed(), 'all', NOW);
    expect(stepAmount(all, 17006, -1, 10)).toBe(17001);
    expect(stepAmount(all, 17001, 1, 10)).toBe(17006);
    expect(stepAmount(all, 10, -1, 10)).toBe(10);
  });
});

describe('claims', () => {
  it('new listing pays full amount and lands on all three boards', () => {
    const r = claim(seed(), 'https://newsite.fm?utm_source=x', 13006);
    expect(r.quote.mode).toBe('new');
    expect(r.payment.amount).toBe(13006);
    expect(r.quote.ranks.all.after).toBe(4);
    expect(r.quote.ranks.today.after).toBe(1);
    const all = getBoard(r.state, 'all', NOW);
    expect(all[3].listing.key).toBe('newsite.fm');
    expect(getBoard(r.state, 'today', NOW)[0].listing.key).toBe('newsite.fm');
    expect(getArchiveBoard(r.state, utcDayKey(NOW))[0].total).toBe(13006);
  });

  it('rejects the #1 dead band and offers the minimum', () => {
    const q = quoteClaim(seed(), 'newsite.fm', 'all', 17003, NOW);
    expect(q.ok).toBe(false);
    expect(!q.ok && q.suggested).toBe(17006);
  });

  it('existing listing tops up and pays only the difference', () => {
    const s = seed();
    const q = quoteClaim(s, 'loopcrate.co', 'all', 3501, NOW);
    expect(q.ok && q.mode).toBe('topup');
    expect(q.ok && q.currentTotal).toBe(1250);
    expect(q.ok && q.charge).toBe(2251);
    expect(q.ok && q.ranks.all.before).toBe(18);
    expect(q.ok && q.ranks.all.after).toBe(14);
    const r = claim(s, 'https://loopcrate.co/kits?ref=tw', 3501);
    expect(r.payment.amount).toBe(2251);
    expect(getBoard(r.state, 'all', NOW).find((e) => e.listing.key === 'loopcrate.co')?.total).toBe(3501);
    expect(r.state.listings).toHaveLength(20);
  });

  it('top-up must beat current total', () => {
    const q = quoteClaim(seed(), 'loopcrate.co', 'all', 1250, NOW);
    expect(!q.ok && q.code).toBe('not_above_current');
    expect(!q.ok && q.suggested).toBe(1251);
  });

  it('current #1 raising its own total does not need the +$5 premium', () => {
    const q = quoteClaim(seed(), 'stemforge.ai', 'all', 17002, NOW);
    expect(q.ok && q.charge).toBe(1);
  });

  it('a different URL cannot hijack a rank by paying the difference', () => {
    const q = quoteClaim(seed(), 'otherlabel.com', 'all', 13006, NOW);
    expect(q.ok && q.charge).toBe(13006);
  });

  it('enforces min and max', () => {
    expect(quoteClaim(seed(), 'x.fm', 'all', 9, NOW).ok).toBe(false);
    expect(quoteClaim(seed(), 'x.fm', 'all', 1_000_000, NOW).ok).toBe(false);
    expect(quoteClaim(seed(), 'x.fm', 'all', 12.5, NOW).ok).toBe(false);
  });

  it('today board: tops up against today total and keeps chronological ties', () => {
    const s = seed();
    // Aurelia & Fuzzhouse both have $10 today; Aurelia paid first so it is #2.
    const today = getBoard(s, 'today', NOW);
    expect(today[1].listing.key).toBe('aurelia.world');
    expect(today[2].listing.key).toBe('fuzzhouse.shop');
    const r = claim(s, 'fuzzhouse.shop', 20, 'today');
    expect(r.payment.amount).toBe(10);
    const after = getBoard(r.state, 'today', NOW);
    expect(after[0].listing.key).toBe('fuzzhouse.shop');
    // #1 on today needs +$5 over LoopCrate's $15
    const q = quoteClaim(s, 'newsite.fm', 'today', 18, NOW);
    expect(!q.ok && q.suggested).toBe(20);
  });

  it('today board resets at midnight UTC while all-time persists; archive is frozen', () => {
    const s = seed();
    const tomorrow = Date.parse('2026-10-18T00:00:01Z');
    expect(getBoard(s, 'today', tomorrow)).toHaveLength(0);
    expect(getBoard(s, 'all', tomorrow)[0].total).toBe(17001);
    expect(getArchiveBoard(s, '2026-10-17').map((e) => e.total)).toEqual([15, 10, 10]);
  });
});
