import { useTranslations } from "next-intl"
import { Button } from "@/components/Button"
import { Heading } from "@/components/Heading"
import { LanguagePicker } from "@/components/LanguagePicker"
import { ThemePicker } from "@/components/ThemePicker"
import type { StepProps } from "../types"
import styles from "./Step.module.scss"

/**
 * Language and theme, using the very same pickers as `/settings`.
 *
 * Deliberately not reimplemented, and the wizard still changes language under
 * you as you pick — which is the only way to tell you picked the right one. It
 * used to do that by way of a server action re-rendering the route; now the
 * provider in `app/layout.tsx` swaps the catalogue in place, so the wizard's
 * own state is not merely preserved across the change but never unmounted.
 */
export function PreferencesStep({ onNext }: StepProps) {
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
				<LanguagePicker />
			</section>

			<section className={styles.step__section}>
				<Heading as="h2" size="base" className={styles.step__sectionTitle}>
					{t("preferencesTheme")}
				</Heading>
				<ThemePicker />
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
