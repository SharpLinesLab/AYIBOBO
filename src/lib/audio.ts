/**
 * Preview player. Synth previews are rendered live with the Web Audio API from a small recipe
 * (style, root note, tempo, seed), so every listing gets a distinct 20-second demo without
 * shipping audio files. File previews (real demo MP3s) play through an <audio> element.
 */
import { mulberry32 } from './metadata';
import type { AudioPreview, SynthPreview } from './types';

export const PREVIEW_SECONDS = 20;

interface PlayerState {
  playingId: string | null;
  progress: number;
}

type Listener = (s: PlayerState) => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fileEl: HTMLAudioElement | null = null;
let startedAt = 0;
let raf = 0;
let state: PlayerState = { playingId: null, progress: 0 };
const listeners = new Set<Listener>();

function emit(next: PlayerState) {
  state = next;
  listeners.forEach((l) => l(state));
}

export function subscribePlayer(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

export function getPlayerState(): PlayerState {
  return state;
}

export function stopPreview() {
  cancelAnimationFrame(raf);
  if (master && ctx) {
    const g = master;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => g.disconnect(), 300);
    master = null;
  }
  if (fileEl) {
    fileEl.pause();
    fileEl = null;
  }
  if (state.playingId) emit({ playingId: null, progress: 0 });
}

export async function togglePreview(id: string, preview: AudioPreview) {
  if (state.playingId === id) {
    stopPreview();
    return;
  }
  stopPreview();
  if (preview.kind === 'file') {
    const el = new Audio(preview.url);
    fileEl = el;
    el.addEventListener('ended', stopPreview);
    try {
      await el.play();
    } catch {
      stopPreview();
      return;
    }
    emit({ playingId: id, progress: 0 });
    const tick = () => {
      if (fileEl !== el) return;
      const dur = Math.min(el.duration || PREVIEW_SECONDS, 30);
      const p = el.currentTime / dur;
      if (p >= 1) return stopPreview();
      emit({ playingId: id, progress: p });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return;
  }

  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  if (ctx.state === 'suspended') await ctx.resume();
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05);
  const comp = ctx.createDynamicsCompressor();
  out.connect(comp).connect(ctx.destination);
  master = out;
  startedAt = ctx.currentTime + 0.05;
  renderSynth(ctx, out, preview, startedAt, PREVIEW_SECONDS);
  out.gain.setTargetAtTime(0, startedAt + PREVIEW_SECONDS - 0.6, 0.2);
  emit({ playingId: id, progress: 0 });
  const tick = () => {
    if (master !== out || !ctx) return;
    const p = (ctx.currentTime - startedAt) / PREVIEW_SECONDS;
    if (p >= 1) return stopPreview();
    emit({ playingId: id, progress: Math.max(0, p) });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------------------------
// Synthesis

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

const PROGRESSIONS = [
  [0, 8, 3, 10], // i VI III VII
  [0, 5, 7, 3],
  [0, 3, 8, 7],
  [0, 10, 8, 7],
];
const MINOR_TRIAD = [0, 3, 7, 10];
const MAJOR_TRIAD = [0, 4, 7, 11];

function chordFor(root: number, degree: number): number[] {
  const quality = [3, 8, 10].includes(degree) ? MAJOR_TRIAD : MINOR_TRIAD;
  return quality.map((i) => root + degree + i);
}

function noiseBuffer(ac: BaseAudioContext): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function makeDelay(ac: BaseAudioContext, dest: AudioNode, time: number, feedback: number, wet: number): AudioNode {
  const input = ac.createGain();
  const delay = ac.createDelay(2);
  delay.delayTime.value = time;
  const fb = ac.createGain();
  fb.gain.value = feedback;
  const w = ac.createGain();
  w.gain.value = wet;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  input.connect(dest);
  input.connect(delay);
  delay.connect(lp).connect(fb).connect(delay);
  lp.connect(w).connect(dest);
  return input;
}

function tone(
  ac: BaseAudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  t: number,
  dur: number,
  peak: number,
  opts: { attack?: number; release?: number; cutoff?: number; q?: number; detune?: number; sweep?: number } = {},
) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  if (opts.detune) osc.detune.value = opts.detune;
  const g = ac.createGain();
  const a = opts.attack ?? 0.005;
  const r = opts.release ?? 0.08;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(0, t + Math.max(a, dur - r), r / 3);
  let node: AudioNode = osc;
  if (opts.cutoff) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = opts.q ?? 1;
    f.frequency.setValueAtTime(opts.cutoff, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, opts.cutoff * opts.sweep), t + dur);
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + r * 2);
}

function kick(ac: BaseAudioContext, dest: AudioNode, t: number, vol = 0.9) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.4);
}

