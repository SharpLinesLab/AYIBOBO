import { expect, test } from '@playwright/test';
import { open, playAlbum, position, settle, trackErrors } from './helpers';

test('play an album, skip ahead and see synced lyrics', async ({ page, isMobile }) => {
  const errors = trackErrors(page);
  await playAlbum(page);
  await expect(page.locator('.pbar__title')).toHaveText('Lanmou Pa Fasil');
  if (isMobile) {
    // Phones skip from the full-screen player.
    await page.locator('.pbar__art').click();
    await page.locator('.np').getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Close now playing' }).click();
  } else await page.locator('.pbar').getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.pbar__title')).toHaveText('Soley Leve');
  await open(page, '#/song/tr-al-tiga-blaze-1-1');
  await page.locator('.lyr--page .lyr__line.is-clickable').nth(5).click();
  // Highlighting waits for audio to start, which can take a moment on a busy machine.
  await expect(page.locator('.lyr--page .lyr__line.is-active')).toBeVisible({ timeout: 15_000 });
  errors.expectNone();
});

test('queue can be reordered and Next follows the new order', async ({ page, isMobile }) => {
  test.skip(isMobile, 'queue popover is desktop-only');
  await playAlbum(page);
  await page.locator('.pbar').getByRole('button', { name: 'Queue' }).click();
  const rows = page.locator('.pbar__queue .qrow--drag b');
  await expect(rows.first()).toBeVisible(); // the queue loads on demand
  const [first, second] = await rows.allTextContents();
  await page.getByRole('button', { name: `Move ${first} down` }).click({ force: true });
  await expect(rows.first()).toHaveText(second);
  await page.locator('.pbar').getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.pbar__title')).toHaveText(second);
});

test('autoplay continues with similar songs when the queue ends', async ({ page, isMobile }) => {
  test.skip(isMobile, 'uses the desktop seek bar');
  await open(page, '#/album/al-lavi-soley-1');
  const rows = page.locator('.trow');
  await rows.last().locator('.trow__play').click({ force: true });
  const last = await page.locator('.pbar__title').textContent();
  await settle(page); // the player bar slides in
  const bar = await page.locator('.pbar .seek__track').boundingBox();
  await page.mouse.click(bar!.x + bar!.width * 0.995, bar!.y + bar!.height / 2);
  await expect(page.locator('.pbar__title')).not.toHaveText(last!, { timeout: 8000 });
  await page.locator('.pbar').getByRole('button', { name: 'Queue' }).click();
  await expect(page.locator('.pbar__queue h4', { hasText: 'Autoplay' })).toBeVisible();
});

test('"Sped up" plays faster than normal', async ({ page, isMobile }) => {
  test.skip(isMobile, 'uses the desktop seek bar');
  await playAlbum(page);
  await open(page, '#/settings');
  const measure = async () => {
    const a = await position(page);
    await page.waitForTimeout(5000);
    return (await position(page)) - a;
  };
  const normal = await measure();
  await page.getByRole('button', { name: 'Sped up' }).click();
  const fast = await measure();
  expect(fast).toBeGreaterThan(normal);
});

test('share sheet renders a story card and a link', async ({ page }) => {
  await open(page, '#/song/tr-al-tiga-blaze-1-1');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.locator('.share__preview img')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Link' })).toHaveValue(/#\/song\/tr-al-tiga-blaze-1-1$/);
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me/);
});

test('mobile: swipe down on the artwork closes Now Playing', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch gesture');
  await playAlbum(page);
  await page.locator('.pbar__art').click();
  const art = page.locator('.np__art');
  await expect(art).toBeVisible();
  const box = (await art.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 360, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.np')).toHaveCount(0);
});
