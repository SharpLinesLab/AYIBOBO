import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('the app reloads and plays with no connection after the first visit', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'one project is enough');
  await open(page, '#/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('/#/album/al-lavi-soley-1');
  await expect(page).toHaveTitle(/Sezon Soley/);
  await expect(page.locator('.conn')).toContainText('offline');
  await page.locator('.dhero .play-btn--lg').click();
  await expect(page.locator('.pbar').getByRole('button', { name: 'Pause' })).toBeVisible();
  await context.setOffline(false);
});
