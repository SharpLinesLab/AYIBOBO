import { expect, type Page } from '@playwright/test';
import { ARTIST_A, SONGS } from './data';

/** Open a route and wait until it has rendered and finished animating in. */
export async function open(page: Page, hash: string, theme?: 'dark' | 'light') {
  if (theme) await page.addInitScript((t) => localStorage.setItem('asf:theme', t), theme);
  await page.goto(`/${hash}`);
  await page.waitForLoadState('networkidle');
  await settle(page);
}

/**
 * Wait for short entrance animations (page fades, reveals) to finish. Looping animations and
 * long ones like the hero carousel's progress bar don't count.
 */
export async function settle(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => {
      const t = a.effect?.getComputedTiming();
      return a.playState !== 'running' || !t || t.iterations === Infinity || Number(t.duration) > 1500;
    }),
  );
}

/** Collect page errors and console errors for the rest of the test. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { expectNone: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** Links to the published test songs (see data.ts) and their artists' pages. */
export async function published(page: Page) {
  const res = await page.request.get('/api/catalog/uploads');
  const { tracks } = (await res.json()) as { tracks: { id: string; title: string; artistId: string }[] };
  const find = (title: string) => {
    const t = tracks.find((x) => x.title === title);
    if (!t) throw new Error(`"${title}" isn't published; the setup project publishes it`);
    return t;
  };
  return {
    song: (title: (typeof SONGS)[number]['title'] = 'First Song') => `#/song/srv-${find(title).id}`,
    artist: (name = ARTIST_A) => `#/artist/ar-srv-${find(SONGS.find((s) => s.artist === name)!.title).artistId}`,
  };
}

/** Fill in `{song}` and `{artist}` in a route with a published test song and its artist. */
export async function resolve(page: Page, route: string): Promise<string> {
  if (!/\{(song|artist)\}/.test(route)) return route;
  const p = await published(page);
  return route.replace('#/song/{song}', p.song()).replace('#/artist/{artist}', p.artist());
}

/**
 * Start playback from an artist's page (all of the artist's songs, in page order) and wait until
 * the player bar shows it. Returns the song titles in that order.
 */
export async function playArtist(page: Page, name = ARTIST_A): Promise<string[]> {
  await open(page, (await published(page)).artist(name));
  const titles = await page.locator('.trow__title').allTextContents();
  await page.locator('.ahero .phead__actions .play-btn').click();
  await expect(page.locator('.pbar')).toBeVisible();
  return titles;
}

/** Current playback position (seconds) as exposed by the seek slider or waveform. */
export async function position(page: Page): Promise<number> {
  const v = await page.locator('.seek__track, .pbar [role="slider"]').first().getAttribute('aria-valuenow');
  return Number(v ?? 0);
}
