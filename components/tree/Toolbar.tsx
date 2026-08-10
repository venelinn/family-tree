"use client"

import { Settings } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import type { Person } from "@/lib/family-graph"
import type { ViewType } from "@/lib/layout/types"
import { PersonSearch } from "./PersonSearch"

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

	return (
		<header className="flex shrink-0 items-center gap-4 border-line border-b bg-panel px-5 py-3">
			<div className="min-w-0">
				<h1 className="truncate font-semibold text-ink">
					{focusPerson?.name ?? t("fallbackTitle")}
				</h1>
				<p className="truncate text-ink-faint text-xs">
					{treeName}
					<span className="mx-1.5 text-ink-ghost">·</span>
					{t("peopleCount", { visible: visibleCount, total: totalCount })}
				</p>
			</div>

			<div className="ml-auto flex items-center gap-3">
				<PersonSearch people={people} onPick={onFocusPerson} />

				<label className="flex items-center gap-2 text-ink-muted text-xs">
					<span>{view === "family" ? t("generations") : t("columns")}</span>
					<input
						type="range"
						min={1}
						max={view === "family" ? 4 : 6}
						value={depth}
						onChange={(event) => onDepthChange(Number(event.target.value))}
						className="w-24 accent-invert"
					/>
					<span className="w-3 tabular-nums">{depth}</span>
				</label>

				{canReset ? (
					<button
						type="button"
						onClick={onReset}
						className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft text-sm hover:bg-wash"
					>
						{t("backToMe")}
					</button>
				) : null}

				<div className="flex rounded-lg bg-muted p-0.5">
					{VIEWS.map(({ id, labelKey }) => (
						<button
							key={id}
							type="button"
							onClick={() => onViewChange(id)}
							className={`rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
								view === id
									? "bg-panel text-ink shadow-sm"
									: "text-ink-muted hover:text-ink-soft"
							}`}
						>
							{t(labelKey)}
						</button>
					))}
				</div>

				{/* Language lives on the settings page rather than in a toolbar
				    switcher — it is a preference you set once, not a control you
				    reach for while reading the chart. */}
				<Link
					href="/settings"
					title={t("settings")}
					aria-label={t("settings")}
					className="rounded-lg border border-line p-2 text-ink-muted hover:bg-wash hover:text-ink"
				>
					<Settings size={16} strokeWidth={2} />
				</Link>
			</div>
		</header>
	)
}
