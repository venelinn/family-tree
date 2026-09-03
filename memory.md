# Memory

Durable context for picking this project back up — the things that aren't
obvious from reading the code, and the traps that already cost time once.

Full detail lives in [docs/](docs/README.md). This is the short version.

## What this is

A self-hosted family tree viewer for a MyHeritage export, with two views —
**Family** (kinship graph: couples, siblings, cousins) and **Pedigree** (strict
binary ancestor chart). Next.js + React Flow. Personal project, ~252 people.

Root person is **Venelin Nikolov Nikolov, `@I85@`** — now `meta.rootPersonId`
inside the tree file, not a constant. `ROOT_PERSON_ID` is gone.

## Current state

Working: load, pan/zoom, click a person for a side panel, switch views, expand
and collapse branches, depth slider, portrait cards with photos and mourning
ribbons.

Editing works: select a card and ghost "Add brother / sister / partner / son /
daughter / father / mother" cards appear around it, MyHeritage style; the panel
has Edit and Delete. Writes go through the action modules → `lib/tree-ops.ts` →
`TreeStore`, then `invalidateTrees()`.

Marriages are editable too — date, place, and whether it ended — from the pencil
on the marriage row in the Facts timeline. That row is the only editable fact,
because it is the only one that *is* a stored row rather than a derivation.

**Relationships are fully editable now.** Link two people who are already in
the tree (More → Link someone already here, then search), and break any named
link from the Immediate family rows without deleting anybody. `unlinkRelative`
in `tree-ops.ts` is the counterpart to `linkRelative`.

**Search is in the toolbar**, and the same `PersonSearch` component is the
picker for linking — one interaction, one implementation.

**Photos can be dropped onto the panel.** `lib/photos.ts` holds the rules,
`photo-actions.ts` is the thin wrapper. Photos are content-addressed and stored
by the store itself — files inside the bundle on desktop, blobs in IndexedDB on
web — and are never deleted while another person still refers to them.

**Two surnames per person.** `surname` is the name at birth (the maiden name);
`marriedName` is the one taken on marriage. MyHeritage exports the second as
`_MARNM` and there are 36 of them. `fullName` was deliberately left alone — it
is what every card, sort and search uses, so redefining it to mean the married
name would have rippled everywhere for no gain. The panel shows the married name
under the name; the form offers the field for women, and for anyone who already
has one stored so an imported value can't become uneditable.

Localised: English and Bulgarian via `next-intl`, picked on `/settings` and kept
in `localStorage` (no `/en` `/bg` prefix, no middleware). The catalogue is chosen
client-side in `components/Providers`; `i18n/request.ts` is gone with the server.
Adding a language is three files — see [docs/i18n.md](docs/i18n.md).

Themed: light and dark, `system` by default, picked on `/settings` and kept in
`localStorage` the same way. Colour lives in semantic tokens built by Style Dictionary
from `tokens/*.json`, with the dark values in `styles/_theme-dark.scss` — see
[docs/theming.md](docs/theming.md).

Multi-tree: several trees, each a file that **may live anywhere on disk** —
external drive, encrypted volume, off the repo entirely. First run goes through
`/welcome` (name → where to store it, desktop only → language/theme → start from
me or empty), with "Already have a tree?" on the first step for importing or
opening one. Settings switches, renames, moves, adopts, exports and imports. See [docs/storage.md](docs/storage.md).

**It ships twice now, and neither half has a server.** `pnpm app` is a Tauri
macOS window keeping trees as folders you pick; `pnpm dev` is a static export
keeping them in the browser's IndexedDB. Both work offline. Needs the Rust
toolchain — see [docs/getting-started.md](docs/getting-started.md).

The desktop app exists because a hosted Next.js server *cannot* write to the
user's disk. The web app lost its server because it was decided it would never
read `data/` — with storage in the visitor's browser there was nothing left for a
server to do. That removed eight `"use server"` modules, the photo route handler
and the theme/locale/tree cookies.

`TreeStore` is the seam: `LocalTreeStore` (files) and `IndexedTreeStore`
(IndexedDB) share `SnapshotTreeStore`. The **registry** could not be shared —
it is built on paths, which a browser has none of — so `registry.ts` dispatches
to `registry.local.ts` or `registry.indexed.ts`, and `TreeSummary.file` is
optional. Supabase is still a planned third `TreeStore`.

