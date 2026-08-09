/**
 * Pull every remote photo in a MyHeritage export down to `public/photos/` and
 * rewrite the export to point at the local copies.
 *
 * The exported URLs are signed and short-lived — the token carries an HMAC and
 * an expiry about a week after the export, and only MyHeritage can mint a new
 * one. There is no session or token to refresh, so the only way to keep photos
 * working is to stop depending on the CDN. Run this against a fresh export:
 *
 *   pnpm photos                       # data/nikolov.ged, in place
 *   pnpm photos --dry-run             # report what it would do, change nothing
 *   pnpm photos data/nikolov.json     # the older JSON export format
 *
 * Handles both the raw `.ged` and the JSON export. Safe to re-run: entries
 * already pointing at local files are left alone, files already on disk are not
 * refetched, and a URL that fails is left untouched so a later run can retry it.
 */

import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const PUBLIC_DIR = "public/photos"
/** Served path — what ends up in the export and in `<img src>`. */
const PUBLIC_PREFIX = "/photos"
const CONCURRENCY = 6

interface Job {
	url: string
	/** Path on disk to write to. */
	file: string
	/** Path to record in the export. */
	served: string
}

const isRemote = (value: string) => /^https?:\/\//i.test(value)

/** `@I85@` -> `I85`, so the id is usable in a filename. */
const slug = (id: string) => id.replace(/[^A-Za-z0-9]/g, "") || "unknown"

function extensionOf(url: string): string {
	const match = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)
	return match ? `.${match[1].toLowerCase()}` : ".jpg"
}

function makeJob(personId: string, index: number, url: string): Job {
	const name = `${slug(personId)}-${index}${extensionOf(url)}`
	return {
		url,
		file: path.join(PUBLIC_DIR, name),
		served: `${PUBLIC_PREFIX}/${name}`,
	}
}

/**
 * An export format knows how to find its photo URLs and how to put local paths
 * back. `rewrite` is only handed URLs that actually reached disk.
 */
interface Adapter {
	jobs: Map<string, Job>
	alreadyLocal: number
	rewrite(landed: Map<string, Job>): { text: string; count: number }
}

/* ------------------------------------------------------------------ *
 * GEDCOM (.ged) — line-oriented, so rewrite the FILE lines in place
 * ------------------------------------------------------------------ */

function gedcomAdapter(raw: string): Adapter {
	const lines = raw.split(/\r?\n/)
	const jobs = new Map<string, Job>()
	/** Which line each URL appears on; a URL may legitimately repeat. */
	const sites = new Map<string, number[]>()
	let alreadyLocal = 0

	let personId = "unknown"
	let photoIndex = 0

	lines.forEach((line, index) => {
		// A level-0 line ends whatever record we were inside.
		const record = /^0 @([^@]+)@ INDI/.exec(line)
		if (record) {
			personId = record[1]
			photoIndex = 0
			return
		}
		if (/^0 /.test(line)) {
			personId = "unknown"
			return
		}

		const file = /^(\d+) FILE (.+)$/.exec(line)
		if (!file) return
		const url = file[2].trim()

		if (!isRemote(url)) {
			// The HEAD record has a `1 FILE Exported by…` description line; only
			// count things that look like real media paths.
			if (url.startsWith(PUBLIC_PREFIX)) alreadyLocal++
			return
		}

		if (!jobs.has(url)) jobs.set(url, makeJob(personId, photoIndex, url))
		sites.set(url, [...(sites.get(url) ?? []), index])
		photoIndex++
	})

	return {
		jobs,
		alreadyLocal,
		rewrite(landed) {
			const next = [...lines]
			let count = 0
			for (const [url, job] of landed) {
				for (const index of sites.get(url) ?? []) {
					const level = /^(\d+) /.exec(next[index])?.[1] ?? "2"
					next[index] = `${level} FILE ${job.served}`
					count++
				}
			}
			return { text: next.join("\n"), count }
		},
	}
}

/* ------------------------------------------------------------------ *
 * JSON export — `Individuals[].Object.File`, string or array
 * ------------------------------------------------------------------ */

interface JsonIndividual {
	Id: string
	Object?: { File?: string | string[] }
}
interface JsonExport {
	Individuals: JsonIndividual[]
	[key: string]: unknown
}

