# Layout

Read this before changing anything in `lib/layout/`. The code is short and the
reasons behind it are not obvious from reading it.

## Why not dagre / ELK

The first version of this app fed a **person → person** graph to dagre. It came
out tangled, and no amount of tuning `nodesep`/`ranksep` fixed it.

Generic layered layouters minimise edge crossings. They have no way to express
"these two cards are married and must sit adjacent" or "these five are siblings,
keep them in birth order under their parents". The constraint you need simply
isn't in the vocabulary.

## Union nodes

The fix is to stop making people the only nodes. Every couple gets an invisible
**union node**; spouses attach to it, children hang off it.

```
[Nikola] ──┐
           ├──(union)──┬── [Venelin]
[Elena]  ──┘           ├── [Sonia]
                       └── [Hristo]
```

Now "keep the couple together" is structural, not something you hope survives.

This also produces the **sibling bar** for free: every child edge leaves the same
union marker, so all the edges share one vertical drop and one horizontal run
and overlay into a single bar. With person-to-person edges you'd get N separate
diagonals and no bar at all.

## Family view — `lib/layout/family.ts`

Four steps.

### 1. Pick the neighbourhood

Drawing all 252 people at once is unreadable, so the view walks outward from a
root person. The walk is bounded by a **per-person travel budget** — each person
carries how many generations they may still climb and descend, and reaching a
relative spends it.

Budgets rather than a global generation window, because a window is global and
an override is local: *"show me this one person's parents"* has to be sayable
without dragging in every other branch at that depth.

Three rules keep a root-centred chart from becoming the whole file:

| Rule | Why |
| --- | --- |
| **Crossing a marriage ends the walk** (spouse gets 0/0) | The slot above a couple belongs to one of them; a second set of parents can only go sideways with a long line stretching back. MyHeritage collapses these too. |
| **Descendants inherit no climb** | Both a child's parents are already on screen by construction, so leftover up-budget could only climb back out through an in-law. Without this, a spouse's whole ancestral line sneaks in via a shared child and defeats the rule above. |
| **Collateral descent is capped** (`MAX_COLLATERAL_DESCENT`) | Climbing buys one more level back down so grandparents bring cousins — uncapped, each extra ancestor generation multiplies the clan back down again. |

A person reachable by several paths keeps the **generation from first sight**
(cousin marriages make a person reachable at two depths, and flip-flopping would
destabilise the rows) but **upgrades budgets**, so reach depends on the data
rather than on BFS order.

### 2. Group into units

A *unit* is a person plus the spouse(s) they must stay glued to, laid out as one
indivisible horizontal block. Men left, women right; on remarriage the person
sits in the middle flanked by both spouses.

Each unit has an **anchor** — the member whose parents are on screen. That's the
edge the unit hangs from. Units are seeded in BFS order so the root's bloodline
claims its spouses first and stays structural.

### 3. Position the unit forest

Standard two-pass tidy tree: bottom-up width accumulation (a unit is as wide as
its own cards or its children, whichever is wider), then top-down centring.

Rows come from **generation, not tree depth**, so people of the same generation
line up even across unrelated subtrees.

### 4. Place married-in subtrees

A unit hangs off its *anchor's* parents, so a couple can only be structurally
attached to one bloodline. The other spouse's parents form a subtree with no link
into the main tree.

Laid out as independent forest roots, those land at the far right of the chart
with a descent line stretching back across everything — a wife's parents ending
up 1,400px from her. So they're placed in a second pass: slid to sit above the
person they married into, then nudged sideways by the smallest amount that
clears whatever is already on that row.

> **Known limitation.** This finds the nearest *free* slot; it does not insert
> and push. If the slot directly above the child is taken (usually by the other
> spouse's parents), the couple lands further along the row with a visible run of
> line. Fixing it properly means the tidy pass reserving space for in-law fans up
> front, which is a real change to the core, not a tweak.

## Pedigree view — `lib/layout/pedigree.ts`

Much simpler: a strict binary ancestor tree, root on the left, father above
mother, one column per generation.

Rows are assigned bottom-up — the rightmost column takes consecutive slots and
every other card is centred between its two parents, which is what keeps the
chart visually balanced. Missing parents become "+ Add father/mother"
placeholders, which is also the intended entry point for adding people.

Guards against **pedigree collapse** (cousins marrying, making someone their own
ancestor on two paths) with an ancestry set along the current path.

## Expand and collapse

Cards on the frontier advertise hidden branches with a `+ 2 parents` bar; the
selected card also offers `− parents` to fold one away. Clicking writes a
per-person override — `true` forces a branch open past the budget, `false` forces
it shut inside it — which the neighbourhood walk consults.

Opening is **measured before it's committed**: a branch bringing in more than
`EXPANSION_BUDGET` people takes over and closes the user's other expansions
(deliberate collapses are kept). Left to accumulate, expansions sprawl the chart
sideways until nothing is legible.

Expanding grants the **full configured depth**, not one extra generation. It has
to, in order to mean the same thing everywhere: the root already carries the full
budget, so granting `max(budget, 1)` opened their branch completely while opening
a spouse's — whose budget is zeroed by the marriage-crossing rule — by a single
generation. One button, two behaviours, depending on whose card it sat on.

The promise is "show this branch the way the main line is shown", so expanding a
spouse brings their parents, both sets of grandparents and their collateral
families, exactly as the root's own line arrives.

## Geometry

All in `lib/layout/constants.ts`. Two worth knowing:

- Cards are **portrait** (132×140). Family charts are enormously wider than they
  are tall, so trading height for width buys real horizontal room.
- `SIBLING_GAP` is several times `SPOUSE_GAP` on purpose. That contrast is the
  only cue telling you which pairs of cards in a row are married.