**Moving a tree between the two** is a single JSON export carrying rows *and*
photos, base64-encoded. It is also the only backup a browser tree has.

Not built: Supabase, merging duplicate people, birth-order editing (the
`position` column exists, no UI), adoption / step-parents (`unionChildren` has
no qualifier), and **events other than birth / marriage / death**. The GEDCOM has
`RESI` ×13, `BURI` ×5, `CAUS` ×4, `EVEN` ×2 and the parser drops them all; that
needs a stored `events` row type merged into `buildFacts`, plus a decision on
fixed vocabulary vs free text (facts return message *keys*, so a user-typed type
can never be translated).

## Traps

**`assetProtocol.scope: []` means deny everything, not "unrestricted".** It cost
an hour: the tree loaded and all 51 photos were refused with "asset protocol not
configured to allow the path". `$APPDATA/**` is granted statically; user-picked
folders are granted by the dialog.

**The folder dialog needs `recursive: true`.** Without it the scope grant covers
the chosen folder only, and every photo under `photos/8f/3a/` is denied — which
reads as "the app lost my pictures", not as a permissions problem.

**Importing a bundle's `tree.json` loses every photo, silently.** `tree.json` is
only half a `.familytree` bundle — the pictures are beside it in `photos/`, and
Import is an `<input type=file>` that is handed one file, never a folder. There
is no `photos` map in the store file, `assertLooksLikeTree` only checks that
`people` and `unions` are arrays, and `restorePhotos` swallows per-photo
failures, so the wrong file imports cleanly and arrives with no faces. Use
Settings → Export, or `pnpm archive <bundle>` (`scripts/pack-archive.ts`) to
pack rows + base64 photos out of band. Two bits of UI copy still say "Photos are
not included" and still suggest importing a `tree.json`; both predate
`collectPhotos` and are wrong.

**A blob download does nothing in the Tauri webview.** `<a download>` is silently
ignored — WKWebView has no download handling unless Rust adds it. Export on the
desktop writes the file itself through a native save dialog; only the web build
downloads.

**Which target a bundle is, is decided at build time** by `NEXT_PUBLIC_TAURI`
(`pnpm dev:tauri` / `pnpm build:tauri`). Do not sniff `window.__TAURI_INTERNALS__`
at import time — injection is not ordered against bundle evaluation. It survives
as a fallback only, and `registry.ts` installs the fs backend lazily via
`ensureFs()` rather than on import.

**Never invent CSS variable names.** Tokens are `--spacing-N`, `--outline-variant`,
`--surface-container`, `--border-radius`, built by Style Dictionary from
`tokens/*.json`. Guessing `--space-3` / `--color-border` produced a control that
rendered as unstyled text, because unknown custom properties fail silently.

**Nothing under `lib/store/` may import `node:fs` or `node:path`.** Both targets
share those files, and the desktop one bundles them for a webview where neither
exists. Use `lib/store/fs.ts` and `lib/store/path.ts`. The Node backend lives in
`fs.node.ts` and is imported only from `scripts/`; the app installs the Tauri one
through `ensureFs()` in `fs.client.ts`.

**`tauri add` registers plugins in the wrong order.** It *prepends*, and
`persisted-scope` must be initialised **after** `fs` or it silently does nothing
— meaning every folder the user granted is forgotten on restart, which looks
exactly like losing their tree. Check `src-tauri/src/lib.rs` after every
`tauri add`.

**Open a store with `LocalTreeStore.open()`, never `new`.** The constructor is
private. Deciding bundle-vs-loose-file is a `stat` and Tauri has no synchronous
one, so the location is resolved in an async factory; that is what keeps
`store.file` a plain property everywhere else.

**`lib/store/path.ts` is POSIX-only.** Deliberate, and correct on macOS for both
backends. It is the one file Windows support has to revisit — Tauri's own path
API was rejected because every function in it is async, which would have turned
`resolveTargetFile`, `defaultFileFor` and `isCloudSyncedPath` into promises.

**`FILE_MODE`/`DIR_MODE` are Node-only.** Tauri's fs plugin takes no mode, so in
the desktop app the umask decides and owner-only is an intention rather than a
guarantee. The constants stay at every call site anyway.

**Photo URLs expire in ~7 days.** They're HMAC-signed by MyHeritage; there is no
token or session to refresh. After every export, run `pnpm photos` *promptly* or
the images are gone until you export again.

