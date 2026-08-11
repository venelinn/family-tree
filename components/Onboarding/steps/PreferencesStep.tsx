import { useTranslations } from "next-intl"
import { Button } from "@/components/Button"
import { Heading } from "@/components/Heading"
import { LanguagePicker } from "@/components/LanguagePicker"
import { ThemePicker } from "@/components/ThemePicker"
import type { ThemePreference } from "@/lib/theming"
import type { StepProps } from "../types"
import styles from "./Step.module.scss"

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
		<div className={styles.step}>
			<div className={styles.step__intro}>
				<Heading as="h1" size="h2">
					{t("preferencesTitle")}
				</Heading>
				<p className={styles.step__help}>{t("preferencesHelp")}</p>
			</div>

			<section className={styles.step__section}>
				<Heading as="h2" size="base" className={styles.step__sectionTitle}>
					{t("preferencesLanguage")}
				</Heading>
				<LanguagePicker current={locale} />
			</section>

			<section className={styles.step__section}>
				<Heading as="h2" size="base" className={styles.step__sectionTitle}>
					{t("preferencesTheme")}
				</Heading>
				<ThemePicker current={theme} />
			</section>

			<Button
				label={t("continue")}
				variant="primary"
				size="lg"
				full
				onClick={onNext}
			/>
		</div>
	)
}

export default PreferencesStep
