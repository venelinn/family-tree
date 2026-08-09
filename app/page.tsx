import { getTranslations } from "next-intl/server"
import { TreeApp } from "@/components/tree/TreeApp"
import {
	loadFamilyGraph,
	ROOT_PERSON_ID,
	serializeFamilyGraph,
} from "@/lib/data"

export default async function HomePage() {
	const graph = await loadFamilyGraph()

	if (!graph.people.has(ROOT_PERSON_ID)) {
		const t = await getTranslations("errors")
		return (
			<main className="grid h-screen place-items-center text-slate-500">
				{t("rootMissing", { id: ROOT_PERSON_ID })}
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
