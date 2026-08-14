import { Check } from "lucide-react"
import styles from "./ChoiceList.module.scss"

/**
 * A list of mutually exclusive options, one of them ticked.
 *
 * Theme, language and whether names follow the language are all the same
 * question — "one of these, please" — so they are the same control. Writing it
 * three times is how three settings drift into looking like three different
 * kinds of decision.
 *
 * Generic in the option's value, so a caller keeps its own union type
 * (`ThemePreference`, `Locale`, `boolean`) all the way through the callback.
 */
export interface Choice<T> {
	value: T
	label: string
	/** A second line under the label. */
	hint?: string
	icon?: React.ReactNode
	/** A short marker at the end of the row, e.g. a locale code. */
	badge?: string
}

export function ChoiceList<T>({
	items,
	current,
	onChoose,
	disabled = false,
}: {
	items: readonly Choice<T>[]
	current: T
	onChoose: (value: T) => void
	/** True while the write is in flight. */
	disabled?: boolean
}) {
	return (
		<ul className={styles.choices}>
			{items.map((item) => {
				const active = item.value === current
				return (
					<li key={String(item.value)} className={styles.choices__item}>
						<button
							type="button"
							onClick={() => onChoose(item.value)}
							disabled={disabled}
							aria-current={active || undefined}
							className={styles.choices__option}
						>
							{item.icon ? (
								<span className={styles.choices__icon}>{item.icon}</span>
							) : null}
							<span className={styles.choices__text}>
								<span className={styles.choices__label}>{item.label}</span>
								{item.hint ? (
									<span className={styles.choices__hint}>{item.hint}</span>
								) : null}
							</span>
							{item.badge ? (
								<span className={styles.choices__badge}>{item.badge}</span>
							) : null}
							<span className={styles.choices__check}>
								{active ? <Check size={16} strokeWidth={2.5} /> : null}
							</span>
						</button>
					</li>
				)
			})}
		</ul>
	)
}
