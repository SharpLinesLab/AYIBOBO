import { expect, test } from '@playwright/test';
import { ARTIST_A } from './data';
import { open, playArtist, position, published, settle, trackErrors } from './helpers';

test('play an artist\'s songs and skip ahead', async ({ page, isMobile }) => {
  const errors = trackErrors(page);
  const titles = await playArtist(page);
  await expect(page.locator('.pbar__title')).toHaveText(titles[0]);
  if (isMobile) {
    // Phones skip from the full-screen player.
    await page.locator('.pbar__art').click();
    await page.locator('.np').getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Close now playing' }).click();
  } else await page.locator('.pbar').getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.pbar__title')).toHaveText(titles[1]);
  await expect(page.locator('.pbar').getByRole('button', { name: 'Pause' }).first()).toBeVisible();
  errors.expectNone();
});

test('queue can be reordered and Next follows the new order', async ({ page, isMobile }) => {
  test.skip(isMobile, 'queue popover is desktop-only');
  await playArtist(page);
  await page.locator('.pbar').getByRole('button', { name: 'Queue' }).click();
  const rows = page.locator('.pbar__queue .qrow--drag b');
  await expect(rows.first()).toBeVisible(); // the queue loads on demand
  const [first, second] = await rows.allTextContents();
  await page.locator('.pbar__queue').getByRole('button', { name: `Move ${first} down` }).click({ force: true });
  await expect(rows.first()).toHaveText(second);
  await page.locator('.pbar').getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.pbar__title')).toHaveText(second);
});

test('the Up next panel lists the queue and jumps to a song', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the side panel is for wide screens');
  const titles = await playArtist(page);
  const panel = page.locator('.npp');
  if (!(await panel.isVisible())) await page.getByRole('button', { name: 'Up next panel' }).click();
  await expect(panel.getByRole('heading', { name: 'Up next' })).toBeVisible();
  // The current song is in the player bar, not repeated in the panel; neither are lyrics.
  await expect(panel.locator('.qrow b').first()).toHaveText(titles[1]);
  await expect(panel.locator('.lyr')).toHaveCount(0);
  await panel.locator('.qrow__main').nth(1).click();
  await expect(page.locator('.pbar__title')).toHaveText(titles[2]);
});

test('autoplay continues with similar songs when the queue ends', async ({ page, isMobile }) => {
  test.skip(isMobile, 'uses the desktop seek bar');
  await open(page, (await published(page)).artist(ARTIST_A));
  const rows = page.locator('.trow');
  await rows.last().locator('.trow__play').click({ force: true });
  const last = await page.locator('.pbar__title').textContent();
  await settle(page); // the player bar slides in
  const bar = await page.locator('.pbar .seek__track').boundingBox();
  await page.mouse.click(bar!.x + bar!.width * 0.995, bar!.y + bar!.height / 2);
  await expect(page.locator('.pbar__title')).not.toHaveText(last!, { timeout: 8000 });
  // The artist's other songs were just queued, so autoplay picks the other kompa song.
  await expect(page.locator('.pbar__title')).toHaveText('Other Song');
});

test('"Sped up" plays faster than normal', async ({ page, isMobile }) => {
  test.skip(isMobile, 'uses the desktop seek bar');
  test.slow();
  await playArtist(page);
  await open(page, '#/settings');
  // Positions are whole seconds, so measure long enough that 1.2× speed clearly shows.
  const measure = async () => {
    const a = await position(page);
    await page.waitForTimeout(10_000);
    return (await position(page)) - a;
  };
  const normal = await measure();
  await page.getByRole('button', { name: 'Sped up' }).click();
  const fast = await measure();
  expect(fast).toBeGreaterThan(normal);
});

test('share sheet renders a story card and a link', async ({ page }) => {
  const song = (await published(page)).song();
  await open(page, song);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.locator('.share__preview img')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Link' })).toHaveValue(new RegExp(`${song}$`)); // #/song/srv-<uuid>: no regex specials
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me/);
});

test('mobile: swipe down on the artwork closes Now Playing', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch gesture');
  await playArtist(page);
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
