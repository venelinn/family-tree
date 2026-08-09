import { getTranslations } from "next-intl/server"
import { TreeOpError } from "./errors"

/**
 * Where an error *code* becomes a sentence the reader understands.
 *
 * Shared by every server action, because the boundary is the only place that
 * knows the request's language — see `errors.ts`. Kept out of the `"use server"`
 * files themselves: those may only export async functions, so a helper living
 * there could not be imported by the others.
 */
export async function toActionError(
	error: unknown,
): Promise<{ ok: false; error: string }> {
	const t = await getTranslations("errors")
	// `ErrorCode` is a subset of the `errors` keys, so a code with no message
	// is a compile error rather than a raw code shown to the user.
	if (error instanceof TreeOpError) {
		return { ok: false, error: t(error.code, error.values) }
	}
	return { ok: false, error: t("unknown") }
}
