import type { Metadata } from "next"
import { Raleway } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { getUserTheme } from "@/lib/theme"
import "./globals.css"

/**
 * The one webfont in the project.
 *
 * Cyrillic is loaded for Bulgarian. It costs nothing when unused — the subsets
 * are separate files behind `unicode-range`, so a Latin-only page never fetches
 * it. Raleway carries both, which not every display face does; a family tree
 * that cannot spell its own family's names is not a font choice.
 *
 * `next/font` fetches at build time and self-hosts the result, so there is no
 * request to Google from anybody's browser. That matters more here than it
 * usually does — see `docs/privacy.md`.
 *
 * Variable font, so no `weight`: the whole 100–900 axis arrives in one file and
 * every `font-medium` in the app is real rather than synthesised.
 *
 * Monospace is the system stack, set in `globals.css`. File paths and hashes
 * need to line up; they do not need a download to do it.
 */
const raleway = Raleway({
	variable: "--font-raleway",
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
		// The font class goes on `<html>`, not `<body>`, and that placement is
		// load-bearing. `globals.css` declares `--font-sans: var(--font-raleway)`
		// on `:root`, and a custom property is resolved on the element that
		// declares it — so with `--font-raleway` defined one level down on the
		// body, `--font-sans` resolved against nothing, went invalid, took
		// `body`'s `font-family` with it, and every page fell back to the
		// system stack. Same element, and the chain resolves.
		<html
			lang={locale}
			data-theme={theme}
			className={`${raleway.variable} antialiased`}
		>
			<body>
				{/* No `messages` prop: rendered from a Server Component, the provider
				    picks up the request's catalogue on its own. */}
				<NextIntlClientProvider>{children}</NextIntlClientProvider>
			</body>
		</html>
	)
}
