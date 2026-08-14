import type { AbstractIntlMessages } from "next-intl"
import bg from "../messages/bg.json"
import en from "../messages/en.json"
import { defaultLocale, type Locale } from "./localization"

/**
 * Catalogue per locale. Static imports rather than a dynamic
 * `import(\`../messages/${locale}.json\`)` so a missing file is a build error
 * instead of a runtime one.
 */
const messages: Record<Locale, AbstractIntlMessages> = { en, bg }

export const getMessages = (locale: Locale | string): AbstractIntlMessages =>
	messages[locale as Locale] ?? messages[defaultLocale]
