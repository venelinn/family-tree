/**
 * "Something was written — go and look again."
 *
 * This is the direct replacement for `revalidatePath`, and it lives in its own
 * module for the same reason `revalidatePath` was importable from anywhere: the
 * mutations call it, the hooks in `client-data.ts` listen to it, and neither
 * should have to import the other. Keeping React out of this file is what makes
 * that true — `actions.ts` and friends are not hook modules and have no business
 * pulling one in.
 *
 * A broadcast rather than a cache invalidation, because there is no cache. Every
 * listener re-reads from the store, which is a file read or an IndexedDB
 * transaction — cheap, and always the truth. A stale chart of somebody's family
 * is a much worse failure than a redundant read.
 */

const listeners = new Set<() => void>()

/** Call after any write. Every mounted reader re-reads. */
export function invalidateTrees(): void {
	for (const listener of listeners) listener()
}

/** Subscribe. Returns the unsubscribe. */
export function onInvalidate(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}
