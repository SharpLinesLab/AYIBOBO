import { useMemo, useState } from 'react';
import { categoryById } from '../lib/categories';
import { searchListings } from '../lib/search';
import { usd } from '../lib/format';
import { useApp } from '../store';
import { Modal } from './Modal';
import { Thumb } from './Thumb';

export function SearchModal({ onClose }: { onClose: () => void }) {
  const { boards, snapshot, openDetail } = useApp();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchListings(snapshot.state.listings, boards.all, q), [q, snapshot.state.listings, boards.all]);

  const choose = (id: string) => {
    onClose();
    openDetail(id);
  };

  return (
    <Modal onClose={onClose} label="Search listings">
      <h2>Search</h2>
      <p className="modal__sub">Find a site, artist, label, plugin or category.</p>
      <input
        className="search-input"
        data-autofocus
        value={q}
        placeholder="Try “reverb”, “vinyl” or “bandcamp”"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && results[active]) {
            choose(results[active].listing.id);
          }
        }}
        aria-controls="search-results"
        aria-activedescendant={results[active] ? `sr-${results[active].listing.id}` : undefined}
      />
      <ul className="search-results" id="search-results" role="listbox">
        {results.map((r, i) => (
          <li key={r.listing.id} role="option" id={`sr-${r.listing.id}`} aria-selected={i === active}>
            <button className={i === active ? 'is-active' : ''} onMouseEnter={() => setActive(i)} onClick={() => choose(r.listing.id)}>
              <Thumb art={r.listing.artwork} size="sm" />
              <span style={{ minWidth: 0 }}>
                <b>{r.listing.title}</b>
                <span className="mini-row__sub">
                  {r.listing.display} · {categoryById(r.listing.category).label}
                </span>
              </span>
              <span className="mini-row__amt">{r.entry ? `#${r.entry.rank} · ${usd(r.entry.total)}` : ''}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="muted" style={{ padding: 12 }}>No listings match “{q}”. Be the first — claim a rank!</li>}
      </ul>
      <p className="hero__fine" style={{ marginTop: 12 }}>
        <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
      </p>
    </Modal>
  );
}
