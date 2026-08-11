import { Raleway } from "next/font/google"

/**
 * The one webfont in the project.
 *
 * Its own module, applied as `raleway.className` on `<body>` in the root
 * layout. The earlier arrangement handed the family to CSS as a custom property
 * declared by `@theme` — which meant the class had to sit on the *same* element
 * the property resolved against, and moving it one level down silently
 * invalidated `font-family` for the whole app. A class carries the family
 * directly and inherits, so there is nothing left to get wrong.
 *
 * Cyrillic is loaded for Bulgarian. It costs nothing when unused — the subsets
 * are separate files behind `unicode-range`, so a Latin-only page never fetches
 * it. Raleway carries both, which not every display face does; a family tree
 * that cannot spell its own family's names is not a font choice.
 *
 * No `weight`, unlike bgmtl's otherwise identical setup: Raleway is a variable
 * font, so the whole 100–900 axis arrives in one file and every weight the type
 * scale asks for is real rather than synthesised. Listing weights would fetch
 * nine static cuts instead.
 *
 * `next/font` fetches at build time and self-hosts the result, so there is no
 * request to Google from anybody's browser. That matters more here than it
 * usually does — see `docs/privacy.md`.
 */
export const raleway = Raleway({
	subsets: ["latin", "cyrillic"],
	display: "swap",
	style: "normal",
})
