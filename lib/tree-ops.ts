import { TreeOpError } from "./errors"
import type {
	PersonInput,
	PersonRecord,
	TreeSnapshot,
	TreeStore,
} from "./store/types"

/**
 * Relationship operations on top of `TreeStore`.
 *
 * The store is deliberately dumb — it writes rows. Everything that has to stay
 * true across several rows lives here, so the UI never has to know that adding a
 * father means "find their birth union, or create one, then fill the husband
 * seat, then link the child".
 *
 * Invariants maintained:
 *  - a person is born into at most one union
 *  - a union has at most one husband and one wife
 *  - a person is never listed twice as a child of the same union
 *  - a person is never their own parent, child or spouse
 */

export type Relation = "parent" | "spouse" | "child" | "sibling"

/** The union a person was born into, if any. */
function birthUnionOf(
	snapshot: TreeSnapshot,
	personId: string,
): string | undefined {
	return snapshot.unionChildren.find((link) => link.childId === personId)
		?.unionId
}

/** Unions where this person is a spouse. */
function spouseUnionsOf(snapshot: TreeSnapshot, personId: string) {
	return snapshot.unions.filter(
		(union) => union.husbandId === personId || union.wifeId === personId,
	)
}

const seatFor = (sex: "M" | "F") => (sex === "M" ? "husbandId" : "wifeId")

/**
 * Add a new person as a `relation` of `anchorId`.
 *
 * `unionId` disambiguates when it matters — which marriage a child belongs to
 * for someone married more than once. Without it the earliest union wins, which
 * is the common case and matches how the cards are ordered.
 */
export async function addRelative(
	store: TreeStore,
	anchorId: string,
	relation: Relation,
	input: PersonInput,
	unionId?: string,
): Promise<PersonRecord> {
	const snapshot = await store.read()
	const anchor = snapshot.people.find((person) => person.id === anchorId)
	if (!anchor) throw new TreeOpError("noSuchPerson", { id: anchorId })

	if (relation === "parent") {
		const seat = seatFor(input.sex)
		const existingId = birthUnionOf(snapshot, anchorId)

		if (existingId) {
			const union = snapshot.unions.find((u) => u.id === existingId)
			if (union?.[seat]) {
				throw new TreeOpError(
					input.sex === "M" ? "alreadyHasFather" : "alreadyHasMother",
					{ name: anchor.fullName },
				)
			}
			const person = await store.createPerson(input)
			await store.updateUnion(existingId, { [seat]: person.id })
			return person
		}

		// No birth family on record yet — create one and put them in it.
		const person = await store.createPerson(input)
		const union = await store.createUnion({
			[seat]: person.id,
			divorced: false,
		})
		await store.addChild(union.id, anchorId)
		return person
	}

	if (relation === "sibling") {
		// A sibling is another child of the same birth family. If the anchor has
		// no parents on record we invent the family rather than refuse — that is
		// what makes "add brother" work on someone at the top of the tree.
		const person = await store.createPerson(input)
		const existingId = birthUnionOf(snapshot, anchorId)
		if (existingId) {
			await store.addChild(existingId, person.id)
			return person
		}
		const union = await store.createUnion({ divorced: false })
		await store.addChild(union.id, anchorId)
		await store.addChild(union.id, person.id)
		return person
	}

	if (relation === "spouse") {
		const person = await store.createPerson(input)
		await store.createUnion({
			[seatFor(anchor.sex)]: anchor.id,
			[seatFor(person.sex)]: person.id,
			divorced: false,
		})
		return person
	}

	// A child needs a union to hang off. Reuse the anchor's marriage where there
	// is one; otherwise create a single-parent union so the child still has a
	// place in the tree.
	const unions = spouseUnionsOf(snapshot, anchorId)
	const target = unionId
		? (unions.find((union) => union.id === unionId) ?? unions[0])
		: unions[0]

	const person = await store.createPerson(input)
	const targetId =
		target?.id ??
		(
			await store.createUnion({
				[seatFor(anchor.sex)]: anchor.id,
				divorced: false,
			})
		).id
	await store.addChild(targetId, person.id)
	return person
}

