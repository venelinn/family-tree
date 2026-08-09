import type { FamilyGraph } from "../family-graph"
import { CARD_HEIGHT, CARD_WIDTH, ROW_HEIGHT, SIBLING_GAP } from "./constants"
import type { AddSlotNodeData, LayoutNode } from "./types"

/**
 * Ghost "Add …" cards arranged around the selected person.
 *
 * Positions are computed from the selected card rather than laid out into the
 * chart: seven extra cards would reflow the whole tree on every selection, and
 * the point is to keep everything still while you decide. They overlap
 * neighbours, which is fine — they're transient and sit above everything.
 *
 * Slots are only offered where they'd mean something: no "Add father" for
 * someone who already has one.
 */

/** Horizontal breathing room between the person's card and a ghost card. */
const GAP = SIBLING_GAP

interface SlotSpec {
	key: string
	relation: AddSlotNodeData["relation"]
	sex: "M" | "F"
	label: string
	dx: number
	dy: number
}

export function buildAddSlots(
	graph: FamilyGraph,
	nodes: LayoutNode[],
	selectedId: string | null,
	onAdd: AddSlotNodeData["onAdd"],
): LayoutNode[] {
	if (!selectedId) return []

	const anchor = nodes.find(
		(node) => node.id === selectedId && node.type === "person",
	)
	const person = graph.people.get(selectedId)
	if (!anchor || !person) return []

	const birthUnion = person.childOfUnionId
		? graph.unions.get(person.childOfUnionId)
		: undefined

	const column = CARD_WIDTH + GAP
	const specs: SlotSpec[] = []

	// Parents go above, in the seats they'd actually occupy. Only offered when
	// the seat is empty — the tree allows one father and one mother.
	if (!birthUnion?.husbandId) {
		specs.push({
			key: "father",
			relation: "parent",
			sex: "M",
			label: "Add father",
			dx: -column / 2,
			dy: -ROW_HEIGHT,
		})
	}
	if (!birthUnion?.wifeId) {
		specs.push({
			key: "mother",
			relation: "parent",
			sex: "F",
			label: "Add mother",
			dx: column / 2,
			dy: -ROW_HEIGHT,
		})
	}

	// Siblings sit alongside, stacked so both fit without covering the person.
	specs.push(
		{
			key: "brother",
			relation: "sibling",
			sex: "M",
			label: "Add brother",
			dx: -column,
			dy: -(CARD_HEIGHT / 2 + 8),
		},
		{
			key: "sister",
			relation: "sibling",
			sex: "F",
			label: "Add sister",
			dx: -column,
			dy: CARD_HEIGHT / 2 + 8,
		},
	)

	// A partner goes where a spouse card would.
	specs.push({
		key: "partner",
		relation: "spouse",
		sex: person.sex === "M" ? "F" : "M",
		label: "Add partner",
		dx: column,
		dy: 0,
	})

	// Children below, mirroring the sibling pair.
	specs.push(
		{
			key: "son",
			relation: "child",
			sex: "M",
			label: "Add son",
			dx: -column / 2,
			dy: ROW_HEIGHT,
		},
		{
			key: "daughter",
			relation: "child",
			sex: "F",
			label: "Add daughter",
			dx: column / 2,
			dy: ROW_HEIGHT,
		},
	)

	return specs.map((spec) => ({
		id: `add:${selectedId}:${spec.key}`,
		type: "addSlot" as const,
		x: anchor.x + spec.dx,
		y: anchor.y + spec.dy,
		data: {
			anchorId: selectedId,
			relation: spec.relation,
			sex: spec.sex,
			label: spec.label,
			onAdd,
		},
	}))
}
