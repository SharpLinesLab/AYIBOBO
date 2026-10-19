/**
 * Artist royalties, pre-launch: the browser reports each play of a published song (signed in
 * only); artists see their streams and eligibility on #/account, admins a monthly summary on
 * #/admin. No money moves yet.
 */
import { getState, onPlay } from '../player/engine';
import { ROYALTY_RULES, type EligibilityCriteria } from './royaltyMath';

const randomId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^\w-]/g, '');

function report(body: { playId: string; trackId: string; seconds: number }, leaving = false) {
  const json = JSON.stringify(body);
  try {
    // Leaving the page: sendBeacon still gets through as the tab closes.
    if (leaving && navigator.sendBeacon?.('/api/plays', new Blob([json], { type: 'application/json' }))) return;
    void fetch('/api/plays', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'content-type': 'application/json' }, body: json }).catch(() => undefined);
  } catch {
    /* offline or blocked: this play isn't counted */
  }
}

/**
 * Report plays of published songs (ids `srv-…`) to the server: once when one starts, once it has
 * been heard for 30 seconds, and when it stops (next song, or the page closing). Only time actually
 * playing counts: not paused, and not while an ad plays. Returns a function that stops it.
 */
export function trackRoyaltyPlays(): () => void {
  let cur: { playId: string; itemId: string; trackId: string; seconds: number; sent: number } | null = null;
  const send = (leaving = false) => {
    if (!cur) return;
    const seconds = Math.floor(cur.seconds);
    if (seconds <= cur.sent) return;
    cur.sent = seconds;
    report({ playId: cur.playId, trackId: cur.trackId, seconds }, leaving);
  };
  const off = onPlay((p) => {
    send();
    cur = null;
    if (p.preview || !p.id.startsWith('srv-')) return;
    cur = { playId: randomId(), itemId: p.id, trackId: p.id.slice(4), seconds: 0, sent: -1 };
    send();
  });
  let last = Date.now();
  const timer = window.setInterval(() => {
    const now = Date.now();
    const s = getState();
    if (cur && s.playing && !s.ad && s.current?.id === cur.itemId) {
      const before = cur.seconds;
      cur.seconds += Math.min(now - last, 5000) / 1000;
      if (before < ROYALTY_RULES.minSeconds && cur.seconds >= ROYALTY_RULES.minSeconds) send();
    }
    last = now;
  }, 1000);
  const leave = () => {
    if (document.visibilityState === 'hidden') send(true);
  };
  document.addEventListener('visibilitychange', leave);
  window.addEventListener('pagehide', leave);
  return () => {
    send();
    cur = null;
    off();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', leave);
    window.removeEventListener('pagehide', leave);
  };
}

export interface RoyaltyDashboard {
  period: string;
  streamsThisMonth: number;
  streams90d: number;
  verified: boolean;
  premiumStreams90d: number;
  publishedTracks: number;
  activeStrikes: number;
  criteria: EligibilityCriteria;
  eligible: boolean;
}

export interface RoyaltyArtistMonth {
  artistId: string;
  artistName: string;
  streams: number;
  premiumStreams: number;
  premiumStreams90d: number;
  publishedTracks: number;
  verified: boolean;
  activeStrikes: number;
  criteria: EligibilityCriteria;
  eligible: boolean;
}

export interface RoyaltySummary {
  period: string;
  asOf: number;
  totalStreams: number;
  premiumStreams: number;
  eligibleArtists: number;
  eligibleStreams: number;
  artists: RoyaltyArtistMonth[];
}

export interface RoyaltyPeriod {
  period: string;
  startsAt: number;
  endsAt: number;
  totalStreams: number;
  premiumStreams: number;
  eligibleArtists: number;
  eligibleStreams: number;
  createdAt: number;
}

/** Your streams and eligibility, or null if they couldn't be loaded. */
export async function myRoyalties(): Promise<RoyaltyDashboard | null> {
  try {
    const res = await fetch('/api/account/royalties', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as RoyaltyDashboard) : null;
  } catch {
    return null;
  }
}

/** A month's summary (admins only), or null if it couldn't be loaded. */
export async function royaltySummary(period?: string): Promise<{ summary: RoyaltySummary; periods: RoyaltyPeriod[] } | null> {
  try {
    const res = await fetch(`/api/admin/royalties${period ? `?period=${encodeURIComponent(period)}` : ''}`, { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as { summary: RoyaltySummary; periods: RoyaltyPeriod[] }) : null;
  } catch {
    return null;
  }
}
