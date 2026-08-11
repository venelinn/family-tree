import { TreeOpError } from "./errors"
import {
	EXTENSIONS,
	MalformedImageError,
	sniff,
	stripMetadata,
} from "./image-metadata"
import {
	DIR_MODE,
	FILE_MODE,
	isStoredPhoto,
	photoEntry,
	photoFile,
} from "./store/bundle"
import { dataDir, exists, mkdir, readFile, remove, writeFile } from "./store/fs"
import type { LocalTreeStore } from "./store/local"
import * as path from "./store/path"

/**
 * Photo operations, kept below the server-action boundary.
 *
 * Same split as `tree-ops.ts`: the rules live here where they can be run
 * headlessly, and `photo-actions.ts` is the thin layer that revalidates and
 * translates errors. Validation of an upload is exactly the kind of thing that
 * should not only be exercised by clicking.
 *
 * Photos live **inside the tree's bundle**, so copying a tree to another
 * machine takes its pictures with it. They are stored under the SHA-256 of
 * their sanitised bytes: identical scans attached to four siblings are kept
 * once, the filename carries no person id to leak who is related to whom, and
 * "is anyone else still using this?" is a count rather than a path comparison.
 * See `store/bundle.ts` for the layout and `image-metadata.ts` for what comes
 * off on the way in.
 *
 * A tree that is still a loose `.json` file has nowhere to put them and cannot
 * accept uploads; Settings offers to convert it. Photos such a tree already has
 * — downloaded by `pnpm photos` into `public/` — keep working untouched.
 */

/** 12 MB — a phone photo of a photo, without inviting a video. */
export const MAX_BYTES = 12 * 1024 * 1024

/**
 * SHA-256 of the sanitised bytes, hex — what a stored photo is named after.
 *
 * WebCrypto rather than `node:crypto` so the same code hashes in the webview and
 * under `tsx`; `crypto.subtle` is standard in both. It needs a secure context,
 * which `tauri://` and `http://localhost` both are.
 */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
}

async function personOrThrow(store: LocalTreeStore, personId: string) {
	const snapshot = await store.read()
	const person = snapshot.people.find((candidate) => candidate.id === personId)
	if (!person) throw new TreeOpError("noSuchPerson", { id: personId })
	return { snapshot, person }
}

/** Save an uploaded image and append it to the person's photos. */
export async function savePhoto(
	store: LocalTreeStore,
	personId: string,
	file: File,
): Promise<string[]> {
	const { photoDir } = store.location
	if (!photoDir) throw new TreeOpError("treeNotABundle")

	if (file.size === 0) throw new TreeOpError("photoMissing")
	if (file.size > MAX_BYTES) throw new TreeOpError("photoTooBig")

	const uploaded = new Uint8Array(await file.arrayBuffer())

	// The format comes from the bytes. `file.type` is the browser's multipart
	// header, which the caller controls, and this value decides which parser
	// runs and what extension the stored name gets.
	const format = sniff(uploaded)
	if (!format) throw new TreeOpError("photoType")

	let sanitised: Uint8Array
	try {
		sanitised = stripMetadata(uploaded, format)
	} catch (error) {
		// A file whose container doesn't parse cannot be stripped, and storing it
		// unstripped would quietly defeat the point of stripping at all.
		if (error instanceof MalformedImageError)
			throw new TreeOpError("photoMalformed")
		throw error
	}

	const { person } = await personOrThrow(store, personId)

	const hash = await sha256Hex(sanitised)
	const entry = `${hash}.${EXTENSIONS[format]}`
	const target = photoFile(photoDir, entry)
	if (!target) throw new TreeOpError("photoType")

	// Same bytes, same name: an identical photo added twice is already there.
	if (!(await exists(target))) {
		await mkdir(path.dirname(target), { recursive: true, mode: DIR_MODE })
		await writeFile(target, sanitised, { mode: FILE_MODE })
	}

	// ...and the same photo on the same person is not a second photo.
	if (person.photos.includes(entry)) return person.photos

	const photos = [...person.photos, entry]
	await store.updatePerson(personId, { photos })
	return photos
}

/** Detach a photo, and delete the file once nobody else refers to it. */
export async function removePhoto(
	store: LocalTreeStore,
	personId: string,
	url: string,
): Promise<string[]> {
	const entry = photoEntry(url)
	const { snapshot, person } = await personOrThrow(store, personId)

	const photos = person.photos.filter((photo) => photo !== entry)
	await store.updatePerson(personId, { photos })

	// Photos from `pnpm photos` are left alone: that script owns those files and
	// the tree file is not the only thing pointing at them.
	const { photoDir } = store.location
	if (!photoDir || !isStoredPhoto(entry)) return photos

	const stillUsed = snapshot.people.some(
		(candidate) =>
			candidate.id !== personId && candidate.photos.includes(entry),
	)
	const file = photoFile(photoDir, entry)
	if (!stillUsed && file && (await exists(file))) await remove(file)

	return photos
}

