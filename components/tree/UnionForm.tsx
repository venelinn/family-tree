"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { UnionFormValues } from "@/lib/actions"
import type { Person, Union } from "@/lib/family-graph"
import { Avatar } from "./Avatar"

/**
 * Edit a marriage: when, where, and whether it ended.
 *
 * Deliberately the same shape and field styling as `PersonForm` — it opens in
 * the same slot, so looking different would read as a different kind of thing.
 * Dates are free text here for exactly the reason they are there: a record says
 * "about 1948" as often as it gives a day.
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

const field =
	"w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-ink text-sm outline-none focus:border-line-strong"
const label =
	"block font-medium text-[11px] text-ink-muted uppercase tracking-wide"

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
			className="flex flex-col gap-3 p-5"
		>
			<h2 className="font-semibold text-ink">{t("marriageTitle")}</h2>

			<ul className="flex flex-col gap-1.5">
				{spouses.map((spouse) => (
					<li key={spouse.id} className="flex items-center gap-2.5">
						<Avatar person={spouse} size={28} />
						<span className="truncate text-ink-soft text-sm">
							{spouse.name}
						</span>
					</li>
				))}
			</ul>

			<label className={label}>
				{t("marriageDate")}
				<input
					// biome-ignore lint/a11y/noAutofocus: the form opens on an explicit click
					autoFocus
					value={values.marriageDate}
					onChange={(event) => set("marriageDate", event.target.value)}
					className={`${field} mt-1`}
					placeholder="1948-06-12"
				/>
			</label>

			<label className={label}>
				{t("marriagePlace")}
				<input
					value={values.marriagePlace}
					onChange={(event) => set("marriagePlace", event.target.value)}
					className={`${field} mt-1`}
					placeholder={t("birthPlacePlaceholder")}
				/>
			</label>

			<label className="flex items-center gap-2 text-ink-soft text-sm">
				<input
					type="checkbox"
					checked={values.divorced}
					onChange={(event) => set("divorced", event.target.checked)}
					className="accent-invert"
				/>
				{t("divorced")}
			</label>
			<p className="-mt-1 text-ink-faint text-xs">{t("divorcedHint")}</p>

			{error ? (
				<p className="rounded-lg bg-danger-soft px-3 py-2 text-danger-ink text-sm">
					{error}
				</p>
			) : null}

			<div className="mt-1 flex gap-2">
				<button
					type="submit"
					disabled={pending}
					className="flex-1 rounded-lg bg-invert px-3 py-2 font-medium text-on-invert text-sm hover:bg-invert-hover disabled:opacity-50"
				>
					{pending ? t("saving") : submitLabel}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-line px-3 py-2 font-medium text-ink-soft text-sm hover:bg-wash"
				>
					{t("cancel")}
				</button>
			</div>
		</form>
	)
}
