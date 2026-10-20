# ASF — Ayiti Sakap Fet Music

A premium music streaming and discovery platform for Haiti and the diaspora. Artists publish full-length songs, and listeners stream them, follow artists, build playlists and download music for offline listening. The app is available in English, French and Kreyòl.

## Streaming app

- **Discover:**
  - A cinematic featured-release carousel with blurred-artwork backdrops.
  - Genre tiles.
  - Shelves for Jump back in, Trending now, Top songs this week, New releases, Made for you and Artists to watch.
- **Browse pages:**
  - **Trending:** songs ranked by week-over-week growth, with genre filters.
  - **Top Charts:** songs or albums for today, this week, this month or this year, with ▲▼/NEW movement.
  - **Genres:** 13 genres, from kompa, rap kreyòl, afrobeats and amapiano to drill, zouk, rara and gospel.
- **Detail pages:**
  - **Song:** a scrubbable waveform; play, like and repost buttons; timestamped comments (pinned on the waveform); more from the artist; and similar songs. Each song shows its artist credit, featured artists ("ft. …") and an explicit badge when it has one.
  - **Album and playlist:** play, shuffle play, and save or follow.
  - **Artist:** a banner, the artist's picture and bio, follow, popular songs, releases, appears-on and fans-also-like.
- **Player:**
  - A persistent glass player bar with queue, shuffle, repeat (off / all / one), volume and a sleep timer.
  - A full-screen **Now Playing** view with a live frequency visualizer, the waveform and the queue.
  - Media Session support for lock-screen and hardware keys.
  - Keyboard shortcuts: Space play/pause, ←/→ seek, Shift+←/→ previous/next, M mute, `/` search.
- **Library:** liked songs, your playlists ("⋯ → Add to playlist" on any song), followed artists and recently played. Signed in, your library syncs to your account across devices.
- **Offline:** download songs to play them with no connection.
- **Search:** grouped, accent-insensitive results as you type, across songs, artists, albums and playlists.
- **Accounts (`#/account`):** sign up as a listener or an artist, sign in, and reset a forgotten password with a one-time link. There's no email service yet: the server logs each link, and `manage reset-link <email>` prints a fresh one to hand over.
- **For artists (`#/account`):**
  - **Artist profile:** the name your songs are credited to (your display name until you set one), a profile picture and a bio.
  - **Send a song:** title, artist name, featured artists, genre, an explicit flag, the audio (MP3, WAV, M4A or OGG, up to 50 MB) and a cover image (JPG, PNG, WebP or AVIF, up to 8 MB). The waveform is computed in the browser.
  - Every song is reviewed before it's published, and you can follow each one's status.
- **Moderation (`#/admin`):** admins preview pending songs and approve or reject them. Rejected files are deleted.
- **Look and feel:** a dark premium theme by default with the ASF green accent, plus a light theme, responsive layouts, and a sidebar on desktop or bottom tabs with a mini-player on mobile.

There is no built-in catalog: the music is the songs artists publish on ASF. Until something is published, Discover, Trending, Charts and Genres show an empty state.

## Artwork

- **Uploads carry real covers.** Artists attach their own cover image to every song.
- **Artist pictures.** Artists can upload a profile picture. Until they do, their page uses generated editorial imagery: stage-lit, rim-lit silhouettes with haze, bokeh and film grain, as a poster (3:4), a portrait and a wide stage banner.

Only publish images you own or have a licence for.

## Quick start

```bash
npm install
npm run dev:server                              # the API at http://localhost:8787 (SQLite in ./data)
API_PROXY=http://localhost:8787 npm run dev     # the app with hot reload at http://localhost:5173
npm test                                        # unit and API tests
npm run test:e2e                                # build, then Playwright + axe in English, French and Kreyòl
```

Without the API server the app still opens, but it has no songs and no accounts.

