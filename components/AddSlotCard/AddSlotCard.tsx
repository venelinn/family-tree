"use client"

import type { NodeProps } from "@xyflow/react"
import clsx from "clsx"
import { useTranslations } from "next-intl"
import { RelationIcon } from "@/components/RelationIcon"
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/layout/constants"
import type { AddSlotNodeData } from "@/lib/layout/types"
import styles from "./AddSlotCard.module.scss"

/**
 * A ghost card in the position a new relative would occupy — "Add sister" to the
 * left, "Add son" below, and so on.
 *
 * These float *over* the chart rather than being laid out into it. Reserving
 * real space for seven slots would reflow the whole tree every time you selected
 * someone; overlapping neighbours is what MyHeritage does too, and it keeps the
 * chart still while you decide.
 */
export function AddSlotCard({ data }: NodeProps & { data: AddSlotNodeData }) {
	const t = useTranslations("slots")

	return (
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation()
				data.onAdd?.(data.anchorId, data.relation, data.sex, data.slot)
			}}
			style={
				{
					"--_card-width": `${CARD_WIDTH}px`,
					"--_card-height": `${CARD_HEIGHT}px`,
				} as React.CSSProperties
			}
			data-sex={data.sex === "F" ? "female" : "male"}
			// `nodrag` is React Flow's: without it, pressing the card drags the node.
			className={clsx("nodrag", styles.slot)}
		>
			<span className={styles.slot__badge}>
				<RelationIcon relation={data.relation} />
			</span>
			<span className={styles.slot__label}>{t(data.slot)}</span>
		</button>
	)
}
