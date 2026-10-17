/**
 * Global audio player. One engine for everything that makes sound: full synthesized tracks
 * (streamed bar-by-bar), uploaded audio files and the leaderboard's short previews.
 *
 * Structural state (queue, current item, play/pause, modes) notifies `subscribe` listeners;
 * the play position notifies `subscribePosition` listeners on animation frames so only the
 * progress UI re-renders while playing.
 */
import type { SynthRecipe } from '../catalog/types';
import { barCount, barSeconds, renderBar } from './synth';

export type Source = { kind: 'synth'; recipe: SynthRecipe } | { kind: 'file'; url: string };

export interface Playable {
  id: string;
  title: string;
  subtitle: string;
  artwork?: string;
  duration: number;
  source: Source;
  /** In-app link for the title (e.g. `#/song/…`). */
  href?: string;
  subtitleHref?: string;
  /** Short previews are not added to "recently played". */
  preview?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  queue: Playable[];
  /** Index into `queue` of the current item. */
  index: number;
  current: Playable | null;
  playing: boolean;
  loading: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Minutes until the sleep timer pauses playback, or null. */
  sleepAt: number | null;
}

type Listener = (s: PlayerState) => void;
type PosListener = (position: number, duration: number) => void;

const PREFS_KEY = 'asf:player';

function loadPrefs(): Pick<PlayerState, 'volume' | 'muted' | 'shuffle' | 'repeat'> {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.85,
      muted: !!p.muted,
      shuffle: !!p.shuffle,
      repeat: p.repeat === 'all' || p.repeat === 'one' ? p.repeat : 'off',
    };
  } catch {
    return { volume: 0.85, muted: false, shuffle: false, repeat: 'off' };
  }
}

let state: PlayerState = { queue: [], index: -1, current: null, playing: false, loading: false, sleepAt: null, ...loadPrefs() };
const listeners = new Set<Listener>();
const posListeners = new Set<PosListener>();
const playListeners = new Set<(p: Playable) => void>();

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let bus: GainNode | null = null;
let audioEl: HTMLAudioElement | null = null;
let elSource: MediaElementAudioSourceNode | null = null;
let scheduler = 0;
let raf = 0;
let sleepTimer = 0;
/** Synth timeline: AudioContext time at which position 0 would have played. */
let trackT0 = 0;
let nextBar = 0;
let totalBars = 0;
/** Position while paused / for files. */
let pausedAt = 0;
/** Shuffle order (indices into queue), current item first. */
let order: number[] = [];
let token = 0;

function emit(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
  if ('volume' in patch || 'muted' in patch || 'shuffle' in patch || 'repeat' in patch) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ volume: state.volume, muted: state.muted, shuffle: state.shuffle, repeat: state.repeat }));
    } catch {
      /* ignore */
    }
  }
}

