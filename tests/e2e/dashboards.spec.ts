import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open, openTab, trackErrors } from './helpers';

const PASSWORD = 'e2e long enough password';

async function noViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(1);
}

test('the artist area is a tabbed dashboard', async ({ page }) => {
  const errors = trackErrors(page);
  // Artist A (setup project): verified, three published songs.
  expect((await page.request.post('/api/auth/login', { data: { email: 'artist-a@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await open(page, '#/account');
  const tabs = page.getByRole('tablist', { name: 'Artist dashboard' }).getByRole('tab');
  await expect(tabs).toHaveText(['Overview', 'Upload', /^My Music/, 'Earnings', 'Profile']);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

  const overview = page.getByRole('tabpanel', { name: 'Overview' });
  for (const label of ['Streams this month', 'Streams in the last 90 days', 'Published songs', 'Uploads pending review']) await expect(overview.getByText(label, { exact: true })).toBeVisible();
  await expect(overview.locator('.kpi', { hasText: 'Published songs' }).locator('.kpi__value')).toHaveText(/^[3-9]|\d\d/);
  await expect(overview.getByText(/^\d of 4 royalty requirements met\.$/)).toBeVisible();
  await expect(overview.getByRole('listitem')).toHaveCount(4);
  await noViolations(page);

  // Quick actions open their tab.
  await overview.getByRole('button', { name: 'Upload a song' }).click();
  await expect(page.getByRole('tab', { name: 'Upload' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Send a song to ASF' })).toBeVisible();
  await expect(overview).toBeHidden();
  await openTab(page, 'Overview');
  await overview.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('heading', { name: 'Artist profile' })).toBeVisible();

  // Arrow keys move between tabs.
  await page.getByRole('tab', { name: 'Profile' }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Earnings' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Royalties (pre-launch)' })).toBeVisible();
  await page.getByRole('tab', { name: 'Earnings' }).press('Home');
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

  // My Music: the submissions list, apart from the upload form.
  await openTab(page, 'My Music');
  const music = page.getByRole('tabpanel', { name: /^My Music/ });
  await expect(music.getByRole('heading', { name: 'Your songs' })).toBeVisible();
  await expect(music.getByText('First Song')).toBeVisible();
  await expect(music.getByRole('button', { name: 'Send for review' })).toHaveCount(0);
  await noViolations(page);
  errors.expectNone();
});

test('the admin area is a tabbed dashboard, with a users tab', async ({ page, playwright }, info) => {
  const errors = trackErrors(page);
  // A fresh account to act on, so runs never collide.
  const email = `managed-${info.project.name}-${Date.now()}@e2e.test`;
  const other = await playwright.request.newContext({ baseURL: info.project.use.baseURL });
  expect((await other.post('/api/auth/signup', { data: { email, password: PASSWORD, displayName: 'E2E Managed', role: 'listener' } })).ok()).toBe(true);
  await other.dispose();

  expect((await page.request.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await open(page, '#/admin');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin dashboard');
  await expect(page.getByRole('tablist', { name: 'Admin sections' }).getByRole('tab')).toHaveText(['Overview', 'Uploads', 'Verification', 'Ads', 'Royalties', 'Users']);
  const overview = page.getByRole('tabpanel', { name: 'Overview' });
  for (const label of ['Uploads pending review', 'Verification requests pending', 'Total users', 'Total artists', 'Royalty streams today', 'Ad plays today']) await expect(overview.getByText(label, { exact: true })).toBeVisible();
  await noViolations(page);

  // Tiles and quick links lead into their tab.
  await overview.getByRole('button', { name: /^Verification requests pending/ }).click();
  await expect(page.getByRole('heading', { name: 'Verification requests' })).toBeVisible();
  await openTab(page, 'Overview');
  await overview.getByRole('button', { name: 'Review uploads' }).click();
  await expect(page.getByRole('tab', { name: 'Uploads' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Review uploads' })).toBeVisible();

  await openTab(page, 'Users');
  const item = page.getByRole('tabpanel', { name: 'Users' }).locator('li', { hasText: email });
  await expect(item).toContainText('Listener · Free · joined');
  await expect(item).toContainText('not verified');

  // The admin's own role can't be changed from here.
  await expect(page.locator('li', { hasText: 'admin@e2e.test' }).getByLabel('Role')).toBeDisabled();

  page.once('dialog', (d) => void d.accept());
  await item.getByLabel('Role').selectOption('artist');
  await expect(page.getByText('E2E Managed’s role was changed.')).toBeVisible();
  await expect(item).toContainText('Artist · Free');

  await item.getByLabel('Verified checkmark').check();
  await expect(page.getByText('E2E Managed is now verified.')).toBeVisible();
  await expect(item.getByRole('img', { name: 'Verified' })).toBeVisible();
  await item.getByLabel('Verified checkmark').uncheck();
  await expect(page.getByText('E2E Managed is no longer verified.')).toBeVisible();

  await expect(item.getByRole('button', { name: 'Lift strikes' })).toHaveCount(0);
  await item.getByLabel('Reason for a policy strike').fill('E2E test strike');
  await item.getByRole('button', { name: 'Issue strike' }).click();
  await expect(page.getByText('Strike recorded for E2E Managed.')).toBeVisible();
  await expect(item).toContainText('active strikes: 1');
  await expect(item.getByLabel('Reason for a policy strike')).toHaveValue('');
  await noViolations(page);
  await item.getByRole('button', { name: 'Lift strikes' }).click();
  await expect(page.getByText('Strikes lifted for E2E Managed.')).toBeVisible();
  await expect(item).not.toContainText('active strikes');
  errors.expectNone();
});
