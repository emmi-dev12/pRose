# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

pRose is a private, offline notebook for poems ("Poetry, Prose & Roses"). It's a
**client-only** React + TypeScript + Vite app: there is **no backend**. Every notebook
lives **encrypted in the browser's IndexedDB**; nothing is sent to a server. It's
deployed as a static site on Netlify and is installable as a PWA.

## Commands

```bash
npm install
npm run dev       # Vite dev server on http://localhost:5273 (port pinned in vite.config.ts)
npm run build     # tsc (typecheck) + vite build → dist/
npm run preview   # serve the production build
```

There is **no test runner and no linter** configured. "Verifying a change" here means
`npm run build` (which runs `tsc`, so type errors fail the build) plus driving the app
in a headless browser. The established pattern in this project is a **Playwright**
script (installed ad-hoc in a scratch dir) that launches Chromium against
`npm run preview`, walks the UI, and asserts on the DOM. Prefer that over adding a test
framework unless asked.

## Architecture

### Data model (`src/types.ts`) — read this first
- `Library { volumes: Volume[] }` — the whole shelf, encrypted together under one passphrase.
- `Volume { id, title, slug, look, spreads[], createdAt, loosePages? }`.
- `Spread` = **one day** (`date`), holding free-placed `Block[]` (+ optional `bookmarked`).
- `Block { page:'left'|'right', x, y, w?, text }` — a piece of writing positioned by
  **percent of the page** (`x`/`y`); `w` is an optional width (% of page) set by resizing.
  `text` preserves whitespace/line breaks **exactly**.
- Legacy fields (`Spread.leftText/rightText`) exist only for migration.
- Helpers here are the source of truth: `slugify`/`uniqueSlug`, `todayISO`/`nextDay`
  (built from **local** date parts — never round-trip dates through `toISOString()`, which
  silently repeats the day in eastern timezones), `newVolume`/`newSpread`/`newBlock`,
  `defaultLook`.

### Persistence & crypto
- `src/crypto.ts` — Web Crypto: PBKDF2 (passphrase → key) + AES-GCM `seal`/`open`.
- `src/storage.ts` — `indexedDbStorage` implements the `Storage` interface
  (`exists`/`load`/`save`) over a single encrypted blob. **`load` migrates on read**:
  legacy `notebook` key → `library` key, and legacy per-spread text → `blocks`. Keep new
  fields backward-safe; add migration here, not scattered around.
- `src/session.ts` — optional "stay unlocked": stores the passphrase in `localStorage`
  (convenience vs. strict at-rest; cleared by Lock).

### App shell & routing (`src/App.tsx`)
- Phases: `checking → locked → ready`. On unlock/auto-unlock it navigates to the shelf
  (or setup if the library is empty) — opening should always land on **home**.
- **Hash router** (no library): `#/` = Shelf, `#/new` = VolumeSetup, `#/v/<slug>` = Notebook.
- Holds the decrypted `Library`; `onChangeVolume` updates one volume and **debounced-autosaves**
  (encrypted) ~400ms later. Any mutation flows through here.

### Notebook (`src/components/Notebook.tsx`) — the core, and the most complex file
- Renders **two branches** off a `matchMedia('(max-width: 700px)')` flag:
  - **Desktop**: a two-page spread (`.book`) with a CSS-3D whole-spread page-turn (`flip`).
  - **Mobile**: a **single leaf** (`.mbook`) that turns one page at a time
    (left → right → next day's left …) with its own flip state (`mFlip`, `mSide`).
  - Both share block editing, wear, bookmarks, contents/search, export, and the
    swipe/arrow turn handlers.
- Blocks are created by clicking empty paper (`addBlock`), except within the protected
  top band (`PROTECT_Y` — reserved for the date). Paging past the last day appends a new
  day. Page turns use a rAF → CSS-transition → `onTransitionEnd` commit pattern.
- Also owns: **loose-pages** delete/restore drawer, **remove-page**, **export** (`toPng`
  for a page image; a print-only `.print-root` DOM + `window.print()` for volume PDF),
  and the **contents/search** panel.

### Blocks (`src/components/Block.tsx`)
- Auto-sizing `<textarea>`: width measured via an offscreen canvas (`widestLine`), but
  **capped to the page's right margin** so long lines wrap (`white-space: pre-wrap`)
  instead of overflowing. Fixed `w` overrides the auto width.
- Grip (move) and right-edge handle (resize) drive `onMove`/`onResize` via pointer events
  (mouse + touch). `minY` keeps blocks below the protected header.

### Procedural wear (`src/wear.ts` + `WearLayer.tsx`)
- Deterministic from a per-volume `seed` (mulberry32 PRNG) → the same volume always looks
  identical. `effectiveAmount(volume)`: a fixed dial when `agingMode==='dressed'`, or
  accumulated use (`livingAge`, from days + characters written) when `'living'`. `WearLayer`
  draws spine crease, dog-ears, foxing, and aged edges as an SVG overlay.

### Other components
- `Shelf.tsx` — the library landing grid (open / new / delete / lock).
- `VolumeSetup.tsx` — first-run "dress the volume" (cover, font, ruled/blank, aging, wear)
  with a live preview.

### PWA / deploy
- `index.html` links the manifest + apple-touch-icon; `public/manifest.webmanifest`,
  rose icons, and `public/sw.js` (service worker). `main.tsx` registers the SW.
- `public/sw.js` is **network-first for navigations** (a fresh deploy applies on next
  visit) and stale-while-revalidate for other assets. **Bump the `CACHE` version when
  changing SW behavior**, or installed clients keep a stale bundle.
- `vite.config.ts` uses `base: './'` (relative assets — needed for the static host and any
  file:// / USB use). `netlify.toml` builds `dist/`. Routing is hash-based, so no SPA
  rewrite is strictly required.

## Conventions worth keeping
- **Whitespace is sacred**: never reflow or normalize `Block.text`; wrapping is visual only.
- **Positions/sizes are percentages** of the page, so everything stays responsive and
  survives export/print. Keep it that way.
- The look is chosen at volume creation; don't add wear controls to the writing surface.
