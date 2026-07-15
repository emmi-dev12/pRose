import { type PointerEvent, useEffect, useLayoutEffect, useRef } from 'react';
import type { Block as BlockT } from '../types';

// measure the widest line of text in a given font (shared offscreen canvas)
let ctx: CanvasRenderingContext2D | null = null;
function widestLine(text: string, font: string): number {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  let w = 0;
  for (const line of text.split('\n')) w = Math.max(w, ctx.measureText(line).width);
  return w;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const MIN_W = 48; // px

// One free-placed piece of writing. Auto-grows to hug its text but never past the
// page edge (long lines wrap). Drag the grip to move; drag the right handle to
// resize the width. Whitespace/line breaks preserved (white-space: pre-wrap).
export function Block({
  block,
  autoFocus,
  onChange,
  onCommitEmpty,
  onMove,
  onResize,
  onDelete,
  minY = 1,
}: {
  block: BlockT;
  autoFocus: boolean;
  onChange: (text: string) => void;
  onCommitEmpty: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number) => void;
  onDelete: () => void;
  minY?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const pageEl = () => wrap.current?.closest('.page, .mpage') as HTMLElement | null;

  // how much room remains from this block's left edge to the page's right margin
  const availablePx = () => {
    const page = pageEl();
    if (!page || !wrap.current) return 600;
    const pr = page.getBoundingClientRect();
    const br = wrap.current.getBoundingClientRect();
    const padRight = parseFloat(getComputedStyle(page).paddingRight) || 24;
    return Math.max(MIN_W, pr.right - padRight - br.left);
  };

  const resize = () => {
    const ta = ref.current;
    const page = pageEl();
    if (!ta || !page) return;
    const avail = availablePx();
    const natural = Math.ceil(widestLine(block.text, getComputedStyle(ta).font)) + 6;
    const target = block.w != null ? (block.w / 100) * page.clientWidth : natural;
    ta.style.width = `${clamp(target, MIN_W, avail)}px`; // never past the page edge → wraps
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  };
  useLayoutEffect(resize, [block.text, block.w]);
  useEffect(() => {
    const on = () => resize();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  });

  useEffect(() => {
    if (autoFocus && ref.current) {
      const ta = ref.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [autoFocus]);

  const startDrag = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const page = pageEl();
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const move = (ev: globalThis.PointerEvent) => {
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100, 1, 92);
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100, minY, 94);
      onMove(x, y);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startResize = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const page = pageEl();
    if (!page || !wrap.current) return;
    const left = wrap.current.getBoundingClientRect().left;
    const move = (ev: globalThis.PointerEvent) => {
      const widthPx = clamp(ev.clientX - left, MIN_W, availablePx());
      onResize((widthPx / page.clientWidth) * 100);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={wrap}
      className="block-wrap"
      style={{ left: `${block.x}%`, top: `${block.y}%` }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <span className="block-grip" title="Drag to move" onPointerDown={startDrag}>
        ⠿
      </span>
      <button className="block-del" title="Delete (to loose pages)" onClick={onDelete}>
        ×
      </button>
      <textarea
        ref={ref}
        className="block"
        value={block.text}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (block.text.trim() === '') onCommitEmpty();
        }}
      />
      <span className="block-size" title="Drag to resize" onPointerDown={startResize} />
    </div>
  );
}
