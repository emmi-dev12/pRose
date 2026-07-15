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
  intensity: number; // 0..1 dial (only meaningful when agingMode === 'dressed')
  cover: CoverStyle;
  font: FontChoice;
  agingMode: AgingMode;
  lined: boolean; // ruled lines on/off
}

export const COVERS: CoverStyle[] = ['oxblood', 'moss', 'ink', 'sand', 'plum'];
export const FONTS: { id: FontChoice; label: string }[] = [
  { id: 'serif', label: 'Printed' },
  { id: 'hand', label: 'Handwritten' },
  { id: 'mono', label: 'Typewriter' },
];

// A free-placed piece of writing. You click anywhere on a page and start a block;
// a spread can hold as many as you like, wherever you put them, in any order.
export interface Block {
  id: string;
  page: 'left' | 'right';
  x: number; // top-left anchor, % of the page's writable width
  y: number; // top-left anchor, % of the page's writable height
  text: string; // whitespace preserved exactly
}

export interface Spread {
  id: string;
  date: string; // ISO yyyy-mm-dd — the day this spread belongs to
  blocks: Block[];
  bookmarked?: boolean; // a rose bookmark tucked into this spread
  leftText?: string; // legacy (pre-blocks) — migrated into blocks on load
  rightText?: string;
}

export interface Volume {
  id: string;
  title: string;
  slug: string; // url-friendly, unique within the library — routes as #/v/<slug>
  look: VolumeLook;
  spreads: Spread[]; // chronological, oldest → newest
  createdAt: string; // ISO — for ordering the shelf
}

// The whole shelf: every volume the writer owns, encrypted together under one passphrase.
export interface Library {
  volumes: Volume[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Local-date based, so "today" matches the writer's calendar (not UTC).
export function todayISO(): string {
  return isoOf(new Date());
}

// The next calendar day. Built from local date parts so it ALWAYS advances —
// no UTC round-trip (which silently repeated the date in eastern timezones).
export function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoOf(new Date(y, m - 1, d + 1));
}

// turn a title into a url slug: "The Wilting Hours!" → "the-wilting-hours"
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'volume';
}

// ensure a slug is unique within the library (appends -2, -3, …)
export function uniqueSlug(title: string, taken: string[]): string {
  const base = slugify(title);
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function newSpread(date: string): Spread {
  return {
    id: crypto.randomUUID(),
    date,
    blocks: [],
  };
}

export function newBlock(page: 'left' | 'right', x: number, y: number): Block {
  return { id: crypto.randomUUID(), page, x, y, text: '' };
}

export function defaultLook(): VolumeLook {
  return {
    seed: Math.floor(Math.random() * 1e9),
    preset: 'well-loved',
    intensity: 0.5,
    cover: 'oxblood',
    font: 'serif',
    agingMode: 'dressed',
    lined: true,
  };
}

export function newVolume(
  title = 'Volume I',
  look: VolumeLook = defaultLook(),
  taken: string[] = [],
): Volume {
  return {
    id: crypto.randomUUID(),
    title,
    slug: uniqueSlug(title, taken),
    look,
    spreads: [newSpread(todayISO())],
    createdAt: new Date().toISOString(),
  };
}
