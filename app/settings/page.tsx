"use client"

import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/Button"
import { Heading } from "@/components/Heading"
import { LanguagePicker } from "@/components/LanguagePicker"
import { NameLanguagePicker } from "@/components/NameLanguagePicker"
import { Panel } from "@/components/Panel"
import { ThemePicker } from "@/components/ThemePicker"
import { TreeManager } from "@/components/TreeManager"
import { useTreeList } from "@/lib/client-data"
import styles from "./settings.module.scss"

/**
 * The three pickers each own their own preference now — they read and write one
 * stored value — so none of them is passed a `current`. Only the tree list still
 * arrives as data, because it is the one thing on this page that comes from the
 * store rather than from the reader.
 */
export default function SettingsPage() {
	const t = useTranslations("settings")
	const list = useTreeList()

	return (
		<main className={styles.settings}>
			<header className={styles.settings__header}>
				<div className={styles.settings__bar}>
					<Button
						label={t("back")}
						href="/"
						variant="secondary"
						icon={<ArrowLeft size={15} strokeWidth={2} />}
					/>
					<Heading as="h1" size="base">
						{t("title")}
					</Heading>
				</div>
			</header>

			<div className={styles.settings__body}>
				<Panel title={t("treesTitle")} description={t("treesHelp")}>
					{/* Rendered only once the list has actually been read; an empty
					    list and a list not yet loaded mean different things here, and
					    the manager offers to create a tree on the strength of it. */}
					{list && <TreeManager trees={list.trees} activeId={list.activeId} />}
				</Panel>

				<Panel title={t("themeTitle")} description={t("themeHelp")}>
					<ThemePicker />
				</Panel>

				<Panel title={t("languageTitle")} description={t("languageHelp")}>
					<LanguagePicker />
				</Panel>

				{/* Directly under the language, because it only means anything in
				    relation to it. */}
				<Panel title={t("namesTitle")} description={t("namesHelp")}>
					<NameLanguagePicker />
				</Panel>
			</div>
		</main>
	)
}
