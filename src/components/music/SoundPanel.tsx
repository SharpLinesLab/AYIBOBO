import { useEffect, useRef, useState } from 'react';
import { usePlayerState } from '../../music';
import { EQ_BANDS, EQ_PRESETS, VIBES, setSound } from '../../player/engine';

const bandLabel = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f));

/** EQ presets + bands, speed (with or without pitch) and reverb — the "sound" controls. */
export function SoundPanel({ compact }: { compact?: boolean }) {
  const { sound } = usePlayerState();
  const vibe = VIBES.find((v) => v.speed === sound.speed && v.keepPitch === sound.keepPitch && Math.abs(v.reverb - sound.reverb) < 0.01);
  return (
    <div className={`sound${compact ? ' sound--compact' : ''}`}>
      <div className="sound__row">
        <span className="sound__label" id="vibe-label">
          Vibe
        </span>
        <div className="segmented sound__vibes" role="group" aria-labelledby="vibe-label">
          {VIBES.map((v) => (
            <button
              key={v.id}
              className={vibe?.id === v.id ? 'is-active' : ''}
              aria-pressed={vibe?.id === v.id}
              onClick={() => setSound({ speed: v.speed, keepPitch: v.keepPitch, reverb: v.reverb })}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sound__row">
        <span className="sound__label" id="eq-label">
          Equalizer
        </span>
        <div className="chips sound__presets" role="group" aria-labelledby="eq-label">
          {EQ_PRESETS.map((p) => (
            <button key={p.id} className={`chip2${sound.preset === p.id ? ' is-active' : ''}`} aria-pressed={sound.preset === p.id} onClick={() => setSound({ preset: p.id, gains: p.gains })}>
              {p.label}
            </button>
          ))}
          {sound.preset === 'custom' && <span className="chip2 is-active">Custom</span>}
        </div>
        <div className="sound__bands">
          {EQ_BANDS.map((f, i) => (
            <label key={f} className="sound__band">
              <span className="num sound__db">{sound.gains[i] > 0 ? `+${sound.gains[i]}` : sound.gains[i]}</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={sound.gains[i]}
                aria-label={`${bandLabel(f)}Hz`}
                aria-valuetext={`${sound.gains[i]} decibels`}
                onChange={(e) => {
                  const gains = [...sound.gains];
                  gains[i] = Number(e.target.value);
                  setSound({ preset: 'custom', gains });
                }}
              />
              <span className="sound__hz">{bandLabel(f)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="sound__row sound__row--split">
        <label className="sound__slider">
          <span className="sound__label">
            Speed <b className="num">{sound.speed.toFixed(2)}×</b>
          </span>
          <input type="range" min={0.5} max={1.5} step={0.05} value={sound.speed} onChange={(e) => setSound({ speed: Number(e.target.value) })} aria-valuetext={`${sound.speed.toFixed(2)} times`} />
        </label>
        <label className="sound__slider">
          <span className="sound__label">
            Reverb <b className="num">{Math.round(sound.reverb * 100)}%</b>
          </span>
          <input type="range" min={0} max={1} step={0.05} value={sound.reverb} onChange={(e) => setSound({ reverb: Number(e.target.value) })} aria-valuetext={`${Math.round(sound.reverb * 100)} percent`} />
        </label>
      </div>
      <div className="sound__foot">
        <label className="check">
          <input type="checkbox" checked={sound.keepPitch} onChange={(e) => setSound({ keepPitch: e.target.checked })} /> Keep original pitch when changing speed
        </label>
        <button className="link-btn" onClick={() => setSound({ preset: 'flat', gains: [0, 0, 0, 0, 0], speed: 1, keepPitch: true, reverb: 0 })}>
          Reset
        </button>
      </div>
    </div>
  );
}

/** Player-bar button + popover. Lights up when anything differs from the defaults. */
export function SoundButton() {
  const { sound } = usePlayerState();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const changed = sound.preset !== 'flat' || sound.speed !== 1 || sound.reverb > 0;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="sound-pop" ref={wrap}>
      <button className={`tbtn${changed ? ' is-on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label="Sound: equalizer, speed and reverb" aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
        </svg>
      </button>
      {open && (
        <div className="sound-pop__panel" role="dialog" aria-label="Sound">
          <SoundPanel compact />
        </div>
      )}
    </div>
  );
}
