"use server"

import { revalidatePath } from "next/cache"
import { toActionError } from "./action-error"
import { getStore } from "./data"
import { TreeOpError } from "./errors"
import { removePhoto, savePhoto, setPrimaryPhoto } from "./photos"

/**
 * Photos for people added in the app.
 *
 * `pnpm photos` covers everyone who came from MyHeritage, but it can only pull
 * what the export points at — and 229 of the 253 people in this tree have no
 * photo at all. Anyone added by hand had no way to get one.
 *
 * Thin on purpose: the rules are in `photos.ts`, which is plain code and can be
 * tested without a browser.
 */

export interface PhotoResult {
	ok: boolean
	error?: string
	photos?: string[]
}

export async function uploadPhotoAction(
	personId: string,
	formData: FormData,
): Promise<PhotoResult> {
	try {
		const file = formData.get("photo")
		if (!(file instanceof File)) throw new TreeOpError("photoMissing")

		const photos = await savePhoto(await getStore(), personId, file)
		revalidatePath("/")
		return { ok: true, photos }
	} catch (error) {
		return await toActionError(error)
	}
}

export async function removePhotoAction(
	personId: string,
	url: string,
): Promise<PhotoResult> {
	try {
		const photos = await removePhoto(await getStore(), personId, url)
		revalidatePath("/")
		return { ok: true, photos }
	} catch (error) {
		return await toActionError(error)
	}
}

export async function setPrimaryPhotoAction(
	personId: string,
	url: string,
): Promise<PhotoResult> {
	try {
		const photos = await setPrimaryPhoto(await getStore(), personId, url)
		revalidatePath("/")
		return { ok: true, photos }
	} catch (error) {
		return await toActionError(error)
	}
}
