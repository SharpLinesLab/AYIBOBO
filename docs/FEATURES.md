# Listening & creator features

## Synced lyrics
- **Where they appear:**
  - **Now Playing → Lyrics:** full-screen view; the current line is highlighted and scrolled into view.
  - **Side panel:** a lyrics card that follows the song.
  - **Song page:** a lyrics section.
  - **Player bar:** a microphone button opens the full-screen view.
- **Click to seek:** clicking any line plays the song from that line.
- **Format:** artists add lyrics when they upload, or later with **Edit lyrics** on their song page. They can paste:
  - plain text, shown unsynced, or
  - an [LRC](https://en.wikipedia.org/wiki/LRC_(file_format)) file. Supported: `[mm:ss.xx]` stamps, several stamps on one line, `[offset:]`, and metadata tags.
- **Tap-to-sync:** **Sync to song** plays the track. The artist presses Space (or **Next line**) as each line starts, and Backspace undoes. The result is saved as LRC.
- **Demo catalog:** the sample songs have demo lyrics timed to each song's verses and hooks (`src/catalog/lyrics.ts`). Replace these with licensed lyrics before launch.

## Crossfade
- **Setting:** Settings → Playback → Crossfade, from 0 to 12 s. The value is saved per device.
- **How it works:** the next song starts that many seconds before the current one ends, and their volumes ramp across each other.
- **When off:** songs play back to back with no gap.
- **Background tabs:** end-of-song detection runs on a timer, not animation frames, so songs still advance in a background tab.

## Offline
- **The app itself:**
  - `vite build` generates a service worker, `/sw.js`. It is built from `src/sw.template.js` and lists every file in the build.
  - The app opens and plays with no connection after the first visit.
  - The catalog's songs are generated in the browser and uploads are stored on the device, so both play offline.
- **Downloads:**
  - **Download** buttons sit on songs, albums, playlists and Liked Songs.
  - Songs streamed from a server (for example licensed audio) are saved to Cache Storage and played from the device.
  - Downloaded songs are listed in **Library → Downloads**.
  - **Settings → Offline** shows storage use and can remove all downloads. It can also ask the browser to protect them so they aren't cleared when space runs low.
- **Status messages:**
  - An offline banner tells listeners what still works.
  - When a new deploy is ready, a "new version" prompt reloads into it.
- **Server:** `sw.js` is sent with `Cache-Control: no-cache` so updates roll out promptly.

## Artist Studio (`#/studio`)
- **What it shows:**
  - streams, listeners, followers and saves, with the change against the previous period
  - a streams-over-time chart; it has a crosshair tooltip, arrow-key reading and a table view
  - top songs with trend sparklines
  - top cities and where streams come from
- **Time range:** 7 days, 28 days or 12 months. Data runs through yesterday, so a half-counted today doesn't read as a drop.
- **Your uploads ("me"):** plays counted on this device, per day.
- **Demo artist profiles:** simulated numbers from the sample catalog, labelled as such on the page.
- **Before launch:** real listener counts, cities and stream sources need accounts and server-side play logging. See the launch blockers in `UI-UX-AUDIT.md`.
