import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"
import { Onboarding } from "@/components/Onboarding"
import { defaultTreeDir, listTrees } from "@/lib/store/registry"
import { getUserTheme } from "@/lib/theme"

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

export default async function WelcomePage({
	searchParams,
}: {
	searchParams: Promise<{ new?: string }>
}) {
	const trees = await listTrees()
	const wantsAnother = "new" in (await searchParams)

	if (trees.length > 0 && !wantsAnother) redirect("/")

	return (
		<Onboarding
			defaultDir={defaultTreeDir()}
			locale={await getLocale()}
			theme={await getUserTheme()}
			hasTrees={trees.length > 0}
		/>
	)
}
