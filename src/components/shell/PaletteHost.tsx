import { Suspense, lazy, useEffect, useState } from 'react';

// The palette (cmdk + its dialog) is fetched the first time someone opens it.
const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })));

/** Listens for ⌘K / Ctrl+K (or an `asf:palette` event) and mounts the command palette on demand. */
export function PaletteHost(props: { onToggleTheme: () => void; onLyrics: () => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        setLoaded(true);
        setOpen((o) => !o);
      }
    };
    const onOpen = () => (setLoaded(true), setOpen(true));
    window.addEventListener('keydown', onKey);
    window.addEventListener('asf:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('asf:palette', onOpen);
    };
  }, []);
  if (!loaded) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette open={open} setOpen={setOpen} {...props} />
    </Suspense>
  );
}

/** Open the palette from anywhere (e.g. a toolbar button). */
export const openCommandPalette = () => window.dispatchEvent(new Event('asf:palette'));
