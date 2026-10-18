/**
 * Data backend. If the app is served next to the API server (`/api/health` answers) it runs in
 * remote mode with real persistence and Stripe Checkout. Otherwise — e.g. static hosting or a
 * plain `vite` dev server — it runs a self-contained demo that keeps your bids in localStorage
 * and simulates live traffic and bidding.
 */
import type { CheckoutRequest, CheckoutResult, HealthResponse, StateResponse } from './lib/api';
import { applyClaim } from './lib/claim';
import { simulateMetadata, type SiteMetadata } from './lib/metadata';
import { resolveAndNormalize, type NormalizeResult, type NormalizedTarget } from './lib/normalize';
import { getBoard } from './lib/ranking';
import { SEED_LIFETIME_VISITORS, createSeedState } from './lib/seed';
import { syntheticHistory, type LiveStats } from './lib/stats';
import type { LeaderboardState, Listing, Payment } from './lib/types';

export interface Snapshot {
  state: LeaderboardState;
  stats: LiveStats;
  /** Clock offset to the source of truth (server time − local time). */
  offset: number;
}

export interface Backend {
  mode: 'local' | 'remote';
  stripe: boolean;
  load(): Promise<Snapshot>;
  resolve(input: string): Promise<NormalizeResult>;
  scrape(target: NormalizedTarget): Promise<SiteMetadata>;
  checkout(req: CheckoutRequest): Promise<CheckoutResult>;
  click(listingId: string): void;
  /** Newsletter sign-up. */
  subscribeEmail(email: string): Promise<{ ok: boolean; error?: string }>;
  /** Push updates (simulated live activity or server polling). */
  subscribe(cb: (s: Snapshot) => void): () => void;
  reset?(): void;
}

// ---------------------------------------------------------------------------------------------
// Local demo backend

const STORAGE_KEY = 'soundbid:v1';

interface Persisted {
  listings: Listing[];
  payments: Payment[];
  clicks: Record<string, number>;
}

function readPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (Array.isArray(p.listings) && Array.isArray(p.payments)) return { ...p, clicks: p.clicks ?? {} };
    }
  } catch {
    /* private mode / corrupted — start fresh */
  }
  return { listings: [], payments: [], clicks: {} };
}

function writePersisted(p: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked — the demo still works for this tab */
  }
}

/** Demo short links, so the "resolve shortener" path can be tried without a server. */
const DEMO_SHORTLINKS: Record<string, string> = {
  'bit.ly/stemforge': 'https://www.stemforge.ai/?utm_source=bitly&utm_campaign=launch',
  'bit.ly/loopcrate': 'https://loopcrate.co/kits?ref=twitter',
  'ffm.to/sodium-lights': 'https://nightbus.bandcamp.com/album/sodium-lights?from=ffm',
  'spoti.fi/mara': 'https://open.spotify.com/artist/4Zq8MaraOkoyeDemo01x?si=8f2c',
};

