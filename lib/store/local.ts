import { DIR_MODE, FILE_MODE, locate, type TreeLocation } from "./bundle"
import {
	copyFile,
	exists,
	mkdir,
	readDir,
	readTextFile,
	remove,
	rename,
	stat,
	writeTextFile,
} from "./fs"
import * as path from "./path"
import { now, SnapshotTreeStore } from "./snapshot-store"
import type { TreeSnapshot } from "./types"

/**
 * File-backed `TreeStore` for local, single-user editing.
 *
 * Everything that edits rows lives in `SnapshotTreeStore`; what is left here is
 * the part that touches a disk — reading the JSON, writing it safely, and
 * keeping backups. That split is what made the IndexedDB store small rather than
 * a second copy of the same three hundred lines.
 *
 * No `server-only` guard here on purpose, and two callers depend on it: the
 * import script drives this store from the CLI, and the desktop app drives it
 * from inside the webview. Which filesystem it gets is `lib/store/fs.ts`'s
 * problem, not this file's.
 *
 * What it takes seriously is not corrupting the file: writes go to a temp path
 * and are renamed into place, so a crash mid-write leaves the previous good file
 * rather than a truncated one. Files are written owner-only where the backend
 * allows it — this is a household's names, birth dates and addresses, and on a
 * shared machine the default umask would otherwise leave them world-readable.
 *
 * The tree may live anywhere on disk, which is why the path is a constructor
 * argument rather than a constant: see `lib/store/registry.local.ts`, which is
 * what decides where, and `bundle.ts` for what that path points at.
 */

/**
 * How many timestamped copies of `tree.json` to keep in a bundle's `backups/`.
 *
 * These protect against the user, not against the disk — a branch of the family
 * deleted by mistake, an import run against the wrong tree. The whole file is a
 * few tens of kilobytes and every mutation already rewrites it, so keeping the
 * last twenty costs almost nothing and covers the failure that actually happens.
 * Disk loss is what the archive export is for.
 */
const KEEP_BACKUPS = 20

/** At most one snapshot per quarter hour, so twenty of them span a day's work. */
const BACKUP_INTERVAL_MS = 15 * 60 * 1000

export { newId } from "./snapshot-store"

export class LocalTreeStore extends SnapshotTreeStore {
	/** Bundle directory or loose `.json` — what the registry stores. */
	readonly root: string
	/** Everywhere this tree keeps something. */
	readonly location: TreeLocation

	/**
	 * Open the tree at `root`.
	 *
	 * A factory rather than a constructor because deciding whether the path is a
	 * bundle or a loose file is a `stat`, and Tauri has no synchronous one to
	 * offer. Resolving it here, once, is what keeps `location` and `file` plain
	 * synchronous properties for everything downstream — the alternative was an
	 * `await` on every `store.file`.
	 */
	static async open(root: string, id?: string): Promise<LocalTreeStore> {
		return new LocalTreeStore(await locate(root), id)
	}

	private constructor(location: TreeLocation, id?: string) {
		super(id ?? path.basename(location.root, path.extname(location.root)))
		this.root = location.root
		this.location = location
	}

	/** The JSON this store reads and writes. */
	get file(): string {
		return this.location.file
	}

	override get photoDir(): string | undefined {
		return this.location.photoDir
	}

	async read(): Promise<TreeSnapshot> {
		if (!(await exists(this.file))) return this.empty()

		const parsed = JSON.parse(
			await readTextFile(this.file),
		) as Partial<TreeSnapshot>

		return {
			// A file written before trees had metadata still loads: the id comes
			// from its filename and the name from the registry's migration. This
			// is also what lets someone hand-write or hand-edit a tree file.
			meta: { ...this.empty().meta, ...parsed.meta, id: this.id },
			people: parsed.people ?? [],
			unions: parsed.unions ?? [],
			unionChildren: parsed.unionChildren ?? [],
		}
	}

	protected async write(snapshot: TreeSnapshot): Promise<void> {
		await mkdir(path.dirname(this.file), { recursive: true, mode: DIR_MODE })
		await this.snapshotPrevious()
		const temp = `${this.file}.tmp`
		await writeTextFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`, {
			mode: FILE_MODE,
		})
		// Rename is atomic on the same filesystem, so a crash mid-write leaves
		// the previous good file rather than a truncated one.
		await rename(temp, this.file)
	}

	/**
	 * Keep a copy of what's on disk before replacing it, at most every
	 * `BACKUP_INTERVAL_MS`.
	 *
	 * The interval is the point. Typing a birth date is half a dozen mutations
	 * in a few seconds, and without it those would fill all twenty slots and
	 * push out the copy from before the mistake — leaving twenty ways to undo
	 * the last minute and none to undo the last hour. Rate-limited, the same
	 * twenty span a day's editing.
	 *
	 * Best-effort throughout: a full disk or a read-only backups directory is a
	 * reason to lose the safety net, not a reason to refuse the edit. Only
	 * bundles have anywhere to put these — a loose `.json` has no directory of
	 * its own and this app does not get to scatter files next to somebody's.
	 */
	private async snapshotPrevious(): Promise<void> {
		const { backupDir } = this.location
		if (!backupDir || !(await exists(this.file))) return

		try {
			await mkdir(backupDir, { recursive: true, mode: DIR_MODE })
			const existing = (await readDir(backupDir))
				.filter((entry) => !entry.isDirectory && entry.name.endsWith(".json"))
				.map((entry) => entry.name)
				.sort()

			const newest = existing.at(-1)
			if (newest) {
				const age =
					Date.now() - (await stat(path.join(backupDir, newest))).mtimeMs
				if (age < BACKUP_INTERVAL_MS) return
			}

			const stamp = now().replace(/[:.]/g, "-")
			await copyFile(this.file, path.join(backupDir, `${stamp}.json`))

			// One was just added, so trim against the list including it.
			const surplus = existing.length + 1 - KEEP_BACKUPS
			await Promise.all(
				existing
					.slice(0, Math.max(0, surplus))
					.map((name) => remove(path.join(backupDir, name))),
			)
		} catch {
			// Deliberately silent: the edit itself is what matters.
		}
	}
}
