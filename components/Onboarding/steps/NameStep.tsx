import { useTranslations } from "next-intl"
import { Button } from "@/components/Button"
import { Input } from "@/components/Forms"
import { Heading } from "@/components/Heading"
import type { StepProps } from "../types"
import styles from "./Step.module.scss"

/** What to call this tree. It becomes `meta.name` inside the file. */
export function NameStep({ data, onUpdate, onNext }: StepProps) {
	const t = useTranslations("onboarding")
	const name = data.treeName.trim()

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				if (name) onNext()
			}}
			className={styles.step}
		>
			<div className={styles.step__intro}>
				<Heading as="h1" size="h2">
					{t("nameTitle")}
				</Heading>
				<p className={styles.step__help}>{t("nameHelp")}</p>
			</div>

			<Input
				label={t("nameTitle")}
				autoFocus
				required
				inputSize="lg"
				value={data.treeName}
				onChange={(event) => onUpdate({ treeName: event.target.value })}
				placeholder={t("namePlaceholder")}
				full
			/>

			<Button
				type="submit"
				label={t("continue")}
				variant="primary"
				size="lg"
				disabled={!name}
				full
			/>
		</form>
	)
}

export default NameStep
