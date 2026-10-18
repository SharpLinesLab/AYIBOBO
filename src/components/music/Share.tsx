import { useEffect, useState } from 'react';
import { paletteOf } from '../../catalog/color';
import { coverUrl } from '../../catalog/covers';
import type { CoverSpec } from '../../catalog/types';
import { fmtTime } from '../../music';
import { getPosition, getState } from '../../player/engine';
import { useApp } from '../../store';
import { Modal } from '../Modal';
import { Cover } from './bits';
import { t } from '../../i18n';

export interface ShareTarget {
  kind: 'Song' | 'Album' | 'Playlist' | 'Artist';
  title: string;
  subtitle: string;
  cover: CoverSpec;
  /** In-app hash, e.g. `#/song/abc`. */
  href: string;
  /** Song id, enables "share from current time" while it plays. */
  trackId?: string;
  peaks?: number[];
}

const KIND_LABEL = { Song: 'common.kind.song', Album: 'common.kind.album', Playlist: 'common.kind.playlist', Artist: 'common.kind.artist' } as const;
const KIND_KICKER = { Song: 'pages.share.kicker.song', Album: 'pages.share.kicker.album', Playlist: 'pages.share.kicker.playlist', Artist: 'pages.share.kicker.artist' } as const;

/** Open the share sheet from anywhere. */
export const openShare = (target: ShareTarget) => window.dispatchEvent(new CustomEvent<ShareTarget>('asf:share', { detail: target }));

export function ShareHost() {
  const [target, setTarget] = useState<ShareTarget | null>(null);
  useEffect(() => {
    const on = (e: Event) => setTarget((e as CustomEvent<ShareTarget>).detail);
    window.addEventListener('asf:share', on);
    return () => window.removeEventListener('asf:share', on);
  }, []);
  return target ? <ShareSheet target={target} onClose={() => setTarget(null)} /> : null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, max: number, lines = 2): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = `${out[lines - 1].replace(/\s+\S*$/, '')}…`;
  }
  return out;
}

