// pRose data model — slice scope.
// A day is a two-page spread. This slice keeps one editable text area per page
// (left/right), with whitespace preserved exactly. The richer per-poem model
// (positions, drag, writing modes) layers on top of this later.

export type WearPreset = 'brand-new' | 'well-loved' | 'survived-a-flood';
export type CoverStyle = 'oxblood' | 'moss' | 'ink' | 'sand' | 'plum';
export type FontChoice = 'serif' | 'hand' | 'mono';
// 'dressed' → you set the look and it lives; 'living' → it ages as you use it.
export type AgingMode = 'dressed' | 'living';

export interface VolumeLook {
  seed: number; // hidden per-volume seed → deterministic wear placement
  preset: WearPreset;
  intensity: number; // 0..1 dial
  cover: CoverStyle;
  font: FontChoice;
  agingMode: AgingMode;
}

export const COVERS: CoverStyle[] = ['oxblood', 'moss', 'ink', 'sand', 'plum'];
export const FONTS: { id: FontChoice; label: string }[] = [
  { id: 'serif', label: 'Printed' },
  { id: 'hand', label: 'Handwritten' },
  { id: 'mono', label: 'Typewriter' },
];

export interface Spread {
  id: string;
  date: string; // ISO yyyy-mm-dd — the day this spread belongs to
  leftText: string; // whitespace preserved exactly
  rightText: string;
}

export interface Volume {
  id: string;
  title: string;
  look: VolumeLook;
  spreads: Spread[]; // chronological, oldest → newest
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newSpread(date: string): Spread {
  return {
    id: crypto.randomUUID(),
    date,
    leftText: '',
    rightText: '',
  };
}

export function defaultLook(): VolumeLook {
  return {
    seed: Math.floor(Math.random() * 1e9),
    preset: 'well-loved',
    intensity: 0.5,
    cover: 'oxblood',
    font: 'serif',
    agingMode: 'dressed',
  };
}

export function newVolume(title = 'Volume I', look: VolumeLook = defaultLook()): Volume {
  return {
    id: crypto.randomUUID(),
    title,
    look,
    spreads: [newSpread(todayISO())],
  };
}
