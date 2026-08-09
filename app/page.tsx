import { TreeApp } from "@/components/tree/TreeApp"
import {
	loadFamilyGraph,
	ROOT_PERSON_ID,
	serializeFamilyGraph,
} from "@/lib/data"

export default async function HomePage() {
	const graph = await loadFamilyGraph()

	if (!graph.people.has(ROOT_PERSON_ID)) {
		return (
			<main className="grid h-screen place-items-center text-slate-500">
				Could not find the root person ({ROOT_PERSON_ID}) in the family data.
			</main>
		)
	}

	return (
		<TreeApp
			graph={serializeFamilyGraph(graph)}
			homePersonId={ROOT_PERSON_ID}
		/>
	)
}
