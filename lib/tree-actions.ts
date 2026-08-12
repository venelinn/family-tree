"use client"

import { toActionError } from "./action-error"
import { setActiveTreeId } from "./active-tree"
import { TreeOpError } from "./errors"
import { invalidateTrees } from "./invalidate"
import { type PersonFormValues, toPersonInput } from "./person-input"
import { canPickFolder, saveTextFile } from "./pick-folder"
import {
	adoptTree,
	convertToBundle,
	createTree,
	defaultFileFor,
	defaultTreeDir,
	forgetTree,
	getTreeStore,
	isCloudSyncedPath,
	listTrees,
	relocateTree,
	renameTree,
	resolveTargetFile,
} from "./store/registry"
import {
	collectPhotos,
	downloadSnapshot,
	fileNameFor,
	nameForImport,
	readSnapshotFile,
	restorePhotos,
	serializeArchive,
} from "./transfer"

/**
 * Creating, opening, moving and choosing trees.
 *
 * Separate from `actions.ts`, which edits the people *inside* one tree. These
 * operate on the tree as a thing: its name, its file, and which one you are
 * looking at.
 *
 * All of them take a path from the user and act on it, which is the point of
 * the feature — you decide where your family's data is kept.
 *
 * **`Action` no longer means "server action".** These were `"use server"` and
 * ran on the other side of a wire; they are now plain async functions running in
 * the browser beside everything else. The suffix stays because it still names a
 * real distinction — these are the user-facing operations, which validate input
 * and turn a `TreeOpError` into a translated string, as against the primitives
 * in `store/registry.ts` that throw. It is also what keeps `createTreeAction`
 * from colliding with the `createTree` it wraps.
 *
 * What each of them used to end with — `revalidatePath` — is now
 * `invalidateTrees()` from `invalidate.ts`, called in the same place and doing
 * the same job: telling every mounted reader to go and look again.
 */

export interface TreeActionResult {
	ok: boolean
	error?: string
	treeId?: string
}

const selectTree = (id: string): void => setActiveTreeId(id)

/** Switch which tree is on screen. Called from the settings page. */
export async function setActiveTreeAction(
	id: string,
): Promise<TreeActionResult> {
	try {
		const trees = await listTrees()
		// This is an endpoint, so the id is validated here rather than trusted.
		if (!trees.some((tree) => tree.id === id))
			throw new TreeOpError("noSuchTree")

		selectTree(id)
		// The whole app is showing a different family now, not just this page.
		invalidateTrees()
		return { ok: true, treeId: id }
	} catch (error) {
		return await toActionError(error)
	}
}

export interface NewTreeInput {
	name: string
	/** Absolute path to a `.familytree` folder. Omitted means the default. */
	file?: string
	/** The first person, and the one the chart will open on. Omitted starts empty. */
	firstPerson?: PersonFormValues
}

/**
 * Create a tree, optionally with its first person, and switch to it.
 *
 * This is what onboarding submits. The first person is optional because
 * starting from nothing is a legitimate way to begin — the empty state on `/`
 * asks for them instead.
 */
export async function createTreeAction(
	input: NewTreeInput,
): Promise<TreeActionResult> {
	try {
		const summary = await createTree({ name: input.name, file: input.file })

		if (input.firstPerson) {
			const store = await getTreeStore(summary.id)
			if (!store) throw new TreeOpError("noSuchTree")
			const person = await store.createPerson(toPersonInput(input.firstPerson))
			await store.updateMeta({ rootPersonId: person.id })
		}

		selectTree(summary.id)
		invalidateTrees()
		return { ok: true, treeId: summary.id }
	} catch (error) {
		return await toActionError(error)
	}
}

/** Open a tree file that already exists on disk, and switch to it. */
export async function adoptTreeAction(file: string): Promise<TreeActionResult> {
	try {
		const summary = await adoptTree(file)
		selectTree(summary.id)
		invalidateTrees()
		return { ok: true, treeId: summary.id }
	} catch (error) {
		return await toActionError(error)
	}
}

/** Move a tree's file to a different place on disk. */
export async function relocateTreeAction(
	id: string,
	destination: string,
): Promise<TreeActionResult> {
	try {
		await relocateTree(id, destination)
		invalidateTrees()
		return { ok: true, treeId: id }
	} catch (error) {
		return await toActionError(error)
	}
}

export async function renameTreeAction(
	id: string,
	name: string,
): Promise<TreeActionResult> {
	try {
		await renameTree(id, name)
		invalidateTrees()
		return { ok: true, treeId: id }
	} catch (error) {
		return await toActionError(error)
	}
}

export interface ConvertResult extends TreeActionResult {
	/** Where the bundle was written, for telling the user afterwards. */
	file?: string
	/** Where their previous copy still is. */
	previous?: string
	photosCopied?: number
	photosMissing?: number
}

/**
 * Turn a loose `.json` tree into a `.familytree` bundle.
 *
 * Nothing is deleted: the old file stays where it is, which is why the result
 * carries its path — the user should be told they still have it rather than
 * left to assume.
 */
