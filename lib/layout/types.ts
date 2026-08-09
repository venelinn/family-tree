import type { Person } from "../family-graph"

export type ViewType = "family" | "pedigree"

/**
 * Whether a person's parents (or children) are currently drawn.
 *
 *  - `none`        — there are none on record, so there is nothing to toggle
 *  - `expandable`  — some exist but are not drawn; offer to reveal them
 *  - `collapsible` — all are drawn; offer to hide them
 */
export type BranchState = "none" | "expandable" | "collapsible"

/** Portrait in the family view, landscape in the pedigree. */
export type CardVariant = "portrait" | "landscape"

export interface PersonNodeData {
	person: Person
	variant?: CardVariant
	/** The person the view is currently centred on. */
	isRoot: boolean
	/** Set by the canvas, not the layout — see TreeCanvas for why it lives here. */
	isSelected?: boolean
	/** Whether this card offers an expand/collapse handle upwards. */
	ancestors: BranchState
	/** ...and downwards. */
	descendants: BranchState
	/** How many relatives the handle would reveal — shown on the label. */
	hiddenAncestorCount: number
	hiddenDescendantCount: number
	/** True when the user explicitly opened this branch, so it can be closed again. */
	ancestorsUserExpanded?: boolean
	descendantsUserExpanded?: boolean
	/** True while this person's ghost "Add …" cards are on screen. */
	isAdding?: boolean
	/** Wired up by the canvas. */
	onToggleAncestors?: (personId: string) => void
	onToggleDescendants?: (personId: string) => void
	onRequestAdd?: (personId: string) => void
	[key: string]: unknown
}

/** A "+ Add father" slot in the pedigree view — an ancestor we don't have yet. */
export interface PlaceholderNodeData {
	variant?: CardVariant
	relation: "father" | "mother"
	/** The person whose parent is missing. */
	forPersonId: string
	[key: string]: unknown
}

export interface UnionNodeData {
	unionId: string
	[key: string]: unknown
}

/** A ghost "Add sister" card floating beside the selected person. */
export interface AddSlotNodeData {
	anchorId: string
	relation: "parent" | "spouse" | "child" | "sibling"
	sex: "M" | "F"
	label: string
	onAdd?: (
		anchorId: string,
		relation: AddSlotNodeData["relation"],
		sex: "M" | "F",
		label: string,
	) => void
	[key: string]: unknown
}

export type LayoutNode =
	| { id: string; type: "person"; x: number; y: number; data: PersonNodeData }
	| {
			id: string
			type: "placeholder"
			x: number
			y: number
			data: PlaceholderNodeData
	  }
	| { id: string; type: "union"; x: number; y: number; data: UnionNodeData }
	| {
			id: string
			type: "addSlot"
			x: number
			y: number
			data: AddSlotNodeData
	  }

export type EdgeKind = "spouse" | "descent"

export interface LayoutEdge {
	id: string
	source: string
	target: string
	kind: EdgeKind
	/**
	 * Handles are chosen by the layout, not the renderer — the layout is what
	 * knows which side of a card an edge should leave from.
	 */
	sourceHandle: "right" | "bottom"
	targetHandle: "left" | "top"
	/** Rendered dashed, for divorced couples. */
	dashed?: boolean
}

export interface LayoutResult {
	nodes: LayoutNode[]
	edges: LayoutEdge[]
	/** How many people this view drew — the "36 of 252" counter. */
	visibleCount: number
}
