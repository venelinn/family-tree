"use client"

import { Settings } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import type { Person } from "@/lib/family-graph"
import type { ViewType } from "@/lib/layout/types"

interface ToolbarProps {
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
		<header className="flex shrink-0 items-center gap-4 border-slate-200 border-b bg-white px-5 py-3">
			<div className="min-w-0">
				<h1 className="truncate font-semibold text-slate-900">
					{focusPerson?.name ?? t("fallbackTitle")}
				</h1>
				<p className="text-slate-400 text-xs">
					{t("peopleCount", { visible: visibleCount, total: totalCount })}
				</p>
			</div>

			<div className="ml-auto flex items-center gap-3">
				<label className="flex items-center gap-2 text-slate-500 text-xs">
					<span>{view === "family" ? t("generations") : t("columns")}</span>
					<input
						type="range"
						min={1}
						max={view === "family" ? 4 : 6}
						value={depth}
						onChange={(event) => onDepthChange(Number(event.target.value))}
						className="w-24 accent-slate-700"
					/>
					<span className="w-3 tabular-nums">{depth}</span>
				</label>

				{canReset ? (
					<button
						type="button"
						onClick={onReset}
						className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 text-sm hover:bg-slate-50"
					>
						{t("backToMe")}
					</button>
				) : null}

				<div className="flex rounded-lg bg-slate-100 p-0.5">
					{VIEWS.map(({ id, labelKey }) => (
						<button
							key={id}
							type="button"
							onClick={() => onViewChange(id)}
							className={`rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
								view === id
									? "bg-white text-slate-900 shadow-sm"
									: "text-slate-500 hover:text-slate-700"
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
					className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
				>
					<Settings size={16} strokeWidth={2} />
				</Link>
			</div>
		</header>
	)
}
