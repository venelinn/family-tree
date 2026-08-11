import { CloudOff, FolderOpen, HardDrive, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Callout } from "@/components/Callout"
import { Input } from "@/components/Forms"
import { Heading } from "@/components/Heading"
import { previewStorageAction } from "@/lib/tree-actions"
import OptionCard from "../OptionCard"
import type { StepProps } from "../types"
import styles from "./Step.module.scss"

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
		<div className={styles.step}>
			<div className={styles.step__intro}>
				<Heading as="h1" size="h2">
					{t("storageTitle")}
				</Heading>
				<p className={styles.step__help}>{t("storageHelp")}</p>
			</div>

			<Callout icon={<CloudOff size={16} strokeWidth={2} />}>
				{t("storagePrivacy")}
			</Callout>

			<div className={styles.step__options}>
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
				<Input
					label={t("storagePathLabel")}
					value={data.customPath}
					onChange={(event) => onUpdate({ customPath: event.target.value })}
					placeholder={t("storagePathPlaceholder")}
					spellCheck={false}
					autoComplete="off"
					full
				/>
			) : null}

			<Callout tone="error">{preview.error}</Callout>

			{preview.file ? (
				<div className={styles.step__resolved}>
					<p className={styles.step__resolvedLabel}>{t("storageResolved")}</p>
					<code className={styles.step__path}>{preview.file}</code>
					{preview.cloudSynced ? (
						<Callout
							tone="warning"
							icon={<TriangleAlert size={16} strokeWidth={2} />}
						>
							{t("storageCloudWarning")}
						</Callout>
					) : null}
				</div>
			) : null}

			<Button
				label={t("continue")}
				variant="primary"
				size="lg"
				disabled={!ready}
				full
				onClick={onNext}
			/>
		</div>
	)
}

export default StorageStep
