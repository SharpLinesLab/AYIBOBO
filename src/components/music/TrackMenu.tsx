import { openShare } from './Share';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../../catalog/types';
import { useMusic } from '../../music';
import { addToQueue, playNext } from '../../player/engine';
import { useApp } from '../../store';

export function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** "⋯" menu: play next, queue, add to playlist, repost, share, go to artist/album. */
export function TrackMenu({ track, playlistId }: { track: Track; playlistId?: string }) {
  const m = useMusic();
  const { toast, navigate } = useApp();
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<'main' | 'playlists'>('main');
  const [newName, setNewName] = useState('');
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = 240;
    const h = menu.current?.offsetHeight ?? 300;
    const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    setPos({ top, left: Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w)) });
  }, [open, sub]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const done = (msg: string) => {
    setOpen(false);
    setSub('main');
    toast(msg);
  };
  const owned = m.library.playlists;
  const reposted = m.library.reposts.includes(track.id);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="icon-toggle"
        aria-label={`More options for ${track.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          setSub('main');
        }}
      >
        <MoreIcon />
      </button>
      {open &&
        createPortal(
          <div className="menu" role="menu" ref={menu} style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
            {sub === 'main' ? (
              <>
                <button role="menuitem" onClick={() => (playNext(m.toPlayable(track)), done('Playing next'))}>
                  Play next
                </button>
                <button role="menuitem" onClick={() => (addToQueue(m.toPlayable(track)), done('Added to queue'))}>
                  Add to queue
                </button>
                <button role="menuitem" onClick={() => setSub('playlists')}>
                  Add to playlist <span aria-hidden>›</span>
                </button>
                {playlistId && (
                  <button role="menuitem" onClick={() => (m.removeFromPlaylist(playlistId, track.id), done('Removed from playlist'))}>
                    Remove from this playlist
                  </button>
                )}
                <hr />
                <button role="menuitem" onClick={() => (m.toggleRepost(track.id), done(reposted ? 'Repost removed' : 'Reposted to your profile'))}>
                  {reposted ? 'Undo repost' : 'Repost'}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    openShare({ kind: 'Song', title: track.title, subtitle: m.artistNames(track), cover: track.cover, href: `#/song/${track.id}`, trackId: track.id, peaks: m.peaks(track) });
                  }}
                >
                  Share
                </button>
                <hr />
                {m.artist(track.artistId) && (
                  <button role="menuitem" onClick={() => (setOpen(false), navigate(`#/artist/${track.artistId}`))}>
                    Go to artist
                  </button>
                )}
                {track.albumId && (
                  <button role="menuitem" onClick={() => (setOpen(false), navigate(`#/album/${track.albumId}`))}>
                    Go to album
                  </button>
                )}
                <button role="menuitem" onClick={() => (setOpen(false), navigate(`#/song/${track.id}`))}>
                  Song details
                </button>
              </>
            ) : (
              <>
                <button role="menuitem" className="menu__back" onClick={() => setSub('main')}>
                  ‹ Back
                </button>
                <form
                  className="menu__new"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const pl = m.createPlaylist(newName || 'My playlist', [track.id]);
                    setNewName('');
                    done(`Created “${pl.title}”`);
                  }}
                >
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist name" aria-label="New playlist name" autoFocus />
                  <button type="submit">Create</button>
                </form>
                {owned.length === 0 && <p className="menu__empty">No playlists yet.</p>}
                {owned.map((p) => (
                  <button
                    role="menuitem"
                    key={p.id}
                    disabled={p.trackIds.includes(track.id)}
                    onClick={() => (m.addToPlaylist(p.id, track.id), done(`Added to “${p.title}”`))}
                  >
                    {p.title}
                    {p.trackIds.includes(track.id) && <span className="menu__check">✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
