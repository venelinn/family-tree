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

Localised: English and Bulgarian via `next-intl`, picked on `/settings` and kept
in a cookie (no `/en` `/bg` prefix, no middleware). Adding a language is three
files — see [docs/i18n.md](docs/i18n.md).

Themed: light and dark, `system` by default, picked on `/settings` and kept in a
cookie the same way. Colour lives in semantic tokens in `app/globals.css` — see
[docs/theming.md](docs/theming.md).

Multi-tree: several trees, each a file that **may live anywhere on disk** —
external drive, encrypted volume, off the repo entirely. First run goes through
`/welcome` (name → where to store it → language/theme → start from me or empty).
Settings switches, renames, moves, adopts. See [docs/storage.md](docs/storage.md).

Not built: Supabase, photo upload for people added in-app, linking two people who
are *already* in the tree (`linkRelative` exists in `tree-ops.ts` but nothing
calls it).

## Traps

**Photo URLs expire in ~7 days.** They're HMAC-signed by MyHeritage; there is no
token or session to refresh. After every export, run `pnpm photos` *promptly* or
the images are gone until you export again.

**Don't commit `data/` or `public/photos/`.** Living relatives' names, birth
dates, birthplaces, email addresses. Both are gitignored — keep it that way. Same
reason: don't paste the export into online GEDCOM converters.

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
Every colour goes through a semantic token — `bg-panel`, `text-ink-muted`,
`border-female-line` — defined in `app/globals.css`. Two naming traps when adding
one: it must not collide with a Tailwind utility (`--color-solid` had to become
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
| `EXPANSION_BUDGET` | `components/tree/TreeApp.tsx` | People an expansion may add before it displaces other open branches. |
| `MIN_READABLE_ZOOM` | `components/tree/TreeCanvas.tsx` | Zoom floor before panning is preferred over shrinking. |
| `SIBLING_GAP` / `SPOUSE_GAP` | `lib/layout/constants.ts` | Their *contrast* is what makes couples readable. |

## Verifying changes

No test suite. What's worked: run layouts headlessly under `npx tsx` and assert
no card overlaps; diff two parsers' `FamilyGraph` output field by field; drive
the app with Playwright and **look at the screenshot** — several layout bugs here
were invisible to assertions and obvious on sight.

## Depth reference (default depth 2)

20 people, 4 rows. Depth 3 jumps to ~135 — great-grandparents multiply the clan
back down. The slider goes to 4 but 3+ is a big chart.
