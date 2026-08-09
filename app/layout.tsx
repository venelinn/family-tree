import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { getUserTheme } from "@/lib/theme"
import "./globals.css"

// Cyrillic is loaded for Bulgarian. It costs nothing when unused — the subsets
// are separate files behind `unicode-range`, so a Latin-only page never fetches
// it.
const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin", "cyrillic"],
})

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin", "cyrillic"],
})

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
		// no selector matches it, which is what leaves `color-scheme: light dark`
		// in place to follow the OS.
		<html lang={locale} data-theme={theme}>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				{/* No `messages` prop: rendered from a Server Component, the provider
				    picks up the request's catalogue on its own. */}
				<NextIntlClientProvider>{children}</NextIntlClientProvider>
			</body>
		</html>
	)
}
