"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { NAME_LANGUAGE_COOKIE } from "./name-language"

const ONE_YEAR = 60 * 60 * 24 * 365

/** Store whether names follow the language. Called from the settings page. */
export async function setNamesFollowLanguage(follow: boolean): Promise<void> {
	// This is an endpoint, so the value is validated here rather than trusted
	// from the caller.
	if (typeof follow !== "boolean") return

	;(await cookies()).set(NAME_LANGUAGE_COOKIE, follow ? "on" : "off", {
		maxAge: ONE_YEAR,
		path: "/",
		sameSite: "lax",
	})

	// The chart renders names on every card, so the whole tree is stale —
	// including the client router cache the user navigates back into. Same
	// reason as the locale; see `locale-actions.ts`.
	revalidatePath("/", "layout")
}
