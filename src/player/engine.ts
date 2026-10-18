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
  /** Seconds the end of a song overlaps the start of the next (0 = off, gapless). */
  crossfade: number;
}

type Listener = (s: PlayerState) => void;
type PosListener = (position: number, duration: number) => void;

const PREFS_KEY = 'asf:player';

type Prefs = Pick<PlayerState, 'volume' | 'muted' | 'shuffle' | 'repeat' | 'crossfade'>;
const PREF_KEYS = ['volume', 'muted', 'shuffle', 'repeat', 'crossfade'] as const;
export const MAX_CROSSFADE = 12;

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.85,
      muted: !!p.muted,
      shuffle: !!p.shuffle,
      repeat: p.repeat === 'all' || p.repeat === 'one' ? p.repeat : 'off',
      crossfade: typeof p.crossfade === 'number' ? Math.min(MAX_CROSSFADE, Math.max(0, Math.round(p.crossfade))) : 0,
    };
  } catch {
    return { volume: 0.85, muted: false, shuffle: false, repeat: 'off', crossfade: 0 };
  }
}

let state: PlayerState = { queue: [], index: -1, current: null, playing: false, loading: false, sleepAt: null, ...loadPrefs() };
const listeners = new Set<Listener>();
const posListeners = new Set<PosListener>();
const playListeners = new Set<(p: Playable) => void>();

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0;
let watchTimer = 0;
let sleepTimer = 0;
/** Synth timeline of the current voice: AudioContext time at which position 0 would have played. */
let trackT0 = 0;
/** Position while paused. */
let pausedAt = 0;
/** Shuffle order (indices into queue), current item first. */
let order: number[] = [];
let token = 0;
/** Token of the start that already handed over to the next item (guards double advance). */
let advancedFor = -1;

/**
 * Something making sound: a synth track's bar scheduler or an audio element, each behind its own
 * gain so the outgoing song can fade out while the next one fades in (crossfade).
 */
interface Voice {
  gain: GainNode;
  timer: number;
  slot?: ElSlot;
  done?: number;
}
interface ElSlot {
  el: HTMLAudioElement;
  gain: GainNode;
  voice: Voice | null;
}
let voice: Voice | null = null;
const fading = new Set<Voice>();
const slots: ElSlot[] = [];
/** Optional mapping from a stream URL to a local (downloaded) copy. */
let resolveUrl: (url: string) => Promise<string> = async (u) => u;

export function setUrlResolver(fn: (url: string) => Promise<string>) {
  resolveUrl = fn;
}
function emit(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
  if (PREF_KEYS.some((k) => k in patch)) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(PREF_KEYS.map((k) => [k, state[k]]))));
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
  if (!state.playing || !ac || !voice) return pausedAt;
  if (voice.slot) return voice.slot.el.currentTime;
  return Math.min(cur.duration, Math.max(0, ac.currentTime - trackT0));
}

