import { readPhoto } from "@/lib/photos"
import { isStoredPhoto } from "@/lib/store/bundle"
import { getTreeStore } from "@/lib/store/registry"

/**
 * Serves one photo out of a tree's bundle.
 *
 * Photos used to live in `public/`, because that is the only directory Next
 * serves statically — which also meant they were readable by anyone who could
 * reach the app, bypassing every server action, and that they stayed behind
 * when a tree was copied elsewhere. Both are fixed by keeping them in the
 * bundle and reading them here.
 *
 * The old worry about a route handler that reads from disk is the right worry
 * and does not apply: this one never receives a path. `name` has to match the
 * stored-photo shape — 64 hex characters and one of four extensions — before
 * `photoFile` will build anything from it, and the directory it is resolved
 * inside is chosen by the server from the tree id. There is no input here that
 * can escape the bundle, with `..` or otherwise.
 */

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ tree: string; name: string }> },
) {
	const { tree, name } = await params

	// Checked before the store is even looked up: a malformed name is not a
	// question worth answering.
	if (!isStoredPhoto(name)) return new Response(null, { status: 404 })

	const store = await getTreeStore(tree)
	if (!store) return new Response(null, { status: 404 })

	const photo = await readPhoto(store, name)
	if (!photo) return new Response(null, { status: 404 })

	return new Response(new Uint8Array(photo.bytes), {
		headers: {
			"Content-Type": photo.contentType,
			// The name is the hash of the bytes, so the content behind a given URL
			// can never change and this is safe to keep for a long time. `private`
			// keeps it out of any shared cache — these are photographs of somebody's
			// family, not assets.
			"Cache-Control": "private, max-age=31536000, immutable",
			"Content-Length": String(photo.bytes.length),
			// Nothing here is markup, and nothing should be guessed into being.
			"X-Content-Type-Options": "nosniff",
			"Content-Disposition": `inline; filename="${name}"`,
		},
	})
}
