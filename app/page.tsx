import { redirect } from "next/navigation"
import { EmptyTree } from "@/components/EmptyTree"
import { MissingTree } from "@/components/MissingTree"
import { TreeApp } from "@/components/TreeApp"
import { loadActiveTree, serializeFamilyGraph } from "@/lib/data"
import { getNamesFollowLanguage } from "@/lib/name-language"
import { getUserTheme } from "@/lib/theme"

/**
 * The chart, or the reason there isn't one.
 *
 * Which tree this is comes from the registry and a cookie rather than a
 * constant, and the person it opens on comes from that tree's own metadata —
 * see `lib/data.ts`.
 */

export default async function HomePage() {
	const active = await loadActiveTree()
	const theme = await getUserTheme()
	const namesFollowLanguage = await getNamesFollowLanguage()

	// Nothing set up yet: this is a first run.
	if (active.status === "none") redirect("/welcome")

	if (active.status === "missing") {
		return <MissingTree name={active.meta.name} file={active.meta.file} />
	}

	const { meta, graph } = active
	const rootId = meta.rootPersonId

	// A tree can legitimately have nobody in it — "start empty" in onboarding —
	// and there is no chart to draw until someone is.
	if (!rootId || !graph.people.has(rootId)) {
		return <EmptyTree treeName={meta.name} />
	}

	return (
		<TreeApp
			graph={serializeFamilyGraph(graph)}
			homePersonId={rootId}
			treeName={meta.name}
			theme={theme}
			namesFollowLanguage={namesFollowLanguage}
		/>
	)
}
