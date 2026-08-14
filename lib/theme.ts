"use client"

import { readPref, usePref, writePref } from "./prefs"
import {
	defaultTheme,
	isThemePreference,
	type ThemePreference,
} from "./theming"

/**
 * The chosen colour theme.
 *
 * This was a cookie, read on the server, and that is what used to avoid the
 * dark-mode flash: the value arrived with the request, so `<html data-theme>`
 * was already right in the first byte of HTML. With no server render left on
 * either target, that trade is gone and the blocking inline script below — the
 * thing the cookie existed to avoid — is back, because it is now the only way to
 * know the preference before first paint.
 *
 * It is a fair trade in a desktop app: no network, no request, ~200 bytes
 * running off local disk before the first frame.
 *
 * `system` is still not a third palette. It is the absence of a choice, which is
 * why the script *removes* the attribute for it rather than stamping it —
 * leaving `prefers-color-scheme` in `styles/_theme-dark.scss` in charge. See
 * `theming.ts`.
 */

export const THEME_KEY = "theme"

const parse = (raw: string | null): ThemePreference =>
	isThemePreference(raw) ? raw : defaultTheme

/** Read and write the theme. Re-renders every consumer on change. */
export const useTheme = () => usePref(THEME_KEY, defaultTheme, parse)

export const getUserTheme = () => readPref(THEME_KEY, parse)

/**
 * Store the theme and stamp it on `<html>` immediately.
 *
 * The attribute is set here rather than left to a React effect so the change is
 * synchronous with the click — a repaint one frame later is visible, and on the
 * settings page the swatch you just pressed is the thing being recoloured.
 */
export function setUserTheme(theme: ThemePreference): void {
	if (!isThemePreference(theme)) return
	writePref(THEME_KEY, theme)
	applyTheme(theme)
}

export function applyTheme(theme: ThemePreference): void {
	const root = globalThis.document?.documentElement
	if (!root) return
	if (theme === "system") root.removeAttribute("data-theme")
	else root.setAttribute("data-theme", theme)
}

/**
 * Runs blocking in `<head>`, before the body exists.
 *
 * Deliberately tiny and dependency-free — it is inlined as a string, so it
 * cannot import anything, and it must not throw: a `localStorage` that refuses
 * to answer has to leave the OS in charge rather than take the page down before
 * it renders. Hence the bare `try`.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`
