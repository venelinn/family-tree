"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
// Side effect only: installs the `node:fs` backend under the store.
import "./store/fs.server"
import { toActionError } from "./action-error"
import { TREE_COOKIE } from "./active-tree"
import { TreeOpError } from "./errors"
import { type PersonFormValues, toPersonInput } from "./person-input"
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

/**
 * Creating, opening, moving and choosing trees.
 *
 * Separate from `actions.ts`, which edits the people *inside* one tree. These
 * operate on the tree as a thing: its name, its file, and which one you are
 * looking at.
 *
 * All of them take a path from the user and act on it, which is the point of
 * the feature — you decide where your family's data is kept. It also means this
 * app writes wherever it is told, so it is meant to be run on your own machine
 * and bound to localhost; do not put it on a network someone else is on.
 */

const ONE_YEAR = 60 * 60 * 24 * 365

export interface TreeActionResult {
	ok: boolean
	error?: string
	treeId?: string
}

async function selectTree(id: string): Promise<void> {
	;(await cookies()).set(TREE_COOKIE, id, {
		maxAge: ONE_YEAR,
		path: "/",
		sameSite: "lax",
	})
}

/** Switch which tree is on screen. Called from the settings page. */
export async function setActiveTreeAction(
	id: string,
): Promise<TreeActionResult> {
	try {
		const trees = await listTrees()
		// This is an endpoint, so the id is validated here rather than trusted.
		if (!trees.some((tree) => tree.id === id))
			throw new TreeOpError("noSuchTree")

		await selectTree(id)
		// The whole app is showing a different family now — the chart in the
		// client router cache included. Same reason as the locale and theme.
		revalidatePath("/", "layout")
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

		await selectTree(summary.id)
		revalidatePath("/", "layout")
		return { ok: true, treeId: summary.id }
	} catch (error) {
		return await toActionError(error)
	}
}

/** Open a tree file that already exists on disk, and switch to it. */
export async function adoptTreeAction(file: string): Promise<TreeActionResult> {
	try {
		const summary = await adoptTree(file)
		await selectTree(summary.id)
		revalidatePath("/", "layout")
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
		revalidatePath("/", "layout")
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
		revalidatePath("/", "layout")
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
		revalidatePath("/", "layout")
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
		if (remaining[0]) await selectTree(remaining[0].id)
		revalidatePath("/", "layout")
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
