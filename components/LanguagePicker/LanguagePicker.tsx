"use client"

import { ChoiceList } from "@/components/ChoiceList"
import { useLocale } from "@/lib/locale"
import { type Locale, localeNames, localization } from "@/lib/localization"

/**
 * Picks the interface language.
 *
 * Writing it used to be a server action, so the response carried a fresh render
 * of the route in the new language. Now the catalogue is swapped client-side by
 * the provider in `app/layout.tsx`, which watches the same stored value this
 * writes — so the page re-renders in place, with no navigation and no round
 * trip. Every other route reads the same key on mount.
 */
export function LanguagePicker() {
	const [current, setLocale] = useLocale()

	return (
		<ChoiceList
			items={localization.locales.map((locale) => ({
				value: locale as string,
				label: localeNames[locale],
				badge: locale,
			}))}
			current={current}
			onChoose={(locale) => setLocale(locale as Locale)}
		/>
	)
}
