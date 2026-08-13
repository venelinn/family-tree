# Architecture

```
data/nikolov.ged            MyHeritage GEDCOM export (import source only)
  │ pnpm photos             photos → public/photos/ (staging), export rewritten
  │ pnpm import             one-way, into a registered tree; photos → the bundle
  ▼
<data dir>/trees.json       which trees exist and where each one is [desktop]
  │ lib/store/registry.ts   dispatches to registry.local / registry.indexed
  │ lib/active-tree.ts      which one this browser is showing (localStorage)
  ▼
<chosen>.familytree/        the tree — one folder, system of record
  │ lib/store/bundle.ts     what's inside it and where
  │ lib/store/local.ts      file-backed TreeStore + backups
  │ lib/store/indexed.ts    the browser's TreeStore, and its photo blobs
  │ lib/photos.ts           content-addressed photos, metadata stripped on entry
  │ lib/store/to-graph.ts   rows → read model; photo entries → src, via the store
  ▼
lib/family-graph.ts         FamilyGraph { people, unions } + relationship queries
  │ lib/layout/family.ts    ─┐
  │ lib/layout/pedigree.ts  ─┴ graph + root → positioned nodes and edges
  ▼
components/*                React Flow canvas, cards, side panel
```

## Two targets, no server

The same UI ships twice, and **neither half has a server**. The desktop app is a
Tauri window; the web app is a static export on a CDN. `"use server"`, route
handlers and `cookies()` are all unavailable, which is why preferences live in
`localStorage` and every mutation is a plain async call.

| | Desktop (`pnpm app`) | Web (`pnpm dev`) |
| --- | --- | --- |
| Shell | Tauri v2 window, `src-tauri/` | static export, any host |
| Trees live in | a folder the user picked | this browser's IndexedDB |
| Store | `LocalTreeStore` | `IndexedTreeStore` |
| Registry | `registry.local.ts` | `registry.indexed.ts` |
| Photos | files in the bundle | blobs in IndexedDB |
| Paths shown | yes | none — there are none |

Everything above the store is the same files on both: `lib/layout/`,
`lib/facts.ts`, every component. What differs is what is underneath.

Which target a bundle is is decided **at build time**, by `NEXT_PUBLIC_TAURI`
(`pnpm dev:tauri` / `pnpm build:tauri`, both set by `tauri.conf.json`). Sniffing
`window.__TAURI_INTERNALS__` at import time is unreliable — injection is not
ordered against the bundle's own evaluation — so that global is only a fallback.

## The seams

Almost all the flexibility in this codebase comes from a few boundaries.

**`lib/store/types.ts`** defines `TreeStore`, and it is the one that matters.
Three implementations are anticipated and two exist:

- `LocalTreeStore` — files, via `TreeFs`
- `IndexedTreeStore` — IndexedDB
- a Supabase store, later

The first two share `SnapshotTreeStore`, which holds every row-editing method
over a read-modify-write of the whole tree. **A Supabase store must not extend
it**: that shape is correct for one writer and wrong for several, and each
`TreeStore` method is meant to map to a single statement instead.

**`lib/store/fs.ts`** is which filesystem the *file* store gets. A `TreeFs`
interface with two implementations — `fs.node.ts` for `pnpm import`, `fs.tauri.ts`
for the app — installed by the entry point. `registry.ts` calls `ensureFs()` on
first use rather than at import, so nothing depends on module evaluation order.

This is also why `lib/store/path.ts` exists rather than `node:path`: Tauri's
path API is entirely async, and adopting it would have turned every synchronous
path helper into a promise for no gain. It is POSIX-only, and the one file
Windows support would have to revisit.

**`lib/invalidate.ts`** replaces `revalidatePath`. Each action calls
`invalidateTrees()` where it used to revalidate; the hooks in `client-data.ts`
listen and re-read. No component has to remember to refresh, exactly as before.

**`lib/data.ts`** is the only module that knows where data lives. Everything
downstream consumes `FamilyGraph`. Moving to Supabase means implementing
`TreeStore` against it and changing what `getStore()` returns — no view, layout
or component code moves.

It no longer holds a hard-coded `ROOT_PERSON_ID`, and that is what made more
than one tree possible: the person a chart opens on is `meta.rootPersonId`
inside each tree file. See [storage.md](storage.md).

**`lib/layout/`** is plain TypeScript with no React or React Flow import. It
takes a graph and a root and returns positioned nodes and edges. That means
layouts can be run and asserted headlessly under `npx tsx`, which is how the
geometry gets verified without a browser.

## Modules

### `lib/gedcom/`

`types.ts` is a generic GEDCOM line tree (`GedNode`); `parse-ged.ts` turns raw
GEDCOM text into a `FamilyGraph`. GEDCOM is a flat, line-oriented format where
indentation is a leading level number, so parsing is two steps: lines → tree,
tree → records.

