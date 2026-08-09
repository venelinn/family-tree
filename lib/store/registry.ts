import { existsSync } from "node:fs"
import {
	copyFile,
	mkdir,
	readFile,
	rename,
	unlink,
	writeFile,
} from "node:fs/promises"
import path from "node:path"
import { TreeOpError } from "../errors"
import { DIR_MODE, FILE_MODE, LocalTreeStore, newId } from "./local"
import type { TreeMeta } from "./types"

/**
 * Which trees exist, and where on disk each one is kept.
 *
 * Two ideas here, both of them privacy decisions rather than technical ones.
 *
 * **A tree file may live anywhere.** Not everyone wants a household's names,
 * birth dates and addresses sitting inside a checked-out git repository, or on
 * the same disk as the app. So the registry stores a *path* per tree — an
 * external drive, an encrypted volume, a USB stick — and the app follows it.
 * Nothing is ever uploaded; there is no network call anywhere in this path.
 *
 * **The index is not a second source of truth.** It records only `id` and
 * `file`. A tree's name and root person live in that file's own `meta`, so
 * copying the file to another machine carries everything with it and the index
 * can be rebuilt by pointing at the file again.
 *
 * Paths inside the data directory are stored relative to it, so a repo can be
 * cloned or moved without every tree breaking; paths outside it are absolute.
 */

/** Overridable so the whole data directory can sit outside the repo. */
export const dataDir = () =>
	process.env.FAMILY_TREE_DATA_DIR
		? path.resolve(process.env.FAMILY_TREE_DATA_DIR)
		: path.join(process.cwd(), "data")

const indexFile = () => path.join(dataDir(), "trees.json")

/** Where a new tree goes unless the user picks somewhere else. */
export const defaultTreeDir = () => path.join(dataDir(), "trees")

/**
 * The pre-multi-tree store. It stays exactly where it is rather than being
 * moved into `trees/`: it is the real family data, `pnpm import` targets it,
 * and a migration that relocates someone's only copy is not a migration worth
 * having.
 */
const LEGACY_FILE = () => path.join(dataDir(), "tree.json")
/** The root person that used to be a constant in `lib/data.ts`. */
const LEGACY_ROOT_PERSON_ID = "@I85@"

interface TreeIndexEntry {
	id: string
	/** Relative to the data directory when inside it, absolute otherwise. */
	file: string
}

interface TreeIndex {
	trees: TreeIndexEntry[]
}

/** A tree as the pickers need it: identity, location, and how big it is. */
export interface TreeSummary extends TreeMeta {
	/** Absolute, for display — "where is my data" has to be answerable. */
	file: string
	/** False when the file has been moved or deleted behind the app's back. */
	available: boolean
	peopleCount: number
}

const toStoredPath = (absolute: string) => {
	const relative = path.relative(dataDir(), absolute)
	return relative.startsWith("..") || path.isAbsolute(relative)
		? absolute
		: relative
}

const toAbsolutePath = (stored: string) =>
	path.isAbsolute(stored) ? stored : path.resolve(dataDir(), stored)

async function readIndex(): Promise<TreeIndex> {
	const file = indexFile()
	if (!existsSync(file)) return { trees: [] }
	const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<TreeIndex>
	return { trees: parsed.trees ?? [] }
}

async function writeIndex(index: TreeIndex): Promise<void> {
	const file = indexFile()
	await mkdir(path.dirname(file), { recursive: true, mode: DIR_MODE })
	const temp = `${file}.tmp`
	await writeFile(temp, `${JSON.stringify(index, null, 2)}\n`, {
		mode: FILE_MODE,
	})
	await rename(temp, file)
}

/**
 * Adopt a pre-multi-tree `data/tree.json` the first time the registry is read.
 *
 * Idempotent, and it only ever *adds* to the file — the rows are untouched, the
 * path is untouched. Without this an existing install would open onboarding and
 * appear to have lost 252 people.
 */
async function migrateLegacyTree(index: TreeIndex): Promise<TreeIndex> {
	const legacy = LEGACY_FILE()
	if (index.trees.length > 0 || !existsSync(legacy)) return index

	const store = new LocalTreeStore(legacy, "main")
	const snapshot = await store.read()
	const root =
		snapshot.people.find((person) => person.id === LEGACY_ROOT_PERSON_ID) ??
		snapshot.people[0]

	await store.updateMeta({
		// Named after whoever the chart used to open on, since the old store had
		// no name of its own. Renameable in settings.
		name: snapshot.meta.rootPersonId
			? snapshot.meta.name
			: (root?.surname ?? root?.fullName ?? "tree"),
		rootPersonId: snapshot.meta.rootPersonId ?? root?.id,
	})

	const migrated: TreeIndex = {
		trees: [{ id: "main", file: toStoredPath(legacy) }],
	}
	await writeIndex(migrated)
	return migrated
}

