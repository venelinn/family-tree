import { Settings } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { EmptyTree } from "@/components/EmptyTree"
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
		const t = await getTranslations("errors")
		return (
			<main className="grid min-h-screen place-items-center bg-surface px-6">
				<div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-line bg-panel px-6 py-8 text-center">
					<p className="text-ink">
						{t("treeFileMissing", { name: active.meta.name })}
					</p>
					<code className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-ink-soft text-xs">
						{active.meta.file}
					</code>
					<Link
						href="/settings"
						className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft text-sm hover:bg-wash"
					>
						<Settings size={14} strokeWidth={2} />
						{t("treeFileMissingAction")}
					</Link>
				</div>
			</main>
		)
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
