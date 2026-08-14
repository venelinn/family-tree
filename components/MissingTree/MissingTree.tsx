import { Settings } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/Button"
import styles from "./MissingTree.module.scss"

/**
 * The active tree's file is gone from where the registry says it is.
 *
 * A server component: it only reads the catalogue, so it renders to HTML and
 * ships no JavaScript — the one control on it is a link.
 */
export async function MissingTree({
	name,
	file,
}: {
	name: string
	/** Undefined for a browser-stored tree, which has no path to show. */
	file?: string
}) {
	const t = await getTranslations("errors")

	return (
		<main className={styles.missing}>
			<div className={styles.missing__card}>
				<p className={styles.missing__message}>
					{t("treeFileMissing", { name })}
				</p>
				{file ? <code className={styles.missing__path}>{file}</code> : null}
				<Button
					label={t("treeFileMissingAction")}
					href="/settings"
					variant="secondary"
					icon={<Settings size={14} strokeWidth={2} />}
				/>
			</div>
		</main>
	)
}
