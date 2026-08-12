"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { ChoiceList } from "@/components/ChoiceList"
import { applyTheme, useTheme } from "@/lib/theme"
import { type ThemePreference, theming } from "@/lib/theming"

/**
 * Picks the colour theme.
 *
 * This used to write a cookie through a server action, so the response carried a
 * fresh render with the new `data-theme` on `<html>`, and the comment here
 * warned against a client-side toggle on the grounds that the theme would then
 * live in two places — the DOM and the cookie — with the next server render
 * being the one that's wrong.
 *
 * There is no server render any more, so there is no second place: the stored
 * preference *is* the truth, and `applyTheme` stamps the attribute from it. What
 * the old note was really guarding against — two writers disagreeing — is
 * handled by there being exactly one, in `lib/theme.ts`.
 *
 * It reads its own value now rather than taking one as a prop; a preference this
 * component owns the write for is not something a page should have to thread in.
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

export function ThemePicker() {
	const t = useTranslations("settings")
	const [current, setTheme] = useTheme()

	const choose = (theme: ThemePreference) => {
		if (theme === current) return
		setTheme(theme)
		// Synchronously, so the swatch you just pressed is recoloured in the same
		// frame as the press rather than one repaint later.
		applyTheme(theme)
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
		/>
	)
}
