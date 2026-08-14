import { byBirthYear, type FamilyGraph } from "../family-graph"
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	DESCENT_BUS_INSET,
	DESCENT_LANE_STEP,
	ROW_HEIGHT,
	SIBLING_GAP,
	SPOUSE_GAP,
	SUBTREE_GAP,
	UNION_SIZE,
} from "./constants"
import type { BranchState, LayoutEdge, LayoutNode, LayoutResult } from "./types"

/**
 * MyHeritage-style family view.
 *
 * The key idea is the *unit*: a person plus the spouse(s) they must stay glued
 * to, laid out as one indivisible horizontal block. Units form a tree (a unit's
 * parent is the unit its anchor was born into), which is then positioned with a
 * standard two-pass tidy-tree algorithm — bottom-up width accumulation, then
 * top-down centring. A generic layered layouter can't express "these two cards
 * are married", which is exactly why dagre produced tangles here.
 */

/**
 * Per-person overrides of the default reach.
 *
 * `true` forces a branch open even where the budget ran out; `false` forces it
 * shut even where the budget would have covered it. Absent means "use the
 * budget" — which is what every person starts out as.
 */
export type BranchOverrides = ReadonlyMap<string, boolean>

export interface FamilyLayoutOptions {
	/** Generations to walk up from the root. 2 gets you grandparents. */
	ancestorDepth?: number
	/** Generations to walk down. 2 gets you grandchildren, cousins, nieces/nephews. */
	descendantDepth?: number
	ancestorOverrides?: BranchOverrides
	descendantOverrides?: BranchOverrides
}

interface Unit {
	id: string
	/** Cards left-to-right. Two spouses, or [spouseA, person, spouseB] on remarriage. */
	memberIds: string[]
	/** Unions drawn inside this unit, as [leftMemberIndex, unionId]. */
	unions: Array<{ unionId: string; leftIndex: number }>
	generation: number
	/** The blood member — the one whose parents this unit hangs from. */
	anchorId: string
	parentUnitId?: string
	childUnitIds: string[]
	/** Width of this unit's own cards. */
	ownWidth: number
	/** Width of this unit's entire descendant subtree. */
	subtreeWidth: number
	/** Left edge of the unit's own cards, once positioned. */
	ownX: number
}

/* ------------------------------------------------------------------ *
 * Step 1 — pick the neighbourhood to draw
 * ------------------------------------------------------------------ */

interface Neighborhood {
	/** person id -> generation, where the root sits at 0 and ancestors are negative. */
	generations: Map<string, number>
	/** person id -> BFS discovery index, used to favour the root's bloodline. */
	order: Map<string, number>
}

/** How far a person may still walk in each direction. */
interface Reach {
	generation: number
	up: number
	down: number
	/** Ceiling this person's climb passes on; see `EXPANDED_COLLATERAL_DESCENT`. */
	collateralCap: number
}

/** Ceiling on how far an ancestor's own descendants are followed back down. */
const MAX_COLLATERAL_DESCENT = 3

/**
 * The same ceiling, for a branch the user opened by hand.
 *
 * Climbing buys collateral descent so that the *default* chart has some width to
 * it — grandparents arriving with your cousins is most of what makes a family
 * view feel like one. Applying that to an expansion is a different thing
 * entirely: opening one ancestor granted his parents a full three levels back
 * down, and each generation above them the same again, so asking for one man's
 * parents answered with sixty-five of his cousins. Measured on this tree,
 * expanding a single great-grandparent went 21 → 89 people and 7,058px wide, of
 * which 3 were the ancestors asked for and 65 were the fan.
 *
 * At one level you get the ancestors, their siblings, and stop — "show me who
 * these people were", which is the question the button asks. Their children are
 * another click away, on their own cards, where the cost is visible.
 */
const EXPANDED_COLLATERAL_DESCENT = 1

