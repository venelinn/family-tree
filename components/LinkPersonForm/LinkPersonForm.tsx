"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { Button } from "@/components/Button"
import { FormError } from "@/components/Forms"
import { Heading } from "@/components/Heading"
import { usePersonName } from "@/components/PersonNames"
import { PersonSearch } from "@/components/PersonSearch"
import { RelationIcon } from "@/components/RelationIcon"
import type { Person } from "@/lib/family-graph"
import type { Relation } from "@/lib/tree-ops"
import styles from "./LinkPersonForm.module.scss"

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
		<div className={styles.linkForm}>
			<Heading as="h2" size="base">
				{t("linkTitle")}
			</Heading>
			<p className={styles.linkForm__help}>
				{t("linkHelp", { name: nameOf(person) })}
			</p>

			<fieldset>
				<legend className={styles.linkForm__legend}>{t("linkRelation")}</legend>
				<div className={styles.linkForm__options}>
					{RELATIONS.map((option) => (
						<Button
							key={option.id}
							label={t(option.labelKey)}
							variant="secondary"
							icon={<RelationIcon relation={option.id} size={15} />}
							aria-pressed={relation === option.id}
							className={styles.linkForm__option}
							onClick={() => setRelation(option.id)}
						/>
					))}
				</div>
			</fieldset>

			<div>
				<span className={styles.linkForm__label}>{t("linkWho")}</span>
				<div className={styles.linkForm__who}>
					<PersonSearch
						people={people}
						excludeId={person.id}
						autoFocus
						placeholder={tSearch("pickPlaceholder")}
						onPick={(otherId) => onSubmit(relation, otherId)}
					/>
				</div>
			</div>

			<FormError>{error}</FormError>

			<Button
				label={pending ? t("linkSaving") : t("linkCancel")}
				variant="secondary"
				disabled={pending}
				onClick={onCancel}
			/>
		</div>
	)
}
