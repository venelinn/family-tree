/**
 * Copy `_MARNM` out of a GEDCOM export into an existing tree, without touching
 * anything else.
 *
 *   pnpm backfill:married                       # dry run, prints what it would do
 *   pnpm backfill:married --write               # apply
 *   pnpm backfill:married --write data/x.ged <treeId>
 *
 * Why this exists rather than "just re-import": `pnpm import` replaces the store
 * wholesale and discards every edit made in the app. Married names were added to
 * the model after the first import, so the values are sitting in the export
 * while the tree that people actually use doesn't have them. This walks across
 * that gap one field wide.
 *
 * Only fills blanks. A married name already in the store wins — it was either
 * typed by hand or backfilled already, and neither should be overwritten by a
 * stale export.
 */

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { parseGedcomText } from "../lib/gedcom/parse-ged"
import { getTreeStore, listTrees } from "../lib/store/registry"

async function main() {
	const args = process.argv.slice(2)
	const write = args.includes("--write")
	const positional = args.filter((arg) => !arg.startsWith("--"))
	const input = positional[0] ?? "data/nikolov.ged"

	if (!existsSync(input)) {
		console.error(`No such file: ${input}`)
		process.exit(1)
	}

	const trees = await listTrees()
	const target = positional[1]
		? trees.find((tree) => tree.id === positional[1])
		: trees[0]

	if (!target) {
		console.error("No trees registered.")
		process.exit(1)
	}

	const store = await getTreeStore(target.id)
	if (!store) process.exit(1)

	const graph = parseGedcomText(await readFile(input, "utf8"))
	const snapshot = await store.read()

	const pending = snapshot.people.flatMap((person) => {
		const marriedName = graph.people.get(person.id)?.marriedName
		if (!marriedName || person.marriedName) return []
		return [{ person, marriedName }]
	})

	console.log(`"${target.name}" at ${target.file}`)
	for (const { person, marriedName } of pending) {
		console.log(`  ${person.fullName}  →  ${marriedName}`)
	}

	if (pending.length === 0) {
		console.log("Nothing to fill in.")
		return
	}

	if (!write) {
		console.log(`\n${pending.length} to fill in. Re-run with --write to apply.`)
		return
	}

	for (const { person, marriedName } of pending) {
		await store.updatePerson(person.id, { marriedName })
	}
	console.log(`\nFilled in ${pending.length} married names.`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
