import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

let openCount = 0;

/** Accessible dialog: Escape closes, focus is trapped and restored, page scroll is locked. */
export function Modal({
  onClose,
  children,
  label,
  variant = 'modal',
  wide,
}: {
  onClose: () => void;
  children: ReactNode;
  label: string;
  variant?: 'modal' | 'drawer';
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    openCount++;
    document.body.style.overflow = 'hidden';
    const el = ref.current!;
    const focusables = () =>
      [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])')].filter(
        (n) => n.offsetParent !== null,
      );
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      openCount--;
      if (openCount === 0) document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className={`overlay${variant === 'drawer' ? ' drawer-overlay' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={variant === 'drawer' ? 'drawer' : `modal${wide ? ' modal--wide' : ''}`}>
        <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
