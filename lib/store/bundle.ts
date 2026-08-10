import { statSync } from "node:fs"
import path from "node:path"

/**
 * Where the pieces of one tree sit on disk.
 *
 * A tree used to be a single JSON file, and its photos lived somewhere else
 * entirely — under `public/`, on the app's own disk, staying behind when the
 * file was copied to a USB stick. That made "keep your data wherever you like"
 * only half true, and left nothing coherent to back up or export.
 *
 * So a tree is a directory:
 *
 * ```
 * Nikolov.familytree/
 * ├── tree.json              the store — same shape as the old loose file
 * ├── photos/8f/3a/8f3a….jpg content-addressed, metadata stripped
 * └── backups/               timestamped copies of tree.json
 * ```
 *
 * See [docs/privacy.md](../../docs/privacy.md).
 *
 * **The `.familytree` suffix is a default, not a requirement.** It is worth
 * having because it says what the folder is, but macOS does *not* treat it as a
 * package — nothing declares that extension, so Finder shows an ordinary folder
 * either way. A tree renamed to plain `Nikolov` is still a tree, which is why
 * what decides is whether the path is a **directory** rather than what it is
 * called. Losing somebody's family history over a suffix they tidied up would
 * be indefensible.
 *
 * **Loose `.json` files keep working.** An install from before this change
 * carries on reading and writing exactly where it did, with its photos still
 * under `public/`, until someone converts it in Settings. `locate()` is what
 * papers over the difference: everything above it takes a `TreeLocation` and
 * never asks which kind it has.
 */

/** Owner read/write only. Directories need the execute bit to be traversable. */
export const FILE_MODE = 0o600
export const DIR_MODE = 0o700

export const BUNDLE_EXTENSION = ".familytree"
const TREE_FILE = "tree.json"

export interface TreeLocation {
	/** What the registry stores and what the user is shown. */
	root: string
	/** The JSON to read and write — the root itself when it's a loose file. */
	file: string
	/** Inside the bundle; undefined for a loose file, whose photos are elsewhere. */
	photoDir?: string
	/** Inside the bundle; undefined for a loose file, which has no home for them. */
	backupDir?: string
}

/**
 * Is this tree a folder?
 *
 * What it *is* beats what it is called: `statSync` rather than a suffix check,
 * so renaming `Nikolov.familytree` to `Nikolov` in Finder changes nothing. The
 * call is on the hot path only once per store construction, and a `stat` is
 * cheaper than the read that follows it.
 *
 * Nothing there yet means somebody is choosing where to put a new one, and only
 * the name can answer. `.json` is the one extension that means a loose file;
 * anything else — including no extension at all — is a folder.
 */
export function isBundleRoot(root: string): boolean {
	try {
		return statSync(root).isDirectory()
	} catch {
		return path.extname(root).toLowerCase() !== ".json"
	}
}

/** Resolve a stored path into the set of places this tree keeps things. */
export function locate(root: string): TreeLocation {
	if (!isBundleRoot(root)) return { root, file: root }
	return {
		root,
		file: path.join(root, TREE_FILE),
		photoDir: path.join(root, "photos"),
		backupDir: path.join(root, "backups"),
	}
}

/** The folder a loose `<name>.json` becomes, beside it. Suggestion only. */
export const bundlePathFor = (file: string) =>
	isBundleRoot(file)
		? file
		: path.join(
				path.dirname(file),
				`${path.basename(file, path.extname(file))}${BUNDLE_EXTENSION}`,
			)

/* ------------------------------------------------------------- photos ----- */

/**
 * A stored photo is `<sha256>.<ext>` — the hash of the sanitised bytes.
 *
 * Content addressing does three jobs at once. The same scan attached to four
 * siblings is stored once. The filename stops carrying a person id, which
 * otherwise leaks who is related to whom the moment a single file is shared.
 * And "is any other person still using this?" becomes a plain count instead of
 * a path comparison.
 */
const STORED_PHOTO = /^([0-9a-f]{64})\.(jpg|png|webp|gif)$/

export const isStoredPhoto = (entry: string) => STORED_PHOTO.test(entry)

/**
 * Where a stored photo lives, sharded two bytes deep.
 *
 * Directories with tens of thousands of entries are slow to list on some
 * filesystems and unpleasant to look at on all of them.
 */
export function photoFile(photoDir: string, entry: string): string | undefined {
	const match = STORED_PHOTO.exec(entry)
	if (!match) return undefined
	const hash = match[1] as string
	return path.join(photoDir, hash.slice(0, 2), hash.slice(2, 4), entry)
}

/**
 * The URL a stored photo is served at.
 *
 * Anything else — `/photos/I85-0.jpg` from `pnpm photos`, or a remote URL in a
 * tree that was never localised — is already a working `src` and is passed
 * through untouched. That is what lets loose trees carry on unconverted.
 */
export const photoUrl = (treeId: string, entry: string) =>
	isStoredPhoto(entry) ? `/photo/${encodeURIComponent(treeId)}/${entry}` : entry

/** The inverse: a URL from the client back to what the tree file records. */
export function photoEntry(url: string): string {
	const match = /^\/photo\/[^/]+\/([^/]+)$/.exec(url)
	return match?.[1] && isStoredPhoto(match[1]) ? match[1] : url
}
