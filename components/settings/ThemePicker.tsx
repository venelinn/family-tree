"use client"

import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
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
		<ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line">
			{theming.themes.map((theme) => {
				const active = theme === current
				const Icon = ICONS[theme]
				return (
					<li key={theme}>
						<button
							type="button"
							onClick={() => choose(theme)}
							disabled={pending}
							aria-current={active ? "true" : undefined}
							className={`flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60 ${
								active ? "bg-root-soft" : "hover:bg-wash"
							}`}
						>
							<Icon
								size={16}
								strokeWidth={2}
								className={active ? "text-root-ink" : "text-ink-faint"}
							/>
							<span className="flex-1">
								<span className="block font-medium text-ink-soft text-sm">
									{t(LABEL_KEYS[theme])}
								</span>
								{theme === "system" ? (
									<span className="block text-ink-faint text-xs">
										{t("themeSystemHint")}
									</span>
								) : null}
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
