import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
	PersonInput,
	PersonRecord,
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
 * The Supabase implementation will replace this file and nothing else.
 */

const DEFAULT_PATH = path.join(process.cwd(), "data", "tree.json")

const EMPTY: TreeSnapshot = { people: [], unions: [], unionChildren: [] }

const now = () => new Date().toISOString()

/** Short, readable, and unique enough for a personal tree. */
const newId = (prefix: string) =>
	`${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`

export class LocalTreeStore implements TreeStore {
	private readonly file: string
	/** Serialises mutations so two writes can't interleave. */
	private queue: Promise<unknown> = Promise.resolve()

	constructor(file: string = DEFAULT_PATH) {
		this.file = file
	}

	async read(): Promise<TreeSnapshot> {
		if (!existsSync(this.file)) return structuredClone(EMPTY)
		const parsed = JSON.parse(await readFile(this.file, "utf8")) as TreeSnapshot
		return {
			people: parsed.people ?? [],
			unions: parsed.unions ?? [],
			unionChildren: parsed.unionChildren ?? [],
		}
	}

	/** Read, mutate, write — with the whole sequence serialised. */
	private mutate<T>(
		fn: (snapshot: TreeSnapshot) => T | Promise<T>,
	): Promise<T> {
		const run = this.queue.then(async () => {
			const snapshot = await this.read()
			const result = await fn(snapshot)
			await this.write(snapshot)
			return result
		})
		// Keep the chain alive even if this call rejects.
		this.queue = run.catch(() => undefined)
		return run
	}

	private async write(snapshot: TreeSnapshot): Promise<void> {
		await mkdir(path.dirname(this.file), { recursive: true })
		const temp = `${this.file}.tmp`
		await writeFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`)
		// Rename is atomic on the same filesystem, so a crash mid-write leaves
		// the previous good file rather than a truncated one.
		await rename(temp, this.file)
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

	replaceAll(next: TreeSnapshot): Promise<void> {
		return this.mutate((snapshot) => {
			snapshot.people = next.people
			snapshot.unions = next.unions
			snapshot.unionChildren = next.unionChildren
		})
	}
}
