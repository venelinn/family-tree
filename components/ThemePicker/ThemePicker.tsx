"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { ChoiceList } from "@/components/ChoiceList"
import { setUserTheme } from "@/lib/theme-actions"
import { type ThemePreference, theming } from "@/lib/theming"

/**
 * Picks the colour theme.
 *
 * Same shape as `LanguagePicker`, and for the same reason: the write is a server
 * action, so the response carries a fresh render with the new `data-theme` on
 * `<html>` — the page changes theme without a client-side navigation.
 *
 * There is deliberately no client-side toggle that writes the attribute
 * directly. It would be faster by a round trip, but it would also mean the
 * theme lived in two places — the DOM and the cookie — and the next server
 * render would be the one that's wrong.
 */

const ICONS: Record<ThemePreference, typeof Monitor> = {
	system: Monitor,
	light: Sun,
	dark: Moon,
}

// `as const` rather than annotated `Record<ThemePreference, string>`: next-intl
// types `t()` against the catalogue, so it needs the literal key, not `string`.
const LABEL_KEYS = {
	system: "themeSystem",
	light: "themeLight",
	dark: "themeDark",
} as const satisfies Record<ThemePreference, string>

export function ThemePicker({ current }: { current: ThemePreference }) {
	const t = useTranslations("settings")
	const [pending, startTransition] = useTransition()

	const choose = (theme: ThemePreference) => {
		if (theme === current) return
		startTransition(async () => {
			await setUserTheme(theme)
		})
	}

	return (
		<ChoiceList
			items={theming.themes.map((theme) => {
				const Icon = ICONS[theme]
				return {
					value: theme,
					label: t(LABEL_KEYS[theme]),
					hint: theme === "system" ? t("themeSystemHint") : undefined,
					icon: <Icon size={16} strokeWidth={2} />,
				}
			})}
			current={current}
			onChoose={choose}
			disabled={pending}
		/>
	)
}
