/**
 * Newsletter sign-up. Posts to the server. If the server can't be reached (offline, or a page
 * served without the API), the sign-up fails with an error: the address is never kept anywhere
 * else, so it can't vanish quietly.
 */
export async function subscribeEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    if (res.status !== 404 && res.headers.get('content-type')?.includes('application/json')) {
      const body = (await res.json()) as { ok: boolean; error?: string };
      return res.ok ? { ok: true } : { ok: false, error: body.error };
    }
  } catch {
    /* no API reachable */
  }
  return { ok: false };
}
