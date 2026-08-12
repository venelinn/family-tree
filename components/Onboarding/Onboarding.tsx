"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Button } from "@/components/Button"
import type { PersonFormValues } from "@/lib/actions"
import { canPickFolder } from "@/lib/pick-folder"
import { createTreeAction } from "@/lib/tree-actions"
import BottomNav from "./BottomNav"
import styles from "./Onboarding.module.scss"
import AboutYouStep from "./steps/AboutYouStep"
import NameStep from "./steps/NameStep"
import PreferencesStep from "./steps/PreferencesStep"
import StartStep from "./steps/StartStep"
import StorageStep from "./steps/StorageStep"
import type { OnboardingData, StepId } from "./types"

/**
 * First run: name a tree, decide where its file lives, and put somebody in it.
 *
 * Four or five steps depending on the last answer, so the sequence is derived
 * from the data rather than counted — "step 4 of 5" has to stop being a lie the
 * moment someone chooses to start from an empty tree.
 *
 * Nothing is written until the final submit. A wizard that created the file on
 * step one would leave a stray half-configured tree behind every time somebody
 * changed their mind, and this app's data is the kind you don't litter.
 */

interface OnboardingProps {
	/** True when this is an additional tree, not the first one. */
	hasTrees: boolean
}

export function Onboarding({ hasTrees }: OnboardingProps) {
	const t = useTranslations("onboarding")
	const router = useRouter()
	const [pending, startTransition] = useTransition()
	const [error, setError] = useState<string>()
	const [index, setIndex] = useState(0)

	const [data, setData] = useState<OnboardingData>({
		treeName: "",
		storageMode: "default",
		customPath: "",
		startMode: "me",
	})

	/**
	 * The web target has no storage step, because there is nothing to choose.
	 * A browser tree lives in this browser's own storage; asking "where shall I
	 * put it?" and offering one answer is worse than not asking. `StartStep` says
	 * where it went instead, next to the advice about exporting it.
	 */
	const steps: StepId[] = [
		"name",
		...(canPickFolder() ? (["storage"] as const) : []),
		"preferences",
		"start",
		...(data.startMode === "me" ? (["you"] as const) : []),
	]
	const step = steps[Math.min(index, steps.length - 1)]

	const update = (updates: Partial<OnboardingData>) => {
		setData((current) => ({ ...current, ...updates }))
		setError(undefined)
	}

	const next = () => setIndex((current) => Math.min(current + 1, steps.length))
	const back = () => setIndex((current) => Math.max(current - 1, 0))

	const submit = (firstPerson?: PersonFormValues) => {
		setError(undefined)
		startTransition(async () => {
			const result = await createTreeAction({
				name: data.treeName,
				file: data.storageMode === "custom" ? data.customPath : undefined,
				firstPerson,
			})
			if (!result.ok) {
				setError(result.error)
				return
			}
			// No `router.refresh()` any more. It existed because the client router
			// cache held a render of `/` from before this tree existed, and only the
			// server could produce a newer one. `/` now reads the store on mount, and
			// `createTreeAction` has already invalidated, so it arrives current.
			router.push("/")
		})
	}

	const stepProps = {
		data,
		onUpdate: update,
		onNext: next,
		onBack: back,
		// Importing or opening an existing tree lands in the same place a finished
		// wizard does; the action has already selected it and invalidated.
		onDone: () => router.push("/"),
	}

	return (
		<div className={styles.onboarding}>
			<header className={styles.onboarding__header}>
				<span className={styles.onboarding__brand}>{t("appName")}</span>
				{hasTrees ? (
					<Button label={t("cancel")} href="/" variant="ghost" />
				) : null}
			</header>

			<main className={styles.onboarding__main}>
				{/* Keyed on the step so each one re-enters; the animation is disabled
				    under `prefers-reduced-motion` in the stylesheet. */}
				<div key={step} className={styles.onboarding__slot}>
					{step === "name" ? <NameStep {...stepProps} /> : null}
					{step === "storage" ? <StorageStep {...stepProps} /> : null}
					{step === "preferences" ? <PreferencesStep {...stepProps} /> : null}
					{step === "start" ? (
						<StartStep
							{...stepProps}
							onSubmit={() => submit()}
							pending={pending}
							error={error}
						/>
					) : null}
					{step === "you" ? (
						<AboutYouStep
							{...stepProps}
							onSubmit={(values) => submit(values)}
							pending={pending}
							error={error}
						/>
					) : null}
				</div>
			</main>

			<BottomNav
				onBack={back}
				isFirstStep={index === 0}
				currentStep={Math.min(index + 1, steps.length)}
				totalSteps={steps.length}
			/>
		</div>
	)
}