/**
 * Turn a budget plus a user override into an actual allowance.
 *
 * Expanding grants the *full* configured depth, not one extra generation. It
 * has to, to mean the same thing everywhere: the root already carries the full
 * budget, so `max(budget, 1)` opened their branch completely while opening a
 * spouse's — whose budget is zeroed by the marriage-crossing rule — by a single
 * generation. One button, two behaviours, depending on whose card it sat on.
 *
 * "Show this branch the way the main line is shown" is the promise; `granted`
 * is what the slider is currently set to.
 */
function resolveAllowance(
	budget: number,
	override: boolean | undefined,
	granted: number,
): number {
	if (override === true) return Math.max(budget, granted)
	if (override === false) return 0
	return budget
}

/**
 * Breadth-first walk out from the root, bounded by a per-person travel budget.
 *
 * Drawing all 250 people at once is unreadable; MyHeritage shows a
 * neighbourhood ("36 of 252 people") and so do we. Each person carries how many
 * generations they may still climb and descend; spending a budget to reach a
 * relative is what stops the walk swallowing the whole connected component.
 *
 * Budgets rather than a fixed generation window, because a window is global and
 * an override is local: "show me this one person's parents" has to be sayable
 * without dragging in every other branch at that depth.
 */
function selectNeighborhood(
	graph: FamilyGraph,
	rootId: string,
	ancestorDepth: number,
	descendantDepth: number,
	ancestorOverrides: BranchOverrides,
	descendantOverrides: BranchOverrides,
): Neighborhood {
	const reach = new Map<string, Reach>()
	const order = new Map<string, number>()
	const queue: string[] = []

	const consider = (
		id: string,
		generation: number,
		up: number,
		down: number,
		collateralCap: number,
	) => {
		if (!graph.people.has(id)) return

		const existing = reach.get(id)
		if (!existing) {
			reach.set(id, { generation, up, down, collateralCap })
			order.set(id, order.size)
			queue.push(id)
			return
		}

		// Generation is fixed at first sight — under cousin marriages a person is
		// reachable at two different depths and flip-flopping would destabilise
		// the rows. Budgets, though, upgrade: the most generous path should win,
		// otherwise reach depends on BFS order rather than on the data.
		if (
			up <= existing.up &&
			down <= existing.down &&
			collateralCap <= existing.collateralCap
		)
			return
		existing.up = Math.max(existing.up, up)
		existing.down = Math.max(existing.down, down)
		existing.collateralCap = Math.max(existing.collateralCap, collateralCap)
		queue.push(id)
	}

	consider(rootId, 0, ancestorDepth, descendantDepth, MAX_COLLATERAL_DESCENT)

	while (queue.length > 0) {
		const personId = queue.shift() as string
		const person = graph.people.get(personId)
		const current = reach.get(personId)
		if (!person || !current) continue

		const { generation, up, down } = current
		const upAllowance = resolveAllowance(
			up,
			ancestorOverrides.get(personId),
			ancestorDepth,
		)
		const downAllowance = resolveAllowance(
			down,
			descendantOverrides.get(personId),
			descendantDepth,
		)

		if (upAllowance > 0) {
			const birthUnion = person.childOfUnionId
				? graph.unions.get(person.childOfUnionId)
				: undefined
			if (birthUnion) {
				// Climbing buys one more level of collateral descent, so
				// grandparents bring cousins and great-grandparents bring their
				// families — but it is capped, because otherwise each extra
				// ancestor generation multiplies the whole clan back down again
				// and the chart grows faster than anyone can read it.
				// This applies to an in-law opened by hand too: their parents get one
				// level of descent, which is what brings a spouse's siblings onto
				// the chart alongside their parents. It stops there — the siblings'
				// own children need another click.
				// A branch opened by hand narrows the ceiling from here upward, and
				// the narrower value travels with the climb — otherwise the very
				// next generation would widen it again and the fan would return.
				const cap =
					ancestorOverrides.get(personId) === true
						? EXPANDED_COLLATERAL_DESCENT
						: current.collateralCap
				const collateral = Math.min(down + 1, cap)
				for (const parentId of [birthUnion.husbandId, birthUnion.wifeId]) {
					if (parentId) {
						consider(parentId, generation - 1, upAllowance - 1, collateral, cap)
					}
				}
			}
		}

		for (const unionId of person.unionIds) {
			const union = graph.unions.get(unionId)
			if (!union) continue

			// Crossing a marriage ends the walk: a spouse is drawn, their relatives
			// are not. This is what MyHeritage does too, and it is a layout
			// constraint as much as a taste one — the slot directly above a couple
			// belongs to one of them, so a second set of parents can only be put
			// somewhere sideways with a long line stretching back. Better to
			// collapse the branch and advertise it with a handle on the card.
			// A spouse later reached as a blood relative gets their real budget
			// back, since `consider` keeps the most generous path.
			const spouseId =
				union.husbandId === personId ? union.wifeId : union.husbandId
			if (spouseId) consider(spouseId, generation, 0, 0, current.collateralCap)

			// Descendants inherit no climb. Both their parents are already on screen
			// by construction, so any remaining up-budget could only be spent
			// climbing back out through an in-law — which is how a spouse's whole
			// ancestral line used to sneak in via a shared child, defeating the
			// rule above.
			if (downAllowance > 0) {
				for (const childId of union.childIds) {
					consider(
						childId,
						generation + 1,
						0,
						downAllowance - 1,
						current.collateralCap,
					)
				}
			}
		}
	}

	const generations = new Map<string, number>()
	for (const [id, { generation }] of reach) generations.set(id, generation)

	return { generations, order }
}

