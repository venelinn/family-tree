"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { PersonFormValues } from "@/lib/actions"
import type { Person } from "@/lib/family-graph"

/**
 * Add or edit a person.
 *
 * Dates are free text on purpose. A genealogy source says "about 1910" or
 * "Jun 1991" as often as it gives a full date, and a date picker would force a
 * precision the record doesn't have. The parser already understands partial
 * dates; this just has to not destroy them.
 */

interface PersonFormProps {
	title: string
	/** Present when editing; absent when adding. */
	person?: Person
	/** Fixed for add-slots ("Add sister" is always female), editable otherwise. */
	lockedSex?: "M" | "F"
	submitLabel: string
	/**
	 * Which marriage a new child belongs to. Only passed when the parent married
	 * more than once — with one marriage there is nothing to choose, and with
	 * none the child gets a single-parent union either way.
	 */
	unionOptions?: { id: string; label: string }[]
	unionId?: string
	onUnionChange?: (unionId: string) => void
	pending: boolean
	error?: string
	onSubmit: (values: PersonFormValues) => void
	onCancel: () => void
}

const field =
	"w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-ink text-sm outline-none focus:border-line-strong"
const label =
	"block font-medium text-[11px] text-ink-muted uppercase tracking-wide"

export function PersonForm({
	title,
	person,
	lockedSex,
	submitLabel,
	unionOptions,
	unionId,
	onUnionChange,
	pending,
	error,
	onSubmit,
	onCancel,
}: PersonFormProps) {
	const t = useTranslations("form")

	const [values, setValues] = useState<PersonFormValues>({
		fullName: person?.name ?? "",
		marriedName: person?.marriedName ?? "",
		sex: lockedSex ?? person?.sex ?? "M",
		birthDate: person?.birthDate ?? "",
		birthPlace: person?.birthPlace ?? "",
		deathDate: person?.deathDate ?? "",
		deathPlace: person?.deathPlace ?? "",
		deceased: person?.deceased ?? false,
		note: person?.note ?? "",
	})

	const set = <K extends keyof PersonFormValues>(
		key: K,
		value: PersonFormValues[K],
	) => setValues((current) => ({ ...current, [key]: value }))

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				onSubmit(values)
			}}
			className="flex flex-col gap-3 p-5"
		>
			<h2 className="font-semibold text-ink">{title}</h2>

			{unionOptions && unionOptions.length > 1 ? (
				<label className={label}>
					{t("childOf")}
					<select
						value={unionId ?? unionOptions[0].id}
						onChange={(event) => onUnionChange?.(event.target.value)}
						className={`${field} mt-1`}
					>
						{unionOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				</label>
			) : null}

			<div>
				<label className={label}>
					{t("fullName")}
					<input
						// biome-ignore lint/a11y/noAutofocus: the form opens on an explicit click
						autoFocus
						required
						value={values.fullName}
						onChange={(event) => set("fullName", event.target.value)}
						className={`${field} mt-1`}
						placeholder={t("fullNamePlaceholder")}
					/>
				</label>
			</div>

			{/*
			 * Offered for women, since taking the husband's family name is the
			 * convention this tree records — but also whenever a value is already
			 * stored, so an imported `_MARNM` can never become invisible and
			 * uneditable just because the sex on file says otherwise.
			 */}
			{values.sex === "F" || values.marriedName ? (
				<div>
					<label className={label}>
						{t("marriedName")}
						<input
							value={values.marriedName}
							onChange={(event) => set("marriedName", event.target.value)}
							className={`${field} mt-1`}
							placeholder={t("marriedNamePlaceholder")}
						/>
					</label>
					<p className="mt-1 text-ink-faint text-xs">{t("marriedNameHint")}</p>
				</div>
			) : null}

			{lockedSex ? null : (
				<fieldset>
					<legend className={label}>{t("sex")}</legend>
					<div className="mt-1 flex gap-2">
						{(["M", "F"] as const).map((sex) => (
							<button
								key={sex}
								type="button"
								onClick={() => set("sex", sex)}
								className={`flex-1 rounded-lg border px-3 py-1.5 font-medium text-sm ${
									values.sex === sex
										? sex === "F"
											? "border-female-line bg-female-soft text-female-ink"
											: "border-male-line bg-male-soft text-male-ink"
										: "border-line text-ink-muted hover:bg-wash"
								}`}
							>
								{sex === "M" ? t("male") : t("female")}
							</button>
						))}
					</div>
				</fieldset>
			)}

			<div className="grid grid-cols-2 gap-2">
				<label className={label}>
					{t("birthDate")}
					<input
						value={values.birthDate}
						onChange={(event) => set("birthDate", event.target.value)}
						className={`${field} mt-1`}
						placeholder="1976-12-23"
					/>
				</label>
				<label className={label}>
					{t("birthPlace")}
					<input
						value={values.birthPlace}
						onChange={(event) => set("birthPlace", event.target.value)}
						className={`${field} mt-1`}
						placeholder={t("birthPlacePlaceholder")}
					/>
				</label>
			</div>

			<label className="flex items-center gap-2 text-ink-soft text-sm">
				<input
					type="checkbox"
					checked={values.deceased}
					onChange={(event) => set("deceased", event.target.checked)}
					className="accent-invert"
				/>
				{t("deceased")}
			</label>

			{values.deceased ? (
				<div className="grid grid-cols-2 gap-2">
					<label className={label}>
						{t("deathDate")}
						<input
							value={values.deathDate}
							onChange={(event) => set("deathDate", event.target.value)}
							className={`${field} mt-1`}
							placeholder="1993-03-20"
						/>
					</label>
					<label className={label}>
						{t("deathPlace")}
						<input
							value={values.deathPlace}
							onChange={(event) => set("deathPlace", event.target.value)}
							className={`${field} mt-1`}
						/>
					</label>
				</div>
			) : null}

			<label className={label}>
				{t("note")}
				<textarea
					value={values.note}
					onChange={(event) => set("note", event.target.value)}
					rows={3}
					placeholder={t("notePlaceholder")}
					className={`${field} mt-1 resize-y`}
				/>
			</label>

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
