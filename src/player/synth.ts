/**
 * Genre-aware procedural music. A track is a recipe (genre, bpm, root, scale, seed); bars are
 * rendered on demand with Web Audio so full-length songs stream with almost no memory, can seek
 * anywhere, and sound like their genre (kompa cowbell & guitar, amapiano log drums, drill slides…).
 */
import type { GenreId, SynthRecipe } from '../catalog/types';
import { mulberry32 } from '../lib/metadata';

type Steps = string; // 16 steps, 'x' = hit, '.' = rest

interface Kit {
  swing: number;
  kick: Steps;
  snare: Steps;
  snareType: 'snare' | 'clap' | 'rim';
  hat: Steps;
  hatType: 'hat' | 'shaker';
  openHat?: Steps;
  perc?: Steps;
  percType?: 'cowbell' | 'conga' | 'rim' | 'block';
  bass: Steps;
  bassType: 'sub808' | 'saw' | 'log' | 'round';
  chords: 'pad' | 'rhodes' | 'stab' | 'skank' | 'organ' | 'guitar' | 'piano';
  chordRhythm: Steps;
  lead: 'arp' | 'pluck' | 'brass' | 'bell' | 'none';
  progression: number[];
}

const KITS: Record<GenreId, Kit> = {
  kompa: {
    swing: 0.04, kick: 'x...x...x...x...', snare: '....x.......x...', snareType: 'rim', hat: 'xxxxxxxxxxxxxxxx', hatType: 'shaker',
    perc: 'x..x..x.x..x..x.', percType: 'cowbell', bass: 'x..x..x...x.x...', bassType: 'round', chords: 'guitar', chordRhythm: 'x.x.x.x.x.x.x.x.',
    lead: 'bell', progression: [0, 5, 7, 5],
  },
  'rap-kreyol': {
    swing: 0, kick: 'x......x..x.....', snare: '........x.......', snareType: 'clap', hat: 'x.x.x.x.x.x.xxxx', hatType: 'hat',
    bass: 'x......x..x.....', bassType: 'sub808', chords: 'pad', chordRhythm: 'x...............', lead: 'bell', progression: [0, 8, 3, 7],
  },
  afrobeats: {
    swing: 0.12, kick: 'x.....x...x.....', snare: '....x..x....x...', snareType: 'rim', hat: 'xxxxxxxxxxxxxxxx', hatType: 'shaker',
    perc: '..x...x...x.x...', percType: 'conga', bass: 'x..x....x.x.....', bassType: 'round', chords: 'rhodes', chordRhythm: 'x.....x...x.....',
    lead: 'pluck', progression: [0, 5, 9, 7],
  },
  amapiano: {
    swing: 0.1, kick: 'x...x...x...x...', snare: '....x.......x...', snareType: 'clap', hat: 'xxxxxxxxxxxxxxxx', hatType: 'shaker',
    perc: '...x..x....x..x.', percType: 'block', bass: 'x..x..x...x..x..', bassType: 'log', chords: 'piano', chordRhythm: 'x.......x.......',
    lead: 'bell', progression: [0, 8, 3, 10],
  },
  dancehall: {
    swing: 0.02, kick: 'x...x...x...x...', snare: '...x..x....x..x.', snareType: 'snare', hat: 'x.x.x.x.x.x.x.x.', hatType: 'hat',
    perc: 'x..x..x.x..x..x.', percType: 'rim', bass: 'x..x..x.x..x..x.', bassType: 'sub808', chords: 'stab', chordRhythm: '..x...x...x...x.',
    lead: 'pluck', progression: [0, 8, 10, 7],
  },
  'hip-hop': {
    swing: 0.14, kick: 'x......x.xx.....', snare: '....x.......x...', snareType: 'snare', hat: 'x.x.x.x.x.x.x.x.', hatType: 'hat',
    bass: 'x......x.x......', bassType: 'saw', chords: 'piano', chordRhythm: 'x.......x.......', lead: 'none', progression: [0, 5, 3, 7],
  },
  drill: {
    swing: 0, kick: 'x.....x...x.....', snare: '........x....x..', snareType: 'snare', hat: 'x..x..x.x..x..x.', hatType: 'hat',
    bass: 'x.....x...x...x.', bassType: 'sub808', chords: 'pad', chordRhythm: 'x...............', lead: 'bell', progression: [0, 8, 5, 7],
  },
  rnb: {
    swing: 0.16, kick: 'x......x.x......', snare: '....x.......x...', snareType: 'snare', hat: 'x.x.x.x.x.x.x.x.', hatType: 'hat',
    bass: 'x.....x.x.......', bassType: 'round', chords: 'rhodes', chordRhythm: 'x.......x.......', lead: 'none', progression: [0, 10, 8, 7],
  },
  zouk: {
    swing: 0.05, kick: 'x..x..x.x..x..x.', snare: '....x.......x...', snareType: 'rim', hat: 'x.x.x.x.x.x.x.x.', hatType: 'shaker',
    perc: '..x...x...x...x.', percType: 'conga', bass: 'x..x..x.x.......', bassType: 'round', chords: 'pad', chordRhythm: 'x.......x.......',
    lead: 'pluck', progression: [0, 8, 3, 7],
  },
  reggae: {
    swing: 0.1, kick: '........x.......', snare: '........x.......', snareType: 'rim', hat: 'x.x.x.x.x.x.x.x.', hatType: 'hat',
    bass: 'x...x.x.....x...', bassType: 'round', chords: 'skank', chordRhythm: '..x...x...x...x.', lead: 'none', progression: [0, 5, 7, 5],
  },
  gospel: {
    swing: 0.12, kick: 'x.......x.......', snare: '....x.......x...', snareType: 'clap', hat: 'x.x.x.x.x.x.x.x.', hatType: 'hat',
    bass: 'x.......x...x...', bassType: 'round', chords: 'organ', chordRhythm: 'x.......x.......', lead: 'none', progression: [0, 5, 9, 7],
  },
  rara: {
    swing: 0.03, kick: 'x..x..x...x.x...', snare: '..x...x...x...x.', snareType: 'rim', hat: 'xxxxxxxxxxxxxxxx', hatType: 'shaker',
    perc: 'x.xx.x.xx.x.x.x.', percType: 'conga', bass: 'x..x..x...x.....', bassType: 'saw', chords: 'stab', chordRhythm: 'x..x..x.........',
    lead: 'brass', progression: [0, 3, 5, 3],
  },
  electronic: {
    swing: 0, kick: 'x...x...x...x...', snare: '....x.......x...', snareType: 'clap', hat: '..x...x...x...x.', hatType: 'hat',
    openHat: '..x...x...x...x.', bass: '..x...x...x...x.', bassType: 'saw', chords: 'pad', chordRhythm: 'x...............', lead: 'arp',
    progression: [0, 8, 3, 10],
  },
};

