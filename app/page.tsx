"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { EmptyTree } from "@/components/EmptyTree"
import { MissingTree } from "@/components/MissingTree"
import { TreeApp } from "@/components/TreeApp"
import { useActiveTree } from "@/lib/client-data"
import { serializeFamilyGraph } from "@/lib/data"
import { useNamesFollowLanguage } from "@/lib/name-language"

/**
 * The chart, or the reason there isn't one.
 *
 * Which tree this is comes from the registry and a stored id rather than a
 * constant, and the person it opens on comes from that tree's own metadata —
 * see `lib/data.ts`.
 *
 * A client component because the store runs in the browser now. The tree is read
 * after mount rather than during a server render, which is why there is a
 * loading state here that did not exist before: `undefined` is "still reading",
 * and it is deliberately not collapsed into "no tree" — doing so would flash
 * onboarding at somebody who has 253 people on disk.
 */

export default function HomePage() {
	const active = useActiveTree()
	const [namesFollowLanguage] = useNamesFollowLanguage()
	const router = useRouter()

	// Nothing set up yet: this is a first run. In an effect rather than inline
	// because a router push during render is a React error, and `redirect()` is
	// a server-side API with nothing to redirect here.
	useEffect(() => {
		if (active?.status === "none") router.replace("/welcome")
	}, [active?.status, router])

	// Still reading. Rendering nothing beats rendering a guess — see above.
	if (!active || active.status === "none") return null

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
			namesFollowLanguage={namesFollowLanguage}
		/>
	)
}
