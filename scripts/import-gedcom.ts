/**
 * Seed the editable store from a MyHeritage GEDCOM export.
 *
 *   pnpm import                     # data/nikolov.ged -> data/tree.json
 *   pnpm import data/other.ged
 *
 * This is a ONE-WAY import, and running it again replaces the store wholesale.
 * Once you start editing in the app, the store is the system of record and the
 * .ged is just where it came from — re-importing would discard your edits.
 * Two-way sync with MyHeritage is deliberately not attempted: reconciling two
 * independently-edited family graphs is a genuinely hard merge problem, not a
 * missing feature.
 */

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { parseGedcomText } from "../lib/gedcom/parse-ged"
import { LocalTreeStore } from "../lib/store/local"
import type {
	PersonRecord,
	TreeSnapshot,
	UnionChildRecord,
	UnionRecord,
} from "../lib/store/types"

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
		sex: person.sex,
		birthDate: person.birthDate,
		birthPlace: person.birthPlace,
		deathDate: person.deathDate,
		deathPlace: person.deathPlace,
		deceased: person.deceased,
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

	const snapshot: TreeSnapshot = { people, unions, unionChildren }
	const target = path.join(process.cwd(), "data", "tree.json")

	if (existsSync(target)) {
		console.log(`Replacing existing store at ${target}`)
	}
	await new LocalTreeStore(target).replaceAll(snapshot)

	const withPhotos = people.filter((person) => person.photos.length > 0).length
	console.log(
		`Imported ${people.length} people, ${unions.length} unions, ` +
			`${unionChildren.length} parent-child links (${withPhotos} with photos)`,
	)
	console.log(`-> ${target}`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
