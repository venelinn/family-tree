import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
	experimental: {
		// Photo uploads go through a server action, and the default 1MB body
		// limit rejects almost any real photograph. Kept in step with
		// `MAX_BYTES` in `lib/photos.ts`, which is what actually enforces it —
		// this only has to be large enough not to reject first.
		serverActions: { bodySizeLimit: "13mb" },
	},
}

// Picks up `i18n/request.ts`, which is what lets `useTranslations` work in
// server and client components without messages being threaded through props.
const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)
