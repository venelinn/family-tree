import { cookies } from "next/headers"
import { listTrees, type TreeSummary } from "./store/registry"

/**
 * Which of the registered trees this browser is looking at.
 *
 * Kept in a cookie rather than `localStorage`, and the reason is structural
 * rather than a preference: `lib/data.ts` reads the tree on the *server*, so
 * the choice has to arrive with the request. `localStorage` is only readable
 * after the page has already rendered, which would mean painting one family's
 * chart and then replacing it with another's — the same class of bug the theme
 * cookie exists to avoid, but with somebody else's relatives on screen first.
 *
 * Same shape as `locale.ts` and `theme.ts`: plain server code to read, a server
 * action to write, because only actions may set cookies.
 *
 * The cookie holds an opaque tree id and nothing else — no names, no paths.
 */

export const TREE_COOKIE = "tree"

/**
 * The chosen tree, or the first registered one if the cookie is stale (the tree
 * was forgotten, or this is a different machine). Undefined means there are no
 * trees at all, which is what sends a first-time visitor to onboarding.
 */
export async function getActiveTree(): Promise<TreeSummary | undefined> {
	const trees = await listTrees()
	if (trees.length === 0) return undefined

	const stored = (await cookies()).get(TREE_COOKIE)?.value
	return trees.find((tree) => tree.id === stored) ?? trees[0]
}
