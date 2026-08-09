# Decisions

Why things are the way they are — including what was tried and rejected, so it
isn't retried by accident.

## React Flow for rendering, our own code for layout

React Flow is a *renderer*: viewport, pan/zoom, custom nodes as real React
components, edges, handles, minimap. It deliberately does no layout.

That split is the right one here. Cards need photos, gender borders, badges and
buttons — real HTML — which is painful on a canvas-based library like Cytoscape.
And layout needs genealogy-specific constraints no general layouter offers.

**Rejected:** dagre and ELK (can't express spouse adjacency — see
[layout.md](layout.md)); `relatives-tree` (good fit, but its output is line
segments rather than React Flow edges, so we'd give up edge routing); BALKAN
FamilyTreeJS (does everything, $599, proprietary); family-chart (owns the DOM
via d3, customisation means fighting its config).

## `@xyflow/react` v12, not `reactflow` v11

`reactflow` is the old package name and is frozen. v12 is the maintained line and
has measured node dimensions, which matter for variable-height cards.

## Union nodes

A couple is a first-class node. This is the single most load-bearing decision in
the layout — see [layout.md](layout.md#union-nodes).

## Rows, not a document

The store models the tree as `people` / `unions` / `unionChildren` — the shape
Postgres tables would take — rather than as nested JSON.

The point is that moving to Supabase becomes implementing an interface, not
reshaping data. It also makes mutations naturally granular: a full-document write
would be impossible to do safely with concurrent editors.

## One-way import

`pnpm import` replaces the store wholesale. Once you edit in the app,
`data/tree.json` is the system of record and re-importing discards your work.

**Two-way sync with MyHeritage is deliberately not attempted.** Edit in both
places and you need conflict resolution over a graph — which of two conflicting
birth dates wins, what happens when MyHeritage merges a duplicate you also
edited. That's a genuinely hard distributed-systems problem hiding inside a
personal project. Pick one system of record; let the other be read-only.

## Photos downloaded, not hotlinked

MyHeritage image URLs carry an HMAC signature and an expiry about a week out:

```
k=sites_v1&s=516a38a1…91092b4&e=1786863600
```

Only MyHeritage can sign these. There is **no token or session to refresh** —
they 403 with or without a `Referer`, and re-exporting just restarts the same
one-week clock. So `pnpm photos` downloads them once and rewrites the export to
local paths.

## Data stays out of git

`/data` and `/public/photos` are gitignored. The tree holds living relatives'
names, birth dates, birthplaces and email addresses.

For the same reason: **don't paste the export into online GEDCOM converters.**
Writing a parser locally was the same amount of work as writing a mapper for a
converter's output, with none of the exposure.

## Local store before Supabase

Chosen because schema churn is free locally while the editing UX is still being
designed, git gives versioned history and undo for nothing, and auth + row-level
security is a week of work that makes the tree no better. The seam in
`lib/data.ts` keeps Supabase cheap to reach later.

The counter-argument is real and may win eventually: a family tree nobody else
can see is half a family tree.

## Neighbourhood, not the whole tree

252 people at once is unreadable. The chart shows a neighbourhood around a focus
person and says "N of 252 people", the way MyHeritage does.

## Expansion displaces other expansions

A large expansion closes the user's other open branches. Without it, expansions
accumulate and sprawl the chart until nothing is legible — and the point of a
neighbourhood is that you follow one line at a time.

## Reveal bars, not chevrons

The first version used a 36px chevron pill, with collapse hidden behind hover.
Too small to hit, didn't say what it would do or how many people were behind it,
and the collapse action was undiscoverable.

Now: a full-card-width bar labelled `+ 2 parents`, always shown for hidden
branches (that's information, not chrome), and `− parents` on the *selected* card
only, so collapse is available without every card carrying two permanent buttons.
