"use client"

import { ReactFlowProvider } from "@xyflow/react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState, useTransition } from "react"
import {
	addRelativeAction,
	deletePersonAction,
	type PersonFormValues,
	updatePersonAction,
} from "@/lib/actions"
import { type Person, reviveFamilyGraph, type Union } from "@/lib/family-graph"
import { buildAddSlots } from "@/lib/layout/add-slots"
import { layoutFamily } from "@/lib/layout/family"
import { layoutPedigree } from "@/lib/layout/pedigree"
import type {
	AddSlotNodeData,
	PersonNodeData,
	SlotKey,
	ViewType,
} from "@/lib/layout/types"
import { PersonForm } from "./PersonForm"
import { PersonPanel } from "./PersonPanel"
import { Toolbar } from "./Toolbar"
import { TreeCanvas } from "./TreeCanvas"

import "@xyflow/react/dist/style.css"

interface TreeAppProps {
	graph: { people: Person[]; unions: Union[] }
	homePersonId: string
}

/** Sensible starting depth per view; each is remembered separately. */
const DEFAULT_DEPTH: Record<ViewType, number> = { family: 2, pedigree: 4 }

type Overrides = ReadonlyMap<string, boolean>

/**
 * People a single expansion may add before it displaces the other open
 * branches. Small reveals (a couple of parents) accumulate happily; big ones
 * would otherwise stack up and sprawl the chart past legibility.
 */
const EXPANSION_BUDGET = 4

