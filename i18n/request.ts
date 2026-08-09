import { getRequestConfig } from "next-intl/server"
import { getMessages } from "@/lib/getMessages"
import { getUserLocale } from "@/lib/locale"

/**
 * Resolves the request's language and loads its catalogue. Wired in by the
 * `next-intl` plugin in `next.config.ts`, which is what lets `useTranslations`
 * work in server *and* client components without messages threaded by hand.
 *
 * This file lives where the plugin looks for it; the configuration it reads is
 * in `lib/localization.ts`.
 */
export default getRequestConfig(async () => {
	const locale = await getUserLocale()

	return { locale, messages: getMessages(locale) }
})
