"use client"

import { setFs } from "./fs"
import { tauriFs } from "./fs.tauri"

/**
 * Installs a filesystem backend in the browser, at import time.
 *
 * **Import time, not effect time, and that is the whole point.** Child effects
 * run before parent effects in React, so a bootstrap *component* would register
 * after the components that read the store had already tried. A module side
 * effect runs when the module is first imported, which is before any of this
 * renders at all.
 *
 * Only the desktop target gets one for now. In a plain browser there is no
 * filesystem to hand it, and the web store — IndexedDB — does not exist yet, so
 * `lib/store/fs.ts` will throw its "no backend registered" error on the first
 * read. That is the honest failure: the app has no storage there until
 * `IndexedTreeStore` lands, and pretending otherwise would mean a chart that
 * looks empty rather than one that says why.
 *
 * When it does land, this file becomes the `open.ts` factory in the plan —
 * picking the pair of store *and* registry by the same test.
 */

/**
 * Which target this bundle was built for.
 *
 * **Build-time, not a runtime sniff, and that distinction cost a real bug.**
 * The obvious check is `"__TAURI_INTERNALS__" in window`, which Tauri injects
 * into the webview — but injection and the bundle's own evaluation are not
 * ordered against each other. Losing that race made the desktop app fall
 * through to the *browser* store, find no trees in an IndexedDB it should never
 * have opened, and show onboarding to somebody with 253 people on disk. It
 * worked on one launch and failed on the next with no code change between them.
 *
 * An env var baked in at compile time cannot race. `pnpm app` sets it via
 * `dev:tauri`, and `tauri build` via `build:tauri`; a plain `pnpm dev` or
 * `pnpm build` leaves it unset and gets the web target. See `package.json`.
 */
export const isTauri = (): boolean =>
	process.env.NEXT_PUBLIC_TAURI === "1" ||
	// Belt and braces. The env var is the reliable half; this catches a webview
	// somehow running a bundle that was not built with the flag, which is better
	// than silently opening the wrong store.
	(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)

let installed = false

/**
 * Install the backend, on first use rather than on import.
 *
 * Import time is exactly what broke: this module can be evaluated before the
 * webview has finished setting itself up, and a `setFs` skipped then is skipped
 * forever. Calling this from `registry.ts` instead means the decision happens
 * when something actually wants the store — after mount, after everything is
 * injected — and it is idempotent, so calling it on every access is free.
 */
export function ensureFs(): void {
	if (installed || !isTauri()) return
	setFs(tauriFs)
	installed = true
}
