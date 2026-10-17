/**
 * URL normalization & listing identity.
 *
 * Every submission is reduced to a stable `key`. Two submissions with the same key are the
 * same listing (so paying again is a top-up). Rules:
 *  - tracking / referral / affiliate query strings and fragments are stripped
 *  - `www.`, `m.` and friends are dropped, hosts are lower-cased
 *  - link shorteners must be resolved to their destination before keying
 *  - ordinary sites are keyed by domain; shared music platforms (Bandcamp, Spotify,
 *    SoundCloud, Splice, Gumroad, ...) are keyed by the path that identifies the tenant
 *  - private chat invites and adult sites are refused
 */

export type NormalizeErrorCode = 'empty' | 'invalid' | 'blocked_invite' | 'blocked_nsfw' | 'shortener';

export interface NormalizedTarget {
  ok: true;
  kind: 'url' | 'handle';
  /** Identity key, e.g. `stemforge.ai`, `open.spotify.com/artist/4xyz`, `@kaimori`. */
  key: string;
  /** Canonical outbound URL with tracking removed. */
  url: string;
  /** Human-friendly display string (equal to key for most inputs). */
  display: string;
  host: string;
}

export interface NormalizeError {
  ok: false;
  code: NormalizeErrorCode;
  error: string;
}

export type NormalizeResult = NormalizedTarget | NormalizeError;

export const SHORTENER_HOSTS = new Set([
  'bit.ly',
  'bitly.com',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'is.gd',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'linktr.ee',
  'lnk.to',
  'ffm.to',
  'ffm.bio',
  'spoti.fi',
  'found.ee',
  'smarturl.it',
  'hypeddit.com',
  'song.link',
  'album.link',
  'snd.sc',
  'on.soundcloud.com',
  'spotify.link',
]);

