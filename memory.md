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
has Edit and Delete. Writes go through server actions → `lib/tree-ops.ts` →
`TreeStore`, then `revalidatePath("/")`.

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
`photo-actions.ts` is the thin wrapper. Files go to `public/photos/uploads/`,
owner-only, and imported photos are never deleted from disk — only detached.

**Two surnames per person.** `surname` is the name at birth (the maiden name);
`marriedName` is the one taken on marriage. MyHeritage exports the second as
`_MARNM` and there are 36 of them. `fullName` was deliberately left alone — it
is what every card, sort and search uses, so redefining it to mean the married
name would have rippled everywhere for no gain. The panel shows the married name
under the name; the form offers the field for women, and for anyone who already
has one stored so an imported value can't become uneditable.

Localised: English and Bulgarian via `next-intl`, picked on `/settings` and kept
in a cookie (no `/en` `/bg` prefix, no middleware). Adding a language is three
files — see [docs/i18n.md](docs/i18n.md).

Themed: light and dark, `system` by default, picked on `/settings` and kept in a
cookie the same way. Colour lives in semantic tokens built by Style Dictionary
from `tokens/*.json`, with the dark values in `styles/_theme-dark.scss` — see
[docs/theming.md](docs/theming.md).

Multi-tree: several trees, each a file that **may live anywhere on disk** —
external drive, encrypted volume, off the repo entirely. First run goes through
`/welcome` (name → where to store it → language/theme → start from me or empty).
Settings switches, renames, moves, adopts. See [docs/storage.md](docs/storage.md).

**It ships twice now — web and a Tauri desktop app.** `pnpm dev` is the web
target (server, server actions, `node:fs`); `pnpm app` is the same UI in a native
macOS window, reaching the disk through Tauri's `fs` plugin and working offline.
Neither is a fork: `lib/store/fs.ts` is a `TreeFs` interface with two backends,
installed by whichever entry point is running — `fs.server.ts` on the web, a
bootstrap component in the desktop app, and each CLI script for itself. Needs the
Rust toolchain; see [docs/getting-started.md](docs/getting-started.md).

The desktop app exists because a hosted Next.js server *cannot* write to the
user's disk — Netlify and Vercel give every request an ephemeral container. See
[docs/decisions.md](docs/decisions.md#a-desktop-app-as-well-as-a-web-app).

Not built: Supabase, merging duplicate people, birth-order editing (the
`position` column exists, no UI), adoption / step-parents (`unionChildren` has
no qualifier), and **events other than birth / marriage / death**. The GEDCOM has
`RESI` ×13, `BURI` ×5, `CAUS` ×4, `EVEN` ×2 and the parser drops them all; that
needs a stored `events` row type merged into `buildFacts`, plus a decision on
fixed vocabulary vs free text (facts return message *keys*, so a user-typed type
can never be translated).

## Traps

**Nothing under `lib/store/` may import `node:fs` or `node:path`.** Both targets
share those files, and the desktop one bundles them for a webview where neither
exists. Use `lib/store/fs.ts` and `lib/store/path.ts`. The Node backend lives in
`fs.node.ts` and is reachable only from `fs.server.ts` (which is `server-only`,
so a leak into the client bundle is a build error) and from `scripts/`.

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

**The active tree is a cookie, not `localStorage`.** The tree is loaded during
the *server* render, so the choice has to arrive with the request; localStorage
would paint one family's chart and then swap it for another's. Same reason as
the theme, with higher stakes.

**Changing the language must `revalidatePath("/", "layout")`.** Without it the
client router cache serves the chart back in the old language. The cookie alone
is not enough. **The theme has exactly the same requirement** — the `data-theme`
attribute lives on the root layout.

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
- Dark mode is semantic tokens + `light-dark()`, not `dark:` variants and not `next-themes`. The preference is a server-read cookie, which is why there's no flash and no blocking script.
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
