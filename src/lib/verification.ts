/** Artist verification requests: artists ask from #/account, admins review them on #/admin. */

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface VerificationRequest {
  id: string;
  status: VerificationStatus;
  message: string | null;
  requestedAt: number;
  reviewedAt: number | null;
}

/** A pending request as an admin reviews it, with the artist's profile. */
export interface VerificationReview extends VerificationRequest {
  userId: string;
  artistName: string;
  displayName: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
}

/** Server error codes plus `rate_limited` and `unknown`; shown via `account.verify.error.*`. */
export type VerificationError = 'invalid_message' | 'already_pending' | 'already_verified' | 'rate_limited' | 'unknown';

/** Same cap as the server. */
export const MAX_VERIFICATION_MESSAGE = 1000;

/** Your latest request (null if you never asked), or undefined if it couldn't be loaded. */
export async function myVerification(): Promise<VerificationRequest | null | undefined> {
  try {
    const res = await fetch('/api/account/verification', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as { request: VerificationRequest | null }).request : undefined;
  } catch {
    return undefined;
  }
}

export async function requestVerification(message: string): Promise<{ ok: true; request: VerificationRequest } | { ok: false; error: VerificationError }> {
  try {
    const res = await fetch('/api/account/verification', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    const body = (await res.json()) as { ok: boolean; request?: VerificationRequest; code?: VerificationError };
    return body.ok && body.request ? { ok: true, request: body.request } : { ok: false, error: body.code ?? 'unknown' };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

export async function pendingVerifications(): Promise<VerificationReview[] | null> {
  try {
    const res = await fetch('/api/admin/verification', { credentials: 'same-origin' });
    return res.ok ? ((await res.json()) as { requests: VerificationReview[] }).requests : null;
  } catch {
    return null;
  }
}

export async function reviewVerification(id: string, action: 'approve' | 'reject'): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/verification/${encodeURIComponent(id)}/${action}`, { method: 'POST', credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}
