"use client"

import { ImagePlus, Star, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"
import { Button } from "@/components/Button"
import { FormError } from "@/components/Forms"
import {
	removePhotoAction,
	setPrimaryPhotoAction,
	uploadPhotoAction,
} from "@/lib/photo-actions"
import styles from "./PhotoDrop.module.scss"

/**
 * Photos for one person: drop a file on it, or click to browse.
 *
 * Drag-and-drop needs a counter rather than a boolean for the highlight —
 * `dragleave` fires when the pointer crosses into a *child* element, so a naive
 * flag flickers off as soon as the cursor reaches the label inside the zone.
 *
 * The first photo is the one on the card, so promoting is a real operation
 * rather than a cosmetic sort.
 */

interface PhotoDropProps {
	personId: string
	photos: string[]
	name: string
}

export function PhotoDrop({ personId, photos, name }: PhotoDropProps) {
	const t = useTranslations("photos")
	const inputRef = useRef<HTMLInputElement>(null)
	const [depth, setDepth] = useState(0)
	const [pending, startTransition] = useTransition()
	const [error, setError] = useState<string>()

	const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
		setError(undefined)
		startTransition(async () => {
			const result = await action()
			if (!result.ok) setError(result.error)
		})
	}

	const upload = (files: FileList | null) => {
		const file = files?.[0]
		if (!file) return
		const body = new FormData()
		body.set("photo", file)
		run(() => uploadPhotoAction(personId, body))
	}

	return (
		<div className={styles.photos}>
			{photos.length > 0 ? (
				<ul className={styles.photos__grid}>
					{photos.map((url, index) => (
						<li key={url} className={styles.photos__item}>
							{/* Plain <img>: these are local files of unknown dimensions and
							    the optimiser buys nothing for a 64px thumbnail. */}
							{/* biome-ignore lint/performance/noImgElement: local, unoptimised by design */}
							<img
								src={url}
								alt={t("of", { name })}
								data-primary={index === 0 || undefined}
								className={styles.photos__image}
							/>
							<div className={styles.photos__actions}>
								{index === 0 ? null : (
									<Button
										variant="secondary"
										disabled={pending}
										aria-label={t("makePrimary")}
										title={t("makePrimary")}
										data-action="promote"
										className={styles.photos__action}
										icon={<Star size={13} strokeWidth={2} />}
										onClick={() =>
											run(() => setPrimaryPhotoAction(personId, url))
										}
									/>
								)}
								<Button
									variant="secondary"
									disabled={pending}
									aria-label={t("remove")}
									title={t("remove")}
									data-action="remove"
									className={styles.photos__action}
									icon={<Trash2 size={13} strokeWidth={2} />}
									onClick={() => run(() => removePhotoAction(personId, url))}
								/>
							</div>
							{index === 0 ? (
								<span className={styles.photos__badge}>{t("primary")}</span>
							) : null}
						</li>
					))}
				</ul>
			) : null}

			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				onDragEnter={(event) => {
					event.preventDefault()
					setDepth((current) => current + 1)
				}}
				onDragOver={(event) => event.preventDefault()}
				onDragLeave={() => setDepth((current) => Math.max(0, current - 1))}
				onDrop={(event) => {
					event.preventDefault()
					setDepth(0)
					upload(event.dataTransfer.files)
				}}
				disabled={pending}
				data-over={depth > 0 || undefined}
				className={styles.photos__drop}
			>
				<ImagePlus size={18} strokeWidth={1.75} />
				<span className={styles.photos__dropLabel}>
					{pending ? t("uploading") : t("drop")}
				</span>
				<span className={styles.photos__dropHint}>{t("hint")}</span>
			</button>

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/gif"
				className={styles.photos__input}
				tabIndex={-1}
				aria-hidden
				onChange={(event) => {
					upload(event.target.files)
					// Let the same file be picked again after a removal.
					event.target.value = ""
				}}
			/>

			<FormError>{error}</FormError>
		</div>
	)
}
