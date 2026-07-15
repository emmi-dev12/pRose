import type { WearMarks } from '../wear';

// Renders wear as an SVG overlay coherent with the physical object:
// - the coffee ring sits on the left page and ghosts faintly through to the right
// - the spine crease darkens the gutter (inner edge of each page)
// - the dog-ear softens the outer-bottom corner
// Pointer-events off so it never interferes with writing.
export function WearLayer({ marks, side }: { marks: WearMarks; side: 'left' | 'right' }) {
  const inner = side === 'left' ? 'right' : 'left'; // gutter side
  const outer = side; // outer edge / dog-ear corner side

  return (
    <svg
      className="wear"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`spine-${side}`}
          x1={inner === 'left' ? '0' : '1'}
          x2={inner === 'left' ? '1' : '0'}
          y1="0"
          y2="0"
        >
          <stop offset="0%" stopColor={`rgba(40,26,12,${marks.spine * 0.5})`} />
          <stop offset="14%" stopColor="rgba(40,26,12,0)" />
        </linearGradient>
        {/* aged paper: edges yellow-brown and darken with age */}
        <radialGradient id={`edge-${side}`} cx="50%" cy="48%" r="70%">
          <stop offset="55%" stopColor="rgba(112,78,34,0)" />
          <stop offset="100%" stopColor={`rgba(112,78,34,${0.04 + marks.amount * 0.3})`} />
        </radialGradient>
      </defs>

      {/* aged edge darkening */}
      <rect x="0" y="0" width="100" height="100" fill={`url(#edge-${side})`} />

      {/* spine crease at the gutter */}
      <rect x="0" y="0" width="100" height="100" fill={`url(#spine-${side})`} />

      {/* scattered ink smudges */}
      {marks.smudges.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={`rgba(30,26,22,${s.o})`}
        />
      ))}

      {/* dog-eared outer-bottom corner */}
      {marks.dogEar > 0.12 && (
        <polygon
          points={
            outer === 'left'
              ? `0,100 ${10 * marks.dogEar},100 0,${100 - 10 * marks.dogEar}`
              : `100,100 ${100 - 10 * marks.dogEar},100 100,${100 - 10 * marks.dogEar}`
          }
          fill="rgba(0,0,0,0.14)"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth="0.3"
        />
      )}
    </svg>
  );
}