const HALF_TIME = new Set<GenreId>(['rap-kreyol', 'drill']);
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const on = (p: Steps | undefined, i: number) => !!p && p[i % p.length] === 'x';

/** Seconds per bar for a recipe. Half-time genres count 16 steps at the doubled tempo. */
export function barSeconds(r: SynthRecipe): number {
  return (60 / r.bpm) * 4;
}

export function barCount(r: SynthRecipe, duration: number): number {
  return Math.ceil(duration / barSeconds(r));
}

type Section = 'intro' | 'verse' | 'hook' | 'break' | 'outro';

/** Song form: 4-bar intro, then verse/hook cycles with a breakdown, 4-bar outro. */
export function sectionOf(bar: number, total: number): Section {
  if (bar < 4) return 'intro';
  if (bar >= total - 4) return 'outro';
  const k = (bar - 4) % 32;
  if (k < 8) return 'verse';
  if (k < 16) return 'hook';
  if (k < 24) return 'verse';
  if (k < 28) return 'hook';
  return 'break';
}

/** Energy 0..1 per bar — also drives generated waveforms. */
export function energyOf(section: Section): number {
  return { intro: 0.35, verse: 0.7, hook: 1, break: 0.45, outro: 0.4 }[section];
}

interface Ctx {
  ac: BaseAudioContext;
  out: AudioNode;
  fx: AudioNode;
  noise: AudioBuffer;
  notBefore: number;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseFor(ac: BaseAudioContext) {
  let b = noiseCache.get(ac);
  if (!b) {
    b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ac, b);
  }
  return b;
}

const fxCache = new WeakMap<AudioNode, AudioNode>();
/** Shared tempo-synced delay send per output bus. */
function fxFor(ac: BaseAudioContext, out: AudioNode, time: number): AudioNode {
  let fx = fxCache.get(out);
  if (!fx) {
    const input = ac.createGain();
    input.gain.value = 0.22;
    const d = ac.createDelay(2);
    d.delayTime.value = time;
    const fb = ac.createGain();
    fb.gain.value = 0.32;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    input.connect(d);
    d.connect(lp).connect(fb).connect(d);
    lp.connect(out);
    fx = input;
    fxCache.set(out, fx);
  }
  return fx;
}

function env(ac: BaseAudioContext, t: number, a: number, peak: number, decay: number) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  return g;
}

