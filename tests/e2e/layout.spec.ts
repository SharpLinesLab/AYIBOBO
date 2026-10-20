import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, openTab, playArtist } from './helpers';

const PASSWORD = 'e2e long enough password';

const box = async (l: Locator) => (await l.boundingBox())!;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Scroll to the very bottom, without smooth scrolling. */
const toBottom = (page: Page) => page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));

test('on mobile, nothing hides behind the tab bar or the player', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the bottom tab bar is mobile only');
  for (const playing of [false, true]) {
    if (playing) await playArtist(page);
    else await open(page, '#/privacy');
    await toBottom(page);
    const covered = await box(page.locator('.mtabs'));
    const top = playing ? (await box(page.locator('.pbar'))).y : covered.y;
    const links = page.locator('.footer a, .footer button');
    for (let i = 0; i < (await links.count()); i++) {
      const b = await box(links.nth(i));
      expect(b.y + b.height, `${playing ? 'playing' : 'idle'}: footer link ${i}`).toBeLessThanOrEqual(top);
    }
  }
});

test('toasts sit in the bottom-right corner, clear of the bars, and go away by themselves', async ({ page, isMobile }) => {
  expect((await page.request.post('/api/auth/login', { data: { email: 'artist-a@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await playArtist(page);
  await open(page, '#/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  const toast = page.locator('.toast');
  await expect(toast).toHaveText('You’re signed out.');
  const t = await box(toast);
  const vw = page.viewportSize()!.width;
  // Right-aligned: against the window's edge, or the pinned queue panel's when it's open (wide screens).
  const panel = page.locator('.npp');
  const edge = (await panel.isVisible()) ? (await box(panel)).x : vw;
  expect(edge - (t.x + t.width)).toBeGreaterThanOrEqual(0);
  expect(edge - (t.x + t.width)).toBeLessThanOrEqual(32);
  expect(t.x + t.width / 2).toBeGreaterThan(vw / 2);
  expect(overlaps(t, await box(page.locator('.pbar')))).toBe(false);
  if (isMobile) expect(overlaps(t, await box(page.locator('.mtabs')))).toBe(false);
  expect(Number(await toast.evaluate((el) => getComputedStyle(el).zIndex))).toBeGreaterThan(Number(await page.locator('.pbar').evaluate((el) => getComputedStyle(el).zIndex)));
  await expect(toast).toHaveCount(0, { timeout: 6000 });
});

test('the profile picture controls stack beside the avatar (and under it on phones)', async ({ page, isMobile }, info) => {
  const email = `picture-${info.project.name}-${Date.now()}@e2e.test`;
  expect((await page.request.post('/api/auth/signup', { data: { email, password: PASSWORD, displayName: 'E2E Picture', role: 'artist' } })).ok()).toBe(true);
  await open(page, '#/account');
  // One heading for the page: the artist's name, over the dashboard tabs.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Picture');
  await expect(page.getByRole('heading', { name: 'Your account' })).toHaveCount(0);
  await openTab(page, 'Profile');
  const avatar = await box(page.locator('.account__picture > :first-child'));
  const label = await box(page.locator('.account__picture-controls .field'));
  const input = await box(page.getByLabel(/^Profile picture/));
  // The file input spans the label's full width, under the label text.
  expect(Math.abs(input.x - label.x)).toBeLessThanOrEqual(1);
  expect(input.width).toBeGreaterThan(label.width - 2);
  if (isMobile) expect(label.y).toBeGreaterThanOrEqual(avatar.y + avatar.height);
  else {
    expect(label.x).toBeGreaterThanOrEqual(avatar.x + avatar.width);
    expect(input.width).toBeGreaterThan(300);
  }
});
