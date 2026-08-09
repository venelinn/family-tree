import { CloudOff, FolderOpen, HardDrive, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { previewStorageAction } from "@/lib/tree-actions"
import OptionCard from "../OptionCard"
import type { StepProps } from "../types"

/**
 * Where the tree file is kept.
 *
 * This step exists because "it's local" is not the same promise as "it's where
 * I decided". Some people want the file on an encrypted volume, or a USB stick
 * they lock in a drawer, and not on the same disk as a checked-out repository.
 *
 * The resolved absolute path is shown *before* anything is written — including
 * for the default — because a storage choice you can't see is not a choice. If
 * the path lands inside iCloud, Dropbox or OneDrive, that is called out: it is
 * allowed, it is a reasonable backup, but it means a copy leaves the machine
 * and nobody should discover that afterwards.
 */

interface StorageStepProps extends StepProps {
	defaultDir: string
}

export function StorageStep({
	data,
	onUpdate,
	onNext,
	defaultDir,
}: StorageStepProps) {
	const t = useTranslations("onboarding")
	const [preview, setPreview] = useState<{
		file?: string
		cloudSynced?: boolean
		error?: string
	}>({})

	const custom = data.storageMode === "custom"
	const path = data.customPath.trim()

	// Debounced so a half-typed path doesn't flash an error on every keystroke.
	useEffect(() => {
		if (custom && !path) {
			setPreview({})
			return
		}
		const timer = setTimeout(async () => {
			const result = await previewStorageAction(
				data.treeName,
				custom ? path : undefined,
			)
			setPreview(result)
		}, 350)
		return () => clearTimeout(timer)
	}, [custom, path, data.treeName])

	const ready = !custom || Boolean(preview.file)

	return (
		<div className="mx-auto flex max-w-xl flex-col gap-6">
			<div className="text-center">
				<h1 className="font-semibold text-2xl text-ink tracking-tight">
					{t("storageTitle")}
				</h1>
				<p className="mt-2 text-ink-muted">{t("storageHelp")}</p>
			</div>

			<p className="flex items-start gap-2.5 rounded-xl border border-root-line bg-root-soft px-4 py-3 text-root-ink text-sm">
				<CloudOff size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
				{t("storagePrivacy")}
			</p>

			<div className="grid gap-3">
				<OptionCard
					icon={<HardDrive size={20} strokeWidth={1.75} />}
					label={t("storageDefault")}
					description={t("storageDefaultHelp", { dir: defaultDir })}
					selected={!custom}
					onClick={() => onUpdate({ storageMode: "default" })}
				/>
				<OptionCard
					icon={<FolderOpen size={20} strokeWidth={1.75} />}
					label={t("storageCustom")}
					description={t("storageCustomHelp")}
					selected={custom}
					onClick={() => onUpdate({ storageMode: "custom" })}
				/>
			</div>

			{custom ? (
				<label className="flex flex-col gap-1.5">
					<span className="font-medium text-[11px] text-ink-muted uppercase tracking-wide">
						{t("storagePathLabel")}
					</span>
					<input
						value={data.customPath}
						onChange={(event) => onUpdate({ customPath: event.target.value })}
						placeholder={t("storagePathPlaceholder")}
						spellCheck={false}
						autoComplete="off"
						className="w-full rounded-xl border border-line bg-panel px-4 py-2.5 font-mono text-ink text-sm outline-none focus:border-line-strong"
					/>
				</label>
			) : null}

			{preview.error ? (
				<p className="rounded-xl bg-danger-soft px-4 py-3 text-danger-ink text-sm">
					{preview.error}
				</p>
			) : null}

			{preview.file ? (
				<div className="flex flex-col gap-2">
					<p className="text-ink-faint text-xs">{t("storageResolved")}</p>
					<code className="break-all rounded-xl bg-muted px-4 py-3 font-mono text-ink-soft text-xs">
						{preview.file}
					</code>
					{preview.cloudSynced ? (
						<p className="flex items-start gap-2.5 rounded-xl border border-branch-line bg-branch-soft px-4 py-3 text-branch-ink text-sm">
							<TriangleAlert
								size={16}
								strokeWidth={2}
								className="mt-0.5 shrink-0"
							/>
							{t("storageCloudWarning")}
						</p>
					) : null}
				</div>
			) : null}

			<button
				type="button"
				onClick={onNext}
				disabled={!ready}
				className="rounded-xl bg-invert px-4 py-3 font-medium text-on-invert hover:bg-invert-hover disabled:opacity-40"
			>
				{t("continue")}
			</button>
		</div>
	)
}

export default StorageStep
