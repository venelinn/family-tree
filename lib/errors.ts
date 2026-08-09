/**
 * Failures the user is meant to read.
 *
 * `tree-ops` runs on the server and has no locale, so it raises a *code* and
 * the values to interpolate; `lib/actions.ts` translates it at the boundary,
 * where the request's language is known. That keeps "Venelin already has a
 * father" as a real message in either language instead of a generic failure.
 */

export type ErrorCode =
	| "nameRequired"
	| "noSuchPerson"
	| "alreadyHasFather"
	| "alreadyHasMother"
	| "ownRelative"
	| "bothMustExist"
	| "alreadySibling"
	| "alreadyHasParent"
	| "alreadyHasParents"
	| "alreadyMarried"

export class TreeOpError extends Error {
	constructor(
		readonly code: ErrorCode,
		readonly values?: Record<string, string>,
	) {
		// The code is the fallback message, so an untranslated throw still says
		// something in a server log.
		super(code)
		this.name = "TreeOpError"
	}
}