export async function convertTreeAction(
	id: string,
	destination?: string,
): Promise<ConvertResult> {
	try {
		const trees = await listTrees()
		const previous = trees.find((tree) => tree.id === id)?.file
		const { tree, photosCopied, photosMissing } = await convertToBundle(
			id,
			destination,
		)
		invalidateTrees()
		return {
			ok: true,
			treeId: id,
			file: tree.file,
			previous,
			photosCopied,
			photosMissing,
		}
	} catch (error) {
		return await toActionError(error)
	}
}

/** Remove a tree from the list. The file is left exactly where it is. */
export async function forgetTreeAction(id: string): Promise<TreeActionResult> {
	try {
		await forgetTree(id)
		const remaining = await listTrees()
		if (remaining[0]) selectTree(remaining[0].id)
		invalidateTrees()
		return { ok: true }
	} catch (error) {
		return await toActionError(error)
	}
}

export interface StoragePreview {
	ok: boolean
	/** The absolute path the tree would end up at. */
	file?: string
	/** True when that path is inside a folder that syncs to somebody's cloud. */
	cloudSynced?: boolean
	error?: string
}

/**
 * What "save it here" would actually mean, before anything is written.
 *
 * Onboarding shows this under the storage step: the real absolute path, and a
 * warning when it is inside iCloud, Dropbox or OneDrive. Choosing a synced
 * folder is allowed — it is a reasonable backup strategy — but it should be a
 * choice rather than a surprise.
 */
export async function previewStorageAction(
	name: string,
	file?: string,
): Promise<StoragePreview> {
	try {
		const target = file
			? await resolveTargetFile(file, { bundleOnly: true })
			: await defaultFileFor(name)
		return { ok: true, file: target, cloudSynced: isCloudSyncedPath(target) }
	} catch (error) {
		return await toActionError(error)
	}
}

/** The default folder, shown in onboarding so "default" isn't a mystery. */
export async function defaultTreeDirAction(): Promise<string> {
	return defaultTreeDir()
}

/* ------------------------------------------------------ import / export ---- */

/**
 * Save a tree to a file the user keeps.
 *
 * Available on both targets and worth having on both, but it is the *only*
 * backup a browser-stored tree has — IndexedDB does not survive clearing site
 * data. Photos are not included; see `transfer.ts`.
 */
export async function exportTreeAction(id: string): Promise<TreeActionResult> {
	try {
		const store = await getTreeStore(id)
		if (!store) throw new TreeOpError("noSuchTree")
		const snapshot = await store.read()
		// `readPhotoBytes` exists on both concrete stores but not on the abstract
		// one — nothing else needs it, and putting it there would oblige every
		// future backend to implement an export detail.
		const read = (
			store as {
				readPhotoBytes?: (e: string) => Promise<Uint8Array | undefined>
			}
		).readPhotoBytes?.bind(store)
		const photos = read ? await collectPhotos(snapshot.people, read) : undefined
		const archive = { ...snapshot, photos }

		// The webview ignores `<a download>`, so the desktop app writes the file
		// itself through a native save dialog. See `saveTextFile`.
		if (canPickFolder()) {
			const saved = await saveTextFile(
				serializeArchive(archive),
				fileNameFor(archive),
				"Export tree",
			)
			// Cancelled. Not an error, and not a success worth reporting either.
			if (!saved) return { ok: true, treeId: id }
		} else {
			downloadSnapshot(archive)
		}
		return { ok: true, treeId: id }
	} catch (error) {
		return await toActionError(error)
	}
}

/**
 * Create a tree from an exported file, and switch to it.
 *
 * Always a *new* tree rather than an overwrite of an existing one. Importing on
 * top of a tree would be the one operation here that can destroy data the user
 * did not ask to lose, and "I have two now" is a far easier mistake to recover
 * from than "it replaced the wrong one".
 *
 * This is also how a tree crosses between the desktop app and the browser, which
 * have no storage in common.
 */
export async function importTreeAction(file: File): Promise<TreeActionResult> {
	try {
		const snapshot = await readSnapshotFile(file)
		const summary = await createTree({
			name: nameForImport(snapshot, file.name),
		})

		const store = await getTreeStore(summary.id)
		if (!store) throw new TreeOpError("noSuchTree")

		await store.replaceAll({
			people: snapshot.people ?? [],
			unions: snapshot.unions ?? [],
			unionChildren: snapshot.unionChildren ?? [],
		})
		// Photos before the rows are visible, so the first render already has them
		// rather than filling in a beat later. Failures here are per-photo and
		// swallowed — see `restorePhotos`.
		if (store.canStorePhotos) {
			await restorePhotos(snapshot.photos, (entry, bytes) =>
				store.putPhoto(entry, bytes),
			)
		}

		// `replaceAll` clears the root when it doesn't survive; restore the file's
		// own choice when that person did come across.
		const rootPersonId = snapshot.meta?.rootPersonId
		if (rootPersonId && snapshot.people?.some((p) => p.id === rootPersonId)) {
			await store.updateMeta({ rootPersonId })
		}

		selectTree(summary.id)
		invalidateTrees()
		return { ok: true, treeId: summary.id }
	} catch (error) {
		return await toActionError(error)
	}
}
