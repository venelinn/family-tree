"use client"

import { Check, FolderInput, Plus, TriangleAlert, X } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import type { TreeSummary } from "@/lib/store/registry"
import {
	adoptTreeAction,
	forgetTreeAction,
	relocateTreeAction,
	renameTreeAction,
	setActiveTreeAction,
} from "@/lib/tree-actions"

/**
 * Which tree you're looking at, and where each one is kept.
 *
 * Same row shape as `LanguagePicker` and `ThemePicker` — they are all "one of
 * these, please" — with the file path shown under each name, because after
 * choosing a location during onboarding the obvious next question is "so where
 * did it actually go?" and settings is where people look for the answer.
 *
 * Removing a tree unregisters it and leaves the file alone. There is no delete:
 * this data is unrecoverable and a misread dialog is not a good enough reason
 * to lose it.
 */

interface TreeManagerProps {
	trees: TreeSummary[]
	activeId?: string
}

type Editing = { id: string; field: "name" | "path"; value: string }

export function TreeManager({ trees, activeId }: TreeManagerProps) {
	const t = useTranslations("settings")
	const [pending, startTransition] = useTransition()
	const [error, setError] = useState<string>()
	const [editing, setEditing] = useState<Editing>()
	const [openPath, setOpenPath] = useState("")

	const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
		setError(undefined)
		startTransition(async () => {
			const result = await action()
			if (result.ok) {
				setEditing(undefined)
				setOpenPath("")
			} else {
				setError(result.error)
			}
		})
	}

	const commit = () => {
		if (!editing) return
		const { id, field, value } = editing
		run(() =>
			field === "name"
				? renameTreeAction(id, value)
				: relocateTreeAction(id, value),
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line">
				{trees.map((tree) => {
					const active = tree.id === activeId
					const editingThis = editing?.id === tree.id
					return (
						<li key={tree.id} className={active ? "bg-root-soft" : undefined}>
							<div className="flex items-center gap-3 px-4 py-3">
								<button
									type="button"
									onClick={() => run(() => setActiveTreeAction(tree.id))}
									disabled={pending || active || !tree.available}
									aria-current={active ? "true" : undefined}
									className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left disabled:cursor-default"
								>
									<span className="font-medium text-ink-soft text-sm">
										{tree.name}
									</span>
									<span className="flex items-center gap-1.5 text-ink-faint text-xs">
										{tree.available ? (
											t("treePeople", { count: tree.peopleCount })
										) : (
											<>
												<TriangleAlert size={12} strokeWidth={2} />
												{t("treeMissing")}
											</>
										)}
									</span>
									<code className="mt-1 block max-w-full truncate font-mono text-[11px] text-ink-ghost">
										{tree.file}
									</code>
								</button>

								{active ? (
									<Check
										size={16}
										strokeWidth={2.5}
										className="shrink-0 text-root-ink"
									/>
								) : (
									<span className="h-4 w-4 shrink-0" />
								)}
							</div>

							<div className="flex flex-wrap gap-3 px-4 pb-3 text-xs">
								<button
									type="button"
									onClick={() =>
										setEditing({
											id: tree.id,
											field: "name",
											value: tree.name,
										})
									}
									className="font-medium text-ink-muted hover:text-ink"
								>
									{t("treeRename")}
								</button>
								<button
									type="button"
									onClick={() =>
										setEditing({
											id: tree.id,
											field: "path",
											value: tree.file,
										})
									}
									className="font-medium text-ink-muted hover:text-ink"
								>
									{t("treeMove")}
								</button>
								<button
									type="button"
									onClick={() => run(() => forgetTreeAction(tree.id))}
									disabled={pending || trees.length === 1}
									className="font-medium text-ink-muted hover:text-danger-text disabled:opacity-40"
								>
									{t("treeForget")}
								</button>
							</div>

							{editingThis ? (
								<form
									onSubmit={(event) => {
										event.preventDefault()
										commit()
									}}
									className="flex flex-col gap-2 border-line-subtle border-t bg-panel px-4 py-3"
								>
									<span className="font-medium text-[11px] text-ink-muted uppercase tracking-wide">
										{editing.field === "name"
											? t("treeRenameLabel")
											: t("treeMoveLabel")}
									</span>
									<div className="flex gap-2">
										<input
											// biome-ignore lint/a11y/noAutofocus: opened by an explicit click
											autoFocus
											value={editing.value}
											spellCheck={false}
											onChange={(event) =>
												setEditing({ ...editing, value: event.target.value })
											}
											className={`flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-ink text-sm outline-none focus:border-line-strong ${
												editing.field === "path" ? "font-mono text-xs" : ""
											}`}
										/>
										<button
											type="submit"
											disabled={pending}
											className="rounded-lg bg-invert px-3 py-1.5 font-medium text-on-invert text-sm hover:bg-invert-hover disabled:opacity-50"
										>
											{t("treeSave")}
										</button>
										<button
											type="button"
											onClick={() => setEditing(undefined)}
											className="rounded-lg border border-line px-2 py-1.5 text-ink-muted hover:bg-wash"
											aria-label={t("treeCancel")}
										>
											<X size={15} strokeWidth={2} />
										</button>
									</div>
								</form>
							) : null}
						</li>
					)
				})}
			</ul>

			{error ? (
				<p className="rounded-lg bg-danger-soft px-3 py-2 text-danger-ink text-sm">
					{error}
				</p>
			) : null}

			<form
				onSubmit={(event) => {
					event.preventDefault()
					run(() => adoptTreeAction(openPath))
				}}
				className="flex flex-col gap-2 rounded-lg border border-line border-dashed p-4"
			>
				<span className="font-medium text-[11px] text-ink-muted uppercase tracking-wide">
					{t("treeOpenTitle")}
				</span>
				<p className="text-ink-muted text-xs">{t("treeOpenHelp")}</p>
				<div className="mt-1 flex gap-2">
					<input
						value={openPath}
						onChange={(event) => setOpenPath(event.target.value)}
						placeholder={t("treeOpenPlaceholder")}
						spellCheck={false}
						autoComplete="off"
						className="flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 font-mono text-ink text-xs outline-none focus:border-line-strong"
					/>
					<button
						type="submit"
						disabled={pending || !openPath.trim()}
						className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft text-sm hover:bg-wash disabled:opacity-40"
					>
						<FolderInput size={15} strokeWidth={2} />
						{t("treeOpen")}
					</button>
				</div>
			</form>

			<Link
				href="/welcome?new"
				className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 font-medium text-ink-soft text-sm hover:bg-wash"
			>
				<Plus size={15} strokeWidth={2} />
				{t("treeNew")}
			</Link>
		</div>
	)
}
