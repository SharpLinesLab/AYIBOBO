/**
 * The signed-in account (server sessions). The session itself is an httpOnly cookie the page
 * can't read; this keeps the user the server reports. On static hosting (no API server) the
 * status is `unavailable` and the rest of the app works as before.
 */
import { useSyncExternalStore } from 'react';

export type Role = 'listener' | 'artist' | 'admin';

export interface AccountUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  createdAt: number;
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
  await post('/api/auth/logout', {});
  set({ status: 'ready', user: null });
}
