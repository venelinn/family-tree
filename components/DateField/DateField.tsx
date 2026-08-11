"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

/**
 * A date field with a calendar, without throwing away imprecise dates.
 *
 * Genealogy records are not tidy: a source says "about 1910" or "JUN 1991" as
 * often as it gives a day, and the GEDCOM parser stores exactly what it read.
 * `<input type="date">` cannot hold any of that — a browser silently refuses a
 * value it can't parse — so this renders the calendar for ISO dates and empty
 * fields, and falls back to a text box for everything else. The toggle lets you
 * move between the two on purpose.
 *
 * `color-scheme` is set globally in `styles/_theme-dark.scss`, which is what makes the
 * native picker follow the app's theme.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const field =
	"w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-ink text-sm outline-none focus:border-line-strong"
const labelClass =
	"block font-medium text-[11px] text-ink-muted uppercase tracking-wide"

interface DateFieldProps {
	label: string
	value: string
	onChange: (value: string) => void
	/** Shown only in text mode — the calendar has its own placeholder. */
	placeholder?: string
	autoFocus?: boolean
}

export function DateField({
	label,
	value,
	onChange,
	placeholder,
	autoFocus,
}: DateFieldProps) {
	const t = useTranslations("form")
	// Whatever the field already holds decides how it opens: a stored
	// "about 1910" must stay visible and editable, never blanked by a picker.
	const [freeText, setFreeText] = useState(
		Boolean(value) && !ISO_DATE.test(value),
	)

	return (
		<div>
			<label className={labelClass}>
				{label}
				<input
					// biome-ignore lint/a11y/noAutofocus: the form opens on an explicit click
					autoFocus={autoFocus}
					type={freeText ? "text" : "date"}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className={`${field} mt-1`}
					placeholder={freeText ? placeholder : undefined}
				/>
			</label>
			<button
				type="button"
				onClick={() => {
					// Going back to the calendar drops a value it cannot represent,
					// rather than leaving an empty-looking field that still saves
					// "about 1910" behind the user's back.
					if (freeText && value && !ISO_DATE.test(value)) onChange("")
					setFreeText((current) => !current)
				}}
				className="mt-1 text-[11px] text-ink-faint underline-offset-2 hover:text-ink-soft hover:underline"
			>
				{freeText ? t("dateUseCalendar") : t("dateUseText")}
			</button>
		</div>
	)
}