**Don't commit `data/` or `public/photos/`.** Living relatives' names, birth
dates, birthplaces, email addresses. Both are gitignored — keep it that way. Same
reason: don't paste the export into online GEDCOM converters.

**Backfill, don't re-import, when a field is added late.** `marriedName` landed
after the first import, so the values were in the `.ged` and not in the store.
`pnpm backfill:married` copies just that one field across, fills blanks only, and
is a dry run unless given `--write`. Re-importing would have cost every in-app
edit.

**`pnpm import` wipes the store.** Once you edit in the app, the tree file is
the system of record. Re-importing discards your edits. There is no two-way sync
with MyHeritage and that's deliberate. It now targets a *registered tree* —
`pnpm import <file> <treeId>`, first tree by default.

**Adopting a tree file must validate the raw JSON, not a loaded snapshot.**
`LocalTreeStore.read()` defaults missing rows to `[]`, so *every* well-formed
JSON file looks like a valid empty tree. Adopting rewrites the file wholesale —
during development this overwrote `package.json`. `assertLooksLikeTree` requires
`people` and `unions` to both be arrays.

**Expand must grant the slider depth, not a fixed step.** `max(budget, 1)` looks
harmless but the root already has the full budget while a spouse's is zeroed, so
one button silently did two different things. Symmetry is the requirement.

**`linkRelative` had a bug that only unused code can keep.** Its parent branch
read `birthUnionOf(other) === birthUnionOf(anchor)` and threw "they'd be
siblings" — but both are `undefined` when neither has parents on record, so it
refused the commonest case of all. Nothing had ever called it.

**Pruning empty unions must be scoped to the union you touched.** A sweep over
the whole tree under the stricter rule ("a union needs a couple or a child")
would also delete rows nobody asked about — the import left two single-wife
childless unions in the real store. `pruneUnionIfMeaningless` takes an id;
`pruneEmptyUnions` keeps the weaker "nobody in it at all" rule for deletions.

**A child added to someone married twice needs an explicit union.** `addRelative`
always took a `unionId`; nothing passed it, so the earliest marriage silently
won. The add-child form now offers the choice when there is one.

**Don't reach for dagre/ELK for the family view.** It was tried and produced
tangles; generic layered layouters can't express "these two are married". The
union-node model exists for this reason.

**React Flow: `nodes` without `onNodesChange` silently breaks measurement.**
`useNodesInitialized` stays false forever and anything waiting on it never runs.
This caused a "fitView doesn't work" bug that looked like a React Flow problem
and wasn't.

**`fitView` is async** and will clobber a `setCenter` issued right after it.
`TreeCanvas` computes zoom from node bounds instead.

**Nothing below a component may return an English string.** `lib/facts.ts`,
`add-slots.ts` and `tree-ops.ts` return message *keys*; the component or the
server action translates. They run on both sides of the server boundary and
don't know the reader's language. Plurals and gender agreement live in the ICU
message too — a `count === 1` test in a component bakes English grammar into
every language, and Bulgarian inflects *Роден* / *Родена*.

**Preferences are `localStorage` now, not cookies** — theme, locale,
names-follow-language and the active tree, all through `lib/prefs.ts`. The
cookies existed because the *server* rendered them and a cookie arrives with the
request; with no server render on either target that reasoning has no premise
left. The dark-mode flash is back and handled by a blocking inline script in
`<head>` (`themeInitScript`), which is exactly what the cookie was avoiding.

**After any write, call `invalidateTrees()`.** It is the direct replacement for
`revalidatePath`, lives in `lib/invalidate.ts`, and each action already calls it
where the revalidate used to be — so no component has to remember. The hooks in
`lib/client-data.ts` listen and re-read.

**Never write a Tailwind palette class.** `bg-slate-100`, `text-rose-600` and
friends look correct in light and wrong in dark, and nothing fails to tell you.
Every colour goes through a semantic token — `var(--surface-container)`,
`var(--on-surface-variant)`, `var(--female-line)` — declared in `tokens/*.json`
and darkened in `styles/_theme-dark.scss`. The `bg-panel` / `text-ink-muted`
utilities still in the components are the pre-token names, kept alive by
`styles/_compat.scss` until each component moves to `.module.scss`. Two naming
traps when adding one: it must not collide with a Tailwind utility (`--color-solid` had to become
`--color-invert`, because `border-solid` is a border-style), and rings need
`ring-offset-surface` or Tailwind's white default halos them on the dark canvas.

## Decisions already made (don't relitigate without reason)

