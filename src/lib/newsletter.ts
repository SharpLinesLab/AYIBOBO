/**
 * Newsletter sign-up. Posts to the server; when the site runs without the API (static hosting or
 * `npm run dev` on its own) the address is kept in this browser so the form still works in demos.
 */
export async function subscribeEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    if (res.status !== 404 && res.headers.get('content-type')?.includes('application/json')) {
      const body = (await res.json()) as { ok: boolean; error?: string };
      return res.ok ? { ok: true } : { ok: false, error: body.error };
    }
  } catch {
    /* no API reachable — fall through to the local demo store */
  }
  try {
    const list = JSON.parse(localStorage.getItem('asf:subscribers') ?? '[]') as string[];
    if (!list.includes(email)) localStorage.setItem('asf:subscribers', JSON.stringify([...list, email]));
  } catch {
    /* storage blocked — still acknowledge */
  }
  return { ok: true };
}
