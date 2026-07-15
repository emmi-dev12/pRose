import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Volume, WearPreset } from '../types';
import { newSpread } from '../types';
import { computeWear } from '../wear';
import { WearLayer } from './WearLayer';
import { PoemEditor } from './PoemEditor';

const PRESETS: WearPreset[] = ['brand-new', 'well-loved', 'survived-a-flood'];

function nextDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function prettyDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
  const marks = useMemo(() => computeWear(volume.look), [volume.look]);

  const spreads = volume.spreads;
  const cur = spreads[i];

  const editText = useCallback(
    (field: 'leftText' | 'rightText', value: string) => {
      const next = { ...cur, [field]: value };
      onChange({ ...volume, spreads: spreads.map((s, k) => (k === i ? next : s)) });
    },
    [cur, i, spreads, volume, onChange],
  );

  const commit = useCallback(
    (dir: 'next' | 'prev') => {
      setI((n) => n + (dir === 'next' ? 1 : -1));
      setFlip(null);
    },
    [],
  );

  const turn = useCallback(
    (dir: 'next' | 'prev') => {
      if (flip) return;
      if (dir === 'prev' && i === 0) return;
      if (dir === 'next' && i === spreads.length - 1) {
        // page forward into a fresh day
        onChange({ ...volume, spreads: [...spreads, newSpread(nextDay(cur.date))] });
      }
      setFlip({ dir, run: false });
    },
    [flip, i, spreads, cur, volume, onChange],
  );

  // kick the CSS transition on the frame after mount
  useEffect(() => {
    if (flip && !flip.run) {
      const id = requestAnimationFrame(() => setFlip((f) => (f ? { ...f, run: true } : f)));
      return () => cancelAnimationFrame(id);
    }
  }, [flip]);

  // arrow keys turn pages — but only when not writing (caret in a textarea wins)
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

  // what shows underneath while a leaf is flipping (see notes in types.ts / plan)
  const dest = flip ? spreads[i + (flip.dir === 'next' ? 1 : -1)] : null;
  const baseLeft = flip?.dir === 'next' ? cur : flip?.dir === 'prev' ? dest! : cur;
  const baseRight = flip?.dir === 'next' ? dest! : flip?.dir === 'prev' ? cur : cur;

  return (
    <div className="stage">
      <div className={`book font-${volume.look.font}`} style={{ perspective: 2200 }}>
        {/* left page */}
        <div className="page left">
          <div className="page-date">{prettyDate(baseLeft.date)}</div>
          <PoemEditor
            value={baseLeft.leftText}
            disabled={!!flip}
            onChange={(v) => editText('leftText', v)}
            placeholder={'begin…'}
          />
          <WearLayer marks={marks} side="left" />
        </div>

        {/* right page */}
        <div className="page right">
          <PoemEditor
            value={baseRight.rightText}
            disabled={!!flip}
            onChange={(v) => editText('rightText', v)}
          />
          <WearLayer marks={marks} side="right" />
        </div>

        {/* flipping leaf */}
        {flip && dest && (
          <div
            className={`leaf ${flip.dir} ${flip.run ? 'run' : ''}`}
            onTransitionEnd={() => commit(flip.dir)}
          >
            <div className="face front">
              {flip.dir === 'next' ? (
                <PoemEditor value={cur.rightText} disabled onChange={() => {}} />
              ) : (
                <>
                  <div className="page-date">{prettyDate(cur.date)}</div>
                  <PoemEditor value={cur.leftText} disabled onChange={() => {}} />
                </>
              )}
              <WearLayer marks={marks} side={flip.dir === 'next' ? 'right' : 'left'} />
            </div>
            <div className="face back">
              {flip.dir === 'next' ? (
                <>
                  <div className="page-date">{prettyDate(dest.date)}</div>
                  <PoemEditor value={dest.leftText} disabled onChange={() => {}} />
                </>
              ) : (
                <PoemEditor value={dest.rightText} disabled onChange={() => {}} />
              )}
              <WearLayer marks={marks} side={flip.dir === 'next' ? 'left' : 'right'} />
            </div>
          </div>
        )}

        {/* edge affordances */}
        <button className="turn prev" onClick={() => turn('prev')} disabled={i === 0} aria-label="previous day">‹</button>
        <button className="turn next" onClick={() => turn('next')} aria-label="next day">›</button>
      </div>

      <div className="controls">
        {onBack && (
          <button className="shelf-link" onClick={onBack} title="Back to the shelf">
            🥀 shelf
          </button>
        )}
        <span className="brand">{volume.title}</span>
        <label>
          wear&nbsp;
          <select
            value={volume.look.preset}
            onChange={(e) =>
              onChange({ ...volume, look: { ...volume.look, preset: e.target.value as WearPreset } })
            }
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/-/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          intensity&nbsp;
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume.look.intensity}
            onChange={(e) =>
              onChange({ ...volume, look: { ...volume.look, intensity: Number(e.target.value) } })
            }
          />
        </label>
        <span className="hint">← → to turn the page</span>
      </div>
    </div>
  );
}
