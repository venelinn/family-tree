"use client"

import { Check, Languages, Type } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { setNamesFollowLanguage } from "@/lib/name-language-actions"

/**
 * Picks whether people's names follow the interface language.
 *
 * Same shape as `ThemePicker` and `LanguagePicker`, and for the same reason:
 * the write is a server action, so the response carries a fresh render and the
 * preference never lives in two places at once.
 */

const OPTIONS = [
	{
		follow: true,
		icon: Languages,
		labelKey: "namesFollow",
		hintKey: "namesFollowHint",
	},
	{
		follow: false,
		icon: Type,
		labelKey: "namesAsEntered",
		hintKey: "namesAsEnteredHint",
	},
] as const

export function NameLanguagePicker({ current }: { current: boolean }) {
	const t = useTranslations("settings")
	const [pending, startTransition] = useTransition()

	const choose = (follow: boolean) => {
		if (follow === current) return
		startTransition(async () => {
			await setNamesFollowLanguage(follow)
		})
	}

	return (
		<ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line">
			{OPTIONS.map(({ follow, icon: Icon, labelKey, hintKey }) => {
				const active = follow === current
				return (
					<li key={labelKey}>
						<button
							type="button"
							onClick={() => choose(follow)}
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
									{t(labelKey)}
								</span>
								<span className="block text-ink-faint text-xs">
									{t(hintKey)}
								</span>
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