/** The store for one registered tree, or undefined if it isn't registered. */
export async function getTreeStore(
	id: string,
): Promise<LocalTreeStore | undefined> {
	const index = await migrateLegacyTree(await readIndex())
	const entry = index.trees.find((tree) => tree.id === id)
	return entry
		? new LocalTreeStore(toAbsolutePath(entry.file), entry.id)
		: undefined
}

/**
 * Every tree, in registration order.
 *
 * A tree whose file has gone missing is reported rather than dropped: silently
 * forgetting an entry because an external drive isn't plugged in would look
 * exactly like data loss.
 */
export async function listTrees(): Promise<TreeSummary[]> {
	const index = await migrateLegacyTree(await readIndex())

	return Promise.all(
		index.trees.map(async (entry) => {
			const file = toAbsolutePath(entry.file)
			const store = new LocalTreeStore(file, entry.id)
			if (!existsSync(file)) {
				const timestamp = new Date().toISOString()
				return {
					id: entry.id,
					name: entry.id,
					file,
					available: false,
					peopleCount: 0,
					createdAt: timestamp,
					updatedAt: timestamp,
				}
			}
			const snapshot = await store.read()
			return {
				...snapshot.meta,
				file,
				available: true,
				peopleCount: snapshot.people.length,
			}
		}),
	)
}

/** Filesystem-safe stem for a tree file; Cyrillic names fall back to the id. */
function slugify(name: string, fallback: string): string {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
	return slug || fallback
}

/** Where a tree with this name goes by default. Shown in onboarding. */
export const defaultFileFor = (name: string, fallback = "family") =>
	path.join(defaultTreeDir(), `${slugify(name, fallback)}.json`)

/**
 * Check a user-supplied destination before anything is written to it.
 *
 * The app writes wherever it's told — it is a local, single-user tool and
 * "somewhere off this disk" is the whole point of the feature. What it will not
 * do is guess: a relative path, or a path without a `.json` name, is a typo far
 * more often than an intention.
 */
export function resolveTargetFile(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) throw new TreeOpError("pathRequired")

	const expanded = trimmed.startsWith("~")
		? path.join(
				process.env.HOME ?? process.env.USERPROFILE ?? "",
				trimmed.slice(1),
			)
		: trimmed

	if (!path.isAbsolute(expanded)) throw new TreeOpError("pathNotAbsolute")
	if (path.extname(expanded).toLowerCase() !== ".json")
		throw new TreeOpError("pathNotJson")

	return path.normalize(expanded)
}

/**
 * Folders that quietly copy whatever you put in them to somebody else's
 * computer. Not blocked — plenty of people want exactly that, and it is their
 * family and their choice — but it has to be said out loud, because "I didn't
 * realise Documents was iCloud" is how this data ends up somewhere it wasn't
 * meant to go.
 */
const SYNCED_FOLDERS = [
	"Library/Mobile Documents", // iCloud Drive
	"Library/CloudStorage", // OneDrive, Dropbox, Google Drive on modern macOS
	"Dropbox",
	"Google Drive",
	"GoogleDrive",
	"OneDrive",
	"Yandex.Disk",
	"pCloud Drive",
]

export function isCloudSyncedPath(file: string): boolean {
	const segments = path.normalize(file).split(path.sep)
	return SYNCED_FOLDERS.some((folder) => {
		const parts = folder.split("/")
		return segments.some((_, index) =>
			parts.every((part, offset) => segments[index + offset] === part),
		)
	})
}

async function register(entry: TreeIndexEntry): Promise<void> {
	const index = await migrateLegacyTree(await readIndex())
	await writeIndex({ trees: [...index.trees, entry] })
}

export interface CreateTreeOptions {
	name: string
	/** Absolute path to a `.json` file. Defaults to the data directory. */
	file?: string
}

/** Create an empty tree and register it. Returns its id. */
export async function createTree({
	name,
	file,
}: CreateTreeOptions): Promise<TreeSummary> {
	const trimmed = name.trim()
	if (!trimmed) throw new TreeOpError("treeNameRequired")

	const id = newId("t")
	const target = file ? resolveTargetFile(file) : defaultFileFor(trimmed, id)

	if (existsSync(target)) throw new TreeOpError("fileExists", { path: target })

	const store = new LocalTreeStore(target, id)
	// `updateMeta` writes the file, creating any missing directories owner-only.
	const meta = await store.updateMeta({ name: trimmed })
	await register({ id, file: toStoredPath(target) })

	return { ...meta, file: target, available: true, peopleCount: 0 }
}

