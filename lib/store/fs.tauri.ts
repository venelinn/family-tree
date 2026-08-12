import { convertFileSrc } from "@tauri-apps/api/core"
import { appDataDir, homeDir } from "@tauri-apps/api/path"
import {
	copyFile,
	exists,
	mkdir,
	readDir,
	readFile,
	readTextFile,
	remove,
	rename,
	stat,
	writeFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs"
import type { TreeFs } from "./fs"

/**
 * The Tauri backend, for the desktop app.
 *
 * A near one-to-one mapping onto `node:fs/promises`, which is the whole reason
 * the port was tractable — see `lib/store/fs.ts`. Three differences worth
 * knowing about, all of them upstream's rather than ours:
 *
 * **Modes are gone.** The JS plugin takes no `mode`, so `FILE_MODE` and
 * `DIR_MODE` cannot be enforced here and the umask decides. On macOS the app
 * writes inside the user's own home, so the practical exposure is small, but it
 * is a genuine loosening from what the Node path guarantees. `bundle.ts` says so
 * where the constants are defined.
 *
 * **Everything is scoped.** A path the user has not granted is denied, and the
 * grant comes from the native picker in the `dialog` plugin — which is why
 * onboarding uses one rather than a typed path. `persisted-scope` is what makes
 * the grant survive a restart, and it must be registered after `fs` in
 * `src-tauri/src/lib.rs` to do so.
 *
 * **No recursive copy.** `copyDir` in `fs.ts` builds one from the primitives.
 */
export const tauriFs: TreeFs = {
	readTextFile: (file) => readTextFile(file),

	// `options.mode` is accepted and dropped: see the note above.
	async writeTextFile(file, contents) {
		await writeTextFile(file, contents)
	},

	readFile: (file) => readFile(file),

	async writeFile(file, contents) {
		await writeFile(file, contents)
	},

	async mkdir(dir, options) {
		await mkdir(dir, { recursive: options?.recursive ?? false })
	},

	async readDir(dir) {
		const entries = await readDir(dir)
		return entries.map((entry) => ({
			name: entry.name,
			isDirectory: entry.isDirectory,
		}))
	},

	async stat(file) {
		const info = await stat(file)
		return {
			isDirectory: info.isDirectory,
			// `mtime` is documented as unavailable on some platforms. Zero reads as
			// "long ago", which makes the backup rate-limit in `local.ts` take a
			// snapshot rather than skip one — the safe direction to fail in.
			mtimeMs: info.mtime?.getTime() ?? 0,
		}
	},

	exists: (file) => exists(file),

	async rename(from, to) {
		await rename(from, to)
	},

	async copyFile(from, to) {
		await copyFile(from, to)
	},

	async remove(file, options) {
		await remove(file, { recursive: options?.recursive ?? false })
	},

	/**
	 * `~/Library/Application Support/<identifier>` on macOS — where the tree
	 * index and any tree the user did not place themselves live. Notably *not*
	 * the repo's `data/` directory: an installed app has no repo, and writing
	 * next to the binary is what the bundle format exists to avoid.
	 */
	dataDir: () => appDataDir(),

	homeDir: () => homeDir(),

	/**
	 * Rewrites an absolute path onto Tauri's asset protocol.
	 *
	 * The webview will not load `file://` from a page served over `tauri://`, so
	 * a raw path in an `<img src>` silently renders nothing. This needs
	 * `security.assetProtocol` enabled in `tauri.conf.json` *and* the path to be
	 * inside the granted scope — which for a tree the user picked through the
	 * native dialog it is, and `persisted-scope` is what keeps it so across a
	 * restart.
	 */
	toSrc: (file) => convertFileSrc(file),
}
