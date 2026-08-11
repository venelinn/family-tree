"use client"

import { ImagePlus, Star, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"
import {
	removePhotoAction,
	setPrimaryPhotoAction,
	uploadPhotoAction,
} from "@/lib/photo-actions"

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
		<div className="flex flex-col gap-3">
			{photos.length > 0 ? (
				<ul className="grid grid-cols-3 gap-2">
					{photos.map((url, index) => (
						<li key={url} className="group relative">
							{/* Plain <img>: these are local files of unknown dimensions and
							    the optimiser buys nothing for a 64px thumbnail. */}
							{/* biome-ignore lint/performance/noImgElement: local, unoptimised by design */}
							<img
								src={url}
								alt={t("of", { name })}
								className={`aspect-square w-full rounded-lg object-cover ${
									index === 0
										? "ring-2 ring-root-ring ring-offset-1 ring-offset-panel"
										: ""
								}`}
							/>
							<div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-ribbon/60 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
								{index === 0 ? null : (
									<button
										type="button"
										disabled={pending}
										onClick={() =>
											run(() => setPrimaryPhotoAction(personId, url))
										}
										aria-label={t("makePrimary")}
										title={t("makePrimary")}
										className="rounded-md bg-panel p-1.5 text-ink-soft hover:text-branch-ink"
									>
										<Star size={13} strokeWidth={2} />
									</button>
								)}
								<button
									type="button"
									disabled={pending}
									onClick={() => run(() => removePhotoAction(personId, url))}
									aria-label={t("remove")}
									title={t("remove")}
									className="rounded-md bg-panel p-1.5 text-ink-soft hover:text-danger-text"
								>
									<Trash2 size={13} strokeWidth={2} />
								</button>
							</div>
							{index === 0 ? (
								<span className="absolute top-1 left-1 rounded bg-panel/90 px-1 font-medium text-[9px] text-root-ink uppercase">
									{t("primary")}
								</span>
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
				className={`flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors disabled:opacity-60 ${
					depth > 0
						? "border-root-line bg-root-soft text-root-ink"
						: "border-line text-ink-muted hover:border-line-strong hover:bg-wash"
				}`}
			>
				<ImagePlus size={18} strokeWidth={1.75} />
				<span className="font-medium text-sm">
					{pending ? t("uploading") : t("drop")}
				</span>
				<span className="text-ink-faint text-xs">{t("hint")}</span>
			</button>

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/gif"
				className="hidden"
				onChange={(event) => {
					upload(event.target.files)
					// Let the same file be picked again after a removal.
					event.target.value = ""
				}}
			/>

			{error ? (
				<p className="rounded-lg bg-danger-soft px-3 py-2 text-danger-ink text-sm">
					{error}
				</p>
			) : null}
		</div>
	)
}
