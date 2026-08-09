"use client"

import { Handle, Position } from "@xyflow/react"
import { UNION_SIZE } from "@/lib/layout/constants"

/**
 * The couple marker. Visually it is just the small joint where the two spouse
 * lines meet and the descent line drops from — but structurally it is the node
 * that makes "these two are married" survive layout.
 */
export function UnionCard() {
	return (
		<div
			className="rounded-full bg-union"
			style={{ width: UNION_SIZE, height: UNION_SIZE }}
		>
			<Handle
				type="target"
				id="left"
				position={Position.Left}
				className="!opacity-0"
			/>
			<Handle
				type="source"
				id="right"
				position={Position.Right}
				className="!opacity-0"
			/>
			<Handle
				type="source"
				id="bottom"
				position={Position.Bottom}
				className="!opacity-0"
			/>
		</div>
	)
}