const INVITE_RULES: [RegExp, RegExp | null][] = [
  [/^discord\.gg$/, null],
  [/^discord\.com$|^discordapp\.com$/, /^\/invite\//],
  [/^t\.me$|^telegram\.me$|^telegram\.dog$/, null],
  [/^chat\.whatsapp\.com$/, null],
  [/^wa\.me$/, null],
  [/^whatsapp\.com$/, /^\/(invite|channel)\b/],
  [/^signal\.group$/, null],
  [/^groupme\.com$/, /^\/join_group\//],
  [/^kik\.me$/, null],
];

const NSFW_HOSTS = new Set([
  'onlyfans.com',
  'fansly.com',
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'chaturbate.com',
  'stripchat.com',
  'manyvids.com',
  'clips4sale.com',
  'brazzers.com',
  'rule34.xxx',
  'e-hentai.org',
  'nhentai.net',
]);
const NSFW_TOKENS = /(^|[.\-])(porn|porno|xxx|nsfw|hentai|camgirls?|sexcam|nude|nudes|escort|escorts)([.\-]|$)/;
const NSFW_TLDS = /\.(xxx|porn|sex|adult)$/;

/** Query params that change *what* a URL points to on platforms we key by query. */
const KEEP_PARAMS: Record<string, string[]> = {
  'youtube.com': ['v', 'list'],
};

const HOST_ALIASES: Record<string, string> = {
  'twitter.com': 'x.com',
  'mobile.twitter.com': 'x.com',
  'youtu.be': 'youtube.com',
  'music.youtube.com': 'youtube.com',
  'play.spotify.com': 'open.spotify.com',
  'm.soundcloud.com': 'soundcloud.com',
  'instagr.am': 'instagram.com',
};

const STRIP_PREFIXES = /^(www\d?|m|mobile|amp)\./;

/** Number of path segments that identify a tenant on shared platforms. */
type PathRule = (segments: string[], host: string) => string[] | null;

const keep =
  (n: number): PathRule =>
  (s) =>
    s.slice(0, n);

/** On subdomain-tenanted platforms the subdomain is the tenant; optionally keep a release path. */
const releasePath: PathRule = (s) => {
  if ((s[0] === 'album' || s[0] === 'track' || s[0] === 'l') && s[1]) return s.slice(0, 2);
  return [];
};

const PLATFORM_RULES: [RegExp, PathRule][] = [
  // Subdomain tenants
  [/^[a-z0-9-]+\.bandcamp\.com$/, releasePath],
  [/^[a-z0-9-]+\.gumroad\.com$/, releasePath],
  [/^[a-z0-9-]+\.itch\.io$/, keep(1)],
  [/^[a-z0-9-]+\.substack\.com$/, () => []],
  [/^[a-z0-9-]+\.sellfy\.store$/, keep(2)],
  [/^[a-z0-9-]+\.myshopify\.com$/, () => []],
  // Path tenants
  [/^bandcamp\.com$/, keep(1)],
  [
    /^open\.spotify\.com$/,
    (s) => {
      // /intl-de/artist/<id> -> artist/<id>
      const t = s[0]?.startsWith('intl-') ? s.slice(1) : s;
      return t.slice(0, 2);
    },
  ],
  [
    /^soundcloud\.com$/,
    (s) => {
      if (s[1] === 'sets' && s[2]) return s.slice(0, 3);
      if (['tracks', 'albums', 'popular-tracks', 'reposts', 'likes', 'followers', 'following'].includes(s[1] ?? ''))
        return s.slice(0, 1);
      return s.slice(0, 2);
    },
  ],
  [
    /^music\.apple\.com$/,
    (s) => {
      // /us/album/name/123 -> album/123 ; /us/artist/name/123 -> artist/123
      const t = /^[a-z]{2}$/.test(s[0] ?? '') ? s.slice(1) : s;
      if (t.length >= 3) return [t[0], t[t.length - 1]];
      return t.slice(0, 2);
    },
  ],
  [
    /^splice\.com$/,
    (s) => {
      if (s[0] === 'sounds' && s[1] === 'packs') return s.slice(0, 4);
      if (s[0] === 'sounds' && s[1] === 'labels') return s.slice(0, 3);
      if (s[0] === 'plugins' && s[1]) return s.slice(0, 2);
      return [];
    },
  ],
  [/^gumroad\.com$/, (s) => (s[0] === 'l' ? s.slice(0, 2) : s.slice(0, 1))],
  [/^payhip\.com$/, (s) => (s[0] === 'b' ? s.slice(0, 2) : s.slice(0, 1))],
  [/^ko-fi\.com$/, keep(1)],
  [/^patreon\.com$/, (s) => (s[0] === 'c' ? s.slice(0, 2) : s.slice(0, 1))],
  [/^beatstars\.com$/, keep(1)],
  [/^airbit\.com$/, keep(1)],
  [/^audiomack\.com$/, (s) => (s.length >= 3 ? s.slice(0, 3) : s.slice(0, 1))],
  [/^mixcloud\.com$/, keep(1)],
  [/^tidal\.com$/, (s) => (s[0] === 'browse' ? s.slice(1, 3) : s.slice(0, 2))],
  [/^deezer\.com$/, (s) => (/^[a-z]{2}$/.test(s[0] ?? '') ? s.slice(1, 3) : s.slice(0, 2))],
  [
    /^youtube\.com$/,
    (s) => {
      if (s[0]?.startsWith('@')) return s.slice(0, 1);
      if (s[0] === 'channel' || s[0] === 'c' || s[0] === 'user') return s.slice(0, 2);
      if (s[0] === 'watch' || s[0] === 'playlist') return s.slice(0, 1);
      return s.slice(0, 1);
    },
  ],
  [/^instagram\.com$/, keep(1)],
  [/^tiktok\.com$/, keep(1)],
  [/^x\.com$/, keep(1)],
  [/^threads\.(net|com)$/, keep(1)],
  [/^facebook\.com$/, keep(1)],
  [/^github\.com$/, keep(2)],
  [/^distrokid\.com$/, (s) => (s[0] === 'hyperfollow' ? s.slice(0, 3) : [])],
  [/^pluginboutique\.com$/, (s) => (s[0] === 'product' ? s.slice(0, 4) : [])],
  [/^kvraudio\.com$/, (s) => (s[0] === 'product' ? s.slice(0, 2) : [])],
  [/^discogs\.com$/, (s) => (['artist', 'label', 'release', 'master', 'seller'].includes(s[0] ?? '') ? s.slice(0, 2) : [])],
  [/^reverb\.com$/, (s) => (s[0] === 'shop' ? s.slice(0, 2) : [])],
  [/^etsy\.com$/, (s) => (s[0] === 'shop' ? s.slice(0, 2) : [])],
  [/^linktr\.ee$/, keep(1)],
];

const TRACKING_PARAM = /^(utm_.*|ref|ref_src|ref_url|referrer|source|src|si|fbclid|gclid|dclid|msclkid|igshid|igsh|mc_cid|mc_eid|aff|affiliate|aff_id|affid|aff_sub|irclickid|clickid|_ga|_gl|yclid|twclid|ttclid|s|feature|context|nd|app|pp|from|share|share_id|tracking|trk|cmpid|campaign|partner|partnerid|sp_.*)$/i;

export function isShortenerHost(host: string): boolean {
  return SHORTENER_HOSTS.has(host);
}

function cleanHost(rawHost: string): string {
  let host = rawHost.toLowerCase().replace(/\.$/, '');
  if (HOST_ALIASES[host]) return HOST_ALIASES[host];
  while (STRIP_PREFIXES.test(host) && host.split('.').length > 2) host = host.replace(STRIP_PREFIXES, '');
  return HOST_ALIASES[host] ?? host;
}

function isNsfwHost(host: string): boolean {
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (NSFW_HOSTS.has(parts.slice(i).join('.'))) return true;
  }
  return NSFW_TOKENS.test(host) || NSFW_TLDS.test(host);
}

function isInvite(host: string, path: string): boolean {
  return INVITE_RULES.some(([h, p]) => h.test(host) && (p === null || p.test(path)));
}

const HANDLE_RE = /^@([a-z0-9_.]{2,30})$/i;

export function normalizeInput(raw: string): NormalizeResult {
  const input = raw.trim();
  if (!input) return { ok: false, code: 'empty', error: 'Enter a music website URL, release link, or @handle.' };

  const handle = HANDLE_RE.exec(input);
  if (handle) {
    const name = handle[1].toLowerCase().replace(/\.+$/, '');
    return {
      ok: true,
      kind: 'handle',
      key: `@${name}`,
      url: `https://x.com/${name}`,
      display: `@${name}`,
      host: 'x.com',
    };
  }
  if (input.startsWith('@')) {
    return { ok: false, code: 'invalid', error: 'Handles can use letters, numbers, dots and underscores (2–30 characters).' };
  }

  let parsed: URL;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, code: 'invalid', error: "That doesn't look like a valid URL." };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, code: 'invalid', error: 'Only http(s) links can be listed.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: 'invalid', error: 'URLs with embedded credentials are not allowed.' };
  }

  const host = cleanHost(parsed.hostname);
  if (
    !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host) ||
    host === 'localhost' ||
    /^\d+(\.\d+){3}$/.test(host)
  ) {
    return { ok: false, code: 'invalid', error: 'Use a public website domain (e.g. yourlabel.com).' };
  }

  const path = parsed.pathname.replace(/\/{2,}/g, '/');
  if (isInvite(host, path)) {
    return {
      ok: false,
      code: 'blocked_invite',
      error: 'Private chat invite links (Discord, Telegram, WhatsApp, …) are not allowed. List your public site instead.',
    };
  }
  if (isNsfwHost(host)) {
    return { ok: false, code: 'blocked_nsfw', error: 'Adult / NSFW links are not allowed on the leaderboard.' };
  }
  if (isShortenerHost(host)) {
    return {
      ok: false,
      code: 'shortener',
      error: 'Short links are resolved to their destination before listing.',
    };
  }

  let segments = path
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });

  // youtu.be/<id> -> youtube.com/watch?v=<id>
  const params = new URLSearchParams();
  if (parsed.hostname.toLowerCase().replace(/^www\./, '') === 'youtu.be' && segments[0]) {
    params.set('v', segments[0]);
    segments = ['watch'];
  }

  const keepParams = KEEP_PARAMS[host] ?? [];
  for (const [k, v] of parsed.searchParams) {
    if (keepParams.includes(k) && !TRACKING_PARAM.test(k)) params.set(k, v);
  }

  const rule = PLATFORM_RULES.find(([re]) => re.test(host));
  const keySegments = rule ? (rule[1](segments, host) ?? []) : [];
  const keyPath = keySegments
    .map((s) => (host === 'open.spotify.com' || host === 'youtube.com' ? s : s.toLowerCase()))
    .join('/');
  const query = params.toString();

  const key = `${host}${keyPath ? `/${keyPath}` : ''}${query ? `?${query}` : ''}`;
  // Outbound URL: keep the tenant path the user gave us (tracking removed), on https.
  const cleanPath = rule ? (keyPath ? `/${keySegments.map(encodeURIComponent).join('/')}` : '') : path === '/' ? '' : path;
  const url = `https://${host}${cleanPath.replace(/\/$/, '')}${query ? `?${query}` : ''}`;

  return { ok: true, kind: 'url', key, url, display: prettyDisplay(key), host };
}

