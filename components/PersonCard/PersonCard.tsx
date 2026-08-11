"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { Minus, Plus, X } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Avatar } from "@/components/Avatar"
import { usePersonName } from "@/components/PersonNames"
import { formatTreeDate } from "@/lib/date-format"
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	PEDIGREE_CARD_HEIGHT,
	PEDIGREE_CARD_WIDTH,
} from "@/lib/layout/constants"
import type { PersonNodeData } from "@/lib/layout/types"

/**
 * Handle contract, shared with UnionCard and PlaceholderCard:
 *   left = target, right = source, top = target.
 * Both layouts pick handles by these names, so a card never needs to know
 * which view it is being rendered in.
 */

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
	const t = useTranslations("card")

	// Expanding names a number, so it needs the plural form for that number;
	// collapsing just names the branch. Both come from the catalogue rather than
	// an English `count === 1` test, because plural rules differ by language.
	const label =
		mode === "expand"
			? t(direction === "up" ? "parents" : "children", { count })
			: t(direction === "up" ? "parentsPlain" : "childrenPlain")

	// Plus and minus rather than chevrons: an arrow has to encode both direction
	// and action, and ends up meaning neither clearly. `+ 2 parents` reads on
	// sight.
	const Icon = mode === "expand" ? Plus : Minus

	return (
		<button
			type="button"
			onClick={(event) => {
				// Otherwise the click also selects the card underneath.
				event.stopPropagation()
				onToggle?.()
			}}
			title={mode === "expand" ? t("showBranch", { branch: label }) : label}
			className={`nodrag absolute left-0 z-10 flex w-full items-center justify-center gap-1 rounded-md border py-0.5 font-medium text-[10px] shadow-sm transition-colors ${
				direction === "up" ? "-top-4" : "-bottom-4"
			} ${
				mode === "expand"
					? "border-line-strong border-dashed bg-panel-veil text-ink-muted hover:border-ink-faint hover:bg-wash hover:text-ink-soft"
					: "border-branch-line bg-branch-soft text-branch-ink hover:bg-branch-soft-hover"
			}`}
		>
			<Icon size={11} strokeWidth={2.5} />
			{label}
		</button>
	)
}

export function PersonCard({ data }: NodeProps & { data: PersonNodeData }) {
	const t = useTranslations("card")
	const locale = useLocale()
	const nameOf = usePersonName()

	const {
		person,
		isRoot,
		isSelected,
		ancestors,
		descendants,
		hiddenAncestorCount,
		hiddenDescendantCount,
		variant,
		isAdding,
		onToggleAncestors,
		onToggleDescendants,
		onRequestAdd,
	} = data

	const accent =
		person.sex === "F"
			? "border-female-line bg-female-soft"
			: "border-male-line bg-male-soft"
	// The offset colour has to be named: Tailwind's default is white, which
	// would draw a white halo around every ring on the dark canvas.
	const ring = isSelected
		? "ring-2 ring-branch-ring ring-offset-1 ring-offset-surface"
		: isRoot
			? "ring-2 ring-root-ring ring-offset-1 ring-offset-surface"
			: ""

	const born = formatTreeDate(person.birthDate, locale)
	const died = formatTreeDate(person.deathDate, locale)

	// Landscape in the pedigree, where a whole generation stacks in one column
	// and height is the scarce dimension; portrait in the family view, where the
	// chart sprawls sideways instead.
	const landscape = variant === "landscape"
	const width = landscape ? PEDIGREE_CARD_WIDTH : CARD_WIDTH
	const height = landscape ? PEDIGREE_CARD_HEIGHT : CARD_HEIGHT

	return (
		<div
			className={`group relative flex rounded-xl border-2 shadow-sm transition-shadow hover:shadow-md ${accent} ${ring} ${
				landscape
					? "items-center gap-2.5 px-2.5"
					: "flex-col items-center px-1.5 pt-2.5 pb-2"
			}`}
			style={{ width, height }}
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
					title={t("deceased", { sex: person.sex })}
					className="pointer-events-none absolute top-0 left-0 h-5 w-5 overflow-hidden rounded-tl-[9px]"
				>
					<span
						className="block h-full w-full bg-ribbon"
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
					title={
						isAdding ? t("close") : t("addRelative", { name: nameOf(person) })
					}
					className={`nodrag absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-opacity ${
						isAdding
							? "border-invert bg-invert text-on-invert opacity-100"
							: "border-line-strong bg-panel text-ink-muted hover:border-ink-faint hover:text-ink"
					} ${isSelected || isAdding ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
				>
					{isAdding ? (
						<X size={12} strokeWidth={2.5} />
					) : (
						<Plus size={13} strokeWidth={2.5} />
					)}
				</button>
			) : null}

			<Avatar person={person} size={landscape ? 46 : 52} />

			<div
				className={
					landscape ? "min-w-0 flex-1 text-left" : "mt-1.5 w-full text-center"
				}
			>
				<div className="line-clamp-2 font-semibold text-[11px] text-ink leading-tight">
					{nameOf(person)}
				</div>
				<div className="mt-1 space-y-px text-[10px] text-ink-muted leading-tight">
					{born ? (
						<div className="truncate">
							<span className="text-ink-faint">✳</span> {born}
						</div>
					) : null}
					{died ? (
						<div className="truncate">
							<span className="text-ink-faint">†</span> {died}
						</div>
					) : null}
					{!born && !died && person.deceased ? (
						<div>{t("deceased", { sex: person.sex })}</div>
					) : null}
				</div>
			</div>
		</div>
	)
}
