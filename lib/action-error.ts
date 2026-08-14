import { getTranslations } from "next-intl/server"
import { type ErrorCode, TreeOpError } from "./errors"

/**
 * Where an error *code* becomes a sentence the reader understands.
 *
 * Shared by every server action, because the boundary is the only place that
 * knows the request's language — see `errors.ts`. Kept out of the `"use server"`
 * files themselves: those may only export async functions, so a helper living
 * there could not be imported by the others.
 */

/**
 * The handful of `errno` values that mean something the user can act on.
 *
 * This app's whole premise is writing to a path somebody chose, so the
 * interesting failures are all about that path: an external drive that is
 * full, a volume mounted read-only, and — the common one on macOS — the
 * operating system refusing the process access to Desktop, Documents or a
 * removable volume until it is granted in System Settings. Every one of those
 * arrived as "Something went wrong", which is true and useless.
 *
 * This app cannot grant itself any of them: the permission belongs to whatever
 * runs `next dev` (Terminal, iTerm, VS Code), macOS prompts that process on
 * first touch, and a denial comes back as `EPERM`. Saying which switch to flip
 * is the most it can do, and it is a lot more than "unknown".
 */
const ERRNO_MESSAGES: Record<string, ErrorCode> = {
	EPERM: "pathNotPermitted",
	EACCES: "pathNotPermitted",
	ENOSPC: "diskFull",
	EROFS: "diskReadOnly",
}

export async function toActionError(
	error: unknown,
): Promise<{ ok: false; error: string }> {
	const t = await getTranslations("errors")
	// `ErrorCode` is a subset of the `errors` keys, so a code with no message
	// is a compile error rather than a raw code shown to the user.
	if (error instanceof TreeOpError) {
		return { ok: false, error: t(error.code, error.values) }
	}

	const errno = (error as NodeJS.ErrnoException | undefined)?.code
	const mapped = errno ? ERRNO_MESSAGES[errno] : undefined
	if (mapped) {
		return {
			ok: false,
			error: t(mapped, {
				path: (error as NodeJS.ErrnoException).path ?? "",
			}),
		}
	}

	return { ok: false, error: t("unknown") }
}
