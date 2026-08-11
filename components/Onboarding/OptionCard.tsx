import { Check } from "lucide-react"
import type React from "react"
import { Heading } from "@/components/Heading"
import styles from "./OptionCard.module.scss"

/**
 * One choice in a step.
 *
 * Selected state matches the settings pickers on purpose: the same green means
 * "this is the one you're on" everywhere in the app. `aria-pressed` carries it,
 * so the stylesheet and the screen reader read the same source.
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
			className={styles.option}
		>
			<span className={styles.option__body}>
				{icon ? <span className={styles.option__icon}>{icon}</span> : null}
				<Heading as="h3" size="base" className={styles.option__label}>
					{label}
				</Heading>
				{description ? (
					<span className={styles.option__description}>{description}</span>
				) : null}
			</span>

			{selected ? (
				<Check size={18} strokeWidth={2.5} className={styles.option__check} />
			) : null}
		</button>
	)
}

export default OptionCard
