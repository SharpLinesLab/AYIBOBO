/**
 * Generative cover art. Every release, artist and playlist gets a deterministic SVG built from a
 * curated palette and one of several editorial templates — no image assets required.
 */
import { mulberry32 } from '../lib/metadata';
import { renderPortrait } from './poster';
import type { CoverSpec, CoverTemplate } from './types';

export const PALETTES: [string, string, string][] = [
  ['#0b1d14', '#1f7a47', '#2ed573'],
  ['#1a0b2e', '#7c3aed', '#f0abfc'],
  ['#2b0f0a', '#e85d3a', '#ffd166'],
  ['#08131f', '#0ea5e9', '#a5f3fc'],
  ['#1c1206', '#b45309', '#fde68a'],
  ['#14080e', '#be123c', '#fda4af'],
  ['#0a0a0a', '#3f3f46', '#e4e4e7'],
  ['#071a1a', '#0f766e', '#99f6e4'],
  ['#160f29', '#4338ca', '#fbbf24'],
  ['#1f0a12', '#9d174d', '#fbcfe8'],
  ['#0d1b0f', '#65a30d', '#ecfccb'],
  ['#1b1410', '#9a3412', '#fed7aa'],
  ['#0b1220', '#1d4ed8', '#f472b6'],
  ['#101010', '#e11d48', '#fafafa'],
];

