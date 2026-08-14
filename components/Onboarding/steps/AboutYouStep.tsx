import clsx from "clsx"
import { useTranslations } from "next-intl"
import { Heading } from "@/components/Heading"
import { PersonForm } from "@/components/PersonForm"
import type { PersonFormValues } from "@/lib/actions"
import type { StepProps } from "../types"
import styles from "./Step.module.scss"

/**
 * The first person in the tree, and the one every chart opens on.
 *
 * `PersonForm` is reused rather than rewritten — it already handles the things
 * that took thought: sex as a required choice (the union model has a husband
 * seat and a wife seat), and free-text dates, because a family record says
 * "about 1910" as often as it gives a day.
 */

interface AboutYouStepProps extends StepProps {
	onSubmit: (values: PersonFormValues) => void
	pending: boolean
	error?: string
}

export function AboutYouStep({
	onSubmit,
	onBack,
	pending,
	error,
}: AboutYouStepProps) {
	const t = useTranslations("onboarding")

	return (
		<div className={clsx(styles.step, styles["step--form"])}>
			<div className={styles.step__intro}>
				<Heading as="h1" size="h2">
					{t("youTitle")}
				</Heading>
				<p className={styles.step__help}>{t("youHelp")}</p>
			</div>

			<div className={styles.step__card}>
				<PersonForm
					title={t("youFormTitle")}
					submitLabel={pending ? t("creating") : t("createTree")}
					pending={pending}
					error={error}
					onSubmit={onSubmit}
					onCancel={onBack}
				/>
			</div>
		</div>
	)
}

export default AboutYouStep
