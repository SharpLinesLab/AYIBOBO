/**
 * The signed-in account (server sessions). The session itself is an httpOnly cookie the page
 * can't read; this keeps the user the server reports. On static hosting (no API server) the
 * status is `unavailable` and the rest of the app works as before.
 */
import { useSyncExternalStore } from 'react';
import { librarySync } from './librarySync';

export type Role = 'listener' | 'artist' | 'admin';

export interface AccountUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  createdAt: number;
  /** Artist profile: the name songs are credited to by default (null = the display name). */
  artistName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  /** Verified artist (an admin approved their verification request). */
  verified: boolean;
}

export interface AccountState {
  status: 'loading' | 'ready' | 'unavailable';
  user: AccountUser | null;
}

/** Error codes from the server, plus `rate_limited` and `unknown`; shown via `account.error.*`. */
export type AccountError =
  | 'invalid_email'
  | 'weak_password'
  | 'long_password'
  | 'invalid_name'
  | 'invalid_role'
  | 'email_taken'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'unknown';

let state: AccountState = { status: 'loading', user: null };
const listeners = new Set<() => void>();

function set(next: AccountState) {
  state = next;
  listeners.forEach((fn) => fn());
}

export function getAccount(): AccountState {
  return state;
}

export function subscribeAccount(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribeAccount, getAccount, getAccount);
}

/** JSON from our API, or null when there is no API server behind this page. */
async function api(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const res = await fetch(path, { credentials: 'same-origin', ...init });
    if (!res.headers.get('content-type')?.includes('application/json')) return null;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  } catch {
    return null;
  }
}

const post = (path: string, body: unknown) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function refreshAccount(): Promise<void> {
  const r = await api('/api/auth/me');
  if (!r || r.status === 404) set({ status: 'unavailable', user: null });
  else set({ status: 'ready', user: (r.body.user as AccountUser | null) ?? null });
}

type Result = { ok: true; user: AccountUser } | { ok: false; error: AccountError };

function result(r: Awaited<ReturnType<typeof api>>): Result {
  if (r && r.body.ok && r.body.user) {
    const user = r.body.user as AccountUser;
    set({ status: 'ready', user });
    return { ok: true, user };
  }
  if (r?.status === 429) return { ok: false, error: 'rate_limited' };
  return { ok: false, error: (r?.body.code as AccountError | undefined) ?? 'unknown' };
}

export async function signUp(input: { email: string; password: string; displayName: string; role: 'listener' | 'artist' }): Promise<Result> {
  return result(await post('/api/auth/signup', input));
}

export async function signIn(email: string, password: string): Promise<Result> {
  return result(await post('/api/auth/login', { email, password }));
}

export async function signOut(): Promise<void> {
  // Send the last changes first; after this, the device keeps its copy but stops syncing.
  await librarySync.flush();
  await post('/api/auth/logout', {});
  set({ status: 'ready', user: null });
}

/** Ask for a password-reset link. The server answers the same whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: 'rate_limited' | 'unknown' }> {
  const r = await post('/api/auth/reset-request', { email });
  if (r?.status === 200) return { ok: true };
  return { ok: false, error: r?.status === 429 ? 'rate_limited' : 'unknown' };
}

/** Set a new password with the token from a reset link. Everyone is signed out afterwards. */
export async function resetPassword(token: string, password: string): Promise<{ ok: true } | { ok: false; error: 'invalid_token' | 'weak_password' | 'long_password' | 'rate_limited' | 'unknown' }> {
  const r = await post('/api/auth/reset', { token, password });
  if (r?.status === 200) {
    set({ status: 'ready', user: null });
    return { ok: true };
  }
  if (r?.status === 429) return { ok: false, error: 'rate_limited' };
  const code = r?.body.code;
  return { ok: false, error: code === 'invalid_token' || code === 'weak_password' || code === 'long_password' ? code : 'unknown' };
}

/** Artist profile errors from the server, plus `rate_limited` and `unknown`; shown via `account.profile.error.*`. */
export type ProfileError = 'invalid_artist_name' | 'invalid_bio' | 'invalid_picture' | 'picture_too_large' | 'missing_picture' | 'rate_limited' | 'unknown';

/** Same cap as the server (and as song covers). */
export const MAX_PICTURE_BYTES = 8 * 1024 * 1024;

type ProfileResult = { ok: true; user: AccountUser } | { ok: false; error: ProfileError };

function profileResult(r: Awaited<ReturnType<typeof api>>): ProfileResult {
  if (r && r.body.ok && r.body.user) {
    const user = r.body.user as AccountUser;
    set({ status: 'ready', user });
    return { ok: true, user };
  }
  if (r?.status === 429) return { ok: false, error: 'rate_limited' };
  return { ok: false, error: (r?.body.code as ProfileError | undefined) ?? 'unknown' };
}

/** Save the artist name and bio. Empty values clear them (the name falls back to the display name). */
export async function saveArtistProfile(input: { artistName: string; bio: string }): Promise<ProfileResult> {
  return profileResult(await api('/api/account/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }));
}

/** Remove the profile picture (the generated portrait is shown again). */
export async function removeArtistPicture(): Promise<ProfileResult> {
  return profileResult(await api('/api/account/avatar', { method: 'DELETE' }));
}

/** Upload a new profile picture (JPG, PNG, WebP or AVIF, up to 8 MB). */
export async function uploadArtistPicture(file: File): Promise<ProfileResult> {
  if (file.size > MAX_PICTURE_BYTES) return { ok: false, error: 'picture_too_large' };
  const form = new FormData();
  form.append('picture', file);
  return profileResult(await api('/api/account/avatar', { method: 'POST', body: form }));
}
