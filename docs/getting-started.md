# Getting started

```bash
pnpm install
pnpm dev          # web, http://localhost:3022
pnpm app          # desktop, a native window
```

If `data/tree.json` doesn't exist yet, the app renders an empty tree. See
**Refreshing data** below.

## The desktop app

`pnpm app` runs the same UI inside a [Tauri](https://v2.tauri.app) window. It
needs the Rust toolchain, which is a one-time install and after which you do not
write any Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Xcode Command Line Tools are also required (`xcode-select --install`). The first
`pnpm app` compiles the Rust side and takes a couple of minutes; every one after
that is seconds.

In dev, Tauri points the window at the running `next dev` server, so hot reload
works exactly as it does in the browser. `pnpm app:build` produces a `.dmg`.

macOS only for now — see [decisions.md](decisions.md#a-desktop-app-as-well-as-a-web-app).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Web dev server on port 3022 |
| `pnpm app` | Desktop app in a native window (starts `pnpm dev` for you) |
| `pnpm build` | Production build of the web target |
| `pnpm app:build` | Desktop `.dmg` |
| `pnpm lint` | Biome check (lint + format + import order) |
| `pnpm format` | Biome format, writing changes |
| `pnpm photos` | Download photos from an export into `public/photos/`, rewrite the export to local paths |
| `pnpm import` | One-way import of a `.ged` into the active tree |

## Refreshing data from MyHeritage

The order matters, and step 2 is time-sensitive.

1. **Export** from MyHeritage as GEDCOM, save it to `data/nikolov.ged`.
2. **`pnpm photos`** — *do this promptly.* Image URLs in the export are signed
   with an HMAC and expire roughly **one week** after export. There is no
   session or token to refresh; once they 403, only a new export helps. The
   script downloads them to `public/photos/` and rewrites the export to local
   paths, after which the app never touches MyHeritage's CDN again.
3. **`pnpm import`** — loads the GEDCOM into `data/tree.json`.

Both scripts are safe to re-run. `pnpm photos` skips files already on disk and
leaves failed URLs untouched so a later run can retry them; it writes a
`.bak` beside the export before modifying it.

> **`pnpm import` replaces the store wholesale.** Once you start editing in the
> app, `data/tree.json` is the system of record and re-importing discards your
> edits. See [decisions.md](decisions.md#one-way-import) for why there's no
> two-way sync.

## Data never enters git

`/data` and `/public/photos` are both gitignored. The tree contains living
relatives' names, birth dates, birthplaces and email addresses. A fresh clone
has no tree — run the refresh steps above.

For the same reason, don't paste the export into online GEDCOM converters.

## Verifying a change

There's no test suite yet. What's been used instead, and is worth repeating:

- **Layout geometry** — parse the export, run a layout, assert no two cards
  overlap and that generation rows are consistent. Layout code is plain
  TypeScript with no React import, so it runs under `npx tsx` directly.
- **Parser fidelity** — parse two sources of the same tree and diff the
  resulting `FamilyGraph` field by field. This is how the GEDCOM parser was
  validated against the older JSON export: 252 people, 94 unions, zero diffs.
- **The app itself** — drive it with Playwright, click through, screenshot, and
  *look at the screenshot*. Several layout bugs here were invisible to
  assertions and obvious on sight.
