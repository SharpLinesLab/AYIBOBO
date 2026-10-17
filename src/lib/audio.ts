/**
 * Leaderboard preview helpers, backed by the global player engine (src/player/engine.ts).
 * Synth previews are 20-second loops in the listing's style; file previews play the real audio.
 */
import type { GenreId } from '../catalog/types';
import { getPosition, getState, pause, subscribe, subscribePosition, toggleItem, type Playable } from '../player/engine';
import type { Listing, SynthPreview } from './types';

export const PREVIEW_SECONDS = 20;

const STYLE_GENRE: Record<SynthPreview['style'], GenreId> = {
  arp: 'electronic',
  pad: 'rnb',
  beat: 'hip-hop',
  lofi: 'rnb',
  bass: 'drill',
  pluck: 'afrobeats',
};

interface PreviewState {
  playingId: string | null;
  progress: number;
}

export function previewPlayable(l: Listing): Playable | null {
  const p = l.preview;
  if (!p) return null;
  return {
    id: `preview:${l.id}`,
    title: l.title,
    subtitle: `${l.display} · preview`,
    duration: PREVIEW_SECONDS,
    preview: true,
    href: '#/leaderboard',
    source:
      p.kind === 'file'
        ? { kind: 'file', url: p.url }
        : { kind: 'synth', recipe: { genre: STYLE_GENRE[p.style], bpm: p.bpm, root: p.root, seed: p.seed, scale: 'minor', form: 'loop' } },
  };
}

function snapshot(): PreviewState {
  const s = getState();
  const id = s.playing && s.current?.id.startsWith('preview:') ? s.current.id.slice(8) : null;
  return { playingId: id, progress: id && s.current ? getPosition() / s.current.duration : 0 };
}

export function getPlayerState(): PreviewState {
  return snapshot();
}

export function subscribePlayer(l: (s: PreviewState) => void): () => void {
  const a = subscribe(() => l(snapshot()));
  const b = subscribePosition(() => {
    if (getState().current?.id.startsWith('preview:')) l(snapshot());
  });
  l(snapshot());
  return () => {
    a();
    b();
  };
}

export function togglePreview(l: Listing) {
  const item = previewPlayable(l);
  if (item) toggleItem(item);
}

export function stopPreview() {
  if (getState().current?.preview) pause();
}
