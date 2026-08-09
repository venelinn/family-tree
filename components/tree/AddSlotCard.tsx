"use client"

import type { NodeProps } from "@xyflow/react"
import { UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/layout/constants"
import type { AddSlotNodeData } from "@/lib/layout/types"

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
	const female = data.sex === "F"

	return (
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation()
				data.onAdd?.(data.anchorId, data.relation, data.sex, data.slot)
			}}
			style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
			className={`nodrag flex flex-col items-center justify-center gap-2 rounded-xl border-2 bg-panel shadow-lg transition-transform hover:scale-[1.03] ${
				female
					? "border-female-line text-female-ink hover:bg-female-soft"
					: "border-male-line text-male-ink hover:bg-male-soft"
			}`}
		>
			<span
				className={`flex h-11 w-11 items-center justify-center rounded-full ${
					female ? "bg-female-soft" : "bg-male-soft"
				}`}
			>
				<UserPlus size={20} strokeWidth={2} />
			</span>
			<span className="px-1 text-center font-semibold text-[11px] text-ink-soft leading-tight">
				{t(data.slot)}
			</span>
		</button>
	)
}
