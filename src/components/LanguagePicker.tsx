import { useEffect, useRef, useState } from 'react';
import { LANGS, setLang, t, useLang, type Lang } from '../i18n';

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

const choose = (l: Lang) => void setLang(l);

/** Top-bar globe button: shows the current language and opens a small menu. */
export function LanguageMenu() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
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
    <div className="langmenu" ref={wrap}>
      <button className="round-btn langmenu__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <GlobeIcon />
        {/* Name = hidden text + the visible code, so the accessible name contains what's on screen. */}
        <span className="sr-only">{t('common.lang.switch')}: {LANGS.find((l) => l.id === lang)?.label}</span>
        <span className="langmenu__code" aria-hidden>
          {lang.toUpperCase()}
        </span>
      </button>
      {open && (
        <div className="langmenu__list" role="menu" aria-label={t('common.lang.label')}>
          {LANGS.map((l) => (
            <button key={l.id} role="menuitemradio" aria-checked={lang === l.id} lang={l.id} className={lang === l.id ? 'is-active' : ''} onClick={() => (setOpen(false), choose(l.id))}>
              <span>{l.label}</span>
              {lang === l.id && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Settings: the three languages as a radio group. */
export function LanguageChoice() {
  const lang = useLang();
  return (
    <div className="langchoice" role="radiogroup" aria-label={t('common.lang.label')}>
      {LANGS.map((l) => (
        <button key={l.id} role="radio" aria-checked={lang === l.id} className={`langchoice__opt${lang === l.id ? ' is-active' : ''}`} onClick={() => choose(l.id)}>
          <b lang={l.id}>{l.label}</b>
          {l.id !== 'en' && <small>{l.english}</small>}
        </button>
      ))}
    </div>
  );
}
