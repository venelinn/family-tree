import { Baby, Heart, UserRoundPlus, UsersRound } from "lucide-react"

/**
 * The icon for a kind of relative.
 *
 * One mapping, used by both places that offer to add one — the ghost cards on
 * the chart and the link form in the panel — so "child" is the same glyph
 * wherever it is offered. Four `UserPlus`es told you only that something would
 * be added, not what.
 *
 * The glyphs are chosen to read without their label: a heart is a partner, a
 * baby is a child, a pair is a sibling, and a person with a plus is the generic
 * "somebody above you" that a parent is.
 */

export type RelationKind = "parent" | "spouse" | "child" | "sibling"

const ICONS = {
	parent: UserRoundPlus,
	spouse: Heart,
	child: Baby,
	sibling: UsersRound,
} as const satisfies Record<RelationKind, unknown>

export function RelationIcon({
	relation,
	size = 20,
	strokeWidth = 1.75,
}: {
	relation: RelationKind
	size?: number
	strokeWidth?: number
}) {
	const Icon = ICONS[relation]
	return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />
}