/**
 * Is this file a family tree, or somebody's unrelated JSON?
 *
 * `people` and `unions` both being arrays is the test. A tree written by this
 * app always has them, an empty tree has them empty, and no ordinary config
 * file has both.
 */
async function assertLooksLikeTree(file: string): Promise<void> {
	let parsed: unknown
	try {
		parsed = JSON.parse(await readFile(file, "utf8"))
	} catch {
		throw new TreeOpError("fileNotATree", { path: file })
	}

	const candidate = parsed as Partial<Record<"people" | "unions", unknown>>
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!Array.isArray(candidate.people) ||
		!Array.isArray(candidate.unions)
	) {
		throw new TreeOpError("fileNotATree", { path: file })
	}
}

/**
 * Register a tree file that already exists — the other half of "keep it
 * wherever you like". This is how you get a tree back after reinstalling, or
 * open one from a USB stick.
 */
export async function adoptTree(file: string): Promise<TreeSummary> {
	const target = resolveTargetFile(file)
	if (!existsSync(target))
		throw new TreeOpError("fileNotFound", { path: target })

	const index = await migrateLegacyTree(await readIndex())
	const already = index.trees.find(
		(tree) => toAbsolutePath(tree.file) === target,
	)
	if (already) throw new TreeOpError("treeAlreadyOpen")

	// Checked against the *raw* file rather than a loaded snapshot: `read()`
	// fills in missing rows with empty arrays, so every well-formed JSON file on
	// the disk would otherwise look like a valid — if empty — family tree. Since
	// adopting a file means the next edit rewrites it wholesale, pointing this at
	// somebody's `package.json` has to be refused, not tidied up.
	await assertLooksLikeTree(target)

	const id = newId("t")
	const store = new LocalTreeStore(target, id)
	const snapshot = await store.read()

	const meta = await store.updateMeta({
		// `Object.assign` copies `undefined` over a real value, so only send the
		// name when the file genuinely hasn't got one.
		...(snapshot.meta.name === id
			? { name: path.basename(target, ".json") }
			: {}),
		rootPersonId: snapshot.meta.rootPersonId ?? snapshot.people[0]?.id,
	})
	await register({ id, file: toStoredPath(target) })

	return {
		...meta,
		file: target,
		available: true,
		peopleCount: snapshot.people.length,
	}
}

/** Move a tree's file somewhere else, keeping its identity and contents. */
export async function relocateTree(
	id: string,
	destination: string,
): Promise<TreeSummary> {
	const index = await migrateLegacyTree(await readIndex())
	const entry = index.trees.find((tree) => tree.id === id)
	if (!entry) throw new TreeOpError("noSuchTree")

	const from = toAbsolutePath(entry.file)
	const to = resolveTargetFile(destination)
	if (from === to) return await summaryOf(id)
	if (existsSync(to)) throw new TreeOpError("fileExists", { path: to })
	if (!existsSync(from)) throw new TreeOpError("fileNotFound", { path: from })

	await mkdir(path.dirname(to), { recursive: true, mode: DIR_MODE })
	try {
		await rename(from, to)
	} catch {
		// Different filesystem — an external disk is the common case here. Copy
		// first and only unlink once the copy is safely on the other side.
		await copyFile(from, to)
		await unlink(from)
	}

	await writeIndex({
		trees: index.trees.map((tree) =>
			tree.id === id ? { ...tree, file: toStoredPath(to) } : tree,
		),
	})
	return await summaryOf(id)
}

/** Rename a tree. The name lives in the file, not the index. */
export async function renameTree(
	id: string,
	name: string,
): Promise<TreeSummary> {
	const trimmed = name.trim()
	if (!trimmed) throw new TreeOpError("treeNameRequired")
	const store = await getTreeStore(id)
	if (!store) throw new TreeOpError("noSuchTree")
	await store.updateMeta({ name: trimmed })
	return await summaryOf(id)
}

/**
 * Drop a tree from the list **without touching its file**.
 *
 * Deliberately not a delete. Losing a family tree to a misread confirmation
 * dialog is unrecoverable — there is no undo in this app — so the destructive
 * half stays a deliberate act in the user's own file manager.
 */
export async function forgetTree(id: string): Promise<void> {
	const index = await migrateLegacyTree(await readIndex())
	if (!index.trees.some((tree) => tree.id === id))
		throw new TreeOpError("noSuchTree")
	await writeIndex({ trees: index.trees.filter((tree) => tree.id !== id) })
}

async function summaryOf(id: string): Promise<TreeSummary> {
	const summary = (await listTrees()).find((tree) => tree.id === id)
	if (!summary) throw new TreeOpError("noSuchTree")
	return summary
}