/** Shorten opaque platform IDs for display: `open.spotify.com/artist/4Zq8Mara…`. */
export function prettyDisplay(key: string): string {
  return key
    .split('/')
    .map((seg, i) => (i > 0 && seg.length > 14 && /\d/.test(seg) && !seg.includes('-') ? `${seg.slice(0, 8)}…` : seg))
    .join('/');
}

export type Resolver = (url: string) => Promise<string>;

/**
 * Normalize, following link shorteners through `resolver` first (the server follows redirects;
 * the browser demo uses a static map because cross-origin redirects can't be read client side).
 */
export async function resolveAndNormalize(raw: string, resolver?: Resolver, maxHops = 4): Promise<NormalizeResult> {
  let current = raw.trim();
  for (let hop = 0; hop <= maxHops; hop++) {
    const result = normalizeInput(current);
    if (result.ok || result.code !== 'shortener') return result;
    if (!resolver) {
      return { ok: false, code: 'shortener', error: 'Short links can’t be resolved here — paste the destination URL instead.' };
    }
    let next: string;
    try {
      const withScheme = /^[a-z]+:\/\//i.test(current) ? current : `https://${current}`;
      next = await resolver(withScheme);
    } catch {
      return { ok: false, code: 'shortener', error: 'We couldn’t resolve that short link. Paste the destination URL instead.' };
    }
    if (!next || next === current) {
      // Linktree pages don't redirect — they are landing pages. Key them by path.
      if (/linktr\.ee/i.test(current)) return normalizeLinktree(current);
      return { ok: false, code: 'shortener', error: 'That short link doesn’t redirect anywhere. Paste the destination URL instead.' };
    }
    current = next;
  }
  return { ok: false, code: 'shortener', error: 'Too many redirects.' };
}

function normalizeLinktree(raw: string): NormalizeResult {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    const name = u.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    if (!name) return { ok: false, code: 'invalid', error: 'Add the Linktree username, e.g. linktr.ee/yourname.' };
    const key = `linktr.ee/${name}`;
    return { ok: true, kind: 'url', key, url: `https://${key}`, display: key, host: 'linktr.ee' };
  } catch {
    return { ok: false, code: 'invalid', error: "That doesn't look like a valid URL." };
  }
}
