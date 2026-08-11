import { ArrowLeft } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { Button } from "@/components/Button"
import { Heading } from "@/components/Heading"
import { LanguagePicker } from "@/components/LanguagePicker"
import { NameLanguagePicker } from "@/components/NameLanguagePicker"
import { Panel } from "@/components/Panel"
import { ThemePicker } from "@/components/ThemePicker"
import { TreeManager } from "@/components/TreeManager"
import { getActiveTree } from "@/lib/active-tree"
import { getNamesFollowLanguage } from "@/lib/name-language"
import { listTrees } from "@/lib/store/registry"
import { getUserTheme } from "@/lib/theme"
import styles from "./settings.module.scss"

export default async function SettingsPage() {
	const t = await getTranslations("settings")
	const locale = await getLocale()
	const theme = await getUserTheme()
	const trees = await listTrees()
	const active = await getActiveTree()
	const namesFollowLanguage = await getNamesFollowLanguage()

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
					<TreeManager trees={trees} activeId={active?.id} />
				</Panel>

				<Panel title={t("themeTitle")} description={t("themeHelp")}>
					<ThemePicker current={theme} />
				</Panel>

				<Panel title={t("languageTitle")} description={t("languageHelp")}>
					<LanguagePicker current={locale} />
				</Panel>

				{/* Directly under the language, because it only means anything in
				    relation to it. */}
				<Panel title={t("namesTitle")} description={t("namesHelp")}>
					<NameLanguagePicker current={namesFollowLanguage} />
				</Panel>
			</div>
		</main>
	)
}
