"use client"

import { useLocale } from "next-intl"
import { createContext, useCallback, useContext } from "react"
import type { Person } from "@/lib/family-graph"
import { displayName } from "@/lib/person-name"

/**
 * Which spelling of a name the chart shows, for everything under `TreeApp`.
 *
 * A context rather than a prop because names are rendered in a dozen places —
 * cards, which reach the screen through React Flow's node data, plus the
 * toolbar title, the search list, the panel, every form — and threading one
 * boolean through all of that would touch far more code than it saves. The
 * locale comes from `next-intl`, which is a context for the same reason.
 */

const FollowLanguage = createContext(true)

export function PersonNameProvider({
	follow,
	children,
}: {
	follow: boolean
	children: React.ReactNode
}) {
	return (
		<FollowLanguage.Provider value={follow}>{children}</FollowLanguage.Provider>
	)
}

/** `const name = usePersonName()` — then `name(person)` wherever one is shown. */
export function usePersonName() {
	const locale = useLocale()
	const follow = useContext(FollowLanguage)
	return useCallback(
		(person: Pick<Person, "name" | "names">) =>
			displayName(person, locale, follow),
		[locale, follow],
	)
}
