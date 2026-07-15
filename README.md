<p align="center">
  <img src="public/rose.svg" alt="pRose" width="120" />
</p>

<h1 align="center">pRose</h1>

<p align="center"><em>The journal you didn't know was missing — a private notebook for poems and prose.</em></p>

---

pRose is a journal for logging poems. It looks and feels like a **real, battered notebook**:
a two-page spread you write across, pages that turn, paper that wears. The date fills
itself in. Nothing you write ever leaves your machine.

The guiding principle is simple: **it has to feel real** — and in poetry, *whitespace and
line breaks are the poem*, so pRose preserves them exactly, never reflowing a single space.

## What's here today

This is an early slice — the foundation, proven end to end:

- **📖 A real notebook.** A two-page spread with a 3D page-turn. Turn with the **arrow
  keys** or the edge arrows; paging past the last day grows the book into a fresh,
  date-stamped day.
- **✍️ Whitespace is sacred.** A distraction-free editor that keeps your indentation and
  line breaks **byte-for-byte**. No autocorrect, no reflow.
- **🥀 Wear that feels earned.** Coffee ring, spine crease, dog-eared corners — generated
  procedurally from a per-notebook seed, so the same volume looks *identical every time*
  you open it. Tune it with a preset + an intensity dial.
- **🔒 Private for real.** Everything is encrypted at rest with a passphrase (Web Crypto,
  AES-GCM). No server, no accounts. Reopening asks for your passphrase before a single
  word appears.

## Getting started

```bash
npm install
npm run dev
```

Open the printed URL, choose a passphrase (it encrypts your notebook and can't be
recovered), and start writing.

```bash
npm run build     # type-check + production build
npm run preview   # serve the production build
```

## On the horizon

Designed and waiting to be built:

- **Volumes & a shelf** — one endless book or themed notebooks ('grief', 'love poems',
  'drafts'), aging as you use them.
- **More writing moods** — expressive/typographic and structured-logging modes alongside
  today's *sacred & bare*.
- **Drag to make room**, so a full day grows extra pages that still belong to that date.
- **Silent history** — quietly kept, shown only when you reach for it.
- **A "loose pages" drawer** — deleted poems rest in the back until *you* clear them.
- **Off-grid transfer** — QR-handshake device-to-device over local wifi, plus a portable
  USB / air-gapped mode. No cloud, ever.
- **Export** — a beautiful image of a page, or a whole volume as a printable PDF.

## Tech

React + TypeScript + Vite. Local-only, encrypted, no backend. Storage lives behind a
small backend-agnostic interface so a portable-file (USB) backend can slot in later.

---

<p align="center"><em>Private by design. Your notebook, and no one else's.</em></p>
