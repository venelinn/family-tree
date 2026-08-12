"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { Onboarding } from "@/components/Onboarding"
import { useTreeList } from "@/lib/client-data"

/**
 * First run, and "start another tree" afterwards.
 *
 * A route of its own rather than a branch inside `/`, so refreshing mid-wizard
 * doesn't drop you into somebody else's chart and the back button behaves.
 *
 * With trees already registered this redirects home unless `?new` is present —
 * otherwise a bookmark to `/welcome` would silently offer to build a second
 * tree to someone who just wanted the app.
 */

/**
 * `useSearchParams` forces a client-side bailout, which a static export refuses
 * to prerender without a boundary to fall back to. There is nothing worth
 * showing while it resolves — the wizard is one frame away and a placeholder
 * would flash — so the fallback is empty.
 */
export default function WelcomePage() {
	return (
		<Suspense fallback={null}>
			<Welcome />
		</Suspense>
	)
}

function Welcome() {
	const list = useTreeList()
	const params = useSearchParams()
	const router = useRouter()
	const wantsAnother = params.has("new")
	const hasTrees = (list?.trees.length ?? 0) > 0

	useEffect(() => {
		if (list && hasTrees && !wantsAnother) router.replace("/")
	}, [list, hasTrees, wantsAnother, router])

	// Still reading, or about to leave. Either way there is nothing to offer yet,
	// and rendering the wizard would show it for a frame to someone who already
	// has a tree.
	if (!list || (hasTrees && !wantsAnother)) return null

	return <Onboarding hasTrees={hasTrees} />
}
