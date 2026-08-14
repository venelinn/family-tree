"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import clsx from "clsx"
import { Minus, Plus, X } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Avatar } from "@/components/Avatar"
import { Button } from "@/components/Button"
import { usePersonName } from "@/components/PersonNames"
import { formatTreeDate } from "@/lib/date-format"
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	PEDIGREE_CARD_HEIGHT,
	PEDIGREE_CARD_WIDTH,
} from "@/lib/layout/constants"
import type { PersonNodeData } from "@/lib/layout/types"
import styles from "./PersonCard.module.scss"

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
			data-mode={mode}
			data-direction={direction}
			// `nodrag` is React Flow's: without it, pressing the bar drags the node.
			className={clsx("nodrag", styles.card__reveal)}
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

	const born = formatTreeDate(person.birthDate, locale)
	const died = formatTreeDate(person.deathDate, locale)

	// Landscape in the pedigree, where a whole generation stacks in one column
	// and height is the scarce dimension; portrait in the family view, where the
	// chart sprawls sideways instead.
	const landscape = variant === "landscape"
	const shape = landscape ? "landscape" : "portrait"

	// The layout maths owns the card's size, so it arrives as numbers and is
	// handed to CSS as variables rather than as inline width/height.
	const sizing = {
		"--_card-width": `${landscape ? PEDIGREE_CARD_WIDTH : CARD_WIDTH}px`,
		"--_card-height": `${landscape ? PEDIGREE_CARD_HEIGHT : CARD_HEIGHT}px`,
	} as React.CSSProperties

	return (
		<div
			className={styles.card}
			style={sizing}
			data-sex={person.sex === "F" ? "female" : "male"}
			data-variant={shape}
			data-root={isRoot || undefined}
			data-selected={isSelected || undefined}
		>
			<Handle
				type="target"
				id="top"
				position={Position.Top}
				className={styles.card__handle}
			/>
			<Handle
				type="target"
				id="left"
				position={Position.Left}
				className={styles.card__handle}
			/>
			<Handle
				type="source"
				id="right"
				position={Position.Right}
				className={styles.card__handle}
			/>

			{person.deceased ? (
				<span
					title={t("deceased", { sex: person.sex })}
					className={styles.card__ribbon}
				/>
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

			{onRequestAdd ? (
				<Button
					variant={isAdding ? "primary" : "secondary"}
					className={clsx("nodrag", styles.card__add)}
					// Openly present on the card being acted on; otherwise the stylesheet
					// reveals it on hover or keyboard focus.
					data-visible={isSelected || isAdding || undefined}
					title={
						isAdding ? t("close") : t("addRelative", { name: nameOf(person) })
					}
					aria-label={
						isAdding ? t("close") : t("addRelative", { name: nameOf(person) })
					}
					aria-expanded={isAdding}
					icon={
						isAdding ? (
							<X size={12} strokeWidth={2.5} />
						) : (
							<Plus size={13} strokeWidth={2.5} />
						)
					}
					onClick={(event) => {
						event.stopPropagation()
						onRequestAdd(person.id)
					}}
				/>
			) : null}

			<Avatar person={person} size={landscape ? 46 : 52} />

			<div className={styles.card__body} data-variant={shape}>
				<div className={styles.card__name}>{nameOf(person)}</div>
				<div className={styles.card__facts}>
					{born ? (
						<div className={styles.card__fact}>
							<span className={styles.card__glyph}>✳</span> {born}
						</div>
					) : null}
					{died ? (
						<div className={styles.card__fact}>
							<span className={styles.card__glyph}>†</span> {died}
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
