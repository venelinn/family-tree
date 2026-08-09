import type { FamilyGraph, Person } from "./family-graph"

/**
 * A person's life events, assembled from the graph rather than stored.
 *
 * Nothing here is a new kind of data — a marriage fact *is* the union row, a
 * "birth of daughter" fact *is* the child's birth. Deriving them keeps the one
 * source of truth and means the timeline updates itself when the tree is edited.
 */

export interface Fact {
	id: string
	/** Sort key and the big number in the margin. */
	year?: number
	/** Age of the subject when it happened, when both years are known. */
	age?: number
	title: string
	/** A second person involved — spouse, child — for the avatar and name. */
	relatedId?: string
	date?: string
	place?: string
}

/** Age is only meaningful if we know both ends. */
function ageAt(person: Person, year: number | undefined): number | undefined {
	if (year == null || person.birthYear == null) return undefined
	const age = year - person.birthYear
	return age >= 0 && age < 130 ? age : undefined
}

export function buildFacts(graph: FamilyGraph, person: Person): Fact[] {
	const facts: Fact[] = []

	if (person.birthDate || person.birthPlace) {
		facts.push({
			id: "birth",
			year: person.birthYear,
			title: "Birth",
			date: person.birthDate,
			place: person.birthPlace,
		})
	}

	for (const unionId of person.unionIds) {
		const union = graph.unions.get(unionId)
		if (!union) continue

		const spouseId =
			union.husbandId === person.id ? union.wifeId : union.husbandId

		// Worth listing even with no date — that the marriage happened is a fact.
		if (spouseId) {
			facts.push({
				id: `marriage:${unionId}`,
				year: union.marriageYear,
				age: ageAt(person, union.marriageYear),
				title: union.divorced ? "Marriage to (later divorced)" : "Marriage to",
				relatedId: spouseId,
				date: union.marriageDate,
				place: union.marriagePlace,
			})
		}

		for (const childId of union.childIds) {
			const child = graph.people.get(childId)
			if (!child) continue
			facts.push({
				id: `child:${childId}`,
				year: child.birthYear,
				age: ageAt(person, child.birthYear),
				title: child.sex === "F" ? "Birth of daughter" : "Birth of son",
				relatedId: childId,
				date: child.birthDate,
				place: child.birthPlace,
			})
		}
	}

	if (person.deceased || person.deathDate) {
		facts.push({
			id: "death",
			year: person.deathYear,
			age: ageAt(person, person.deathYear),
			title: "Death",
			date: person.deathDate,
			place: person.deathPlace,
		})
	}

	// Chronological, with undated events last rather than pretending they're
	// ancient history.
	return facts.sort((a, b) => {
		if (a.year != null && b.year != null) return a.year - b.year
		if (a.year != null) return -1
		if (b.year != null) return 1
		return 0
	})
}

export type RelationLabel = string

/** How `other` is related to `person`, for the immediate-family list. */
export function relationLabel(
	graph: FamilyGraph,
	person: Person,
	other: Person,
): RelationLabel {
	const female = other.sex === "F"

	if (
		person.unionIds.some((id) => {
			const union = graph.unions.get(id)
			return union?.husbandId === other.id || union?.wifeId === other.id
		})
	) {
		return female ? "Wife" : "Husband"
	}

	const birthUnion = person.childOfUnionId
		? graph.unions.get(person.childOfUnionId)
		: undefined
	if (birthUnion?.husbandId === other.id || birthUnion?.wifeId === other.id) {
		return female ? "Mother" : "Father"
	}
	if (birthUnion?.childIds.includes(other.id)) {
		return female ? "Sister" : "Brother"
	}

	const isChild = person.unionIds.some((id) =>
		graph.unions.get(id)?.childIds.includes(other.id),
	)
	if (isChild) return female ? "Daughter" : "Son"

	return "Relative"
}
