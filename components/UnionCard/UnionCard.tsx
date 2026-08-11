"use client"

import { Handle, Position } from "@xyflow/react"
import { UNION_SIZE } from "@/lib/layout/constants"
import styles from "./UnionCard.module.scss"

/**
 * The couple marker. Visually it is just the small joint where the two spouse
 * lines meet and the descent line drops from — but structurally it is the node
 * that makes "these two are married" survive layout.
 */
export function UnionCard() {
	return (
		<div
			className={styles.union}
			style={{ "--_union-size": `${UNION_SIZE}px` } as React.CSSProperties}
		>
			<Handle
				type="target"
				id="left"
				position={Position.Left}
				className={styles.union__handle}
			/>
			<Handle
				type="source"
				id="right"
				position={Position.Right}
				className={styles.union__handle}
			/>
			<Handle
				type="source"
				id="bottom"
				position={Position.Bottom}
				className={styles.union__handle}
			/>
		</div>
	)
}
