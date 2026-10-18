import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { searchCatalog } from '../../catalog/search';
import type { CoverSpec } from '../../catalog/types';
import { useMusic, usePlayerState } from '../../music';
import * as player from '../../player/engine';
import { useApp } from '../../store';
import { Cover } from '../music/bits';
import { SearchIcon } from '../icons';

interface Action {
  id: string;
  label: string;
  group: 'Playback' | 'Go to' | 'App';
  hint?: string;
  keywords?: string;
  run: () => void;
  when?: boolean;
}

/**
 * ⌘K / Ctrl+K command palette: jump to any song, artist, album or playlist, or run an action
 * (play liked songs, sleep timer, theme, settings…) without leaving the keyboard.
 */
export function CommandPalette({
  open,
  setOpen,
  onToggleTheme,
  onLyrics,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onToggleTheme: () => void;
  onLyrics: () => void;
}) {
  const m = useMusic();
  const s = usePlayerState();
  const { navigate, toast } = useApp();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const res = useMemo(() => searchCatalog(m.catalog, q, 5), [m.catalog, q]);
  const liked = m.tracksOf(m.library.likes);

  const close = () => setOpen(false);
  const go = (href: string) => {
    close();
    navigate(href);
  };
  const actions: Action[] = [
    { id: 'toggle', group: 'Playback', label: s.playing ? 'Pause' : 'Play', hint: 'Space', run: () => player.toggle(), when: !!s.current },
    { id: 'next', group: 'Playback', label: 'Next song', hint: '⇧→', run: () => player.next(), when: !!s.current },
    { id: 'prev', group: 'Playback', label: 'Previous song', hint: '⇧←', run: () => player.prev(), when: !!s.current },
    { id: 'liked', group: 'Playback', label: 'Play liked songs', keywords: 'favorites hearts', run: () => m.play(liked), when: liked.length > 0 },
    {
      id: 'shuffle-liked',
      group: 'Playback',
      label: 'Shuffle liked songs',
      run: () => {
        if (!player.getState().shuffle) player.toggleShuffle();
        m.play(liked, Math.floor(Math.random() * liked.length));
      },
      when: liked.length > 1,
    },
    { id: 'shuffle', group: 'Playback', label: s.shuffle ? 'Turn shuffle off' : 'Turn shuffle on', run: () => player.toggleShuffle(), when: !!s.current },
    { id: 'lyrics', group: 'Playback', label: 'Show lyrics', keywords: 'words karaoke', run: onLyrics, when: !!s.current },
    { id: 'sleep', group: 'Playback', label: 'Sleep timer: 30 minutes', keywords: 'stop pause timer', run: () => (player.setSleepTimer(30), toast('Music stops in 30 minutes')), when: !!s.current },
    { id: 'mute', group: 'Playback', label: s.muted ? 'Unmute' : 'Mute', hint: 'M', run: () => player.toggleMute(), when: !!s.current },
    { id: 'home', group: 'Go to', label: 'Discover', run: () => go('#/') },
    { id: 'trending', group: 'Go to', label: 'Trending', run: () => go('#/trending') },
    { id: 'charts', group: 'Go to', label: 'Top charts', run: () => go('#/charts') },
    { id: 'genres', group: 'Go to', label: 'Genres', run: () => go('#/genres') },
    { id: 'likes', group: 'Go to', label: 'Liked songs', run: () => go('#/library/likes') },
    { id: 'downloads', group: 'Go to', label: 'Downloads', keywords: 'offline', run: () => go('#/library/downloads') },
    { id: 'studio', group: 'Go to', label: 'Artist Studio', keywords: 'stats analytics dashboard', run: () => go('#/studio') },
    { id: 'upload', group: 'Go to', label: 'Upload music', run: () => go('#/upload') },
    { id: 'boost', group: 'Go to', label: 'Boost Board', keywords: 'leaderboard rank', run: () => go('#/leaderboard') },
    { id: 'settings', group: 'App', label: 'Settings', keywords: 'crossfade equalizer sound preferences', run: () => go('#/settings') },
    { id: 'theme', group: 'App', label: 'Switch light / dark theme', keywords: 'mode appearance', run: onToggleTheme },
  ];
  const needle = q.trim().toLowerCase();
  const shown = actions.filter((a) => a.when !== false && (!needle || `${a.label} ${a.keywords ?? ''}`.toLowerCase().includes(needle)));
  const groups = (['Playback', 'Go to', 'App'] as const).map((g) => [g, shown.filter((a) => a.group === g)] as const);

  const entity = (key: string, title: string, sub: string, cover: CoverSpec, href: string, round = false) => (
    <Command.Item key={key} value={key} onSelect={() => go(href)} className="cmdk__item">
      <Cover spec={cover} size={36} round={round} />
      <span className="cmdk__text">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </Command.Item>
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter={false}
      overlayClassName="cmdk__overlay"
      contentClassName="cmdk__panel"
      loop
    >
      <div className="cmdk__input">
        <SearchIcon width={18} height={18} aria-hidden />
        <Command.Input value={q} onValueChange={setQ} placeholder="Search music or type a command…" />
        <kbd>esc</kbd>
      </div>
      <Command.List className="cmdk__list">
        <Command.Empty className="cmdk__empty">No results for “{q}”.</Command.Empty>
        {res.tracks.length > 0 && (
          <Command.Group heading="Songs" className="cmdk__group">
            {res.tracks.map((t) => (
              <Command.Item
                key={t.id}
                value={t.id}
                className="cmdk__item"
                onSelect={() => {
                  close();
                  m.play([t, ...res.tracks.filter((x) => x.id !== t.id)]);
                }}
              >
                <Cover spec={t.cover} size={36} />
                <span className="cmdk__text">
                  <b>{t.title}</b>
                  <small>Song · {m.artistNames(t)}</small>
                </span>
                <span className="cmdk__hint">Play</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {res.artists.length > 0 && (
          <Command.Group heading="Artists" className="cmdk__group">
            {res.artists.map((a) => entity(a.id, a.name, 'Artist', a.avatar, `#/artist/${a.id}`, true))}
          </Command.Group>
        )}
        {res.albums.length > 0 && (
          <Command.Group heading="Albums" className="cmdk__group">
            {res.albums.map((a) => entity(a.id, a.title, `Album · ${m.artist(a.artistId)?.name ?? ''}`, a.cover, `#/album/${a.id}`))}
          </Command.Group>
        )}
        {res.playlists.length > 0 && (
          <Command.Group heading="Playlists" className="cmdk__group">
            {res.playlists.map((p) => entity(p.id, p.title, `Playlist · ${p.curator}`, p.cover, `#/playlist/${p.id}`))}
          </Command.Group>
        )}
        {groups.map(
          ([g, list]) =>
            list.length > 0 && (
              <Command.Group key={g} heading={g} className="cmdk__group">
                {list.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`action-${a.id}`}
                    className="cmdk__item cmdk__item--action"
                    onSelect={() => {
                      close();
                      a.run();
                    }}
                  >
                    <span className="cmdk__text">
                      <b>{a.label}</b>
                    </span>
                    {a.hint && <kbd>{a.hint}</kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            ),
        )}
        {needle && (
          <Command.Item value="search-all" className="cmdk__item cmdk__item--action" onSelect={() => go(`#/search/${encodeURIComponent(q.trim())}`)}>
            <span className="cmdk__text">
              <b>See all results for “{q.trim()}”</b>
            </span>
            <kbd>↵</kbd>
          </Command.Item>
        )}
      </Command.List>
      <div className="cmdk__foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to move
        </span>
        <span>
          <kbd>↵</kbd> to open
        </span>
        <span>
          <kbd>⌘</kbd>
          <kbd>K</kbd> to toggle
        </span>
      </div>
    </Command.Dialog>
  );
}

