"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { useTranslations } from "next-intl"
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	PEDIGREE_CARD_HEIGHT,
	PEDIGREE_CARD_WIDTH,
} from "@/lib/layout/constants"
import type { PlaceholderNodeData } from "@/lib/layout/types"
import styles from "./PlaceholderCard.module.scss"

/**
 * An ancestor slot we have no record for. Inert for now — it becomes the entry
 * point for "add person" once editing lands.
 */
export function PlaceholderCard({
	data,
}: NodeProps & { data: PlaceholderNodeData }) {
	// `relation` is "father" / "mother", which are also `slots.*` message keys.
	const t = useTranslations("slots")
	const landscape = data.variant === "landscape"

	return (
		<div
			className={styles.placeholder}
			style={
				{
					"--_card-width": `${landscape ? PEDIGREE_CARD_WIDTH : CARD_WIDTH}px`,
					"--_card-height": `${landscape ? PEDIGREE_CARD_HEIGHT : CARD_HEIGHT}px`,
				} as React.CSSProperties
			}
		>
			<Handle
				type="target"
				id="left"
				position={Position.Left}
				className={styles.placeholder__handle}
			/>
			<span>+ {t(data.relation)}</span>
		</div>
	)
}
