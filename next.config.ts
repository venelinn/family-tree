import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {
	/* config options here */
}

// Picks up `i18n/request.ts`, which is what lets `useTranslations` work in
// server and client components without messages being threaded through props.
const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)