/**
 * Attach an existing person as a relative — for linking two people already in
 * the tree rather than creating someone new.
 */
export async function linkRelative(
	store: TreeStore,
	anchorId: string,
	relation: Relation,
	otherId: string,
): Promise<void> {
	if (anchorId === otherId) {
		throw new TreeOpError("ownRelative")
	}

	const snapshot = await store.read()
	const anchor = snapshot.people.find((person) => person.id === anchorId)
	const other = snapshot.people.find((person) => person.id === otherId)
	if (!anchor || !other) throw new TreeOpError("bothMustExist")

	if (relation === "parent") {
		const existingId = birthUnionOf(snapshot, anchorId)

		// Sharing a birth family would make them siblings, not parent and child.
		// Both being *absent* is not sharing one: `undefined === undefined` was
		// how this refused the commonest case of all — attaching a parent to
		// someone who hasn't got any yet.
		if (
			existingId !== undefined &&
			existingId === birthUnionOf(snapshot, otherId)
		) {
			throw new TreeOpError("alreadySibling", {
				other: other.fullName,
				name: anchor.fullName,
			})
		}
		const seat = seatFor(other.sex)
		if (existingId) {
			const union = snapshot.unions.find((u) => u.id === existingId)
			if (union?.[seat] && union[seat] !== otherId) {
				throw new TreeOpError("alreadyHasParent", { name: anchor.fullName })
			}
			await store.updateUnion(existingId, { [seat]: otherId })
			return
		}
		const union = await store.createUnion({ [seat]: otherId, divorced: false })
		await store.addChild(union.id, anchorId)
		return
	}

	if (relation === "sibling") {
		const anchorUnion = birthUnionOf(snapshot, anchorId)
		if (birthUnionOf(snapshot, otherId)) {
			throw new TreeOpError("alreadyHasParents", { other: other.fullName })
		}
		const targetId =
			anchorUnion ?? (await store.createUnion({ divorced: false })).id
		if (!anchorUnion) await store.addChild(targetId, anchorId)
		await store.addChild(targetId, otherId)
		return
	}

	if (relation === "spouse") {
		const already = spouseUnionsOf(snapshot, anchorId).some(
			(union) => union.husbandId === otherId || union.wifeId === otherId,
		)
		if (already) throw new TreeOpError("alreadyMarried")
		await store.createUnion({
			[seatFor(anchor.sex)]: anchor.id,
			[seatFor(other.sex)]: other.id,
			divorced: false,
		})
		return
	}

	if (birthUnionOf(snapshot, otherId)) {
		throw new TreeOpError("alreadyHasParents", { other: other.fullName })
	}
	const unions = spouseUnionsOf(snapshot, anchorId)
	const targetId =
		unions[0]?.id ??
		(
			await store.createUnion({
				[seatFor(anchor.sex)]: anchor.id,
				divorced: false,
			})
		).id
	await store.addChild(targetId, otherId)
}

/**
 * Drop the union an unlink just emptied out.
 *
 * A union needs to say *something*: a couple, or at least one child. One spouse
 * and nobody else is the residue of the marriage you just broke, and leaving it
 * behind would put a stray marker on the chart.
 *
 * Scoped to the union that was actually touched, deliberately. A sweep over the
 * whole tree under this rule would also delete rows nobody asked about — the
 * import left two single-wife childless unions in the real store — and silently
 * discarding somebody's data as a side effect of an unrelated edit is not
 * something an app with no undo gets to do.
 */