export const TEMPLATES: CoverTemplate[] = ['orb', 'sun', 'rings', 'waves', 'grid', 'type', 'split'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(spec: CoverSpec): string {
  if (spec.template === 'portrait' || spec.template === 'poster' || spec.template === 'stage') return renderPortrait(spec.seed, spec.palette, spec.template);
  const [bg, mid, hi] = spec.palette;
  const r = mulberry32(spec.seed);
  const S = 400;
  const id = `c${spec.seed.toString(36)}`;
  let body = '';
  switch (spec.template) {
    case 'orb': {
      const orbs = Array.from({ length: 3 }, (_, i) => {
        const cx = 60 + r() * 280;
        const cy = 60 + r() * 280;
        const rr = 90 + r() * 120;
        return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rr.toFixed(0)}" fill="${i === 1 ? hi : mid}" opacity="${(0.55 + r() * 0.35).toFixed(2)}"/>`;
      }).join('');
      body = `<defs><filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter></defs>
<rect width="${S}" height="${S}" fill="${bg}"/><g filter="url(#${id}b)">${orbs}</g>`;
      break;
    }
    case 'sun': {
      const stripes = Array.from({ length: 6 }, (_, i) => `<rect x="0" y="${232 + i * 18}" width="${S}" height="${3 + i * 1.6}" fill="${bg}"/>`).join('');
      body = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
<rect width="${S}" height="${S}" fill="url(#${id}g)"/><circle cx="200" cy="250" r="${120 + r() * 30}" fill="url(#${id}s)"/>${stripes}
<rect x="0" y="330" width="${S}" height="70" fill="${bg}" opacity="0.85"/>`;
      break;
    }
    case 'rings': {
      const cx = 120 + r() * 160;
      const cy = 120 + r() * 160;
      const rings = Array.from({ length: 12 }, (_, i) => `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${20 + i * 26}" fill="none" stroke="${i % 3 === 0 ? hi : mid}" stroke-width="${i % 3 === 0 ? 3 : 1.4}" opacity="${(1 - i / 14).toFixed(2)}"/>`).join('');
      body = `<rect width="${S}" height="${S}" fill="${bg}"/>${rings}<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="14" fill="${hi}"/>`;
      break;
    }
    case 'waves': {
      const waves = Array.from({ length: 7 }, (_, i) => {
        const y = 110 + i * 42;
        const a = 18 + r() * 26;
        const ph = r() * 200;
        let d = `M0 ${y}`;
        for (let x = 0; x <= S; x += 20) d += ` L${x} ${(y + Math.sin((x + ph) / 46) * a).toFixed(1)}`;
        d += ` L${S} ${S} L0 ${S} Z`;
        const color = i % 2 ? mid : hi;
        return `<path d="${d}" fill="${color}" opacity="${(0.18 + i * 0.1).toFixed(2)}"/>`;
      }).join('');
      body = `<rect width="${S}" height="${S}" fill="${bg}"/>${waves}`;
      break;
    }
    case 'grid': {
      const cells: string[] = [];
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const k = r();
          const px = x * 100;
          const py = y * 100;
          const c = [bg, mid, hi][Math.floor(r() * 3)];
          const c2 = [mid, hi, bg][Math.floor(r() * 3)];
          cells.push(`<rect x="${px}" y="${py}" width="100" height="100" fill="${c}"/>`);
          if (k < 0.35) cells.push(`<circle cx="${px + 50}" cy="${py + 50}" r="38" fill="${c2}"/>`);
          else if (k < 0.7) cells.push(`<path d="M${px} ${py} A100 100 0 0 1 ${px + 100} ${py + 100} L${px} ${py + 100} Z" fill="${c2}"/>`);
          else cells.push(`<rect x="${px + 25}" y="${py + 25}" width="50" height="50" fill="${c2}" transform="rotate(45 ${px + 50} ${py + 50})"/>`);
        }
      body = cells.join('');
      break;
    }
    case 'split': {
      const angle = Math.floor(r() * 4) * 45;
      body = `<rect width="${S}" height="${S}" fill="${bg}"/><g transform="rotate(${angle} 200 200)"><rect x="-200" y="200" width="800" height="400" fill="${mid}"/></g>
<circle cx="${(140 + r() * 120).toFixed(0)}" cy="${(140 + r() * 120).toFixed(0)}" r="${(60 + r() * 50).toFixed(0)}" fill="${hi}"/>`;
      break;
    }
    case 'photo': {
      const inner = renderPortrait(spec.figureSeed ?? spec.seed, spec.palette, 'cover').replace('<svg ', '<svg width="400" height="400" ');
      body = inner;
      break;
    }
    case 'type':
    default: {
      body = `<defs><linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
<rect width="${S}" height="${S}" fill="url(#${id}t)"/><circle cx="330" cy="70" r="120" fill="${hi}" opacity="0.18"/>`;
    }
  }
  let text = '';
  if (spec.text) {
    const t = esc(spec.text.toUpperCase());
    const size = Math.max(30, Math.min(78, 560 / Math.max(4, t.length)));
    text = `<text x="28" y="${spec.template === 'type' ? 300 : 362}" font-family="Poppins, 'Arial Black', Arial, sans-serif" font-weight="900" font-size="${size.toFixed(0)}" fill="#fff" letter-spacing="-1">${t}</text>`;
    if (spec.subtext) text += `<text x="30" y="${spec.template === 'type' ? 336 : 386}" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="15" fill="#fff" opacity="0.75" letter-spacing="3">${esc(spec.subtext.toUpperCase())}</text>`;
    text = `<rect x="0" y="${spec.template === 'type' ? 230 : 300}" width="${S}" height="${S}" fill="url(#${id}fade)"/>` + text;
    text = `<defs><linearGradient id="${id}fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient></defs>` + text;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">${body}${text}</svg>`;
}

const cache = new Map<string, string>();

/** Data URI for an `<img>` (cached). */
export function coverUrl(spec: CoverSpec): string {
  if (spec.imageUrl) return spec.imageUrl;
  return generatedCoverUrl(spec);
}

/** Always the generated design (used as the fallback when a real image fails to load). */
export function generatedCoverUrl(spec: CoverSpec): string {
  const key = `${spec.template}|${spec.palette.join()}|${spec.seed}|${spec.figureSeed ?? ''}|${spec.text ?? ''}|${spec.subtext ?? ''}`;
  let url = cache.get(key);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(render(spec))}`;
    cache.set(key, url);
  }
  return url;
}

export function makeCover(seed: number, opts: Partial<CoverSpec> = {}): CoverSpec {
  const r = mulberry32(seed);
  return {
    template: opts.template ?? TEMPLATES[Math.floor(r() * TEMPLATES.length)],
    palette: opts.palette ?? PALETTES[Math.floor(r() * PALETTES.length)],
    seed,
    text: opts.text,
    subtext: opts.subtext,
  };
}
