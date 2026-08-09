"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import type { PersonFormValues } from "@/lib/actions"
import type { ThemePreference } from "@/lib/theming"
import { createTreeAction } from "@/lib/tree-actions"
import BottomNav from "./BottomNav"
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
	/** Where a tree goes unless the user picks somewhere else. Shown, not guessed. */
	defaultDir: string
	locale: string
	theme: ThemePreference
	/** True when this is an additional tree, not the first one. */
	hasTrees: boolean
}

export function Onboarding({
	defaultDir,
	locale,
	theme,
	hasTrees,
}: OnboardingProps) {
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

	const steps: StepId[] = [
		"name",
		"storage",
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
			router.push("/")
			// The action already revalidated, but the client router cache holds a
			// prior render of `/` — from before this tree existed.
			router.refresh()
		})
	}

	const stepProps = {
		data,
		onUpdate: update,
		onNext: next,
		onBack: back,
	}

	return (
		<div className="flex min-h-screen flex-col bg-surface">
			<header className="flex items-center justify-between px-6 py-4">
				<span className="font-medium text-ink-faint text-sm">
					{t("appName")}
				</span>
				{hasTrees ? (
					<Link
						href="/"
						className="rounded-lg px-3 py-1.5 font-medium text-ink-muted text-sm hover:bg-wash hover:text-ink"
					>
						{t("cancel")}
					</Link>
				) : null}
			</header>

			<main className="flex flex-1 items-center justify-center px-6">
				{/* Keyed on the step so each one re-enters; the animation is disabled
				    under `prefers-reduced-motion` in `globals.css`. */}
				<div key={step} className="slot-enter w-full py-10">
					{step === "name" ? <NameStep {...stepProps} /> : null}
					{step === "storage" ? (
						<StorageStep {...stepProps} defaultDir={defaultDir} />
					) : null}
					{step === "preferences" ? (
						<PreferencesStep {...stepProps} locale={locale} theme={theme} />
					) : null}
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
