import { expect, test } from '@playwright/test';
import { open, published } from './helpers';

test('downloaded songs play with no connection, and the app reloads offline', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'one project is enough');
  const song = (await published(page)).song();
  await open(page, song);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('.dhero').getByRole('button', { name: 'Download' }).click();
  await expect(page.locator('.dhero').getByRole('button', { name: 'Downloaded' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator('.conn')).toContainText('offline');
  await page.locator('.dhero .play-btn--lg').click();
  await expect(page.locator('.pbar').getByRole('button', { name: 'Pause' })).toBeVisible();
  // The app shell itself comes from the service worker's cache.
  await page.reload();
  await expect(page.locator('.conn')).toContainText('offline');
  await expect(page.locator('h1').first()).toBeVisible();
  await context.setOffline(false);
});
