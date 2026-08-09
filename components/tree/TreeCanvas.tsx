"use client"

import {
	Background,
	Controls,
	type Edge,
	MiniMap,
	type Node,
	ReactFlow,
	useEdgesState,
	useNodesInitialized,
	useNodesState,
	useReactFlow,
	useStore,
} from "@xyflow/react"
import { useEffect, useMemo } from "react"
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	PEDIGREE_CARD_HEIGHT,
	PEDIGREE_CARD_WIDTH,
	UNION_SIZE,
} from "@/lib/layout/constants"
import type { LayoutNode, LayoutResult, ViewType } from "@/lib/layout/types"
import type { ThemePreference } from "@/lib/theming"
import { AddSlotCard } from "./AddSlotCard"
import { PersonCard } from "./PersonCard"
import { PlaceholderCard } from "./PlaceholderCard"
import { UnionCard } from "./UnionCard"

// Defined at module scope: a fresh object each render makes React Flow rebuild
// every node component and is the classic source of flicker.
const nodeTypes = {
	person: PersonCard,
	union: UnionCard,
	placeholder: PlaceholderCard,
	addSlot: AddSlotCard,
}

/** Below this, card text stops being legible — pan instead of shrinking further. */
const MIN_READABLE_ZOOM = 0.6

/** Corner radius where a descent line turns into the sibling bar. */
const CORNER_RADIUS = 14

/** Breathing room around the chart when it does fit, as a multiplier. */
const FIT_PADDING = 1.15

interface TreeCanvasProps {
	layout: LayoutResult
	view: ViewType
	rootId: string
	selectedId: string | null
	onSelect: (personId: string | null) => void
	onToggleAncestors: (personId: string) => void
	onToggleDescendants: (personId: string) => void
	/** Ghost "Add …" cards to float over the chart, already positioned. */
	addSlots?: LayoutNode[]
	/** Whose add-slots are open, so their card can show a close button. */
	addingFor?: string | null
	onRequestAdd?: (personId: string) => void
	/**
	 * Handed to React Flow's own `colorMode` so its chrome — the zoom controls,
	 * the minimap frame, the attribution — follows the theme. Our three
	 * preferences happen to be exactly React Flow's three, `system` included, so
	 * this passes straight through with nothing to resolve.
	 */
	theme: ThemePreference
}

