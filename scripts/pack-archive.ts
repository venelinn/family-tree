/**
 * Pack a tree on disk into the single JSON file the app's Import accepts —
 * rows *and* photos, base64-encoded.
 *
 *   pnpm archive                                  # first registered tree
 *   pnpm archive data/tree.familytree             # a bundle by path
 *   pnpm archive data/tree.familytree out.json    # and where to write it
 *
 * Why this exists: a bundle's `tree.json` is only half of it. The pictures live
 * beside it in `photos/`, content-addressed, and Import has no way to reach
 * them — it is handed one file by the browser, not a folder. Importing the raw
 * `tree.json` therefore succeeds and arrives with every name and date and no
 * faces, which is the exact failure `lib/transfer.ts` was written to prevent.
 * Export inside the app produces this same file; this is the way to get one
 * when the app cannot be opened on the tree in the first place.
 *
 * Deliberately built out of the app's own `collectPhotos` and
 * `serializeArchive` rather than a second implementation of the format — the
 * output has to be the file Export writes, not merely one that resembles it.
 */

import path from "node:path"
import { setFs } from "../lib/store/fs"
import { nodeFs } from "../lib/store/fs.node"
import { LocalTreeStore } from "../lib/store/local"
import { listTrees } from "../lib/store/registry.local"
import { collectPhotos, fileNameFor, serializeArchive } from "../lib/transfer"

// The store has no filesystem of its own — see `lib/store/fs.ts`.
setFs(nodeFs)

async function main() {
	const [source, destination] = process.argv.slice(2)

	// A path wins when given; otherwise the first registered tree, which is what
	// somebody running this with no arguments almost always means.
	const root = source ?? (await listTrees())[0]?.file
	if (!root) {
		console.error("No trees registered, and no path given.")
		process.exit(1)
	}

	const store = await LocalTreeStore.open(root)
	const snapshot = await store.read()
	const photos = await collectPhotos(snapshot.people, (entry) =>
		store.readPhotoBytes(entry),
	)
	const archive = { ...snapshot, photos }

	const referenced = new Set(snapshot.people.flatMap((person) => person.photos))
		.size
	const packed = Object.keys(photos).length

	const out = destination ?? path.join(path.dirname(root), fileNameFor(archive))
	await nodeFs.writeTextFile(out, serializeArchive(archive))

	console.log(`${snapshot.people.length} people, ${packed} photos -> ${out}`)
	// Missing blobs are skipped rather than fatal, exactly as in the app — but
	// silently losing a face is the thing this script exists to stop, so say so.
	if (packed < referenced)
		console.warn(
			`${referenced - packed} referenced photo(s) not found on disk.`,
		)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
