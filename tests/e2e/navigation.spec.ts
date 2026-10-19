import { expect, test } from '@playwright/test';
import { ARTIST_A } from './data';
import { open, published } from './helpers';

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
  await open(page, (await published(page)).song('First Song'));
  await expect(page).toHaveTitle(`First Song — ${ARTIST_A} · ASF`);
  await open(page, '#/settings');
  await expect(page).toHaveTitle('Settings · ASF');
  await open(page, '#/definitely-not-a-page');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/couldn.t find/i);
});

test('Back restores the previous scroll position', async ({ page }) => {
  await open(page, '#/');
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await page.waitForTimeout(200);
  // Follow a song or artist link that's already on screen, so the click itself doesn't scroll.
  await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#/song/"], a[href^="#/artist/"]')]
      .find((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.top > 0 && r.bottom < innerHeight;
      })!
      .click(),
  );
  await expect(page).toHaveURL(/#\/(song|artist)\//);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(800);
});

test('⌘K command palette finds and plays a song', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcut');
  await open(page, '#/');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search music or type a command…').fill('second song');
  await page.keyboard.press('Enter');
  await expect(page.locator('.pbar__title')).toHaveText('Second Song');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search music or type a command…').fill('artist studio');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/studio/);
});

test('pages with nothing to show say so', async ({ page }) => {
  // Every test song is kompa, and ASF has no albums.
  await open(page, '#/genres/gospel');
  await expect(page.getByRole('heading', { name: 'No music yet' })).toBeVisible();
  await open(page, '#/charts/albums/month');
  await expect(page.getByRole('heading', { name: 'Nothing on this chart yet' })).toBeVisible();
});

test('with nothing published yet, Discover shows an empty state', async ({ page }) => {
  await page.route('**/api/catalog/uploads', (r) => r.fulfill({ json: { ok: true, tracks: [] } }));
  await open(page, '#/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No music yet');
  await expect(page.getByRole('link', { name: 'Upload music' }).last()).toHaveAttribute('href', '#/account');
  await expect(page.locator('.shelf')).toHaveCount(0);
});