/* ------------------------------------------------------------------ *
 * Branch state — where the expand/collapse handles go
 * ------------------------------------------------------------------ */

function parentIdsOf(graph: FamilyGraph, personId: string): string[] {
	const person = graph.people.get(personId)
	const union = person?.childOfUnionId
		? graph.unions.get(person.childOfUnionId)
		: undefined
	if (!union) return []
	return [union.husbandId, union.wifeId].filter((id): id is string =>
		Boolean(id && graph.people.has(id)),
	)
}

function childIdsOf(graph: FamilyGraph, personId: string): string[] {
	const person = graph.people.get(personId)
	if (!person) return []
	return person.unionIds.flatMap(
		(unionId) => graph.unions.get(unionId)?.childIds ?? [],
	)
}

function branchState(
	relatives: string[],
	visible: ReadonlySet<string>,
): { state: BranchState; hidden: number } {
	if (relatives.length === 0) return { state: "none", hidden: 0 }
	const hidden = relatives.filter((id) => !visible.has(id)).length
	return { state: hidden > 0 ? "expandable" : "collapsible", hidden }
}

/* ------------------------------------------------------------------ *
 * Step 2 — group people into units
 * ------------------------------------------------------------------ */

function buildUnits(
	graph: FamilyGraph,
	neighborhood: Neighborhood,
): { units: Map<string, Unit>; unitOfPerson: Map<string, string> } {
	const { generations, order } = neighborhood
	const units = new Map<string, Unit>()
	const unitOfPerson = new Map<string, string>()

	// Seed in BFS order so the root's bloodline claims its spouses first.
	const seeds = [...generations.keys()].sort(
		(a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
	)

	for (const personId of seeds) {
		if (unitOfPerson.has(personId)) continue
		const person = graph.people.get(personId)
		if (!person) continue

		// Only unions whose spouse is visible and not already placed elsewhere.
		const joinable: Array<{ unionId: string; spouseId: string }> = []
		for (const unionId of person.unionIds) {
			const union = graph.unions.get(unionId)
			if (!union) continue
			const spouseId =
				union.husbandId === personId ? union.wifeId : union.husbandId
			if (!spouseId || !generations.has(spouseId) || unitOfPerson.has(spouseId))
				continue
			joinable.push({ unionId, spouseId })
		}

		// Men left, women right — matches conventional genealogy rendering.
		// On remarriage the person sits in the middle, flanked by both spouses.
		let memberIds: string[]
		if (joinable.length === 0) {
			memberIds = [personId]
		} else if (joinable.length === 1) {
			memberIds =
				person.sex === "M"
					? [personId, joinable[0].spouseId]
					: [joinable[0].spouseId, personId]
		} else {
			memberIds = [
				joinable[0].spouseId,
				personId,
				...joinable.slice(1).map((j) => j.spouseId),
			]
		}

		const unitUnions = joinable.map(({ unionId, spouseId }) => {
			const leftIndex = Math.min(
				memberIds.indexOf(personId),
				memberIds.indexOf(spouseId),
			)
			return { unionId, leftIndex }
		})
		unitUnions.sort((a, b) => a.leftIndex - b.leftIndex)

		// The anchor is the member whose parents are on screen — that is the
		// edge this unit hangs from. Prefer the seed person (closer to the root)
		// so the main bloodline stays structural and in-laws hang off it.
		const hasVisibleParents = (id: string) => {
			const candidate = graph.people.get(id)
			const union = candidate?.childOfUnionId
				? graph.unions.get(candidate.childOfUnionId)
				: undefined
			if (!union) return false
			return (
				(union.husbandId != null && generations.has(union.husbandId)) ||
				(union.wifeId != null && generations.has(union.wifeId))
			)
		}
		const anchorId = hasVisibleParents(personId)
			? personId
			: (memberIds.find(hasVisibleParents) ?? personId)

		const unitId = `unit:${anchorId}`
		const ownWidth =
			memberIds.length * CARD_WIDTH + (memberIds.length - 1) * SPOUSE_GAP

		units.set(unitId, {
			id: unitId,
			memberIds,
			unions: unitUnions,
			generation: generations.get(anchorId) ?? 0,
			anchorId,
			childUnitIds: [],
			ownWidth,
			subtreeWidth: ownWidth,
			ownX: 0,
		})
		for (const memberId of memberIds) unitOfPerson.set(memberId, unitId)
	}

	// Link units into a forest via each anchor's birth union.
	for (const unit of units.values()) {
		const anchor = graph.people.get(unit.anchorId)
		const birthUnion = anchor?.childOfUnionId
			? graph.unions.get(anchor.childOfUnionId)
			: undefined
		if (!birthUnion) continue

		const parentId = [birthUnion.husbandId, birthUnion.wifeId].find(
			(id) => id != null && generations.has(id),
		)
		const parentUnitId = parentId ? unitOfPerson.get(parentId) : undefined
		// Guard against a person somehow anchoring their own ancestor unit.
		if (!parentUnitId || parentUnitId === unit.id) continue

		unit.parentUnitId = parentUnitId
		units.get(parentUnitId)?.childUnitIds.push(unit.id)
	}

	// Siblings read oldest-first; children of a remarriage cluster under the
	// union they belong to rather than interleaving.
	for (const unit of units.values()) {
		unit.childUnitIds.sort((a, b) => {
			const unitA = units.get(a)
			const unitB = units.get(b)
			if (!unitA || !unitB) return 0
			const unionRank = (child: Unit) => {
				const index = unit.unions.findIndex((u) =>
					graph.unions.get(u.unionId)?.childIds.includes(child.anchorId),
				)
				return index === -1 ? Number.MAX_SAFE_INTEGER : index
			}
			const rankDelta = unionRank(unitA) - unionRank(unitB)
			if (rankDelta !== 0) return rankDelta

			const personA = graph.people.get(unitA.anchorId)
			const personB = graph.people.get(unitB.anchorId)
			return personA && personB ? byBirthYear(personA, personB) : 0
		})
	}

	return { units, unitOfPerson }
}

/* ------------------------------------------------------------------ *
 * Step 3 — tidy-tree positioning over the unit forest
 * ------------------------------------------------------------------ */

/** Bottom-up: a unit is as wide as its own cards or its children, whichever is wider. */
function measure(
	units: Map<string, Unit>,
	unitId: string,
	seen: Set<string>,
): number {
	const unit = units.get(unitId)
	if (!unit || seen.has(unitId)) return 0
	seen.add(unitId)

	const children = unit.childUnitIds
	if (children.length === 0) {
		unit.subtreeWidth = unit.ownWidth
		return unit.subtreeWidth
	}

	let childrenWidth = 0
	for (const childId of children) childrenWidth += measure(units, childId, seen)
	childrenWidth += (children.length - 1) * SIBLING_GAP

	unit.subtreeWidth = Math.max(unit.ownWidth, childrenWidth)
	return unit.subtreeWidth
}

/** Top-down: hand each subtree its slot, then centre the parent's cards over it. */
function place(
	units: Map<string, Unit>,
	unitId: string,
	left: number,
	seen: Set<string>,
): void {
	const unit = units.get(unitId)
	if (!unit || seen.has(unitId)) return
	seen.add(unitId)

	unit.ownX = left + (unit.subtreeWidth - unit.ownWidth) / 2

	const children = unit.childUnitIds
	if (children.length === 0) return

	let childrenWidth = (children.length - 1) * SIBLING_GAP
	for (const childId of children)
		childrenWidth += units.get(childId)?.subtreeWidth ?? 0

	let cursor = left + (unit.subtreeWidth - childrenWidth) / 2
	for (const childId of children) {
		place(units, childId, cursor, seen)
		cursor += (units.get(childId)?.subtreeWidth ?? 0) + SIBLING_GAP
	}
}

/* ------------------------------------------------------------------ *
 * Step 4 — anchoring in-law subtrees next to the people they marry into
 * ------------------------------------------------------------------ */

/**
 * A unit hangs off its *anchor's* parents, so a couple can only be structurally
 * attached to one bloodline. The other spouse's parents form a subtree with no
 * link into the main tree at all, and laying those out as independent forest
 * roots parks them at the far right of the chart with a descent line stretching
 * back across everything — a wife's parents ending up 1,400px from her.
 *
 * So these subtrees are placed in a second pass instead: each is slid to sit
 * directly above the person it married into, then nudged sideways by the
 * smallest amount that clears whatever is already on that row.
 */

type Extents = Map<number, Array<[start: number, end: number]>>

/** Every unit in this subtree, following child links. */
function collectSubtree(units: Map<string, Unit>, unitId: string): Unit[] {
	const out: Unit[] = []
	const seen = new Set<string>()
	const stack = [unitId]
	while (stack.length > 0) {
		const id = stack.pop() as string
		if (seen.has(id)) continue
		seen.add(id)
		const unit = units.get(id)
		if (!unit) continue
		out.push(unit)
		stack.push(...unit.childUnitIds)
	}
	return out
}

function addExtents(target: Extents, members: Unit[]): void {
	for (const unit of members) {
		const row = target.get(unit.generation) ?? []
		row.push([unit.ownX, unit.ownX + unit.ownWidth])
		target.set(unit.generation, row)
	}
}

function collides(occupied: Extents, members: Unit[], offset: number): boolean {
	for (const unit of members) {
		const start = unit.ownX + offset - SUBTREE_GAP
		const end = unit.ownX + offset + unit.ownWidth + SUBTREE_GAP
		for (const [otherStart, otherEnd] of occupied.get(unit.generation) ?? []) {
			if (start < otherEnd && otherStart < end) return true
		}
	}
	return false
}

/**
 * The offset closest to `desired` that puts none of `members` on top of
 * anything already placed. Candidates are the desired position itself plus
 * every position that butts the subtree up against an occupied neighbour, which
 * is enough to find the true nearest gap without scanning pixel by pixel.
 */
function findFreeOffset(
	occupied: Extents,
	members: Unit[],
	desired: number,
): number {
	const candidates = [desired]
	for (const unit of members) {
		for (const [otherStart, otherEnd] of occupied.get(unit.generation) ?? []) {
			candidates.push(otherEnd + SUBTREE_GAP - unit.ownX)
			candidates.push(otherStart - SUBTREE_GAP - unit.ownWidth - unit.ownX)
		}
	}

	let best: number | undefined
	for (const candidate of candidates) {
		if (collides(occupied, members, candidate)) continue
		if (
			best === undefined ||
			Math.abs(candidate - desired) < Math.abs(best - desired)
		) {
			best = candidate
		}
	}
	return best ?? desired
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

export function layoutFamily(
	graph: FamilyGraph,
	rootId: string,
	options: FamilyLayoutOptions = {},
): LayoutResult {
	const {
		ancestorDepth = 2,
		descendantDepth = 2,
		ancestorOverrides = new Map<string, boolean>(),
		descendantOverrides = new Map<string, boolean>(),
	} = options

	const neighborhood = selectNeighborhood(
		graph,
		rootId,
		ancestorDepth,
		descendantDepth,
		ancestorOverrides,
		descendantOverrides,
	)
	const visible = new Set(neighborhood.generations.keys())
	const { units, unitOfPerson } = buildUnits(graph, neighborhood)

	const byDiscovery = (a: Unit, b: Unit) =>
		(neighborhood.order.get(a.anchorId) ?? 0) -
		(neighborhood.order.get(b.anchorId) ?? 0)

	// The main tree: everything reachable from the focus person's unit by
	// walking parent and child links. Anything else married into it.
	const primary = new Set<string>()
	const rootUnitId = unitOfPerson.get(rootId)
	if (rootUnitId) {
		const stack = [rootUnitId]
		while (stack.length > 0) {
			const id = stack.pop() as string
			if (primary.has(id)) continue
			primary.add(id)
			const unit = units.get(id)
			if (!unit) continue
			if (unit.parentUnitId) stack.push(unit.parentUnitId)
			stack.push(...unit.childUnitIds)
		}
	}

	const allRoots = [...units.values()]
		.filter((unit) => !unit.parentUnitId)
		.sort((a, b) => a.generation - b.generation || byDiscovery(a, b))

	const measured = new Set<string>()
	for (const root of allRoots) measure(units, root.id, measured)

	const placed = new Set<string>()
	const occupied: Extents = new Map()

	// Pass one: the bloodline, packed left to right as before.
	let cursor = 0
	for (const root of allRoots) {
		if (!primary.has(root.id)) continue
		place(units, root.id, cursor, placed)
		cursor += root.subtreeWidth + SUBTREE_GAP
		addExtents(occupied, collectSubtree(units, root.id))
	}

	/** Where a person's card currently sits, given their unit is placed. */
	const cardX = (personId: string): number | undefined => {
		const unit = units.get(unitOfPerson.get(personId) ?? "")
		const index = unit?.memberIds.indexOf(personId) ?? -1
		if (!unit || index < 0) return undefined
		return unit.ownX + index * (CARD_WIDTH + SPOUSE_GAP)
	}

	// Pass two: married-in subtrees, each slid under the person it connects to.
	const satellites = allRoots
		.filter((root) => !primary.has(root.id))
		.sort(byDiscovery)

	for (const root of satellites) {
		place(units, root.id, 0, placed)
		const members = collectSubtree(units, root.id)

		// Find where this subtree touches the chart: a child of one of its
		// unions who is already on screen as somebody's spouse.
		let desired: number | undefined
		for (const unit of members) {
			for (const { unionId, leftIndex } of unit.unions) {
				const union = graph.unions.get(unionId)
				if (!union) continue
				for (const childId of union.childIds) {
					const childUnitId = unitOfPerson.get(childId)
					if (!childUnitId || !placed.has(childUnitId)) continue
					if (members.some((member) => member.id === childUnitId)) continue

					const childLeft = cardX(childId)
					if (childLeft === undefined) continue

					// Line the couple's union marker up over their child's card so
					// the descent edge drops straight down.
					const unionX =
						unit.ownX +
						leftIndex * (CARD_WIDTH + SPOUSE_GAP) +
						CARD_WIDTH +
						SPOUSE_GAP / 2
					desired = childLeft + CARD_WIDTH / 2 - unionX
					break
				}
				if (desired !== undefined) break
			}
			if (desired !== undefined) break
		}

		// Nothing to anchor to — fall back to appending on the right.
		const offset =
			desired === undefined
				? cursor
				: findFreeOffset(occupied, members, desired)

		for (const unit of members) unit.ownX += offset
		if (desired === undefined) cursor += root.subtreeWidth + SUBTREE_GAP
		addExtents(occupied, members)
	}

	// Rows are driven by generation, not tree depth, so people of the same
	// generation line up even across unrelated subtrees.
	const minGeneration = Math.min(
		...[...units.values()].map((u) => u.generation),
		0,
	)
	const rowY = (generation: number) => (generation - minGeneration) * ROW_HEIGHT

	const nodes: LayoutNode[] = []
	const edges: LayoutEdge[] = []
	const memberX = new Map<string, number>()

	for (const unit of units.values()) {
		const y = rowY(unit.generation)

		unit.memberIds.forEach((personId, index) => {
			const person = graph.people.get(personId)
			if (!person) return
			const x = unit.ownX + index * (CARD_WIDTH + SPOUSE_GAP)
			memberX.set(personId, x)
			nodes.push({
				id: personId,
				type: "person",
				x,
				y,
				data: (() => {
					const up = branchState(parentIdsOf(graph, personId), visible)
					const down = branchState(childIdsOf(graph, personId), visible)
					return {
						person,
						isRoot: personId === rootId,
						ancestors: up.state,
						descendants: down.state,
						hiddenAncestorCount: up.hidden,
						hiddenDescendantCount: down.hidden,
						ancestorsUserExpanded: ancestorOverrides.get(personId) === true,
						descendantsUserExpanded: descendantOverrides.get(personId) === true,
					}
				})(),
			})
		})

		for (const { unionId, leftIndex } of unit.unions) {
			const union = graph.unions.get(unionId)
			if (!union) continue

			const leftId = unit.memberIds[leftIndex]
			const rightId = unit.memberIds[leftIndex + 1]
			const hasCouple = Boolean(leftId && rightId)

			// The marker sits in the gap between the couple, vertically centred —
			// so the descent line drops between the cards instead of behind them.
			const unionX = hasCouple
				? unit.ownX +
					leftIndex * (CARD_WIDTH + SPOUSE_GAP) +
					CARD_WIDTH +
					SPOUSE_GAP / 2 -
					UNION_SIZE / 2
				: unit.ownX +
					leftIndex * (CARD_WIDTH + SPOUSE_GAP) +
					CARD_WIDTH / 2 -
					UNION_SIZE / 2
			const unionY = y + CARD_HEIGHT / 2 - UNION_SIZE / 2

			nodes.push({
				id: unionId,
				type: "union",
				x: unionX,
				y: unionY,
				data: { unionId },
			})

			if (hasCouple) {
				// Two short segments through the marker draw the couple's join line.
				edges.push({
					id: `${leftId}->${unionId}`,
					source: leftId,
					target: unionId,
					kind: "spouse",
					sourceHandle: "right",
					targetHandle: "left",
					dashed: union.divorced,
				})
				edges.push({
					id: `${unionId}->${rightId}`,
					source: unionId,
					target: rightId,
					kind: "spouse",
					sourceHandle: "right",
					targetHandle: "left",
					dashed: union.divorced,
				})
			}

			for (const childId of union.childIds) {
				if (!neighborhood.generations.has(childId)) continue
				edges.push({
					id: `${unionId}->${childId}`,
					source: unionId,
					target: childId,
					kind: "descent",
					sourceHandle: "bottom",
					targetHandle: "top",
				})
			}
		}
	}

	assignDescentLanes(nodes, edges)

	return { nodes, edges, visibleCount: neighborhood.generations.size }
}

/**
 * Give every union's sibling bar a height, stacking the ones that would collide.
 *
 * All the descent edges leaving a union overlay into a single horizontal run —
 * that's the sibling bar, and it is the whole reason for union nodes. What the
 * bar can't do on its own is stay distinguishable: every union on a row put its
 * run at the same y, so two families whose spans crossed drew one line and there
 * was no way to see which end belonged to which parents. A couple whose child
 * married in sits far from that child, so the crossings are not rare — on the
 * real tree, three pairs of bars shared a line, one of them for 1,696px.
 *
 * So bars are lanes, assigned per row by interval colouring: sort by left edge,
 * and take the first lane whose previous occupant has already ended. Bars that
 * do not overlap keep lane 0 and the common case looks exactly as before; only
 * the ones that would have been drawn on top of each other move.
 *
 * Greedy is optimal here — this is interval-graph colouring, where sorting by
 * left endpoint is exact rather than approximate — so no arrangement of the same
 * bars would use fewer lanes.
 */
function assignDescentLanes(nodes: LayoutNode[], edges: LayoutEdge[]): void {
	const positions = new Map(nodes.map((node) => [node.id, node]))

	/** One entry per union that has children drawn: its row and horizontal reach. */
	const bars = new Map<
		string,
		{ childTop: number; left: number; right: number }
	>()

	for (const edge of edges) {
		if (edge.kind !== "descent") continue
		const union = positions.get(edge.source)
		const child = positions.get(edge.target)
		if (!union || !child) continue

		const unionCenter = union.x + UNION_SIZE / 2
		const childCenter = child.x + CARD_WIDTH / 2
		const bar = bars.get(edge.source) ?? {
			childTop: child.y,
			left: unionCenter,
			right: unionCenter,
		}
		bar.left = Math.min(bar.left, unionCenter, childCenter)
		bar.right = Math.max(bar.right, unionCenter, childCenter)
		bars.set(edge.source, bar)
	}

	// Colour each row independently: bars on different rows can never collide.
	type Bar = { childTop: number; left: number; right: number }
	const rows = new Map<number, Array<[string, Bar]>>()
	for (const [unionId, bar] of bars) {
		const row = rows.get(bar.childTop) ?? []
		row.push([unionId, bar])
		rows.set(bar.childTop, row)
	}

	const lanes = new Map<string, number>()
	for (const row of rows.values()) {
		row.sort((a, b) => a[1].left - b[1].left)
		/** Rightmost point reached so far in each lane. */
		const occupied: number[] = []
		for (const [unionId, bar] of row) {
			let lane = occupied.findIndex((end) => end <= bar.left)
			if (lane === -1) lane = occupied.length
			occupied[lane] = bar.right
			lanes.set(unionId, lane)
		}
	}

	for (const edge of edges) {
		if (edge.kind !== "descent") continue
		const bar = bars.get(edge.source)
		if (!bar) continue
		// Measured up from the children, so the band sits a fixed distance above
		// the cards it feeds. Extra lanes stack towards the parents, into the gap
		// that `GENERATION_GAP` exists to provide.
		edge.busY =
			bar.childTop -
			DESCENT_BUS_INSET -
			(lanes.get(edge.source) ?? 0) * DESCENT_LANE_STEP
	}
}
