import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ARTIST_A } from './data';
import { open, published } from './helpers';
import { png } from './media';

test('songs show their artist credit, featured artists and explicit badge', async ({ page }) => {
  // "Third Song" is published as explicit, featuring "Guest Star" (see data.ts).
  await open(page, (await published(page)).song('Third Song'));
  const hero = page.locator('.dhero');
  await expect(hero.locator('.artist-links')).toHaveText(`${ARTIST_A} ft. Guest Star`);
  await expect(hero.getByLabel('Explicit')).toHaveCount(1);
  await hero.locator('.play-btn--lg').click();
  await expect(page.locator('.pbar__sub')).toHaveText(`${ARTIST_A} ft. Guest Star`);
  await expect(page.locator('.pbar__title').getByLabel('Explicit')).toHaveCount(1);
});

test('artists set their profile, and the upload form starts from it', async ({ page }, info) => {
  // One account per project, so the desktop and mobile runs don't edit the same profile.
  const email = `profile-${info.project.name}@e2e.test`;
  const password = 'e2e long enough password';
  let r = await page.request.post('/api/auth/signup', { data: { email, password, displayName: 'E2E Profile', role: 'artist' } });
  if (r.status() === 409) r = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(r.ok()).toBe(true);
  expect((await page.request.put('/api/account/profile', { data: { artistName: '', bio: '' } })).ok()).toBe(true); // clean start on re-runs

  await open(page, '#/account');
  const profile = page.locator('section', { has: page.getByRole('heading', { name: 'Artist profile' }) });
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'Send a song to ASF' }) });
  // The artist name starts as the display name; the upload form waits for a saved one.
  await expect(profile.getByLabel('Artist name')).toHaveValue('E2E Profile');
  await expect(form.getByLabel('Artist name')).toHaveValue('');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await profile.getByLabel('Artist name').fill('E2E Stage Name');
  await profile.getByLabel(/About you/).fill('Kompa from Jacmel.');
  await profile.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await expect(form.getByLabel('Artist name')).toHaveValue('E2E Stage Name');
  await expect(form.getByLabel(/Featured artists/)).toHaveValue('');
  await expect(form.getByLabel('Explicit lyrics')).not.toBeChecked();

  await profile.getByLabel(/profile picture/i).setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png([200, 80, 40]) });
  await expect(profile.getByRole('img', { name: 'Profile picture of E2E Stage Name' })).toBeVisible();
});
