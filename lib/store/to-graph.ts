import type { FamilyGraph, Person, Union } from "../family-graph"
import type { SnapshotTreeStore } from "./snapshot-store"
import type { TreeSnapshot } from "./types"

/**
 * Rows -> `FamilyGraph`, the read model every view renders from.
 *
 * The back-references (`unionIds`, `childOfUnionId`) are derived here rather
 * than stored, so they cannot drift out of step with the union rows that are
 * the actual truth.
 *
 * Photos are turned into displayable `src` values here too, which is why no
 * component has to know that a bundle's photos are files on disk while an
 * unconverted tree's are served paths — by asking the store, which is why this
 * is async. A file store answers with an asset-protocol URL for a path on disk;
 * the browser store answers with an object URL for a blob it holds.
 * `photoEntry` in `bundle.ts` maps a `src` back when one is removed.
 */

/** Pulls a year out of either an ISO date or free text like `Jun 1991`. */
function yearOf(value: string | undefined): number | undefined {
	const match = value ? /\d{4}/.exec(value) : null
	return match ? Number(match[0]) : undefined
}

export async function toFamilyGraph(
	snapshot: TreeSnapshot,
	store: SnapshotTreeStore,
): Promise<FamilyGraph> {
	/**
	 * Resolved once per distinct entry, not once per person.
	 *
	 * The same scan is attached to several siblings by design — that is what
	 * content addressing buys — and each resolution is a filesystem check or an
	 * IndexedDB read. Without this, one photo covering a family of five would be
	 * looked up five times on every re-read, and the graph is re-read after every
	 * edit.
	 */
	const resolved = new Map<string, Promise<string | undefined>>()
	const srcFor = (entry: string) => {
		const existing = resolved.get(entry)
		if (existing) return existing
		// A served `/photos/…` path from `pnpm photos`, or a remote URL in a tree
		// that was never localised: already a working `src`, passed through.
		const pending = entry.includes("/")
			? Promise.resolve<string | undefined>(entry)
			: store.photoSrc(entry)
		resolved.set(entry, pending)
		return pending
	}

	const people = new Map<string, Person>()
	for (const record of snapshot.people) {
		// Entries the store cannot resolve are dropped rather than rendered as
		// broken images — a tree imported into the browser carries photo names but
		// no bytes, which makes that the ordinary case rather than an error.
		const photos = (
			await Promise.all(record.photos.map((entry) => srcFor(entry)))
		).filter((src): src is string => Boolean(src))
		people.set(record.id, {
			id: record.id,
			name: record.fullName,
			givenName: record.givenName,
			surname: record.surname,
			marriedName: record.marriedName,
			names: record.names,
			sex: record.sex,
			birthDate: record.birthDate,
			birthYear: yearOf(record.birthDate),
			birthPlace: record.birthPlace,
			deathDate: record.deathDate,
			deathYear: yearOf(record.deathDate),
			deathPlace: record.deathPlace,
			deceased: record.deceased,
			note: record.note,
			photoUrl: photos[0],
			photos,
			unionIds: [],
			childOfUnionId: undefined,
		})
	}

	const unions = new Map<string, Union>()
	for (const record of snapshot.unions) {
		// Drop dangling spouse references so layout code can assume ids resolve.
		const husbandId =
			record.husbandId && people.has(record.husbandId)
				? record.husbandId
				: undefined
		const wifeId =
			record.wifeId && people.has(record.wifeId) ? record.wifeId : undefined

		unions.set(record.id, {
			id: record.id,
			husbandId,
			wifeId,
			childIds: [],
			marriageDate: record.marriageDate,
			marriageYear: yearOf(record.marriageDate),
			marriagePlace: record.marriagePlace,
			divorced: record.divorced,
		})
	}

	for (const link of [...snapshot.unionChildren].sort(
		(a, b) => a.position - b.position,
	)) {
		const union = unions.get(link.unionId)
		if (!union || !people.has(link.childId)) continue
		if (!union.childIds.includes(link.childId))
			union.childIds.push(link.childId)
	}

	for (const union of unions.values()) {
		for (const spouseId of [union.husbandId, union.wifeId]) {
			const spouse = spouseId ? people.get(spouseId) : undefined
			if (spouse && !spouse.unionIds.includes(union.id)) {
				spouse.unionIds.push(union.id)
			}
		}
		for (const childId of union.childIds) {
			const person = people.get(childId)
			// First union wins: a person is born into exactly one family.
			if (person && !person.childOfUnionId) person.childOfUnionId = union.id
		}
	}

	// A union with nobody in it carries no information.
	for (const [id, union] of unions) {
		if (!union.husbandId && !union.wifeId && union.childIds.length === 0) {
			unions.delete(id)
		}
	}

	// Order marriages chronologically so remarriages render left to right in a
	// stable, meaningful order.
	for (const person of people.values()) {
		person.unionIds.sort((a, b) => {
			const yearA = unions.get(a)?.marriageYear ?? Number.POSITIVE_INFINITY
			const yearB = unions.get(b)?.marriageYear ?? Number.POSITIVE_INFINITY
			return yearA - yearB
		})
	}

	return { people, unions }
}
