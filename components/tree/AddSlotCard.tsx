"use client"

import type { NodeProps } from "@xyflow/react"
import { UserPlus } from "lucide-react"
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
	const female = data.sex === "F"

	return (
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation()
				data.onAdd?.(data.anchorId, data.relation, data.sex, data.label)
			}}
			style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
			className={`nodrag flex flex-col items-center justify-center gap-2 rounded-xl border-2 bg-white shadow-lg transition-transform hover:scale-[1.03] ${
				female
					? "border-rose-300 text-rose-500 hover:bg-rose-50"
					: "border-sky-300 text-sky-500 hover:bg-sky-50"
			}`}
		>
			<span
				className={`flex h-11 w-11 items-center justify-center rounded-full ${
					female ? "bg-rose-100" : "bg-sky-100"
				}`}
			>
				<UserPlus size={20} strokeWidth={2} />
			</span>
			<span className="px-1 text-center font-semibold text-[11px] text-slate-600 leading-tight">
				{data.label}
			</span>
		</button>
	)
}
