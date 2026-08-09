"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { Minus, Plus, X } from "lucide-react"
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/layout/constants"
import type { PersonNodeData } from "@/lib/layout/types"
import { Avatar } from "./Avatar"

/**
 * Handle contract, shared with UnionCard and PlaceholderCard:
 *   left = target, right = source, top = target.
 * Both layouts pick handles by these names, so a card never needs to know
 * which view it is being rendered in.
 */

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
]

/**
 * `1976-12-23` -> `Dec 23 1976`. Dates that never parsed to ISO are free text
 * from the export ("about 1910", "1912–1913"), so they pass through untouched.
 */
function formatDate(value: string | undefined): string | undefined {
	if (!value) return undefined
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!iso) return value
	const [, year, month, day] = iso
	return `${MONTHS[Number(month) - 1]} ${Number(day)} ${year}`
}

/**
 * The reveal bar that sits above or below a card.
 *
 * Deliberately the full width of the card and labelled with a count. The
 * earlier version was a bare 36px chevron: too small to hit comfortably, and it
 * never said what it would do or how many people were behind it. A wide strip
 * reading "2 parents" answers both without the user having to try it.
 *
 * A hidden branch always advertises itself, because that is information: "there
 * is more family this way". A branch already on screen only offers to collapse
 * on the *selected* card — that keeps every card in the chart from carrying two
 * permanent buttons, without hiding the action behind a hover the way the first
 * version did.
 */
function RevealBar({
	mode,
	count,
	direction,
	onToggle,
}: {
	mode: "expand" | "collapse"
	count: number
	direction: "up" | "down"
	onToggle?: () => void
}) {
	const plural = direction === "up" ? "parents" : "children"
	const noun = count === 1 ? (direction === "up" ? "parent" : "child") : plural

	// Plus and minus rather than chevrons: an arrow has to encode both direction
	// and action, and ends up meaning neither clearly. `+ 2 parents` reads on
	// sight.
	const Icon = mode === "expand" ? Plus : Minus
	const label = mode === "expand" ? `${count} ${noun}` : plural

	return (
		<button
			type="button"
			onClick={(event) => {
				// Otherwise the click also selects the card underneath.
				event.stopPropagation()
				onToggle?.()
			}}
			title={mode === "expand" ? `Show ${label}` : label}
			className={`nodrag absolute left-0 z-10 flex w-full items-center justify-center gap-1 rounded-md border py-0.5 font-medium text-[10px] shadow-sm transition-colors ${
				direction === "up" ? "-top-4" : "-bottom-4"
			} ${
				mode === "expand"
					? "border-slate-300 border-dashed bg-white/95 text-slate-500 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
					: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
			}`}
		>
			<Icon size={11} strokeWidth={2.5} />
			{label}
		</button>
	)
}

export function PersonCard({ data }: NodeProps & { data: PersonNodeData }) {
	const {
		person,
		isRoot,
		isSelected,
		ancestors,
		descendants,
		hiddenAncestorCount,
		hiddenDescendantCount,
		isAdding,
		onToggleAncestors,
		onToggleDescendants,
		onRequestAdd,
	} = data

	const accent =
		person.sex === "F"
			? "border-rose-300 bg-rose-50"
			: "border-sky-300 bg-sky-50"
	const ring = isSelected
		? "ring-2 ring-amber-400 ring-offset-1"
		: isRoot
			? "ring-2 ring-emerald-400 ring-offset-1"
			: ""

	const born = formatDate(person.birthDate)
	const died = formatDate(person.deathDate)

	return (
		<div
			className={`group relative flex flex-col items-center rounded-xl border-2 px-1.5 pt-2.5 pb-2 shadow-sm transition-shadow hover:shadow-md ${accent} ${ring}`}
			style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
		>
			<Handle
				type="target"
				id="top"
				position={Position.Top}
				className="opacity-0!"
			/>
			<Handle
				type="target"
				id="left"
				position={Position.Left}
				className="opacity-0!"
			/>
			<Handle
				type="source"
				id="right"
				position={Position.Right}
				className="opacity-0!"
			/>

			{/* Mourning ribbon across the top-left corner. */}
			{person.deceased ? (
				<span
					title="Deceased"
					className="pointer-events-none absolute top-0 left-0 h-5 w-5 overflow-hidden rounded-tl-[9px]"
				>
					<span
						className="block h-full w-full bg-slate-800"
						style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
					/>
				</span>
			) : null}

			{ancestors === "expandable" ||
			(ancestors === "collapsible" && isSelected) ? (
				<RevealBar
					mode={ancestors === "expandable" ? "expand" : "collapse"}
					count={hiddenAncestorCount}
					direction="up"
					onToggle={() => onToggleAncestors?.(person.id)}
				/>
			) : null}
			{descendants === "expandable" ||
			(descendants === "collapsible" && isSelected) ? (
				<RevealBar
					mode={descendants === "expandable" ? "expand" : "collapse"}
					count={hiddenDescendantCount}
					direction="down"
					onToggle={() => onToggleDescendants?.(person.id)}
				/>
			) : null}

			{/* Add relatives. Always on for the selected card, on hover otherwise —
			    20 permanent buttons would be noise, but hover-only would be
			    undiscoverable, so the selected card carries it openly. */}
			{onRequestAdd ? (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						onRequestAdd(person.id)
					}}
					title={isAdding ? "Close" : `Add a relative of ${person.name}`}
					className={`nodrag absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-opacity ${
						isAdding
							? "border-slate-700 bg-slate-800 text-white opacity-100"
							: "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-800"
					} ${isSelected || isAdding ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
				>
					{isAdding ? (
						<X size={12} strokeWidth={2.5} />
					) : (
						<Plus size={13} strokeWidth={2.5} />
					)}
				</button>
			) : null}

			<Avatar person={person} size={52} />

			<div className="mt-1.5 w-full text-center">
				<div className="line-clamp-2 font-semibold text-[11px] text-slate-800 leading-tight">
					{person.name}
				</div>
				<div className="mt-1 space-y-px text-[10px] text-slate-500 leading-tight">
					{born ? (
						<div className="truncate">
							<span className="text-slate-400">✳</span> {born}
						</div>
					) : null}
					{died ? (
						<div className="truncate">
							<span className="text-slate-400">†</span> {died}
						</div>
					) : null}
					{!born && !died && person.deceased ? <div>Deceased</div> : null}
				</div>
			</div>
		</div>
	)
}
