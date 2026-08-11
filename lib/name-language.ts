import { cookies } from "next/headers"

/**
 * Whether people's names follow the interface language.
 *
 * One preference in one cookie, read on the server, exactly like the theme and
 * the locale — see `theme.ts` for why that shape was picked. It belongs beside
 * them rather than in the tree file: which language you read the family in is a
 * property of the reader, not of the family.
 *
 * On by default. Somebody who has entered a Cyrillic name for their grandmother
 * and then switched the app to Bulgarian meant for it to be used.
 */

export const NAME_LANGUAGE_COOKIE = "names-follow-language"

export const defaultNamesFollowLanguage = true

export async function getNamesFollowLanguage(): Promise<boolean> {
	const stored = (await cookies()).get(NAME_LANGUAGE_COOKIE)?.value
	if (stored == null) return defaultNamesFollowLanguage
	return stored === "on"
}
