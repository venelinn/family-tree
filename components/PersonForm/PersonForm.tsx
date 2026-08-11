"use client"

import { Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Button } from "@/components/Button"
import { DateField } from "@/components/DateField"
import {
	Checkbox,
	FormError,
	Input,
	Select,
	Textarea,
} from "@/components/Forms"
import { Heading } from "@/components/Heading"
import type { PersonFormValues } from "@/lib/actions"
import type { Person } from "@/lib/family-graph"
import { type Locale, localeNames, localization } from "@/lib/localization"
import styles from "./PersonForm.module.scss"

/**
 * Add or edit a person.
 *
 * Dates go through `DateField`: a calendar for the ordinary case, a text box for
 * the "about 1910" a genealogy source often gives instead of a day. The parser
 * already understands partial dates; this just has to not destroy them.
 *
 * Under the name sits one optional field per interface language, for the same
 * person written another way — "Венелин Николов" beside "Venelin Nikolov". They
 * are added on demand rather than shown as empty boxes: most people in most
 * trees will only ever have the one name, and a row of blanks on every form
 * would suggest otherwise.
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
		names: { ...person?.names },
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

	/** An empty string is a field the user opened; `undefined` closes the row. */
	const setName = (locale: Locale, name: string | undefined) =>
		setValues((current) => {
			const names = { ...current.names }
			if (name == null) delete names[locale]
			else names[locale] = name
			return { ...current, names }
		})

	const openNames = localization.locales.filter(
		(locale) => values.names?.[locale] != null,
	)
	const closedNames = localization.locales.filter(
		(locale) => values.names?.[locale] == null,
	)

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				onSubmit(values)
			}}
			className={styles.personForm}
		>
			<Heading as="h2" size="base">
				{title}
			</Heading>

			{unionOptions && unionOptions.length > 1 ? (
				<Select
					label={t("childOf")}
					value={unionId ?? unionOptions[0].id}
					onChange={(event) => onUnionChange?.(event.target.value)}
					full
				>
					{unionOptions.map((option) => (
						<option key={option.id} value={option.id}>
							{option.label}
						</option>
					))}
				</Select>
			) : null}

			<Input
				label={t("fullName")}
				autoFocus
				required
				value={values.fullName}
				onChange={(event) => set("fullName", event.target.value)}
				placeholder={t("fullNamePlaceholder")}
				full
			/>

			{/* The same name in another language. The remove button sits beside the
			    field rather than inside it — a label wrapping a second control would
			    make clicking it focus the input. */}
			{openNames.map((locale) => (
				<div key={locale} className={styles.personForm__nameRow}>
					<Input
						label={t("nameIn", { language: localeNames[locale] })}
						value={values.names?.[locale] ?? ""}
						onChange={(event) => setName(locale, event.target.value)}
						placeholder={t("fullNamePlaceholder")}
						className={styles.personForm__nameField}
						full
					/>
					<Button
						variant="secondary"
						aria-label={t("removeNameIn", { language: localeNames[locale] })}
						title={t("removeNameIn", { language: localeNames[locale] })}
						icon={<X size={13} strokeWidth={2} />}
						onClick={() => setName(locale, undefined)}
					/>
				</div>
			))}

			{closedNames.length ? (
				<div>
					<div className={styles.personForm__addNames}>
						{closedNames.map((locale) => (
							<Button
								key={locale}
								label={t("addNameIn", { language: localeNames[locale] })}
								variant="secondary"
								size="sm"
								icon={<Plus size={12} strokeWidth={2.5} />}
								className={styles.personForm__addName}
								onClick={() => setName(locale, "")}
							/>
						))}
					</div>
					<p className={styles.personForm__hint}>{t("namesHint")}</p>
				</div>
			) : null}

			{/*
			 * Offered for women, since taking the husband's family name is the
			 * convention this tree records — but also whenever a value is already
			 * stored, so an imported `_MARNM` can never become invisible and
			 * uneditable just because the sex on file says otherwise.
			 */}
			{values.sex === "F" || values.marriedName ? (
				<Input
					label={t("marriedName")}
					value={values.marriedName}
					onChange={(event) => set("marriedName", event.target.value)}
					placeholder={t("marriedNamePlaceholder")}
					hint={t("marriedNameHint")}
					full
				/>
			) : null}

			{lockedSex ? null : (
				<fieldset>
					<legend className={styles.personForm__legend}>{t("sex")}</legend>
					<div className={styles.personForm__sexes}>
						{(["M", "F"] as const).map((sex) => (
							<Button
								key={sex}
								label={sex === "M" ? t("male") : t("female")}
								variant="secondary"
								aria-pressed={values.sex === sex}
								data-sex={sex === "F" ? "female" : "male"}
								className={styles.personForm__sex}
								onClick={() => set("sex", sex)}
							/>
						))}
					</div>
				</fieldset>
			)}

			<div className={styles.personForm__pair}>
				<DateField
					label={t("birthDate")}
					value={values.birthDate ?? ""}
					onChange={(date) => set("birthDate", date)}
					placeholder={t("datePlaceholder")}
				/>
				<Input
					label={t("birthPlace")}
					value={values.birthPlace}
					onChange={(event) => set("birthPlace", event.target.value)}
					placeholder={t("birthPlacePlaceholder")}
					full
				/>
			</div>

			<Checkbox
				label={t("deceased")}
				checked={values.deceased}
				onChange={(event) => set("deceased", event.target.checked)}
			/>

			{values.deceased ? (
				<div className={styles.personForm__pair}>
					<DateField
						label={t("deathDate")}
						value={values.deathDate ?? ""}
						onChange={(date) => set("deathDate", date)}
						placeholder={t("datePlaceholder")}
					/>
					<Input
						label={t("deathPlace")}
						value={values.deathPlace}
						onChange={(event) => set("deathPlace", event.target.value)}
						full
					/>
				</div>
			) : null}

			<Textarea
				label={t("note")}
				value={values.note}
				onChange={(event) => set("note", event.target.value)}
				placeholder={t("notePlaceholder")}
				full
			/>

			<FormError>{error}</FormError>

			<div className={styles.personForm__actions}>
				<Button
					type="submit"
					label={pending ? t("saving") : submitLabel}
					variant="primary"
					disabled={pending}
					className={styles.personForm__submit}
				/>
				<Button label={t("cancel")} variant="secondary" onClick={onCancel} />
			</div>
		</form>
	)
}
