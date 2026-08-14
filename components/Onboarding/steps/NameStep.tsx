import { useTranslations } from "next-intl"
import { useState } from "react"
import { Button } from "@/components/Button"
import { FormError, Input } from "@/components/Forms"
import { Heading } from "@/components/Heading"
import { canPickFolder, pickFolder } from "@/lib/pick-folder"
import { adoptTreeAction, importTreeAction } from "@/lib/tree-actions"
import type { StepProps } from "../types"
import styles from "./Step.module.scss"

/**
 * What to call this tree — and the way out for people who already have one.
 *
 * The wizard used to create only, which made a fresh install a dead end for
 * anyone with an existing tree: `/` redirects here when nothing is registered,
 * and from here the only path forward was making a second empty tree. The way
 * in existed but was in Settings, which you cannot reach without knowing to
 * look. So the two ways of *arriving* with a tree live here too:
 *
 *  - **Import a file** — an export from this app, on either target. This is the
 *    only route on the web, where there is no filesystem to point at.
 *  - **Open a folder** — a `.familytree` already on disk, desktop only. The
 *    native dialog is also what grants permission to read it; see
 *    `lib/pick-folder.ts`.
 *
 * Both skip the rest of the wizard entirely — a tree that already exists has a
 * name, a location and a first person, so there is nothing left to ask.
 */
export function NameStep({ data, onUpdate, onNext, onDone }: StepProps) {
	const t = useTranslations("onboarding")
	const [error, setError] = useState<string>()
	const [busy, setBusy] = useState(false)
	const name = data.treeName.trim()

	const arrive = async (
		action: () => Promise<{ ok: boolean; error?: string }>,
	) => {
		setError(undefined)
		setBusy(true)
		try {
			const result = await action()
			if (result.ok) onDone?.()
			else setError(result.error)
		} finally {
			setBusy(false)
		}
	}

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
				disabled={!name || busy}
				full
			/>

			<div className={styles.step__existing}>
				<span className={styles.step__existingTitle}>{t("haveOne")}</span>
				<p className={styles.step__existingHelp}>{t("haveOneHelp")}</p>

				<label className={styles.step__importLabel}>
					<input
						type="file"
						accept=".json,application/json"
						disabled={busy}
						onChange={(event) => {
							const file = event.target.files?.[0]
							// Cleared so the same file can be chosen again after a failure.
							event.target.value = ""
							if (file) arrive(() => importTreeAction(file))
						}}
					/>
					<span>{t("haveOneImport")}</span>
				</label>

				{canPickFolder() ? (
					<Button
						label={t("haveOneOpen")}
						variant="secondary"
						disabled={busy}
						onClick={async () => {
							const folder = await pickFolder(t("haveOneOpen"))
							if (folder) arrive(() => adoptTreeAction(folder))
						}}
					/>
				) : null}
			</div>

			<FormError>{error}</FormError>
		</form>
	)
}

export default NameStep
