"use client"

import { useEffect, useState } from "react"
import { getActiveTree } from "./active-tree"
import { type ActiveTreeResult, loadActiveTree } from "./data"
import { onInvalidate } from "./invalidate"
import { listTrees, type TreeSummary } from "./store/registry"

/**
 * What `revalidatePath` used to do, done in the client.
 *
 * Every mutation went through a server action that ended with
 * `revalidatePath("/")`, and Next re-ran the server render. With no server there
 * is nothing to re-run: the components hold the data, so something has to tell
 * them it changed.
 *
 * A broadcast is that something, and it lives in `invalidate.ts` so the mutations
 * can reach it without importing a hook module. Each action calls
 * `invalidateTrees()` exactly where it used to call `revalidatePath` — which
 * means no component has to remember to refresh, the same as before.
 *
 * The tree file remains the single source of truth. Nothing here holds a second
 * copy that could drift from it; a mutation writes, then invalidates, then the
 * hooks read back what was actually stored — which is also why a failed write
 * cannot leave the UI showing a change that did not happen.
 */

/**
 * Load something from the store, and reload it whenever the store is
 * invalidated.
 *
 * The subscription lives inside the effect rather than behind a render-visible
 * version counter. A counter would have to be a dependency that the effect never
 * actually reads, which is both a lint error and a fair description of the
 * problem with it — the effect does not depend on the number, it depends on
 * being told. So it registers a listener and re-reads when called.
 *
 * `undefined` means "still reading", which every caller has to handle as a
 * distinct state from "read, and there is nothing there" — the difference
 * between a first frame and an empty tree.
 */
function useStoreValue<T>(read: () => Promise<T>): T | undefined {
	const [value, setValue] = useState<T>()

	useEffect(() => {
		// Reads resolve out of order — an invalidation can start a second one
		// before the first returns, and unmounting must discard both. A generation
		// counter is what keeps a stale answer from overwriting a newer one, which
		// with family data means showing rows that have already been deleted.
		let generation = 0

		const load = () => {
			const mine = ++generation
			read().then(
				(result) => {
					if (mine === generation) setValue(result)
				},
				(error) => {
					// Nothing here can present an error usefully, and swallowing it
					// silently would leave a permanent spinner. The store's own
					// errors surface through the mutation paths, which do have
					// somewhere to put them.
					console.error("Failed to read from the store", error)
					if (mine === generation) setValue(undefined)
				},
			)
		}

		load()
		const unsubscribe = onInvalidate(load)
		return () => {
			generation++
			unsubscribe()
		}
	}, [read])

	return value
}

/** The active tree's graph, or why there isn't one. Undefined while loading. */
export const useActiveTree = (): ActiveTreeResult | undefined =>
	useStoreValue(loadActiveTree)

export interface TreeList {
	trees: TreeSummary[]
	activeId?: string
}

/**
 * Module scope, not an inline closure in the hook below.
 *
 * `useStoreValue` depends on the reader it is given, so an arrow defined during
 * render would be a new function every time and re-read the store forever. A
 * module-level function is referentially stable, which lets the dependency be
 * declared honestly rather than suppressed.
 */
const readTreeList = async (): Promise<TreeList> => ({
	trees: await listTrees(),
	activeId: (await getActiveTree())?.id,
})

/** Every registered tree, and which one is current. Undefined while loading. */
export const useTreeList = (): TreeList | undefined =>
	useStoreValue(readTreeList)
