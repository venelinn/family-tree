"use client"

import { useTransition } from "react"
import { ChoiceList } from "@/components/ChoiceList"
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
		<ChoiceList
			items={localization.locales.map((locale) => ({
				value: locale as string,
				label: localeNames[locale],
				badge: locale,
			}))}
			current={current}
			onChoose={(locale) => choose(locale as Locale)}
			disabled={pending}
		/>
	)
}
