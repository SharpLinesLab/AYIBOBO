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

const line = (d: string | string[]) => (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    {(Array.isArray(d) ? d : [d]).map((x) => (
      <path key={x} d={x} />
    ))}
  </svg>
);

export const HomeIcon = line(['M3 10.5 12 3l9 7.5', 'M5 9.5V21h5v-6h4v6h5V9.5']);
export const FlameIcon = line('M12 22c4 0 7-2.7 7-6.8 0-4-3-6.6-4.3-9.7-.5 2.3-1.7 3.6-3 4.2C11.7 6.7 10.2 4 8.3 2.5 8.6 6 5 8.6 5 13.5 5 18.8 8 22 12 22Z');
export const ChartIcon = line(['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2']);
export const GridIcon = line(['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z']);
export const LibraryIcon = line(['M4 4v16', 'M9 4v16', 'M14 4l5 16']);
export const UploadIcon = line(['M12 16V4', 'M6 10l6-6 6 6', 'M4 20h16']);
export const TrophyIcon = line(['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0V4Z', 'M17 6h3a3 3 0 0 1-3 4', 'M7 6H4a3 3 0 0 0 3 4']);
export const HeartLine = line('M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.7 1.2-1.6 2.8-2.7 4.8-2.7 3.6 0 5.8 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z');
export const ClockIcon = line(['M12 7v5l3 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z']);
export const ListIcon = line(['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01']);
export const UsersIcon = line(['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8']);
export const ShuffleIcon = line(['M16 3h5v5', 'M4 20 21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5']);
export const RepeatIcon = line(['M17 2l4 4-4 4', 'M3 11V9a3 3 0 0 1 3-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 0 1-3 3H3']);
export const QueueIcon = line(['M3 6h12', 'M3 12h12', 'M3 18h8', 'M17 14v7', 'M21 17l-4-3']);
export const ExpandIcon = line(['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7']);
export const CollapseIcon = line('m6 9 6 6 6-6');
export const MoonSleepIcon = line(['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z', 'M16 3h4l-4 4h4']);
export const VolumeIcon = line(['M11 5 6 9H2v6h4l5 4V5Z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14']);
export const DownloadIcon = line(['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14']);
export const GearIcon = line([
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
]);
export const StudioIcon = line(['M3 3v18h18', 'M7 15l4-4 3 3 6-7']);
export const MuteIcon = line(['M11 5 6 9H2v6h4l5 4V5Z', 'M23 9l-6 6', 'M17 9l6 6']);

export const PrevIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M6 5h2v14H6zM9.5 12 19 5v14z" />
  </svg>
);

export const NextIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M16 5h2v14h-2zM14.5 12 5 19V5z" />
  </svg>
);
