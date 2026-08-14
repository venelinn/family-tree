import { basename, join } from "./path"

/**
 * The filesystem, as the store needs it — and whose it is, decided at startup.
 *
 * There are two callers with two different filesystems. The app runs inside a
 * Tauri webview, where `node:fs` does not exist and reads and writes go through
 * the Rust side. `pnpm import` and `pnpm backfill:married` run under `tsx`,
 * where `node:fs` is the only thing there is. The store's actual value — the
 * atomic temp-then-rename in `local.ts`, the "never delete the user's only copy"
 * ordering in `relocateTree` — is identical either way and worth writing once.
 *
 * So the backend is **registered by the entry point**, not detected here:
 * `components/tauri-bootstrap.tsx` installs the Tauri one, each script installs
 * the Node one. Sniffing for `window` would be shorter, but it would mean this
 * module importing both implementations, and then Turbopack would follow
 * `node:fs` into the client bundle and Node would follow `@tauri-apps/plugin-fs`
 * into `tsx`. Neither survives the trip. An explicit `setFs` keeps each backend
 * in exactly one import graph.
 *
 * The surface is deliberately the intersection of the two, plus what can be
 * built from it: `copyDir` exists because Tauri's plugin has no recursive copy,
 * and implementing it once over `readDir`/`mkdir`/`copyFile` beats having the
 * registry care which backend it got.
 */

export interface DirEntry {
	name: string
	isDirectory: boolean
}

export interface FileStat {
	isDirectory: boolean
	/** Epoch milliseconds. Zero when the backend cannot say. */
	mtimeMs: number
}

/**
 * `mode` is honoured by the Node backend and ignored by Tauri's, whose JS API
 * takes no mode. Kept in the signature because the intent — owner-only, this is
 * a household's names and birth dates — is worth stating at every call site even
 * where it currently cannot be enforced. See `DIR_MODE` in `bundle.ts`.
 */
export interface WriteOptions {
	mode?: number
}

export interface MkdirOptions extends WriteOptions {
	recursive?: boolean
}

export interface TreeFs {
	readTextFile(path: string): Promise<string>
	writeTextFile(
		path: string,
		contents: string,
		options?: WriteOptions,
	): Promise<void>
	readFile(path: string): Promise<Uint8Array>
	writeFile(
		path: string,
		contents: Uint8Array,
		options?: WriteOptions,
	): Promise<void>
	mkdir(path: string, options?: MkdirOptions): Promise<void>
	readDir(path: string): Promise<DirEntry[]>
	stat(path: string): Promise<FileStat>
	exists(path: string): Promise<boolean>
	rename(from: string, to: string): Promise<void>
	copyFile(from: string, to: string): Promise<void>
	remove(path: string, options?: { recursive?: boolean }): Promise<void>
	/** Where trees and the index live when the user has not chosen somewhere. */
	dataDir(): Promise<string>
	/** For expanding a leading `~`. */
	homeDir(): Promise<string>
	/**
	 * An absolute path, as something an `<img src>` can load.
	 *
	 * Platform-specific and not guessable: a webview will not load a bare
	 * `file://` from a page served over another protocol, so Tauri rewrites paths
	 * onto its own asset protocol. Putting it here rather than importing
	 * `convertFileSrc` where it is needed keeps `bundle.ts` — which `pnpm import`
	 * also loads — free of any Tauri import.
	 */
	toSrc(path: string): string
}

let backend: TreeFs | undefined

/** Install the backend. Called once, by the app's bootstrap or by a script. */
export function setFs(impl: TreeFs): void {
	backend = impl
}

function fs(): TreeFs {
	if (!backend) {
		throw new Error(
			"No filesystem backend registered. The app installs one in " +
				"components/tauri-bootstrap.tsx; scripts must call setFs(nodeFs) " +
				"before touching the store.",
		)
	}
	return backend
}

export const readTextFile = (path: string) => fs().readTextFile(path)
export const writeTextFile = (
	path: string,
	contents: string,
	options?: WriteOptions,
) => fs().writeTextFile(path, contents, options)
export const readFile = (path: string) => fs().readFile(path)
export const writeFile = (
	path: string,
	contents: Uint8Array,
	options?: WriteOptions,
) => fs().writeFile(path, contents, options)
export const mkdir = (path: string, options?: MkdirOptions) =>
	fs().mkdir(path, options)
export const readDir = (path: string) => fs().readDir(path)
export const stat = (path: string) => fs().stat(path)
export const exists = (path: string) => fs().exists(path)
export const rename = (from: string, to: string) => fs().rename(from, to)
export const copyFile = (from: string, to: string) => fs().copyFile(from, to)
export const remove = (path: string, options?: { recursive?: boolean }) =>
	fs().remove(path, options)
export const dataDir = () => fs().dataDir()
export const toSrc = (path: string) => fs().toSrc(path)
export const homeDir = () => fs().homeDir()

/** True for a path that exists and is a directory; false for anything else. */
export async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory
	} catch {
		return false
	}
}

/**
 * Recursive copy, for moving a tree between filesystems.
 *
 * Node has `cp` and Tauri has nothing like it, so it is built here from the
 * primitives both backends do have. Refuses to overwrite: `relocateTree` relies
 * on a partial destination being an error it can clean up and re-raise, not
 * something quietly merged into.
 */
export async function copyDir(from: string, to: string): Promise<void> {
	if (await exists(to)) throw new Error(`Already exists: ${to}`)
	await mkdir(to, { recursive: true })

	for (const entry of await readDir(from)) {
		const source = join(from, entry.name)
		const target = join(to, basename(entry.name))
		if (entry.isDirectory) await copyDir(source, target)
		else await copyFile(source, target)
	}
}
