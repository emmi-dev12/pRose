import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Spread, Volume } from '../types';
import { newBlock, newSpread, nextDay } from '../types';
import { computeWear, effectiveAmount } from '../wear';
import { WearLayer } from './WearLayer';
import { Block } from './Block';

function prettyDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Static (non-editable) rendering of a page's blocks — used on the flipping leaf.
function StaticBlocks({ spread, side }: { spread: Spread; side: 'left' | 'right' }) {
  return (
    <>
      {spread.blocks
        .filter((b) => b.page === side)
        .map((b) => (
          <div key={b.id} className="block static" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            {b.text}
          </div>
        ))}
    </>
  );
}

type Flip = { dir: 'next' | 'prev'; run: boolean } | null;

export function Notebook({
  volume,
  onChange,
  onBack,
}: {
  volume: Volume;
  onChange: (v: Volume) => void;
  onBack?: () => void;
}) {
  const [i, setI] = useState(volume.spreads.length - 1); // open to the newest day
  const [flip, setFlip] = useState<Flip>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const marks = useMemo(() => computeWear(volume.look, effectiveAmount(volume)), [volume]);

  const spreads = volume.spreads;
  const cur = spreads[i];

  const setSpread = useCallback(
    (next: Spread) => onChange({ ...volume, spreads: spreads.map((s, k) => (k === i ? next : s)) }),
    [volume, spreads, i, onChange],
  );

  // click empty space on a page → start a new block right there
  const addBlock = useCallback(
    (side: 'left' | 'right', e: MouseEvent) => {
      if (flip) return;
      e.preventDefault(); // don't start a text selection on the paper
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 86);
      const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 3, 90);
      const nb = newBlock(side, x, y);
      setSpread({ ...cur, blocks: [...cur.blocks, nb] });
      setFocusId(nb.id);
    },
    [flip, cur, setSpread],
  );

  const editBlock = useCallback(
    (id: string, text: string) => {
      setSpread({ ...cur, blocks: cur.blocks.map((b) => (b.id === id ? { ...b, text } : b)) });
    },
    [cur, setSpread],
  );

  const removeBlock = useCallback(
    (id: string) => setSpread({ ...cur, blocks: cur.blocks.filter((b) => b.id !== id) }),
    [cur, setSpread],
  );

  const toggleBookmark = useCallback(
    () => setSpread({ ...cur, bookmarked: !cur.bookmarked }),
    [cur, setSpread],
  );

  const commit = useCallback((dir: 'next' | 'prev') => {
    setI((n) => n + (dir === 'next' ? 1 : -1));
    setFlip(null);
  }, []);

  const turn = useCallback(
    (dir: 'next' | 'prev') => {
      if (flip) return;
      if (dir === 'prev' && i === 0) return;
      if (dir === 'next' && i === spreads.length - 1) {
        onChange({ ...volume, spreads: [...spreads, newSpread(nextDay(cur.date))] }); // fresh day
      }
      setFlip({ dir, run: false });
    },
    [flip, i, spreads, cur, volume, onChange],
  );

  useEffect(() => {
    if (flip && !flip.run) {
      const id = requestAnimationFrame(() => setFlip((f) => (f ? { ...f, run: true } : f)));
      return () => cancelAnimationFrame(id);
    }
  }, [flip]);

  // arrow keys turn pages — but only when not writing (caret in a block wins)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowRight') turn('next');
      if (e.key === 'ArrowLeft') turn('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  const dest = flip ? spreads[i + (flip.dir === 'next' ? 1 : -1)] : null;
  const baseLeft = flip?.dir === 'prev' ? dest! : cur;
  const baseRight = flip?.dir === 'next' ? dest! : cur;

  const editableBlocks = (side: 'left' | 'right') =>
    cur.blocks
      .filter((b) => b.page === side)
      .map((b) => (
        <Block
          key={b.id}
          block={b}
          autoFocus={b.id === focusId}
          onChange={(t) => editBlock(b.id, t)}
          onCommitEmpty={() => removeBlock(b.id)}
        />
      ));

  const emptyHint = (spread: Spread, side: 'left' | 'right') =>
    !flip && spread.blocks.filter((b) => b.page === side).length === 0 ? (
      <div className="page-hint">click anywhere to write</div>
    ) : null;

  return (
    <div className="stage">
      <div
        className={`book font-${volume.look.font} ${volume.look.lined ? 'lined' : ''}`}
        style={{ perspective: 2200 }}
      >
        {/* left page */}
        <div className="page left" onMouseDown={(e) => addBlock('left', e)}>
          <div className="page-date">{prettyDate(baseLeft.date)}</div>
          <WearLayer marks={marks} side="left" />
          {flip ? <StaticBlocks spread={baseLeft} side="left" /> : editableBlocks('left')}
          {emptyHint(baseLeft, 'left')}
        </div>

        {/* right page */}
        <div className="page right" onMouseDown={(e) => addBlock('right', e)}>
          <WearLayer marks={marks} side="right" />
          {flip ? <StaticBlocks spread={baseRight} side="right" /> : editableBlocks('right')}
          {emptyHint(baseRight, 'right')}
        </div>

        {/* flipping leaf */}
        {flip && dest && (
          <div className={`leaf ${flip.dir} ${flip.run ? 'run' : ''}`} onTransitionEnd={() => commit(flip.dir)}>
            <div className="face front">
              {flip.dir === 'prev' && <div className="page-date">{prettyDate(cur.date)}</div>}
              <WearLayer marks={marks} side={flip.dir === 'next' ? 'right' : 'left'} />
              <StaticBlocks spread={cur} side={flip.dir === 'next' ? 'right' : 'left'} />
            </div>
            <div className="face back">
              {flip.dir === 'next' && <div className="page-date">{prettyDate(dest.date)}</div>}
              <WearLayer marks={marks} side={flip.dir === 'next' ? 'left' : 'right'} />
              <StaticBlocks spread={dest} side={flip.dir === 'next' ? 'left' : 'right'} />
            </div>
          </div>
        )}

        {/* rose bookmark tucked into this spread */}
        {cur.bookmarked && !flip && (
          <img
            className="bookmark"
            src="./rose.svg"
            alt="bookmark"
            title="Remove bookmark"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleBookmark}
          />
        )}

        {/* edge affordances */}
        <button className="turn prev" onMouseDown={(e) => e.stopPropagation()} onClick={() => turn('prev')} disabled={i === 0} aria-label="previous day">‹</button>
        <button className="turn next" onMouseDown={(e) => e.stopPropagation()} onClick={() => turn('next')} aria-label="next day">›</button>
      </div>

      <div className="controls">
        {onBack && (
          <button className="shelf-link" onClick={onBack} title="Back to the shelf">
            🥀 shelf
          </button>
        )}
        <span className="brand">{volume.title}</span>
        <button
          className={`bookmark-btn ${cur.bookmarked ? 'on' : ''}`}
          onClick={toggleBookmark}
          title="Bookmark this page"
        >
          🌹 {cur.bookmarked ? 'bookmarked' : 'bookmark'}
        </button>
        <span className="hint">← → to turn the page</span>
      </div>
    </div>
  );
}
