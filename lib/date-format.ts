import type { Locale as DateFnsLocale } from "date-fns"
import { format, parseISO } from "date-fns"
import { bg, enUS } from "date-fns/locale"
import { defaultLocale, type Locale } from "./localization"

/**
 * Dates in the tree are free text on purpose — a genealogy source says
 * "about 1910" or "JUN 1991" as often as it gives a full date, and the GEDCOM
 * parser only produces an ISO string when it had a complete day/month/year.
 *
 * So this formats what it can and leaves the rest alone. Rewriting "about 1910"
 * would be inventing precision the record doesn't have.
 */

const dateLocales: Record<Locale, DateFnsLocale> = { en: enUS, bg }

/** English leads with the month, Bulgarian with the day. */
const datePatterns: Record<Locale, string> = {
	en: "MMM d, yyyy",
	bg: "d MMM yyyy",
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const resolve = (locale: string): Locale =>
	locale in dateLocales ? (locale as Locale) : defaultLocale

export function formatTreeDate(
	value: string | undefined,
	locale: string,
): string | undefined {
	if (!value) return undefined
	if (!ISO_DATE.test(value)) return value

	// `parseISO` on a date-only string gives local midnight, so the calendar day
	// survives formatting whatever the server's zone is. No date here carries a
	// time, which is why date-fns-tz isn't in play.
	const key = resolve(locale)
	return format(parseISO(value), datePatterns[key], {
		locale: dateLocales[key],
	})
}
