/**
 * Artwork colors for tinted page headers, sticky bars and the Now Playing backdrop.
 * Generated covers know their palette; real images are sampled once on a tiny canvas.
 */
import { useEffect, useState } from 'react';
import type { CoverSpec } from './types';

const cache = new Map<string, string[]>();

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

function parse(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lift very dark colors so a tint is still visible on a near-black page. */
function vivid(h: string): string {
  const [r, g, b] = parse(h);
  const max = Math.max(r, g, b);
  if (max >= 70) return h;
  const k = 90 / Math.max(1, max);
  return hex(r * k, g * k, b * k);
}

/** [primary, secondary, highlight] for a cover, synchronously when possible. */
export function paletteOf(spec: CoverSpec): string[] {
  if (spec.imageUrl && cache.has(spec.imageUrl)) return cache.get(spec.imageUrl)!;
  const [bg, mid, hi] = spec.palette;
  return [vivid(mid), vivid(bg), hi];
}

/** Sample a real image: saturation-weighted average plus the brightest and darkest buckets. */
function sample(url: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, w = 0;
        let light = [0, 0, 0, -1];
        let dark = [0, 0, 0, 999];
        for (let i = 0; i < d.length; i += 4) {
          const [R, G, B] = [d[i], d[i + 1], d[i + 2]];
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          const sat = mx ? (mx - mn) / mx : 0;
          const weight = 0.15 + sat * sat;
          r += R * weight; g += G * weight; b += B * weight; w += weight;
          const l = R + G + B;
          if (l > light[3]) light = [R, G, B, l];
          if (l < dark[3]) dark = [R, G, B, l];
        }
        resolve([vivid(hex(r / w, g / w, b / w)), vivid(hex(dark[0], dark[1], dark[2])), hex(light[0], light[1], light[2])]);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function useArtPalette(spec: CoverSpec | undefined): string[] {
  const [p, setP] = useState(() => (spec ? paletteOf(spec) : ['#1f2937', '#111827', '#9ca3af']));
  const url = spec?.imageUrl;
  const key = spec ? `${spec.palette.join()}|${url ?? ''}` : '';
  useEffect(() => {
    if (!spec) return;
    setP(paletteOf(spec));
    if (!url || cache.has(url)) return;
    let live = true;
    sample(url)
      .then((pal) => {
        cache.set(url, pal);
        if (live) setP(pal);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key]);
  return p;
}
