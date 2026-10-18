# UI/UX production audit — ASF Music

**Scope:**

- **Pages:** every route in the app — Discover, Trending, Charts, Genres, song, album, artist and playlist pages, Library, Search, Upload, Settings, Artist Studio — plus the not-found page and the empty states.
- **Variants:** dark and light themes, each at phone (375 px), tablet (820 px) and desktop (1440 px).
- **Builds:** run against both the dev build and the production build served by `server/`.

**Method:**

- **Accessibility:** automated WCAG 2.1 AA checks with axe-core 4.10.
- **Layout:** horizontal overflow checks.
- **Errors:** console and runtime error capture.
- **Tap targets:** touch-target sizing.
- **Behaviour:** scripted keyboard and behaviour tests (focus, Back/Forward, dialogs, reduced motion).
- **Code review:** a review of the UX-critical code paths.

## Result

| Check | Before | After |
|---|---|---|
| Console / runtime errors | 0 | 0 |
| Pages with horizontal overflow on phones | 3 (artist, search, upload) | 0 |
| axe violations (serious) | 4 rules on 80+ page/theme/viewport combinations | 0 |
| axe violations (moderate/minor) | 4 rules | 0 |
| Distinct page titles | 1 (all pages identical) | one per page |
| Behaviour checks (below) | — | 14 / 14 pass |
| App JS (gzip) | 141 KB, single bundle | ~70 KB app + 69 KB vendor (long-cached); Studio, queue, full-screen player and command palette load on demand |

## Issues found and fixed

**Accessibility**

- **Colour contrast below 4.5:1.** This affected muted labels in dark mode and the green accent, gold accents and faint text in light mode. The theme tokens were retuned to meet AA in both themes. The mobile tab bar is now opaque so its labels keep their contrast.
- **Links and images with no accessible name.** Album cover links in the Top Albums chart now have names. Decorative thumbnails are hidden from screen readers.
- **Invalid ARIA roles.** Links and `<article>`s carried list roles, so filter chips and genre tiles are now proper `<nav>`s.
- **Landmarks and headings.** Duplicate unlabeled `<nav>` landmarks now have labels. Heading levels no longer skip, and every page, including not-found, has an `<h1>`.
- **Skip link and focus.** A visible "Skip to content" link is the first Tab stop. Focus moves to the new content after every navigation. Keyboard focus outlines are consistent.
- **Now Playing dialog.** Focus moves into it when it opens, Tab is trapped inside, Escape closes it, and focus returns to the opener. It no longer re-grabs focus on background re-renders.
- **Reduced motion.** The auto-advancing hero carousels stop when the OS "reduce motion" setting is on.
- **Tap targets.** Carousel dots got a 24 px hit area, checkboxes are 20 px, and row and card titles are 24 px tall.

**Layout**

- **Phone overflow.** Single-column grids let wide children push the page sideways on phones. The fix is `minmax(0, 1fr)` columns with `min-width: 0` on the children.

**Navigation & resilience**

- **Page titles.** Each page sets its own `document.title`, e.g. `Kanaval — Tiga Blaze · ASF` or `Search: lakay · ASF`.
- **Scroll position.** New pages open at the top instantly instead of smooth-scrolling up. Back/Forward restores the previous scroll position.
- **Unknown URLs.** These now show a proper not-found page instead of silently showing Discover.
- **Error boundary.** A crash in one page shows a recoverable error screen instead of a blank app.
- **Background playback.** Hidden tabs throttle timers, so the synth now schedules 3 s ahead instead of 0.8 s and audio doesn't stutter.

**Production readiness**

- **Install and sharing metadata.** Added a web app manifest with app icons (installable to the home screen), an Apple touch icon, a 1200×630 social share image, Twitter card tags, `color-scheme`, `robots.txt` and a `<noscript>` message.
- **Caching.** `index.html` is served with `no-cache` so deploys take effect immediately. Hashed assets stay immutable.
- **Code splitting.** Artist Studio, the full-screen player, the drag-to-reorder queue and the command palette load on demand, and React has its own vendor chunk.
- **Fonts.** Unused font weights were trimmed.

## Behaviour checks (all passing)

1. The first Tab focuses a visible "Skip to content" link.
2. The skip link moves focus to the main content.
3. A new page opens at the top.
4. Each page has its own title.
5. Back restores the previous scroll position.
6. Focus moves to the main content after navigation.
7. An unknown URL shows a not-found page.
8. Now Playing focuses its close button.
9. Tab stays trapped inside Now Playing.
10. Focus isn't stolen after 16 s of background updates.
11. Escape closes Now Playing and returns focus to the opener.
12. With reduced motion on, the carousel doesn't auto-advance.
13. If the API fails, the music app still loads.
14. There are no page errors.

These run on top of the earlier end-to-end flows, which still pass:

- **Playback:** play, queue, Shift+→ to skip, and Space to pause.
- **Library:** like, add to a playlist, and follow.
- **Search:** typing shows suggestions.
- **Uploads:** upload a real audio file, play it, and it survives a reload.

## Known, acceptable

- **Short inline links.** A few text links inside sentences (artist names in metadata lines) are under 24 px tall. WCAG 2.5.8 exempts inline links.

## Launch blockers outside the UI (must be decided before going public)

1. **Accounts and server storage.** Likes, playlists, follows, comments and uploads are stored per browser. Public uploads need user accounts plus server-side audio and image storage (e.g. S3 or R2) with moderation.
2. **Legal pages.** A streaming service with uploads needs a Privacy Policy, Terms of Service and a copyright / DMCA takedown policy. They should be written or reviewed by counsel. The footer has no legal links yet.
3. **Content.** The catalog is fictional and synthesized. Replace it with licensed music and artwork; artwork drops into `src/assets/artwork/`.
4. **Configuration.** Set the social URLs and contact email in `src/brand.ts`. Payments (MonCash, Natcash) are a separate, upcoming feature.
5. **Observability.** Add error reporting (e.g. Sentry) and privacy-friendly analytics.
