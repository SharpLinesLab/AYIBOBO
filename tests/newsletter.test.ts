import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeEmail } from '../src/lib/newsletter';

afterEach(() => vi.unstubAllGlobals());

/** Answer every fetch like this (or throw, for "no connection"). */
const respond = (r: Response | Error) => vi.stubGlobal('fetch', async () => (r instanceof Error ? Promise.reject(r) : r));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('newsletter sign-up', () => {
  it('succeeds only when the server accepts the address', async () => {
    respond(json({ ok: true }));
    expect(await subscribeEmail('a@example.com')).toEqual({ ok: true });
    respond(json({ ok: false, error: 'Please enter a valid email.' }, 400));
    expect(await subscribeEmail('nope')).toEqual({ ok: false, error: 'Please enter a valid email.' });
  });

  it('fails, instead of keeping the address somewhere else, when there is no API', async () => {
    const stored = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: stored });
    for (const r of [new TypeError('Failed to fetch'), new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }), new Response('Not found', { status: 404 })]) {
      respond(r);
      expect(await subscribeEmail('a@example.com')).toEqual({ ok: false });
    }
    expect(stored).not.toHaveBeenCalled();
  });
});
