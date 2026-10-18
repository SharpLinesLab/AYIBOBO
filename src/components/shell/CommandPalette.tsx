import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchCatalog } from '../../catalog/search';
import type { CoverSpec } from '../../catalog/types';
import { LANGS, setLang, t, useLang } from '../../i18n';
import { useMusic, usePlayerState } from '../../music';
import * as player from '../../player/engine';
import { useApp } from '../../store';
import { Cover } from '../music/bits';
import { SearchIcon } from '../icons';

type Group = 'playback' | 'goto' | 'app' | 'lang';

interface Action {
  id: string;
  label: string;
  group: Group;
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
  const lang = useLang();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) {
      setQ('');
      return;
    }
    // Modal behaviour: lock page scroll and return focus to where it was on close.
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const res = useMemo(() => searchCatalog(m.catalog, q, 5), [m.catalog, q]);
  const liked = m.tracksOf(m.library.likes);

  const close = () => setOpen(false);
  const go = (href: string) => {
    close();
    navigate(href);
  };
  // Labels are translated; keywords stay in English (plus the English label) so English typing still works.
  const actions: Action[] = [
    { id: 'toggle', group: 'playback', label: t(s.playing ? 'common.action.pause' : 'common.action.play'), keywords: 'play pause', hint: t('player.cmd.space'), run: () => player.toggle(), when: !!s.current },
    { id: 'next', group: 'playback', label: t('player.cmd.nextSong'), keywords: 'next song skip', hint: '⇧→', run: () => player.next(), when: !!s.current },
    { id: 'prev', group: 'playback', label: t('player.cmd.prevSong'), keywords: 'previous song back', hint: '⇧←', run: () => player.prev(), when: !!s.current },
    { id: 'liked', group: 'playback', label: t('player.cmd.playLiked'), keywords: 'play liked songs favorites hearts', run: () => m.play(liked), when: liked.length > 0 },
    {
      id: 'shuffle-liked',
      group: 'playback',
      label: t('player.cmd.shuffleLiked'),
      keywords: 'shuffle liked songs',
      run: () => {
        if (!player.getState().shuffle) player.toggleShuffle();
        m.play(liked, Math.floor(Math.random() * liked.length));
      },
      when: liked.length > 1,
    },
    { id: 'shuffle', group: 'playback', label: t(s.shuffle ? 'player.cmd.shuffleOff' : 'player.cmd.shuffleOn'), keywords: s.shuffle ? 'turn shuffle off' : 'turn shuffle on', run: () => player.toggleShuffle(), when: !!s.current },
    { id: 'lyrics', group: 'playback', label: t('player.cmd.showLyrics'), keywords: 'show lyrics words karaoke', run: onLyrics, when: !!s.current },
    { id: 'sleep', group: 'playback', label: t('player.cmd.sleep30'), keywords: 'sleep timer 30 minutes stop pause', run: () => (player.setSleepTimer(30), toast(t('player.cmd.sleepToast'))), when: !!s.current },
    { id: 'mute', group: 'playback', label: t(s.muted ? 'player.unmute' : 'player.mute'), keywords: s.muted ? 'unmute sound' : 'mute sound', hint: 'M', run: () => player.toggleMute(), when: !!s.current },
    { id: 'home', group: 'goto', label: t('common.nav.discover'), keywords: 'discover home', run: () => go('#/') },
    { id: 'trending', group: 'goto', label: t('common.nav.trending'), keywords: 'trending', run: () => go('#/trending') },
    { id: 'charts', group: 'goto', label: t('common.nav.charts'), keywords: 'top charts', run: () => go('#/charts') },
    { id: 'genres', group: 'goto', label: t('common.nav.genres'), keywords: 'genres', run: () => go('#/genres') },
    { id: 'likes', group: 'goto', label: t('common.nav.likes'), keywords: 'liked songs favorites', run: () => go('#/library/likes') },
    { id: 'downloads', group: 'goto', label: t('common.nav.downloads'), keywords: 'downloads offline', run: () => go('#/library/downloads') },
    { id: 'studio', group: 'goto', label: t('common.nav.studio'), keywords: 'artist studio stats analytics dashboard', run: () => go('#/studio') },
    { id: 'upload', group: 'goto', label: t('common.nav.uploadMusic'), keywords: 'upload music', run: () => go('#/upload') },
    { id: 'settings', group: 'app', label: t('common.nav.settings'), keywords: 'settings crossfade equalizer sound preferences', run: () => go('#/settings') },
    { id: 'theme', group: 'app', label: t('player.cmd.theme'), keywords: 'switch light dark theme mode appearance', run: onToggleTheme },
    // Language names stay in their own language.
    ...LANGS.map(
      (l): Action => ({
        id: `lang-${l.id}`,
        group: 'lang',
        label: l.label,
        keywords: `change language langue lang ${l.english} ${l.id}`,
        hint: l.id === lang ? '✓' : undefined,
        run: () => void setLang(l.id),
      }),
    ),
  ];
  const needle = q.trim().toLowerCase();
  const shown = actions.filter((a) => a.when !== false && (!needle || `${a.label} ${a.keywords ?? ''}`.toLowerCase().includes(needle)));
  const groups = (['playback', 'goto', 'app', 'lang'] as const).map((g) => [g, shown.filter((a) => a.group === g)] as const);
  const groupName: Record<Group, string> = {
    playback: t('player.cmd.group.playback'),
    goto: t('player.cmd.group.goto'),
    app: t('player.cmd.group.app'),
    lang: t('common.lang.switch'),
  };

  const entity = (key: string, title: string, sub: string, cover: CoverSpec, href: string, round = false) => (
    <Command.Item key={key} value={key} onSelect={() => go(href)} className="cmdk__item">
      <Cover spec={cover} size={36} round={round} />
      <span className="cmdk__text">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </Command.Item>
  );

  if (!open) return null;
  // Our own overlay rather than cmdk's Command.Dialog: its scroll lock injects a <style> element,
  // which the Content-Security-Policy (no inline styles) would block.
  return createPortal(
    <div className="cmdk__overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <Command
        label={t('player.cmd.label')}
        shouldFilter={false}
        loop
        className="cmdk__panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('player.cmd.label')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
          } else if (e.key === 'Tab') e.preventDefault(); // keep focus in the search field
        }}
      >
        <div className="cmdk__input">
          <SearchIcon width={18} height={18} aria-hidden />
          <Command.Input value={q} onValueChange={setQ} placeholder={t('player.cmd.placeholder')} autoFocus />
          <kbd>esc</kbd>
        </div>
        <Command.List className="cmdk__list">
          <Command.Empty className="cmdk__empty">{t('player.cmd.empty', { q })}</Command.Empty>
          {res.tracks.length > 0 && (
            <Command.Group heading={t('player.cmd.songs')} className="cmdk__group">
              {res.tracks.map((tr) => (
                <Command.Item
                  key={tr.id}
                  value={tr.id}
                  className="cmdk__item"
                  onSelect={() => {
                    close();
                    m.play([tr, ...res.tracks.filter((x) => x.id !== tr.id)]);
                  }}
                >
                  <Cover spec={tr.cover} size={36} />
                  <span className="cmdk__text">
                    <b>{tr.title}</b>
                    <small>
                      {t('common.kind.song')} · {m.artistNames(tr)}
                    </small>
                  </span>
                  <span className="cmdk__hint">{t('common.action.play')}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {res.artists.length > 0 && (
            <Command.Group heading={t('player.cmd.artists')} className="cmdk__group">
              {res.artists.map((a) => entity(a.id, a.name, t('common.kind.artist'), a.avatar, `#/artist/${a.id}`, true))}
            </Command.Group>
          )}
          {res.albums.length > 0 && (
            <Command.Group heading={t('player.cmd.albums')} className="cmdk__group">
              {res.albums.map((a) => entity(a.id, a.title, `${t('common.kind.album')} · ${m.artist(a.artistId)?.name ?? ''}`, a.cover, `#/album/${a.id}`))}
            </Command.Group>
          )}
          {res.playlists.length > 0 && (
            <Command.Group heading={t('player.cmd.playlists')} className="cmdk__group">
              {res.playlists.map((p) => entity(p.id, p.title, `${t('common.kind.playlist')} · ${p.curator}`, p.cover, `#/playlist/${p.id}`))}
            </Command.Group>
          )}
          {groups.map(
            ([g, list]) =>
              list.length > 0 && (
                <Command.Group key={g} heading={groupName[g]} className="cmdk__group">
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
                <b>{t('player.cmd.seeAll', { q: q.trim() })}</b>
              </span>
              <kbd>↵</kbd>
            </Command.Item>
          )}
        </Command.List>
        <div className="cmdk__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t('player.cmd.toMove')}
          </span>
          <span>
            <kbd>↵</kbd> {t('player.cmd.toOpen')}
          </span>
          <span>
            <kbd>⌘</kbd>
            <kbd>K</kbd> {t('player.cmd.toToggle')}
          </span>
        </div>
      </Command>
    </div>,
    document.body,
  );
}

