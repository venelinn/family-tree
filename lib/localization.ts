/**
 * The languages the app ships with.
 *
 * Same shape as `utils/localization.ts` in bgmtl, minus the Contentful mapping
 * — this tree has no CMS, so a locale is just a UI language.
 *
 * Adding one means touching three files, and each falls back rather than
 * erroring, so a missed step looks like "translations aren't working":
 *
 *  1. this file — add the code, and a name for it
 *  2. `messages/<code>.json` — copy `en.json` and translate it
 *  3. `lib/getMessages.ts` and `lib/date-format.ts` — the message catalogue and
 *     the date-fns locale, both keyed by code
 */

export const localization = {
	locales: ["en", "bg"],
	defaultLocale: "en",
} as const

export type Locale = (typeof localization.locales)[number]

export const defaultLocale: Locale = localization.defaultLocale

/**
 * Endonyms — each language named in itself, deliberately not translated. A
 * reader who ended up in the wrong language needs to recognise their own.
 */
export const localeNames: Record<Locale, string> = {
	en: "English",
	bg: "Български",
}

export function isLocale(value: string | undefined | null): value is Locale {
	return (
		value != null && (localization.locales as readonly string[]).includes(value)
	)
}
