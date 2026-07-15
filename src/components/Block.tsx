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

// One free-placed piece of writing. Auto-grows to hug its text; drag the grip to
// move it; whitespace/line breaks preserved exactly (white-space: pre).
export function Block({
  block,
  autoFocus,
  onChange,
  onCommitEmpty,
  onMove,
  onDelete,
  minY = 1,
}: {
  block: BlockT;
  autoFocus: boolean;
  onChange: (text: string) => void;
  onCommitEmpty: () => void;
  onMove: (x: number, y: number) => void;
  onDelete: () => void;
  minY?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const resize = () => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    ta.style.width = `${Math.ceil(widestLine(block.text, getComputedStyle(ta).font)) + 4}px`;
  };
  useLayoutEffect(resize, [block.text]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      const ta = ref.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [autoFocus]);

  // drag the grip to reposition (works with mouse or touch via pointer events)
  const startDrag = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const page = wrap.current?.closest('.page, .mpage') as HTMLElement | null;
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
    </div>
  );
}
