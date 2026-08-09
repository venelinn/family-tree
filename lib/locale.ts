import { cookies } from "next/headers"
import { defaultLocale, isLocale, type Locale } from "./localization"

/**
 * The chosen language lives in a cookie rather than the URL.
 *
 * There is no `/en` / `/bg` prefix and no middleware: this is a two-page app,
 * so a locale segment would buy shareable per-language links at the cost of
 * restructuring the routes and every `revalidatePath` call. The cookie keeps
 * `/` as `/`.
 *
 * Reading is plain server code — see `locale-actions.ts` for the write, which
 * has to be a server action because only actions may set cookies.
 */

export const LOCALE_COOKIE = "NEXT_LOCALE"

export async function getUserLocale(): Promise<Locale> {
	const stored = (await cookies()).get(LOCALE_COOKIE)?.value
	return isLocale(stored) ? stored : defaultLocale
}
