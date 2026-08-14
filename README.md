# Family tree

A MyHeritage-style family tree viewer for a MyHeritage GEDCOM export, built with
Next.js and [React Flow](https://reactflow.dev) (`@xyflow/react`).

```bash
pnpm dev     # http://localhost:3022
pnpm build
pnpm lint    # biome
```

## Documentation

- [memory.md](memory.md) — the short version: state, traps, decisions, knobs
- [docs/getting-started.md](docs/getting-started.md) — setup and refreshing data
- [docs/architecture.md](docs/architecture.md) — modules, seams, the store
- [docs/layout.md](docs/layout.md) — both layout algorithms in depth
- [docs/decisions.md](docs/decisions.md) — why, and what was rejected

## Two views

| View | Shape | Layout |
| --- | --- | --- |
| **Family** | Kinship graph — couples, remarriages, siblings, cousins | `lib/layout/family.ts` |
| **Pedigree** | Strict binary ancestor tree, root on the left | `lib/layout/pedigree.ts` |

Both feed the same canvas and the same card components.

## Architecture

```
data/nikolov.ged              MyHeritage GEDCOM export (import source)
  ↓ pnpm photos               download photos, rewrite URLs → public/photos/
  ↓ pnpm import               one-way import
data/tree.json                the editable store — system of record
  ↓ lib/store/to-graph.ts     rows → read model
lib/family-graph.ts           { people, unions } + relationship queries
  ↓ lib/layout/*.ts           graph + root → positioned nodes and edges
components/tree/*             React Flow canvas, cards, side panel
```

## Data lives locally, never in git

`/data` and `/public/photos` are gitignored. The tree holds living relatives'
names, birth dates, birthplaces and email addresses; none of it belongs in a
repository. A fresh clone has no tree — re-export from MyHeritage and run
`pnpm photos && pnpm import`.

## The store

`lib/store/` models the tree as **rows, not a document** — `people`, `unions`
and a `unionChildren` join table, exactly the shape Postgres tables would take.
That is what makes moving to Supabase a swap rather than a rewrite: implement
`TreeStore` against it and change the one line in `lib/data.ts` that constructs
`LocalTreeStore`. Nothing else in the app knows where data lives.

`LocalTreeStore` writes to a temp file and renames it into place, and serialises
mutations through a promise chain — Next.js runs route handlers concurrently, and
a read-modify-write on a whole file is exactly the shape that loses data
otherwise.

Back-references (`unionIds`, `childOfUnionId`) are derived in `to-graph.ts`
rather than stored, so they cannot drift from the union rows that are the truth.

**The import is one-way.** Once you edit in the app, `data/tree.json` is the
system of record and re-importing would discard your work. Two-way sync with
MyHeritage is deliberately not attempted — reconciling two independently edited
family graphs is a hard merge problem, not a missing feature.

## Photos

MyHeritage image URLs are signed with an HMAC and expire about a week after
export; there is no session or token to refresh. `pnpm photos` downloads them
into `public/photos/` and rewrites the export to local paths, so the app never
depends on the CDN. Run it promptly after each re-export.

**React Flow renders; it does not lay out.** Positions are computed entirely in
`lib/layout/`, which is plain TypeScript with no React or React Flow imports —
so the layouts are testable on their own, and the probe under `lib/layout/` can
be run headlessly.

### Why unions are nodes

A `Union` (couple) is a first-class node: spouses attach to it, children hang off
it. This is what keeps a married pair adjacent through layout. A generic layered
layouter — dagre, ELK — has no way to express "these two cards belong together",
which is why a person-to-person graph comes out tangled. The family layout groups
people into *units* (a person plus the spouses they're glued to) and positions the
resulting unit tree with a two-pass tidy-tree algorithm: bottom-up width
accumulation, then top-down centring.

### Neighbourhoods, not the whole tree

The full file has 252 people. Drawing them at once is unreadable, so the family
view walks outward from a root person and reports "N of 252 people", the way
MyHeritage does.

The walk is bounded by a **per-person travel budget**, not a global generation
window: each person carries how many generations they may still climb and
descend, and reaching a relative spends it. Budgets rather than a window because
a window is global and an override is local — "show me *this one person's*
parents" has to be sayable without dragging in every other branch at that depth.

Three rules keep a chart centred on one person from turning into the whole file:

- **Crossing a marriage ends the walk.** A spouse is drawn; their relatives are
  not. This is a layout constraint as much as a taste one — the slot above a
  couple belongs to one of them, so a second set of parents could only go
  sideways with a long line stretching back. MyHeritage collapses these too.
- **Descendants inherit no climb.** Both a child's parents are already on screen
  by construction, so leftover up-budget could only be spent climbing back out
  through an in-law. Without this, a spouse's whole ancestral line sneaks in via
  a shared child and defeats the rule above.
- **Collateral descent is capped.** Climbing buys one more level back down, so
  grandparents bring cousins — but uncapped, each extra ancestor generation
  multiplies the clan back down again.

### Expand and collapse

Cards on the frontier show a handle: above when parents exist but aren't drawn,
below for children. Clicking writes a per-person override — `true` forces a
branch open past the budget, `false` forces it shut inside the budget — which
`selectNeighborhood` consults as it walks.

Opening is measured before it is committed. A branch bringing in more than
`EXPANSION_BUDGET` people takes over and closes the user's other *expansions*
(deliberate collapses are always kept), because otherwise expansions accumulate
and sprawl the chart sideways until nothing is legible.

Expand handles are always visible, since they're how you learn there are
relatives off-screen at all. Collapse handles appear on hover, so the default
chart isn't peppered with controls for branches already on screen. Overrides
reset when you re-centre the tree on someone else, because they were anchored to
the previous chart.

### Handle contract

Every node type exposes the same handles, so a layout can pick sides without the
card knowing which view it's in:

- `left` — target
- `right` — source
- `top` — target (descent, family view only)
- `bottom` — source (union nodes only)

## Cards

Portrait: photo on top, name and dates beneath. Family charts are enormously
wider than they are tall, so trading card height for card width buys real
horizontal room. A deceased person gets a mourning ribbon across the top-left
corner.

`SIBLING_GAP` is several times `SPOUSE_GAP` on purpose — that contrast is the
only cue telling you which pairs of cards in a row are married.

## Data notes

The MyHeritage export has two quirks that `lib/gedcom/parse.ts` normalizes:

- Family (FAM) records live under the top-level **`Relations`** key, not `Families`.
- `Individuals[].Relations` is a **bare string** when a person belongs to one
  family and an **array** when they belong to several.

Photo URLs are signed and time-limited; most have expired, so `Avatar` falls back
to initials on a 403.

## Not built yet

- Add / edit people — `PlaceholderCard` ("+ Add father") is the intended entry point.
- Expand/collapse in the pedigree view — it has the `Columns` slider instead, and
  its person nodes report `ancestors: "none"` so no handles render.
- Persistence. `lib/data.ts` is the only module that reads the data source;
  everything downstream consumes `FamilyGraph`, so moving to Supabase means
  rewriting that one file's body.
