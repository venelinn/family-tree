import { useTranslations } from "next-intl"
import { LanguagePicker } from "@/components/LanguagePicker"
import { ThemePicker } from "@/components/ThemePicker"
import type { ThemePreference } from "@/lib/theming"
import type { StepProps } from "../types"

/**
 * Language and theme, using the very same pickers as `/settings`.
 *
 * Deliberately not reimplemented: each picker writes its cookie through a
 * server action and the response re-renders this route, so the wizard changes
 * language under you as you pick — which is the only way to tell you picked the
 * right one. The wizard's own state lives in a component that stays mounted
 * across that re-render, so nothing is lost.
 */

interface PreferencesStepProps extends StepProps {
	locale: string
	theme: ThemePreference
}

export function PreferencesStep({
	onNext,
	locale,
	theme,
}: PreferencesStepProps) {
	const t = useTranslations("onboarding")

	return (
		<div className="mx-auto flex max-w-xl flex-col gap-6">
			<div className="text-center">
				<h1 className="font-semibold text-2xl text-ink tracking-tight">
					{t("preferencesTitle")}
				</h1>
				<p className="mt-2 text-ink-muted">{t("preferencesHelp")}</p>
			</div>

			<section className="flex flex-col gap-3">
				<h2 className="font-medium text-[11px] text-ink-muted uppercase tracking-wide">
					{t("preferencesLanguage")}
				</h2>
				<LanguagePicker current={locale} />
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="font-medium text-[11px] text-ink-muted uppercase tracking-wide">
					{t("preferencesTheme")}
				</h2>
				<ThemePicker current={theme} />
			</section>

			<button
				type="button"
				onClick={onNext}
				className="rounded-xl bg-invert px-4 py-3 font-medium text-on-invert hover:bg-invert-hover"
			>
				{t("continue")}
			</button>
		</div>
	)
}

export default PreferencesStep
