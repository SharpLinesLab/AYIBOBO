import { useEffect, useMemo, useRef, useState } from 'react';
import { activeLine, lyricsFor, parseLyrics, toLrc, type LyricLine } from '../../catalog/lyrics';
import type { Track } from '../../catalog/types';
import { fmtTime, useMusic, usePlayerState } from '../../music';
import { getPosition, pause, resume, seek, subscribePosition } from '../../player/engine';
import { Modal } from '../Modal';
import { plural, t } from '../../i18n';

/** Render a translated sentence with a bold button name in place of `{button}`. */
function withButton(text: string, button: string) {
  const [before, after = ''] = text.split('{button}');
  return (
    <>
      {before}
      <b>{button}</b>
      {after}
    </>
  );
}

/** Index of the line being sung, updated only when it changes (not every frame). */
function useActiveIndex(lines: LyricLine[], enabled: boolean): number {
  const [idx, setIdx] = useState(-1);
  useEffect(() => {
    if (!enabled) {
      setIdx(-1);
      return;
    }
    return subscribePosition((pos) => {
      const i = activeLine(lines, pos);
      setIdx((prev) => (prev === i ? prev : i));
    });
  }, [lines, enabled]);
  return idx;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Time-synced lyrics. `full` (Now Playing) and `card` (side panel) scroll the sung line into view;
 * `page` (song page) only highlights. Clicking a synced line plays from there.
 */
export function LyricsView({ track, variant }: { track: Track; variant: 'full' | 'card' | 'page' }) {
  const m = useMusic();
  const s = usePlayerState();
  const lyrics = useMemo(() => lyricsFor(track), [track]);
  const isCurrent = s.current?.id === track.id;
  const synced = !!lyrics?.synced;
  const idx = useActiveIndex(lyrics?.lines ?? [], isCurrent && synced);
  const box = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(0);

  useEffect(() => {
    if (variant === 'page' || idx < 0 || !box.current) return;
    if (Date.now() - userScrolled.current < 3500) return;
    const el = box.current.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    if (!el) return;
    const top = el.offsetTop - box.current.clientHeight * (variant === 'card' ? 0.3 : 0.36);
    box.current.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [idx, variant]);

  if (!lyrics) {
    return (
      <div className={`lyr lyr--${variant} lyr--empty`}>
        <p className="muted">{track.uploaded ? t('pages.lyrics.noneUploaded') : t('pages.lyrics.instrumental')}</p>
      </div>
    );
  }

  const playFrom = (at: number | null) => {
    if (at === null) return;
    if (isCurrent) {
      seek(at);
      if (!s.playing) resume();
    } else m.play([track], 0, at);
  };
  const markUser = () => (userScrolled.current = Date.now());

  return (
    <div
      className={`lyr lyr--${variant}${synced ? ' is-synced' : ''}${isCurrent && idx >= 0 ? ' is-live' : ''}`}
      ref={box}
      onWheel={markUser}
      onTouchMove={markUser}
      onKeyDown={markUser}
      tabIndex={variant === 'page' ? undefined : 0}
      aria-label={variant === 'page' ? undefined : t('pages.lyrics.regionLabel', { name: track.title })}
      role={variant === 'page' ? undefined : 'region'}
    >
      {!synced && <p className="lyr__note">{t('pages.lyrics.notSynced')}</p>}
      {lyrics.lines.map((l, i) => {
        const state = !isCurrent || !synced ? '' : i === idx ? ' is-active' : i < idx ? ' is-past' : '';
        return (
          <p
            key={i}
            data-i={i}
            className={`lyr__line${state}${l.text ? '' : ' lyr__line--gap'}${synced ? ' is-clickable' : ''}`}
            aria-current={i === idx && isCurrent ? 'true' : undefined}
            onClick={() => playFrom(l.time)}
          >
            {l.text || (
              <span className="lyr__dots" role="img" aria-label={t('pages.lyrics.instrumentalBreak')}>
                <i />
                <i />
                <i />
              </span>
            )}
          </p>
        );
      })}
      {lyrics.source === 'lrc' && track.uploaded && <p className="lyr__credit">{t('pages.lyrics.syncedByArtist')}</p>}
    </div>
  );
}

export function hasLyrics(track: Track): boolean {
  return !!lyricsFor(track);
}

/**
 * Lyrics editor for your uploads: paste plain text or LRC, then tap along while the song plays
 * to timestamp each line (Space / Tap = next line, Backspace = undo).
 */
export function LyricsEditor({ track, onClose }: { track: Track; onClose: () => void }) {
  const m = useMusic();
  const [text, setText] = useState(track.lyrics ?? '');
  const [syncing, setSyncing] = useState(false);
  const [stamps, setStamps] = useState<number[]>([]);
  const lines = useMemo(() => (parseLyrics(text)?.lines ?? []).map((l) => l.text).filter(Boolean), [text]);
  const parsed = parseLyrics(text);

  const tap = () => setStamps((st) => (st.length < lines.length ? [...st, Math.round(getPosition() * 100) / 100] : st));
  const finish = (all: number[]) => {
    pause();
    setSyncing(false);
    if (all.length) setText(toLrc(lines.slice(0, all.length).map((line, i) => ({ text: line, time: all[i] }))) + (all.length < lines.length ? `\n${lines.slice(all.length).join('\n')}` : ''));
  };
  const startSync = () => {
    setStamps([]);
    setSyncing(true);
    m.play([track], 0, 0);
  };

  useEffect(() => {
    if (!syncing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        tap();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setStamps((st) => st.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  useEffect(() => {
    if (syncing && stamps.length === lines.length && lines.length) finish(stamps);
  }, [stamps, syncing, lines.length]);

  return (
    <Modal onClose={onClose} label={t('pages.lyrics.edit')} wide>
      <div className="lyred">
        <h2>{t('pages.lyrics.titleFor', { name: track.title })}</h2>
        {!syncing ? (
          <>
            <p className="muted">{withButton(t('pages.lyrics.editHint'), t('pages.lyrics.sync'))}</p>
            <textarea
              className="input lyred__text"
              rows={14}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('pages.lyrics.placeholder')}
              aria-label={t('pages.lyrics.title')}
              data-autofocus
            />
            <p className="muted lyred__status">
              {parsed ? (parsed.synced ? plural('pages.lyrics.statusSynced', parsed.lines.length) : plural('pages.lyrics.statusUnsynced', lines.length)) : t('pages.lyrics.none')}
            </p>
            <div className="row lyred__actions">
              <button className="btn-glass" onClick={startSync} disabled={!lines.length || !track.audioUrl}>
                {t('pages.lyrics.sync')}
              </button>
              <span className="grow" />
              <button className="btn-glass" onClick={onClose}>
                {t('common.action.cancel')}
              </button>
              <button
                className="btn-accent"
                onClick={() => {
                  m.setLyrics(track.id, text);
                  onClose();
                }}
              >
                {t('pages.lyrics.save')}
              </button>
            </div>
          </>
        ) : (
          <div className="lyred__sync">
            <p className="muted">
              {withButton(t('pages.lyrics.tapHint'), t('pages.lyrics.nextLine'))} {stamps.length}/{lines.length}
            </p>
            <ol className="lyred__lines">
              {lines.map((l, i) => (
                <li key={i} className={i === stamps.length ? 'is-next' : i < stamps.length ? 'is-done' : ''}>
                  <span className="num">{stamps[i] !== undefined ? fmtTime(stamps[i]) : '–:––'}</span> {l}
                </li>
              ))}
            </ol>
            <div className="row lyred__actions">
              <button className="btn-glass" onClick={() => setStamps((st) => st.slice(0, -1))} disabled={!stamps.length}>
                {t('pages.lyrics.undo')}
              </button>
              <span className="grow" />
              <button className="btn-glass" onClick={() => finish(stamps)}>
                {t('pages.lyrics.stop')}
              </button>
              {/* Keyboard Space is handled above; ignore the synthetic click it would also fire. */}
              <button className="btn-accent btn-lg" onClick={(e) => e.detail > 0 && tap()}>
                {t('pages.lyrics.nextLine')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
