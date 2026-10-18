/**
 * Editorial artist imagery: stage-lit, rim-lit silhouettes with haze and film grain, in the
 * style of tour posters and press shots. Purely generative (no photos of real people), used as
 * the fallback whenever an artist has no real photography in the artwork manifest.
 *
 * Text is intentionally NOT drawn here — names are overlaid in HTML so they use the site's fonts.
 */
import { mulberry32 } from '../lib/metadata';

export type PortraitCrop = 'poster' | 'portrait' | 'stage' | 'cover';

interface Pose {
  x: number;
  scale: number;
  hair: 'short' | 'afro' | 'bun' | 'waves' | 'long';
  headphones: boolean;
  mic: boolean;
  profile: boolean;
  tilt: number;
  /** Key light from the left (-1) or right (1). */
  key: -1 | 1;
}

function pose(seed: number): Pose {
  const r = mulberry32(seed ^ 0xa5a5);
  const hairs: Pose['hair'][] = ['short', 'afro', 'bun', 'waves', 'long'];
  return {
    x: 150 + (r() - 0.5) * 36,
    scale: 1 + r() * 0.12,
    hair: hairs[Math.floor(r() * hairs.length)],
    headphones: false,
    mic: r() < 0.3,
    profile: r() < 0.35,
    tilt: (r() - 0.5) * 8,
    key: r() < 0.5 ? -1 : 1,
  };
}

const HEAD_FRONT =
  'M150 148 C177 148 194 170 194 200 C194 228 183 248 168 258 C162 262 156 264 150 264 C144 264 138 262 132 258 C117 248 106 228 106 200 C106 170 123 148 150 148 Z';
const HEAD_PROFILE =
  'M114 204 C112 168 136 148 162 150 C184 152 196 170 196 190 L198 202 L208 220 C209 223 207 225 204 225 L199 226 L201 236 L197 240 L199 247 C197 255 189 258 180 257 C172 266 156 270 140 262 C124 252 115 230 114 204 Z';
const NECK = 'M134 246 C138 266 136 282 132 294 L168 294 C164 282 162 266 166 246 Z';
const TORSO = 'M6 412 C16 352 66 318 116 307 C128 304 134 298 136 288 L164 288 C166 298 172 304 184 307 C234 318 284 352 294 412 Z';

