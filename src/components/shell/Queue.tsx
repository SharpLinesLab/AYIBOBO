import { Reorder, useDragControls } from 'motion/react';
import { useEffect, useState } from 'react';
import { usePlayerState } from '../../music';
import { getUpNext, jumpTo, removeFromQueue, reorderUpNext, type Playable } from '../../player/engine';
import { CloseIcon } from '../icons';
import { Eq } from '../music/bits';

function Row({ p, current, playing, onPick }: { p: Playable; current?: boolean; playing?: boolean; onPick?: () => void }) {
  return (
    <>
      <button className="qrow__main" onClick={() => (jumpTo(p.id), onPick?.())}>
        {p.artwork && <img src={p.artwork} alt="" width={40} height={40} />}
        <span>
          <b>{p.title}</b>
          <small>{p.subtitle}</small>
        </span>
        {current && <Eq paused={!playing} />}
      </button>
      {!current && (
        <button className="icon-toggle" onClick={() => removeFromQueue(p.id)} aria-label={`Remove ${p.title} from queue`}>
          <CloseIcon width={16} height={16} />
        </button>
      )}
    </>
  );
}

/** A queued song you can drag by its handle (pointer) or move with the ↑/↓ buttons (keyboard). */
function DraggableRow({ p, index, count, onMove, onPick, onDrop }: { p: Playable; index: number; count: number; onMove: (from: number, to: number) => void; onPick?: () => void; onDrop: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={p} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="qrow qrow--drag" whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,0.35)' }}>
      <span className="qrow__handle" onPointerDown={(e) => controls.start(e)} aria-hidden title="Drag to reorder">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>
      <Row p={p} onPick={onPick} />
      <span className="qrow__move">
        <button className="icon-toggle" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label={`Move ${p.title} up`}>
          ↑
        </button>
        <button className="icon-toggle" onClick={() => onMove(index, index + 1)} disabled={index === count - 1} aria-label={`Move ${p.title} down`}>
          ↓
        </button>
      </span>
    </Reorder.Item>
  );
}

export function QueueList({ onPick }: { onPick?: () => void }) {
  const s = usePlayerState();
  const upNext = getUpNext();
  const key = upNext.map((p) => p.id).join('|');
  const [mine, setMine] = useState(() => upNext.filter((p) => !p.autoplay));
  // Follow the engine whenever the queue changes from outside (a drag commits on drop).
  useEffect(() => setMine(getUpNext().filter((p) => !p.autoplay)), [key]);
  const auto = upNext.filter((p) => p.autoplay);
  const commit = (list: Playable[]) => reorderUpNext([...list, ...auto].map((p) => p.id));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= mine.length) return;
    const list = [...mine];
    const [it] = list.splice(from, 1);
    list.splice(to, 0, it);
    setMine(list);
    commit(list);
  };

  return (
    <div className="queue">
      {s.current && (
        <>
          <h4>Now playing</h4>
          <ul>
            <li className="qrow is-current">
              <Row p={s.current} current playing={s.playing} onPick={onPick} />
            </li>
          </ul>
        </>
      )}
      <h4>Up next {mine.length > 0 && <span className="muted">· {mine.length}</span>}</h4>
      {mine.length ? (
        <Reorder.Group axis="y" values={mine} onReorder={setMine} as="ul" className="queue__list">
          {mine.map((p, i) => (
            <DraggableRow key={p.id} p={p} index={i} count={mine.length} onMove={move} onPick={onPick} onDrop={() => commit(mine)} />
          ))}
        </Reorder.Group>
      ) : (
        <p className="muted queue__empty">{s.autoplay ? 'When your music ends, ASF keeps going with similar songs.' : 'Nothing queued. Use “⋯ → Add to queue” on any song.'}</p>
      )}
      {auto.length > 0 && (
        <>
          <h4>
            Autoplay <span className="muted">· similar songs</span>
          </h4>
          <ul>
            {auto.map((p) => (
              <li key={p.id} className="qrow">
                <Row p={p} onPick={onPick} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
