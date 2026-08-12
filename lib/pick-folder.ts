"use client"

import { open } from "@tauri-apps/plugin-dialog"
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
