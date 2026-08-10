import { existsSync } from "node:fs"
import {
	copyFile,
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	unlink,
	writeFile,
} from "node:fs/promises"
import path from "node:path"
import { DIR_MODE, FILE_MODE, locate, type TreeLocation } from "./bundle"
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
 * File-backed `TreeStore` for local, single-user editing.
 *
 * No `server-only` guard here on purpose: the import script drives this store
 * from the CLI, and `lib/data.ts` already marks the app-facing surface.
 *
 * Deliberately not clever: the whole tree is a few hundred rows, so each
 * mutation reads, edits and rewrites the file. What it does take seriously is
 * not corrupting that file — writes go to a temp path and are renamed into
 * place, and concurrent calls are serialised through a promise chain, because
 * Next.js will happily run two route handlers at once.
 *
 * The tree may live anywhere on disk, which is why the path is a constructor
 * argument rather than a constant: see `lib/store/registry.ts`, which is what
 * decides where, and `bundle.ts` for what that path points at. Files are
 * written owner-only — this is a household's names, birth dates and addresses,
 * and on a shared machine the default umask would otherwise leave them
 * world-readable.
 *
 * The Supabase implementation will replace this file and nothing else.
 */

const now = () => new Date().toISOString()

/**
 * How many timestamped copies of `tree.json` to keep in a bundle's `backups/`.
 *
 * These protect against the user, not against the disk — a branch of the family
 * deleted by mistake, an import run against the wrong tree. The whole file is a
 * few tens of kilobytes and every mutation already rewrites it, so keeping the
 * last twenty costs almost nothing and covers the failure that actually happens.
 * Disk loss is what the archive export is for.
 */
const KEEP_BACKUPS = 20

/** At most one snapshot per quarter hour, so twenty of them span a day's work. */
const BACKUP_INTERVAL_MS = 15 * 60 * 1000

/** Short, readable, and unique enough for a personal tree. */
export const newId = (prefix: string) =>
	`${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`

export class LocalTreeStore implements TreeStore {
	/** Bundle directory or loose `.json` — what the registry stores. */
	readonly root: string
	/** Everywhere this tree keeps something. */
	readonly location: TreeLocation
	private readonly id: string
	/** Serialises mutations so two writes can't interleave. */
	private queue: Promise<unknown> = Promise.resolve()

	constructor(root: string, id?: string) {
		this.root = root
		this.location = locate(root)
		this.id = id ?? path.basename(root, path.extname(root))
	}

	/** The JSON this store reads and writes. */
	get file(): string {
		return this.location.file
	}

	async read(): Promise<TreeSnapshot> {
		if (!existsSync(this.file)) return this.empty()

		const parsed = JSON.parse(
			await readFile(this.file, "utf8"),
		) as Partial<TreeSnapshot>

		return {
			// A file written before trees had metadata still loads: the id comes
			// from its filename and the name from the registry's migration. This
			// is also what lets someone hand-write or hand-edit a tree file.
			meta: { ...this.empty().meta, ...parsed.meta, id: this.id },
			people: parsed.people ?? [],
			unions: parsed.unions ?? [],
			unionChildren: parsed.unionChildren ?? [],
		}
	}

	private empty(): TreeSnapshot {
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
	private mutate<T>(
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

	private async write(snapshot: TreeSnapshot): Promise<void> {
		await mkdir(path.dirname(this.file), { recursive: true, mode: DIR_MODE })
		await this.snapshotPrevious()
		const temp = `${this.file}.tmp`
		await writeFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`, {
			mode: FILE_MODE,
		})
		// Rename is atomic on the same filesystem, so a crash mid-write leaves
		// the previous good file rather than a truncated one.
		await rename(temp, this.file)
	}

	/**
	 * Keep a copy of what's on disk before replacing it, at most every
	 * `BACKUP_INTERVAL_MS`.
	 *
	 * The interval is the point. Typing a birth date is half a dozen mutations
	 * in a few seconds, and without it those would fill all twenty slots and
	 * push out the copy from before the mistake — leaving twenty ways to undo
	 * the last minute and none to undo the last hour. Rate-limited, the same
	 * twenty span a day's editing.
	 *
	 * Best-effort throughout: a full disk or a read-only backups directory is a
	 * reason to lose the safety net, not a reason to refuse the edit. Only
	 * bundles have anywhere to put these — a loose `.json` has no directory of
	 * its own and this app does not get to scatter files next to somebody's.
	 */
	private async snapshotPrevious(): Promise<void> {
		const { backupDir } = this.location
		if (!backupDir || !existsSync(this.file)) return

		try {
			await mkdir(backupDir, { recursive: true, mode: DIR_MODE })
			const existing = (await readdir(backupDir))
				.filter((name) => name.endsWith(".json"))
				.sort()

			const newest = existing.at(-1)
			if (newest) {
				const age =
					Date.now() - (await stat(path.join(backupDir, newest))).mtimeMs
				if (age < BACKUP_INTERVAL_MS) return
			}

			const stamp = now().replace(/[:.]/g, "-")
			await copyFile(this.file, path.join(backupDir, `${stamp}.json`))

			// One was just added, so trim against the list including it.
			const surplus = existing.length + 1 - KEEP_BACKUPS
			await Promise.all(
				existing
					.slice(0, Math.max(0, surplus))
					.map((name) => unlink(path.join(backupDir, name))),
			)
		} catch {
			// Deliberately silent: the edit itself is what matters.
		}
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
