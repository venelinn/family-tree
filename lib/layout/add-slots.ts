import type { FamilyGraph } from "../family-graph"
import { CARD_HEIGHT, CARD_WIDTH, ROW_HEIGHT, SIBLING_GAP } from "./constants"
import type { AddSlotNodeData, LayoutNode, SlotKey } from "./types"

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
	/** Both the node-id suffix and the `slots.*` message key. */
	key: SlotKey
	relation: AddSlotNodeData["relation"]
	sex: "M" | "F"
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
			dx: -column / 2,
			dy: -ROW_HEIGHT,
		})
	}
	if (!birthUnion?.wifeId) {
		specs.push({
			key: "mother",
			relation: "parent",
			sex: "F",
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
			dx: -column,
			dy: -(CARD_HEIGHT / 2 + 8),
		},
		{
			key: "sister",
			relation: "sibling",
			sex: "F",
			dx: -column,
			dy: CARD_HEIGHT / 2 + 8,
		},
	)

	// A partner goes where a spouse card would.
	const partnerSex = person.sex === "M" ? "F" : "M"
	specs.push({
		key: partnerSex === "F" ? "partnerFemale" : "partnerMale",
		relation: "spouse",
		sex: partnerSex,
		dx: column,
		dy: 0,
	})

	// Children below, mirroring the sibling pair.
	specs.push(
		{
			key: "son",
			relation: "child",
			sex: "M",
			dx: -column / 2,
			dy: ROW_HEIGHT,
		},
		{
			key: "daughter",
			relation: "child",
			sex: "F",
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
			slot: spec.key,
			onAdd,
		},
	}))
}
