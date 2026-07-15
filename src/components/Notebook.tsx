import { type MouseEvent, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import type { LoosePage, Spread, Volume } from '../types';
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
const PROTECT_Y = 9; // % reserved at the top for the date — no blocks up here
const MOBILE = '(max-width: 700px)';

// Static (non-editable) rendering of a page's blocks — used on the flipping leaf.
function StaticBlocks({ spread, side }: { spread: Spread; side: 'left' | 'right' }) {
  return (
    <>
      {spread.blocks
        .filter((b) => b.page === side)
        .map((b) => (
          <div
            key={b.id}
            className="block static"
            style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.w != null ? `${b.w}%` : undefined }}
          >
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
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;
      if (rawY < PROTECT_Y) return; // the date's protected header — don't start a block here
      const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 86);
      const y = clamp(rawY, PROTECT_Y, 90);
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

  const moveBlock = useCallback(
    (id: string, x: number, y: number) =>
      setSpread({ ...cur, blocks: cur.blocks.map((b) => (b.id === id ? { ...b, x, y } : b)) }),
    [cur, setSpread],
  );
  const resizeBlock = useCallback(
    (id: string, w: number) =>
      setSpread({ ...cur, blocks: cur.blocks.map((b) => (b.id === id ? { ...b, w } : b)) }),
    [cur, setSpread],
  );

  // deliberate delete → the block rests in the volume's loose-pages drawer
  const deleteBlock = useCallback(
    (id: string) => {
      const blk = cur.blocks.find((b) => b.id === id);
      const blocks = cur.blocks.filter((b) => b.id !== id);
      const loose =
        blk && blk.text.trim()
          ? [{ id: crypto.randomUUID(), text: blk.text, discardedAt: new Date().toISOString() }, ...(volume.loosePages ?? [])]
          : volume.loosePages ?? [];
      onChange({ ...volume, loosePages: loose, spreads: spreads.map((s, k) => (k === i ? { ...s, blocks } : s)) });
    },
    [cur, volume, spreads, i, onChange],
  );

  const currentSide: 'left' | 'right' = mobile ? mSide : 'left';
  const restoreLoose = useCallback(
    (lp: LoosePage) => {
      const nb = { ...newBlock(currentSide, 8, 10), text: lp.text };
      onChange({
        ...volume,
        loosePages: (volume.loosePages ?? []).filter((x) => x.id !== lp.id),
        spreads: spreads.map((s, k) => (k === i ? { ...s, blocks: [...s.blocks, nb] } : s)),
      });
    },
    [currentSide, volume, spreads, i, onChange],
  );
  const discardLoose = useCallback(
    (id: string) => onChange({ ...volume, loosePages: (volume.loosePages ?? []).filter((x) => x.id !== id) }),
    [volume, onChange],
  );
  const clearLoose = useCallback(() => onChange({ ...volume, loosePages: [] }), [volume, onChange]);

  // remove the whole day/spread — its writing goes to loose pages first (nothing lost)
  const deletePage = useCallback(() => {
    if (spreads.length <= 1) return; // always keep at least one page
    if (cur.blocks.length && !window.confirm(`Remove ${prettyDate(cur.date)}? Its writing moves to loose pages.`)) return;
    const moved = cur.blocks
      .filter((b) => b.text.trim())
      .map((b) => ({ id: crypto.randomUUID(), text: b.text, discardedAt: new Date().toISOString() }));
    const nextSpreads = spreads.filter((_, k) => k !== i);
    onChange({ ...volume, loosePages: [...moved, ...(volume.loosePages ?? [])], spreads: nextSpreads });
    setFlip(null);
    setMFlip(null);
    setMSide('left');
    setI(Math.min(i, nextSpreads.length - 1));
  }, [spreads, cur, i, volume, onChange]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const bookRef = useRef<HTMLDivElement>(null);

  // jump straight to a spread (and, on mobile, the right leaf)
  const jumpTo = useCallback((idx: number, side: 'left' | 'right' = 'left') => {
    setFlip(null);
    setMFlip(null);
    setI(idx);
    setMSide(side);
    setContentsOpen(false);
    setQuery('');
  }, []);

  const exportImage = useCallback(async () => {
    if (!bookRef.current) return;
    const url = await toPng(bookRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${volume.slug}-${cur.date}.png`;
    a.click();
  }, [volume.slug, cur.date]);

  const exportPdf = useCallback(() => window.print(), []);

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
          onMove={(x, y) => moveBlock(b.id, x, y)}
          onResize={(w) => resizeBlock(b.id, w)}
          onDelete={() => deleteBlock(b.id)}
          minY={PROTECT_Y}
        />
      ));

  const looseCount = volume.loosePages?.length ?? 0;

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
      <button className="ctl-btn" onClick={() => setContentsOpen(true)} title="Contents & search">
        ☰ contents
      </button>
      <button className="ctl-btn" onClick={() => setDrawerOpen(true)} title="Loose pages (deleted)">
        🍂 loose{looseCount ? ` (${looseCount})` : ''}
      </button>
      <button className="ctl-btn" onClick={exportImage} title="Save this spread as an image">
        ⤓ image
      </button>
      <button className="ctl-btn" onClick={exportPdf} title="Export the whole volume as a PDF">
        ⤓ pdf
      </button>
      <button
        className="ctl-btn danger"
        onClick={deletePage}
        disabled={spreads.length <= 1}
        title="Remove this day (its writing moves to loose pages)"
      >
        ✕ page
      </button>
      <span className="hint">{mobile ? 'swipe to turn' : '← → to turn the page'}</span>
    </div>
  );

  const firstLine = (t: string) => (t.split('\n').find((l) => l.trim()) ?? '').trim();
  const q = query.trim().toLowerCase();
  const results = q
    ? spreads.flatMap((s, idx) =>
        s.blocks
          .filter((b) => b.text.toLowerCase().includes(q))
          .map((b) => {
            const line = b.text.split('\n').find((l) => l.toLowerCase().includes(q)) ?? firstLine(b.text);
            return { idx, side: b.page, date: s.date, snippet: line.trim().slice(0, 80) };
          }),
      )
    : [];

  const contents = contentsOpen && (
    <div className="drawer-scrim" onClick={() => setContentsOpen(false)}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>☰ Contents</h2>
          <button className="ctl-btn" onClick={() => setContentsOpen(false)}>close</button>
        </div>
        <input
          className="toc-search"
          type="search"
          placeholder="search this volume…"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {q ? (
          results.length ? (
            <ul className="toc-list">
              {results.map((r, k) => (
                <li key={k}>
                  <button className="toc-item" onClick={() => jumpTo(r.idx, r.side)}>
                    <span className="toc-date">{prettyDate(r.date)}</span>
                    <span className="toc-preview">{r.snippet || '…'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="drawer-empty">No matches for “{query}”.</p>
          )
        ) : (
          <ul className="toc-list">
            {spreads.map((s, idx) => {
              const first = s.blocks[0];
              return (
                <li key={s.id}>
                  <button className="toc-item" onClick={() => jumpTo(idx, first?.page ?? 'left')}>
                    <span className="toc-date">
                      {s.bookmarked ? '🌹 ' : ''}
                      {prettyDate(s.date)}
                    </span>
                    <span className="toc-preview">{first ? firstLine(first.text) || '…' : '— empty —'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const drawer = drawerOpen && (
    <div className="drawer-scrim" onClick={() => setDrawerOpen(false)}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>🍂 Loose pages</h2>
          <button className="ctl-btn" onClick={() => setDrawerOpen(false)}>close</button>
        </div>
        <p className="drawer-sub">Deleted pieces rest here until you restore or clear them.</p>
        {looseCount === 0 ? (
          <p className="drawer-empty">Nothing loose. Deleted writing lands here.</p>
        ) : (
          <>
            <ul className="loose-list">
              {(volume.loosePages ?? []).map((lp) => (
                <li key={lp.id} className="loose-item">
                  <pre className="loose-text">{lp.text}</pre>
                  <div className="loose-actions">
                    <button className="ctl-btn" onClick={() => restoreLoose(lp)}>restore</button>
                    <button className="ctl-btn danger" onClick={() => discardLoose(lp.id)}>discard</button>
                  </div>
                </li>
              ))}
            </ul>
            <button className="ctl-btn danger" onClick={clearLoose}>clear all</button>
          </>
        )}
      </div>
    </div>
  );

  // print-only rendering of the whole volume (for "export pdf" → Save as PDF)
  const printView = (
    <div className="print-root" aria-hidden="true">
      {spreads.map((s) => (
        <section className="print-spread" key={s.id}>
          <div className="print-date">{prettyDate(s.date)}</div>
          <div className="print-pages">
            {(['left', 'right'] as const).map((side) => (
              <div className="print-page" key={side}>
                {s.blocks
                  .filter((b) => b.page === side)
                  .map((b) => (
                    <div key={b.id} className="print-block" style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.w != null ? `${b.w}%` : undefined }}>
                      {b.text}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </section>
      ))}
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
          ref={bookRef}
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
        {contents}
        {drawer}
        {printView}
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
        ref={bookRef}
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
      {contents}
        {drawer}
      {printView}
    </div>
  );
}
