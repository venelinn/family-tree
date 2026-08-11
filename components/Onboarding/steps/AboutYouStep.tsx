import { useTranslations } from "next-intl"
import { PersonForm } from "@/components/PersonForm"
import type { PersonFormValues } from "@/lib/actions"
import type { StepProps } from "../types"

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
		<div className="mx-auto flex max-w-xl flex-col gap-4">
			<div className="text-center">
				<h1 className="font-semibold text-2xl text-ink tracking-tight">
					{t("youTitle")}
				</h1>
				<p className="mt-2 text-ink-muted">{t("youHelp")}</p>
			</div>

			<div className="rounded-2xl border border-line bg-panel">
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
