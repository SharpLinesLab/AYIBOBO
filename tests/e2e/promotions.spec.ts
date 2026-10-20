import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { open, openTab, published, trackErrors } from './helpers';

const PASSWORD = 'e2e long enough password';
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** How the page writes a UTC day in English, e.g. "Oct 20, 2026". */
const shown = (t: number) => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

async function noViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}

type Promo = { id: string; title: string; status: string };
const promotionsOf = async (admin: APIRequestContext, title: string) => ((await (await admin.get('/api/admin/promotions')).json()).promotions as Promo[]).filter((p) => p.title === title);
/** Cancel whatever an earlier run left for this song, so its dates are free. */
async function clear(admin: APIRequestContext, title: string) {
  for (const p of await promotionsOf(admin, title)) if (['pending_payment', 'scheduled', 'active'].includes(p.status)) expect((await admin.post(`/api/admin/promotions/${p.id}/cancel`)).ok()).toBe(true);
}

// No console-error check here: the overlap check below answers 409 on purpose, which the browser logs.
test('an artist promotes a song, and an admin activates it through the test path', async ({ page, playwright }, info) => {
  // One song per project, so the desktop and mobile runs never compete for the same dates.
  const title = info.project.name === 'mobile' ? 'Second Song' : 'First Song';
  const admin = await playwright.request.newContext({ baseURL: info.project.use.baseURL });
  expect((await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await clear(admin, title);

  expect((await page.request.post('/api/auth/login', { data: { email: 'artist-a@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  await open(page, '#/account');
  await openTab(page, 'Promote');
  const panel = page.getByRole('tabpanel', { name: 'Promote' });
  await expect(panel.getByText(/separate from royalties/)).toBeVisible();
  await panel.getByRole('combobox').selectOption({ label: title });

  // Three packages, each with its price per day; the 7-day one is the best value.
  const packages = panel.getByRole('radio');
  await expect(packages).toHaveCount(3);
  for (const [days, per] of [['1 day', /^\$[\d.]+ a day$/], ['3 days', /a day$/], ['7 days', /a day$/]] as const) {
    const card = panel.locator('.promo__pkg', { hasText: days });
    await expect(card.locator('.promo__pkg-per')).toHaveText(per);
  }
  await expect(panel.locator('.promo__pkg', { hasText: 'Best value' })).toHaveCount(1);
  await expect(panel.locator('.promo__pkg', { hasText: 'Best value' })).toContainText('7 days');

  // The end date follows the package (both days included, UTC days); the total is its price.
  const start = Math.floor(Date.now() / DAY) * DAY;
  await panel.getByLabel('First day').fill(iso(start));
  for (const [name, days] of [['1 day', 1], ['7 days', 7], ['3 days', 3]] as const) {
    // The card is the label: clicking it picks the package.
    await panel.locator('.promo__pkg', { hasText: name }).click();
    await expect(panel.getByRole('radio', { name: new RegExp(`^${name}`) })).toBeChecked();
    await expect(panel.getByText(/^Runs from /)).toHaveText(`Runs from ${shown(start)} to ${shown(start + (days - 1) * DAY)}, both days included.`);
    const price = await panel.locator('.promo__pkg', { hasText: name }).locator('.promo__pkg-price').textContent();
    await expect(panel.locator('.promo__sum')).toHaveText(`Total: ${price}`);
  }
  const price = (await panel.locator('.promo__pkg', { hasText: '3 days' }).locator('.promo__pkg-price').textContent())!;
  await noViolations(page);
  await panel.getByRole('button', { name: 'Confirm promotion' }).click();
  await expect(page.getByText(`Promotion of “${title}” requested.`, { exact: false })).toBeVisible();
  const pending = panel.locator('.promo__mine > div', { has: page.getByRole('heading', { name: 'Waiting for payment' }) }).locator('li', { hasText: title });
  await expect(pending.locator('.status-pill')).toHaveText('Waiting for payment');
  await expect(pending).toContainText(`${shown(start)} to ${shown(start + 2 * DAY)} · ${price}`);

  // The same days again are refused.
  await panel.getByRole('button', { name: 'Confirm promotion' }).click();
  await expect(panel.getByRole('alert')).toHaveText('This song is already promoted on some of these days. Pick other dates.');

  // An admin marks it as paid (the test path until payments are connected).
  expect((await page.request.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: PASSWORD } })).ok()).toBe(true);
  // A fresh load, so the app picks up the admin session (only the hash would change otherwise).
  await page.goto('about:blank');
  await open(page, '#/admin');
  await openTab(page, 'Promotions');
  const section = page.getByRole('tabpanel', { name: 'Promotions' });
  await expect(section.getByText(/^Test path — payments aren’t connected yet\./)).toBeVisible();
  await expect(section.getByText('Promotion revenue collected')).toBeVisible();
  await expect(section.getByText(/never goes into the royalty pool or artist payouts/)).toBeVisible();
  const item = section.locator('li', { hasText: title }).filter({ has: page.getByRole('button', { name: 'Mark as paid (test)' }) });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('E2E Artist A');
  await expect(item).toContainText(price);
  await item.getByRole('button', { name: 'Mark as paid (test)' }).click();
  await expect(page.getByText(`The promotion of “${title}” is marked as paid (test).`)).toBeVisible();
  await expect(section.locator('li', { hasText: title }).locator('.status-pill', { hasText: 'Active' }).first()).toBeVisible();
  // The package prices replace the old per-day rate; saving them as they are changes nothing.
  const prices = section.locator('form', { has: page.getByRole('heading', { name: 'Packages' }) });
  for (const label of ['1-day package (USD)', '3-day package (USD)', '7-day package (USD)']) await expect(prices.getByLabel(label)).toHaveValue(/^\d+\.\d\d$/);
  await expect(section.getByText(/Price per day/)).toHaveCount(0);
  await prices.getByRole('button', { name: 'Save prices' }).click();
  await expect(page.getByText('Package prices saved.')).toBeVisible();
  await noViolations(page);

  // It's in the feed now. The song is already there organically, so it isn't shown twice, but it
  // carries the badge where it is.
  expect((await (await page.request.get('/api/promoted')).json()).trackIds.length).toBeGreaterThan(0);
  await open(page, '#/');
  const trending = page.locator('section', { has: page.getByRole('heading', { name: 'Trending now' }) });
  const card = trending.locator('.mcard', { has: page.locator('.mcard__title', { hasText: new RegExp(`^${title}`) }) });
  await expect(card).toHaveCount(1);
  await expect(card.locator('.promo-badge')).toHaveText('Promoted');

  await clear(admin, title);
  await admin.dispose();
});

test('feeds show up to 2 promoted songs with a "Promoted" badge, never duplicated', async ({ page }) => {
  const errors = trackErrors(page);
  // A bigger catalog than the test server has, so some songs fall outside the genre's top 10.
  await page.route('**/api/catalog/uploads', async (route) => {
    const body = (await (await route.fetch()).json()) as { tracks: { id: string; title: string }[] };
    const base = body.tracks[0];
    const clones = Array.from({ length: 10 }, (_, i) => ({ ...base, id: `clone-${i}`, title: `Clone ${i}`, featuredArtists: null, explicit: false }));
    await route.fulfill({ json: { ok: true, tracks: [...body.tracks, ...clones] } });
  });
  // Three promoted: one already in the feed, so only the other two are added (all three say so).
  await page.route('**/api/promoted', (route) => route.fulfill({ json: { ok: true, trackIds: ['clone-0', 'clone-8', 'clone-9'] } }));

  await open(page, '#/genres/kompa');
  const rows = page.locator('.tlist').first().locator('.trow');
  await expect(rows).toHaveCount(12);
  const promoted = rows.filter({ has: page.locator('.promo-badge') });
  await expect(promoted).toHaveCount(3);
  expect((await promoted.locator('.trow__title').allTextContents()).sort()).toEqual(['Clone 0', 'Clone 8', 'Clone 9']);
  await expect(promoted.first().locator('.promo-badge')).toHaveText('Promoted');
  // The added two sit after the 1st and 4th songs, without a chart number (in a random order each
  // visit, so every promotion gets its turn); Clone 0 keeps its place and number.
  for (const i of [1, 5]) {
    await expect(rows.nth(i).locator('.promo-badge')).toHaveCount(1);
    await expect(rows.nth(i).locator('.trow__num')).toHaveText('');
    expect(['Clone 8', 'Clone 9']).toContain(await rows.nth(i).locator('.trow__title').textContent());
  }
  await expect(rows.nth(2).locator('.trow__num')).toHaveText('2');
  await expect(page.locator('.trow__title', { hasText: /^Clone 0$/ })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'Clone 0' }).locator('.trow__num')).not.toHaveText('');
  await noViolations(page);

  // Discover's trending feed already has every one of these songs: nothing is added, and the
  // three promoted ones carry the badge in place.
  await open(page, '#/');
  const trending = page.locator('section', { has: page.getByRole('heading', { name: 'Trending now' }) });
  await expect(trending.locator('.mcard__title', { hasText: /^Clone 9$/ })).toHaveCount(1);
  const badged = trending.locator('.mcard', { has: page.locator('.promo-badge') });
  expect((await badged.locator('.mcard__title').allTextContents()).sort()).toEqual(['Clone 0', 'Clone 8', 'Clone 9']);
  errors.expectNone();
});

test('a song promoted right now carries the badge on every card and row; others don’t', async ({ page }) => {
  const errors = trackErrors(page);
  // "Second Song" is the one promoted (as GET /api/promoted would say for an active, paid promotion).
  const res = await page.request.get('/api/catalog/uploads');
  const { tracks } = (await res.json()) as { tracks: { id: string; title: string }[] };
  const promotedId = tracks.find((t) => t.title === 'Second Song')!.id;
  await page.route('**/api/promoted', (route) => route.fulfill({ json: { ok: true, trackIds: [promotedId] } }));
  const p = await published(page);

  const check = async (where: string, items: ReturnType<Page['locator']>, title: string) => {
    const promoted = items.filter({ has: page.locator('.promo-badge') });
    await expect(promoted.first(), where).toBeVisible();
    for (const text of await promoted.allTextContents()) expect(text, where).toContain(title);
    await expect(items.filter({ hasNotText: title }).locator('.promo-badge'), where).toHaveCount(0);
    await expect(promoted.first().locator('.promo-badge'), where).toHaveText('Promoted');
  };

  // Discover (cards; the hero isn't a card), the Trending page, a genre page, search and the artist page (rows).
  await open(page, '#/');
  await check('Discover', page.locator('section', { has: page.getByRole('heading', { name: 'Trending now' }) }).locator('.mcard'), 'Second Song');
  await noViolations(page);
  await open(page, '#/trending');
  await check('Trending', page.locator('.trow'), 'Second Song');
  await open(page, '#/genres/kompa');
  await check('genre', page.locator('.trow'), 'Second Song');
  await open(page, '#/search/song');
  await check('search', page.locator('.trow, .mcard'), 'Second Song');
  await open(page, p.artist());
  await check('artist', page.locator('.trow'), 'Second Song');
  await noViolations(page);

  // Nothing promoted (unpaid, expired or cancelled promotions never make the list): no badges.
  await page.unroute('**/api/promoted');
  await page.route('**/api/promoted', (route) => route.fulfill({ json: { ok: true, trackIds: [] } }));
  await page.goto('about:blank');
  for (const route of ['#/', '#/trending', '#/genres/kompa', '#/search/song', p.artist()]) {
    await open(page, route);
    await expect(page.locator('.promo-badge'), route).toHaveCount(0);
  }
  errors.expectNone();
});
