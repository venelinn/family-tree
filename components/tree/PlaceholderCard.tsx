"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	PEDIGREE_CARD_HEIGHT,
	PEDIGREE_CARD_WIDTH,
} from "@/lib/layout/constants"
import type { PlaceholderNodeData } from "@/lib/layout/types"

/**
 * An ancestor slot we have no record for. Inert for now — it becomes the entry
 * point for "add person" once editing lands.
 */
export function PlaceholderCard({
	data,
}: NodeProps & { data: PlaceholderNodeData }) {
	const landscape = data.variant === "landscape"

	return (
		<div
			className="flex items-center justify-center rounded-xl border-2 border-slate-300 border-dashed text-[12px] text-slate-400"
			style={{
				width: landscape ? PEDIGREE_CARD_WIDTH : CARD_WIDTH,
				height: landscape ? PEDIGREE_CARD_HEIGHT : CARD_HEIGHT,
			}}
		>
			<Handle
				type="target"
				id="left"
				position={Position.Left}
				className="!opacity-0"
			/>
			<span>+ Add {data.relation}</span>
		</div>
	)
}
