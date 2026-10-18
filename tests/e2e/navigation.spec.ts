import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('first Tab focuses a visible skip link that moves focus to the content', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation');
  await open(page, '#/');
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#content')).toBeFocused();
});

test('every page has its own title and unknown URLs show a not-found page', async ({ page }) => {
  await open(page, '#/album/al-lavi-soley-1');
  await expect(page).toHaveTitle(/Sezon Soley — Lavi Soley · ASF/);
  await open(page, '#/settings');
  await expect(page).toHaveTitle('Settings · ASF');
  await open(page, '#/definitely-not-a-page');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/couldn.t find/i);
});

test('Back restores the previous scroll position', async ({ page }) => {
  await open(page, '#/trending');
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.locator('.trow__title').nth(12).click();
  await expect(page).toHaveURL(/#\/song\//);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(800);
});

test('⌘K command palette finds and plays a song', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcut');
  await open(page, '#/');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search music or type a command…').fill('kanaval');
  await page.keyboard.press('Enter');
  await expect(page.locator('.pbar__title')).toHaveText('Kanaval');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search music or type a command…').fill('artist studio');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/studio/);
});
