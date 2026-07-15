import { useMemo, useState } from 'react';
import {
  COVERS,
  FONTS,
  defaultLook,
  type AgingMode,
  type CoverStyle,
  type FontChoice,
  type VolumeLook,
  type WearPreset,
} from '../types';
import { computeWear } from '../wear';
import { WearLayer } from './WearLayer';

const PRESETS: { id: WearPreset; label: string }[] = [
  { id: 'brand-new', label: 'brand new' },
  { id: 'well-loved', label: 'well-loved' },
  { id: 'survived-a-flood', label: 'survived a flood' },
];

// The first thing a new writer does: dress the volume they're about to fill.
// A live cover preview reacts to every choice, so the object feels chosen, not defaulted.
export function VolumeSetup({
  onComplete,
}: {
  onComplete: (title: string, look: VolumeLook) => Promise<void>;
}) {
  const [title, setTitle] = useState('Volume I');
  const [look, setLook] = useState<VolumeLook>(defaultLook());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const marks = useMemo(() => computeWear(look), [look]);
  const set = (patch: Partial<VolumeLook>) => setLook((l) => ({ ...l, ...patch }));

  const begin = async () => {
    setError('');
    setSaving(true);
    try {
      await onComplete(title.trim() || 'Volume I', look);
    } catch {
      // storage unavailable (quota / private mode) — keep the writer here, let them retry
      setError('Couldn’t save your notebook — your browser may be blocking storage (private mode?). Try again.');
      setSaving(false);
    }
  };

  return (
    <div className="setup">
      <div className={`cover-preview cover-${look.cover}`}>
        <div className="cover-inner">
          <div className="cover-rose">🥀</div>
          <div className={`cover-title font-${look.font}`}>{title || ' '}</div>
        </div>
        <WearLayer marks={marks} side="right" />
        <WearLayer marks={marks} side="left" />
      </div>

      <div className="setup-form">
        <h1>Begin a volume</h1>
        <p className="setup-sub">Dress the notebook you're about to fill. You can change your mind later.</p>

        <label className="field">
          <span>Title</span>
          <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div className="field">
          <span>Cover</span>
          <div className="swatches">
            {COVERS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch cover-${c} ${look.cover === c ? 'on' : ''}`}
                aria-label={c}
                onClick={() => set({ cover: c as CoverStyle })}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <span>Hand</span>
          <div className="segmented">
            {FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`seg font-${f.id} ${look.font === f.id ? 'on' : ''}`}
                onClick={() => set({ font: f.id as FontChoice })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Wear</span>
          <select value={look.preset} onChange={(e) => set({ preset: e.target.value as WearPreset })}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Intensity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={look.intensity}
            onChange={(e) => set({ intensity: Number(e.target.value) })}
          />
        </label>

        <div className="field">
          <span>Aging</span>
          <div className="segmented">
            {([
              ['dressed', 'Set it, then it lives'],
              ['living', 'Let it age as I use it'],
            ] as [AgingMode, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`seg ${look.agingMode === id ? 'on' : ''}`}
                onClick={() => set({ agingMode: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button className="begin" onClick={begin} disabled={saving}>
          {saving ? 'Saving…' : 'Open to the first page →'}
        </button>
        {error && <div className="setup-error">{error}</div>}
      </div>
    </div>
  );
}
