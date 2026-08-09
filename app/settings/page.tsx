import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { LanguagePicker } from "@/components/settings/LanguagePicker"

export default async function SettingsPage() {
	const t = await getTranslations("settings")
	const locale = await getLocale()

	return (
		<main className="min-h-screen bg-slate-50">
			<header className="border-slate-200 border-b bg-white px-5 py-3">
				<div className="mx-auto flex max-w-2xl items-center gap-3">
					<Link
						href="/"
						className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 text-sm hover:bg-slate-50"
					>
						<ArrowLeft size={15} strokeWidth={2} />
						{t("back")}
					</Link>
					<h1 className="font-semibold text-slate-900">{t("title")}</h1>
				</div>
			</header>

			<div className="mx-auto max-w-2xl px-5 py-8">
				<section className="rounded-xl border border-slate-200 bg-white p-5">
					<h2 className="font-semibold text-slate-900">{t("languageTitle")}</h2>
					<p className="mt-1 text-slate-500 text-sm">{t("languageHelp")}</p>
					<div className="mt-4">
						<LanguagePicker current={locale} />
					</div>
				</section>
			</div>
		</main>
	)
}