function osc(c: Ctx, type: OscillatorType, f: number, t: number, len: number, peak: number, opts: { a?: number; cutoff?: number; q?: number; detune?: number; glideTo?: number; send?: boolean; sweep?: number } = {}) {
  if (t < c.notBefore) return;
  const { ac } = c;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, t + Math.min(len, 0.25));
  if (opts.detune) o.detune.value = opts.detune;
  const g = env(ac, t, opts.a ?? 0.005, peak, len);
  let node: AudioNode = o;
  if (opts.cutoff) {
    const f2 = ac.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.setValueAtTime(opts.cutoff, t);
    if (opts.sweep) f2.frequency.exponentialRampToValueAtTime(Math.max(120, opts.cutoff * opts.sweep), t + len);
    f2.Q.value = opts.q ?? 0.8;
    o.connect(f2);
    node = f2;
  }
  node.connect(g);
  g.connect(c.out);
  if (opts.send) g.connect(c.fx);
  o.start(t);
  o.stop(t + (opts.a ?? 0.005) + len + 0.05);
}

function noise(c: Ctx, t: number, type: BiquadFilterType, freq: number, len: number, peak: number, q = 0.8) {
  if (t < c.notBefore) return;
  const { ac } = c;
  const src = ac.createBufferSource();
  src.buffer = c.noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = env(ac, t, 0.002, peak, len);
  src.connect(f).connect(g).connect(c.out);
  const offset = Math.random() * 0.5;
  src.start(t, offset);
  src.stop(t + len + 0.05);
}

// --- drums -------------------------------------------------------------------------------------

function kick(c: Ctx, t: number, v: number) {
  if (t < c.notBefore) return;
  const o = c.ac.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  const g = env(c.ac, t, 0.002, 0.95 * v, 0.34);
  o.connect(g).connect(c.out);
  o.start(t);
  o.stop(t + 0.4);
  noise(c, t, 'highpass', 3000, 0.012, 0.15 * v);
}

function snare(c: Ctx, t: number, type: Kit['snareType'], v: number) {
  if (type === 'clap') {
    for (let i = 0; i < 3; i++) noise(c, t + i * 0.011, 'bandpass', 1400, i === 2 ? 0.16 : 0.02, 0.5 * v, 1.2);
  } else if (type === 'rim') {
    osc(c, 'triangle', 1750, t, 0.03, 0.22 * v);
    noise(c, t, 'bandpass', 3200, 0.025, 0.25 * v, 3);
  } else {
    osc(c, 'triangle', 190, t, 0.09, 0.35 * v);
    noise(c, t, 'bandpass', 1900, 0.17, 0.55 * v, 0.9);
  }
}

function hat(c: Ctx, t: number, type: Kit['hatType'], v: number, open = false) {
  if (type === 'shaker') noise(c, t, 'bandpass', 6500, 0.045, 0.16 * v, 1.4);
  else noise(c, t, 'highpass', 8000, open ? 0.22 : 0.035, (open ? 0.16 : 0.13) * v);
}

function perc(c: Ctx, t: number, type: NonNullable<Kit['percType']>, v: number, alt: boolean) {
  switch (type) {
    case 'cowbell':
      osc(c, 'square', 540, t, 0.12, 0.05 * v, { cutoff: 2600 });
      osc(c, 'square', 800, t, 0.12, 0.04 * v, { cutoff: 2600 });
      break;
    case 'conga':
      osc(c, 'sine', alt ? 330 : 240, t, 0.18, 0.3 * v, { glideTo: alt ? 290 : 200 });
      break;
    case 'block':
      osc(c, 'sine', alt ? 1100 : 860, t, 0.05, 0.22 * v);
      break;
    case 'rim':
      osc(c, 'triangle', 1500, t, 0.025, 0.15 * v);
  }
}

// --- tonal -------------------------------------------------------------------------------------

function bassNote(c: Ctx, type: Kit['bassType'], note: number, t: number, len: number, v: number, slideTo?: number) {
  const f = mtof(note);
  switch (type) {
    case 'sub808':
      osc(c, 'sine', f, t, Math.max(0.4, len), 0.55 * v, { glideTo: slideTo ? mtof(slideTo) : undefined });
      osc(c, 'triangle', f * 2, t, 0.08, 0.08 * v);
      break;
    case 'log':
      osc(c, 'sine', f * 2, t, Math.min(0.5, len), 0.5 * v, { glideTo: f * 1.5 });
      osc(c, 'triangle', f, t, Math.min(0.5, len), 0.25 * v, { cutoff: 900 });
      break;
    case 'saw':
      osc(c, 'sawtooth', f, t, len * 0.9, 0.18 * v, { cutoff: 700, sweep: 0.4, q: 4 });
      break;
    case 'round':
    default:
      osc(c, 'triangle', f, t, len * 0.9, 0.3 * v, { cutoff: 1200 });
      osc(c, 'sine', f / 2, t, len * 0.9, 0.18 * v);
  }
}