async function pruneUnionIfMeaningless(
	store: TreeStore,
	unionId: string,
): Promise<void> {
	const snapshot = await store.read()
	const union = snapshot.unions.find((candidate) => candidate.id === unionId)
	if (!union) return

	const hasChildren = snapshot.unionChildren.some(
		(link) => link.unionId === unionId,
	)
	const isCouple = Boolean(union.husbandId && union.wifeId)
	if (!hasChildren && !isCouple) await store.deleteUnion(unionId)
}

/**
 * Drop unions left completely empty by a deletion.
 *
 * Deliberately the weaker rule: deleting a person can touch several unions at
 * once, and only one with *nobody* in it is unambiguously debris.
 */
async function pruneEmptyUnions(store: TreeStore): Promise<void> {
	const snapshot = await store.read()
	for (const union of snapshot.unions) {
		const hasSpouse = Boolean(union.husbandId || union.wifeId)
		const hasChildren = snapshot.unionChildren.some(
			(link) => link.unionId === union.id,
		)
		if (!hasSpouse && !hasChildren) await store.deleteUnion(union.id)
	}
}

/**
 * Break a relationship without deleting anybody.
 *
 * The counterpart to `linkRelative`, and the thing whose absence made every
 * mistake permanent: attach the wrong father and the only remedy used to be
 * deleting him, which took his dates, his photo and his own parents with him.
 *
 * Both people stay in the tree. Only the row that joined them goes.
 */
export async function unlinkRelative(
	store: TreeStore,
	anchorId: string,
	relation: Relation,
	otherId: string,
): Promise<void> {
	if (anchorId === otherId) throw new TreeOpError("ownRelative")

	const snapshot = await store.read()
	const anchor = snapshot.people.find((person) => person.id === anchorId)
	const other = snapshot.people.find((person) => person.id === otherId)
	if (!anchor || !other) throw new TreeOpError("bothMustExist")

	if (relation === "parent" || relation === "sibling") {
		const unionId = birthUnionOf(snapshot, anchorId)
		if (!unionId) throw new TreeOpError("notRelated")

		if (relation === "parent") {
			// Vacate the seat rather than delete the family: the other parent and
			// the anchor's siblings are still real and still belong together.
			const union = snapshot.unions.find(
				(candidate) => candidate.id === unionId,
			)
			if (union?.husbandId !== otherId && union?.wifeId !== otherId)
				throw new TreeOpError("notRelated")
			await store.updateUnion(unionId, {
				[seatFor(other.sex)]: undefined,
			})
		} else {
			// A sibling link *is* sharing a birth family, so breaking it means the
			// other one leaves that family.
			if (birthUnionOf(snapshot, otherId) !== unionId)
				throw new TreeOpError("notRelated")
			await store.removeChild(unionId, otherId)
		}

		await pruneUnionIfMeaningless(store, unionId)
		return
	}

	if (relation === "spouse") {
		const union = spouseUnionsOf(snapshot, anchorId).find(
			(candidate) =>
				candidate.husbandId === otherId || candidate.wifeId === otherId,
		)
		if (!union) throw new TreeOpError("notRelated")

		// The marriage's children keep the parent who stays; the one leaving is
		// simply no longer in that union.
		await store.updateUnion(union.id, { [seatFor(other.sex)]: undefined })
		await pruneUnionIfMeaningless(store, union.id)
		return
	}

	const unionId = birthUnionOf(snapshot, otherId)
	const isChildOfAnchor =
		unionId !== undefined &&
		spouseUnionsOf(snapshot, anchorId).some(
			(candidate) => candidate.id === unionId,
		)
	if (!unionId || !isChildOfAnchor) throw new TreeOpError("notRelated")

	await store.removeChild(unionId, otherId)
	await pruneUnionIfMeaningless(store, unionId)
}

/**
 * Remove a person and tidy up after them.
 *
 * The store already vacates their seats and drops their child links. What it
 * can't decide is whether the unions they leave behind still mean anything.
 */
export async function removePerson(
	store: TreeStore,
	personId: string,
): Promise<void> {
	await store.deletePerson(personId)
	await pruneEmptyUnions(store)
}
