"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Reader preferences — theme, language, whether names follow it, which tree.
 *
 * These four used to be cookies read during the server render, and the comments
 * in `theme.ts`, `locale.ts` and `active-tree.ts` explain at length why: a cookie
 * arrives *with* the request, so `<html data-theme>` was correct in the very
 * first byte and nothing flashed. That reasoning was right and is still right.
 * What changed is the premise — there is no server render any more, on either
 * target, so there is no request for a cookie to arrive with.
 *
 * So they move to `localStorage`, and the flash comes back as the problem it
 * always was for apps that couldn't know sooner. Two things handle it:
 *
 *  - `themeInitScript` in `theme.ts` runs blocking in `<head>` and stamps
 *    `data-theme` before first paint. Blocking is the point; it is ~200 bytes of
 *    inline JavaScript and no network.
 *  - Everything else reads through `usePref`, which is `useSyncExternalStore`.
 *    That renders the *default* during prerender and the stored value once
 *    hydrated, which is exactly the contract React wants — no mismatch warning,
 *    and one re-render rather than a wrong paint that persists.
 *
 * A preference is one small string. Anything that is family data belongs in the
 * tree, not here — see `TreeMeta.rootPersonId`, which is stored per tree
 * precisely so it survives copying the file to another machine.
 */

/** Notifies same-tab listeners; `storage` only fires in *other* tabs. */
const CHANGED = "prefs-changed"

function readRaw(key: string): string | null {
	// Prerender, and any environment where storage is refused outright — Safari
	// in private mode used to throw rather than return null.
	try {
		return globalThis.localStorage?.getItem(key) ?? null
	} catch {
		return null
	}
}

export function writePref(key: string, value: string): void {
	try {
		globalThis.localStorage?.setItem(key, value)
	} catch {
		// A preference that cannot be remembered is not worth failing an edit for.
	}
	globalThis.dispatchEvent?.(new CustomEvent(CHANGED, { detail: key }))
}

function subscribe(onChange: () => void): () => void {
	globalThis.addEventListener?.("storage", onChange)
	globalThis.addEventListener?.(CHANGED, onChange)
	return () => {
		globalThis.removeEventListener?.("storage", onChange)
		globalThis.removeEventListener?.(CHANGED, onChange)
	}
}

/**
 * One stored preference, validated on the way out.
 *
 * `parse` rather than a cast because the value is user-editable — devtools, a
 * stale key from an older version, a half-written value — and the old cookie
 * readers validated for the same reason. Anything unrecognised falls back to the
 * default rather than propagating.
 */
export function usePref<T>(
	key: string,
	fallback: T,
	parse: (raw: string | null) => T,
	// Explicit rather than `String(value)`, because the stored form is not always
	// the obvious one: `namesFollowLanguage` is a boolean written as `"on"` /
	// `"off"`, which is what the cookie held and what a browser upgrading from
	// the previous version already has.
	serialize: (value: T) => string = String,
): [T, (value: T) => void] {
	const value = useSyncExternalStore(
		subscribe,
		() => parse(readRaw(key)),
		// Prerender has no storage, so it renders the default and hydration
		// corrects it. This is the argument React added the third parameter for.
		() => fallback,
	)

	const set = useCallback(
		(next: T) => writePref(key, serialize(next)),
		[key, serialize],
	)

	return [value, set]
}

/** The same read, outside React — for the store layer and one-off callers. */
export function readPref<T>(key: string, parse: (raw: string | null) => T): T {
	return parse(readRaw(key))
}
