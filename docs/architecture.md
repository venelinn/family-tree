# Architecture

```
data/nikolov.ged            MyHeritage GEDCOM export (import source only)
  │ pnpm photos             photos → public/photos/, export rewritten to local paths
  │ pnpm import             one-way
  ▼
data/tree.json              the editable store — system of record
  │ lib/store/local.ts      TreeStore implementation (file-backed)
  │ lib/store/to-graph.ts   rows → read model
  ▼
lib/family-graph.ts         FamilyGraph { people, unions } + relationship queries
  │ lib/layout/family.ts    ─┐
  │ lib/layout/pedigree.ts  ─┴ graph + root → positioned nodes and edges
  ▼
components/tree/*           React Flow canvas, cards, side panel
```

## The two seams

Almost all the flexibility in this codebase comes from two boundaries.

**`lib/data.ts`** is the only module that knows where data lives. Everything
downstream consumes `FamilyGraph`. Moving to Supabase means implementing
`TreeStore` against it and changing the line that constructs `LocalTreeStore` —
no view, layout or component code moves.

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

Date handling is the fiddly part. GEDCOM dates are deliberately loose —
`23 DEC 1976`, `JUN 1991`, `2012`, `ABT 1910`, `BET 2012 AND 2013`. Only a
complete day/month/year becomes an ISO date; everything else keeps a readable
string and contributes a year for sorting. Ranges collapse to their first
endpoint.

### `lib/store/`

The tree modelled as **rows, not a document**: `people`, `unions`, and a
`unionChildren` join table — deliberately the shape Postgres tables would take.

`LocalTreeStore` writes to a temp file and renames it into place, and serialises
mutations through a promise chain. Both matter: Next.js runs route handlers
concurrently, and read-modify-write on a whole file is exactly the shape that
loses data. (Tested: 10 concurrent `createPerson` calls, all 10 persisted.)

`to-graph.ts` derives the read model. Back-references — `unionIds`,
`childOfUnionId` — are **computed, never stored**, so they cannot drift from the
union rows that are the truth.

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

### `components/tree/`

| File | Role |
| --- | --- |
| `TreeApp.tsx` | Client root: view, root person, selection, depth, branch overrides |
| `TreeCanvas.tsx` | React Flow wrapper — node/edge mapping, framing |
| `PersonCard.tsx` | Portrait card, mourning ribbon, reveal bars |
| `UnionCard.tsx` | The couple marker children hang from |
| `PlaceholderCard.tsx` | "+ Add father" slots in the pedigree view |
| `PersonPanel.tsx` | Sidebar: action bar, facts timeline, immediate family |
| `PersonForm.tsx` | Add / edit fields |
| `AddSlotCard.tsx` | Ghost "Add sister" cards around the selected person |
| `Toolbar.tsx` | View switch, depth slider, person count, link to settings |
| `Avatar.tsx` | Photo with initials fallback |

### `lib/localization.ts`, `messages/`, `i18n/request.ts`

English and Bulgarian through `next-intl`, chosen on the settings page and kept
in a cookie rather than a URL prefix. The rule that shapes the rest of the code:
**anything below a component returns a message key, not a sentence** — fact
titles, relationship labels, add-slot labels, and write failures alike. See
[i18n.md](i18n.md).

## Writes

```
ghost card / panel  →  lib/actions.ts (server actions)
                         →  lib/tree-ops.ts   relationship logic + invariants
                              →  TreeStore     row writes
                       revalidatePath("/")  →  server component re-renders
```

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
