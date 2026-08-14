"use client"

import { open, save } from "@tauri-apps/plugin-dialog"
import { writeTextFile } from "./store/fs"
import { isTauri } from "./store/fs.client"

/**
 * Ask the user for a folder, natively.
 *
 * **This is a permissions mechanism, not a nicety.** Tauri's filesystem plugin
 * denies any path outside a granted scope, and the app grants only its own data
 * directory up front. Choosing through this dialog is what adds the selected
 * folder to the fs *and* asset-protocol scopes, which is the only way a tree
 * kept on an external drive or in a home folder becomes readable at all. A typed
 * path cannot do it: the plugin refuses before the store is ever reached.
 *
 * `persisted-scope` is what makes the grant survive a restart — see
 * `src-tauri/src/lib.rs`, where it must be registered *after* the fs plugin.
 *
 * Returns undefined when the user cancels, and when there is no native dialog to
 * ask — in the browser, where a page cannot be handed a filesystem path at all.
 * Callers keep their typed-path field for that case; it still works wherever the
 * store's backend is Node's.
 */
export async function pickFolder(title: string): Promise<string | undefined> {
	if (!isTauri()) return undefined

	const chosen = await open({
		directory: true,
		multiple: false,
		title,
		/**
		 * Not optional in practice, despite the name suggesting a hint.
		 *
		 * This is what decides whether *subdirectories* are added to the scope
		 * along with the folder itself. A bundle keeps its pictures at
		 * `photos/8f/3a/8f3a….jpg` — sharded two levels deep — so without it the
		 * tree JSON would load and every single photo would be denied, which
		 * reads as "the app lost my pictures" rather than as a permissions
		 * problem. Backups are a level down too.
		 */
		recursive: true,
	})

	return typeof chosen === "string" ? chosen : undefined
}

/** True when a native folder dialog is available at all. */
export const canPickFolder = isTauri

/**
 * Ask where to save a file, then write it — the desktop half of exporting.
 *
 * **A blob download does not work here.** The web build exports by handing the
 * browser an object URL on an `<a download>`, which the webview does not act on:
 * WKWebView has no download handling unless the Rust side adds it, so the click
 * lands and nothing happens at all. Silently. A native save dialog is both the
 * thing that works and the better behaviour — the user chooses the location,
 * exactly as they do everywhere else in this app.
 *
 * Returns the chosen path, or undefined when the user cancels, so the caller can
 * tell "saved" from "changed their mind".
 */
export async function saveTextFile(
	contents: string,
	defaultName: string,
	title: string,
): Promise<string | undefined> {
	const path = await save({
		title,
		defaultPath: defaultName,
		filters: [{ name: "Family tree", extensions: ["json"] }],
	})
	if (!path) return undefined

	// The save dialog grants write access to the path it returned, which is what
	// lets this reach outside the app's own data directory.
	await writeTextFile(path, contents)
	return path
}
