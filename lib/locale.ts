"use client"

import { defaultLocale, isLocale, type Locale } from "./localization"
import { readPref, usePref } from "./prefs"

/**
 * The chosen interface language.
 *
 * Still not in the URL: there is no `/en` / `/bg` prefix and no middleware. That
 * decision predates the move off the server and survives it unchanged — this is
 * a two-page app, and a locale segment would buy shareable per-language links at
 * the cost of restructuring the routes. Both targets are now static exports, so
 * a locale segment would also mean building every page twice.
 *
 * It was a cookie read during the server render; it is `localStorage` read
 * during the client one. See `prefs.ts` for what that costs and what covers it.
 *
 * Unlike the theme there is no init script, because there is nothing to stamp
 * before paint — `next-intl` needs the catalogue either way, and the fallback
 * render is the default language rather than the wrong colour.
 */

export const LOCALE_KEY = "NEXT_LOCALE"

const parse = (raw: string | null): Locale =>
	isLocale(raw) ? raw : defaultLocale

/** Read and write the language. Re-renders every consumer on change. */
export const useLocale = () => usePref(LOCALE_KEY, defaultLocale, parse)

export const getUserLocale = () => readPref(LOCALE_KEY, parse)
