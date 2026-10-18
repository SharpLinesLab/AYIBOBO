import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useArtPalette } from '../../catalog/color';
import { genreById } from '../../catalog/genres';
import type { CoverSpec, Playlist, Track } from '../../catalog/types';
import { relativeTime } from '../../lib/format';
import { compact, useMusic } from '../../music';
import { Cover, LikeButton, PlayAll, RepostIcon } from './bits';
import { Verified } from './Cards';
import { ArtistLinks } from './TrackRow';
import { Waveform } from './Waveform';

/**
 * Artwork-coloured wash behind the top of the page (rendered into #page-tint-root so it spans the
 * full main column, under the transparent top bar).
 */
export function PageTint({ spec, color }: { spec?: CoverSpec; color?: string }) {
  const pal = useArtPalette(spec);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => setRoot(document.getElementById('page-tint-root')), []);
  if (!root) return null;
  return createPortal(<div className="page-tint" style={{ ['--tint' as string]: color ?? pal[0] }} aria-hidden />, root);
}

/** Compact bar with play + title that slides in once the page header scrolls out of view. */
export function StickyBar({ watch, title, tracks, spec }: { watch: RefObject<HTMLElement | null>; title: string; tracks: Track[]; spec: CoverSpec }) {
  const [show, setShow] = useState(false);
  const pal = useArtPalette(spec);
  useEffect(() => {
    const el = watch.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { rootMargin: '-120px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);
  return (
    <div className={`sticky-bar${show ? ' is-shown' : ''}`} style={{ ['--tint' as string]: pal[0] }} aria-hidden={!show} inert={!show}>
      <PlayAll tracks={tracks} size="sm" label={`Play ${title}`} />
      <span className="sticky-bar__title">{title}</span>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface Pick {
  key: string;
  title: string;
  href: string;
  spec: CoverSpec;
  tracks: Track[];
}

/** Time-of-day greeting with a compact grid of quick picks (recent + saved + top). Hover tints the page. */
export function QuickPicks({ onTint }: { onTint: (spec: CoverSpec | undefined) => void }) {
  const m = useMusic();
  const picks = useMemo(() => {
    const out: Pick[] = [];
    const seen = new Set<string>();
    const add = (p: Pick) => {
      if (!seen.has(p.key) && p.tracks.length) {
        seen.add(p.key);
        out.push(p);
      }
    };
    const liked = m.tracksOf(m.library.likes);
    if (liked.length) add({ key: 'liked', title: 'Liked Songs', href: '#/library/likes', spec: { template: 'type', palette: ['#1e1b4b', '#4338ca', '#a5b4fc'], seed: 4242, text: '♥' }, tracks: liked });
    for (const id of m.library.recents) {
      const t = m.track(id);
      if (!t) continue;
      const al = t.albumId ? m.album(t.albumId) : undefined;
      if (al) add({ key: al.id, title: al.title, href: `#/album/${al.id}`, spec: al.cover, tracks: m.tracksOf(al.trackIds) });
      else add({ key: t.id, title: t.title, href: `#/song/${t.id}`, spec: t.cover, tracks: [t] });
      if (out.length >= 4) break;
    }
    for (const p of m.catalog.playlists.filter((x) => x.id.startsWith('mix-')).slice(0, 2)) add(fromPlaylist(p, m.tracksOf(p.trackIds)));
    for (const p of m.catalog.playlists.filter((x) => x.editorial)) add(fromPlaylist(p, m.tracksOf(p.trackIds)));
    return out.slice(0, 8);
  }, [m]);

  return (
    <section className="qp" aria-labelledby="qp-title">
      <h2 id="qp-title" className="qp__hello">
        {greeting()}
      </h2>
      <div className="qp__grid">
        {picks.map((p) => (
          <div key={p.key} className="qp__tile" onMouseEnter={() => onTint(p.spec)} onMouseLeave={() => onTint(undefined)} onFocus={() => onTint(p.spec)}>
            <a href={p.href} className="qp__link">
              <Cover spec={p.spec} className="qp__art" />
              <span className="qp__title">{p.title}</span>
            </a>
            <span className="qp__play">
              <PlayAll tracks={p.tracks} size="sm" label={`Play ${p.title}`} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function fromPlaylist(p: Playlist, tracks: Track[]): Pick {
  return { key: p.id, title: p.title, href: `#/playlist/${p.id}`, spec: p.cover, tracks };
}

/** SoundCloud-style stream post: who posted, artwork, waveform you can scrub, social counts. */
export function StreamCard({ track, context }: { track: Track; context: Track[] }) {
  const m = useMusic();
  const artist = m.artist(track.artistId);
  const plays = m.totalPlays(track);
  const reposted = m.library.reposts.includes(track.id);
  const comments = (m.library.comments[track.id] ?? []).length + 2 + (track.recipe.seed % 5);
  return (
    <article className="stream">
      <a href={`#/song/${track.id}`} className="stream__art" aria-label={track.title}>
        <Cover spec={track.cover} />
      </a>
      <div className="stream__body">
        <div className="stream__who">
          {artist ? (
            <a href={`#/artist/${artist.id}`} className="stream__poster">
              <Cover spec={artist.avatar} size={24} round />
              {artist.name}
              {artist.verified && <Verified />}
            </a>
          ) : (
            <span className="stream__poster">{m.library.displayName || 'You'}</span>
          )}
          <span className="muted">posted a track · {relativeTime(track.releasedAt, m.now)}</span>
          <a className="tag stream__tag" href={`#/genres/${track.genre}`}>
            #{genreById(track.genre).label.toLowerCase().replace(/\s+/g, '')}
          </a>
        </div>
        <div className="stream__head">
          <PlayAll tracks={[track, ...context.filter((t) => t.id !== track.id)]} size="md" label={`Play ${track.title}`} />
          <div className="stream__titles">
            <a href={`#/song/${track.id}`} className="stream__title">
              {track.title}
            </a>
            <span className="stream__by">
              <ArtistLinks track={track} />
            </span>
          </div>
        </div>
        <Waveform track={track} context={context} height={58} />
        <div className="stream__actions">
          <LikeButton id={track.id} withLabel />
          <button className={`icon-toggle icon-toggle--label${reposted ? ' is-on' : ''}`} onClick={() => m.toggleRepost(track.id)} aria-pressed={reposted}>
            <RepostIcon /> <span>{reposted ? 'Reposted' : 'Repost'}</span>
          </button>
          <span className="stream__stat">▶ {compact(plays)}</span>
          <a className="stream__stat" href={`#/song/${track.id}`}>
            💬 {comments}
          </a>
        </div>
      </div>
    </article>
  );
}

/** Wrapper that keeps a ref for StickyBar observation. */
export function Watched({ children, refEl }: { children: ReactNode; refEl: RefObject<HTMLDivElement | null> }) {
  return <div ref={refEl}>{children}</div>;
}

export function useWatchRef() {
  return useRef<HTMLDivElement>(null);
}
