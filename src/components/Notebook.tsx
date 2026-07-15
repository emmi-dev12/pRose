import { type MouseEvent, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spread, Volume } from '../types';
import { newBlock, newSpread, nextDay } from '../types';
import { computeWear, effectiveAmount } from '../wear';
import { WearLayer } from './WearLayer';
import { Block } from './Block';
import roseUrl from '../assets/rose.svg'; // bundled/inlined so it works as a single file

function prettyDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const MOBILE = '(max-width: 700px)';

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
type MFlip = { dir: 'next' | 'prev'; run: boolean; ti: number; tside: 'left' | 'right' } | null;

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
  const [mSide, setMSide] = useState<'left' | 'right'>('left'); // mobile: which leaf
  const [flip, setFlip] = useState<Flip>(null); // desktop spread flip
  const [mFlip, setMFlip] = useState<MFlip>(null); // mobile single-page flip
  const [focusId, setFocusId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE).matches);
  const marks = useMemo(() => computeWear(volume.look, effectiveAmount(volume)), [volume]);

  const spreads = volume.spreads;
  const cur = spreads[i];
  const last = spreads.length - 1;

  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const setSpread = useCallback(
    (next: Spread) => onChange({ ...volume, spreads: spreads.map((s, k) => (k === i ? next : s)) }),
    [volume, spreads, i, onChange],
  );

  // click empty space on a page → start a new block right there
  const addBlock = useCallback(
    (side: 'left' | 'right', e: MouseEvent) => {
      if (flip || mFlip) return;
      e.preventDefault(); // don't start a text selection on the paper
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 86);
      const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 3, 90);
      const nb = newBlock(side, x, y);
      setSpread({ ...cur, blocks: [...cur.blocks, nb] });
      setFocusId(nb.id);
    },
    [flip, mFlip, cur, setSpread],
  );

  const editBlock = useCallback(
    (id: string, text: string) =>
      setSpread({ ...cur, blocks: cur.blocks.map((b) => (b.id === id ? { ...b, text } : b)) }),
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

  // ---- desktop: whole-spread flip ----
  const commit = useCallback((dir: 'next' | 'prev') => {
    setI((n) => n + (dir === 'next' ? 1 : -1));
    setFlip(null);
  }, []);

  const turn = useCallback(
    (dir: 'next' | 'prev') => {
      if (flip) return;
      if (dir === 'prev' && i === 0) return;
      if (dir === 'next' && i === last) {
        onChange({ ...volume, spreads: [...spreads, newSpread(nextDay(cur.date))] });
      }
      setFlip({ dir, run: false });
    },
    [flip, i, last, spreads, cur, volume, onChange],
  );

  // ---- mobile: single-leaf flip (left → right → next day's left → …) ----
  const mCommit = useCallback((f: MFlip) => {
    if (!f) return;
    setI(f.ti);
    setMSide(f.tside);
    setMFlip(null);
  }, []);

  const mTurn = useCallback(
    (dir: 'next' | 'prev') => {
      if (mFlip) return;
      let ti = i;
      let tside: 'left' | 'right';
      if (dir === 'next') {
        if (mSide === 'left') tside = 'right';
        else {
          ti = i + 1;
          tside = 'left';
          if (i === last) onChange({ ...volume, spreads: [...spreads, newSpread(nextDay(cur.date))] });
        }
      } else {
        if (mSide === 'right') tside = 'left';
        else if (i > 0) {
          ti = i - 1;
          tside = 'right';
        } else return; // at the very first page
      }
      setMFlip({ dir, run: false, ti, tside });
    },
    [mFlip, i, last, mSide, spreads, cur, volume, onChange],
  );

  // kick the CSS transition on the frame after either flip mounts
  useEffect(() => {
    if (flip && !flip.run) {
      const id = requestAnimationFrame(() => setFlip((f) => (f ? { ...f, run: true } : f)));
      return () => cancelAnimationFrame(id);
    }
  }, [flip]);
  useEffect(() => {
    if (mFlip && !mFlip.run) {
      const id = requestAnimationFrame(() => setMFlip((f) => (f ? { ...f, run: true } : f)));
      return () => cancelAnimationFrame(id);
    }
  }, [mFlip]);

  const turnActive = useCallback(
    (dir: 'next' | 'prev') => (window.matchMedia(MOBILE).matches ? mTurn(dir) : turn(dir)),
    [mTurn, turn],
  );

  // arrow keys turn pages — but only when not writing (caret in a block wins)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowRight') turnActive('next');
      if (e.key === 'ArrowLeft') turnActive('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turnActive]);

  // swipe sideways to turn (touch) — ignored when the swipe starts on text
  const touch = useRef({ x: 0, y: 0, on: false });
  const onTouchStart = (e: TouchEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, on: true };
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch.current.on) return;
    touch.current.on = false;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) turnActive(dx < 0 ? 'next' : 'prev');
  };

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

  const hint = (spread: Spread, side: 'left' | 'right', show: boolean) =>
    show && spread.blocks.filter((b) => b.page === side).length === 0 ? (
      <div className="page-hint">{mobile ? 'tap anywhere to write' : 'click anywhere to write'}</div>
    ) : null;

  const controls = (
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
      <span className="hint">{mobile ? 'swipe to turn' : '← → to turn the page'}</span>
    </div>
  );

  const bookmark = cur.bookmarked && !flip && !mFlip && (
    <img
      className="bookmark"
      src={roseUrl}
      alt="bookmark"
      title="Remove bookmark"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={toggleBookmark}
    />
  );

  // ---------------- MOBILE: one leaf at a time, with a 3D flip ----------------
  if (mobile) {
    const dest = mFlip ? spreads[mFlip.ti] : null;
    const baseSpread = mFlip ? dest! : cur;
    const baseSide = mFlip ? mFlip.tside : mSide;
    return (
      <div className="stage mstage">
        <div
          className={`mbook font-${volume.look.font} ${volume.look.lined ? 'lined' : ''}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="page mpage" onMouseDown={(e) => addBlock(mSide, e)}>
            <div className="page-date">{prettyDate(baseSpread.date)}</div>
            <WearLayer marks={marks} side={baseSide} />
            {mFlip ? <StaticBlocks spread={baseSpread} side={baseSide} /> : editableBlocks(mSide)}
            {hint(cur, mSide, !mFlip)}
          </div>

          {mFlip && dest && (
            <div className={`leaf-m ${mFlip.dir} ${mFlip.run ? 'run' : ''}`} onTransitionEnd={() => mCommit(mFlip)}>
              <div className="face-m front page mpage">
                <div className="page-date">{prettyDate(cur.date)}</div>
                <WearLayer marks={marks} side={mSide} />
                <StaticBlocks spread={cur} side={mSide} />
              </div>
              <div className="face-m back page mpage">
                <div className="page-date">{prettyDate(dest.date)}</div>
                <WearLayer marks={marks} side={mFlip.tside} />
                <StaticBlocks spread={dest} side={mFlip.tside} />
              </div>
            </div>
          )}

          {bookmark}
        </div>
        {controls}
      </div>
    );
  }

  // ---------------- DESKTOP: two-page spread ----------------
  const dest = flip ? spreads[i + (flip.dir === 'next' ? 1 : -1)] : null;
  const baseLeft = flip?.dir === 'prev' ? dest! : cur;
  const baseRight = flip?.dir === 'next' ? dest! : cur;

  return (
    <div className="stage">
      <div
        className={`book font-${volume.look.font} ${volume.look.lined ? 'lined' : ''}`}
        style={{ perspective: 2200 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="page left" onMouseDown={(e) => addBlock('left', e)}>
          <div className="page-date">{prettyDate(baseLeft.date)}</div>
          <WearLayer marks={marks} side="left" />
          {flip ? <StaticBlocks spread={baseLeft} side="left" /> : editableBlocks('left')}
          {hint(baseLeft, 'left', !flip)}
        </div>

        <div className="page right" onMouseDown={(e) => addBlock('right', e)}>
          <WearLayer marks={marks} side="right" />
          {flip ? <StaticBlocks spread={baseRight} side="right" /> : editableBlocks('right')}
          {hint(baseRight, 'right', !flip)}
        </div>

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

        {bookmark}

        <button className="turn prev" onMouseDown={(e) => e.stopPropagation()} onClick={() => turn('prev')} disabled={i === 0} aria-label="previous day">‹</button>
        <button className="turn next" onMouseDown={(e) => e.stopPropagation()} onClick={() => turn('next')} aria-label="next day">›</button>
      </div>

      {controls}
    </div>
  );
}
