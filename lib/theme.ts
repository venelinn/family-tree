import { cookies } from "next/headers"
import {
	defaultTheme,
	isThemePreference,
	type ThemePreference,
} from "./theming"

/**
 * The chosen theme lives in a cookie, read on the server, exactly like the
 * locale — see `locale.ts` for why that shape was picked.
 *
 * Reading it server-side is what avoids the usual dark-mode flash. The
 * alternative, a blocking inline script that reads `localStorage` before first
 * paint, exists because most apps can't know the preference until the client
 * runs. A cookie arrives with the request, so `<html data-theme>` is correct in
 * the very first byte of HTML.
 *
 * Reading is plain server code — see `theme-actions.ts` for the write, which has
 * to be a server action because only actions may set cookies.
 */

export const THEME_COOKIE = "theme"

export async function getUserTheme(): Promise<ThemePreference> {
	const stored = (await cookies()).get(THEME_COOKIE)?.value
	return isThemePreference(stored) ? stored : defaultTheme
}
