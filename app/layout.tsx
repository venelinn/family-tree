import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { raleway } from "@/lib/fonts"
import { getUserTheme } from "@/lib/theme"
import "@/styles/globals.scss"

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("app")
	return {
		title: t("title"),
		description: t("description"),
	}
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const locale = await getLocale()
	const theme = await getUserTheme()

	return (
		// Rendered from the cookie on the server, so the first paint is already
		// the right theme — no flash, and no blocking script in `<head>`.
		// `system` is stamped too, purely so the choice is visible in devtools;
		// no `[data-theme]` rule matches it, which is what leaves the
		// `prefers-color-scheme` query in `styles/_theme-dark.scss` in charge and
		// lets the OS decide.
		<html lang={locale} data-theme={theme}>
			<body className={raleway.className}>
				{/* No `messages` prop: rendered from a Server Component, the provider
				    picks up the request's catalogue on its own. */}
				<NextIntlClientProvider>{children}</NextIntlClientProvider>
			</body>
		</html>
	)
}
