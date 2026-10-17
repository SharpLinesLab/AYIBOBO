import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { detectCategory } from '../src/lib/categories';
import { generateArtwork, generatePreview, simulateMetadata, type SiteMetadata } from '../src/lib/metadata';
import type { NormalizedTarget } from '../src/lib/normalize';

const UA = 'Mozilla/5.0 (compatible; soundbid-bot/1.0; +https://soundbid.lol/#/rules)';

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

/** SSRF guard: only fetch hosts that resolve exclusively to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad protocol');
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('bad port');
  const addrs = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('private address');
  return url;
}

async function guardedFetch(raw: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const url = await assertPublicUrl(raw);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 5000);
  try {
    return await fetch(url, { ...init, redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*', ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

/** One redirect hop. Returns the Location (absolute) or the same URL when there's no redirect. */
export async function resolveOneHop(url: string): Promise<string> {
  let res = await guardedFetch(url, { method: 'HEAD' });
  if (res.status === 405 || res.status === 403) res = await guardedFetch(url, { method: 'GET' });
  const loc = res.headers.get('location');
  if (res.status >= 300 && res.status < 400 && loc) return new URL(loc, url).toString();
  // Some shorteners use meta refresh / JS; treat as non-redirecting.
  return url;
}

async function fetchHtml(url: string, maxHops = 4): Promise<{ html: string; finalUrl: string }> {
  let current = url;
  for (let i = 0; i <= maxHops; i++) {
    const res = await guardedFetch(current, { method: 'GET', timeoutMs: 6000 });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) throw new Error(`HTTP ${res.status}`);
    // Cap the read at 512 KB — the <head> is all we need.
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 512_000) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => undefined);
    return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: current };
  }
  throw new Error('too many redirects');
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, ...names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = re.exec(html)?.[0];
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
  }
  return undefined;
}

function httpsAbs(src: string | undefined, base: string): string | undefined {
  if (!src) return undefined;
  try {
    const u = new URL(src, base);
    return u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Scrape OpenGraph / <title> / icon / audio. Falls back to the deterministic simulation. */
export async function scrapeMetadata(target: NormalizedTarget): Promise<SiteMetadata> {
  const fallback = simulateMetadata(target);
  if (target.kind === 'handle') return fallback;
  try {
    const { html, finalUrl } = await fetchHtml(target.url);
    const head = html.slice(0, 200_000);
    const rawTitle = meta(head, 'og:title', 'twitter:title') ?? decode(/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] ?? '');
    const siteName = meta(head, 'og:site_name');
    const description = meta(head, 'og:description', 'description', 'twitter:description');
    const [titlePart, ...rest] = rawTitle.split(/\s+[|·–—-]\s+/);
    const title = (titlePart || siteName || fallback.title).slice(0, 80);
    const tagline = (rest.join(' · ') || description?.split(/[.!?]/)[0] || fallback.tagline).slice(0, 80);
    const image = httpsAbs(meta(head, 'og:image', 'twitter:image'), finalUrl);
    const iconHref = /<link[^>]+rel=["'][^"']*(?:apple-touch-icon|icon)[^"']*["'][^>]*>/i.exec(head)?.[0];
    const icon = httpsAbs(iconHref && /href=["']([^"']+)["']/i.exec(iconHref)?.[1], finalUrl);
    const audio = httpsAbs(meta(head, 'og:audio', 'og:audio:url', 'og:audio:secure_url'), finalUrl);
    const category = detectCategory(target.host, `${target.key} ${title} ${tagline} ${description ?? ''}`);
    const artwork = { ...generateArtwork(target.key, title), imageUrl: icon ?? image };
    return {
      title,
      tagline,
      description: (description ?? fallback.description).slice(0, 400),
      category,
      artwork,
      preview: audio ? { kind: 'file', url: audio } : generatePreview(target.key, category),
      source: 'scraped',
    };
  } catch {
    return fallback;
  }
}