/** Promote a photo to the front — the cards render `photos[0]`. */
export async function setPrimaryPhoto(
	store: LocalTreeStore,
	personId: string,
	url: string,
): Promise<string[]> {
	const entry = photoEntry(url)
	const { person } = await personOrThrow(store, personId)
	if (!person.photos.includes(entry)) throw new TreeOpError("photoMissing")

	const photos = [entry, ...person.photos.filter((photo) => photo !== entry)]
	await store.updatePerson(personId, { photos })
	return photos
}

/* ------------------------------------------------------------ reading ----- */

/** Content types, by stored extension. Never taken from an upload. */
const CONTENT_TYPES: Record<string, string> = {
	jpg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
}

export interface StoredPhoto {
	bytes: Uint8Array
	contentType: string
}

/**
 * Read one stored photo, for the route that serves them.
 *
 * `entry` arrives from the URL, so it is checked against the stored-photo shape
 * — 64 hex characters and a known extension — before it becomes part of a path.
 * `photoFile` returns undefined for anything else, which is what keeps this
 * from being a way to read arbitrary files: the caller never supplies a path,
 * only a name from a fixed alphabet that is resolved inside a directory the
 * server chose.
 */
export async function readPhoto(
	store: LocalTreeStore,
	entry: string,
): Promise<StoredPhoto | undefined> {
	const { photoDir } = store.location
	if (!photoDir) return undefined

	const file = photoFile(photoDir, entry)
	if (!file || !(await exists(file))) return undefined

	const extension = path.extname(entry).slice(1)
	const contentType = CONTENT_TYPES[extension]
	if (!contentType) return undefined

	return { bytes: await readFile(file), contentType }
}

/**
 * Pull every `/photos/…` reference into the bundle, rewriting the rows in place.
 *
 * Shared by the loose-file conversion in `registry.ts` and by `pnpm import`:
 * both arrive holding people whose photos are served paths under `public/`,
 * left there by `pnpm photos`, and both want them stored properly instead.
 *
 * A reference that cannot be resolved is dropped from that person rather than
 * failing the whole run — a photo that has already gone missing is not a reason
 * to refuse an import — and the caller is told how many, so it can say so.
 */
export async function ingestServedPhotos(
	photoDir: string,
	people: { photos: string[] }[],
	publicDir?: string,
): Promise<{ copied: number; missing: number }> {
	// `public/` sits beside the data directory in a checkout, which is where the
	// `/photos/…` references left by `pnpm photos` resolve against. The desktop
	// app has no `public/` on disk at all, so nothing resolves and every such
	// reference is reported missing — correct, since those files genuinely are
	// not there, and only reachable from a tree predating bundles anyway.
	const root = publicDir ?? path.join(path.dirname(await dataDir()), "public")
	let copied = 0
	let missing = 0
	// The same photo is attached to several siblings, and adopting means a read
	// and a hash, so each distinct reference is resolved once.
	const seen = new Map<string, string | undefined>()

	for (const person of people) {
		const photos: string[] = []
		for (const original of person.photos) {
			// Already stored: a re-import of a tree that was converted first.
			if (isStoredPhoto(original)) {
				photos.push(original)
				copied++
				continue
			}
			if (!seen.has(original)) {
				// Served paths are rooted at `public/`. Anything else — a remote URL
				// in a tree that was never localised — has no local file to take.
				const file = original.startsWith("/")
					? path.join(root, original)
					: undefined
				seen.set(
					original,
					file ? await adoptPhotoFile(photoDir, file) : undefined,
				)
			}
			const adopted = seen.get(original)
			if (adopted) {
				photos.push(adopted)
				copied++
			} else {
				missing++
			}
		}
		person.photos = photos
	}

	return { copied, missing }
}

/**
 * Take a photo that already exists on disk into the bundle.
 *
 * Returns the stored entry, or undefined when the file is missing or isn't an
 * image this app handles — neither is worth failing a whole migration over.
 */
export async function adoptPhotoFile(
	photoDir: string,
	source: string,
): Promise<string | undefined> {
	if (!(await exists(source))) return undefined

	const bytes = await readFile(source)
	const format = sniff(bytes)
	if (!format) return undefined

	let sanitised: Uint8Array
	try {
		sanitised = stripMetadata(bytes, format)
	} catch (error) {
		if (error instanceof MalformedImageError) return undefined
		throw error
	}

	const hash = await sha256Hex(sanitised)
	const entry = `${hash}.${EXTENSIONS[format]}`
	const target = photoFile(photoDir, entry)
	if (!target) return undefined

	if (!(await exists(target))) {
		await mkdir(path.dirname(target), { recursive: true, mode: DIR_MODE })
		await writeFile(target, sanitised, { mode: FILE_MODE })
	}
	return entry
}
