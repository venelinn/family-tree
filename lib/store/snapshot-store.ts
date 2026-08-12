import type {
	PersonInput,
	PersonRecord,
	TreeMeta,
	TreeRows,
	TreeSnapshot,
	TreeStore,
	UnionInput,
	UnionRecord,
} from "./types"

/**
 * Every `TreeStore` operation, for any backend that can load and save the whole
 * tree at once.
 *
 * This is all of `LocalTreeStore` except the two lines that touched a file, and
 * it was extracted because the IndexedDB store is the same code with a different
 * `read`/`write`. Subclasses supply those two and inherit the rest.
 *
 * **Read-modify-write of the whole snapshot, deliberately.** A personal tree is
 * a few hundred rows; each mutation loads it, edits it and saves it back, which
 * is simple enough to be obviously correct and fast enough to be irrelevant.
 * Concurrent calls are serialised through a promise chain — without it, two
 * edits that overlap would each write a snapshot taken before the other, and the
 * second would silently discard the first. (Tested at the time: 10 concurrent
 * `createPerson` calls, all 10 persisted.)
 *
 * **A Supabase store must NOT extend this.** The whole-snapshot approach is
 * correct for one writer and wrong for several: two people editing one tree
 * would overwrite each other wholesale rather than row by row. `types.ts` says
 * as much where `TreeStore` is defined — each method there maps to a single
 * statement, and that is the shape a networked backend has to implement
 * directly.
 */

export const now = () => new Date().toISOString()

/** Short, readable, and unique enough for a personal tree. */
export const newId = (prefix: string) =>
	`${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`

export abstract class SnapshotTreeStore implements TreeStore {
	protected readonly id: string
	/** Serialises mutations so two writes can't interleave. */
	private queue: Promise<unknown> = Promise.resolve()

	protected constructor(id: string) {
		this.id = id
	}

	/**
	 * Where this store keeps photo files, if it keeps them as files at all.
	 *
	 * Undefined for a browser-stored tree, and for a loose `.json` that predates
	 * bundles. Only `registry.local` and the import script still ask — everything
	 * else goes through the photo methods below, which do not care whether the
	 * answer is a directory, a database or neither.
	 */
	get photoDir(): string | undefined {
		return undefined
	}

	/* ------------------------------------------------------------ photos ---- */

	/**
	 * Photos, as an operation rather than a location.
	 *
	 * `photos.ts` used to build paths itself from `photoDir`, which quietly meant
	 * "photos are files" — true for a bundle, false for IndexedDB, and false
	 * again for anything networked later. These four methods are the whole
	 * surface it needs, and each store answers them however it stores things.
	 *
	 * The default is "cannot keep photos", which is the honest answer for a loose
	 * `.json` tree and keeps the existing `treeNotABundle` refusal working
	 * unchanged.
	 */
	get canStorePhotos(): boolean {
		return false
	}

	async hasPhoto(_entry: string): Promise<boolean> {
		return false
	}

	async putPhoto(_entry: string, _bytes: Uint8Array): Promise<void> {
		throw new Error("This store cannot keep photos")
	}

	async deletePhoto(_entry: string): Promise<void> {
		// Nothing stored, nothing to remove.
	}

	/**
	 * A displayable `src` for a stored photo, or undefined if it isn't there.
	 *
	 * Async because a browser has to fetch the blob before it can hand out a URL
	 * for it — which is why `toFamilyGraph` is async too.
	 */
	async photoSrc(_entry: string): Promise<string | undefined> {
		return undefined
	}

	/** Load the whole tree. Must return `empty()` when there is nothing stored. */
	abstract read(): Promise<TreeSnapshot>

	/** Save the whole tree. Must be atomic enough to survive a crash mid-write. */
	protected abstract write(snapshot: TreeSnapshot): Promise<void>

	protected empty(): TreeSnapshot {
		const timestamp = now()
		return {
			meta: {
				id: this.id,
				name: this.id,
				createdAt: timestamp,
				updatedAt: timestamp,
			},
			people: [],
			unions: [],
			unionChildren: [],
		}
	}

