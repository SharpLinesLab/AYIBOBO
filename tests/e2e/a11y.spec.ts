import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open, resolve, trackErrors } from './helpers';

const ROUTES = [
  '#/',
  '#/trending',
  '#/charts',
  '#/charts/albums/month',
  '#/genres',
  '#/genres/kompa',
  '#/genres/gospel',
  '#/song/{song}',
  '#/artist/{artist}',
  '#/playlist/mix-kompa',
  '#/library/likes',
  '#/library/downloads',
  '#/search/song',
  '#/search',
  '#/settings',
  '#/studio',
  '#/account',
  '#/admin',
  '#/reset/sample-token',
  '#/privacy',
  '#/terms',
  '#/copyright',
  '#/song/nope',
];

for (const theme of ['dark', 'light'] as const) {
  for (const route of ROUTES) {
    test(`${route} (${theme}) has no accessibility violations, overflow or errors`, async ({ page }) => {
      const errors = trackErrors(page);
      await open(page, await resolve(page, route), theme);
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
