"use client"

import { Settings, UserPlus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { createFirstPersonAction, type PersonFormValues } from "@/lib/actions"
import { PersonForm } from "./PersonForm"

/**
 * A tree with nobody in it yet.
 *
 * The counterpart to choosing "start empty" in onboarding: every layout in this
 * app begins from one person, so a tree with no root has nothing to draw. Once
 * this form is submitted the chart takes over and the ordinary add-slots handle
 * everyone else.
 */

export function EmptyTree({ treeName }: { treeName: string }) {
	const t = useTranslations("emptyTree")
	const [adding, setAdding] = useState(false)
	const [pending, startTransition] = useTransition()
	const [error, setError] = useState<string>()

	const submit = (values: PersonFormValues) => {
		setError(undefined)
		startTransition(async () => {
			const result = await createFirstPersonAction(values)
			if (!result.ok) setError(result.error)
		})
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-surface px-6">
			<div className="w-full max-w-md">
				{adding ? (
					<div className="rounded-2xl border border-line bg-panel">
						<PersonForm
							title={t("formTitle")}
							submitLabel={t("save")}
							pending={pending}
							error={error}
							onSubmit={submit}
							onCancel={() => setAdding(false)}
						/>
					</div>
				) : (
					<div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-panel px-6 py-10 text-center">
						<span className="rounded-full bg-root-soft p-3 text-root-ink">
							<UserPlus size={22} strokeWidth={1.75} />
						</span>
						<div>
							<h1 className="font-semibold text-ink text-lg">{treeName}</h1>
							<p className="mt-1.5 text-ink-muted text-sm">{t("help")}</p>
						</div>
						<button
							type="button"
							onClick={() => setAdding(true)}
							className="w-full rounded-xl bg-invert px-4 py-2.5 font-medium text-on-invert text-sm hover:bg-invert-hover"
						>
							{t("addFirst")}
						</button>
						<Link
							href="/settings"
							className="flex items-center gap-1.5 text-ink-muted text-sm hover:text-ink"
						>
							<Settings size={14} strokeWidth={2} />
							{t("settings")}
						</Link>
					</div>
				)}
			</div>
		</main>
	)
}
