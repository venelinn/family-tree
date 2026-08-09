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
import { useState } from "react"
import { buildFacts, relationLabel } from "@/lib/facts"
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
		<section className="border-slate-100 border-t">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className="flex w-full items-center gap-1.5 px-5 py-3 text-left hover:bg-slate-50"
			>
				<span className="font-semibold text-[11px] text-slate-400 uppercase tracking-wide">
					{title}
				</span>
				{count != null ? (
					<span className="text-[11px] text-slate-300">{count}</span>
				) : null}
				<ChevronDown
					size={14}
					className={`ml-auto text-slate-400 transition-transform ${
						open ? "" : "-rotate-90"
					}`}
				/>
			</button>
			{open ? <div className="px-5 pb-4">{children}</div> : null}
		</section>
	)
}

function lifespan(person: Person): string {
	const born =
		person.birthDate ??
		(person.birthYear ? String(person.birthYear) : undefined)
	const died =
		person.deathDate ??
		(person.deathYear ? String(person.deathYear) : undefined)
	if (born && died) return `${born} – ${died}`
	if (born) return `Born ${born}`
	if (died) return `Died ${died}`
	return person.deceased ? "Deceased" : "No dates recorded"
}

/** One row of the immediate-family list: photo, name, how they're related. */
function RelativeRow({
	person,
	label,
	onFocus,
}: {
	person: Person
	label: string
	onFocus: (personId: string) => void
}) {
	const years =
		person.birthYear && person.deathYear
			? `${person.birthYear} – ${person.deathYear}`
			: person.birthYear
				? `Born ${person.birthYear}`
				: person.deceased
					? "Deceased"
					: ""

	return (
		<li>
			<button
				type="button"
				onClick={() => onFocus(person.id)}
				className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
			>
				<Avatar person={person} size={34} />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium text-slate-800 text-sm">
						{person.name}
					</span>
					<span className="block text-slate-500 text-xs">{label}</span>
					{years ? (
						<span className="block text-slate-400 text-xs">{years}</span>
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
						? "border-emerald-300 bg-emerald-50 text-emerald-600"
						: "border-slate-200 bg-slate-50 text-slate-600 group-hover:border-slate-300 group-hover:bg-slate-100 group-enabled:group-hover:text-slate-900"
				}`}
			>
				{icon}
			</span>
			<span className="font-medium text-[10px] text-slate-500">{label}</span>
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
			className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
				danger ? "text-rose-600" : "text-slate-700"
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
	const [menuOpen, setMenuOpen] = useState(false)

	if (!person) {
		return (
			<aside className="flex w-80 shrink-0 items-center justify-center border-slate-200 border-l bg-white p-6 text-center text-slate-400 text-sm">
				Select anyone in the tree to see their details.
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
		<aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-slate-200 border-l bg-white">
			<header className="px-5 pt-5 pb-4">
				<div className="flex items-start gap-3">
					{/* Keyed so a previous person's failed-photo state doesn't stick. */}
					<Avatar key={person.id} person={person} size={64} />
					<div className="min-w-0 flex-1">
						<h2 className="font-semibold text-lg text-slate-900 leading-tight">
							{person.name}
						</h2>
						<p className="mt-1 text-slate-500 text-sm">{lifespan(person)}</p>
						{person.birthPlace ? (
							<p className="mt-0.5 text-slate-400 text-xs">
								{person.birthPlace}
							</p>
						) : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close details"
						className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					>
						✕
					</button>
				</div>

				{error ? (
					<p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-rose-700 text-sm">
						{error}
					</p>
				) : null}

				{/* One row for everything you can do to this person, rather than a
				    banner, a button pair and an accordion scattered down the panel. */}
				<div className="relative mt-4 flex items-start gap-1">
					<Action
						icon={<Crosshair size={17} strokeWidth={2} />}
						label={isRoot ? "Centred" : "Centre"}
						active={isRoot}
						disabled={isRoot}
						onClick={() => onFocus(person.id)}
					/>
					<Action
						icon={<Pencil size={17} strokeWidth={2} />}
						label="Edit"
						onClick={() => onEdit(person.id)}
					/>
					<Action
						icon={<UserPlus size={17} strokeWidth={2} />}
						label="Add"
						disabled={!onRequestAdd}
						onClick={() => onRequestAdd?.(person.id)}
					/>
					<Action
						icon={<MoreHorizontal size={17} strokeWidth={2} />}
						label="More"
						disabled={busy}
						onClick={() => setMenuOpen((open) => !open)}
					/>

					{menuOpen ? (
						<>
							{/* Backdrop so clicking anywhere else closes the menu. */}
							<button
								type="button"
								aria-label="Close menu"
								className="fixed inset-0 z-10 cursor-default"
								onClick={() => setMenuOpen(false)}
							/>
							<div className="absolute top-12 right-0 z-20 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
								{branches?.ancestors !== "none" && branches ? (
									<MenuItem
										onClick={() => {
											onToggleAncestors(person.id)
											setMenuOpen(false)
										}}
									>
										{branches.ancestors === "expandable"
											? `Show ${branches.hiddenAncestorCount} hidden parents`
											: "Hide parents"}
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
											? `Show ${branches.hiddenDescendantCount} hidden children`
											: "Hide children"}
									</MenuItem>
								) : null}
								<div className="my-1 border-slate-100 border-t" />
								<MenuItem
									danger
									onClick={() => {
										setMenuOpen(false)
										// Deleting a person is not undoable in the app — the
										// only safety net is the store file itself.
										if (
											window.confirm(
												`Delete ${person.name}? Their relationships will be removed too. This cannot be undone.`,
											)
										) {
											onDelete(person.id)
										}
									}}
								>
									<span className="flex items-center gap-2">
										<Trash2 size={13} strokeWidth={2} />
										Delete person
									</span>
								</MenuItem>
							</div>
						</>
					) : null}
				</div>
			</header>

			<Section title="Facts" count={facts.length}>
				{facts.length === 0 ? (
					<p className="text-slate-400 text-sm">Nothing recorded yet.</p>
				) : (
					<ol className="space-y-3">
						{facts.map((fact) => {
							const related = fact.relatedId
								? graph.people.get(fact.relatedId)
								: undefined
							return (
								<li key={fact.id} className="flex gap-3">
									<div className="w-11 shrink-0 pt-0.5 text-right">
										<div className="font-semibold text-slate-700 text-sm tabular-nums">
											{fact.year ?? "—"}
										</div>
										{fact.age != null ? (
											<div className="text-[10px] text-slate-400">
												Age {fact.age}
											</div>
										) : null}
									</div>
									<div className="min-w-0 flex-1 border-slate-100 border-l pl-3">
										<div className="font-medium text-slate-800 text-sm">
											{fact.title}
										</div>
										{related ? (
											<button
												type="button"
												onClick={() => onFocus(related.id)}
												className="mt-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-slate-600 text-xs hover:bg-slate-100"
											>
												<Avatar person={related} size={18} />
												<span className="truncate">{related.name}</span>
											</button>
										) : null}
										{fact.date ? (
											<div className="mt-0.5 text-slate-500 text-xs">
												{fact.date}
											</div>
										) : null}
										{fact.place ? (
											<div className="mt-0.5 flex items-start gap-1 text-slate-400 text-xs">
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

			<Section title="Immediate family" count={family.length}>
				{family.length === 0 ? (
					<p className="text-slate-400 text-sm">
						No relatives recorded. Use the + on their card to add some.
					</p>
				) : (
					<ul className="space-y-0.5">
						{family.map((relative) => (
							<RelativeRow
								key={relative.id}
								person={relative}
								label={relationLabel(graph, person, relative)}
								onFocus={onFocus}
							/>
						))}
					</ul>
				)}
			</Section>
		</aside>
	)
}
