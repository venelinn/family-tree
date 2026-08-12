import { TreeOpError } from "../errors"
import { ingestServedPhotos } from "../photos"
import {
	BUNDLE_EXTENSION,
	bundlePathFor,
	DIR_MODE,
	FILE_MODE,
	isBundleRoot,
	locate,
} from "./bundle"
import {
	dataDir as backendDataDir,
	copyDir,
	copyFile,
	exists,
	homeDir,
	mkdir,
	readTextFile,
	remove,
	rename,
	writeTextFile,
} from "./fs"
import { LocalTreeStore, newId } from "./local"
import * as path from "./path"
import type { TreeMeta } from "./types"

/**
 * Which trees exist, and where on disk each one is kept.
 *
 * Two ideas here, both of them privacy decisions rather than technical ones.
 *
 * **A tree may live anywhere.** Not everyone wants a household's names, birth
 * dates and addresses sitting inside a checked-out git repository, or on the
 * same disk as the app. So the registry stores a *path* per tree — an external
 * drive, an encrypted volume, a USB stick — and the app follows it. Nothing is
 * ever uploaded; there is no network call anywhere in this path.
 *
 * What that path points at is a **directory** holding the JSON and the photos
 * together, so moving a tree takes its pictures with it. `.familytree` is the
 * suffix suggested for it and nothing more — what marks a tree as a folder is
 * being one. Trees registered before folders existed are loose `.json` files
 * and stay that way until `convertToBundle` is run on them; see `bundle.ts`.
 *
 * **The index is not a second source of truth.** It records only `id` and
 * `file`. A tree's name and root person live in that file's own `meta`, so
 * copying the file to another machine carries everything with it and the index
 * can be rebuilt by pointing at the file again.
 *
 * Paths inside the data directory are stored relative to it, so a repo can be
 * cloned or moved without every tree breaking; paths outside it are absolute.
 */

/**
 * Where the index lives, and where trees go when the user hasn't chosen.
 *
 * The backend decides: `FAMILY_TREE_DATA_DIR` or the repo's `data/` under Node,
 * `~/Library/Application Support/<identifier>` in the desktop app, which has no
 * repo to sit inside. Async only because Tauri's path API is — the value never
 * changes within a run, so it is resolved once and kept.
 */
let cachedDataDir: string | undefined
export const dataDir = async () => (cachedDataDir ??= await backendDataDir())

const indexFile = async () => path.join(await dataDir(), "trees.json")

/** Where a new tree goes unless the user picks somewhere else. */
export const defaultTreeDir = async () => path.join(await dataDir(), "trees")

/**
 * The pre-multi-tree store. It stays exactly where it is rather than being
 * moved into `trees/`: it is the real family data, `pnpm import` targets it,
 * and a migration that relocates someone's only copy is not a migration worth
 * having.
 */
const LEGACY_FILE = async () => path.join(await dataDir(), "tree.json")
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
	/**
	 * A directory that keeps its photos with it, rather than a loose `.json`
	 * left over from before bundles. Settings offers to convert the ones that
	 * aren't, and uploads are refused until they are.
	 */
	bundle: boolean
}

const toStoredPath = async (absolute: string) => {
	const relative = path.relative(await dataDir(), absolute)
	return relative.startsWith("..") || path.isAbsolute(relative)
		? absolute
		: relative
}

const toAbsolutePath = async (stored: string) =>
	path.isAbsolute(stored) ? stored : path.join(await dataDir(), stored)

async function readIndex(): Promise<TreeIndex> {
	const file = await indexFile()
	if (!(await exists(file))) return { trees: [] }
	const parsed = JSON.parse(await readTextFile(file)) as Partial<TreeIndex>
	return { trees: parsed.trees ?? [] }
}

