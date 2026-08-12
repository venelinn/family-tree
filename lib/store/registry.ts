import { isTauri } from "./fs.client"
import * as indexed from "./registry.indexed"
import * as local from "./registry.local"

/**
 * Which registry the app is talking to — files, or the browser.
 *
 * Every component and action imports from here and not from either
 * implementation, so the choice is made once and nothing above the store has to
 * ask which target it is running on. The two differ in more than their backend:
 * one is built on paths and the other has none, which is why this is a pair of
 * modules rather than another `TreeFs`-style seam. See `registry.indexed.ts`.
 *
 * The desktop app gets the file registry; a plain browser gets IndexedDB. CLI
 * scripts import `registry.local` directly — they run under `tsx`, where
 * `isTauri()` is false but files are exactly what they want, and routing them
 * through this dispatcher would send `pnpm import` to a database that does not
 * exist in Node.
 *
 * Resolved per call rather than once at module load: the check reads `window`,
 * and this module is evaluated during prerender where there isn't one. Reading
 * it lazily is what keeps the static export from baking in the wrong answer.
 */

const registry = () => (isTauri() ? local : indexed)

export type { CreateTreeOptions } from "./registry.local"
export type { TreeSummary } from "./types"

export const listTrees = () => registry().listTrees()
export const getTreeStore = (id: string) => registry().getTreeStore(id)
export const createTree = (options: local.CreateTreeOptions) =>
	registry().createTree(options)
export const renameTree = (id: string, name: string) =>
	registry().renameTree(id, name)
export const forgetTree = (id: string) => registry().forgetTree(id)

export const adoptTree = (file: string) => registry().adoptTree(file)
export const relocateTree = (id: string, destination: string) =>
	registry().relocateTree(id, destination)
export const convertToBundle = (id: string, destination?: string) =>
	registry().convertToBundle(id, destination)
export const resolveTargetFile = (
	input: string,
	options?: { bundleOnly?: boolean },
) => registry().resolveTargetFile(input, options)

export const dataDir = () => registry().dataDir()
export const defaultTreeDir = () => registry().defaultTreeDir()
export const defaultFileFor = (name: string, fallback?: string) =>
	registry().defaultFileFor(name, fallback)
export const isCloudSyncedPath = (file: string) =>
	registry().isCloudSyncedPath(file)

export { bundleNameFor } from "./registry.local"
