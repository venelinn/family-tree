import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	/**
	 * Both targets are static.
	 *
	 * The desktop app has no server by construction — Tauri serves the bundle to
	 * a webview over its own protocol. The web app has no server because it was
	 * decided it would never read the repo's `data/`: with storage in the
	 * visitor's browser there is nothing left for a server to do. See
	 * `docs/decisions.md`.
	 *
	 * The practical consequence is that `"use server"`, route handlers and
	 * `cookies()` are all unavailable, which is why the preferences moved to
	 * `lib/prefs.ts` and the mutations became plain async functions.
	 */
	output: "export",

	images: {
		// Required by `output: "export"` — the default loader is a server route.
		// Nothing here uses `next/image` for family photos anyway; those come from
		// the local disk or IndexedDB and are addressed directly.
		unoptimized: true,
	},

	sassOptions: {
		// What makes `@use "styles/mixins"` resolve from a `.module.scss` sitting
		// anywhere in the tree, rather than each module counting `../../` back to
		// the root. Next also derives Sass load paths from tsconfig `baseUrl`,
		// but that option is deprecated out of TypeScript 7 — this is the path
		// that survives.
		loadPaths: [path.join(import.meta.dirname, "styles"), import.meta.dirname],
	},
}

export default nextConfig
