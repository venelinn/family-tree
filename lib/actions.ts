"use server"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { store } from "./data"
import { TreeOpError } from "./errors"
import type { PersonInput } from "./store/types"
import { addRelative, type Relation, removePerson } from "./tree-ops"

/**
 * Server actions — the only write path into the tree.
 *
 * Each one returns `{ ok }` rather than throwing across the boundary, so the
 * panel can show a real message ("Venelin already has a father") instead of a
 * generic failure. Every mutation revalidates `/`, which re-runs the server
 * component and pushes a fresh graph down to the client.
 *
 * This is also where error *codes* from `tree-ops` become sentences: the
 * request's language is known here and nowhere deeper.
 */

export interface ActionResult {
	ok: boolean
	error?: string
	personId?: string
}

async function failure(error: unknown): Promise<ActionResult> {
	const t = await getTranslations("errors")
	// `ErrorCode` is a subset of the `errors` keys, so a code with no message
	// is a compile error rather than a raw code shown to the user.
	if (error instanceof TreeOpError) {
		return { ok: false, error: t(error.code, error.values) }
	}
	return { ok: false, error: t("unknown") }
}

/** Blank strings from an empty form field should be absent, not "". */
const clean = (value: string | undefined) => value?.trim() || undefined

export interface PersonFormValues {
	fullName: string
	sex: "M" | "F"
	birthDate?: string
	birthPlace?: string
	deathDate?: string
	deathPlace?: string
	deceased: boolean
}

function toInput(values: PersonFormValues): PersonInput {
	const fullName = values.fullName.trim()
	if (!fullName) throw new TreeOpError("nameRequired")

	const parts = fullName.split(/\s+/)
	return {
		fullName,
		// Best-effort split so surname-based sorting keeps working; both are
		// editable later if the guess is wrong.
		givenName: parts.slice(0, -1).join(" ") || fullName,
		surname: parts.length > 1 ? parts.at(-1) : undefined,
		sex: values.sex,
		birthDate: clean(values.birthDate),
		birthPlace: clean(values.birthPlace),
		deathDate: clean(values.deathDate),
		deathPlace: clean(values.deathPlace),
		// A death date implies deceased even if the box wasn't ticked.
		deceased: values.deceased || Boolean(clean(values.deathDate)),
		photos: [],
	}
}

export async function addRelativeAction(
	anchorId: string,
	relation: Relation,
	values: PersonFormValues,
): Promise<ActionResult> {
	try {
		const person = await addRelative(store, anchorId, relation, toInput(values))
		revalidatePath("/")
		return { ok: true, personId: person.id }
	} catch (error) {
		return await failure(error)
	}
}

export async function updatePersonAction(
	personId: string,
	values: PersonFormValues,
): Promise<ActionResult> {
	try {
		const { photos: _photos, ...patch } = toInput(values)
		// `photos` is deliberately dropped: it's managed by the import and photo
		// scripts, and this form would otherwise blank it out on every save.
		await store.updatePerson(personId, patch)
		revalidatePath("/")
		return { ok: true, personId }
	} catch (error) {
		return await failure(error)
	}
}

export async function deletePersonAction(
	personId: string,
): Promise<ActionResult> {
	try {
		await removePerson(store, personId)
		revalidatePath("/")
		return { ok: true }
	} catch (error) {
		return await failure(error)
	}
}
