"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { usePersonName } from "@/components/PersonNames"
import { PersonSearch } from "@/components/PersonSearch"
import type { Person } from "@/lib/family-graph"
import type { Relation } from "@/lib/tree-ops"

/**
 * Relate the selected person to somebody already in the tree.
 *
 * The ghost "Add …" cards always create a new person, which is right for the
 * common case and wrong for the one that produces duplicates: two people who
 * are both already on the chart. There is no merge in this app, so the way to
 * avoid duplicates is to make linking as easy as adding.
 *
 * Relation first, then who — the same order as the sentence you'd say out loud,
 * and it lets the search exclude nobody until it knows what it's looking for.
 */

interface LinkPersonFormProps {
	person: Person
	people: Person[]
	pending: boolean
	error?: string
	onSubmit: (relation: Relation, otherId: string) => void
	onCancel: () => void
}

const RELATIONS = [
	{ id: "parent", labelKey: "linkParent" },
	{ id: "spouse", labelKey: "linkSpouse" },
	{ id: "sibling", labelKey: "linkSibling" },
	{ id: "child", labelKey: "linkChild" },
] as const satisfies ReadonlyArray<{ id: Relation; labelKey: string }>

export function LinkPersonForm({
	person,
	people,
	pending,
	error,
	onSubmit,
	onCancel,
}: LinkPersonFormProps) {
	const t = useTranslations("panel")
	const tSearch = useTranslations("search")
	const nameOf = usePersonName()
	const [relation, setRelation] = useState<Relation>("spouse")

	return (
		<div className="flex flex-col gap-3 p-5">
			<h2 className="font-semibold text-ink">{t("linkTitle")}</h2>
			<p className="text-ink-muted text-sm">
				{t("linkHelp", { name: nameOf(person) })}
			</p>

			<fieldset>
				<legend className="block font-medium text-[11px] text-ink-muted uppercase tracking-wide">
					{t("linkRelation")}
				</legend>
				<div className="mt-1.5 grid grid-cols-2 gap-2">
					{RELATIONS.map((option) => (
						<button
							key={option.id}
							type="button"
							onClick={() => setRelation(option.id)}
							aria-pressed={relation === option.id}
							className={`rounded-lg border px-3 py-1.5 font-medium text-sm ${
								relation === option.id
									? "border-root-line bg-root-soft text-root-ink"
									: "border-line text-ink-muted hover:bg-wash"
							}`}
						>
							{t(option.labelKey)}
						</button>
					))}
				</div>
			</fieldset>

			<div>
				<span className="block font-medium text-[11px] text-ink-muted uppercase tracking-wide">
					{t("linkWho")}
				</span>
				<div className="mt-1.5">
					<PersonSearch
						people={people}
						excludeId={person.id}
						autoFocus
						placeholder={tSearch("pickPlaceholder")}
						onPick={(otherId) => onSubmit(relation, otherId)}
					/>
				</div>
			</div>

			{error ? (
				<p className="rounded-lg bg-danger-soft px-3 py-2 text-danger-ink text-sm">
					{error}
				</p>
			) : null}

			<button
				type="button"
				onClick={onCancel}
				disabled={pending}
				className="mt-1 rounded-lg border border-line px-3 py-2 font-medium text-ink-soft text-sm hover:bg-wash disabled:opacity-50"
			>
				{pending ? t("linkSaving") : t("linkCancel")}
			</button>
		</div>
	)
}
