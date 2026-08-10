import { existsSync } from "node:fs"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { TreeOpError } from "./errors"
import { DIR_MODE, FILE_MODE } from "./store/local"
import type { TreeStore } from "./store/types"

/**
 * Photo operations, kept below the server-action boundary.
 *
 * Same split as `tree-ops.ts`: the rules live here where they can be run
 * headlessly, and `photo-actions.ts` is the thin layer that revalidates and
 * translates errors. Validation of an upload is exactly the kind of thing that
 * should not only be exercised by clicking.
 *
 * Files land in `public/photos/uploads/`, because Next only serves static files
 * from `public/`, and a route handler that streamed arbitrary disk paths would
 * be a file-read hole in an app whose whole point is keeping this data private.
 * That directory is gitignored along with the rest of `public/photos`.
 *
 * Note this is the one part of the app that does *not* follow the tree file
 * wherever you put it: a tree kept on an external drive still has its uploaded
 * photos here. Worth knowing before moving a tree between machines.
 */

export const uploadDir = () =>
	path.join(process.cwd(), "public", "photos", "uploads")

const PUBLIC_PREFIX = "/photos/uploads"

/** 12 MB — a phone photo of a photo, without inviting a video. */
export const MAX_BYTES = 12 * 1024 * 1024

/**
 * Extensions come from the *detected* type, never from the uploaded filename:
 * a name is caller-controlled and this value becomes part of a path.
 */
const TYPES: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
}

/** Only paths this app wrote may be deleted from disk. */
const isUploaded = (url: string) => url.startsWith(`${PUBLIC_PREFIX}/`)

async function personOrThrow(store: TreeStore, personId: string) {
	const snapshot = await store.read()
	const person = snapshot.people.find((candidate) => candidate.id === personId)
	if (!person) throw new TreeOpError("noSuchPerson", { id: personId })
	return { snapshot, person }
}

/** Save an uploaded image and append it to the person's photos. */
export async function savePhoto(
	store: TreeStore,
	personId: string,
	file: File,
): Promise<string[]> {
	if (file.size === 0) throw new TreeOpError("photoMissing")

	const extension = TYPES[file.type]
	if (!extension) throw new TreeOpError("photoType")
	if (file.size > MAX_BYTES) throw new TreeOpError("photoTooBig")

	const { person } = await personOrThrow(store, personId)

	await mkdir(uploadDir(), { recursive: true, mode: DIR_MODE })

	// The person id alone isn't enough: ids from the GEDCOM contain `@`, and one
	// person may have several photos.
	const name = `${personId.replace(/[^a-zA-Z0-9]/g, "")}-${crypto
		.randomUUID()
		.slice(0, 8)}.${extension}`

	await writeFile(
		path.join(uploadDir(), name),
		Buffer.from(await file.arrayBuffer()),
		{ mode: FILE_MODE },
	)

	const photos = [...person.photos, `${PUBLIC_PREFIX}/${name}`]
	await store.updatePerson(personId, { photos })
	return photos
}

/** Detach a photo, and delete the file if this app put it there. */
export async function removePhoto(
	store: TreeStore,
	personId: string,
	url: string,
): Promise<string[]> {
	const { snapshot, person } = await personOrThrow(store, personId)

	const photos = person.photos.filter((photo) => photo !== url)
	await store.updatePerson(personId, { photos })

	// Imported photos are left on disk: `pnpm photos` owns those files, and the
	// same file may be shared with another person.
	if (isUploaded(url)) {
		const file = path.join(uploadDir(), path.basename(url))
		const stillUsed = snapshot.people.some(
			(candidate) =>
				candidate.id !== personId && candidate.photos.includes(url),
		)
		if (!stillUsed && existsSync(file)) await unlink(file)
	}

	return photos
}

/** Promote a photo to the front — the cards render `photos[0]`. */
export async function setPrimaryPhoto(
	store: TreeStore,
	personId: string,
	url: string,
): Promise<string[]> {
	const { person } = await personOrThrow(store, personId)
	if (!person.photos.includes(url)) throw new TreeOpError("photoMissing")

	const photos = [url, ...person.photos.filter((photo) => photo !== url)]
	await store.updatePerson(personId, { photos })
	return photos
}
