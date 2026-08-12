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

/** Tauri injects this into the webview; nothing else has it. */
export const isTauri = (): boolean =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

if (isTauri()) setFs(tauriFs)
