import { useTranslations } from "next-intl"
import type { StepProps } from "../types"

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
			className="mx-auto flex max-w-xl flex-col gap-6"
		>
			<div className="text-center">
				<h1 className="font-semibold text-2xl text-ink tracking-tight">
					{t("nameTitle")}
				</h1>
				<p className="mt-2 text-ink-muted">{t("nameHelp")}</p>
			</div>

			<input
				// biome-ignore lint/a11y/noAutofocus: the first field of a wizard
				autoFocus
				required
				value={data.treeName}
				onChange={(event) => onUpdate({ treeName: event.target.value })}
				placeholder={t("namePlaceholder")}
				aria-label={t("nameTitle")}
				className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-ink text-lg outline-none focus:border-line-strong"
			/>

			<button
				type="submit"
				disabled={!name}
				className="rounded-xl bg-invert px-4 py-3 font-medium text-on-invert hover:bg-invert-hover disabled:opacity-40"
			>
				{t("continue")}
			</button>
		</form>
	)
}

export default NameStep
