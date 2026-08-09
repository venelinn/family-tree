"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { LOCALE_COOKIE } from "./locale"
import { isLocale, type Locale } from "./localization"

const ONE_YEAR = 60 * 60 * 24 * 365

/** Store the interface language. Called from the settings page. */
export async function setUserLocale(locale: Locale): Promise<void> {
	// This is an endpoint, so the value is validated here rather than trusted
	// from the caller.
	if (!isLocale(locale)) return

	;(await cookies()).set(LOCALE_COOKIE, locale, {
		maxAge: ONE_YEAR,
		path: "/",
		sameSite: "lax",
	})

	// Every rendered string on every route just changed, so the whole tree is
	// stale — including the chart the user will navigate back to, which would
	// otherwise come out of the client router cache in the old language.
	revalidatePath("/", "layout")
}
