"use server"

import { revalidatePath } from "next/cache"
import { toActionError } from "./action-error"
import { getStore } from "./data"
import { type PersonFormValues, toPersonInput } from "./person-input"
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

export type { PersonFormValues }

export async function addRelativeAction(
	anchorId: string,
	relation: Relation,
	values: PersonFormValues,
): Promise<ActionResult> {
	try {
		const store = await getStore()
		const person = await addRelative(
			store,
			anchorId,
			relation,
			toPersonInput(values),
		)
		revalidatePath("/")
		return { ok: true, personId: person.id }
	} catch (error) {
		return await toActionError(error)
	}
}

export async function updatePersonAction(
	personId: string,
	values: PersonFormValues,
): Promise<ActionResult> {
	try {
		const store = await getStore()
		const { photos: _photos, ...patch } = toPersonInput(values)
		// `photos` is deliberately dropped: it's managed by the import and photo
		// scripts, and this form would otherwise blank it out on every save.
		await store.updatePerson(personId, patch)
		revalidatePath("/")
		return { ok: true, personId }
	} catch (error) {
		return await toActionError(error)
	}
}

export async function deletePersonAction(
	personId: string,
): Promise<ActionResult> {
	try {
		const store = await getStore()
		await removePerson(store, personId)
		revalidatePath("/")
		return { ok: true }
	} catch (error) {
		return await toActionError(error)
	}
}

/**
 * The first person in an empty tree.
 *
 * Separate from `addRelativeAction` because there is no anchor to hang them
 * off, and because this is the moment a tree gets a root: every layout starts
 * from someone, so a tree with people but no `rootPersonId` has no way in.
 * Used by onboarding and by the empty state on `/`.
 */
export async function createFirstPersonAction(
	values: PersonFormValues,
): Promise<ActionResult> {
	try {
		const store = await getStore()
		const person = await store.createPerson(toPersonInput(values))
		await store.updateMeta({ rootPersonId: person.id })
		revalidatePath("/", "layout")
		return { ok: true, personId: person.id }
	} catch (error) {
		return await toActionError(error)
	}
}
