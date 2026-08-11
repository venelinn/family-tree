/**
 * The colour themes the app offers.
 *
 * Same shape as `localization.ts`, and deliberately so — theme and language are
 * the same kind of thing here: one preference, stored in one cookie, chosen on
 * `/settings`.
 *
 * `system` is not a third palette. It is the *absence* of a choice, which lets
 * the `prefers-color-scheme` query in `styles/_theme-dark.scss` — the one no
 * explicit `[data-theme]` overrides — defer to the operating system.
 * Keeping it as a stored value rather than "no cookie" matters: it is how a user
 * who picked dark once gets back to following the OS.
 */

export const theming = {
	themes: ["system", "light", "dark"],
	defaultTheme: "system",
} as const

export type ThemePreference = (typeof theming.themes)[number]

export const defaultTheme: ThemePreference = theming.defaultTheme

export function isThemePreference(
	value: string | undefined | null,
): value is ThemePreference {
	return value != null && (theming.themes as readonly string[]).includes(value)
}
