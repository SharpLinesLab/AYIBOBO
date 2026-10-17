import type { SVGProps } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const MinusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} strokeWidth={3} {...p}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} strokeWidth={3} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 10 10" aria-hidden {...p}>
    <path d="M2 1.2v7.6L8.6 5z" fill="currentColor" />
  </svg>
);

export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 10 10" aria-hidden {...p}>
    <rect x="1.8" y="1.2" width="2.3" height="7.6" rx="0.6" fill="currentColor" />
    <rect x="5.9" y="1.2" width="2.3" height="7.6" rx="0.6" fill="currentColor" />
  </svg>
);

export const WaveGlobeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M7 12h1.5l1.5-4 2 8 2-6 1.5 2H17" />
  </svg>
);

export const ArrowUpRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export const ChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const ChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/** ASF — Ayiti Sakap Fet wordmark (bold italic "ASF" over a boxed tagline). */
export function AsfLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`asf-logo${compact ? ' asf-logo--compact' : ''}`} aria-hidden>
      <span className="asf-logo__mark">
        A<span className="asf-logo__s">S</span>F
      </span>
      {!compact && <span className="asf-logo__sub">AYITI SAKAP FET</span>}
    </span>
  );
}

const brand = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true };

export const FacebookIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...brand} {...p}>
    <path d="M12 2a10 10 0 0 0-1.56 19.88v-7H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v7A10 10 0 0 0 12 2Z" />
  </svg>
);

export const InstagramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const YoutubeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...brand} {...p}>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z" />
  </svg>
);

export const XIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...brand} {...p}>
    <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77Zm-1.08 16.18h1.7L7.4 4.73H5.58Z" />
  </svg>
);

export const ShareIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...brand} {...p}>
    <path d="M14 4v4C7 9 4 14 3 19c2.5-3.5 6-5.1 11-5.1V18l7-7Z" />
  </svg>
);