function noiseHit(ac: BaseAudioContext, dest: AudioNode, buf: AudioBuffer, t: number, type: BiquadFilterType, freq: number, dur: number, vol: number) {
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export function renderSynth(ac: BaseAudioContext, dest: AudioNode, p: SynthPreview, t0: number, seconds: number) {
  const rand = mulberry32(p.seed);
  const beat = 60 / p.bpm;
  const bar = beat * 4;
  const prog = PROGRESSIONS[p.seed % PROGRESSIONS.length];
  const bars = Math.ceil(seconds / bar);
  const noise = noiseBuffer(ac);
  const wet = makeDelay(ac, dest, beat * 0.75, 0.35, 0.3);
  const end = t0 + seconds;
  const swing = p.style === 'lofi' ? 0.12 : 0;
  const pattern = Array.from({ length: 16 }, () => rand());

  for (let b = 0; b < bars; b++) {
    const bt = t0 + b * bar;
    if (bt >= end) break;
    const chord = chordFor(p.root, prog[b % prog.length]);

    if (p.style === 'pad' || p.style === 'lofi' || p.style === 'arp') {
      const voice = p.style === 'lofi' ? 'triangle' : 'sawtooth';
      for (const n of chord) {
        const f = mtof(n + 12);
        const opts = p.style === 'pad' ? { attack: 0.8, release: 0.9, cutoff: 900, q: 0.7, detune: 0 } : { attack: 0.02, release: 0.5, cutoff: 1800 };
        tone(ac, wet, voice, f, bt, bar * 0.98, p.style === 'pad' ? 0.05 : 0.04, opts);
        if (p.style === 'pad') tone(ac, wet, voice, f, bt, bar * 0.98, 0.04, { ...opts, detune: 9 });
      }
    }
    if (p.style === 'arp') {
      for (let s = 0; s < 16; s++) {
        const t = bt + s * (beat / 4);
        if (t >= end) break;
        const n = chord[(s + Math.floor(pattern[s] * 3)) % chord.length] + 24 + (s % 8 === 7 ? 12 : 0);
        tone(ac, wet, 'square', mtof(n), t, beat / 4, 0.05, { cutoff: 2600, sweep: 0.3, q: 4 });
      }
    }
    if (p.style === 'pluck') {
      for (let s = 0; s < 8; s++) {
        if (pattern[s] < 0.3 && s % 2 === 1) continue;
        const t = bt + s * (beat / 2);
        const n = chord[Math.floor(pattern[s + 8] * chord.length)] + 24;
        tone(ac, wet, 'triangle', mtof(n), t, beat * 0.45, 0.13, { release: 0.25, cutoff: 3000, sweep: 0.2 });
      }
    }
    if (p.style === 'bass' || p.style === 'beat' || p.style === 'lofi') {
      const steps = p.style === 'bass' ? 16 : 8;
      for (let s = 0; s < steps; s++) {
        const on = s === 0 || pattern[s] > (p.style === 'bass' ? 0.35 : 0.6);
        if (!on) continue;
        const t = bt + s * (bar / steps);
        const n = chord[0] - 12 + (p.style === 'bass' && pattern[(s + 5) % 16] > 0.75 ? 12 : 0);
        const len = (bar / steps) * (p.style === 'bass' ? 0.9 : 1.6);
        tone(ac, dest, 'sawtooth', mtof(n), t, len, p.style === 'bass' ? 0.12 : 0.1, {
          cutoff: p.style === 'bass' ? 400 + 1800 * ((b % 4) / 4 + 0.2) : 500,
          q: p.style === 'bass' ? 12 : 1,
          sweep: 0.25,
        });
      }
    }
    if (p.style === 'beat' || p.style === 'lofi' || p.style === 'bass' || (p.style === 'arp' && b > 0)) {
      for (let s = 0; s < 16; s++) {
        const t = bt + s * (beat / 4) + (s % 2 === 1 ? swing * beat : 0);
        if (t >= end) break;
        const vol = p.style === 'lofi' ? 0.55 : 0.9;
        if (s % 4 === 0 && (p.style !== 'lofi' || s % 8 === 0 || pattern[s] > 0.7)) kick(ac, dest, t, vol);
        if (s === 4 || s === 12) noiseHit(ac, dest, noise, t, 'bandpass', 1800, 0.18, p.style === 'lofi' ? 0.25 : 0.4);
        if (s % 2 === 0 || pattern[s] > 0.6) noiseHit(ac, dest, noise, t, 'highpass', 7000, 0.04, p.style === 'lofi' ? 0.06 : 0.12);
      }
    }
  }
  if (p.style === 'lofi') {
    // vinyl crackle
    for (let t = t0; t < end; t += 0.07 + rand() * 0.3) noiseHit(ac, dest, noise, t, 'highpass', 3000, 0.01, 0.05 * rand());
  }
}
