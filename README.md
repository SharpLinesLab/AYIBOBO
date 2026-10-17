# ASF Charts — Ayiti Sakap Fet

The ASF (Ayiti Sakap Fet) public music leaderboard, styled after the ASF music-portal mockup: dark charcoal UI, electric-green accent, featured carousel, hover/quick-play cards and swipeable rows.

**No algorithms, no playlist gatekeepers, no ad networks. Claim a rank on the public music leaderboard — rank is strictly what you pay.**

A pay-to-rank leaderboard for music on the web: standalone artist sites, DAWs and plugins, sample packs, AI music tools, indie labels, beat stores, vinyl and merch, ticketing, communities, sync libraries and synth makers. Its UI, UX and bidding rules follow the outbid.lol pattern, adapted for music.

## Quick start

```bash
npm install
npm run dev          # self-contained demo at http://localhost:5173 (bids saved in localStorage)
npm test             # ranking, URL normalization and API tests
```

Full stack (API server, persistence, Stripe):

```bash
cp .env.example .env            # optional: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PUBLIC_URL
npm run build
npm start                       # serves the app and /api on http://localhost:8787
```

Develop against the API with hot reload: `npm run dev:server` in one terminal, then `API_PROXY=http://localhost:8787 npm run dev`.

Docker: `docker build -t asf-charts . && docker run -p 8787:8787 -v asf-data:/data --env-file .env asf-charts`

### Two runtime modes

On load, the frontend probes `/api/health`:

| Mode | When | Payments | Data |
|---|---|---|---|
| **Remote** | served by `server/` | Stripe Checkout, or simulated when `ALLOW_SIMULATED_PAYMENTS=true` | JSON datastore (`DATA_FILE`) |
| **Demo** | static hosting / `vite` | simulated in the browser | seed + your bids in `localStorage`, plus simulated live traffic |

## Features

- **Hero "Claim #1" widget.** The amount defaults to the current #1 plus $5. The − and + steppers support press-and-hold acceleration, the amount can be typed in directly, and arrow keys work too. The headline rank updates live as the amount changes (e.g. `$3,501` → `Claim #14`).
- **Board toggle.** All-time shows lifetime spend; Today shows spend since 00:00 UTC.
- **Ranked cards.** Each card has artwork, the rank, title and tagline, the total, a two-line description, a **▶ Preview** player, the category, a relative time, the domain, a click counter, a `see details` link and a quick-bid link (`claim this rank for $X`).
- **Audio previews.** The 20-second demos are synthesized live with the Web Audio API in six styles (arp, pad, beat, lofi, bass, pluck), seeded per listing, so no audio files are needed. If a site's `og:audio` tag is found, the real file plays instead.
- **Checkout modal.** It resolves and normalizes the link, then scrapes the title, description, artwork, category and audio (simulated in demo mode). Next it shows whether this is a **new listing** or a **top-up**, with the current spend, the new total, the projected rank on both boards, and the amount charged. After payment, the listing animates into its new rank and appears in Latest activity.
- **Sidebars and footer.** Today's ranking (with a countdown to the reset), a live Latest activity feed with rank jumps, and footer milestones.
- **Other views.** Category filter pills, per-category Leaderboards, Explore (rising and newest), a Daily archive with day navigation, Categories, About, Rules and FAQ.
- **Panels.** A search modal (`/` or ⌘K), a live stats modal with 14-day visitor and click charts, and a detail drawer with the bid history and a daily clicks chart.
- **Theming and accessibility.** Light by default with a dark toggle (saved), mobile-first layout, reduced-motion support, keyboard-accessible dialogs.

## Business rules (enforced by the server, not only the UI)

Implemented in `src/lib/ranking.ts`, `src/lib/claim.ts` and `src/lib/normalize.ts`, and shared by the client and the server.

