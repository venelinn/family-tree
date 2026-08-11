import { Sprout, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/Button"
import { Callout } from "@/components/Callout"
import { Heading } from "@/components/Heading"
import OptionCard from "../OptionCard"
import type { StepProps } from "../types"
import styles from "./Step.module.scss"

/**
 * Start from yourself, or from nothing.
 *
 * "Empty" is a real option rather than a courtesy: someone building a tree from
 * an archive may want to start at a great-grandparent, and forcing them to
 * enter themselves first would put the wrong person at the root. It finishes
 * here — the empty state on the chart asks for the first person instead.
 */

interface StartStepProps extends StepProps {
	onSubmit: () => void
	pending: boolean
	error?: string
}

export function StartStep({
	data,
	onUpdate,
	onNext,
	onSubmit,
	pending,
	error,
}: StartStepProps) {
	const t = useTranslations("onboarding")
	const empty = data.startMode === "empty"

	return (
		<div className={styles.step}>
			<div className={styles.step__intro}>
				<Heading as="h1" size="h2">
					{t("startTitle")}
				</Heading>
				<p className={styles.step__help}>{t("startHelp")}</p>
			</div>

			<div className={styles.step__options}>
				<OptionCard
					icon={<UserPlus size={20} strokeWidth={1.75} />}
					label={t("startMe")}
					description={t("startMeHelp")}
					selected={!empty}
					onClick={() => onUpdate({ startMode: "me" })}
				/>
				<OptionCard
					icon={<Sprout size={20} strokeWidth={1.75} />}
					label={t("startEmpty")}
					description={t("startEmptyHelp")}
					selected={empty}
					onClick={() => onUpdate({ startMode: "empty" })}
				/>
			</div>

			<Callout tone="error">{error}</Callout>

			<Button
				label={
					pending ? t("creating") : empty ? t("createTree") : t("continue")
				}
				variant="primary"
				size="lg"
				disabled={pending}
				full
				onClick={empty ? onSubmit : onNext}
			/>
		</div>
	)
}

export default StartStep