function tickPosition() {
  cancelAnimationFrame(raf);
  const loop = () => {
    const cur = state.current;
    if (!cur) return;
    posListeners.forEach((l) => l(getPosition(), cur.duration));
    if (state.playing) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

/** Whether finishing the current item would continue into another one. */
function hasAutoNext(): boolean {
  if (state.repeat === 'one') return false;
  return orderPos() < order.length - 1 || (state.repeat === 'all' && order.length > 1);
}

/**
 * End-of-track watch. Runs on a timer rather than animation frames so songs still advance in
 * background tabs; with crossfade on it hands over `crossfade` seconds before the end.
 */
function watchEnd() {
  clearInterval(watchTimer);
  const my = token;
  watchTimer = window.setInterval(() => {
    const cur = state.current;
    if (my !== token || !cur || !state.playing) return;
    const pos = getPosition();
    const xf = state.crossfade;
    if (xf > 0 && cur.duration > xf * 2 + 2 && hasAutoNext() && pos >= cur.duration - xf) handleEnded(xf);
    else if (!voice?.slot && pos >= cur.duration - 0.02) handleEnded(0);
  }, 200);
}

/** Fade a voice out over `fade` seconds (0 = quick declick) and free it afterwards. */
function release(v: Voice, fade = 0) {
  const ctx = ac!;
  const g = v.gain.gain;
  const t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  if (fade > 0.1) g.linearRampToValueAtTime(0, t + fade);
  else g.setTargetAtTime(0, t, 0.03);
  fading.add(v);
  clearTimeout(v.done);
  v.done = window.setTimeout(() => {
    clearInterval(v.timer);
    fading.delete(v);
    if (v.slot) {
      if (v.slot.voice === v) {
        v.slot.el.pause();
        v.slot.voice = null;
      }
    } else v.gain.disconnect();
  }, (fade > 0.1 ? fade : 0.2) * 1000 + 80);
}

function stopOutput(fade = 0) {
  clearInterval(watchTimer);
  if (voice && ac) release(voice, fade);
  voice = null;
}

/** Fade in a new voice's gain (a few ms to avoid clicks, or the crossfade length). */
function fadeIn(g: GainNode, fade: number) {
  const t = ac!.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + Math.max(0.02, fade));
}

function startSynth(recipe: SynthRecipe, duration: number, from: number, fade: number) {
  const ctx = ensureContext();
  const gain = ctx.createGain();
  gain.connect(master!);
  fadeIn(gain, fade);
  const barDur = barSeconds(recipe);
  const total = barCount(recipe, duration);
  const startAt = ctx.currentTime + 0.06;
  const t0 = startAt - from;
  trackT0 = t0;
  let nextBar = Math.floor(from / barDur);
  const v: Voice = { gain, timer: 0 };
  const schedule = () => {
    if (!ac) return;
    // Background tabs throttle timers to ~1s, so schedule further ahead while hidden.
    const horizon = ac.currentTime + (document.hidden ? 3 : 0.8);
    while (nextBar < total && t0 + nextBar * barDur < horizon) {
      renderBar(ac, gain, recipe, nextBar, total, t0 + nextBar * barDur, startAt);
      nextBar++;
    }
  };
  schedule();
  v.timer = window.setInterval(schedule, 120);
  voice = v;
}

function slotFor(ctx: AudioContext): ElSlot {
  let slot = slots.find((s) => !s.voice);
  if (!slot) {
    const el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    const gain = ctx.createGain();
    ctx.createMediaElementSource(el).connect(gain).connect(master!);
    slot = { el, gain, voice: null };
    const s = slot;
    el.addEventListener('ended', () => {
      if (voice && s.voice === voice) handleEnded(0);
    });
    slots.push(slot);
  }
  return slot;
}

async function startFile(url: string, from: number, my: number, fade: number) {
  const ctx = ensureContext();
  const slot = slotFor(ctx);
  const v: Voice = { gain: slot.gain, timer: 0, slot };
  slot.voice = v;
  voice = v;
  fadeIn(slot.gain, fade);
  emit({ loading: true });
  try {
    const src = await resolveUrl(url);
    if (my !== token) return;
    if (slot.el.src !== src) slot.el.src = src;
    slot.el.currentTime = from;
    await slot.el.play();
  } catch {
    if (my === token) emit({ playing: false });
  } finally {
    if (my === token) emit({ loading: false });
  }
}

async function startCurrent(from = 0, fade = 0) {
  const cur = state.current;
  if (!cur) return;
  const my = ++token;
  stopOutput(fade);
  const ctx = ensureContext();
  if (ctx.state === 'suspended') await ctx.resume();
  if (my !== token) return;
  pausedAt = from;
  emit({ playing: true });
  if (cur.source.kind === 'synth') startSynth(cur.source.recipe, cur.duration, from, fade);
  else await startFile(cur.source.url, from, my, fade);
  if (my !== token) return;
  updateMediaSession();
  tickPosition();
  watchEnd();
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

/** Replace the queue and start playing `items[start]` (optionally `from` seconds in). */
export function playQueue(items: Playable[], start = 0, from = 0) {
  if (!items.length) return;
  emit({ queue: items });
  buildOrder(start);
  setCurrent(start);
  void startCurrent(Math.max(0, Math.min(from, items[start].duration - 0.5)));
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
  fading.forEach((v) => release(v));
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
  if (state.playing && voice?.slot) {
    voice.slot.el.currentTime = to;
    posListeners.forEach((l) => l(to, cur.duration));
  } else if (state.playing) void startCurrent(to);
  else {
    pausedAt = to;
    posListeners.forEach((l) => l(to, cur.duration));
  }
}

function orderPos(): number {
  return order.indexOf(state.index);
}

export function next(auto = false, fade = 0) {
  if (!state.queue.length) return;
  const p = orderPos();
  if (p < order.length - 1) {
    setCurrent(order[p + 1]);
    void startCurrent(0, fade);
    return;
  }
  // End of the queue.
  if (state.repeat === 'all' || (!auto && order.length > 1)) {
    setCurrent(order[0]);
    void startCurrent(0, fade);
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

function handleEnded(fade: number) {
  if (advancedFor === token) return;
  advancedFor = token;
  if (state.repeat === 'one') {
    void startCurrent(0);
    return;
  }
  next(true, fade);
}

export function setCrossfade(seconds: number) {
  emit({ crossfade: Math.min(MAX_CROSSFADE, Math.max(0, Math.round(seconds))) });
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
