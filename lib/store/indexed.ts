import { SnapshotTreeStore } from "./snapshot-store"
import type { TreeMeta, TreeSnapshot } from "./types"

/**
 * `TreeStore` kept in the browser's IndexedDB — the web target's storage.
 *
 * The web app deliberately never reads the repo's `data/` folder, and with no
 * server there is nowhere else for it to put anything. So the tree lives in the
 * visitor's own browser, on their own machine, which keeps the promise in
 * `docs/privacy.md` intact: nothing is uploaded, because there is nothing to
 * upload it to.
 *
 * Everything that edits rows is inherited from `SnapshotTreeStore`; only `read`
 * and `write` are here, and both are a single `get`/`put` of the whole snapshot.
 * The same read-modify-write reasoning applies as for the file store — a
 * personal tree is a few hundred rows, and IndexedDB gives that back in
 * milliseconds.
 *
 * **What this store cannot do yet: photos.** They are content-addressed files
 * inside a bundle directory, and a browser origin has no directory. Uploads are
 * therefore refused with the same `treeNotABundle` error that a loose `.json`
 * tree already produces — an existing, translated failure rather than a new
 * broken path. Storing blobs here and handing out `URL.createObjectURL` values
 * is the obvious next step; it needs `photoUrl` to become async, which is why it
 * is not in this change.
 *
 * The durability caveat worth knowing: a browser may evict IndexedDB under
 * storage pressure, and clearing site data deletes it outright. That is why
 * export exists, and why the desktop app — where the tree is a file the user
 * chose and can back up — remains the recommended way to keep a real family
 * tree.
 */

const DB_NAME = "family-tree"
const DB_VERSION = 1
/** One record per tree, the whole `TreeSnapshot`, keyed by its id. */
const TREES = "trees"

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			reject(new Error("IndexedDB is unavailable in this environment"))
			return
		}
		const request = indexedDB.open(DB_NAME, DB_VERSION)
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(TREES)) {
				db.createObjectStore(TREES, { keyPath: "meta.id" })
			}
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
		// Another tab holding an older version open. Surfacing it beats hanging
		// forever on a promise that will never settle.
		request.onblocked = () =>
			reject(new Error("A tab with an older version of the database is open"))
	})
}

/** One transaction, one operation, wrapped so it reads as a promise. */
async function withStore<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const db = await openDb()
	try {
		return await new Promise<T>((resolve, reject) => {
			const transaction = db.transaction(TREES, mode)
			const request = fn(transaction.objectStore(TREES))
			// Resolve on the *transaction*, not the request: a write is not durable
			// until the transaction commits, and resolving early would let the app
			// report a save that could still fail.
			transaction.oncomplete = () => resolve(request.result)
			transaction.onerror = () => reject(transaction.error)
			transaction.onabort = () => reject(transaction.error)
		})
	} finally {
		db.close()
	}
}

export class IndexedTreeStore extends SnapshotTreeStore {
	/**
	 * Public, unlike `LocalTreeStore`'s.
	 *
	 * There is nothing to resolve first — the id *is* the key — so there is no
	 * reason for an async `open()` factory here. `SnapshotTreeStore`'s constructor
	 * is `protected`, which is what this widens.
	 */
	// biome-ignore lint/complexity/noUselessConstructor: it widens the base's protected constructor to public
	constructor(id: string) {
		super(id)
	}

	async read(): Promise<TreeSnapshot> {
		const stored = await withStore<TreeSnapshot | undefined>(
			"readonly",
			(store) => store.get(this.id),
		)
		if (!stored) return this.empty()

		// Same tolerance as the file store: a record written by an older version,
		// or hand-seeded by an import, still loads with the missing rows empty.
		return {
			meta: { ...this.empty().meta, ...stored.meta, id: this.id },
			people: stored.people ?? [],
			unions: stored.unions ?? [],
			unionChildren: stored.unionChildren ?? [],
		}
	}

	protected async write(snapshot: TreeSnapshot): Promise<void> {
		await withStore("readwrite", (store) => store.put(snapshot))
	}
}

/* ----------------------------------------------------- registry helpers ---- */

/** Every stored tree's metadata, for the registry. */
export async function readAllMeta(): Promise<TreeMeta[]> {
	const all = await withStore<TreeSnapshot[]>("readonly", (store) =>
		store.getAll(),
	)
	return all.map((snapshot) => snapshot.meta)
}

/** People counts, so the list can say how big each tree is without a second read. */
export async function readAllSummaries(): Promise<
	{ meta: TreeMeta; peopleCount: number }[]
> {
	const all = await withStore<TreeSnapshot[]>("readonly", (store) =>
		store.getAll(),
	)
	return all.map((snapshot) => ({
		meta: snapshot.meta,
		peopleCount: snapshot.people?.length ?? 0,
	}))
}

export async function deleteTreeRecord(id: string): Promise<void> {
	await withStore("readwrite", (store) => store.delete(id))
}
