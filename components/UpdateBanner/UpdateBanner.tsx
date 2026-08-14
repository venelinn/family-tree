"use client"

import { Download } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { isTauri } from "@/lib/store/fs.client"
import styles from "./UpdateBanner.module.scss"

/**
 * Offers a new version when there is one. Desktop only.
 *
 * The web target updates by being reloaded, so this does nothing there. The
 * desktop app has no such luxury — it is an installed binary, and without this
 * the updater configuration in `tauri.conf.json` would sit there doing nothing
 * at all. Configuring an updater and never calling it is the failure mode worth
 * guarding against: everything looks right and no one ever gets a fix.
 *
 * Deliberately **offered, not applied**. An app that replaces itself under
 * somebody mid-edit is worse than one that waits, and this one edits a file that
 * matters. There is no auto-install, no nag on a timer, and no second prompt if
 * it is dismissed — it reappears on the next launch, which is soon enough.
 *
 * The check is the only network request the desktop app makes, and it sends a
 * version number and nothing else. See `docs/privacy.md`.
 */
export function UpdateBanner() {
	const t = useTranslations("app")
	const [update, setUpdate] = useState<{ version: string }>()
	const [busy, setBusy] = useState(false)
	const [dismissed, setDismissed] = useState(false)

	useEffect(() => {
		if (!isTauri()) return
		let current = true
		// Imported lazily so the web bundle never pulls in the updater at all.
		import("@tauri-apps/plugin-updater")
			.then(({ check }) => check())
			.then((found) => {
				if (current && found) setUpdate({ version: found.version })
			})
			.catch(() => {
				// Offline, or GitHub is having a day. An update check is the least
				// important thing this app does; it must never surface as an error
				// over somebody's family tree.
			})
		return () => {
			current = false
		}
	}, [])

	if (!update || dismissed) return null

	const install = async () => {
		setBusy(true)
		try {
			const [{ check }, { relaunch }] = await Promise.all([
				import("@tauri-apps/plugin-updater"),
				import("@tauri-apps/plugin-process"),
			])
			// Re-checked rather than held from the effect: the handle carries the
			// downloader, and holding one across an idle window risks acting on a
			// release that has since been replaced.
			const found = await check()
			if (!found) {
				setDismissed(true)
				return
			}
			await found.downloadAndInstall()
			await relaunch()
		} catch {
			// A failed download leaves the installed version untouched, which is the
			// right outcome. Dismiss rather than leave a button that does nothing.
			setDismissed(true)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className={styles.update} role="status">
			<span className={styles.update__text}>
				{t("updateAvailable", { version: update.version })}
			</span>
			<Button
				label={busy ? t("updateInstalling") : t("updateInstall")}
				variant="primary"
				size="sm"
				disabled={busy}
				icon={<Download size={14} strokeWidth={2} />}
				onClick={install}
			/>
			<Button
				label={t("updateLater")}
				variant="ghost"
				size="sm"
				disabled={busy}
				onClick={() => setDismissed(true)}
			/>
		</div>
	)
}
