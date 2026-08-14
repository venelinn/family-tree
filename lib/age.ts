import { differenceInYears, parseISO } from "date-fns"
import type { Person } from "./family-graph"

/**
 * How old someone is — at death if they have died, today if they haven't.
 *
 * Precision follows the record. Two full ISO dates give a real answer; anything
 * partial ("about 1910", "JUN 1991") only yields years, so the difference of
 * years is the honest answer there. Someone recorded as deceased with no date
 * at all gets nothing: we know they died, not when, and today's date would
 * quietly turn that into a lie.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** `parseISO` on a date-only string gives local midnight — see `date-format.ts`. */
const exactDate = (value: string | undefined) =>
	value && ISO_DATE.test(value) ? parseISO(value) : undefined

export function ageOf(
	person: Person,
	today: Date = new Date(),
): number | undefined {
	if (person.birthYear == null) return undefined
	if (person.deceased && person.deathYear == null) return undefined

	const birth = exactDate(person.birthDate)
	const end = person.deathYear == null ? today : exactDate(person.deathDate)

	const age =
		birth && end
			? differenceInYears(end, birth)
			: (person.deathYear ?? today.getFullYear()) - person.birthYear

	// Same sanity bound as `facts.ts`: a negative or absurd age means the two
	// dates disagree, and showing nothing beats showing nonsense.
	return age >= 0 && age < 130 ? age : undefined
}
