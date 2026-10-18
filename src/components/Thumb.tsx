import { useState } from 'react';
import type { Artwork } from '../lib/types';

export function Thumb({ art, size = 'md', label }: { art: Artwork; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const [failed, setFailed] = useState(false);
  const cls = `thumb${size === 'md' ? '' : ` thumb--${size}`}`;
  const style = { background: `linear-gradient(135deg, ${art.from}, ${art.to})` };
  if (art.imageUrl && !failed) {
    return (
      <span className={cls} style={style} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
        <img src={art.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className={cls} style={style} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <span>{art.glyph}</span>
      {size !== 'sm' && (
        <svg className="thumb__wave" viewBox="0 0 56 14" preserveAspectRatio="none" aria-hidden>
          <path d="M0 7 Q4 1 8 7 T16 7 T24 7 T32 7 T40 7 T48 7 T56 7" fill="none" stroke="#fff" strokeWidth="1.5" />
        </svg>
      )}
    </span>
  );
}
