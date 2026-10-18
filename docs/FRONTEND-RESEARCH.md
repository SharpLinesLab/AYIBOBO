# Front-end research: open-source libraries and feature gaps (October 2026)

Sources:
- **Versions and licences:** the npm registry.
- **GitHub stars:** github.com.
- **Bundle sizes:** this project's own production build.

Everything we adopted is under a permissive licence (MIT, ISC or OFL), so it is safe in a commercial product.

## What we adopted

| Need | Library | Licence | Cost to users | Where it's used |
|---|---|---|---|---|
| Fonts that work offline, with no request to Google | `@fontsource-variable/inter`, `inter-tight`, `jetbrains-mono`, `@fontsource/poppins` | OFL-1.1 (fonts) | about 340 KB of fonts. Latin and Latin Extended only, which covers Kreyòl and French. Precached by the service worker. | `src/styles/fonts.css` |
| ⌘K command palette | `cmdk` 1.1 | MIT | 19 KB gzipped, loaded on first ⌘K | `src/components/shell/CommandPalette.tsx` |
| Drag-to-reorder queue, swipe-down mobile player | `motion` 14 | MIT | about 49 KB gzipped, in a chunk that loads only for Now Playing or the queue, prefetched once music plays | `src/components/shell/Queue.tsx`, `NowPlaying.tsx` |
| End-to-end and accessibility tests | `@playwright/test` (Apache-2.0), `@axe-core/playwright` (MPL-2.0, dev only) | n/a | n/a | `tests/e2e`, run in CI by `.github/workflows/ci.yml` |

We built these in-house rather than add a dependency, because the browser already does the work:
- **Sound panel:** EQ presets, speed with or without pitch change, and reverb, all through Web Audio.
- **Share sheet:** the Web Share API, share links per network, and a canvas-rendered 1080×1920 story image.
- **Autoplay:** continues with similar songs when the queue ends.

## Tried and removed

**React 19.3 `<ViewTransition>` (page and artwork transitions).** We built it, measured it, then removed it:
- React holds back the page update until the new page's images have loaded. That made navigation take about 450 ms instead of being instant.
- Opening and closing Now Playing took 0.5–1.2 s on the production build.
- Pages already animate themselves in with CSS, so the transition wasn't worth the delay.

Revisit it if React adds a way to opt out of waiting for images.

## Considered, not needed yet

- **Base UI** (`@base-ui/react`, MIT): accessible menus, slider, tooltip and drawer. Our hand-built menus and dialogs already pass axe and the keyboard tests. Reconsider if the component count grows a lot.
- **vaul:** its own README says it's unmaintained, so we skipped it.
- **embla-carousel** (MIT): native CSS scroll-snap is already smooth on touch. Add it if we want looping carousels with momentum.
- **@tanstack/react-virtual** (MIT): only needed once libraries grow into thousands of songs (after accounts launch).
- **sonner** (MIT): our toasts are fine.
- **lucide-react** (ISC): the inline icons are consistent; worth switching to only if the icon set grows.
- **thumbhash** (MIT): blurry artwork placeholders. It needs a hash generated at upload time on the server.

## Open-source players worth studying

Use these for ideas only, and never copy their code, because their licences don't allow it in a commercial product:
- **GPL / AGPL:** Navidrome, Feishin, Nuclear, Jellyfin, ytmdesktop, Supersonic, Funkwhale.
- **BSD-4:** Spotube.

Two projects are MIT, so their code is reusable: **Koel** (equaliser presets UI, drag a track onto a sidebar playlist) and **pear-desktop** (YouTube Music desktop: plugin toggles, picture-in-picture).

## Feature gaps we still have, ranked for a Caribbean and diaspora audience

| # | Feature | Front-end only? |
|---|---|---|
| 1 | Kreyòl, French and English interface. Browsers have no Kreyòl (`ht`) locale data, so month and day names must be translated by hand. | Yes |
| 2 | Link previews when sharing on WhatsApp, X and Facebook. This needs path URLs instead of `#/…`, plus server-rendered meta tags. | Needs server |
| 3 | Data-saver mode and stream-quality picker | Needs multiple bitrates on the server |
| 4 | Live radio (Haitian FM and web radio), DJ mixes and podcasts | Needs a catalogue |
| 5 | Casting (Chromecast, AirPlay) and a picture-in-picture mini player | Yes, once audio is hosted |
| 6 | Tipping and supporter badges with MonCash and Natcash | Needs backend |
| 7 | Year-in-review recap | Partly (local history) |
| 8 | Looping video artwork and music videos | Needs storage |
| 9 | Concerts and events on artist pages, pre-save and countdown pages | Needs backend |
| 10 | Group listening (Jam / SharePlay) | Needs realtime backend |
