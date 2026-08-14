"use client"

import clsx from "clsx"
import {
	Crosshair,
	Link2,
	MapPin,
	MoreHorizontal,
	Pencil,
	Trash2,
	Unlink,
	UserPlus,
	X,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { Accordion } from "@/components/Accordion"
import { Avatar } from "@/components/Avatar"
import { Button } from "@/components/Button"
import { FormError } from "@/components/Forms"
import { Heading } from "@/components/Heading"
import { usePersonName } from "@/components/PersonNames"
import { PhotoDrop } from "@/components/PhotoDrop"
import { ageOf } from "@/lib/age"
import { formatTreeDate } from "@/lib/date-format"
import {
	buildFacts,
	type RelationKey,
	relationKey as relationKeyFor,
} from "@/lib/facts"
import {
	byBirthYear,
	type FamilyGraph,
	getChildren,
	getParents,
	getSiblings,
	getSpouses,
	type Person,
} from "@/lib/family-graph"
import type { BranchState } from "@/lib/layout/types"
import styles from "./PersonPanel.module.scss"

interface PersonPanelProps {
	graph: FamilyGraph
	person: Person | undefined
	isRoot: boolean
	onClose: () => void
	/** Re-centre the whole chart on someone else. */
	onFocus: (personId: string) => void
	/** Branch state for this person, or undefined if they aren't on the chart. */
	branches?: {
		ancestors: BranchState
		descendants: BranchState
		hiddenAncestorCount: number
		hiddenDescendantCount: number
	}
	onToggleAncestors: (personId: string) => void
	onToggleDescendants: (personId: string) => void
	/** A mutation is in flight; disable destructive controls. */
	busy?: boolean
	error?: string
	onEdit: (personId: string) => void
	onDelete: (personId: string) => void
	/** Opens the ghost "Add …" cards on the canvas. Absent in the pedigree view. */
	onRequestAdd?: (personId: string) => void
	/** Edit a marriage from its row in the timeline — that fact *is* a union row. */
	onEditUnion: (unionId: string) => void
	/** Relate this person to somebody already in the tree. */
	onLink: (personId: string) => void
	/** Break a relationship, leaving both people in place. */
	onUnlink: (personId: string, relation: RelationKey, otherId: string) => void
}

/**
 * The line under the name: the dates, then the age in brackets — at death for
 * someone who has died, today for someone who hasn't.
 *
 * A birth date needs no "Born" in front of it; it is the first thing anyone
 * reads under a name. A lone death date does, or it looks like a birthday, and
 * Bulgarian inflects that word for the subject — hence the sex handed to the
 * catalogue, which decides whether it matters.
 *
 * A component rather than a helper because it needs the translator, and the
 * panel returns early when nobody is selected — a hook call after that would
 * break the rules of hooks.
 */
function Lifespan({ person }: { person: Person }) {
	const t = useTranslations("panel")
	const locale = useLocale()

	const born =
		formatTreeDate(person.birthDate, locale) ??
		(person.birthYear ? String(person.birthYear) : undefined)
	const died =
		formatTreeDate(person.deathDate, locale) ??
		(person.deathYear ? String(person.deathYear) : undefined)

	const dates =
		born && died
			? t("lifespan", { born, died })
			: born
				? born
				: died
					? t("died", { sex: person.sex, date: died })
					: person.deceased
						? t("deceased", { sex: person.sex })
						: t("noDates")

	const age = ageOf(person)
	return age == null ? dates : `${dates} ${t("ageParen", { age })}`
}

/** One row of the immediate-family list: photo, name, how they're related. */
function RelativeRow({
	person,
	relation,
	onFocus,
	onUnlink,
}: {
	person: Person
	relation: RelationKey
	onFocus: (personId: string) => void
	/** Absent for a relative whose link isn't one this panel can break. */
	onUnlink?: () => void
}) {
	const t = useTranslations("panel")
	const tRelations = useTranslations("relations")
	const nameOf = usePersonName()
	const [confirming, setConfirming] = useState(false)

	const years =
		person.birthYear && person.deathYear
			? t("lifespan", {
					born: String(person.birthYear),
					died: String(person.deathYear),
				})
			: person.birthYear
				? t("born", { sex: person.sex, date: String(person.birthYear) })
				: person.deceased
					? t("deceased", { sex: person.sex })
					: ""

	return (
		<li className={styles.relative}>
			<button
				type="button"
				onClick={() => onFocus(person.id)}
				className={styles.relative__link}
			>
				<Avatar person={person} size={34} />
				<span className={styles.relative__names}>
					<span className={styles.relative__name}>{nameOf(person)}</span>
					<span className={styles.relative__relation}>
						{tRelations(relation)}
					</span>
					{years ? (
						<span className={styles.relative__years}>{years}</span>
					) : null}
				</span>
			</button>

			{onUnlink ? (
				confirming ? (
					<span className={styles.relative__confirm}>
						<Button
							label={t("unlinkConfirm")}
							variant="danger"
							size="sm"
							className={styles.relative__yes}
							onClick={() => {
								setConfirming(false)
								onUnlink()
							}}
						/>
						<Button
							variant="ghost"
							aria-label={t("unlinkCancel")}
							className={styles.relative__cancel}
							icon={<X size={13} strokeWidth={2} />}
							onClick={() => setConfirming(false)}
						/>
					</span>
				) : (
					<Button
						variant="ghost"
						aria-label={t("unlink")}
						title={t("unlink")}
						className={styles.relative__unlink}
						icon={<Unlink size={13} strokeWidth={2} />}
						onClick={() => setConfirming(true)}
					/>
				)
			) : null}
		</li>
	)
}

/** One circular icon button with its label underneath. */
function Action({
	icon,
	label,
	onClick,
	disabled,
	active,
}: {
	icon: React.ReactNode
	label: string
	onClick: () => void
	disabled?: boolean
	active?: boolean
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={label}
			// `aria-current` rather than a class: "this is the one you are on" is
			// state a screen reader should hear, and the stylesheet reads the same
			// attribute.
			aria-current={active || undefined}
			className={styles.panel__action}
		>
			<span className={styles.panel__actionIcon}>{icon}</span>
			<span className={styles.panel__actionLabel}>{label}</span>
		</button>
	)
}

/** An entry in the overflow menu. */
function MenuItem({
	children,
	onClick,
	danger,
}: {
	children: React.ReactNode
	onClick: () => void
	danger?: boolean
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			data-danger={danger || undefined}
			className={styles.panel__menuItem}
		>
			{children}
		</button>
	)
}

export function PersonPanel({
	graph,
	person,
	isRoot,
	onClose,
	onFocus,
	branches,
	onToggleAncestors,
	onToggleDescendants,
	busy,
	error,
	onEdit,
	onDelete,
	onRequestAdd,
	onEditUnion,
	onLink,
	onUnlink,
}: PersonPanelProps) {
	const t = useTranslations("panel")
	const tFacts = useTranslations("facts")
	const locale = useLocale()
	const nameOf = usePersonName()
	const [menuOpen, setMenuOpen] = useState(false)

	if (!person) {
		return (
			<aside className={clsx(styles.panel, styles["panel--empty"])}>
				{t("empty")}
			</aside>
		)
	}

	// Ordered the way you'd introduce a family: partner, children, then parents
	// and siblings.
	const family = [
		...getSpouses(graph, person.id),
		...getChildren(graph, person.id).sort(byBirthYear),
		...getParents(graph, person.id).sort(byBirthYear),
		...getSiblings(graph, person.id).sort(byBirthYear),
	]
	const facts = buildFacts(graph, person)

	return (
		<aside className={styles.panel}>
			<header className={styles.panel__header}>
				<div className={styles.panel__identity}>
					{/* Keyed so a previous person's failed-photo state doesn't stick. */}
					<Avatar key={person.id} person={person} size={64} />
					<div className={styles.panel__names}>
						<Heading as="h2" size="h4">
							{nameOf(person)}
						</Heading>
						<p className={styles.panel__lifespan}>
							<Lifespan person={person} />
						</p>
						{/* Both names matter: the one she was born under is how she
						    appears in her parents' records, the one she took is how the
						    rest of the family knows her. */}
						{person.marriedName && person.marriedName !== person.surname ? (
							<p className={styles.panel__married}>
								{t("marriedNameLine", { name: person.marriedName })}
							</p>
						) : null}
						{person.birthPlace ? (
							<p className={styles.panel__place}>{person.birthPlace}</p>
						) : null}
					</div>
					<Button
						variant="ghost"
						size="sm"
						aria-label={t("closeDetails")}
						icon={<X size={15} strokeWidth={2} />}
						onClick={onClose}
					/>
				</div>

				<FormError className={styles.panel__error}>{error}</FormError>

				<div className={styles.panel__actions}>
					<Action
						icon={<Crosshair size={17} strokeWidth={2} />}
						label={isRoot ? t("centred") : t("centre")}
						active={isRoot}
						disabled={isRoot}
						onClick={() => onFocus(person.id)}
					/>
					<Action
						icon={<Pencil size={17} strokeWidth={2} />}
						label={t("edit")}
						onClick={() => onEdit(person.id)}
					/>
					<Action
						icon={<UserPlus size={17} strokeWidth={2} />}
						label={t("add")}
						disabled={!onRequestAdd}
						onClick={() => onRequestAdd?.(person.id)}
					/>
					<Action
						icon={<MoreHorizontal size={17} strokeWidth={2} />}
						label={t("more")}
						disabled={busy}
						onClick={() => setMenuOpen((open) => !open)}
					/>

					{menuOpen ? (
						<>
							{/* Backdrop so clicking anywhere else closes the menu. */}
							<button
								type="button"
								aria-label={t("closeMenu")}
								className={styles.panel__backdrop}
								onClick={() => setMenuOpen(false)}
							/>
							<div className={styles.panel__menu}>
								<MenuItem
									onClick={() => {
										onLink(person.id)
										setMenuOpen(false)
									}}
								>
									<span className={styles.panel__menuLine}>
										<Link2 size={14} strokeWidth={2} />
										{t("linkExisting")}
									</span>
								</MenuItem>
								{branches?.ancestors !== "none" && branches ? (
									<MenuItem
										onClick={() => {
											onToggleAncestors(person.id)
											setMenuOpen(false)
										}}
									>
										{branches.ancestors === "expandable"
											? t("showParents", {
													count: branches.hiddenAncestorCount,
												})
											: t("hideParents")}
									</MenuItem>
								) : null}
								{branches?.descendants !== "none" && branches ? (
									<MenuItem
										onClick={() => {
											onToggleDescendants(person.id)
											setMenuOpen(false)
										}}
									>
										{branches.descendants === "expandable"
											? t("showChildren", {
													count: branches.hiddenDescendantCount,
												})
											: t("hideChildren")}
									</MenuItem>
								) : null}
								<hr className={styles.panel__menuDivider} />
								<MenuItem
									danger
									onClick={() => {
										setMenuOpen(false)
										// Deleting a person is not undoable in the app — the
										// only safety net is the store file itself.
										if (
											window.confirm(
												t("deleteConfirm", { name: nameOf(person) }),
											)
										) {
											onDelete(person.id)
										}
									}}
								>
									<span className={styles.panel__menuLine}>
										<Trash2 size={13} strokeWidth={2} />
										{t("deletePerson")}
									</span>
								</MenuItem>
							</div>
						</>
					) : null}
				</div>
			</header>

			<Accordion title={t("sectionFacts")} count={facts.length}>
				{facts.length === 0 ? (
					<p className={styles.panel__empty}>{t("noFacts")}</p>
				) : (
					<ol className={styles.facts}>
						{facts.map((fact) => {
							const related = fact.relatedId
								? graph.people.get(fact.relatedId)
								: undefined
							// Bound outside the callback so it stays narrowed to a string.
							const { unionId } = fact
							return (
								<li key={fact.id} className={styles.fact}>
									<div className={styles.fact__when}>
										<div className={styles.fact__year}>{fact.year ?? "—"}</div>
										{fact.age != null ? (
											<div className={styles.fact__age}>
												{t("age", { age: fact.age })}
											</div>
										) : null}
									</div>
									<div className={styles.fact__body}>
										<div className={styles.fact__head}>
											<div className={styles.fact__title}>
												{tFacts(fact.titleKey)}
											</div>
											{unionId ? (
												<Button
													variant="ghost"
													aria-label={t("editMarriage")}
													title={t("editMarriage")}
													className={styles.fact__edit}
													icon={<Pencil size={12} strokeWidth={2} />}
													onClick={() => onEditUnion(unionId)}
												/>
											) : null}
										</div>
										{related ? (
											<button
												type="button"
												onClick={() => onFocus(related.id)}
												className={styles.fact__related}
											>
												<Avatar person={related} size={18} />
												<span className={styles.fact__relatedName}>
													{nameOf(related)}
												</span>
											</button>
										) : null}
										{fact.date ? (
											<div className={styles.fact__date}>
												{formatTreeDate(fact.date, locale)}
											</div>
										) : null}
										{fact.place ? (
											<div className={styles.fact__place}>
												<MapPin size={11} className={styles.fact__pin} />
												<span>{fact.place}</span>
											</div>
										) : null}
									</div>
								</li>
							)
						})}
					</ol>
				)}
			</Accordion>

			{person.note ? (
				<Accordion title={t("sectionNote")}>
					<p className={styles.note}>{person.note}</p>
				</Accordion>
			) : null}

			<Accordion title={t("sectionPhotos")} count={person.photos.length}>
				<PhotoDrop
					personId={person.id}
					photos={person.photos}
					name={nameOf(person)}
				/>
			</Accordion>

			<Accordion title={t("sectionFamily")} count={family.length}>
				{family.length === 0 ? (
					<p className={styles.panel__empty}>{t("noRelatives")}</p>
				) : (
					<ul className={styles.relatives}>
						{family.map((relative) => {
							const relation = relationKeyFor(graph, person, relative)
							return (
								<RelativeRow
									key={relative.id}
									person={relative}
									relation={relation}
									onFocus={onFocus}
									// "relative" means the graph couldn't name the connection,
									// so there is no single row to remove.
									onUnlink={
										relation === "relative"
											? undefined
											: () => onUnlink(person.id, relation, relative.id)
									}
								/>
							)
						})}
					</ul>
				)}
			</Accordion>
		</aside>
	)
}
