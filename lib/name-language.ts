"use client"

import { readPref, usePref } from "./prefs"

/**
 * Whether people's names follow the interface language.
 *
 * One preference beside the theme and the locale, and stored the same way — see
 * `prefs.ts`. It belongs here rather than in the tree file: which language you
 * read the family in is a property of the reader, not of the family.
 *
 * On by default. Somebody who has entered a Cyrillic name for their grandmother
 * and then switched the app to Bulgarian meant for it to be used.
 */

export const NAME_LANGUAGE_KEY = "names-follow-language"

export const defaultNamesFollowLanguage = true

// Absent means "never chosen", which is the default rather than `off` — the
// stored form is the same `"on"` / `"off"` the cookie used, so a browser that
// has one from the previous version keeps its answer.
const parse = (raw: string | null): boolean =>
	raw == null ? defaultNamesFollowLanguage : raw === "on"

const serialize = (value: boolean) => (value ? "on" : "off")

export const useNamesFollowLanguage = () =>
	usePref(NAME_LANGUAGE_KEY, defaultNamesFollowLanguage, parse, serialize)

export const getNamesFollowLanguage = () => readPref(NAME_LANGUAGE_KEY, parse)
