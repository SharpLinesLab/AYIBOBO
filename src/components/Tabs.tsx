import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface TabDef<K extends string> {
  id: K;
  label: string;
  /** A small count next to the label (e.g. items waiting), hidden when 0 or undefined. */
  badge?: number;
  panel: ReactNode;
}

/**
 * A tab bar and its panels (WAI-ARIA tabs: arrow keys, Home and End move between tabs). A panel
 * is mounted the first time it's opened and then stays mounted while hidden, so half-filled forms
 * and loaded lists survive switching tabs. Controlled: the parent keeps the active tab.
 */
export function Tabs<K extends string>({ id, label, tabs, active, onChange }: { id: string; label: string; tabs: TabDef<K>[]; active: K; onChange: (k: K) => void }) {
  const [opened, setOpened] = useState<Set<K>>(() => new Set([active]));
  if (!opened.has(active)) setOpened(new Set([...opened, active]));
  const refs = useRef(new Map<K, HTMLButtonElement>());

  const onKey = (e: KeyboardEvent, i: number) => {
    const n = tabs.length;
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(tabs[to].id);
    refs.current.get(tabs[to].id)?.focus();
  };

  return (
    <div className="dtabs">
      <div className="chips dtabs__bar" role="tablist" aria-label={label}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) refs.current.set(tab.id, el);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.id}`}
            aria-controls={`${id}-panel-${tab.id}`}
            aria-selected={tab.id === active}
            tabIndex={tab.id === active ? 0 : -1}
            className={`chip2 dtabs__tab${tab.id === active ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {tab.label}
            {!!tab.badge && (
              <>
                {' '}
                <span className="dtabs__badge">{tab.badge}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`} hidden={tab.id !== active} tabIndex={0} className="dtabs__panel">
          {opened.has(tab.id) && tab.panel}
        </div>
      ))}
    </div>
  );
}