async function writeIndex(index: TreeIndex): Promise<void> {
	const file = await indexFile()
	await mkdir(path.dirname(file), { recursive: true, mode: DIR_MODE })
	const temp = `${file}.tmp`
	await writeTextFile(temp, `${JSON.stringify(index, null, 2)}\n`, {
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
	const legacy = await LEGACY_FILE()
	if (index.trees.length > 0 || !(await exists(legacy))) return index

	const store = await LocalTreeStore.open(legacy, "main")
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
		trees: [{ id: "main", file: await toStoredPath(legacy) }],
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
		? await LocalTreeStore.open(await toAbsolutePath(entry.file), entry.id)
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
			const root = await toAbsolutePath(entry.file)
			const store = await LocalTreeStore.open(root, entry.id)
			const bundle = await isBundleRoot(root)
			// For a bundle it is the JSON inside that has to be there: the
			// directory surviving without it is data loss wearing a hat.
			if (!(await exists(store.file))) {
				const timestamp = new Date().toISOString()
				return {
					id: entry.id,
					name: entry.id,
					file: root,
					available: false,
					peopleCount: 0,
					bundle,
					createdAt: timestamp,
					updatedAt: timestamp,
				}
			}
			const snapshot = await store.read()
			return {
				...snapshot.meta,
				file: root,
				available: true,
				peopleCount: snapshot.people.length,
				bundle,
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

/**
 * What a tree called this would be named as a folder — `nikolov.familytree`.
 *
 * Split out from `defaultFileFor` for the native picker, which asks the user for
 * a *parent* directory and needs to build the bundle name inside it. Same slug
 * either way, so a tree lands under the same name wherever it is put.
 */
export const bundleNameFor = (name: string, fallback = "family") =>
	`${slugify(name, fallback)}${BUNDLE_EXTENSION}`

/** Where a tree with this name goes by default. Shown in onboarding. */
export const defaultFileFor = async (name: string, fallback = "family") =>
	path.join(await defaultTreeDir(), bundleNameFor(name, fallback))

/**
 * Check a user-supplied destination before anything is written to it.
 *
 * The app writes wherever it's told — it is a local, single-user tool and
 * "somewhere off this disk" is the whole point of the feature. What it will not
 * do is guess: a relative path, or one whose name says nothing about what it
 * is, is a typo far more often than an intention.
 *
 * `bundleOnly` is the difference between making a tree and opening one. A new
 * tree is always a folder, because a loose file has nowhere to keep photos —
 * so the only name refused is one ending `.json`, which would mean the other
 * thing. The folder itself may be called anything; `.familytree` is what gets
 * suggested, not what gets required.
 */
export async function resolveTargetFile(
	input: string,
	{ bundleOnly = false }: { bundleOnly?: boolean } = {},
): Promise<string> {
	const trimmed = input.trim()
	if (!trimmed) throw new TreeOpError("pathRequired")

	const expanded = trimmed.startsWith("~")
		? path.join(await homeDir(), trimmed.slice(1))
		: trimmed

	if (!path.isAbsolute(expanded)) throw new TreeOpError("pathNotAbsolute")

	if (bundleOnly && path.extname(expanded).toLowerCase() === ".json")
		throw new TreeOpError("pathNotBundle", { extension: BUNDLE_EXTENSION })

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
	/** Absolute path to a `.familytree` directory. Defaults to the data directory. */
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
	const target = file
		? await resolveTargetFile(file, { bundleOnly: true })
		: await defaultFileFor(trimmed, id)

	if (await exists(target))
		throw new TreeOpError("fileExists", { path: target })

	const store = await LocalTreeStore.open(target, id)
	// `updateMeta` writes the file, creating any missing directories owner-only.
	const meta = await store.updateMeta({ name: trimmed })
	await register({ id, file: await toStoredPath(target) })

	return {
		...meta,
		file: target,
		available: true,
		peopleCount: 0,
		bundle: true,
	}
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
		parsed = JSON.parse(await readTextFile(file))
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
	const target = await resolveTargetFile(file)
	const location = await locate(target)
	if (!(await exists(location.file)))
		throw new TreeOpError("fileNotFound", { path: target })

	const index = await migrateLegacyTree(await readIndex())
	const registered = await Promise.all(
		index.trees.map((tree) => toAbsolutePath(tree.file)),
	)
	if (registered.includes(target)) throw new TreeOpError("treeAlreadyOpen")

	// Checked against the *raw* file rather than a loaded snapshot: `read()`
	// fills in missing rows with empty arrays, so every well-formed JSON file on
	// the disk would otherwise look like a valid — if empty — family tree. Since
	// adopting a file means the next edit rewrites it wholesale, pointing this at
	// somebody's `package.json` has to be refused, not tidied up.
	await assertLooksLikeTree(location.file)

	const id = newId("t")
	const store = await LocalTreeStore.open(target, id)
	const snapshot = await store.read()

	const meta = await store.updateMeta({
		// `Object.assign` copies `undefined` over a real value, so only send the
		// name when the file genuinely hasn't got one.
		...(snapshot.meta.name === id
			? { name: path.basename(target, path.extname(target)) }
			: {}),
		rootPersonId: snapshot.meta.rootPersonId ?? snapshot.people[0]?.id,
	})
	await register({ id, file: await toStoredPath(target) })

	return {
		...meta,
		file: target,
		available: true,
		peopleCount: snapshot.people.length,
		bundle: await isBundleRoot(target),
	}
}

/**
 * Turn a loose `.json` tree into a `.familytree` bundle, photos and all.
 *
 * **Nothing is moved or deleted.** The original file stays exactly where it is
 * and so does everything under `public/photos`; what changes is which of them
 * the registry points at. That leaves the previous copy sitting there as a
 * backup, and it is the same reasoning as `forgetTree` not deleting: this is
 * somebody's only record of their family, and an operation that eats it when
 * misunderstood is not one worth having.
 *
 * Photos referenced as `/photos/…` are read out of `public/`, stripped of their
 * metadata on the way past, and stored by content hash inside the bundle. One
 * that has gone missing is dropped from that person rather than failing the
 * conversion — a broken reference is already a broken reference.
 */
export async function convertToBundle(
	id: string,
	destination?: string,
): Promise<{ tree: TreeSummary; photosCopied: number; photosMissing: number }> {
	const index = await migrateLegacyTree(await readIndex())
	const entry = index.trees.find((tree) => tree.id === id)
	if (!entry) throw new TreeOpError("noSuchTree")

	const from = await toAbsolutePath(entry.file)
	if (await isBundleRoot(from)) throw new TreeOpError("treeAlreadyBundle")
	if (!(await exists(from)))
		throw new TreeOpError("fileNotFound", { path: from })

	const target = destination
		? await resolveTargetFile(destination, { bundleOnly: true })
		: await bundlePathFor(from)
	if (await exists(target))
		throw new TreeOpError("fileExists", { path: target })

	const source = await LocalTreeStore.open(from, id)
	const snapshot = await source.read()

	const photoDir = (await locate(target)).photoDir as string
	await mkdir(photoDir, { recursive: true, mode: DIR_MODE })

	const { copied: photosCopied, missing: photosMissing } =
		await ingestServedPhotos(photoDir, snapshot.people)

	// Written through a store so the bundle gets the same atomic rename and
	// owner-only modes as any other write.
	const destinationStore = await LocalTreeStore.open(target, id)
	await destinationStore.replaceAll(snapshot)
	await destinationStore.updateMeta({
		name: snapshot.meta.name,
		rootPersonId: snapshot.meta.rootPersonId,
	})

	const stored = await toStoredPath(target)
	await writeIndex({
		trees: index.trees.map((tree) =>
			tree.id === id ? { ...tree, file: stored } : tree,
		),
	})

	return { tree: await summaryOf(id), photosCopied, photosMissing }
}

/** Move a tree's file somewhere else, keeping its identity and contents. */
export async function relocateTree(
	id: string,
	destination: string,
): Promise<TreeSummary> {
	const index = await migrateLegacyTree(await readIndex())
	const entry = index.trees.find((tree) => tree.id === id)
	if (!entry) throw new TreeOpError("noSuchTree")

	const from = await toAbsolutePath(entry.file)
	const to = await resolveTargetFile(destination)
	if (from === to) return await summaryOf(id)
	if (await exists(to)) throw new TreeOpError("fileExists", { path: to })
	if (!(await exists(from)))
		throw new TreeOpError("fileNotFound", { path: from })
	// Moving is not converting. A `.familytree` renamed to `.json` would stop
	// being read as a folder — `locate` would take the directory itself for the
	// store — and its photos would go quiet.
	const bundle = await isBundleRoot(from)
	if (bundle && path.extname(to).toLowerCase() === ".json")
		throw new TreeOpError("pathNotBundle", { extension: BUNDLE_EXTENSION })
	if (!bundle && path.extname(to).toLowerCase() !== ".json")
		throw new TreeOpError("pathNotTree", { extension: ".json" })

	await mkdir(path.dirname(to), { recursive: true, mode: DIR_MODE })
	try {
		await rename(from, to)
	} catch {
		// Different filesystem — an external disk is the common case here, and
		// the whole reason the feature exists. A tree is usually a directory, so
		// this needs the recursive copy rather than a single-file one; `copyDir`
		// is in `fs.ts` because Tauri's plugin has nothing like Node's `cp`.
		try {
			if (bundle) await copyDir(from, to)
			else await copyFile(from, to)
		} catch (error) {
			// A stick that filled up halfway leaves a partial tree behind, and
			// that partial tree would then fail the `fileExists` check on the
			// retry that fixes the problem. Clear it and re-raise, so the caller
			// still gets "there isn't enough room on that disk".
			await remove(to, { recursive: true }).catch(() => undefined)
			throw error
		}

		// Only let go of the original once the copy is demonstrably there. A
		// half-written destination plus a deleted source is the one outcome this
		// app must never produce.
		const landed = await locate(to)
		if (!(await exists(landed.file)))
			throw new TreeOpError("fileNotFound", { path: landed.file })
		await remove(from, { recursive: true })
	}

	const stored = await toStoredPath(to)
	await writeIndex({
		trees: index.trees.map((tree) =>
			tree.id === id ? { ...tree, file: stored } : tree,
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