function chord(c: Ctx, type: Kit['chords'], notes: number[], t: number, len: number, v: number, stepIndex: number) {
  switch (type) {
    case 'pad':
      for (const n of notes) {
        osc(c, 'sawtooth', mtof(n), t, len, 0.03 * v, { a: 0.35, cutoff: 1100, send: true });
        osc(c, 'sawtooth', mtof(n), t, len, 0.025 * v, { a: 0.35, cutoff: 1100, detune: 11 });
      }
      break;
    case 'rhodes':
      for (const n of notes) {
        osc(c, 'sine', mtof(n), t, len, 0.07 * v, { a: 0.01, send: true });
        osc(c, 'triangle', mtof(n) * 2, t, 0.35, 0.018 * v);
      }
      break;
    case 'piano':
      for (const n of notes) {
        osc(c, 'triangle', mtof(n), t, Math.min(1.6, len), 0.07 * v, { a: 0.004, cutoff: 3200, sweep: 0.4, send: true });
        osc(c, 'sine', mtof(n + 12), t, 0.4, 0.02 * v);
      }
      break;
    case 'organ':
      for (const n of notes) for (const h of [1, 2, 3]) osc(c, 'sine', mtof(n) * h, t, len, (0.04 / h) * v, { a: 0.04 });
      break;
    case 'stab':
      for (const n of notes) osc(c, 'square', mtof(n), t, 0.14, 0.035 * v, { cutoff: 2200, sweep: 0.3, send: true });
      break;
    case 'skank':
      for (const n of notes) osc(c, 'sawtooth', mtof(n + 12), t, 0.09, 0.03 * v, { cutoff: 2600, q: 2 });
      break;
    case 'guitar': {
      // Kompa-style arpeggiated clean guitar.
      const n = notes[stepIndex % notes.length] + 12;
      osc(c, 'triangle', mtof(n), t, 0.28, 0.09 * v, { a: 0.003, cutoff: 3400, sweep: 0.35, send: true });
      osc(c, 'square', mtof(n), t, 0.05, 0.015 * v, { cutoff: 2400 });
      break;
    }
  }
}

function leadNote(c: Ctx, type: Kit['lead'], note: number, t: number, len: number, v: number) {
  const f = mtof(note);
  switch (type) {
    case 'arp':
      osc(c, 'square', f, t, len, 0.04 * v, { cutoff: 2800, sweep: 0.3, q: 4, send: true });
      break;
    case 'pluck':
      osc(c, 'triangle', f, t, Math.min(0.4, len), 0.1 * v, { cutoff: 3600, sweep: 0.25, send: true });
      break;
    case 'brass':
      osc(c, 'sawtooth', f, t, len, 0.06 * v, { a: 0.03, cutoff: 1800, q: 1.5 });
      osc(c, 'sawtooth', f, t, len, 0.05 * v, { a: 0.03, cutoff: 1800, detune: 9, send: true });
      break;
    case 'bell':
      osc(c, 'sine', f, t, 0.9, 0.08 * v, { send: true });
      osc(c, 'sine', f * 3.01, t, 0.25, 0.02 * v);
      break;
  }
}

/**
 * Render one bar. `notBefore` skips events that would already have started (used when seeking
 * into the middle of a bar), so playback resumes exactly in time.
 */
