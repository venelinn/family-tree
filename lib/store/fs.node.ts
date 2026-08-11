import {
	copyFile,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises"
import path from "node:path"
import type { TreeFs } from "./fs"

/**
 * The `node:fs` backend, for `pnpm import` and `pnpm backfill:married`.
 *
 * Imported **only** from `scripts/` — never from `app/`, `lib/` or
 * `components/`. The moment app code reaches this module Turbopack starts
 * resolving `node:fs` for the browser bundle, and the build stops being a static
 * export. `lib/store/fs.ts` explains the arrangement.
 *
 * This is also the only backend that can honour `DIR_MODE`/`FILE_MODE`, which is
 * why the options survive in the interface at all.
 */
export const nodeFs: TreeFs = {
	readTextFile: (file) => readFile(file, "utf8"),

	async writeTextFile(file, contents, options) {
		await writeFile(file, contents, { mode: options?.mode })
	},

	readFile: (file) => readFile(file),

	async writeFile(file, contents, options) {
		await writeFile(file, contents, { mode: options?.mode })
	},

	async mkdir(dir, options) {
		await mkdir(dir, {
			recursive: options?.recursive ?? false,
			mode: options?.mode,
		})
	},

	async readDir(dir) {
		const entries = await readdir(dir, { withFileTypes: true })
		return entries.map((entry) => ({
			name: entry.name,
			isDirectory: entry.isDirectory(),
		}))
	},

	async stat(file) {
		const stats = await stat(file)
		return { isDirectory: stats.isDirectory(), mtimeMs: stats.mtimeMs }
	},

	async exists(file) {
		try {
			await stat(file)
			return true
		} catch {
			return false
		}
	},

	async rename(from, to) {
		await rename(from, to)
	},

	async copyFile(from, to) {
		await copyFile(from, to)
	},

	async remove(file, options) {
		await rm(file, { recursive: options?.recursive ?? false, force: true })
	},

	// Unchanged from what `registry.dataDir()` used to compute inline, so an
	// existing checkout and `FAMILY_TREE_DATA_DIR` both keep working.
	async dataDir() {
		return process.env.FAMILY_TREE_DATA_DIR
			? path.resolve(process.env.FAMILY_TREE_DATA_DIR)
			: path.join(process.cwd(), "data")
	},

	async homeDir() {
		return process.env.HOME ?? process.env.USERPROFILE ?? ""
	},
}
