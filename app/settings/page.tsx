import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { LanguagePicker } from "@/components/LanguagePicker"
import { NameLanguagePicker } from "@/components/NameLanguagePicker"
import { ThemePicker } from "@/components/ThemePicker"
import { TreeManager } from "@/components/TreeManager"
import { getActiveTree } from "@/lib/active-tree"
import { getNamesFollowLanguage } from "@/lib/name-language"
import { listTrees } from "@/lib/store/registry"
import { getUserTheme } from "@/lib/theme"

export default async function SettingsPage() {
	const t = await getTranslations("settings")
	const locale = await getLocale()
	const theme = await getUserTheme()
	const trees = await listTrees()
	const active = await getActiveTree()
	const namesFollowLanguage = await getNamesFollowLanguage()

	return (
		<main className="min-h-screen bg-surface">
			<header className="border-line border-b bg-panel px-5 py-3">
				<div className="mx-auto flex max-w-2xl items-center gap-3">
					<Link
						href="/"
						className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft text-sm hover:bg-wash"
					>
						<ArrowLeft size={15} strokeWidth={2} />
						{t("back")}
					</Link>
					<h1 className="font-semibold text-ink">{t("title")}</h1>
				</div>
			</header>

			<div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-8">
				<section className="rounded-xl border border-line bg-panel p-5">
					<h2 className="font-semibold text-ink">{t("treesTitle")}</h2>
					<p className="mt-1 text-ink-muted text-sm">{t("treesHelp")}</p>
					<div className="mt-4">
						<TreeManager trees={trees} activeId={active?.id} />
					</div>
				</section>

				<section className="rounded-xl border border-line bg-panel p-5">
					<h2 className="font-semibold text-ink">{t("themeTitle")}</h2>
					<p className="mt-1 text-ink-muted text-sm">{t("themeHelp")}</p>
					<div className="mt-4">
						<ThemePicker current={theme} />
					</div>
				</section>

				<section className="rounded-xl border border-line bg-panel p-5">
					<h2 className="font-semibold text-ink">{t("languageTitle")}</h2>
					<p className="mt-1 text-ink-muted text-sm">{t("languageHelp")}</p>
					<div className="mt-4">
						<LanguagePicker current={locale} />
					</div>
				</section>

				{/* Directly under the language, because it only means anything in
				    relation to it. */}
				<section className="rounded-xl border border-line bg-panel p-5">
					<h2 className="font-semibold text-ink">{t("namesTitle")}</h2>
					<p className="mt-1 text-ink-muted text-sm">{t("namesHelp")}</p>
					<div className="mt-4">
						<NameLanguagePicker current={namesFollowLanguage} />
					</div>
				</section>
			</div>
		</main>
	)
}
