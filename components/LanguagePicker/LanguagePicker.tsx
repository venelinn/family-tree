"use client"

import { Check } from "lucide-react"
import { useTransition } from "react"
import { setUserLocale } from "@/lib/locale-actions"
import { type Locale, localeNames, localization } from "@/lib/localization"

/**
 * Picks the interface language.
 *
 * Writing the cookie is a server action, so the response carries a fresh render
 * of this route — the page comes back in the new language without a client-side
 * navigation, and every other route picks it up on its next request.
 */
export function LanguagePicker({ current }: { current: string }) {
	const [pending, startTransition] = useTransition()

	const choose = (locale: Locale) => {
		if (locale === current) return
		startTransition(async () => {
			await setUserLocale(locale)
		})
	}

	return (
		<ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line">
			{localization.locales.map((locale) => {
				const active = locale === current
				return (
					<li key={locale}>
						<button
							type="button"
							onClick={() => choose(locale)}
							disabled={pending}
							aria-current={active ? "true" : undefined}
							className={`flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60 ${
								active ? "bg-root-soft" : "hover:bg-wash"
							}`}
						>
							<span className="flex-1 font-medium text-ink-soft text-sm">
								{localeNames[locale]}
							</span>
							<span className="font-medium text-[11px] text-ink-faint uppercase">
								{locale}
							</span>
							{active ? (
								<Check size={16} strokeWidth={2.5} className="text-root-ink" />
							) : (
								// Keeps the rows the same width whether ticked or not.
								<span className="h-4 w-4" />
							)}
						</button>
					</li>
				)
			})}
		</ul>
	)
}
