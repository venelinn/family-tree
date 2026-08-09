"use client"

import { Pencil, Trash2 } from "lucide-react"
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
}

/**
 * Show/hide for one branch, spelled out.
 *
 * The canvas only ever advertises hidden branches; collapsing something already
 * on screen is a deliberate act, so it lives here where there is room to label
 * it properly rather than behind a hover-only icon.
 */
function BranchButton({
	state,
	hidden,
	noun,
	onToggle,
}: {
	state: BranchState
	hidden: number
	noun: "parents" | "children"
	onToggle: () => void
}) {
	if (state === "none") return null
	const expandable = state === "expandable"
	return (
		<button
			type="button"
			onClick={onToggle}
			className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-left font-medium text-slate-600 text-xs hover:bg-slate-50"
		>
			{expandable ? `Show ${hidden} hidden ${noun}` : `Hide ${noun}`}
		</button>
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

function RelationList({
	title,
	people,
	onFocus,
}: {
	title: string
	people: Person[]
	onFocus: (personId: string) => void
}) {
	if (people.length === 0) return null
	return (
		<section className="border-slate-100 border-t px-5 py-4">
			<h3 className="mb-2 font-semibold text-[11px] text-slate-400 uppercase tracking-wide">
				{title}
			</h3>
			<ul className="space-y-1">
				{people.map((person) => (
					<li key={person.id}>
						<button
							type="button"
							onClick={() => onFocus(person.id)}
							className="w-full rounded-md px-2 py-1 text-left text-slate-700 text-sm hover:bg-slate-100"
						>
							<span className="font-medium">{person.name}</span>
							{person.birthYear ? (
								<span className="ml-1.5 text-slate-400 text-xs">
									{person.birthYear}
								</span>
							) : null}
						</button>
					</li>
				))}
			</ul>
		</section>
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
}: PersonPanelProps) {
	if (!person) {
		return (
			<aside className="flex w-80 shrink-0 items-center justify-center border-slate-200 border-l bg-white p-6 text-center text-slate-400 text-sm">
				Select anyone in the tree to see their details.
			</aside>
		)
	}

	const parents = getParents(graph, person.id).sort(byBirthYear)
	const spouses = getSpouses(graph, person.id)
	const children = getChildren(graph, person.id).sort(byBirthYear)
	const siblings = getSiblings(graph, person.id).sort(byBirthYear)

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

				{!isRoot ? (
					<button
						type="button"
						onClick={() => onFocus(person.id)}
						className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 font-medium text-sm text-white hover:bg-slate-700"
					>
						Centre tree on {person.givenName ?? person.name}
					</button>
				) : (
					<p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-emerald-700 text-sm">
						Tree is centred here
					</p>
				)}
			</header>

			<section className="space-y-2 border-slate-100 border-t px-5 py-4">
				{error ? (
					<p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700 text-sm">
						{error}
					</p>
				) : null}
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => onEdit(person.id)}
						title={`Edit ${person.name}`}
						className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 text-sm hover:bg-slate-50"
					>
						<Pencil size={13} strokeWidth={2} />
						Edit
					</button>
					<button
						type="button"
						disabled={busy}
						title={`Delete ${person.name}`}
						onClick={() => {
							// Deleting a person is not undoable in the app — the only
							// safety net is the store file itself.
							if (
								window.confirm(
									`Delete ${person.name}? Their relationships will be removed too. This cannot be undone.`,
								)
							) {
								onDelete(person.id)
							}
						}}
						className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 font-medium text-rose-600 text-sm hover:bg-rose-50 disabled:opacity-50"
					>
						<Trash2 size={13} strokeWidth={2} />
						Delete
					</button>
				</div>
				<p className="text-[11px] text-slate-400">
					Use the <span className="font-semibold">+</span> on a card to add a
					relative.
				</p>
			</section>

			{branches ? (
				<section className="space-y-2 border-slate-100 border-t px-5 py-4">
					<h3 className="font-semibold text-[11px] text-slate-400 uppercase tracking-wide">
						Branches
					</h3>
					<BranchButton
						state={branches.ancestors}
						hidden={branches.hiddenAncestorCount}
						noun="parents"
						onToggle={() => onToggleAncestors(person.id)}
					/>
					<BranchButton
						state={branches.descendants}
						hidden={branches.hiddenDescendantCount}
						noun="children"
						onToggle={() => onToggleDescendants(person.id)}
					/>
				</section>
			) : null}

			<RelationList title="Parents" people={parents} onFocus={onFocus} />
			<RelationList
				title={spouses.length > 1 ? "Spouses" : "Spouse"}
				people={spouses}
				onFocus={onFocus}
			/>
			<RelationList title="Children" people={children} onFocus={onFocus} />
			<RelationList title="Siblings" people={siblings} onFocus={onFocus} />
		</aside>
	)
}
