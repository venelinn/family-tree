import type { Metadata } from "next"
import { Providers } from "@/components/Providers"
import { UpdateBanner } from "@/components/UpdateBanner"
import { raleway } from "@/lib/fonts"
import { defaultLocale } from "@/lib/localization"
import { themeInitScript } from "@/lib/theme"
import "@/styles/globals.scss"

/**
 * Static, because a build has no reader to ask.
 *
 * This used to be `generateMetadata` calling `getTranslations`, which worked
 * when there was a request whose locale could be resolved. There isn't one now,
 * so a translated title would just bake whichever language built last. The
 * desktop app takes its window title from `src-tauri/tauri.conf.json` and never
 * shows this; the web tab shows the app's name, which is a proper noun anyway.
 */
export const metadata: Metadata = {
	title: "Family Tree",
	description: "A private, offline family tree.",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		// `lang` is the default here and corrected on hydration by `Providers`;
		// `data-theme` is stamped by the script below before anything paints.
		<html lang={defaultLocale} suppressHydrationWarning>
			<head>
				{/*
				  Blocking, and first. The theme was a cookie precisely so this
				  wouldn't be needed — see `lib/theme.ts` — but with no server
				  render there is nothing earlier than this that knows the answer.
				  `suppressHydrationWarning` above is because this script mutates
				  the very element React is about to reconcile.
				*/}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: the only way to run before first paint; the content is a constant, not user input */}
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
			</head>
			<body className={raleway.className}>
				<Providers>
					{children}
					{/* Desktop only; renders nothing on the web, which updates by
					    being reloaded. */}
					<UpdateBanner />
				</Providers>
			</body>
		</html>
	)
}