export function renderBar(ac: BaseAudioContext, out: AudioNode, r: SynthRecipe, bar: number, totalBars: number, t0: number, notBefore = 0) {
  const kit = KITS[r.genre];
  const half = HALF_TIME.has(r.genre);
  const barDur = barSeconds(r);
  const step = barDur / 16;
  const section: Section = r.form === 'loop' ? (bar >= totalBars - 1 ? 'outro' : 'hook') : sectionOf(bar, totalBars);
  const rand = mulberry32((r.seed + bar * 7919) >>> 0);
  const motif = mulberry32(r.seed);
  const scale = r.scale === 'major' ? MAJOR : MINOR;
  const c: Ctx = { ac, out, fx: fxFor(ac, out, step * 3), noise: noiseFor(ac), notBefore };

  // Chord for this bar (progression advances every bar; half-time genres hold 2 bars).
  const degree = kit.progression[Math.floor(bar / (half ? 2 : 1)) % kit.progression.length];
  const root = r.root + degree;
  const deg = ((degree % 12) + 12) % 12;
  const third = r.scale === 'major' ? ([2, 4, 9].includes(deg) ? 3 : 4) : [3, 8, 10].includes(deg) ? 4 : 3;
  const seventh = r.scale === 'major' && (deg === 0 || deg === 5) ? 11 : 10;
  const chordNotes = [root + 12, root + 12 + third, root + 19, root + 12 + seventh];

  const drums = section === 'verse' || section === 'hook';
  const fullDrums = section === 'hook';
  const hasBass = section !== 'intro' && section !== 'break';
  const hasLead = section === 'hook' || (section === 'break' && kit.lead !== 'none');
  const fadeOut = section === 'outro' ? Math.max(0.15, 1 - (bar - (totalBars - 4)) / 4) : 1;
  const v = fadeOut;

  // Lead motif: 8 notes per bar from the scale, repeated per section for hooky-ness.
  const motifNotes = Array.from({ length: 16 }, () => scale[Math.floor(motif() * scale.length)] + (motif() < 0.2 ? 12 : 0));
  const motifRhythm = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? motif() < 0.75 : motif() < 0.25));

  for (let i = 0; i < 16; i++) {
    const sw = i % 2 === 1 ? kit.swing * step * 2 : 0;
    const t = t0 + i * step + sw;

    if (drums || (section === 'outro' && bar < totalBars - 2)) {
      if (on(kit.kick, i)) kick(c, t, v * (fullDrums ? 1 : 0.9));
      if (on(kit.snare, i)) snare(c, t, kit.snareType, v);
      if (on(kit.hat, i)) {
        hat(c, t, kit.hatType, v * (i % 4 === 0 ? 1 : 0.7));
        // Trap-style hat rolls on the last beat of every 4th bar.
        if ((r.genre === 'rap-kreyol' || r.genre === 'drill') && bar % 4 === 3 && i >= 12) hat(c, t + step / 2, kit.hatType, v * 0.6);
      }
      if (fullDrums && on(kit.openHat, i)) hat(c, t, 'hat', v * 0.8, true);
    }
    if (kit.perc && kit.percType && section !== 'outro' && on(kit.perc, i)) perc(c, t, kit.percType, v * (drums ? 1 : 0.7), i % 3 === 0);
    if (section === 'intro' || section === 'break') {
      if (kit.hatType === 'shaker' && i % 2 === 0) hat(c, t, 'shaker', 0.5 * v);
    }

    if (hasBass && on(kit.bass, i)) {
      let len = step;
      for (let j = i + 1; j < 16 && !on(kit.bass, j); j++) len += step;
      const n = root - (root > 50 ? 24 : 12) + (rand() < 0.15 ? 7 : 0);
      const slide = kit.bassType === 'sub808' && rand() < 0.25 ? n + (rand() < 0.5 ? 5 : -2) : undefined;
      bassNote(c, kit.bassType, n, t, Math.min(len, 1.2), v, slide);
    }

    if (on(kit.chordRhythm, i)) {
      let len = step;
      for (let j = i + 1; j < 16 && !on(kit.chordRhythm, j); j++) len += step;
      chord(c, kit.chords, chordNotes, t, Math.min(len * 0.95, barDur), v * (section === 'break' ? 1.15 : 1), i);
    }

    if (hasLead && motifRhythm[i] && kit.lead !== 'none') {
      const n = r.root + 24 + motifNotes[i] + (section === 'break' ? -12 : 0);
      leadNote(c, kit.lead, n, t, step * 1.8, v);
    }
  }

  // Drum fill / crash at section changes.
  if (sectionOf(bar + 1, totalBars) !== section && drums) {
    for (let i = 12; i < 16; i++) snare(c, t0 + i * step, kit.snareType === 'rim' ? 'snare' : kit.snareType, 0.5 + (i - 12) * 0.12);
  }
  if (sectionOf(bar - 1, totalBars) !== section && section === 'hook') noise(c, t0, 'highpass', 5000, 1.2, 0.12);
}

/** Generated waveform peaks for a synth track (follows the song's sections). */
export function synthPeaks(r: SynthRecipe, duration: number, n = 160): number[] {
  const total = barCount(r, duration);
  const rand = mulberry32(r.seed ^ 0x51ed);
  return Array.from({ length: n }, (_, i) => {
    const bar = Math.floor((i / n) * total);
    const e = energyOf(sectionOf(bar, total));
    return Math.min(1, Math.max(0.08, e * (0.65 + rand() * 0.4)));
  });
}
