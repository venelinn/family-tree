"use client"

import { readPref, usePref, writePref } from "./prefs"
import { listTrees, type TreeSummary } from "./store/registry"

/**
 * Which of the registered trees this browser is looking at.
 *
 * The reason this was a cookie rather than `localStorage` was structural: the
 * tree was read on the *server*, so the choice had to arrive with the request,
 * and reading it after the page had rendered would have painted one family's
 * chart and then replaced it with another's. With the store now running in the
 * browser on both targets, that inversion is gone — nothing can render a chart
 * before the client has read this, because the client is what reads the tree.
 *
 * Still an opaque tree id and nothing else. No names, no paths.
 */

export const TREE_KEY = "tree"

const parse = (raw: string | null) => raw ?? ""

export const getActiveTreeId = () => readPref(TREE_KEY, parse)
export const useActiveTreeId = () => usePref(TREE_KEY, "", parse)
export const setActiveTreeId = (id: string) => writePref(TREE_KEY, id)

/**
 * The chosen tree, or the first registered one if the stored id is stale (the
 * tree was forgotten, or this is a different browser). Undefined means there are
 * no trees at all, which is what sends a first-time visitor to onboarding.
 */
export async function getActiveTree(): Promise<TreeSummary | undefined> {
	const trees = await listTrees()
	if (trees.length === 0) return undefined

	const stored = getActiveTreeId()
	return trees.find((tree) => tree.id === stored) ?? trees[0]
}
