"use client"

import { NextIntlClientProvider } from "next-intl"
import { useEffect } from "react"
import { getMessages } from "@/lib/getMessages"
import { useLocale } from "@/lib/locale"

/**
 * The client half of the root layout: language, and the `<html>` attributes that
 * depend on it.
 *
 * `next-intl` used to resolve the request's locale on the server through
 * `i18n/request.ts`, which is what let `useTranslations` work in server *and*
 * client components without messages being threaded through props. With both
 * targets now static exports there is no request to resolve, so the catalogue is
 * chosen here and passed down explicitly. Every consumer of `useTranslations` is
 * a client component already, so nothing below this changes.
 *
 * Both catalogues are in the bundle either way — `getMessages` imports them
 * statically so a missing file is a build error — which is also why switching
 * language is instant and offline: there is nothing to fetch.
 */
export function Providers({ children }: { children: React.ReactNode }) {
	const [locale] = useLocale()

	// The prerendered HTML says `lang="en"`, because a build has no reader. Screen
	// readers and hyphenation care, so correct it once the stored value is known.
	useEffect(() => {
		document.documentElement.lang = locale
	}, [locale])

	return (
		<NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
			{children}
		</NextIntlClientProvider>
	)
}
