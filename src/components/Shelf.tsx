import { useMemo } from 'react';
import type { Library, Volume } from '../types';
import { computeWear } from '../wear';
import { WearLayer } from './WearLayer';

function Spine({
  volume,
  onOpen,
  onDelete,
}: {
  volume: Volume;
  onOpen: (slug: string) => void;
  onDelete: (v: Volume) => void;
}) {
  const marks = useMemo(() => computeWear(volume.look), [volume.look]);
  return (
    <div className={`shelf-book cover-${volume.look.cover}`}>
      <button className="shelf-open" onClick={() => onOpen(volume.slug)} aria-label={`Open ${volume.title}`}>
        <div className="shelf-cover-inner">
          <div className="shelf-rose">🥀</div>
          <div className={`shelf-title font-${volume.look.font}`}>{volume.title}</div>
          <div className="shelf-slug">/{volume.slug}</div>
        </div>
        <WearLayer marks={marks} side="right" />
      </button>
      <button className="shelf-delete" title="Delete this volume" onClick={() => onDelete(volume)}>
        ×
      </button>
    </div>
  );
}

// The bookshelf: every volume you own, plus a way to start a new one.
export function Shelf({
  library,
  onOpen,
  onNew,
  onLock,
  onDelete,
}: {
  library: Library;
  onOpen: (slug: string) => void;
  onNew: () => void;
  onLock: () => void;
  onDelete: (v: Volume) => void;
}) {
  const volumes = [...library.volumes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="shelf">
      <header className="shelf-head">
        <h1>🥀 pRose</h1>
        <button className="lock-btn" onClick={onLock} title="Lock and forget this device">
          Lock
        </button>
      </header>
      <p className="shelf-sub">Open a volume, or begin a new one.</p>

      <div className="shelf-grid">
        {volumes.map((v) => (
          <Spine key={v.id} volume={v} onOpen={onOpen} onDelete={onDelete} />
        ))}
        <button className="shelf-book shelf-new" onClick={onNew}>
          <div className="shelf-new-inner">
            <div className="shelf-plus">＋</div>
            <div>New volume</div>
          </div>
        </button>
      </div>
    </div>
  );
}
