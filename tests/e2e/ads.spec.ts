import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { ARTIST_A } from './data';
import { open, playArtist } from './helpers';
import { wav } from './media';

const PASSWORD = 'e2e long enough password';
const AD_SECONDS = 3;

/** The admin account the setup project made, signed in through its own request context. */
async function asAdmin(playwright: { request: { newContext: (o: { baseURL?: string }) => Promise<APIRequestContext> } }, baseURL?: string) {
  const admin = await playwright.request.newContext({ baseURL });
  expect((await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  return admin;
}

test('free listeners hear an ad between songs, which can’t be skipped, then the queue goes on', async ({ page, playwright, isMobile }, info) => {
  test.skip(isMobile, 'one project is enough');
  const admin = await asAdmin(playwright, info.project.use.baseURL);
  const r = await admin.post('/api/admin/ads', {
    multipart: {
      title: 'E2E Ad',
      advertiserName: 'E2E Advertiser',
      duration: String(AD_SECONDS),
      active: '1',
      audio: { name: 'ad.wav', mimeType: 'audio/wav', buffer: wav(9, AD_SECONDS).file },
    },
  });
  expect(r.status()).toBe(201);
  const { ad } = (await r.json()) as { ad: { id: string } };
  try {
    // Four songs (the artist's three, then autoplay), then the next song change brings the ad.
    const titles = await playArtist(page, ARTIST_A);
    const bar = page.locator('.pbar');
    const nextBtn = bar.getByRole('button', { name: 'Next', exact: true });
    for (let i = 0; i < 3; i++) {
      await nextBtn.click();
      await expect(bar.locator('.ad-label')).toHaveCount(0);
    }
    await nextBtn.click();
    await expect(bar.locator('.ad-label')).toHaveText('Ad');
    await expect(bar.locator('.pbar__title')).toContainText('E2E Ad');
    await expect(bar.locator('.pbar__sub')).toHaveText('E2E Advertiser');
    await expect(nextBtn).toBeDisabled();
    await expect(bar.getByRole('button', { name: 'Previous' })).toBeDisabled();
    // When the ad ends, the queue picks up again (back to the first song).
    await expect(bar.locator('.ad-label')).toHaveCount(0, { timeout: 15_000 });
    await expect(bar.locator('.pbar__title')).toHaveText(titles[0]);
    await expect(nextBtn).toBeEnabled();
  } finally {
    await admin.delete(`/api/admin/ads/${ad.id}`);
    await admin.dispose();
  }
});

test('premium listeners never get ads', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one project is enough');
  // Answer as a signed-in premium account (the paid tier itself comes later).
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: { ok: true, user: { id: 'p1', email: 'p@e2e.test', role: 'listener', displayName: 'Premium', createdAt: 1, artistName: null, bio: null, avatarUrl: null, verified: false, tier: 'premium' } },
    }),
  );
  let asked = 0;
  await page.route('**/api/ads/next', (route) => {
    asked++;
    return route.fulfill({ status: 204 });
  });
  await playArtist(page, ARTIST_A);
  const nextBtn = page.locator('.pbar').getByRole('button', { name: 'Next', exact: true });
  for (let i = 0; i < 8; i++) await nextBtn.click(); // past 4 songs and 6 skips
  await expect(page.locator('.pbar__title')).toBeVisible();
  expect(asked).toBe(0);
});

test('admins upload, deactivate and delete ads, and see plays per day', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one project is enough');
  expect((await page.request.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await open(page, '#/admin');
  const ads = page.locator('section', { has: page.getByRole('heading', { name: 'Ads', exact: true }) });
  const form = ads.locator('form', { has: page.getByRole('heading', { name: 'New ad' }) });
  await form.getByLabel('Title').fill('E2E Admin Ad');
  await form.getByLabel('Advertiser').fill('E2E Shop');
  await form.getByLabel(/Weight/).fill('3');
  await form.getByLabel(/^Audio/).setInputFiles({ name: 'ad.wav', mimeType: 'audio/wav', buffer: wav(4, 2).file });
  await form.getByRole('button', { name: 'Upload ad' }).click();
  await expect(page.getByText('“E2E Admin Ad” is uploaded.')).toBeVisible();

  const item = ads.locator('li', { hasText: 'E2E Admin Ad' });
  await expect(item.getByText('Active', { exact: true })).toBeVisible();
  await expect(item.getByText('Plays today: 0')).toBeVisible();
  await expect(item).toContainText('E2E Shop');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);

  await item.getByRole('button', { name: 'Deactivate' }).click();
  await expect(item.getByText('Inactive', { exact: true })).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await item.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('“E2E Admin Ad” is deleted.')).toBeVisible();
  await expect(item).toHaveCount(0);
});
