import { Sprout, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import OptionCard from "../OptionCard"
import type { StepProps } from "../types"

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
		<div className="mx-auto flex max-w-xl flex-col gap-6">
			<div className="text-center">
				<h1 className="font-semibold text-2xl text-ink tracking-tight">
					{t("startTitle")}
				</h1>
				<p className="mt-2 text-ink-muted">{t("startHelp")}</p>
			</div>

			<div className="grid gap-3">
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

			{error ? (
				<p className="rounded-xl bg-danger-soft px-4 py-3 text-danger-ink text-sm">
					{error}
				</p>
			) : null}

			<button
				type="button"
				onClick={empty ? onSubmit : onNext}
				disabled={pending}
				className="rounded-xl bg-invert px-4 py-3 font-medium text-on-invert hover:bg-invert-hover disabled:opacity-40"
			>
				{pending ? t("creating") : empty ? t("createTree") : t("continue")}
			</button>
		</div>
	)
}

export default StartStep
