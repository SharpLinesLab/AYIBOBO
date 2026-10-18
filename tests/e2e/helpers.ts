import { expect, type Page } from '@playwright/test';

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

/** Start playback from an album page and wait until the player bar shows it. */
export async function playAlbum(page: Page, id = 'al-lavi-soley-1') {
  await open(page, `#/album/${id}`);
  await page.locator('.dhero .play-btn--lg').click();
  await expect(page.locator('.pbar')).toBeVisible();
}

/** Current playback position (seconds) as exposed by the seek slider or waveform. */
export async function position(page: Page): Promise<number> {
  const v = await page.locator('.seek__track, .pbar [role="slider"]').first().getAttribute('aria-valuenow');
  return Number(v ?? 0);
}
