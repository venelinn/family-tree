"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { THEME_COOKIE } from "./theme"
import { isThemePreference, type ThemePreference } from "./theming"

const ONE_YEAR = 60 * 60 * 24 * 365

/** Store the colour theme. Called from the settings page. */
export async function setUserTheme(theme: ThemePreference): Promise<void> {
	// This is an endpoint, so the value is validated here rather than trusted
	// from the caller.
	if (!isThemePreference(theme)) return

	;(await cookies()).set(THEME_COOKIE, theme, {
		maxAge: ONE_YEAR,
		path: "/",
		sameSite: "lax",
	})

	// The theme is an attribute on `<html>`, which the root layout renders — so
	// the whole tree is stale, including the chart in the client router cache.
	// Same reason as the locale; see `locale-actions.ts`.
	revalidatePath("/", "layout")
}
