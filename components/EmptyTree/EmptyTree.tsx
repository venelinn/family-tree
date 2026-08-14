"use client"

import { Settings, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Button } from "@/components/Button"
import { Heading } from "@/components/Heading"
import { PersonForm } from "@/components/PersonForm"
import { createFirstPersonAction, type PersonFormValues } from "@/lib/actions"
import styles from "./EmptyTree.module.scss"

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
		<main className={styles.empty}>
			<div className={styles.empty__inner}>
				{adding ? (
					<div className={styles.empty__form}>
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
					<div className={styles.empty__card}>
						<span className={styles.empty__badge}>
							<UserPlus size={22} strokeWidth={1.75} />
						</span>
						<div>
							<Heading as="h1" size="h4">
								{treeName}
							</Heading>
							<p className={styles.empty__help}>{t("help")}</p>
						</div>
						<Button
							label={t("addFirst")}
							variant="primary"
							size="lg"
							full
							onClick={() => setAdding(true)}
						/>
						<Button
							label={t("settings")}
							href="/settings"
							variant="ghost"
							size="md"
							icon={<Settings size={14} strokeWidth={2} />}
						/>
					</div>
				)}
			</div>
		</main>
	)
}
