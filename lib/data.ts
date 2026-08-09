import "server-only"
import type { FamilyGraph } from "./family-graph"
import { LocalTreeStore } from "./store/local"
import { toFamilyGraph } from "./store/to-graph"

/**
 * The single place the app reads family data from.
 *
 * Everything downstream consumes `FamilyGraph`, so swapping this file's body for
 * a Supabase query later is the whole migration — no view or layout code changes.
 */

export const ROOT_PERSON_ID = "@I85@" // Venelin Nikolov Nikolov

/** Swap this for a SupabaseTreeStore and nothing else in the app changes. */
export const store = new LocalTreeStore()

/**
 * Deliberately uncached. The tree is editable now, so a module-level cache would
 * serve stale data to the very next render after a write — and the whole file is
 * ~100KB, which is nothing to re-read. Next's own request memoisation covers the
 * duplicate reads within a single render.
 */
export async function loadFamilyGraph(): Promise<FamilyGraph> {
	return toFamilyGraph(await store.read())
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
