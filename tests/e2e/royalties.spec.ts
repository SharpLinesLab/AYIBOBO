import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open, published, trackErrors } from './helpers';

const PASSWORD = 'e2e long enough password';

async function noViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(1);
}

test('a signed-in listener’s play is logged once, by the server', async ({ page }, info) => {
  const errors = trackErrors(page);
  const email = `royalty-fan-${info.project.name}-${Date.now()}@e2e.test`;
  expect((await page.request.post('/api/auth/signup', { data: { email, password: PASSWORD, displayName: 'E2E Fan', role: 'listener' } })).ok()).toBe(true);
  await open(page, (await published(page)).song('Other Song'));
  const logged = page.waitForResponse((r) => r.url().endsWith('/api/plays') && r.request().method() === 'POST');
  await page.locator('.dhero .play-btn--lg').click();
  const res = await logged;
  expect(res.status()).toBe(204);
  const body = JSON.parse(res.request().postData() ?? '{}') as { playId: string; trackId: string; seconds: number };
  expect(body.playId).toMatch(/^[\w-]{8,64}$/);
  expect(body.seconds).toBe(0);
  errors.expectNone();
});

test('artists see their streams and the eligibility checklist, with no money', async ({ page }) => {
  expect((await page.request.post('/api/auth/login', { data: { email: 'artist-a@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await open(page, '#/account');
  const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Royalties (pre-launch)' }) });
  await expect(panel.getByText(/^Pre-launch:/)).toBeVisible();
  await expect(panel.getByText('Streams this month')).toBeVisible();
  await expect(panel.getByText('Streams in the last 90 days')).toBeVisible();
  const items = panel.getByRole('listitem');
  await expect(items).toHaveCount(4);
  // Artist A is verified (setup project) and has three published songs, but no premium streams yet.
  await expect(items.nth(0)).toContainText('Verified artist — done');
  await expect(items.nth(1)).toContainText(/500 streams from premium listeners in the last 90 days \(\d+ so far\) — not yet/);
  await expect(items.nth(2)).toContainText(/3 published songs \(\d+ so far\) — done/);
  await expect(items.nth(3)).toContainText('No active policy strikes — done');
  await expect(panel.getByText('Meet all four to qualify for royalties.')).toBeVisible();
  await expect(panel).not.toContainText('$');
  await noViolations(page);
});

test('admins see a read-only monthly summary, labelled as not real money', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one project is enough');
  expect((await page.request.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await open(page, '#/admin');
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Royalties (pre-launch)' }) });
  await expect(section.getByText(/^Pre-launch — not real money\./)).toBeVisible();
  await expect(section.getByText(/Hypothetical artist pool \(80% of revenue after fees\): \$7,744\.00 — not real money/)).toBeVisible();
  await section.getByLabel('Hypothetical Stripe fees (USD)').fill('0');
  await expect(section.getByText(/: \$8,000\.00 — not real money/)).toBeVisible();
  for (const label of ['Royalty streams', 'From premium listeners', 'Eligible artists', 'Streams of eligible artists']) await expect(section.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Monthly snapshots' })).toBeVisible();
  // Read-only: nothing here changes data.
  await expect(section.getByRole('button')).toHaveCount(0);
  await noViolations(page);
});
