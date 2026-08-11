/**
 * Seed a tree from a MyHeritage GEDCOM export.
 *
 *   pnpm import                          # data/nikolov.ged -> the active tree
 *   pnpm import data/other.ged
 *   pnpm import data/other.ged <treeId>  # a specific tree
 *
 * The target is a registered tree, not a fixed file, because a tree's file can
 * live anywhere now — see `lib/store/registry.ts`. With no id it fills the
 * first registered tree; with no trees at all it says so, because creating one
 * silently would put family data somewhere nobody chose.
 *
 * This is a ONE-WAY import, and running it again replaces the store wholesale.
 * Once you start editing in the app, the store is the system of record and the
 * .ged is just where it came from — re-importing would discard your edits.
 * Two-way sync with MyHeritage is deliberately not attempted: reconciling two
 * independently-edited family graphs is a genuinely hard merge problem, not a
 * missing feature.
 */

import { existsSync } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { parseGedcomText } from "../lib/gedcom/parse-ged"
import { ingestServedPhotos } from "../lib/photos"
import { DIR_MODE } from "../lib/store/bundle"
import { setFs } from "../lib/store/fs"
import { nodeFs } from "../lib/store/fs.node"
import { getTreeStore, listTrees } from "../lib/store/registry"
import type {
	PersonRecord,
	TreeRows,
	UnionChildRecord,
	UnionRecord,
} from "../lib/store/types"

// The store has no filesystem of its own — the app installs Tauri's, and a
// script installs Node's. Must happen before anything touches the registry.
// See `lib/store/fs.ts`.
setFs(nodeFs)

async function main() {
	const input = process.argv[2] ?? "data/nikolov.ged"
	if (!existsSync(input)) {
		console.error(`No such file: ${input}`)
		process.exit(1)
	}

	const graph = parseGedcomText(await readFile(input, "utf8"))
	const updatedAt = new Date().toISOString()

	const people: PersonRecord[] = [...graph.people.values()].map((person) => ({
		id: person.id,
		fullName: person.name,
		givenName: person.givenName,
		surname: person.surname,
		marriedName: person.marriedName,
		sex: person.sex,
		birthDate: person.birthDate,
		birthPlace: person.birthPlace,
		deathDate: person.deathDate,
		deathPlace: person.deathPlace,
		deceased: person.deceased,
		note: person.note,
		photos: person.photos,
		updatedAt,
	}))

	const unions: UnionRecord[] = [...graph.unions.values()].map((union) => ({
		id: union.id,
		husbandId: union.husbandId,
		wifeId: union.wifeId,
		marriageDate: union.marriageDate,
		marriagePlace: union.marriagePlace,
		divorced: union.divorced,
		updatedAt,
	}))

	const unionChildren: UnionChildRecord[] = [...graph.unions.values()].flatMap(
		(union) =>
			union.childIds.map((childId, position) => ({
				unionId: union.id,
				childId,
				position,
			})),
	)

	const rows: TreeRows = { people, unions, unionChildren }

	const trees = await listTrees()
	const target = process.argv[3]
		? trees.find((tree) => tree.id === process.argv[3])
		: trees[0]

	if (!target) {
		console.error(
			process.argv[3]
				? `No tree with id ${process.argv[3]}. Registered: ${trees.map((tree) => tree.id).join(", ") || "none"}`
				: "No trees yet — run the app and create one first, so you choose where the file goes.",
		)
		process.exit(1)
	}

	const store = await getTreeStore(target.id)
	if (!store) process.exit(1)

	console.log(`Replacing the contents of "${target.name}" at ${target.file}`)

	// `pnpm photos` leaves the export pointing at `public/photos/…`. A bundle
	// keeps its pictures with it, so take them in now — stripped of their
	// metadata on the way — rather than importing paths into somebody else's
	// directory. A tree that is still a loose file has nowhere to put them and
	// keeps the served paths, exactly as before.
	const { photoDir } = store.location
	let ingested: { copied: number; missing: number } | undefined
	if (photoDir) {
		await mkdir(photoDir, { recursive: true, mode: DIR_MODE })
		ingested = await ingestServedPhotos(photoDir, rows.people)
	}

	await store.replaceAll(rows)
	// The GEDCOM ids are stable, so the person the chart opened on survives a
	// re-import; if they didn't, `replaceAll` has already cleared the root.
	const snapshot = await store.read()
	if (!snapshot.meta.rootPersonId && people[0]) {
		await store.updateMeta({ rootPersonId: people[0].id })
	}

	const withPhotos = people.filter((person) => person.photos.length > 0).length
	console.log(
		`Imported ${people.length} people, ${unions.length} unions, ` +
			`${unionChildren.length} parent-child links (${withPhotos} with photos)`,
	)
	if (ingested) {
		console.log(
			`Stored ${ingested.copied} photos in the bundle` +
				(ingested.missing ? `, skipped ${ingested.missing} not found` : ""),
		)
	}
	console.log(`-> ${target.file}`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
