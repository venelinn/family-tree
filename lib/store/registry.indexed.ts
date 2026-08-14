import { TreeOpError } from "../errors"
import { deleteTreeRecord, IndexedTreeStore, readAllSummaries } from "./indexed"
import { newId } from "./snapshot-store"
import type { TreeSummary } from "./types"

/**
 * The registry for browser-stored trees.
 *
 * The file registry is built entirely on paths — adopt a file, move it, convert
 * it to a bundle, warn when it lands in iCloud. None of that means anything in a
 * browser origin, so this is not that file with the filesystem swapped out; it
 * is the much smaller thing that remains once paths are gone: which trees exist,
 * what they are called, and which one you are looking at.
 *
 * There is no separate index. Each tree record carries its own `meta`, so the
 * list is just an enumeration of the store — which keeps the property the file
 * registry works hard for, that the index can never disagree with the trees it
 * points at, and gets it for free.
 */

export const listTrees = async (): Promise<TreeSummary[]> => {
	const summaries = await readAllSummaries()
	return summaries.map(({ meta, peopleCount }) => ({
		...meta,
		// Always true: a record that enumerates cannot be missing. The file
		// registry needs this because an external drive can be unplugged.
		available: true,
		peopleCount,
	}))
}

export const getTreeStore = async (
	id: string,
): Promise<IndexedTreeStore | undefined> => {
	const exists = (await readAllSummaries()).some(({ meta }) => meta.id === id)
	return exists ? new IndexedTreeStore(id) : undefined
}

export interface CreateTreeOptions {
	name: string
	/** Ignored here. A browser tree has no location to choose. */
	file?: string
}

export async function createTree({
	name,
}: CreateTreeOptions): Promise<TreeSummary> {
	const trimmed = name.trim()
	if (!trimmed) throw new TreeOpError("treeNameRequired")

	const id = newId("t")
	const store = new IndexedTreeStore(id)
	// `updateMeta` goes through the base class's read-modify-write, which writes
	// the record — so this both names the tree and brings it into existence.
	const meta = await store.updateMeta({ name: trimmed })

	return { ...meta, available: true, peopleCount: 0 }
}

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
 * Drop a tree.
 *
 * **This one really does delete**, unlike the file registry's `forgetTree` — and
 * that difference is the honest one rather than an oversight. There, forgetting
 * leaves the user's file exactly where it is, so the data survives the mistake.
 * Here the record *is* the data, and "forget but keep" would mean an
 * unreachable tree consuming the origin's storage quota forever.
 *
 * Which is why the UI must offer an export before calling this. There is no
 * undo, and a browser has no Trash to fish it back out of.
 */
export async function forgetTree(id: string): Promise<void> {
	const summaries = await readAllSummaries()
	if (!summaries.some(({ meta }) => meta.id === id))
		throw new TreeOpError("noSuchTree")
	await deleteTreeRecord(id)
}

async function summaryOf(id: string): Promise<TreeSummary> {
	const summary = (await listTrees()).find((tree) => tree.id === id)
	if (!summary) throw new TreeOpError("noSuchTree")
	return summary
}

/* --------------------------------------------- not applicable in a browser -- */

/**
 * The path-shaped half of the registry, which a browser cannot honour.
 *
 * They throw rather than being absent so the dispatcher in `registry.ts` can
 * expose one shape for both targets, and so a caller that slips through the UI
 * guards fails loudly here instead of silently doing nothing. Every one of them
 * is already hidden by `TreeSummary.file` being undefined.
 */
const unsupported = (): never => {
	throw new TreeOpError("notSupportedHere")
}

export const adoptTree = unsupported as (file: string) => Promise<TreeSummary>
export const relocateTree = unsupported as (
	id: string,
	destination: string,
) => Promise<TreeSummary>
export const convertToBundle = unsupported as (
	id: string,
	destination?: string,
) => Promise<{
	tree: TreeSummary
	photosCopied: number
	photosMissing: number
}>
export const resolveTargetFile = unsupported as (
	input: string,
	options?: { bundleOnly?: boolean },
) => Promise<string>

export const dataDir = async () => ""
export const defaultTreeDir = async () => ""
export const defaultFileFor = async () => ""
export const isCloudSyncedPath = () => false