export function TreeCanvas({
	layout,
	view,
	rootId,
	selectedId,
	onSelect,
	onToggleAncestors,
	onToggleDescendants,
	addSlots = [],
	addingFor,
	onRequestAdd,
	theme,
}: TreeCanvasProps) {
	const layoutNodes = useMemo<Node[]>(
		() =>
			// Ghost slots go last so they paint above the chart they overlap.
			[...layout.nodes, ...addSlots].map((node) => ({
				id: node.id,
				type: node.type,
				position: { x: node.x, y: node.y },
				// Selection rides in `data` rather than React Flow's own `selected`
				// flag, so there is exactly one source of truth for it.
				data: {
					...node.data,
					isSelected: node.id === selectedId,
					isAdding: node.id === addingFor,
					onToggleAncestors,
					onToggleDescendants,
					onRequestAdd,
				},
				// Positions come from the layout, so dragging would only desync them.
				draggable: false,
				connectable: false,
			})),
		[
			layout.nodes,
			addSlots,
			selectedId,
			addingFor,
			onToggleAncestors,
			onToggleDescendants,
			onRequestAdd,
		],
	)

	const layoutEdges = useMemo<Edge[]>(
		() =>
			layout.edges.map((edge) => ({
				id: edge.id,
				source: edge.source,
				target: edge.target,
				sourceHandle: edge.sourceHandle,
				targetHandle: edge.targetHandle,
				type: edge.kind === "spouse" ? "straight" : "smoothstep",
				// Descent lines drop from the union, run along a shared sibling bar
				// and turn down into each child. `smoothstep` rounds those two
				// corners; the default 5px barely reads once the chart is zoomed
				// out, so open it up to match the softer genealogy-chart look.
				pathOptions:
					edge.kind === "descent" ? { borderRadius: CORNER_RADIUS } : undefined,
				focusable: false,
				selectable: false,
				// CSS variables rather than hex, so the theme is resolved by the
				// browser at paint time. That keeps the one palette in
				// `globals.css` — and keeps this memo out of the theme's business,
				// since nothing here changes when the theme does.
				style: {
					stroke:
						edge.kind === "spouse"
							? "var(--edge-spouse)"
							: "var(--edge-descent)",
					strokeWidth: edge.kind === "spouse" ? 2 : 1.5,
					strokeDasharray: edge.dashed ? "4 3" : undefined,
				},
			})),
		[layout.edges],
	)

	// React Flow must own the node array. Passing `nodes` as a plain prop without
	// `onNodesChange` silently drops the dimension-measurement changes, which
	// leaves `useNodesInitialized` false forever and fitView never firing.
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

	useEffect(() => {
		setNodes(layoutNodes)
	}, [layoutNodes, setNodes])

	useEffect(() => {
		setEdges(layoutEdges)
	}, [layoutEdges, setEdges])

	const cardWidth = view === "pedigree" ? PEDIGREE_CARD_WIDTH : CARD_WIDTH
	const cardHeight = view === "pedigree" ? PEDIGREE_CARD_HEIGHT : CARD_HEIGHT

	/** Extent of the drawn chart, in layout coordinates. */
	const bounds = useMemo(() => {
		let minX = Number.POSITIVE_INFINITY
		let minY = Number.POSITIVE_INFINITY
		let maxX = Number.NEGATIVE_INFINITY
		let maxY = Number.NEGATIVE_INFINITY
		for (const node of layout.nodes) {
			const width = node.type === "union" ? UNION_SIZE : cardWidth
			const height = node.type === "union" ? UNION_SIZE : cardHeight
			minX = Math.min(minX, node.x)
			minY = Math.min(minY, node.y)
			maxX = Math.max(maxX, node.x + width)
			maxY = Math.max(maxY, node.y + height)
		}
		return {
			centerX: (minX + maxX) / 2,
			centerY: (minY + maxY) / 2,
			width: maxX - minX,
			height: maxY - minY,
		}
	}, [layout.nodes, cardWidth, cardHeight])

	const { setCenter } = useReactFlow()
	const nodesInitialized = useNodesInitialized()
	const flowWidth = useStore((state) => state.width)
	const flowHeight = useStore((state) => state.height)

	// Re-frame whenever the chart changes shape. `useNodesInitialized` is the
	// supported way to wait until cards have been measured — it replaces the
	// setTimeout guesswork this component started life with.
	//
	// The zoom is computed rather than delegated to fitView for two reasons:
	// fitView applies asynchronously and would clobber a setCenter issued right
	// after it, and family charts are so wide and short that a true fit shrinks
	// the cards past readability. So we work out the fit scale, put a floor
	// under it, and centre on the focus person — panning out is the user's call.
	// biome-ignore lint/correctness/useExhaustiveDependencies: view/rootId are the intended re-frame triggers, not values read in the effect
	useEffect(() => {
		if (!nodesInitialized || !flowWidth || !flowHeight) return

		const root = layout.nodes.find((node) => node.id === rootId)
		if (!root) return

		const fitScale = Math.min(
			flowWidth / (bounds.width * FIT_PADDING),
			flowHeight / (bounds.height * FIT_PADDING),
		)
		const zoom = Math.min(1, Math.max(fitScale, MIN_READABLE_ZOOM))

		// The family view puts the root in the middle of its generation, so
		// centring on it frames well. The pedigree grows rightwards from a root
		// pinned at the left edge, so centring there would waste half the canvas —
		// frame it horizontally instead, keeping the root's row vertically centred.
		const centerX =
			view === "pedigree" ? bounds.centerX : root.x + cardWidth / 2

		// Vertically the chart is only a few rows, so frame all of them. Centring
		// on the root's own row instead would push the top generation off-screen
		// whenever the root isn't the middle one.
		setCenter(centerX, bounds.centerY, { zoom, duration: 400 })
	}, [
		nodesInitialized,
		setCenter,
		flowWidth,
		flowHeight,
		bounds,
		cardWidth,
		view,
		rootId,
	])

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			onNodesChange={onNodesChange}
			onEdgesChange={onEdgesChange}
			nodeTypes={nodeTypes}
			onNodeClick={(_, node) => {
				if (node.type === "person") onSelect(node.id)
			}}
			onPaneClick={() => onSelect(null)}
			nodesDraggable={false}
			nodesConnectable={false}
			elementsSelectable={false}
			minZoom={0.05}
			maxZoom={2}
			proOptions={{ hideAttribution: true }}
			colorMode={theme}
			className="bg-surface"
		>
			{/* React Flow passes `color` through as a custom property on the SVG's
			    inline style, and takes minimap fills and edge strokes as inline
			    styles too — so a `var()` resolves in all three and the canvas
			    reads from the same palette as the rest of the app. */}
			<Background gap={20} size={1} color="var(--canvas-dot)" />
			<Controls showInteractive={false} />
			<MiniMap
				pannable
				zoomable
				nodeColor={(node) => {
					if (node.type !== "person") return "var(--line)"
					const person = (node.data as { person?: { sex?: string } }).person
					return person?.sex === "F"
						? "var(--female-solid)"
						: "var(--male-solid)"
				}}
				className="bg-panel!"
			/>
		</ReactFlow>
	)
}