/** Silhouette in a 300×400 frame (head around y≈200). */
function figure(p: Pose, fill: string, extra = ''): string {
  const parts: string[] = [];
  if (p.hair === 'afro') parts.push('<ellipse cx="150" cy="190" rx="66" ry="62"/>');
  if (p.hair === 'long') parts.push('<path d="M104 196 C100 150 126 136 150 136 C176 136 202 150 198 196 C204 250 210 290 214 318 L86 318 C90 290 98 250 104 196 Z"/>');
  if (p.hair === 'bun') parts.push(`<circle cx="${p.profile ? 132 : 150}" cy="140" r="22"/>`);
  parts.push(`<path d="${TORSO}"/>`, `<path d="${NECK}"/>`, `<path d="${p.profile ? HEAD_PROFILE : HEAD_FRONT}"/>`);
  if (p.hair === 'waves' || p.hair === 'short')
    parts.push(
      `<path d="M106 196 C102 158 126 142 150 142 C178 142 200 158 194 196 C188 ${p.hair === 'waves' ? 174 : 180} 170 166 150 166 C130 166 112 ${p.hair === 'waves' ? 174 : 180} 106 196 Z"/>`,
    );
  if (p.headphones) {
    parts.push(`<path d="M104 206 C100 142 200 142 196 206" fill="none" stroke="${fill}" stroke-width="8" stroke-linecap="round"/>`);
    parts.push('<rect x="93" y="194" width="20" height="36" rx="10"/>', '<rect x="187" y="194" width="20" height="36" rx="10"/>');
  }
  if (p.mic) {
    parts.push(`<path d="M214 412 L206 270 L190 244" stroke="${fill}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
    parts.push('<ellipse cx="186" cy="238" rx="8" ry="13" transform="rotate(-38 186 238)"/>');
  }
  const flip = p.key === 1 && p.profile ? ` translate(300 0) scale(-1 1)` : '';
  const t = `translate(${p.x - 150 * p.scale} ${400 - 400 * p.scale}) scale(${p.scale}) rotate(${p.tilt} 150 300)${flip}`;
  return `<g transform="${t}" fill="${fill}" ${extra}>${parts.join('')}</g>`;
}

function grain(id: string, opacity = 0.16): { defs: string; layer: string } {
  return {
    defs: `<filter id="${id}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="${opacity * 4}"/></feComponentTransfer></filter>`,
    layer: `<rect width="100%" height="100%" filter="url(#${id}g)" opacity="${opacity * 2.4}" style="mix-blend-mode:overlay"/>`,
  };
}

/**
 * Render an artist image.
 *  - `poster`: 3:4 tour-poster composition
 *  - `portrait`: square crop around the head (avatars)
 *  - `stage`: wide banner — light rig, haze and crowd with the artist on the right
 */
export function renderPortrait(seed: number, palette: [string, string, string], crop: PortraitCrop): string {
  const [bg, mid, hi] = palette;
  const r = mulberry32(seed);
  const p = pose(seed);
  const id = `p${(seed >>> 0).toString(36)}${crop[0]}`;
  const g = grain(id);

  if (crop === 'stage') {
    const W = 1600;
    const H = 600;
    const beams = Array.from({ length: 7 }, (_, i) => {
      const x = 120 + i * 230 + r() * 60;
      const spread = 90 + r() * 120;
      return `<path d="M${x} -20 L${x - spread} ${H} L${x + spread} ${H} Z" fill="url(#${id}beam)" opacity="${(0.25 + r() * 0.35).toFixed(2)}"/>`;
    }).join('');
    const crowd = Array.from({ length: 60 }, (_, i) => {
      const x = i * 28 + r() * 10;
      const h = 60 + r() * 40;
      const hand = r() < 0.25 ? `<path d="M${x + 6} ${H - h} L${x + 2 + r() * 10} ${H - h - 50 - r() * 30}" stroke="#000" stroke-width="7" stroke-linecap="round"/>` : '';
      return `<ellipse cx="${x}" cy="${H - h + 12}" rx="14" ry="17" fill="#000"/><rect x="${x - 22}" y="${H - h + 24}" width="44" height="${h}" rx="18" fill="#000"/>${hand}`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>
<linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
<linearGradient id="${id}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}" stop-opacity="0.9"/><stop offset="1" stop-color="${hi}" stop-opacity="0"/></linearGradient>
<filter id="${id}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
<filter id="${id}glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>${g.defs}</defs>
<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>
<g style="mix-blend-mode:screen">${beams}</g>
<g filter="url(#${id}blur)" opacity="0.55"><ellipse cx="${W * 0.3}" cy="${H * 0.55}" rx="420" ry="120" fill="${hi}"/><ellipse cx="${W * 0.75}" cy="${H * 0.35}" rx="320" ry="160" fill="${mid}"/></g>
<g transform="translate(${W - 640} 40) scale(1.45)">${figure(p, hi, `filter="url(#${id}glow)" opacity="0.8"`)}${figure(p, '#050505')}</g>
<g opacity="0.95">${crowd}</g>
<rect width="${W}" height="${H}" fill="url(#${id}sky)" opacity="0.15"/>${g.layer}</svg>`;
  }

  const view = crop === 'portrait' ? '40 96 220 220' : crop === 'cover' ? '0 60 300 300' : '0 0 300 400';
  const lx = p.key === -1 ? 0.12 : 0.88;
  const bokeh = Array.from({ length: 9 }, () => {
    const rr = 4 + r() * 16;
    return `<circle cx="${(r() * 300).toFixed(0)}" cy="${(r() * 240).toFixed(0)}" r="${rr.toFixed(1)}" fill="${r() < 0.5 ? hi : mid}" opacity="${(0.15 + r() * 0.35).toFixed(2)}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" preserveAspectRatio="xMidYMid slice"><defs>
<radialGradient id="${id}back" cx="${(p.x / 300).toFixed(2)}" cy="0.48" r="0.55"><stop offset="0" stop-color="${hi}" stop-opacity="0.85"/><stop offset="0.5" stop-color="${mid}" stop-opacity="0.55"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}key" cx="${lx}" cy="0.1" r="0.8"><stop offset="0" stop-color="${hi}" stop-opacity="0.55"/><stop offset="1" stop-color="${hi}" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}fig" x1="${p.key === -1 ? 0 : 1}" y1="0" x2="${p.key === -1 ? 1 : 0}" y2="0.4"><stop offset="0" stop-color="${mid}"/><stop offset="0.28" stop-color="#0b0b0d"/><stop offset="1" stop-color="#050506"/></linearGradient>
<linearGradient id="${id}floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></linearGradient>
<filter id="${id}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="${id}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="${id}rim" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>${g.defs}</defs>
<rect width="300" height="400" fill="${bg}"/>
<rect width="300" height="400" fill="url(#${id}key)"/>
<g filter="url(#${id}soft)">${bokeh}</g>
<ellipse cx="${p.x}" cy="200" rx="150" ry="170" fill="url(#${id}back)"/>
<g filter="url(#${id}blur)" opacity="0.45"><ellipse cx="${(40 + r() * 220).toFixed(0)}" cy="${(300 + r() * 60).toFixed(0)}" rx="140" ry="36" fill="${mid}"/></g>
${figure(p, hi, `filter="url(#${id}rim)" opacity="0.95" transform-origin="150 200"`)}
${figure(p, `url(#${id}fig)`)}
<rect width="300" height="400" fill="url(#${id}floor)"/>${g.layer}</svg>`;
}

/** Cinematic duotone lighting palettes for artist imagery: [shadow, haze, key light]. */
export const STAGE_PALETTES: [string, string, string][] = [
  ['#04080a', '#0f3d29', '#2ed573'],
  ['#08040f', '#4c1d95', '#e879f9'],
  ['#100404', '#7f1d1d', '#fb923c'],
  ['#020d16', '#0c4a6e', '#38bdf8'],
  ['#120c02', '#78350f', '#fbbf24'],
  ['#10030a', '#831843', '#f472b6'],
  ['#050505', '#27272a', '#f4f4f5'],
  ['#03100e', '#115e59', '#5eead4'],
  ['#09071c', '#3730a3', '#a5b4fc'],
];