`SURN` is the name at birth and MyHeritage's `_MARNM` the one taken on marriage;
both are kept, as `surname` and `marriedName`. The primary `NAME` line is left as
the display name regardless, so nothing downstream has to know which is which.

Date handling is the fiddly part. GEDCOM dates are deliberately loose —
`23 DEC 1976`, `JUN 1991`, `2012`, `ABT 1910`, `BET 2012 AND 2013`. Only a
complete day/month/year becomes an ISO date; everything else keeps a readable
string and contributes a year for sorting. Ranges collapse to their first
endpoint.

### `lib/store/`

The tree modelled as **rows, not a document**: `people`, `unions`, and a
`unionChildren` join table — deliberately the shape Postgres tables would take.

`SnapshotTreeStore` holds every row-editing method, over a read-modify-write of
the whole tree, with mutations serialised through a promise chain. That chain
matters: read-modify-write on a whole document is exactly the shape that loses
data when two edits overlap. (Tested: 10 concurrent `createPerson` calls, all 10
persisted.) `LocalTreeStore` and `IndexedTreeStore` supply only `read`/`write`
on top of it.

`LocalTreeStore` writes to a temp file and renames it into place, so a crash
mid-write leaves the previous good file rather than a truncated one.

It is opened with **`LocalTreeStore.open()`, not `new`**. Deciding whether a path
is a bundle or a loose `.json` is a `stat`, and Tauri has no synchronous one, so
the location is resolved once in a factory — which is what keeps `store.file` and
`store.location` plain synchronous properties everywhere downstream.

`DIR_MODE` and `FILE_MODE` are honoured by the Node backend only; Tauri's plugin
takes no mode. They stay at every call site because the intent still holds.

**Photos are a store operation, not a directory.** `canStorePhotos`, `hasPhoto`,
`putPhoto`, `deletePhoto` and `photoSrc` are the whole surface `photos.ts` needs.
A file store answers `photoSrc` with an asset-protocol URL; the browser store
answers with an object URL for a blob it holds, cached per entry — the graph is
re-read after every edit, and minting a fresh URL each time would leak one per
photo per keystroke. Caching is safe because the key is a content hash.

`to-graph.ts` derives the read model, and is **async** because resolving a photo
in the browser means fetching a blob first. Back-references — `unionIds`,
`childOfUnionId` — are **computed, never stored**, so they cannot drift from the
union rows that are the truth.

### `lib/transfer.ts`

A tree as one JSON file: the snapshot plus its photos, base64-encoded under the
same content-addressed names both stores use. It is the only bridge between the
two targets, and the only backup a browser tree has.

Exporting differs by target and has to: the web build hands the browser a blob
URL on an `<a download>`, which **the Tauri webview silently ignores**, so the
desktop app writes the file itself through a native save dialog.

### `lib/facts.ts`

The sidebar's life timeline and relationship labels, **derived rather than
stored**. A marriage fact *is* the union row; a "birth of daughter" fact *is* the
child's birth. Deriving keeps one source of truth and means the timeline updates
itself when the tree is edited. Undated events sort last rather than pretending
to be ancient history.

### `lib/family-graph.ts`

`Person`, `Union`, and the relationship queries (`getParents`, `getSpouses`,
`getSiblings`, …). A `Union` is the couple-as-a-node idea — see
[layout.md](layout.md) for why that's load-bearing.

Also holds `reviveFamilyGraph`, because `FamilyGraph` uses `Map`s which don't
survive the server → client boundary; the page serialises to arrays and the
client rebuilds.

### `components/`

One folder per component, flat — `components/Toolbar/{Toolbar.tsx,
Toolbar.module.scss, index.ts}` — so a component's markup, styles and public
surface sit together and consumers import the folder. There is no grouping
directory: `tree/` and `settings/` were removed when the components moved to CSS
Modules, because a component's folder is now the unit that matters.

| Component | Role |
| --- | --- |
| `TreeApp` | Client root: view, root person, selection, depth, branch overrides |
| `TreeCanvas` | React Flow wrapper — node/edge mapping, framing |
| `PersonCard` | Portrait card, mourning ribbon, reveal bars |
| `UnionCard` | The couple marker children hang from |
| `PlaceholderCard` | "+ Add father" slots in the pedigree view |
| `PersonPanel` | Sidebar: action bar, facts timeline, immediate family |
| `EmptyTree` | First-person prompt for a tree started empty |
| `PersonForm` | Add / edit fields |
| `UnionForm` | Marriage date, place and whether it ended |
| `PersonSearch` | Find a person by name; also the picker when linking |
| `LinkPersonForm` | Relate two people who are both already in the tree |
| `PhotoDrop` | Drag-and-drop photos, promote or remove them |
| `AddSlotCard` | Ghost "Add sister" cards around the selected person |
| `Toolbar` | View switch, depth slider, person count, link to settings |
| `Avatar` | Photo with initials fallback |
| `Heading`, `Button` | The shared UI kit — see `rules/html-rules.mdc` |

