import { getActiveTree } from "./active-tree"
import { TreeOpError } from "./errors"
import type { FamilyGraph } from "./family-graph"
import { getTreeStore, type TreeSummary } from "./store/registry"
import type { SnapshotTreeStore } from "./store/snapshot-store"
import { toFamilyGraph } from "./store/to-graph"

/**
 * The single place the app reads family data from.
 *
 * Everything downstream consumes `FamilyGraph`, so swapping this file's body for
 * a Supabase query later is the whole migration — no view or layout code changes.
 *
 * It no longer carries `server-only`. These functions run in the browser on both
 * targets: the desktop app reads the user's files through Tauri, the web app
 * reads IndexedDB. `lib/client-data.ts` is what subscribes React to them.
 *
 * There used to be one store here and a hard-coded `ROOT_PERSON_ID` beside it.
 * Both are gone: which trees exist and where their files are is
 * `store/registry.ts`, which of them this browser is showing is
 * `active-tree.ts`, and the person a chart opens on is now `meta.rootPersonId`
 * inside the tree file itself. That is what makes a second tree — or somebody
 * else's first one — possible.
 */

/** The store for the tree this request is looking at. */
export async function getStore(): Promise<SnapshotTreeStore> {
	const active = await getActiveTree()
	if (!active) throw new TreeOpError("noSuchTree")
	const store = await getTreeStore(active.id)
	if (!store) throw new TreeOpError("noSuchTree")
	return store
}

/**
 * What `/` found when it went looking for a tree.
 *
 * Three outcomes rather than a nullable graph, because they mean genuinely
 * different things to the reader: nobody has set up a tree yet, the tree's file
 * has gone (an unplugged drive, a moved folder), or here it is. Collapsing the
 * middle case into "no tree" would offer to start a new one to somebody whose
 * data is fine and merely elsewhere.
 */
export type ActiveTreeResult =
	| { status: "none" }
	| { status: "missing"; meta: TreeSummary }
	| { status: "ok"; meta: TreeSummary; graph: FamilyGraph }

/**
 * Deliberately uncached. The tree is editable, so a module-level cache would
 * serve stale data to the very next render after a write — and the whole file
 * is ~100KB, which is nothing to re-read. What used to dedupe the reads within
 * one render was Next's request memoisation; now it is that there is exactly one
 * caller, `useActiveTree`, holding the result in state.
 */
export async function loadActiveTree(): Promise<ActiveTreeResult> {
	const active = await getActiveTree()
	if (!active) return { status: "none" }
	if (!active.available) return { status: "missing", meta: active }

	const store = await getTreeStore(active.id)
	if (!store) return { status: "none" }

	return {
		status: "ok",
		meta: active,
		graph: toFamilyGraph(await store.read(), store.photoDir),
	}
}

/**
 * `FamilyGraph` uses Maps, which don't survive the server -> client boundary.
 * Serialize to arrays on the way out; `reviveFamilyGraph` rebuilds on the client.
 */
export function serializeFamilyGraph(graph: FamilyGraph) {
	return {
		people: [...graph.people.values()],
		unions: [...graph.unions.values()],
	}
}

export type SerializedFamilyGraph = ReturnType<typeof serializeFamilyGraph>
