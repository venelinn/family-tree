"use client"

import clsx from "clsx"
import { Settings } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/Button"
import { Heading } from "@/components/Heading"
import { usePersonName } from "@/components/PersonNames"
import { PersonSearch } from "@/components/PersonSearch"
import type { Person } from "@/lib/family-graph"
import type { ViewType } from "@/lib/layout/types"
import styles from "./Toolbar.module.scss"

interface ToolbarProps {
	/** The tree being viewed, not the person — there can be more than one. */
	treeName: string
	/** Everyone in the tree, for the search box. */
	people: Person[]
	/** Jump the chart to a search result. */
	onFocusPerson: (personId: string) => void
	view: ViewType
	onViewChange: (view: ViewType) => void
	focusPerson: Person | undefined
	visibleCount: number
	totalCount: number
	/** Generations shown — ancestors up in family view, columns in pedigree view. */
	depth: number
	onDepthChange: (depth: number) => void
	canReset: boolean
	onReset: () => void
}

const VIEWS = [
	{ id: "family", labelKey: "viewFamily" },
	{ id: "pedigree", labelKey: "viewPedigree" },
] as const satisfies ReadonlyArray<{ id: ViewType; labelKey: string }>

export function Toolbar({
	treeName,
	people,
	onFocusPerson,
	view,
	onViewChange,
	focusPerson,
	visibleCount,
	totalCount,
	depth,
	onDepthChange,
	canReset,
	onReset,
}: ToolbarProps) {
	const t = useTranslations("toolbar")
	const nameOf = usePersonName()

	return (
		<header className={styles.toolbar}>
			<div className={styles.toolbar__identity}>
				<Heading as="h1" size="base" className={styles.toolbar__title}>
					{focusPerson ? nameOf(focusPerson) : t("fallbackTitle")}
				</Heading>
				<p className={styles.toolbar__meta}>
					{treeName}
					<span className={styles.toolbar__separator}>·</span>
					{t("peopleCount", { visible: visibleCount, total: totalCount })}
				</p>
			</div>

			<div className={styles.toolbar__controls}>
				<PersonSearch people={people} onPick={onFocusPerson} />

				<label className={styles.toolbar__depth}>
					<span>{view === "family" ? t("generations") : t("columns")}</span>
					<input
						type="range"
						min={1}
						max={view === "family" ? 4 : 6}
						value={depth}
						onChange={(event) => onDepthChange(Number(event.target.value))}
						className={styles.toolbar__slider}
					/>
					<span className={styles.toolbar__depthValue}>{depth}</span>
				</label>

				{canReset ? (
					<Button
						label={t("backToMe")}
						variant="secondary"
						className={styles.toolbar__control}
						onClick={onReset}
					/>
				) : null}

				<div className={styles.toolbar__views}>
					{VIEWS.map(({ id, labelKey }) => {
						const isActive = view === id
						return (
							<Button
								key={id}
								label={t(labelKey)}
								// `aria-pressed` is the state a screen reader reads, and the
								// same boolean picks the variant — so the two can't disagree.
								aria-pressed={isActive}
								variant={isActive ? "secondary" : "ghost"}
								className={clsx(styles.toolbar__control, styles.toolbar__view)}
								onClick={() => onViewChange(id)}
							/>
						)
					})}
				</div>

				{/* Language lives on the settings page rather than in a toolbar
				    switcher — it is a preference you set once, not a control you
				    reach for while reading the chart. */}
				<Button
					href="/settings"
					title={t("settings")}
					aria-label={t("settings")}
					variant="secondary"
					icon={<Settings size={16} strokeWidth={2} />}
				/>
			</div>
		</header>
	)
}
