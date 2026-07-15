// Procedural wear. The realism comes from generation, not clicks: a per-volume seed
// makes the coffee ring, spine crease and dog-ear land in the *same place every time*,
// so it reads as *this* book. Wear is derived, never stored.

import type { Volume, VolumeLook, WearPreset } from './types';

// Small deterministic PRNG (mulberry32) — same seed → same stream, every reload.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRESET_BASE: Record<WearPreset, number> = {
  'brand-new': 0.08,
  'well-loved': 0.5,
  'survived-a-flood': 0.9,
};

export interface WearMarks {
  amount: number; // effective 0..1 (preset × dial), drives every mark's strength
  dogEar: number; // 0..1 corner softness (bottom-outer corner)
  spine: number; // 0..1 crease darkness at the gutter
  smudges: { x: number; y: number; r: number; o: number }[];
}

// How worn a "living" volume is, derived from real use: the more days you keep
// and the more you write, the older it gets. Deterministic from content, 0..1.
export function livingAge(volume: Volume): number {
  const days = volume.spreads.length - 1;
  const chars = volume.spreads.reduce((n, s) => n + s.leftText.length + s.rightText.length, 0);
  return Math.min(1, days / 45 + chars / 9000);
}

// The effective wear (0..1) for a volume: a fixed dial when it was dressed at
// creation, or accumulated use when it's set to age on its own.
export function effectiveAmount(volume: Volume): number {
  if (volume.look.agingMode === 'living') {
    // starts brand-new, then ages with use
    return Math.min(1, PRESET_BASE['brand-new'] * 0.4 + livingAge(volume));
  }
  return Math.min(1, PRESET_BASE[volume.look.preset] * (0.4 + volume.look.intensity * 1.4));
}

// Deterministic per volume: seed + an explicit wear amount fully determine the marks.
export function computeWear(look: VolumeLook, amountOverride?: number): WearMarks {
  const r = rng(look.seed);
  const amount =
    amountOverride ?? Math.min(1, PRESET_BASE[look.preset] * (0.4 + look.intensity * 1.4));

  // faint ink foxing scattered across the page — subtle age, no coffee stains
  const smudges = Array.from({ length: Math.round(amount * 5) }, () => ({
    x: r() * 100,
    y: r() * 100,
    r: 1.5 + r() * 3,
    o: 0.04 + r() * 0.08 * amount,
  }));

  return {
    amount,
    dogEar: amount,
    spine: 0.25 + amount * 0.55,
    smudges,
  };
}