export function TreeApp({ graph: serialized, homePersonId }: TreeAppProps) {
	const t = useTranslations("form")
	const tSlots = useTranslations("slots")

	const graph = useMemo(() => reviveFamilyGraph(serialized), [serialized])

	const [view, setView] = useState<ViewType>("family")
	const [rootId, setRootId] = useState(homePersonId)
	const [selectedId, setSelectedId] = useState<string | null>(homePersonId)
	const [depths, setDepths] = useState(DEFAULT_DEPTH)

	// Per-person branch overrides: true = forced open, false = forced shut,
	// absent = whatever the depth budget gives you.
	const [ancestorOverrides, setAncestorOverrides] = useState<Overrides>(
		new Map(),
	)
	const [descendantOverrides, setDescendantOverrides] = useState<Overrides>(
		new Map(),
	)

	/** What the side panel is showing: details, or a form. */
	const [editor, setEditor] = useState<
		| { mode: "edit"; personId: string }
		| {
				mode: "add"
				anchorId: string
				relation: AddSlotNodeData["relation"]
				sex: "M" | "F"
				/** Which ghost card opened this, so the form can title itself. */
				slot: SlotKey
		  }
		| null
	>(null)
	/** Whose ghost "Add …" cards are showing, opened with the + on their card. */
	const [addingFor, setAddingFor] = useState<string | null>(null)
	const [saving, startSaving] = useTransition()
	const [saveError, setSaveError] = useState<string>()

	const depth = depths[view]

	const layout = useMemo(
		() =>
			view === "family"
				? layoutFamily(graph, rootId, {
						ancestorDepth: depth,
						descendantDepth: depth,
						ancestorOverrides,
						descendantOverrides,
					})
				: layoutPedigree(graph, rootId, { generations: depth + 1 }),
		[graph, rootId, view, depth, ancestorOverrides, descendantOverrides],
	)

	/**
	 * Flip a branch open or shut.
	 *
	 * The layout already decided whether this person's relatives are drawn and
	 * published it as `expandable` / `collapsible`, so the toggle just writes the
	 * opposite of what is on screen rather than re-deriving it from the graph.
	 *
	 * Opening is measured before it is committed: a branch that brings in more
	 * than a handful of people takes over, closing whatever else the user had
	 * opened. Left to accumulate, expansions sprawl the chart sideways until
	 * nothing is legible — and the whole point of the neighbourhood is that you
	 * follow one line at a time. Deliberate collapses are always kept; only
	 * other *expansions* give way.
	 */
	const toggleBranch = useCallback(
		(personId: string, key: "ancestors" | "descendants") => {
			const node = layout.nodes.find(
				(candidate) => candidate.id === personId && candidate.type === "person",
			)
			if (!node) return

			const opening = (node.data as PersonNodeData)[key] === "expandable"
			const isAncestors = key === "ancestors"

			if (!opening) {
				const setter = isAncestors
					? setAncestorOverrides
					: setDescendantOverrides
				setter((current) => new Map(current).set(personId, false))
				return
			}

			const candidateAncestors = isAncestors
				? new Map(ancestorOverrides).set(personId, true)
				: ancestorOverrides
			const candidateDescendants = isAncestors
				? descendantOverrides
				: new Map(descendantOverrides).set(personId, true)

			const preview = layoutFamily(graph, rootId, {
				ancestorDepth: depth,
				descendantDepth: depth,
				ancestorOverrides: candidateAncestors,
				descendantOverrides: candidateDescendants,
			})

			if (preview.visibleCount - layout.visibleCount <= EXPANSION_BUDGET) {
				setAncestorOverrides(candidateAncestors)
				setDescendantOverrides(candidateDescendants)
				return
			}

			// Too big to sit alongside the others: keep the user's collapses,
			// drop their other expansions, and make this the one open branch.
			const keepCollapses = (overrides: Overrides) =>
				new Map([...overrides].filter(([, open]) => open === false))

			const nextAncestors = keepCollapses(ancestorOverrides)
			const nextDescendants = keepCollapses(descendantOverrides)
			if (isAncestors) nextAncestors.set(personId, true)
			else nextDescendants.set(personId, true)

			setAncestorOverrides(nextAncestors)
			setDescendantOverrides(nextDescendants)
		},
		[
			layout.nodes,
			layout.visibleCount,
			graph,
			rootId,
			depth,
			ancestorOverrides,
			descendantOverrides,
		],
	)

	const toggleAncestors = useCallback(
		(personId: string) => toggleBranch(personId, "ancestors"),
		[toggleBranch],
	)

	const toggleDescendants = useCallback(
		(personId: string) => toggleBranch(personId, "descendants"),
		[toggleBranch],
	)

	/**
	 * Branch state for whoever is selected, so the panel can offer show/hide.
	 * Undefined in the pedigree view and for anyone not currently drawn.
	 */
	const selectedBranches = useMemo(() => {
		if (view !== "family" || !selectedId) return undefined
		const node = layout.nodes.find(
			(candidate) => candidate.id === selectedId && candidate.type === "person",
		)
		if (!node) return undefined
		const data = node.data as PersonNodeData
		return {
			ancestors: data.ancestors,
			descendants: data.descendants,
			hiddenAncestorCount: data.hiddenAncestorCount,
			hiddenDescendantCount: data.hiddenDescendantCount,
		}
	}, [view, selectedId, layout.nodes])

	const openAdd = useCallback<NonNullable<AddSlotNodeData["onAdd"]>>(
		(anchorId, relation, sex, slot) => {
			setSaveError(undefined)
			setEditor({ mode: "add", anchorId, relation, sex, slot })
		},
		[],
	)

	// Only in the family view: the pedigree has no room for floating slots and
	// its placeholders serve the same purpose.
	const addSlots = useMemo(
		() =>
			view === "family" && !editor
				? buildAddSlots(graph, layout.nodes, addingFor, openAdd)
				: [],
		[view, editor, graph, layout.nodes, addingFor, openAdd],
	)

	const requestAdd = useCallback(
		(personId: string) =>
			setAddingFor((current) => (current === personId ? null : personId)),
		[],
	)

	const submitEditor = useCallback(
		(values: PersonFormValues) => {
			if (!editor) return
			setSaveError(undefined)
			startSaving(async () => {
				const result =
					editor.mode === "edit"
						? await updatePersonAction(editor.personId, values)
						: await addRelativeAction(editor.anchorId, editor.relation, values)

				if (!result.ok) {
					setSaveError(result.error)
					return
				}
				setEditor(null)
				setAddingFor(null)
				// Land on whoever was just created so the change is visible.
				if (result.personId) setSelectedId(result.personId)
			})
		},
		[editor],
	)

	const removeSelected = useCallback((personId: string) => {
		setSaveError(undefined)
		startSaving(async () => {
			const result = await deletePersonAction(personId)
			if (!result.ok) {
				setSaveError(result.error)
				return
			}
			setEditor(null)
			setSelectedId(null)
		})
	}, [])

	const focus = useCallback((personId: string) => {
		setRootId(personId)
		setSelectedId(personId)
		setAddingFor(null)
		// Overrides are anchored to the old root's chart; carrying them across
		// would silently reshape the new one.
		setAncestorOverrides(new Map())
		setDescendantOverrides(new Map())
	}, [])

	return (
		<div className="flex h-screen flex-col">
			<Toolbar
				view={view}
				onViewChange={setView}
				focusPerson={graph.people.get(rootId)}
				visibleCount={layout.visibleCount}
				totalCount={graph.people.size}
				depth={depth}
				onDepthChange={(next) =>
					setDepths((current) => ({ ...current, [view]: next }))
				}
				canReset={rootId !== homePersonId}
				onReset={() => focus(homePersonId)}
			/>

			<div className="flex min-h-0 flex-1">
				<div className="min-w-0 flex-1">
					{/* The provider must sit outside the component calling useReactFlow. */}
					<ReactFlowProvider>
						<TreeCanvas
							layout={layout}
							view={view}
							rootId={rootId}
							selectedId={selectedId}
							onSelect={(personId) => {
								setSelectedId(personId)
								if (personId !== addingFor) setAddingFor(null)
							}}
							addingFor={addingFor}
							{...(view === "family" ? { onRequestAdd: requestAdd } : {})}
							onToggleAncestors={toggleAncestors}
							onToggleDescendants={toggleDescendants}
							addSlots={addSlots}
						/>
					</ReactFlowProvider>
				</div>

				{editor ? (
					<aside className="w-80 shrink-0 overflow-y-auto border-slate-200 border-l bg-white">
						<PersonForm
							title={
								editor.mode === "edit" ? t("editTitle") : tSlots(editor.slot)
							}
							person={
								editor.mode === "edit"
									? graph.people.get(editor.personId)
									: undefined
							}
							lockedSex={editor.mode === "add" ? editor.sex : undefined}
							submitLabel={editor.mode === "edit" ? t("save") : t("add")}
							pending={saving}
							error={saveError}
							onSubmit={submitEditor}
							onCancel={() => {
								setEditor(null)
								setSaveError(undefined)
							}}
						/>
					</aside>
				) : (
					<PersonPanel
						graph={graph}
						person={selectedId ? graph.people.get(selectedId) : undefined}
						isRoot={selectedId === rootId}
						onClose={() => setSelectedId(null)}
						onFocus={focus}
						branches={selectedBranches}
						onToggleAncestors={toggleAncestors}
						onToggleDescendants={toggleDescendants}
						busy={saving}
						error={saveError}
						{...(view === "family" ? { onRequestAdd: requestAdd } : {})}
						onEdit={(personId) => {
							setSaveError(undefined)
							setEditor({ mode: "edit", personId })
						}}
						onDelete={removeSelected}
					/>
				)}
			</div>
		</div>
	)
}
