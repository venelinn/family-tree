"use client"

import { Check, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Avatar } from "@/components/Avatar"
import { Button } from "@/components/Button"
import { DateField } from "@/components/DateField"
import { Checkbox, FormError, Input } from "@/components/Forms"
import { Heading } from "@/components/Heading"
import { usePersonName } from "@/components/PersonNames"
import type { UnionFormValues } from "@/lib/actions"
import type { Person, Union } from "@/lib/family-graph"
import styles from "./UnionForm.module.scss"

/**
 * Edit a marriage: when, where, and whether it ended.
 *
 * Deliberately the same shape and field styling as `PersonForm` — it opens in
 * the same slot, so looking different would read as a different kind of thing.
 * The date uses the same `DateField` for the same reason it does there: a record
 * says "about 1948" as often as it gives a day.
 *
 * The couple is shown but not editable. Who is married to whom is decided by
 * adding relatives on the chart, and `tree-ops` maintains the invariants; a
 * dropdown here would be a second, unpoliced way to rewrite the same rows.
 */

interface UnionFormProps {
	union: Union
	spouses: Person[]
	submitLabel: string
	pending: boolean
	error?: string
	onSubmit: (values: UnionFormValues) => void
	onCancel: () => void
}

export function UnionForm({
	union,
	spouses,
	submitLabel,
	pending,
	error,
	onSubmit,
	onCancel,
}: UnionFormProps) {
	const t = useTranslations("form")
	const nameOf = usePersonName()

	const [values, setValues] = useState<UnionFormValues>({
		marriageDate: union.marriageDate ?? "",
		marriagePlace: union.marriagePlace ?? "",
		divorced: union.divorced,
	})

	const set = <K extends keyof UnionFormValues>(
		key: K,
		value: UnionFormValues[K],
	) => setValues((current) => ({ ...current, [key]: value }))

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				onSubmit(values)
			}}
			className={styles.unionForm}
		>
			<Heading as="h2" size="base">
				{t("marriageTitle")}
			</Heading>

			<ul className={styles.unionForm__spouses}>
				{spouses.map((spouse) => (
					<li key={spouse.id} className={styles.unionForm__spouse}>
						<Avatar person={spouse} size={28} />
						<span className={styles.unionForm__name}>{nameOf(spouse)}</span>
					</li>
				))}
			</ul>

			<DateField
				label={t("marriageDate")}
				value={values.marriageDate ?? ""}
				onChange={(date) => set("marriageDate", date)}
				placeholder={t("datePlaceholder")}
				autoFocus
			/>

			<Input
				label={t("marriagePlace")}
				value={values.marriagePlace}
				onChange={(event) => set("marriagePlace", event.target.value)}
				placeholder={t("birthPlacePlaceholder")}
				full
			/>

			<Checkbox
				label={t("divorced")}
				checked={values.divorced}
				onChange={(event) => set("divorced", event.target.checked)}
			/>
			<p className={styles.unionForm__hint}>{t("divorcedHint")}</p>

			<FormError>{error}</FormError>

			<div className={styles.unionForm__actions}>
				<Button
					type="submit"
					label={pending ? t("saving") : submitLabel}
					variant="primary"
					disabled={pending}
					icon={<Check size={15} strokeWidth={2.5} />}
					className={styles.unionForm__submit}
				/>
				<Button
					label={t("cancel")}
					variant="secondary"
					icon={<X size={15} strokeWidth={2} />}
					onClick={onCancel}
				/>
			</div>
		</form>
	)
}
