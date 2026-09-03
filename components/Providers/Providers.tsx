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
		/**
		 * Fixed rather than the environment's, which is what `next-intl` warns
		 * about: a static export is prerendered on a build machine and hydrated in
		 * a reader's browser, so an inherited zone is two different zones and the
		 * markup can differ between them.
		 *
		 * UTC because nothing here consumes it. Every date in the tree is free
		 * text formatted by `date-fns` in `lib/date-format.ts`, and none of them
		 * carries a time — so this only has to be *the same everywhere*, which a
		 * real zone like Europe/Sofia would satisfy while implying a meaning the
		 * app does not have.
		 */
		<NextIntlClientProvider
			locale={locale}
			messages={getMessages(locale)}
			timeZone="UTC"
		>
			{children}
		</NextIntlClientProvider>
	)
}
