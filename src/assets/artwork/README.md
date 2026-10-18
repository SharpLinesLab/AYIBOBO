# Real artwork

Drop licensed images here (JPG, PNG or WebP). They are picked up automatically at build time and
replace the generated artwork everywhere; nothing else needs to change.

| File | Used for |
|---|---|
| `artists/<artist-id>.jpg` | artist photo (avatars, cards, search) — square works best, ≥ 800×800 |
| `artists/<artist-id>-poster.jpg` | tall poster (3:4) used in spotlights; falls back to the photo |
| `artists/<artist-id>-banner.jpg` | wide header on the artist page (≈ 2400×900); falls back to the poster/photo |
| `releases/<album-id or track-id>.jpg` | album / single cover — square, ≥ 1000×1000 |

Artist ids look like `ar-tiga-blaze`; album ids `al-tiga-blaze-1`; track ids are in each song page URL
(`#/song/<id>`). Only use images you own or are licensed to publish.