async function demoResolver(url: string): Promise<string> {
  const u = new URL(url);
  const k = `${u.hostname.replace(/^www\./, '')}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  if (DEMO_SHORTLINKS[k]) return DEMO_SHORTLINKS[k];
  if (u.hostname.endsWith('linktr.ee')) return url;
  throw new Error('unresolvable');
}

export function createLocalBackend(): Backend {
  const sessionStart = Date.now();
  const seed = createSeedState(sessionStart);
  let persisted = readPersisted();
  /** Simulated bids from other visitors — session only, so reloading restores the canonical demo. */
  let botPayments: Payment[] = [];
  let online = 9 + Math.floor(Math.random() * 8);
  let extraVisitors = 0;
  let clicksToday = 0;
  const subs = new Set<(s: Snapshot) => void>();

  const state = (): LeaderboardState => {
    const listings = [...seed.listings, ...persisted.listings].map((l) =>
      persisted.clicks[l.id] ? { ...l, clicks: l.clicks + persisted.clicks[l.id] } : l,
    );
    const payments = [...seed.payments, ...persisted.payments, ...botPayments].sort((a, b) => a.at - b.at);
    return { listings, payments };
  };

  const stats = (): LiveStats => {
    const history = syntheticHistory(Date.now());
    history[history.length - 1].visitors += extraVisitors;
    history[history.length - 1].clicks += clicksToday;
    const today = history[history.length - 1];
    const past = history.slice(0, -1).reduce((s, d) => s + d.visitors, 0);
    return {
      online,
      visitorsToday: today.visitors,
      visitorsLifetime: SEED_LIFETIME_VISITORS + past + today.visitors,
      clicksToday: today.clicks,
      history,
    };
  };

  const snapshot = (): Snapshot => ({ state: state(), stats: stats(), offset: 0 });
  const notify = () => {
    const s = snapshot();
    subs.forEach((cb) => cb(s));
  };

  let timers: number[] = [];
  const startSimulation = () => {
    const userIds = () => new Set(persisted.listings.map((l) => l.id).concat(persisted.payments.map((p) => p.listingId)));
    const presence = () => {
      online = Math.max(4, Math.min(38, online + Math.round((Math.random() - 0.45) * 3)));
      if (Math.random() < 0.6) extraVisitors += 1 + Math.floor(Math.random() * 3);
      notify();
      timers.push(window.setTimeout(presence, 4000 + Math.random() * 5000));
    };
    const bot = () => {
      if (botPayments.length < 25 && !document.hidden) {
        // Small bids lower down the board; never touch listings this visitor paid for.
        const board = getBoard(state(), 'all', Date.now()).filter((e) => e.rank >= 8 && !userIds().has(e.listing.id));
        const pick = board[Math.floor(Math.random() * board.length)];
        if (pick) {
          botPayments = [
            ...botPayments,
            { id: `pay_bot_${Date.now()}`, listingId: pick.listing.id, amount: 10 + Math.floor(Math.random() * 6) * 5, at: Date.now() },
          ];
          notify();
        }
      }
      timers.push(window.setTimeout(bot, 45_000 + Math.random() * 60_000));
    };
    timers.push(window.setTimeout(presence, 3000));
    timers.push(window.setTimeout(bot, 25_000));
  };

  return {
    mode: 'local',
    stripe: false,
    async load() {
      return snapshot();
    },
    resolve: (input) => resolveAndNormalize(input, demoResolver),
    async scrape(target) {
      // A short pause so the scanning state is visible; real scraping happens server-side.
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
      return simulateMetadata(target);
    },
    async checkout(req) {
      const target = await resolveAndNormalize(req.input, demoResolver);
      if (!target.ok) return { kind: 'error', error: target.error };
      await new Promise((r) => setTimeout(r, 900));
      const result = applyClaim(state(), target, req.board, req.amount, req.draft, Date.now());
      if (!('state' in result)) return { kind: 'error', error: result.error, suggested: result.suggested };
      const isNew = !persisted.listings.some((l) => l.id === result.listing.id) && !seed.listings.some((l) => l.id === result.listing.id);
      persisted = {
        ...persisted,
        listings: isNew ? [...persisted.listings, result.listing] : persisted.listings,
        payments: [...persisted.payments, result.payment],
      };
      writePersisted(persisted);
      const s = snapshot();
      subs.forEach((cb) => cb(s));
      return { kind: 'applied', state: s.state, listingId: result.listing.id, paymentId: result.payment.id, quote: result.quote };
    },
    async subscribeEmail(email) {
      try {
        const list = JSON.parse(localStorage.getItem('asf:subscribers') ?? '[]') as string[];
        if (!list.includes(email)) localStorage.setItem('asf:subscribers', JSON.stringify([...list, email]));
      } catch {
        /* storage blocked — still acknowledge in the demo */
      }
      return { ok: true };
    },
    click(listingId) {
      persisted = { ...persisted, clicks: { ...persisted.clicks, [listingId]: (persisted.clicks[listingId] ?? 0) + 1 } };
      clicksToday++;
      writePersisted(persisted);
      notify();
    },
    subscribe(cb) {
      subs.add(cb);
      if (subs.size === 1) startSimulation();
      return () => {
        subs.delete(cb);
        if (subs.size === 0) {
          timers.forEach(clearTimeout);
          timers = [];
        }
      };
    },
    reset() {
      persisted = { listings: [], payments: [], clicks: {} };
      botPayments = [];
      writePersisted(persisted);
      notify();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Remote backend

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !('kind' in body) && !('ok' in body)) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

function visitorId(): string {
  try {
    let id = localStorage.getItem('soundbid:visitor');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('soundbid:visitor', id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

function createRemoteBackend(health: HealthResponse): Backend {
  const toSnapshot = (r: StateResponse): Snapshot => ({ state: r.state, stats: r.stats, offset: r.now - Date.now() });
  const load = async () => toSnapshot(await json<StateResponse>('/api/state'));
  const subs = new Set<(s: Snapshot) => void>();
  return {
    mode: 'remote',
    stripe: health.stripe,
    load,
    resolve: (input) => json<NormalizeResult>('/api/resolve', { method: 'POST', body: JSON.stringify({ input }) }),
    scrape: (target) => json<SiteMetadata>('/api/metadata', { method: 'POST', body: JSON.stringify({ input: target.kind === 'handle' ? target.key : target.url }) }),
    async checkout(req) {
      const res = await json<CheckoutResult>('/api/checkout', { method: 'POST', body: JSON.stringify(req) });
      if (res.kind === 'applied') {
        // Show the new rank right away instead of waiting for the next poll.
        const s = await load().catch(() => null);
        if (s) subs.forEach((cb) => cb(s));
      }
      return res;
    },
    subscribeEmail: (email) => json<{ ok: boolean; error?: string }>('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) }),
    click(listingId) {
      const body = JSON.stringify({ listingId });
      if (!navigator.sendBeacon?.('/api/click', new Blob([body], { type: 'application/json' }))) {
        void fetch('/api/click', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true });
      }
    },
    subscribe(cb) {
      let stopped = false;
      subs.add(cb);
      const id = visitorId();
      const poll = async () => {
        if (stopped) return;
        try {
          await fetch('/api/ping', { method: 'POST', body: JSON.stringify({ visitorId: id }), headers: { 'content-type': 'application/json' } });
          cb(toSnapshot(await json<StateResponse>('/api/state')));
        } catch {
          /* transient network error — try again next tick */
        }
        if (!stopped) timer = window.setTimeout(poll, document.hidden ? 60_000 : 10_000);
      };
      let timer = window.setTimeout(poll, 0);
      return () => {
        stopped = true;
        subs.delete(cb);
        clearTimeout(timer);
      };
    },
  };
}

export async function createBackend(): Promise<Backend> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok && res.headers.get('content-type')?.includes('json')) {
      const health = (await res.json()) as HealthResponse;
      if (health.ok) return createRemoteBackend(health);
    }
  } catch {
    /* no API server — fall through to the demo */
  }
  return createLocalBackend();
}