`LanguagePicker`, `ThemePicker`, `NameLanguagePicker` and `TreeManager` are the
preference pickers, deliberately the same row shape, since they all answer "one
of these, please".

`components/Onboarding/` is the first-run wizard at `/welcome`: name the tree,
choose where its file is kept, set language and theme, and add the first person.
It keeps its `steps/` subfolder because the steps are parts of one flow rather
than components in their own right. `EmptyTree` is its counterpart for a tree
started empty.

### `lib/localization.ts`, `messages/`, `i18n/request.ts`

English and Bulgarian through `next-intl`, chosen on the settings page and kept
in a cookie rather than a URL prefix. The rule that shapes the rest of the code:
**anything below a component returns a message key, not a sentence** — fact
titles, relationship labels, add-slot labels, and write failures alike. See
[i18n.md](i18n.md).

### `lib/theming.ts`, `lib/theme.ts`, `tokens/`, `styles/`

Light and dark, `system` by default. Same shape as the locale — shared
constants, plus a read and a write through `lib/prefs.ts` — for the same reason:
it is one preference, set once, on the settings page. `themeInitScript` runs
blocking in `<head>` so `data-theme` is stamped before first paint.

The rule that shapes the components: **name the role, not the colour**.
`var(--surface-container)`, never `#fff`. Roles are declared in `tokens/*.json`
and built by Style Dictionary into `styles/_css-variables.css`; the dark values
are a hand-maintained override in `styles/_theme-dark.scss`. Every colour
resolves through them, including the React Flow canvas, so the dark theme is a
change to one file rather than a `dark:` variant on every element. See
[theming.md](theming.md).

Styling itself is mid-migration: components are Tailwind utilities today and are
moving to colocated `.module.scss` one at a time, with `styles/_compat.scss`
holding the two together. `rules/css-styling.mdc` is the guide.

## Writes

```
ghost card / panel  →  lib/actions.ts        validation + translated errors
                         →  lib/tree-ops.ts   relationship logic + invariants
                              →  TreeStore     row writes
                       invalidateTrees()  →  every mounted hook re-reads
```

These were server actions and are now plain async functions — the `Action` suffix
survives because it still separates the user-facing operations, which validate
and translate, from the primitives beneath that throw. It also keeps
`createTreeAction` from colliding with the `createTree` it wraps.

`photos.ts` sits under `photo-actions.ts` the same way `tree-ops.ts` sits under
`actions.ts` — upload validation is exactly the kind of rule that should not
only be exercised by clicking. It no longer builds paths: photos go through the
store's own `putPhoto` / `deletePhoto` / `photoSrc`, so the same code stores a
file inside a bundle on the desktop and a blob in IndexedDB on the web.

`tree-ops.ts` is where anything spanning several rows lives — "add a father"
means find-or-create the birth union, fill the husband seat, then link the
child. Actions return `{ ok, error }` rather than throwing across the boundary,
so the panel can show a real message ("Venelin already has a father").

## Card geometry per view

The two views want opposite things, so they have separate constants.

| | Card | Scarce dimension |
| --- | --- | --- |
| Family | portrait 132×140 | width — the chart sprawls sideways |
| Pedigree | landscape 200×76 | height — a whole generation stacks in one column |

The layout tags each person node with `variant`, and `PersonCard` /
`PlaceholderCard` switch on it. `TreeCanvas` picks the matching size when
computing bounds for framing. Landscape took a 5-column pedigree from 2,469px
tall to 1,456px.

## Handle contract

Every node type exposes handles under the same names, so a layout can pick sides
without the card knowing which view it's in:

- `left` — target
- `right` — source
- `top` — target (descent, family view only)
- `bottom` — source (union nodes only)

The layout sets `sourceHandle`/`targetHandle` on each edge, because the layout is
what knows the geometry.

## React Flow notes

Two things cost real debugging time and are easy to reintroduce:

**Nodes must be owned by React Flow.** Passing `nodes` as a plain prop *without*
`onNodesChange` silently drops dimension-measurement changes, which leaves
`useNodesInitialized` false forever — and anything waiting on it never runs.
Use `useNodesState`/`useEdgesState` and push layout results in via an effect.

**`fitView` is asynchronous.** Calling `setCenter` right after it gets clobbered
when the fit lands. `TreeCanvas` computes the zoom itself from node bounds
instead, which is also what lets it put a floor under the zoom — a true fit of a
wide, short family chart shrinks cards past readability.
