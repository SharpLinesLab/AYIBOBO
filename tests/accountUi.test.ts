import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { lyricsFor } from '../src/catalog/lyrics';
import { playsInWindow } from '../src/catalog/plays';
import { setLang } from '../src/i18n';
import { dict as en } from '../src/i18n/locales/en';
import { dict as fr } from '../src/i18n/locales/fr';
import { dict as ht } from '../src/i18n/locales/ht';
import { getAccount, refreshAccount } from '../src/lib/account';
import { toCatalog, type PublishedTrack } from '../src/lib/serverCatalog';
import { MusicProvider } from '../src/music';
import { AdminPage } from '../src/pages/Admin';
import { AppProvider, parseRoute } from '../src/store';

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { documentElement: {} };
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => setLang('en', false));

/** Make `/api/auth/me` answer with this user, as the server would. */
async function signedInAs(user: { role: string } | null, contentType = 'application/json') {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true, user: user && { id: 'u1', email: 'a@example.com', displayName: 'A', createdAt: 1, ...user } }), { headers: { 'content-type': contentType } }));
  await refreshAccount();
}

// Inside the same providers as the app (the verification queue checks for artist pages).
const renderAdmin = () =>
  renderToStaticMarkup(
    createElement(AppProvider, { value: { now: 0, route: { page: 'admin' }, navigate: () => {}, toast: () => {} }, children: createElement(MusicProvider, { now: 0, children: createElement(AdminPage) }) }),
  );

describe('account routes', () => {
  it('parse #/account and #/admin', () => {
    expect(parseRoute('#/account')).toEqual({ page: 'account' });
    expect(parseRoute('#/admin')).toEqual({ page: 'admin' });
    expect(parseRoute('#/reset/abc-DEF_123')).toEqual({ page: 'reset', token: 'abc-DEF_123' });
    expect(parseRoute('#/reset')).toEqual({ page: 'account' });
  });

  it('treats a missing API server as "accounts unavailable"', async () => {
    await signedInAs(null, 'text/html');
    expect(getAccount().status).toBe('unavailable');
  });
});

describe('#/admin', () => {
  it('is "page not found" for visitors, listeners and artists', async () => {
    for (const user of [null, { role: 'listener' }, { role: 'artist' }]) {
      await signedInAs(user);
      const html = renderAdmin();
      expect(html).toContain(en['browse.notFound.page']);
      expect(html).not.toContain(en['admin.title']);
    }
  });

  it('shows the review queue to admins', async () => {
    await signedInAs({ role: 'admin' });
    expect(renderAdmin()).toContain(`<h1>${en['admin.title']}</h1>`);
  });
});

describe('published songs in the catalog', () => {
  const list: PublishedTrack[] = [
    { id: 'a1', title: 'One', genre: 'kompa', artistId: 'u1', artistName: 'Tiga', featuredArtists: 'Wendyyy, Joé Dwèt Filé', explicit: true, artist: { name: 'Tiga Blaze', bio: 'From Okap.', avatarUrl: '/api/artists/u1/avatar?v=5', verified: true }, duration: 200, peaks: [0.5, 1], releasedAt: 10, audioUrl: '/api/audio/a1', coverUrl: '/api/covers/a1' },
    { id: 'a2', title: 'Two', genre: 'zouk', artistId: 'u1', artistName: 'Tiga Blaze', featuredArtists: null, explicit: false, artist: { name: 'Tiga Blaze', bio: 'From Okap.', avatarUrl: '/api/artists/u1/avatar?v=5', verified: true }, duration: 150, peaks: null, releasedAt: 20, audioUrl: '/api/audio/a2', coverUrl: '/api/covers/a2' },
  ];

  it('become playable tracks under one artist per account', () => {
    const { tracks, artists } = toCatalog(list);
    expect(artists).toHaveLength(1);
    // The artist page uses the profile; each song keeps its own credit.
    expect(artists[0]).toMatchObject({ id: 'ar-srv-u1', name: 'Tiga Blaze', bio: 'From Okap.', verified: true, genres: ['kompa', 'zouk'] });
    expect(artists[0].avatar.imageUrl).toBe('/api/artists/u1/avatar?v=5');
    expect(tracks.map((t) => [t.artistName, t.featuredArtists, t.explicit])).toEqual([
      ['Tiga', 'Wendyyy, Joé Dwèt Filé', true],
      ['Tiga Blaze', undefined, false],
    ]);
    expect(tracks.map((t) => [t.id, t.artistId, t.audioUrl, t.cover.imageUrl, t.published])).toEqual([
      ['srv-a1', 'ar-srv-u1', '/api/audio/a1', '/api/covers/a1', true],
      ['srv-a2', 'ar-srv-u1', '/api/audio/a2', '/api/covers/a2', true],
    ]);
  });

  it('get no invented plays or lyrics', () => {
    const [t] = toCatalog(list).tracks;
    expect(playsInWindow(t, 1_000_000_000, 7)).toBe(0);
    expect(lyricsFor(t)).toBeNull();
  });
});

describe('account and admin strings', () => {
  it('exist and are translated in French and Kreyòl', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('account.') || k.startsWith('admin.'));
    expect(keys.length).toBeGreaterThan(60);
    for (const [lang, d] of [['fr', fr], ['ht', ht]] as const) {
      for (const k of keys) {
        const v = (d as Record<string, string>)[k];
        expect(v?.trim(), `${lang} ${k}`).toBeTruthy();
        // Placeholders survive translation.
        expect((v.match(/\{\w+\}/g) ?? []).sort(), `${lang} ${k}`).toEqual(((en as Record<string, string>)[k].match(/\{\w+\}/g) ?? []).sort());
        if (!['account.upload.genre'].includes(k) || lang === 'ht') expect(v, `${lang} ${k} untranslated`).not.toBe((en as Record<string, string>)[k]);
      }
    }
  });
});
