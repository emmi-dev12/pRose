import { useEffect, useLayoutEffect, useRef } from 'react';
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

// One free-placed piece of writing. Auto-grows in both directions so it hugs the
// text; whitespace/line breaks preserved exactly (white-space: pre).
export function Block({
  block,
  autoFocus,
  onChange,
  onCommitEmpty,
}: {
  block: BlockT;
  autoFocus: boolean;
  onChange: (text: string) => void;
  onCommitEmpty: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    const font = getComputedStyle(ta).font;
    ta.style.width = `${Math.ceil(widestLine(block.text, font)) + 4}px`;
  };

  useLayoutEffect(resize, [block.text]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      const ta = ref.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      className="block"
      style={{ left: `${block.x}%`, top: `${block.y}%` }}
      value={block.text}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (block.text.trim() === '') onCommitEmpty();
      }}
      // clicks inside a block edit it — don't let the page create a new one
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