	/** Read, mutate, write — with the whole sequence serialised. */
	protected mutate<T>(
		fn: (snapshot: TreeSnapshot) => T | Promise<T>,
	): Promise<T> {
		const run = this.queue.then(async () => {
			const snapshot = await this.read()
			const result = await fn(snapshot)
			snapshot.meta.updatedAt = now()
			await this.write(snapshot)
			return result
		})
		// Keep the chain alive even if this call rejects.
		this.queue = run.catch(() => undefined)
		return run
	}

	createPerson(input: PersonInput): Promise<PersonRecord> {
		return this.mutate((snapshot) => {
			const record: PersonRecord = {
				...input,
				id: input.id ?? newId("p"),
				photos: input.photos ?? [],
				updatedAt: now(),
			}
			snapshot.people.push(record)
			return record
		})
	}

	updatePerson(
		id: string,
		patch: Partial<Omit<PersonRecord, "id" | "updatedAt">>,
	): Promise<PersonRecord> {
		return this.mutate((snapshot) => {
			const record = snapshot.people.find((person) => person.id === id)
			if (!record) throw new Error(`No such person: ${id}`)
			Object.assign(record, patch, { updatedAt: now() })
			return record
		})
	}

	deletePerson(id: string): Promise<void> {
		return this.mutate((snapshot) => {
			snapshot.people = snapshot.people.filter((person) => person.id !== id)
			snapshot.unionChildren = snapshot.unionChildren.filter(
				(link) => link.childId !== id,
			)
			// Leave the union in place but vacate the seat — the other spouse and
			// the children are still real.
			for (const union of snapshot.unions) {
				if (union.husbandId === id) union.husbandId = undefined
				if (union.wifeId === id) union.wifeId = undefined
			}
			// Deleting the person the chart opens on would leave the tree with no
			// way in; the next reader picks a new root.
			if (snapshot.meta.rootPersonId === id) {
				snapshot.meta.rootPersonId = snapshot.people[0]?.id
			}
		})
	}

	createUnion(input: UnionInput): Promise<UnionRecord> {
		return this.mutate((snapshot) => {
			const record: UnionRecord = {
				...input,
				id: input.id ?? newId("u"),
				updatedAt: now(),
			}
			snapshot.unions.push(record)
			return record
		})
	}

	updateUnion(
		id: string,
		patch: Partial<Omit<UnionRecord, "id" | "updatedAt">>,
	): Promise<UnionRecord> {
		return this.mutate((snapshot) => {
			const record = snapshot.unions.find((union) => union.id === id)
			if (!record) throw new Error(`No such union: ${id}`)
			Object.assign(record, patch, { updatedAt: now() })
			return record
		})
	}

	deleteUnion(id: string): Promise<void> {
		return this.mutate((snapshot) => {
			snapshot.unions = snapshot.unions.filter((union) => union.id !== id)
			snapshot.unionChildren = snapshot.unionChildren.filter(
				(link) => link.unionId !== id,
			)
		})
	}

	addChild(unionId: string, childId: string, position?: number): Promise<void> {
		return this.mutate((snapshot) => {
			const exists = snapshot.unionChildren.some(
				(link) => link.unionId === unionId && link.childId === childId,
			)
			if (exists) return
			const siblings = snapshot.unionChildren.filter(
				(link) => link.unionId === unionId,
			)
			snapshot.unionChildren.push({
				unionId,
				childId,
				position: position ?? siblings.length,
			})
		})
	}

	removeChild(unionId: string, childId: string): Promise<void> {
		return this.mutate((snapshot) => {
			snapshot.unionChildren = snapshot.unionChildren.filter(
				(link) => !(link.unionId === unionId && link.childId === childId),
			)
		})
	}

	updateMeta(
		patch: Partial<Omit<TreeMeta, "id" | "createdAt" | "updatedAt">>,
	): Promise<TreeMeta> {
		return this.mutate((snapshot) => {
			Object.assign(snapshot.meta, patch)
			return snapshot.meta
		})
	}

	replaceAll(rows: TreeRows): Promise<void> {
		return this.mutate((snapshot) => {
			snapshot.people = rows.people
			snapshot.unions = rows.unions
			snapshot.unionChildren = rows.unionChildren
			// The root person may not have survived the replacement.
			const stillThere = rows.people.some(
				(person) => person.id === snapshot.meta.rootPersonId,
			)
			if (!stillThere) snapshot.meta.rootPersonId = undefined
		})
	}
}