1. **One payment counts on three boards.** It goes to All-time (lifetime), Today (since 00:00 UTC) and the Daily archive (a frozen snapshot of each UTC day).
2. **Amounts.** Bids are whole dollars from **$10** to **$999,999**, in $1 steps.
3. **Taking #1** costs at least the current #1 plus **$5**. The "dead band" between #1 and #1 + $5 is rejected, and the stepper skips over it.
4. **Taking any other rank** costs at least the current holder plus **$1**.
5. **Ties** stay in chronological order: whoever reached the board first keeps the higher rank.
6. **Top-ups.** A link that is already listed is recognized automatically. The new total must be at least $1 above the current one, and only the **difference** is charged. A different link always pays its full amount, so nobody can hijack another listing's rank by paying the difference.
7. **URL normalization:**
   - Tracking, referral and affiliate parameters are stripped (`utm_*`, `ref`, `si`, `fbclid`, …).
   - Shorteners (`bit.ly`, `linktr.ee`, `ffm.to`, `lnk.to`, `spoti.fi`, …) are resolved by the server, one hop at a time.
   - Ordinary sites are keyed by domain. Shared platforms are keyed by tenant path: `artist.bandcamp.com[/album/x]`, `open.spotify.com/artist/<id>`, `soundcloud.com/<artist>[/<track>|/sets/<set>]`, `splice.com/sounds/packs/<vendor>/<pack>`, `gumroad.com/l/<id>`, `music.apple.com/<type>/<id>`, YouTube, Beatstars, and others.
   - Discord, Telegram, WhatsApp and Signal invites, and NSFW domains, are refused.

## Branding

Brand name, tagline, contact email and social profile URLs live in `src/brand.ts`. Social icons link to each platform's home page until you fill in your profile URLs. Colors are CSS tokens at the top of `src/styles/app.css` (dark by default, with a light theme toggle).

## Payments (Stripe)

With `STRIPE_SECRET_KEY` set, `POST /api/checkout` re-quotes on the server, stores a pending claim and redirects to Stripe Checkout. The `checkout.session.completed` webhook (`POST /api/stripe/webhook`, verified with `STRIPE_WEBHOOK_SECRET`) credits the amount actually paid. It does so idempotently, keyed per session. The money is final, so if someone outbids you between the quote and the payment, your spend still counts.

Local webhook testing: `stripe listen --forward-to localhost:8787/api/stripe/webhook`.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | mode and Stripe availability |
| GET | `/api/state` | listings, payments and live stats |
| POST | `/api/resolve` | `{input}` → normalized target |
| POST | `/api/metadata` | `{input}` → scraped metadata (OpenGraph / title / icon / `og:audio`) |
| POST | `/api/checkout` | `{input, board, amount, draft}` → `applied` / `redirect` / `error` |
| POST | `/api/click` | `{listingId}` (outbound click counter) |
| POST | `/api/newsletter` | `{email}` (Subscribe button) |
| POST | `/api/ping` | `{visitorId}` (presence and visitor counts) |
| POST | `/api/stripe/webhook` | Stripe events |

Server hardening:

- Per-IP rate limits on every POST.
- 32 KB JSON body cap.
- Strict validation of listing drafts (category whitelist, hex colours, https-only image and audio URLs, length limits).
- An SSRF guard on server-side fetches: only public IPs, ports 80 and 443, manual redirects re-checked each hop, and responses capped at 512 KB.

## Project layout

```
src/lib/        shared domain logic (ranking, claims, normalization, seed, stats, audio synth)
src/components/ UI components
src/backend.ts  remote/demo data backends
server/         Express API, JSON datastore, scraping & link resolution
tests/          vitest suites
```

## Production notes

- The JSON datastore is meant for a single instance. For horizontal scaling, move `server/db.ts` to Postgres or SQLite behind the same interface.
- Set `SEED_DEMO=false` for a real launch. The 20 seeded listings are **fictional demo data**, and no real company has paid for them.
- Run behind TLS. `trust proxy` is enabled for correct client IPs.
