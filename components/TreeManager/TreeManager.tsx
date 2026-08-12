"use client"

import {
	Check,
	FolderInput,
	FolderSymlink,
	Plus,
	TriangleAlert,
	X,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Button } from "@/components/Button"
import { FormError, Input } from "@/components/Forms"
import { canPickFolder, pickFolder } from "@/lib/pick-folder"
import { basename, join } from "@/lib/store/path"
import type { TreeSummary } from "@/lib/store/registry"
import {
	adoptTreeAction,
	type ConvertResult,
	convertTreeAction,
	forgetTreeAction,
	relocateTreeAction,
	renameTreeAction,
	setActiveTreeAction,
} from "@/lib/tree-actions"
import styles from "./TreeManager.module.scss"

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
 *
 * A tree registered before trees became folders is offered a conversion, and
 * the result says where the previous copy still is — the operation keeps it,
 * and someone who isn't told will assume otherwise.
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
	const [converted, setConverted] = useState<ConvertResult>()

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

	const convert = (id: string) => {
		setError(undefined)
		setConverted(undefined)
		startTransition(async () => {
			const result = await convertTreeAction(id)
			if (result.ok) setConverted(result)
			else setError(result.error)
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
		<div className={styles.trees}>
			<ul className={styles.trees__list}>
				{trees.map((tree) => {
					const active = tree.id === activeId
					const editingThis = editing?.id === tree.id
					return (
						<li
							key={tree.id}
							className={styles.trees__item}
							aria-current={active || undefined}
						>
							<div className={styles.trees__row}>
								<button
									type="button"
									onClick={() => run(() => setActiveTreeAction(tree.id))}
									disabled={pending || active || !tree.available}
									className={styles.trees__choose}
								>
									<span className={styles.trees__name}>{tree.name}</span>
									<span className={styles.trees__meta}>
										{tree.available ? (
											t("treePeople", { count: tree.peopleCount })
										) : (
											<>
												<TriangleAlert size={12} strokeWidth={2} />
												{t("treeMissing")}
											</>
										)}
									</span>
									{/* Absent for a browser-stored tree: there is no path, and
									    inventing one would be worse than saying nothing. */}
									{tree.file ? (
										<code className={styles.trees__path}>{tree.file}</code>
									) : null}
								</button>

								<span className={styles.trees__check}>
									{active ? <Check size={16} strokeWidth={2.5} /> : null}
								</span>
							</div>

							<div className={styles.trees__actions}>
								<Button
									label={t("treeRename")}
									variant="ghost"
									className={styles.trees__action}
									onClick={() =>
										setEditing({ id: tree.id, field: "name", value: tree.name })
									}
								/>
								{tree.file ? (
									<Button
										label={t("treeMove")}
										variant="ghost"
										className={styles.trees__action}
										onClick={async () => {
											// Same reasoning as adopting: a destination the user
											// typed is outside the granted scope and would be
											// refused. They choose the *parent*, and the tree keeps
											// its own folder name inside it.
											if (!canPickFolder()) {
												setEditing({
													id: tree.id,
													field: "path",
													value: tree.file ?? "",
												})
												return
											}
											// Bound before the await: narrowing a property access
											// does not survive into the closure below it.
											const current = tree.file
											const folder = await pickFolder(t("treeMoveLabel"))
											if (folder && current)
												run(() =>
													relocateTreeAction(
														tree.id,
														join(folder, basename(current)),
													),
												)
										}}
									/>
								) : null}
								<Button
									label={t("treeForget")}
									variant="ghost"
									data-action="forget"
									disabled={pending || trees.length === 1}
									className={styles.trees__action}
									onClick={() => run(() => forgetTreeAction(tree.id))}
								/>
							</div>

							{tree.available && !tree.bundle ? (
								<div className={styles.trees__drawer}>
									<p className={styles.trees__drawerText}>
										{t("treeConvertHelp")}
									</p>
									<Button
										label={t("treeConvert")}
										variant="secondary"
										size="sm"
										disabled={pending}
										className={styles.trees__convert}
										icon={<FolderSymlink size={14} strokeWidth={2} />}
										onClick={() => convert(tree.id)}
									/>
								</div>
							) : null}

							{editingThis ? (
								<form
									onSubmit={(event) => {
										event.preventDefault()
										commit()
									}}
									className={styles.trees__drawer}
								>
									<div className={styles.trees__editRow}>
										<Input
											label={
												editing.field === "name"
													? t("treeRenameLabel")
													: t("treeMoveLabel")
											}
											autoFocus
											value={editing.value}
											spellCheck={false}
											data-field={editing.field}
											className={styles.trees__editField}
											onChange={(event) =>
												setEditing({ ...editing, value: event.target.value })
											}
											full
										/>
									</div>
									<div className={styles.trees__editRow}>
										<Button
											type="submit"
											label={t("treeSave")}
											variant="primary"
											disabled={pending}
											icon={<Check size={15} strokeWidth={2.5} />}
										/>
										<Button
											variant="secondary"
											aria-label={t("treeCancel")}
											icon={<X size={15} strokeWidth={2} />}
											onClick={() => setEditing(undefined)}
										/>
									</div>
								</form>
							) : null}
						</li>
					)
				})}
			</ul>

			<FormError>{error}</FormError>

			{converted ? (
				<div className={styles.trees__done}>
					<p className={styles.trees__doneTitle}>
						{t("treeConvertDone", { count: converted.photosCopied ?? 0 })}
					</p>
					{converted.photosMissing ? (
						<p className={styles.trees__doneNote}>
							{t("treeConvertMissing", { count: converted.photosMissing })}
						</p>
					) : null}
					<p className={styles.trees__doneNote}>{t("treeConvertKept")}</p>
					<code className={styles.trees__path}>{converted.previous}</code>
				</div>
			) : null}

			<form
				onSubmit={(event) => {
					event.preventDefault()
					run(() => adoptTreeAction(openPath))
				}}
				className={styles.trees__adopt}
			>
				<span className={styles.trees__adoptTitle}>{t("treeOpenTitle")}</span>
				<p className={styles.trees__adoptHelp}>{t("treeOpenHelp")}</p>
				{canPickFolder() ? (
					/**
					 * One button, no field, and it adopts as soon as a folder is
					 * chosen — the dialog *is* the confirmation, and a second click on
					 * "Open" after it would be asking twice.
					 *
					 * Typing a path cannot work here: Tauri's filesystem plugin denies
					 * anything outside a granted scope, and choosing through the native
					 * dialog is what grants it. See `lib/pick-folder.ts`.
					 */
					<Button
						label={t("treeOpen")}
						variant="secondary"
						disabled={pending}
						icon={<FolderInput size={15} strokeWidth={2} />}
						onClick={async () => {
							const folder = await pickFolder(t("treeOpenTitle"))
							if (folder) run(() => adoptTreeAction(folder))
						}}
					/>
				) : (
					<div className={styles.trees__adoptRow}>
						<Input
							label={t("treeOpenTitle")}
							value={openPath}
							onChange={(event) => setOpenPath(event.target.value)}
							placeholder={t("treeOpenPlaceholder")}
							spellCheck={false}
							autoComplete="off"
							className={styles.trees__adoptField}
							full
						/>
						<Button
							type="submit"
							label={t("treeOpen")}
							variant="secondary"
							disabled={pending || !openPath.trim()}
							icon={<FolderInput size={15} strokeWidth={2} />}
						/>
					</div>
				)}
			</form>

			<Button
				label={t("treeNew")}
				href="/welcome?new"
				variant="secondary"
				className={styles.trees__new}
				icon={<Plus size={15} strokeWidth={2} />}
			/>
		</div>
	)
}
