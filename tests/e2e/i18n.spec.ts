import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open, trackErrors } from './helpers';

test.describe('browser language is detected', () => {
  test.use({ locale: 'fr-FR' });
  test('a French browser gets the French interface', async ({ page }) => {
    await open(page, '#/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('link', { name: 'Tendances' }).first()).toBeVisible();
  });
});

test('switching to Kreyòl in Settings sticks after a reload', async ({ page }) => {
  await open(page, '#/settings');
  await page.getByRole('radio', { name: /Kreyòl/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ht');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paramèt');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paramèt');
  await expect(page).toHaveTitle(/Paramèt/);
});

const ROUTES = [
  '#/',
  '#/trending',
  '#/charts',
  '#/genres/kompa',
  '#/song/tr-al-tiga-blaze-1-1',
  '#/album/al-lavi-soley-1',
  '#/artist/ar-sisi-lune',
  '#/library/likes',
  '#/upload',
  '#/settings',
  '#/studio/ar-tiga-blaze',
  '#/account',
  '#/admin',
  '#/privacy',
  '#/terms',
  '#/copyright',
];

for (const lang of ['fr', 'ht'] as const) {
  for (const route of ROUTES) {
    test(`${route} in ${lang}: accessible, no overflow, no errors`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.addInitScript((l) => localStorage.setItem('asf:lang', l), lang);
      await open(page, route);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(1);
      errors.expectNone();
    });
  }
}
