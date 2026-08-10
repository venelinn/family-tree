import { TreeOpError } from "./errors"
import type { PersonInput } from "./store/types"

/**
 * Form values -> a store row.
 *
 * Its own module because both `actions.ts` and `tree-actions.ts` need it and
 * both are `"use server"`, which may only export async functions.
 */

export interface PersonFormValues {
	fullName: string
	/** Family name taken on marriage. Blank when there isn't one. */
	marriedName?: string
	sex: "M" | "F"
	birthDate?: string
	birthPlace?: string
	deathDate?: string
	deathPlace?: string
	deceased: boolean
	note?: string
}

/** Blank strings from an empty form field should be absent, not "". */
const clean = (value: string | undefined) => value?.trim() || undefined

export function toPersonInput(values: PersonFormValues): PersonInput {
	const fullName = values.fullName.trim()
	if (!fullName) throw new TreeOpError("nameRequired")

	const parts = fullName.split(/\s+/)
	return {
		fullName,
		// Best-effort split so surname-based sorting keeps working; both are
		// editable later if the guess is wrong.
		givenName: parts.slice(0, -1).join(" ") || fullName,
		surname: parts.length > 1 ? parts.at(-1) : undefined,
		marriedName: clean(values.marriedName),
		sex: values.sex,
		birthDate: clean(values.birthDate),
		birthPlace: clean(values.birthPlace),
		deathDate: clean(values.deathDate),
		deathPlace: clean(values.deathPlace),
		// A death date implies deceased even if the box wasn't ticked.
		deceased: values.deceased || Boolean(clean(values.deathDate)),
		note: clean(values.note),
		photos: [],
	}
}