function jsonAdapter(raw: string): Adapter {
	const data = JSON.parse(raw) as JsonExport
	const jobs = new Map<string, Job>()
	let alreadyLocal = 0

	for (const individual of data.Individuals ?? []) {
		const files = individual.Object?.File
		if (!files) continue
		for (const [index, url] of [files].flat().entries()) {
			if (!isRemote(url)) {
				alreadyLocal++
				continue
			}
			if (!jobs.has(url)) jobs.set(url, makeJob(individual.Id, index, url))
		}
	}

	return {
		jobs,
		alreadyLocal,
		rewrite(landed) {
			let count = 0
			for (const individual of data.Individuals ?? []) {
				const files = individual.Object?.File
				if (!files || !individual.Object) continue

				const wasArray = Array.isArray(files)
				const next = [files].flat().map((url) => {
					const job = landed.get(url)
					if (!job) return url
					count++
					return job.served
				})
				individual.Object.File = wasArray ? next : next[0]
			}
			return { text: `${JSON.stringify(data, null, 2)}\n`, count }
		},
	}
}

/* ------------------------------------------------------------------ */

/** Run `worker` over `items`, at most `limit` at a time. */
async function pooled<T>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<void>,
): Promise<void> {
	let cursor = 0
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () =>
			(async () => {
				while (cursor < items.length) await worker(items[cursor++])
			})(),
		),
	)
}

async function main() {
	const args = process.argv.slice(2)
	const dryRun = args.includes("--dry-run")
	const input = args.find((arg) => !arg.startsWith("--")) ?? "data/nikolov.ged"

	if (!existsSync(input)) {
		console.error(`No such file: ${input}`)
		process.exit(1)
	}

	const raw = await readFile(input, "utf8")
	const adapter = input.toLowerCase().endsWith(".json")
		? jsonAdapter(raw)
		: gedcomAdapter(raw)

	const { jobs, alreadyLocal } = adapter
	console.log(
		`${input}: ${jobs.size} remote photo(s), ${alreadyLocal} already local`,
	)
	if (jobs.size === 0) {
		console.log("Nothing to do.")
		return
	}

	if (dryRun) {
		for (const job of jobs.values()) console.log(`  would fetch -> ${job.file}`)
		console.log("\nDry run: no files written.")
		return
	}

	await mkdir(PUBLIC_DIR, { recursive: true })

	const failures: Array<{ url: string; reason: string }> = []
	let fetched = 0
	let reused = 0

	await pooled([...jobs.values()], CONCURRENCY, async (job) => {
		// Already on disk from an earlier run — don't refetch.
		if (existsSync(job.file) && (await stat(job.file)).size > 0) {
			reused++
			return
		}
		try {
			const response = await fetch(job.url)
			if (!response.ok) {
				failures.push({ url: job.url, reason: `HTTP ${response.status}` })
				return
			}
			const body = Buffer.from(await response.arrayBuffer())
			if (body.length === 0) {
				failures.push({ url: job.url, reason: "empty response" })
				return
			}
			await writeFile(job.file, body)
			fetched++
		} catch (error) {
			failures.push({
				url: job.url,
				reason: error instanceof Error ? error.message : String(error),
			})
		}
	})

	console.log(
		`Downloaded ${fetched}, reused ${reused}, failed ${failures.length}`,
	)

	// Only rewrite entries whose file actually reached disk, so a partial run can
	// be repeated rather than leaving the export pointing at nothing.
	const landed = new Map([...jobs].filter(([, job]) => existsSync(job.file)))
	const { text, count } = adapter.rewrite(landed)

	if (count > 0) {
		// Keep the pristine export around — but only overwrite the backup when
		// there was something to change, so re-running never clobbers it with an
		// already-localised copy.
		await copyFile(input, `${input}.bak`)
		await writeFile(input, text)
		console.log(
			`Rewrote ${count} reference(s) in ${input} (backup: ${input}.bak)`,
		)
	}

	if (failures.length > 0) {
		console.log(`\n${failures.length} failed:`)
		for (const { url, reason } of failures.slice(0, 10)) {
			console.log(`  ${reason}  ${url.slice(0, 90)}…`)
		}
		if (failures.some((failure) => failure.reason.includes("403"))) {
			console.log(
				"\n403 means the signed URLs have expired. Re-export from MyHeritage\n" +
					"and run this again — the signatures are only valid about a week.",
			)
		}
		process.exitCode = 1
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
