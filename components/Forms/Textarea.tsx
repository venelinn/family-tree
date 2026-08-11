import clsx from "clsx"
import { useId } from "react"
import styles from "./Textarea.module.scss"

/** The multi-line sibling of `Input`, with the same label and error contract. */
export interface TextareaProps
	extends React.ComponentPropsWithoutRef<"textarea"> {
	label: string
	hint?: string
	error?: string
	full?: boolean
}

export function Textarea({
	label,
	hint,
	error,
	full = false,
	id,
	className,
	rows = 3,
	...rest
}: TextareaProps) {
	const generatedId = useId()
	const fieldId = id ?? generatedId

	return (
		<div
			className={clsx(
				styles.textarea,
				full && styles["textarea--full"],
				error && styles["textarea--invalid"],
				className,
			)}
		>
			<label htmlFor={fieldId} className={styles.textarea__label}>
				{label}
			</label>
			<textarea
				id={fieldId}
				rows={rows}
				className={styles.textarea__control}
				aria-invalid={error ? true : undefined}
				aria-describedby={error || hint ? `${fieldId}-note` : undefined}
				{...rest}
			/>
			{error ? (
				<span id={`${fieldId}-note`} className={styles.textarea__error}>
					{error}
				</span>
			) : hint ? (
				<span id={`${fieldId}-note`} className={styles.textarea__hint}>
					{hint}
				</span>
			) : null}
		</div>
	)
}
