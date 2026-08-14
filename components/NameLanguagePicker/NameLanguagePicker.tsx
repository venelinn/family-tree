"use client"

import { Languages, Type } from "lucide-react"
import { useTranslations } from "next-intl"
import { ChoiceList } from "@/components/ChoiceList"
import { useNamesFollowLanguage } from "@/lib/name-language"

/**
 * Picks whether people's names follow the interface language.
 *
 * Same shape as `ThemePicker` and `LanguagePicker`: it owns both halves of its
 * preference, reading and writing the one stored value rather than taking the
 * current one as a prop.
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

export function NameLanguagePicker() {
	const t = useTranslations("settings")
	const [current, setFollow] = useNamesFollowLanguage()

	return (
		<ChoiceList
			items={OPTIONS.map(({ follow, icon: Icon, labelKey, hintKey }) => ({
				value: follow,
				label: t(labelKey),
				hint: t(hintKey),
				icon: <Icon size={16} strokeWidth={2} />,
			}))}
			current={current}
			onChoose={setFollow}
		/>
	)
}
