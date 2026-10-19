import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The e2e server's port and environment (shared by playwright.config.ts and publish.setup.ts). */
export const PORT = Number(process.env.E2E_PORT ?? 4319);
export const BASE_URL = `http://localhost:${PORT}`;
export const SERVER_ENV = {
  PORT: String(PORT),
  NODE_ENV: 'production',
  // Its own throwaway database, and room for many parallel browsers sharing one IP.
  DATABASE_FILE: join(tmpdir(), `asf-e2e-${PORT}.db`),
  UPLOADS_DIR: join(tmpdir(), `asf-e2e-${PORT}-uploads`),
  DATA_FILE: join(tmpdir(), `asf-e2e-${PORT}.json`),
  RATE_LIMIT_MULTIPLIER: '50',
  SESSION_SECRET: 'e2e-only-session-secret-0123456789abcdef',
  PUBLIC_URL: `http://localhost:${PORT}`,
};

/**
 * Songs published before the tests run, through the real flow: artist accounts upload them and an
 * admin approves them. ASF has no built-in catalog, so these are the only music in the app.
 */
export const ARTIST_A = 'E2E Artist A';
export const ARTIST_B = 'E2E Artist B';
export const SONGS = [
  { title: 'First Song', artist: ARTIST_A },
  { title: 'Second Song', artist: ARTIST_A },
  { title: 'Third Song', artist: ARTIST_A, featured: 'Guest Star', explicit: true },
  { title: 'Other Song', artist: ARTIST_B },
] as const;
/** Every test song is this long (seconds) and in this genre. */
export const SONG_SECONDS = 45;
export const SONG_GENRE = 'kompa';
