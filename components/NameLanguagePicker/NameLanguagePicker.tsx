"use client"

import { Languages, Type } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { ChoiceList } from "@/components/ChoiceList"
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
		<ChoiceList
			items={OPTIONS.map(({ follow, icon: Icon, labelKey, hintKey }) => ({
				value: follow,
				label: t(labelKey),
				hint: t(hintKey),
				icon: <Icon size={16} strokeWidth={2} />,
			}))}
			current={current}
			onChoose={choose}
			disabled={pending}
		/>
	)
}
