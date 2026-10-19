import { expect, test } from '@playwright/test';
import { ARTIST_A, ARTIST_B } from './data';
import { open, published } from './helpers';

const PASSWORD = 'e2e long enough password';

test('a verified artist has a checkmark next to their name everywhere', async ({ page, isMobile }) => {
  // Artist A was verified by the setup project; Artist B wasn't.
  const p = await published(page);
  await open(page, p.artist(ARTIST_A));
  await expect(page.getByRole('heading', { level: 1 }).getByRole('img', { name: 'Verified' })).toBeVisible();
  await open(page, p.artist(ARTIST_B));
  await expect(page.getByRole('heading', { level: 1 }).getByRole('img', { name: 'Verified' })).toHaveCount(0);

  await open(page, p.song('Third Song'));
  await expect(page.locator('.dhero .artist-links').getByRole('img', { name: 'Verified' })).toHaveCount(1);
  await page.locator('.dhero .play-btn--lg').click();
  await expect(page.locator('.pbar__sub').getByRole('img', { name: 'Verified' })).toHaveCount(1);
  await expect(page.locator('.trow').first().getByRole('img', { name: 'Verified' })).toHaveCount(1);

  if (!isMobile) {
    await page.getByRole('combobox').first().fill(ARTIST_A);
    await expect(page.locator('.gsearch__item', { hasText: ARTIST_A }).first().getByRole('img', { name: 'Verified' })).toBeVisible();
  }
});

test('artists request verification, and an admin approves it', async ({ page, playwright }, info) => {
  // A fresh artist each run, so there's never an earlier request in the way.
  const email = `verify-${info.project.name}-${Date.now()}@e2e.test`;
  expect((await page.request.post('/api/auth/signup', { data: { email, password: PASSWORD, displayName: 'E2E Hopeful', role: 'artist' } })).ok()).toBe(true);

  await open(page, '#/account');
  const profile = page.locator('section', { has: page.getByRole('heading', { name: 'Artist profile' }) });
  await profile.getByLabel('Proof (optional)').fill('instagram.com/e2e-hopeful');
  await profile.getByRole('button', { name: 'Request verification' }).click();
  await expect(page.getByText('Verification request sent')).toBeVisible();
  await expect(profile.getByText(/is under review/)).toBeVisible();
  await expect(profile.getByRole('button', { name: 'Request verification' })).toHaveCount(0);

  // The admin (made by the setup project) approves it.
  const admin = await playwright.request.newContext({ baseURL: info.project.use.baseURL });
  expect((await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  const { requests } = (await (await admin.get('/api/admin/verification')).json()) as { requests: { id: string; email: string; message: string }[] };
  const mine = requests.find((r) => r.email === email)!;
  expect(mine.message).toBe('instagram.com/e2e-hopeful');
  expect((await admin.post(`/api/admin/verification/${mine.id}/approve`)).ok()).toBe(true);
  await admin.dispose();

  await page.reload();
  await expect(profile.getByText('You’re a verified artist.')).toBeVisible();
  await expect(profile.getByRole('img', { name: 'Verified' })).toBeVisible();
});
