/**
 * The handful of `node:path` functions the store needs, as pure string work.
 *
 * The store runs in two places now — the app, where the filesystem is Tauri's,
 * and `pnpm import`, where it is Node's. `node:path` cannot come along: it does
 * not exist in a webview bundle. Tauri ships its own path API, but every
 * function in it is `async`, because each one is a round trip into Rust. Adopting
 * it would turn `toStoredPath`, `defaultFileFor`, `resolveTargetFile` and
 * `isCloudSyncedPath` — all synchronous today, all called from the middle of
 * other expressions — into promises, and that colour spreads outward through the
 * registry to no benefit whatsoever. Joining two strings does not need Rust.
 *
 * **POSIX only.** Separator is `/`, absolute means "starts with `/`", and there
 * is no notion of a drive letter. That is correct on macOS for both backends,
 * and it is the single file Windows support would have to revisit — see
 * `AGENTS.md` if that day comes. Everything here matches `node:path.posix`
 * closely enough for the paths this app constructs; it is not a general
 * reimplementation and should not be used as one.
 */

export const sep = "/"

export const isAbsolute = (p: string) => p.startsWith("/")

/**
 * Collapse `.`, `..` and repeated separators.
 *
 * A leading `..` survives on a relative path — `toStoredPath` depends on exactly
 * that to tell "inside the data directory" from "somewhere else entirely".
 */
export function normalize(p: string): string {
	const absolute = isAbsolute(p)
	const trailing = p.length > 1 && p.endsWith("/")
	const out: string[] = []

	for (const segment of p.split("/")) {
		if (!segment || segment === ".") continue
		if (segment === "..") {
			// `..` above the root has nowhere to go; on a relative path it is real.
			if (out.length > 0 && out.at(-1) !== "..") out.pop()
			else if (!absolute) out.push("..")
			continue
		}
		out.push(segment)
	}

	const joined = out.join("/")
	if (absolute) return `/${joined}`
	if (!joined) return "."
	return trailing ? `${joined}/` : joined
}

export function join(...parts: string[]): string {
	const joined = parts.filter(Boolean).join("/")
	return joined ? normalize(joined) : "."
}

export function dirname(p: string): string {
	const normalized = normalize(p).replace(/\/+$/, "")
	const index = normalized.lastIndexOf("/")
	if (index < 0) return "."
	if (index === 0) return "/"
	return normalized.slice(0, index)
}

/** The last segment, optionally with a known suffix removed. */
export function basename(p: string, ext?: string): string {
	const normalized = normalize(p).replace(/\/+$/, "")
	const name = normalized.slice(normalized.lastIndexOf("/") + 1)
	return ext && name !== ext && name.endsWith(ext)
		? name.slice(0, -ext.length)
		: name
}

/** `.json`, including the dot. Empty for a dotfile or a name with no dot. */
export function extname(p: string): string {
	const name = basename(p)
	const index = name.lastIndexOf(".")
	return index <= 0 ? "" : name.slice(index)
}

/** How to get from `from` to `to`, `..` segments and all. */
export function relative(from: string, to: string): string {
	const fromParts = normalize(from).split("/").filter(Boolean)
	const toParts = normalize(to).split("/").filter(Boolean)

	let shared = 0
	while (
		shared < fromParts.length &&
		shared < toParts.length &&
		fromParts[shared] === toParts[shared]
	) {
		shared++
	}

	return [
		...Array<string>(fromParts.length - shared).fill(".."),
		...toParts.slice(shared),
	].join("/")
}
