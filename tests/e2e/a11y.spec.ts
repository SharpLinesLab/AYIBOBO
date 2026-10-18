import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open, trackErrors } from './helpers';

const ROUTES = [
  '#/',
  '#/trending',
  '#/charts',
  '#/charts/albums/month',
  '#/genres',
  '#/genres/kompa',
  '#/song/tr-al-tiga-blaze-1-1',
  '#/album/al-lavi-soley-1',
  '#/artist/ar-sisi-lune',
  '#/playlist/pl-kompa-kings',
  '#/library/likes',
  '#/library/downloads',
  '#/search/lakay',
  '#/search',
  '#/upload',
  '#/settings',
  '#/studio/ar-tiga-blaze',
  '#/song/nope',
];

for (const theme of ['dark', 'light'] as const) {
  for (const route of ROUTES) {
    test(`${route} (${theme}) has no accessibility violations, overflow or errors`, async ({ page }) => {
      const errors = trackErrors(page);
      await open(page, route, theme);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
      expect(summary).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(1);
      await expect(page.locator('h1').first()).toBeVisible();
      errors.expectNone();
    });
  }
}
