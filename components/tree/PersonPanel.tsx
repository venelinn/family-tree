"use client"

import {
	ChevronDown,
	Crosshair,
	MapPin,
	MoreHorizontal,
	Pencil,
	Trash2,
	UserPlus,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
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
import { Avatar } from "./Avatar"

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
}

/** Collapsible section. Open by default — the content is why you clicked. */
function Section({
	title,
	count,
	children,
	defaultOpen = true,
}: {
	title: string
	count?: number
	children: React.ReactNode
	defaultOpen?: boolean
}) {
	const [open, setOpen] = useState(defaultOpen)
	return (
		<section className="border-line-subtle border-t">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className="flex w-full items-center gap-1.5 px-5 py-3 text-left hover:bg-wash"
			>
				<span className="font-semibold text-[11px] text-ink-faint uppercase tracking-wide">
					{title}
				</span>
				{count != null ? (
					<span className="text-[11px] text-ink-ghost">{count}</span>
				) : null}
				<ChevronDown
					size={14}
					className={`ml-auto text-ink-faint transition-transform ${
						open ? "" : "-rotate-90"
					}`}
				/>
			</button>
			{open ? <div className="px-5 pb-4">{children}</div> : null}
		</section>
	)
}

/**
 * The line under the name: a span if we have both ends, otherwise whichever end
 * we have. Bulgarian inflects "born" and "died" for the subject, so the sex is
 * handed to the catalogue and the catalogue decides whether it matters.
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

	if (born && died) {
		return t("lifespan", {
			born: t("born", { sex: person.sex, date: born }),
			died: t("died", { sex: person.sex, date: died }),
		})
	}
	if (born) return t("born", { sex: person.sex, date: born })
	if (died) return t("died", { sex: person.sex, date: died })
	return person.deceased ? t("deceased", { sex: person.sex }) : t("noDates")
}

/** One row of the immediate-family list: photo, name, how they're related. */
function RelativeRow({
	person,
	relation,
	onFocus,
}: {
	person: Person
	relation: RelationKey
	onFocus: (personId: string) => void
}) {
	const t = useTranslations("panel")
	const tRelations = useTranslations("relations")

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
		<li>
			<button
				type="button"
				onClick={() => onFocus(person.id)}
				className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
			>
				<Avatar person={person} size={34} />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium text-ink text-sm">
						{person.name}
					</span>
					<span className="block text-ink-muted text-xs">
						{tRelations(relation)}
					</span>
					{years ? (
						<span className="block text-ink-faint text-xs">{years}</span>
					) : null}
				</span>
			</button>
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
			className="group flex flex-1 flex-col items-center gap-1 disabled:opacity-40"
		>
			<span
				className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
					active
						? "border-root-line bg-root-soft text-root-ink"
						: "border-line bg-wash text-ink-soft group-hover:border-line-strong group-hover:bg-muted group-enabled:group-hover:text-ink"
				}`}
			>
				{icon}
			</span>
			<span className="font-medium text-[10px] text-ink-muted">{label}</span>
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
			className={`w-full px-3 py-2 text-left text-sm hover:bg-wash ${
				danger ? "text-danger-text" : "text-ink-soft"
			}`}
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
}: PersonPanelProps) {
	const t = useTranslations("panel")
	const tFacts = useTranslations("facts")
	const locale = useLocale()
	const [menuOpen, setMenuOpen] = useState(false)

	if (!person) {
		return (
			<aside className="flex w-80 shrink-0 items-center justify-center border-line border-l bg-panel p-6 text-center text-ink-faint text-sm">
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
		<aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-line border-l bg-panel">
			<header className="px-5 pt-5 pb-4">
				<div className="flex items-start gap-3">
					{/* Keyed so a previous person's failed-photo state doesn't stick. */}
					<Avatar key={person.id} person={person} size={64} />
					<div className="min-w-0 flex-1">
						<h2 className="font-semibold text-ink text-lg leading-tight">
							{person.name}
						</h2>
						<p className="mt-1 text-ink-muted text-sm">
							<Lifespan person={person} />
						</p>
						{person.birthPlace ? (
							<p className="mt-0.5 text-ink-faint text-xs">
								{person.birthPlace}
							</p>
						) : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label={t("closeDetails")}
						className="rounded p-1 text-ink-faint hover:bg-muted hover:text-ink-soft"
					>
						✕
					</button>
				</div>

				{error ? (
					<p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-danger-ink text-sm">
						{error}
					</p>
				) : null}

				{/* One row for everything you can do to this person, rather than a
				    banner, a button pair and an accordion scattered down the panel. */}
				<div className="relative mt-4 flex items-start gap-1">
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
								className="fixed inset-0 z-10 cursor-default"
								onClick={() => setMenuOpen(false)}
							/>
							<div className="absolute top-12 right-0 z-20 w-56 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-lg">
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
								<div className="my-1 border-line-subtle border-t" />
								<MenuItem
									danger
									onClick={() => {
										setMenuOpen(false)
										// Deleting a person is not undoable in the app — the
										// only safety net is the store file itself.
										if (
											window.confirm(t("deleteConfirm", { name: person.name }))
										) {
											onDelete(person.id)
										}
									}}
								>
									<span className="flex items-center gap-2">
										<Trash2 size={13} strokeWidth={2} />
										{t("deletePerson")}
									</span>
								</MenuItem>
							</div>
						</>
					) : null}
				</div>
			</header>

			<Section title={t("sectionFacts")} count={facts.length}>
				{facts.length === 0 ? (
					<p className="text-ink-faint text-sm">{t("noFacts")}</p>
				) : (
					<ol className="space-y-3">
						{facts.map((fact) => {
							const related = fact.relatedId
								? graph.people.get(fact.relatedId)
								: undefined
							return (
								<li key={fact.id} className="flex gap-3">
									<div className="w-11 shrink-0 pt-0.5 text-right">
										<div className="font-semibold text-ink-soft text-sm tabular-nums">
											{fact.year ?? "—"}
										</div>
										{fact.age != null ? (
											<div className="text-[10px] text-ink-faint">
												{t("age", { age: fact.age })}
											</div>
										) : null}
									</div>
									<div className="min-w-0 flex-1 border-line-subtle border-l pl-3">
										<div className="font-medium text-ink text-sm">
											{tFacts(fact.titleKey)}
										</div>
										{related ? (
											<button
												type="button"
												onClick={() => onFocus(related.id)}
												className="mt-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-ink-soft text-xs hover:bg-muted"
											>
												<Avatar person={related} size={18} />
												<span className="truncate">{related.name}</span>
											</button>
										) : null}
										{fact.date ? (
											<div className="mt-0.5 text-ink-muted text-xs">
												{formatTreeDate(fact.date, locale)}
											</div>
										) : null}
										{fact.place ? (
											<div className="mt-0.5 flex items-start gap-1 text-ink-faint text-xs">
												<MapPin size={11} className="mt-0.5 shrink-0" />
												<span>{fact.place}</span>
											</div>
										) : null}
									</div>
								</li>
							)
						})}
					</ol>
				)}
			</Section>

			<Section title={t("sectionFamily")} count={family.length}>
				{family.length === 0 ? (
					<p className="text-ink-faint text-sm">{t("noRelatives")}</p>
				) : (
					<ul className="space-y-0.5">
						{family.map((relative) => (
							<RelativeRow
								key={relative.id}
								person={relative}
								relation={relationKeyFor(graph, person, relative)}
								onFocus={onFocus}
							/>
						))}
					</ul>
				)}
			</Section>
		</aside>
	)
}
