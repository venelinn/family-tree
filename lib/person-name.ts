import type { Person } from "./family-graph"

/**
 * Which spelling of a person's name to show.
 *
 * "Venelin Nikolov" and "Венелин Николов" are one man, not two records — the
 * second lives in `names`, keyed by the language it belongs to. A reader in
 * Bulgarian gets the Cyrillic one where somebody bothered to enter it, and the
 * name on the record everywhere else. Falling back rather than blanking is the
 * whole point: filling these in is optional and always will be, so a tree half
 * translated has to read as a tree, not as a list of holes.
 *
 * `follow` is the user's setting — see `name-language.ts`. Off, the record's own
 * name is used whatever the interface language.
 */

/** Everything this module needs; a whole `Person` is more than it should ask for. */
type Named = Pick<Person, "name" | "names">

export function displayName(
	person: Named,
	locale: string,
	follow: boolean,
): string {
	if (!follow) return person.name
	return person.names?.[locale]?.trim() || person.name
}

/** Every spelling on file, so search matches whichever one you typed. */
export function nameVariants(person: Named): string[] {
	return [person.name, ...Object.values(person.names ?? {})]
}
