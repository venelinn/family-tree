"use client"

import { TreeOpError } from "./errors"
import type { TreeSnapshot } from "./store/types"

/**
 * Moving a tree in and out of the app as a single JSON file.
 *
 * Two jobs, and the second is the important one:
 *
 * **A bridge between the targets.** The desktop app keeps trees as folders the
 * user chose; the web app keeps them in its own IndexedDB. Neither can see the
 * other's storage, so a file passed between them is the only way to start a tree
 * on one and carry on with it on the other.
 *
 * **The only backup a browser tree has.** A file on disk survives clearing site
 * data, a browser evicting storage under pressure, and switching machines —
 * none of which IndexedDB does. `forgetTree` on the web genuinely deletes,
 * unlike its file counterpart, which makes exporting first the difference
 * between a mistake and a loss.
 *
 * **Photos travel with it, base64-encoded in the same document.** The first
 * version of this carried only the references, which meant a tree exported from
 * the desktop and imported into a browser arrived with every name and date and
 * no faces — technically a tree, and not the thing anybody wanted.
 *
 * A zip would be the tidier container, and base64 costs about a third in size on
 * top of bytes that are already compressed. It is chosen anyway because it needs
 * no dependency and no streaming, the whole thing stays one file somebody can
 * see is one file, and a personal tree's photos are tens of megabytes rather
 * than hundreds. If that stops being true, this is the seam to replace.
 *
 * Photos are keyed by the same content-addressed name both stores use, so
 * importing is a matter of writing each blob back under the name the rows
 * already point at — no rewriting of references, and duplicates across trees
 * collapse on their own.
 */

/** What an exported file is called. Not a format marker — the format is JSON. */
export const EXPORT_EXTENSION = ".familytree.json"

/**
 * Is this a family tree, or somebody's unrelated JSON?
 *
 * `people` and `unions` both being arrays is the test, and it is the same one
 * `adoptTree` applies to a file on disk — for the same reason. `read()` fills
 * missing rows with empty arrays, so *every* well-formed JSON document would
 * otherwise load as a valid empty tree, and importing one would create a tree
 * with nobody in it rather than telling the user they picked the wrong file.
 */
export function assertLooksLikeTree(
	parsed: unknown,
): asserts parsed is Partial<TreeSnapshot> {
	const candidate = parsed as Partial<Record<"people" | "unions", unknown>>
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!Array.isArray(candidate.people) ||
		!Array.isArray(candidate.unions)
	) {
		throw new TreeOpError("fileNotATree", { path: "" })
	}
}

/** Filesystem-safe stem, matching what the registry does for folder names. */
const slugify = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "family"

/**
 * The file format: a snapshot, plus its pictures.
 *
 * `photos` is optional so a file written before they were carried still imports,
 * and so an export from a tree with none stays small.
 */
export interface TreeArchive extends TreeSnapshot {
	/** Base64 bytes, keyed by the content-addressed `<sha256>.<ext>` name. */
	photos?: Record<string, string>
}

const toBase64 = (bytes: Uint8Array): string => {
	// Chunked because `String.fromCharCode(...bytes)` on a multi-megabyte photo
	// blows the argument limit — it fails on exactly the large files that matter.
	let binary = ""
	const CHUNK = 0x8000
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
	}
	return btoa(binary)
}

const fromBase64 = (value: string): Uint8Array => {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

/**
 * Hand the archive to the browser as a download.
 *
 * A blob URL and a synthetic click, because there is no server to serve a file
 * from on either target. The object URL is revoked immediately after — it pins
 * the whole tree in memory until it is, and this runs in an app that may be open
 * for days.
 */
export const serializeArchive = (archive: TreeArchive): string =>
	`${JSON.stringify(archive, null, 2)}\n`

export const fileNameFor = (archive: TreeArchive): string =>
	`${slugify(archive.meta.name)}${EXPORT_EXTENSION}`

export function downloadSnapshot(archive: TreeArchive): void {
	const blob = new Blob([serializeArchive(archive)], {
		type: "application/json",
	})
	const url = URL.createObjectURL(blob)
	try {
		const anchor = document.createElement("a")
		anchor.href = url
		anchor.download = fileNameFor(archive)
		anchor.click()
	} finally {
		URL.revokeObjectURL(url)
	}
}

/**
 * Collect a tree's photos as base64, ready to write into an archive.
 *
 * Only the entries the rows actually reference, and each one once — a photo on
 * four siblings is four references and one blob. Anything the store cannot
 * produce is skipped rather than failing the export: a photo already missing is
 * not a reason to refuse somebody a backup of everything else.
 */
export async function collectPhotos(
	people: { photos: string[] }[],
	read: (entry: string) => Promise<Uint8Array | undefined>,
): Promise<Record<string, string>> {
	const entries = new Set(
		people.flatMap((person) => person.photos).filter((e) => !e.includes("/")),
	)
	const photos: Record<string, string> = {}
	for (const entry of entries) {
		const bytes = await read(entry)
		if (bytes) photos[entry] = toBase64(bytes)
	}
	return photos
}

/** Write an archive's photos into a store, under the names the rows use. */
export async function restorePhotos(
	photos: Record<string, string> | undefined,
	put: (entry: string, bytes: Uint8Array) => Promise<void>,
): Promise<number> {
	if (!photos) return 0
	let restored = 0
	for (const [entry, encoded] of Object.entries(photos)) {
		try {
			await put(entry, fromBase64(encoded))
			restored++
		} catch {
			// One unreadable photo should not cost the user the whole import; the
			// reference stays in the rows and simply resolves to nothing.
		}
	}
	return restored
}

/** Read and validate a file the user picked. Throws `TreeOpError` on anything odd. */
export async function readSnapshotFile(
	file: File,
): Promise<Partial<TreeArchive>> {
	let parsed: unknown
	try {
		parsed = JSON.parse(await file.text())
	} catch {
		throw new TreeOpError("fileNotATree", { path: file.name })
	}
	assertLooksLikeTree(parsed)
	return parsed
}

/**
 * The name to give an imported tree.
 *
 * The file's own `meta.name` wins — it is what the tree calls itself and
 * survives being renamed on disk. The filename is the fallback, stripped of the
 * export suffix, because "nikolov.familytree.json" should not become a tree
 * called `nikolov.familytree`.
 */
export function nameForImport(
	snapshot: Partial<TreeArchive>,
	fileName: string,
): string {
	const stored = snapshot.meta?.name?.trim()
	if (stored) return stored
	return (
		fileName.replace(/\.familytree\.json$/i, "").replace(/\.json$/i, "") ||
		"family"
	)
}
