import clsx from "clsx"
import { useId } from "react"
import styles from "./Select.module.scss"

/**
 * A labelled `<select>`, keeping the native dropdown.
 *
 * Only the closed state is styled — the arrow is redrawn in `currentcolor` so it
 * follows the theme. The open list stays the platform's own, which is what makes
 * it usable on a phone and correct with a screen reader; a hand-built listbox
 * would have to re-earn both.
 */
export interface SelectProps
	extends Omit<React.ComponentPropsWithoutRef<"select">, "size"> {
	label: string
	hint?: string
	error?: string
	full?: boolean
	/** Renders a leading empty option, for "nothing chosen yet". */
	placeholder?: string
}

export function Select({
	label,
	hint,
	error,
	full = false,
	placeholder,
	id,
	className,
	children,
	...rest
}: SelectProps) {
	const generatedId = useId()
	const selectId = id ?? generatedId

	return (
		<div
			className={clsx(
				styles.select,
				full && styles["select--full"],
				error && styles["select--invalid"],
				className,
			)}
		>
			<label htmlFor={selectId} className={styles.select__label}>
				{label}
			</label>
			<select
				id={selectId}
				className={styles.select__control}
				aria-invalid={error ? true : undefined}
				aria-describedby={error || hint ? `${selectId}-note` : undefined}
				{...rest}
			>
				{placeholder ? <option value="">{placeholder}</option> : null}
				{children}
			</select>
			{error ? (
				<span id={`${selectId}-note`} className={styles.select__error}>
					{error}
				</span>
			) : hint ? (
				<span id={`${selectId}-note`} className={styles.select__hint}>
					{hint}
				</span>
			) : null}
		</div>
	)
}
