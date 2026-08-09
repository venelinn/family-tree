import { Check } from "lucide-react"
import type React from "react"

/**
 * One choice in a step.
 *
 * Colour comes entirely from semantic tokens — `bg-root-soft`, `text-ink-muted`
 * — never from a Tailwind palette class, so the card is legible in both themes
 * without a single `dark:` variant. Selected state matches the settings pickers
 * on purpose: the same green means "this is the one you're on" everywhere.
 */

interface OptionCardProps {
	label: string
	description?: string
	selected?: boolean
	onClick: () => void
	icon?: React.ReactNode
}

export function OptionCard({
	label,
	description,
	selected,
	onClick,
	icon,
}: OptionCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={selected}
			className={`relative w-full rounded-2xl border p-5 text-left transition-colors ${
				selected
					? "border-root-line bg-root-soft"
					: "border-line bg-panel hover:border-line-strong hover:bg-wash"
			}`}
		>
			<div className="flex flex-col gap-1.5">
				{icon ? (
					<div className={selected ? "text-root-ink" : "text-ink-faint"}>
						{icon}
					</div>
				) : null}
				<h3
					className={`pr-7 font-semibold ${selected ? "text-root-ink" : "text-ink"}`}
				>
					{label}
				</h3>
				{description ? (
					<p className="text-ink-muted text-sm leading-relaxed">
						{description}
					</p>
				) : null}
			</div>

			{selected ? (
				<Check
					size={18}
					strokeWidth={2.5}
					className="absolute top-5 right-5 text-root-ink"
				/>
			) : null}
		</button>
	)
}

export default OptionCard