- React Flow renders; layout is ours. Layout has no React import so it's testable headlessly.
- A couple is a node (union node). Load-bearing for both spouse adjacency and the sibling bar.
- Store is rows (`people` / `unions` / `unionChildren`), not a document — so Supabase is a swap.
- Back-references (`unionIds`, `childOfUnionId`) are derived, never stored.
- GEDCOM is the import format; the parser is local and was validated against the older JSON export at **zero diffs** across 252 people / 94 unions.
- Local store chosen over Supabase for now: free schema churn, git history, no auth work. Revisit if sharing with family becomes the goal.
- Dark mode is semantic tokens + `light-dark()`, not `dark:` variants and not `next-themes`. The preference was a server-read cookie; with no server render it is `localStorage` plus a blocking inline script in `<head>`.
- A tree's *name and root person* live in its own file; the index (`data/trees.json`) holds only id + path. Copy the file anywhere and it stays whole.
- Tree files are written `0600`, directories `0700`. Cloud-synced destinations (iCloud, Dropbox, OneDrive) are warned about, never blocked.
- No delete for trees — only "remove from list". Deletion is unrecoverable and there is no undo.

## Sidebar

One **action bar** — Centre / Edit / Add / More — carries everything you can do
to a person. Branch show/hide and Delete live in the More menu; they used to be
a banner, a button pair and an accordion scattered down the panel.

Accordion sections: **Facts** (a life timeline — birth, marriages, each child's
birth, death, with year and age in the margin), **Immediate family** (avatars +
relationship labels), . Facts and relationship labels are derived in
`lib/facts.ts`, never stored.

## Card geometry differs per view

Family cards are **portrait** (132×140) because that chart sprawls sideways;
pedigree cards are **landscape** (200×76) because that one stacks a generation
per column and height is the scarce dimension. The layout tags nodes with
`variant` and the cards switch on it — don't unify them.

## Editing notes

- **Ghost add-cards float over the chart, they aren't laid out into it.** Seven
  extra cards would reflow the tree on every selection. MyHeritage overlaps
  neighbours too.
- **Slots are only offered where they'd mean something** — no "Add father" for
  someone who already has one. The tree allows one father and one mother.
- **Relationship logic lives in `lib/tree-ops.ts`, not the UI.** "Add a father"
  means find-or-create the birth union, fill the husband seat, link the child;
  the components never need to know that.
- **Dates are free text on purpose.** Sources say "about 1910" as often as a full
  date, and a date picker would force precision the record doesn't have.
- **`lib/data.ts` is uncached** — a module cache would serve stale data to the
  render right after a write.
- **Deletion is not undoable in the app.** The only safety net is the store file.
  Test scripts that mutate `data/tree.json` must restore it in a `finally` — one
  here threw halfway and left three junk records behind.

## Known limitation

**In-law parents land in the nearest free slot**, not directly above their child,
because the slot above a couple usually belongs to the other spouse's parents.
Leaves a visible run of line when expanded. Fixing it properly means the tidy
pass reserving space for in-law fans up front — a real change to
`lib/layout/family.ts`, not a tweak.

## Tuning knobs

| Constant | Where | Effect |
| --- | --- | --- |
| `resolveAllowance` | `lib/layout/family.ts` | Expanding grants the full slider depth. It must not grant a fixed step — that made the same button behave differently on the root than on a spouse. |
| `MAX_COLLATERAL_DESCENT` | `lib/layout/family.ts` | How far an ancestor's own descendants are followed back down. |
| `EXPANSION_BUDGET` | `components/TreeApp/TreeApp.tsx` | People an expansion may add before it displaces other open branches. |
| `MIN_READABLE_ZOOM` | `components/TreeCanvas/TreeCanvas.tsx` | Zoom floor before panning is preferred over shrinking. |
| `SIBLING_GAP` / `SPOUSE_GAP` | `lib/layout/constants.ts` | Their *contrast* is what makes couples readable. |

## Verifying changes

No test suite. What's worked: run layouts headlessly under `npx tsx` and assert
no card overlaps; diff two parsers' `FamilyGraph` output field by field; drive
the app with Playwright and **look at the screenshot** — several layout bugs here
were invisible to assertions and obvious on sight.

## Depth reference (default depth 2)

20 people, 4 rows. Depth 3 jumps to ~135 — great-grandparents multiply the clan
back down. The slider goes to 4 but 3+ is a big chart.