export function getState(): PlayerState {
  return state;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function subscribePosition(l: PosListener): () => void {
  posListeners.add(l);
  l(getPosition(), state.current?.duration ?? 0);
  return () => posListeners.delete(l);
}

/** Called once per item that actually starts playing (play counts, recents). */
export function onPlay(l: (p: Playable) => void): () => void {
  playListeners.add(l);
  return () => playListeners.delete(l);
}

export function getAnalyser(): AnalyserNode | null {
  return analyser;
}

function ensureContext(): AudioContext {
  if (ac) return ac;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ac = new AC({ latencyHint: 'playback' });
  master = ac.createGain();
  master.gain.value = state.muted ? 0 : state.volume;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  analyser = ac.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  master.connect(comp).connect(analyser).connect(ac.destination);
  return ac;
}

export function getPosition(): number {
  const cur = state.current;
  if (!cur) return 0;
  if (cur.source.kind === 'file') return audioEl?.currentTime ?? pausedAt;
  if (!state.playing || !ac) return pausedAt;
  return Math.min(cur.duration, Math.max(0, ac.currentTime - trackT0));
}

function tickPosition() {
  cancelAnimationFrame(raf);
  const loop = () => {
    const cur = state.current;
    if (!cur) return;
    const pos = getPosition();
    posListeners.forEach((l) => l(pos, cur.duration));
    if (cur.source.kind === 'synth' && state.playing && pos >= cur.duration - 0.02) {
      handleEnded();
      return;
    }
    if (state.playing) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function stopOutput() {
  clearInterval(scheduler);
  scheduler = 0;
  if (bus && ac) {
    const b = bus;
    b.gain.cancelScheduledValues(ac.currentTime);
    b.gain.setTargetAtTime(0, ac.currentTime, 0.03);
    setTimeout(() => b.disconnect(), 250);
    bus = null;
  }
  if (audioEl) audioEl.pause();
}

function startSynth(recipe: SynthRecipe, duration: number, from: number) {
  const ctx = ensureContext();
  bus = ctx.createGain();
  bus.connect(master!);
  const barDur = barSeconds(recipe);
  totalBars = barCount(recipe, duration);
  const startAt = ctx.currentTime + 0.06;
  trackT0 = startAt - from;
  nextBar = Math.floor(from / barDur);
  const myBus = bus;
  const schedule = () => {
    if (bus !== myBus || !ac) return;
    const horizon = ac.currentTime + 0.8;
    while (nextBar < totalBars && trackT0 + nextBar * barDur < horizon) {
      const t = trackT0 + nextBar * barDur;
      renderBar(ac, myBus, recipe, nextBar, totalBars, t, startAt);
      nextBar++;
    }
  };
  schedule();
  scheduler = window.setInterval(schedule, 120);
}

async function startFile(url: string, from: number, my: number) {
  const ctx = ensureContext();
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.crossOrigin = 'anonymous';
    elSource = ctx.createMediaElementSource(audioEl);
    elSource.connect(master!);
    audioEl.addEventListener('ended', () => handleEnded());
  }
  if (audioEl.src !== url) audioEl.src = url;
  audioEl.currentTime = from;
  emit({ loading: true });
  try {
    await audioEl.play();
  } catch {
    if (my === token) emit({ playing: false });
  } finally {
    if (my === token) emit({ loading: false });
  }
}

async function startCurrent(from = 0) {
  const cur = state.current;
  if (!cur) return;
  const my = ++token;
  stopOutput();
  const ctx = ensureContext();
  if (ctx.state === 'suspended') await ctx.resume();
  if (my !== token) return;
  pausedAt = from;
  if (cur.source.kind === 'synth') startSynth(cur.source.recipe, cur.duration, from);
  else await startFile(cur.source.url, from, my);
  emit({ playing: true });
  updateMediaSession();
  tickPosition();
}

function setCurrent(index: number) {
  const cur = state.queue[index] ?? null;
  emit({ index, current: cur });
  if (cur) playListeners.forEach((l) => l(cur));
}

function buildOrder(start: number) {
  const idx = state.queue.map((_, i) => i).filter((i) => i !== start);
  if (state.shuffle) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
  } else idx.sort((a, b) => a - b);
  order = state.shuffle ? [start, ...idx] : state.queue.map((_, i) => i);
}

/** Replace the queue and start playing `items[start]`. */
export function playQueue(items: Playable[], start = 0) {
  if (!items.length) return;
  emit({ queue: items });
  buildOrder(start);
  setCurrent(start);
  void startCurrent(0);
}

/** Play/pause toggle for a single item; plays it (as a one-item queue) if it isn't current. */
export function toggleItem(item: Playable, queue?: Playable[]) {
  if (state.current?.id === item.id) {
    toggle();
    return;
  }
  const q = queue ?? [item];
  playQueue(q, Math.max(0, q.findIndex((x) => x.id === item.id)));
}

export function toggle() {
  if (!state.current) return;
  if (state.playing) pause();
  else resume();
}

export function pause() {
  if (!state.current || !state.playing) return;
  pausedAt = getPosition();
  token++;
  stopOutput();
  emit({ playing: false });
  cancelAnimationFrame(raf);
  posListeners.forEach((l) => l(pausedAt, state.current!.duration));
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
}

export function resume() {
  if (!state.current || state.playing) return;
  void startCurrent(pausedAt >= state.current.duration - 0.5 ? 0 : pausedAt);
}

export function seek(seconds: number) {
  const cur = state.current;
  if (!cur) return;
  const to = Math.max(0, Math.min(cur.duration - 0.25, seconds));
  if (state.playing) void startCurrent(to);
  else {
    pausedAt = to;
    if (cur.source.kind === 'file' && audioEl) audioEl.currentTime = to;
    posListeners.forEach((l) => l(to, cur.duration));
  }
}

function orderPos(): number {
  return order.indexOf(state.index);
}

export function next(auto = false) {
  if (!state.queue.length) return;
  const p = orderPos();
  if (p < order.length - 1) {
    setCurrent(order[p + 1]);
    void startCurrent(0);
    return;
  }
  // End of the queue.
  if (state.repeat === 'all' || (!auto && order.length > 1)) {
    setCurrent(order[0]);
    void startCurrent(0);
  } else if (!auto) {
    seek(0);
  } else {
    pause();
    pausedAt = 0;
    posListeners.forEach((l) => l(0, state.current?.duration ?? 0));
  }
}

export function prev() {
  if (!state.current) return;
  if (getPosition() > 3) {
    seek(0);
    if (!state.playing) resume();
    return;
  }
  const p = orderPos();
  if (p > 0) {
    setCurrent(order[p - 1]);
    void startCurrent(0);
  } else seek(0);
}

function handleEnded() {
  if (state.repeat === 'one') {
    void startCurrent(0);
    return;
  }
  next(true);
}

export function setVolume(v: number) {
  const volume = Math.min(1, Math.max(0, v));
  if (master && ac) master.gain.setTargetAtTime(volume, ac.currentTime, 0.02);
  emit({ volume, muted: volume === 0 ? state.muted : false });
}

export function toggleMute() {
  const muted = !state.muted;
  if (master && ac) master.gain.setTargetAtTime(muted ? 0 : state.volume, ac.currentTime, 0.02);
  emit({ muted });
}

export function toggleShuffle() {
  emit({ shuffle: !state.shuffle });
  if (state.index >= 0) buildOrder(state.index);
}

export function cycleRepeat() {
  emit({ repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off' });
}

/** Insert right after the current item. */
export function playNext(item: Playable) {
  if (!state.current) {
    playQueue([item]);
    return;
  }
  const q = state.queue.filter((x) => x.id !== item.id);
  const at = q.findIndex((x) => x.id === state.current!.id) + 1;
  q.splice(at, 0, item);
  emit({ queue: q, index: q.findIndex((x) => x.id === state.current!.id) });
  rebuildOrderKeepingCurrent();
}

export function addToQueue(item: Playable) {
  if (!state.current) {
    playQueue([item]);
    return;
  }
  if (state.queue.some((x) => x.id === item.id)) return;
  emit({ queue: [...state.queue, item] });
  order.push(state.queue.length - 1);
}

export function removeFromQueue(id: string) {
  if (state.current?.id === id) return;
  const q = state.queue.filter((x) => x.id !== id);
  emit({ queue: q, index: q.findIndex((x) => x.id === state.current?.id) });
  rebuildOrderKeepingCurrent();
}

export function jumpTo(id: string) {
  const i = state.queue.findIndex((x) => x.id === id);
  if (i < 0) return;
  if (state.shuffle) buildOrder(i);
  setCurrent(i);
  void startCurrent(0);
}

function rebuildOrderKeepingCurrent() {
  if (state.shuffle) buildOrder(state.index);
  else order = state.queue.map((_, i) => i);
}

/** Sleep timer: pause after `minutes` (null cancels). */
export function setSleepTimer(minutes: number | null) {
  clearTimeout(sleepTimer);
  if (minutes === null) {
    emit({ sleepAt: null });
    return;
  }
  const at = Date.now() + minutes * 60_000;
  sleepTimer = window.setTimeout(() => {
    pause();
    emit({ sleepAt: null });
  }, minutes * 60_000);
  emit({ sleepAt: at });
}

// --- Media Session (lock screen / hardware keys) -------------------------------------------------

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !state.current) return;
  const cur = state.current;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: cur.title,
      artist: cur.subtitle,
      album: 'ASF',
      artwork: cur.artwork ? [{ src: cur.artwork, sizes: '400x400', type: 'image/svg+xml' }] : [],
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch {
    /* unsupported fields */
  }
}

if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, h);
    } catch {
      /* unsupported action */
    }
  };
  set('play', () => resume());
  set('pause', () => pause());
  set('nexttrack', () => next());
  set('previoustrack', () => prev());
  set('seekto', (d) => d.seekTime !== undefined && seek(d.seekTime));
  set('seekforward', () => seek(getPosition() + 10));
  set('seekbackward', () => seek(getPosition() - 10));
}