/** 1080×1920 story card: blurred artwork backdrop, cover, title, waveform and the link. */
async function renderCard(tg: ShareTarget, url: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const [a, b] = paletteOf(tg.cover);
  const art = await loadImage(coverUrl(tg.cover));
  await document.fonts?.ready;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, a);
  g.addColorStop(1, '#050607');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.filter = 'blur(80px) saturate(1.4)';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(art, -200, -100, W + 400, W + 400);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, H);

  // Artwork
  const size = 760;
  const x = (W - size) / 2;
  const y = 300;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, tg.kind === 'Artist' ? size / 2 : 36);
  ctx.fillStyle = b;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, tg.kind === 'Artist' ? size / 2 : 36);
  ctx.clip();
  ctx.drawImage(art, x, y, size, size);
  ctx.restore();

  // Text
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = "800 30px 'Inter', sans-serif";
  ctx.globalAlpha = 0.75;
  ctx.fillText(t(KIND_LABEL[tg.kind]).toLocaleUpperCase(), W / 2, y + size + 110);
  ctx.globalAlpha = 1;
  ctx.font = "800 84px 'Inter Tight', 'Inter', sans-serif";
  const lines = wrapLines(ctx, tg.title, W - 160);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + size + 210 + i * 96));
  ctx.font = "600 44px 'Inter', sans-serif";
  ctx.globalAlpha = 0.8;
  ctx.fillText(wrapLines(ctx, tg.subtitle, W - 160, 1)[0] ?? '', W / 2, y + size + 210 + lines.length * 96 + 20);
  ctx.globalAlpha = 1;

  // Waveform
  if (tg.peaks?.length) {
    const n = 64;
    const bw = 9;
    const gap = 5;
    const total = n * (bw + gap) - gap;
    const wy = 1600;
    for (let i = 0; i < n; i++) {
      const p = tg.peaks[Math.floor((i / n) * tg.peaks.length)] ?? 0.3;
      const h = 16 + p * 110;
      ctx.fillStyle = i < n * 0.35 ? '#2ed573' : 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.roundRect((W - total) / 2 + i * (bw + gap), wy - h / 2, bw, h, 4);
      ctx.fill();
    }
  }

  // Footer: brand + link
  ctx.font = "italic 900 64px 'Poppins', 'Inter', sans-serif";
  ctx.fillText('ASF', W / 2, 1790);
  ctx.font = "600 30px 'Inter', sans-serif";
  ctx.globalAlpha = 0.7;
  ctx.fillText(t('pages.share.listenOn', { url: url.replace(/^https?:\/\//, '').slice(0, 52) }), W / 2, 1846);
  ctx.globalAlpha = 1;

  return new Promise((resolve) => {
    try {
      c.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null); // tainted canvas (cross-origin artwork without CORS)
    }
  });
}

export function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const { toast } = useApp();
  const st = getState();
  const playingThis = !!target.trackId && st.current?.id === target.trackId;
  const [atTime, setAtTime] = useState(false);
  const [pos] = useState(() => Math.floor(getPosition()));
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [cardFailed, setCardFailed] = useState(false);

  const base = `${location.origin}${location.pathname}`;
  const url = `${base}${target.href}${atTime && pos > 0 ? `?t=${pos}` : ''}`;
  const text = t('pages.share.text', { title: target.title, subtitle: target.subtitle });

  useEffect(() => {
    let live = true;
    let made = '';
    renderCard(target, `${base}${target.href}`)
      .then((blob) => {
        if (!live) return;
        if (!blob) return setCardFailed(true);
        made = URL.createObjectURL(blob);
        setCard({ blob, url: made });
      })
      .catch(() => live && setCardFailed(true));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [target]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('pages.share.copied'));
    } catch {
      toast(t('pages.share.copyFailed'));
    }
  };
  const file = card ? new File([card.blob], `${target.title.replace(/[^\w\- ]+/g, '').trim() || 'asf'}-asf.png`, { type: 'image/png' }) : null;
  const canShareFile = !!file && !!navigator.canShare?.({ files: [file] });
  const nativeShare = async () => {
    try {
      await navigator.share(canShareFile ? { title: target.title, text, url, files: [file!] } : { title: target.title, text, url });
    } catch {
      /* dismissed */
    }
  };
  const enc = encodeURIComponent;
  const links = [
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}`, color: '#25d366' },
    { id: 'x', label: 'X', href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`, color: '#000' },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, color: '#1877f2' },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, color: '#229ed9' },
  ];

  return (
    <Modal onClose={onClose} label={t('pages.detail.shareName', { name: target.title })} wide>
      <div className="share">
        <div className="share__preview">
          {card ? (
            <img src={card.url} alt={t('pages.share.cardAlt', { name: target.title })} />
          ) : cardFailed ? (
            <Cover spec={target.cover} />
          ) : (
            <span className="skeleton share__skeleton" />
          )}
        </div>
        <div className="share__side">
          <span className="phead__kicker">{t(KIND_KICKER[target.kind])}</span>
          <h2>{target.title}</h2>
          <p className="muted">{target.subtitle}</p>

          <div className="share__targets">
            {links.map((l) => (
              <a key={l.id} className="share__target" href={l.href} target="_blank" rel="noopener noreferrer" style={{ ['--brand' as string]: l.color }}>
                <span className="share__dot" aria-hidden>
                  {l.label.slice(0, 1)}
                </span>
                {l.label}
              </a>
            ))}
            {'share' in navigator && (
              <button className="share__target" onClick={() => void nativeShare()} style={{ ['--brand' as string]: '#64748b' }}>
                <span className="share__dot" aria-hidden>
                  ⋯
                </span>
                {t('common.nav.more')}
              </button>
            )}
          </div>

          <div className="share__link">
            <input readOnly value={url} aria-label={t('pages.share.link')} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn-accent btn-sm" onClick={() => void copy()}>
              {t('common.action.copy')}
            </button>
          </div>
          {playingThis && pos > 0 && (
            <label className="check">
              <input type="checkbox" checked={atTime} onChange={(e) => setAtTime(e.target.checked)} /> {t('pages.share.startAt', { time: fmtTime(pos) })}
            </label>
          )}
          {card && (
            <a className="btn-glass" href={card.url} download={file?.name}>
              {t('pages.share.downloadImage')}
            </a>
          )}
          <p className="muted share__hint">{t('pages.share.hint')}</p>
        </div>
      </div>
    </Modal>
  );
}
