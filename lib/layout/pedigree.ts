import { type FamilyGraph, getFather, getMother } from "../family-graph"
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	PEDIGREE_COLUMN_GAP,
	PEDIGREE_ROW_GAP,
} from "./constants"
import type { LayoutEdge, LayoutNode, LayoutResult } from "./types"

/**
 * Ancestor (pedigree) view: the root on the left, father above mother, one
 * column per generation.
 *
 * This is a strict binary tree, so it needs none of the union machinery the
 * family view does — just a recursive walk. Rows are assigned bottom-up: the
 * rightmost column takes consecutive slots, and every other card is centred
 * between its two parents, which is what keeps the whole chart visually balanced.
 */

export interface PedigreeLayoutOptions {
	/** Columns to draw, root included. 4 means root + 3 ancestor generations. */
	generations?: number
	/** Emit "+ Add father/mother" slots for unknown parents. */
	showPlaceholders?: boolean
}

const COLUMN_STRIDE = CARD_WIDTH + PEDIGREE_COLUMN_GAP
const ROW_STRIDE = CARD_HEIGHT + PEDIGREE_ROW_GAP

export function layoutPedigree(
	graph: FamilyGraph,
	rootId: string,
	options: PedigreeLayoutOptions = {},
): LayoutResult {
	const { generations = 4, showPlaceholders = true } = options

	const nodes: LayoutNode[] = []
	const edges: LayoutEdge[] = []
	let nextSlot = 0
	let visibleCount = 0

	const connect = (childId: string, parentId: string) => {
		edges.push({
			id: `${childId}->${parentId}`,
			source: childId,
			target: parentId,
			kind: "descent",
			sourceHandle: "right",
			targetHandle: "left",
		})
	}

	/** Consume a row slot for an ancestor we don't have on file. */
	const addPlaceholder = (
		childId: string,
		relation: "father" | "mother",
		generation: number,
	): number => {
		const y = nextSlot++ * ROW_STRIDE
		const id = `placeholder:${childId}:${relation}`
		nodes.push({
			id,
			type: "placeholder",
			x: generation * COLUMN_STRIDE,
			y,
			data: { relation, forPersonId: childId },
		})
		connect(childId, id)
		return y
	}

	/**
	 * Returns the y this person was placed at, so the caller can centre itself
	 * between its father and mother.
	 */
	const walk = (
		personId: string,
		generation: number,
		ancestry: Set<string>,
	): number => {
		const person = graph.people.get(personId)
		const x = generation * COLUMN_STRIDE

		// Pedigree collapse (cousins marrying) would otherwise recurse forever.
		const isLastColumn = generation >= generations - 1
		const alreadyOnPath = ancestry.has(personId)

		if (!person || isLastColumn || alreadyOnPath) {
			const y = nextSlot++ * ROW_STRIDE
			if (person) {
				nodes.push({
					id: personId,
					type: "person",
					x,
					y,
					data: {
						person,
						isRoot: generation === 0,
						ancestors: "none",
						descendants: "none",
						hiddenAncestorCount: 0,
						hiddenDescendantCount: 0,
					},
				})
				visibleCount += 1
			}
			return y
		}

		const nextAncestry = new Set(ancestry).add(personId)
		const father = getFather(graph, personId)
		const mother = getMother(graph, personId)

		// Father first so he lands in the lower slot number — i.e. above.
		let fatherY: number | undefined
		if (father) {
			fatherY = walk(father.id, generation + 1, nextAncestry)
			connect(personId, father.id)
		} else if (showPlaceholders) {
			fatherY = addPlaceholder(personId, "father", generation + 1)
		}

		let motherY: number | undefined
		if (mother) {
			motherY = walk(mother.id, generation + 1, nextAncestry)
			connect(personId, mother.id)
		} else if (showPlaceholders) {
			motherY = addPlaceholder(personId, "mother", generation + 1)
		}

		const parentYs = [fatherY, motherY].filter(
			(value): value is number => value != null,
		)
		const y =
			parentYs.length > 0
				? parentYs.reduce((a, b) => a + b, 0) / parentYs.length
				: nextSlot++ * ROW_STRIDE

		nodes.push({
			id: personId,
			type: "person",
			x,
			y,
			data: {
				person,
				isRoot: generation === 0,
				ancestors: "none",
				descendants: "none",
				hiddenAncestorCount: 0,
				hiddenDescendantCount: 0,
			},
		})
		visibleCount += 1
		return y
	}

	walk(rootId, 0, new Set())

	return { nodes, edges, visibleCount }
}
