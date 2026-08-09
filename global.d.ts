import type { Locale } from "./lib/localization"
import type messages from "./messages/en.json"

/**
 * Type-checks translation *keys* against the reference catalogue, so a key
 * that's been renamed or dropped breaks the build instead of rendering as its
 * own name at runtime. Placeholders are not checked — a message wanting
 * `{ age }` and called without it fails when it renders, not when it compiles.
 *
 * `en.json` is the reference; the other catalogues are compared against it by
 * `pnpm i18n:check`.
 */
declare module "next-intl" {
	interface AppConfig {
		Locale: Locale
		Messages: typeof messages
	}
}
