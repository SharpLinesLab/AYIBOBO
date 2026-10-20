/** Admin dashboard data: the overview's numbers and account administration (#/admin, admins only). */

export type Role = 'listener' | 'artist' | 'admin';
export const ROLES: readonly Role[] = ['listener', 'artist', 'admin'];

/** Same cap as the server. */
export const MAX_STRIKE_REASON = 500;

export interface AdminOverview {
  pendingUploads: number;
  pendingVerifications: number;
  users: number;
  artists: number;
  royaltyStreamsToday: number;
  adPlaysToday: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  artistName: string | null;
  role: Role;
  verified: boolean;
  tier: 'free' | 'premium';
  createdAt: number;
  activeStrikes: number;
}

/** Server error codes plus `rate_limited` and `unknown`; shown via `admin.users.error.*`. */
export type AdminUserError = 'invalid_role' | 'own_role' | 'invalid_verified' | 'invalid_reason' | 'rate_limited' | 'unknown';

export async function adminOverview(): Promise<AdminOverview | null> {
  try {
    const res = await fetch('/api/admin/overview', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as AdminOverview) : null;
  } catch {
    return null;
  }
}

export async function adminUsers(): Promise<{ total: number; users: AdminUser[] } | null> {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as { total: number; users: AdminUser[] }) : null;
  } catch {
    return null;
  }
}

async function act(id: string, path: string, body: object): Promise<{ ok: true; user: AdminUser } | { ok: false; error: AdminUserError }> {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    const out = (await res.json()) as { ok: boolean; user?: AdminUser; code?: AdminUserError };
    return out.ok && out.user ? { ok: true, user: out.user } : { ok: false, error: out.code ?? 'unknown' };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

export const setUserRole = (id: string, role: Role) => act(id, 'role', { role });
export const setUserVerified = (id: string, verified: boolean) => act(id, 'verified', { verified });
export const issueStrike = (id: string, reason: string) => act(id, 'strikes', { reason });
export const liftStrikes = (id: string) => act(id, 'strikes/lift', {});
