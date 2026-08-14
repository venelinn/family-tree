import { readFileSync } from "node:fs"
import { join } from "node:path"
import { localization } from "../lib/localization"

/**
 * Message-key parity check.
 *
 * A key missing from a translation renders as the key itself at runtime, which
 * is easy to miss in a language you don't read. `en.json` is the reference; the
 * rest are compared against it, both ways — a stale key left behind after a
 * rename is worth knowing about too.
 */

const MESSAGES_DIR = join(import.meta.dirname, "..", "messages")

type Json = { [key: string]: Json | string }

const flatten = (value: Json, prefix = ""): string[] =>
	Object.entries(value).flatMap(([key, child]) =>
		typeof child === "object"
			? flatten(child, `${prefix}${key}.`)
			: [prefix + key],
	)

const keysOf = (locale: string) =>
	new Set(
		flatten(
			JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8")),
		),
	)

const reference = keysOf("en")
let failed = false

for (const locale of localization.locales) {
	if (locale === "en") continue

	const keys = keysOf(locale)
	const missing = [...reference].filter((key) => !keys.has(key))
	const extra = [...keys].filter((key) => !reference.has(key))

	if (missing.length === 0 && extra.length === 0) {
		console.log(`✓ ${locale}: ${keys.size} keys, in step with en`)
		continue
	}

	failed = true
	if (missing.length)
		console.error(`✗ ${locale} is missing:\n  ${missing.join("\n  ")}`)
	if (extra.length)
		console.error(`✗ ${locale} has keys en doesn't:\n  ${extra.join("\n  ")}`)
}

process.exit(failed ? 1 : 0)