Make yourself an admin (accounts can't do this themselves): `npx tsx server/manage.ts set-role you@example.com admin`. In production, use `node dist-server/manage.js` instead.

Production server (serves the built app, the API and the security headers):

```bash
cp .env.example .env            # see the file for every setting
npm run build
npm start                       # http://localhost:8787
```

Docker: `docker build -t asf . && docker run -p 8787:8787 -v asf-data:/data asf`. The `/data` volume holds the database and the uploaded files.

## Branding

Brand name, contact email and social profile URLs live in `src/brand.ts`. Colors are CSS tokens at the top of `src/styles/app.css` (dark by default, with a light theme toggle).

## Payments

There are no payments in the app yet. Launch will use Stripe, starting with card payments.

## API

All responses are JSON with an `ok` field. Every POST, PUT, PATCH and DELETE is rate-limited per IP.

**Accounts**

| Method | Path | |
|---|---|---|
| POST | `/api/auth/signup` | `{email, password, displayName, role}` (`listener` or `artist`). Signs you in. |
| POST | `/api/auth/login` | `{email, password}` |
| POST | `/api/auth/logout` | Ends this session. |
| GET | `/api/auth/me` | The signed-in account (including the artist profile, `verified` and the listening `tier`: `free` or `premium`), or `user: null`. |
| POST | `/api/auth/reset-request` | `{email}`. Creates a reset link (logged by the server until an email service is added); the answer is the same whether or not the account exists. |
| POST | `/api/auth/reset` | `{token, password}`. Signs out every session of the account. |

**Artist profile** (artists and admins)

| Method | Path | |
|---|---|---|
| PUT | `/api/account/profile` | `{artistName, bio}` (up to 100 and 500 characters; empty clears). |
| POST | `/api/account/avatar` | Multipart `picture` (JPG, PNG, WebP or AVIF, up to 8 MB). |
| DELETE | `/api/account/avatar` | Removes the picture. |
| GET | `/api/artists/:id/avatar` | Public: the artist's picture. |

**Verification** (artists and admins)

| Method | Path | |
|---|---|---|
| GET | `/api/account/verification` | Your latest verification request (`pending`, `approved` or `rejected`), or `request: null`. |
| POST | `/api/account/verification` | `{message}`: optional proof, up to 1000 characters. One pending request at a time (409 if one is pending or you're already verified). |

**Uploads** (artists and admins)

| Method | Path | |
|---|---|---|
| POST | `/api/uploads` | Multipart: `audio`, `cover`, `title`, `artistName`, `genre`, `duration`, and optional `featuredArtists`, `explicit`, `peaks`. Starts as pending. |
| GET | `/api/uploads/mine` | Your uploads and their review status. |

**Catalog** (public; approved songs only)

| Method | Path | |
|---|---|---|
| GET | `/api/catalog/uploads` | Every published song, with its credits and its artist's profile. |
| GET | `/api/audio/:id` | The audio, with byte ranges for seeking. |
| GET | `/api/covers/:id` | The cover image. |

**Library** (signed in)

| Method | Path | |
|---|---|---|
| GET | `/api/library` | Your likes (songs, albums, playlists), follows, playlists and play counts. |
| POST | `/api/library/ops` | `{ops}`: like/unlike, follow/unfollow, putPlaylist/deletePlaylist, play. |
| POST | `/api/library/merge` | `{mergeId, library}`: a device's library on its first sign-in, merged once. |

**Moderation** (admins; everyone else gets 404)

| Method | Path | |
|---|---|---|
| GET | `/api/admin/uploads?status=pending` | Uploads by status (`pending`, `approved` or `rejected`). |
| GET | `/api/admin/uploads/:id/audio` | Preview the audio. |
| GET | `/api/admin/uploads/:id/cover` | Preview the cover. |
| POST | `/api/admin/uploads/:id/approve` | Publishes the song. |
| POST | `/api/admin/uploads/:id/reject` | Deletes the files and keeps the decision on record. |
| GET | `/api/admin/verification` | Pending verification requests, oldest first, with each artist's profile, email and proof. |
| POST | `/api/admin/verification/:id/approve` | Marks the artist as verified. |
| POST | `/api/admin/verification/:id/reject` | Rejects the request; the artist can ask again. |

**Ads** (free tier)

| Method | Path | |
|---|---|---|
| GET | `/api/ads/next` | The ad to play now (the play is logged), or 204 when none should: always for premium, and at most 3 plays per ad per listener per UTC day. Signed out, the `x-asf-listener` header identifies the browser. |
| GET | `/api/ads/:id/audio` | An active ad's audio. |

**Ad administration** (admins; everyone else gets 404)

| Method | Path | |
|---|---|---|
| GET | `/api/admin/ads` | Every ad, with its plays per day for the last 7 days. |
| POST | `/api/admin/ads` | Multipart: `audio` (up to 30 seconds), `title`, `advertiserName`, `duration`, and optional `weight` (1–100), `active`, `startsAt`, `endsAt` (ms). |
| PATCH | `/api/admin/ads/:id` | Any of `title`, `advertiserName`, `weight`, `active`, `startsAt`, `endsAt` (`null` clears a date). |
| DELETE | `/api/admin/ads/:id` | Deletes the ad, its audio and its play history. |
| GET | `/api/admin/ads/:id/audio` | Preview the audio, active or not. |

**Royalties** (pre-launch shadow mode: streams are counted, no money moves)

| Method | Path | |
|---|---|---|
| POST | `/api/plays` | Signed in. `{playId, trackId, seconds}` for a published song: sent when it starts, at 30 seconds and when it stops; every report updates the same `royalty_plays` row. A play is a royalty stream at 30+ seconds. |
| GET | `/api/account/royalties` | Artists: streams this month and in the last 90 days, plus the four eligibility criteria (verified, 500+ premium streams in 90 days, 3+ published songs, no active policy strikes). |
| GET | `/api/admin/royalties?period=YYYY-MM` | Admins (everyone else gets 404), read-only: the month's streams, eligible artists, each artist's streams, and the monthly snapshots. |

The server writes each closed month to `royalty_periods` once (at start-up and hourly; re-running changes nothing). `manage snapshot-royalties [YYYY-MM]` does the same by hand; `manage strike <email> <reason>` and `manage lift-strikes <email>` record and lift policy strikes.

**Promoted tracks** (artists pay a flat per-day rate to boost a published song; this money is kept apart from royalties and never reaches the royalty pool or payouts)

| Method | Path | |
|---|---|---|
| GET | `/api/promoted` | Songs promoted right now (active, inside their dates, still published). Discover's trending feed and the genre pages mix in up to 2 that aren't already there, marked "Promoted". |
| GET | `/api/promotions/mine` | Artists: the current per-day rate and their promotions. |
| POST | `/api/promotions` | Artists: `{trackId, startDate, endDate}` (`YYYY-MM-DD`, both included, up to 90 days) for one of their published songs. Priced at today's rate; starts as `pending_payment`. No overlapping dates for the same song (cancelled promotions free them). |
| GET | `/api/admin/promotions` | Admins: every promotion, the rate and the revenue collected. |
| POST | `/api/admin/promotions/:id/activate` | Admins, test path until Stripe is connected: marks a pending promotion as paid (`active`, or `scheduled` if it starts later). |
| POST | `/api/admin/promotions/:id/cancel` | Admins: cancels a promotion that hasn't ended. |
| PUT | `/api/admin/promotions/rate` | Admins: `{rateCents}`, the per-day price of new promotions (default 500 = $5). |

**Account administration** (admins; everyone else gets 404)

| Method | Path | |
|---|---|---|
| GET | `/api/admin/overview` | Uploads and verification requests waiting, total users and artists, and today's (UTC) royalty streams and ad plays. |
| GET | `/api/admin/users` | Every account (newest 1000), with role, verified, tier, join date and active strikes. |
| POST | `/api/admin/users/:id/role` | `{role}`: `listener`, `artist` or `admin`. An admin can't change their own role. |
| POST | `/api/admin/users/:id/verified` | `{verified}`: set or take away the checkmark. |
| POST | `/api/admin/users/:id/strikes` | `{reason}`: record an active policy strike (same as `manage strike`). |
| POST | `/api/admin/users/:id/strikes/lift` | Lift every active strike (same as `manage lift-strikes`). |

**Other**

| Method | Path | |
|---|---|---|
| POST | `/api/newsletter` | `{email}` (Subscribe button) |
| POST | `/api/newsletter/unsubscribe` | `{email}` (always answers `{ ok: true }`) |
| GET | `/api/health` | `{ ok: true }` |

Server hardening:

- A strict Content-Security-Policy (no inline scripts), `nosniff`, `X-Frame-Options: DENY` and a strict referrer policy.
- Per-IP rate limits on every POST, PUT, PATCH and DELETE (`RATE_LIMIT_MULTIPLIER` scales them for load tests).
- JSON body caps: 32 KB, or 1 MB for library sync.
- Passwords are hashed with bcrypt. Sessions are httpOnly, SameSite=Lax cookies, and they're also Secure when `PUBLIC_URL` is https. Only an HMAC of each session id is stored.
- Uploaded files are checked by their content, not their name, and capped in size while they stream in.
- The Docker image runs as a non-root user and has a health check.

## Project layout

```
src/catalog/    genres, covers and artist imagery, charts, search, lyrics, audio analysis
src/player/     audio engine (queue, transport, crossfade, sound settings, Media Session)
src/pages/      pages: Discover, Browse, Detail, Library/Search, Account, Admin, Studio, legal
src/music.tsx   catalog + library context and player hooks
src/lib/        accounts, library sync, published catalog, submissions, newsletter, helpers
src/components/ UI components (shell/ and music/)
src/i18n/       English, French and Kreyòl translations
server/         Express server: API, security headers, SQLite database, file storage
tests/          vitest unit and API tests; tests/e2e has the Playwright suites
```

## Production notes

- Data lives in SQLite (`DATABASE_FILE`, built into Node 22) and uploaded files on disk (`UPLOADS_DIR`). Both belong on a persistent volume. This setup runs as a single instance; `server/storage.ts` defines the interface for moving files to S3-compatible storage later.
- `SESSION_SECRET` and `PUBLIC_URL` are required in production, and the server refuses to start without them.
- Run behind TLS and set `PUBLIC_URL` to the https address. `trust proxy` is enabled for correct client IPs.
