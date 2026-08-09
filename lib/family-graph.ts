/**
 * The normalized model every view renders from.
 *
 * A `Union` is the couple-as-a-node idea: spouses attach to the union, children
 * hang off it. Making the couple a first-class object is what keeps spouses
 * adjacent during layout instead of hoping a generic graph layouter preserves it.
 */

export type Sex = "M" | "F"

export interface Person {
	id: string
	name: string
	givenName?: string
	surname?: string
	sex: Sex
	birthDate?: string
	birthYear?: number
	birthPlace?: string
	deathDate?: string
	deathYear?: number
	deathPlace?: string
	/** True when the record carries a death event but no usable date. */
	deceased: boolean
	photoUrl?: string
	photos: string[]
	/** Unions in which this person is a spouse. */
	unionIds: string[]
	/** The union this person was born into, if known. */
	childOfUnionId?: string
}

export interface Union {
	id: string
	husbandId?: string
	wifeId?: string
	childIds: string[]
	marriageDate?: string
	marriageYear?: number
	marriagePlace?: string
	divorced: boolean
}

export interface FamilyGraph {
	people: Map<string, Person>
	unions: Map<string, Union>
}

/**
 * Rebuild the Maps that `serializeFamilyGraph` flattened for the network hop.
 * Lives here rather than in `lib/data.ts` because that module is server-only.
 */
export function reviveFamilyGraph(serialized: {
	people: Person[]
	unions: Union[]
}): FamilyGraph {
	return {
		people: new Map(serialized.people.map((p) => [p.id, p])),
		unions: new Map(serialized.unions.map((u) => [u.id, u])),
	}
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

export function getParents(graph: FamilyGraph, personId: string): Person[] {
	const person = graph.people.get(personId)
	if (!person?.childOfUnionId) return []
	const union = graph.unions.get(person.childOfUnionId)
	if (!union) return []
	return [union.husbandId, union.wifeId]
		.map((id) => (id ? graph.people.get(id) : undefined))
		.filter((p): p is Person => Boolean(p))
}

export function getFather(
	graph: FamilyGraph,
	personId: string,
): Person | undefined {
	return getParents(graph, personId).find((p) => p.sex === "M")
}

export function getMother(
	graph: FamilyGraph,
	personId: string,
): Person | undefined {
	return getParents(graph, personId).find((p) => p.sex === "F")
}

export function getSpouses(graph: FamilyGraph, personId: string): Person[] {
	const person = graph.people.get(personId)
	if (!person) return []
	const out: Person[] = []
	for (const unionId of person.unionIds) {
		const union = graph.unions.get(unionId)
		if (!union) continue
		const spouseId =
			union.husbandId === personId ? union.wifeId : union.husbandId
		const spouse = spouseId ? graph.people.get(spouseId) : undefined
		if (spouse) out.push(spouse)
	}
	return out
}

export function getChildren(graph: FamilyGraph, personId: string): Person[] {
	const person = graph.people.get(personId)
	if (!person) return []
	const out: Person[] = []
	for (const unionId of person.unionIds) {
		const union = graph.unions.get(unionId)
		if (!union) continue
		for (const childId of union.childIds) {
			const child = graph.people.get(childId)
			if (child) out.push(child)
		}
	}
	return out
}

/** Full siblings — everyone else born into the same union. */
export function getSiblings(graph: FamilyGraph, personId: string): Person[] {
	const person = graph.people.get(personId)
	if (!person?.childOfUnionId) return []
	const union = graph.unions.get(person.childOfUnionId)
	if (!union) return []
	return union.childIds
		.filter((id) => id !== personId)
		.map((id) => graph.people.get(id))
		.filter((p): p is Person => Boolean(p))
}

/** Sort helper: oldest first, people without a birth year last. */
export function byBirthYear(a: Person, b: Person): number {
	if (a.birthYear != null && b.birthYear != null)
		return a.birthYear - b.birthYear
	if (a.birthYear != null) return -1
	if (b.birthYear != null) return 1
	return a.name.localeCompare(b.name)
}
