"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/layout/constants"
import type { PlaceholderNodeData } from "@/lib/layout/types"

/**
 * An ancestor slot we have no record for. Inert for now — it becomes the entry
 * point for "add person" once editing lands.
 */
export function PlaceholderCard({
	data,
}: NodeProps & { data: PlaceholderNodeData }) {
	return (
		<div
			className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-[12px] text-slate-400"
			style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
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
