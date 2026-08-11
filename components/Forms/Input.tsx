import clsx from "clsx"
import { useId } from "react"
import styles from "./Input.module.scss"
import type { FormElementSize } from "./types"

/**
 * A labelled text field.
 *
 * The label is associated by `htmlFor` rather than by wrapping the control:
 * clicking the label still focuses the field, and the two can be styled
 * independently — which matters here, where the label is small caps above a
 * full-width box.
 *
 * No `"use client"`. bgmtl's equivalent calls `useFormStatus()` to disable
 * itself while a form action runs; this app drives its writes through
 * `useTransition` and an `onSubmit` handler instead, so that hook would always
 * report `false`. Forms pass `disabled` themselves, and the field stays usable
 * from a server component.
 */
export interface InputProps
	extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
	label: string
	/** Help text under the field. */
	hint?: string
	/** Replaces the hint and marks the control invalid. */
	error?: string
	/** Fills the width of its container. */
	full?: boolean
	inputSize?: FormElementSize
}

export function Input({
	label,
	hint,
	error,
	full = false,
	inputSize = "md",
	id,
	className,
	...rest
}: InputProps) {
	const generatedId = useId()
	const inputId = id ?? generatedId

	return (
		<div
			className={clsx(
				styles.input,
				styles[`input--${inputSize}`],
				full && styles["input--full"],
				error && styles["input--invalid"],
				className,
			)}
		>
			<label htmlFor={inputId} className={styles.input__label}>
				{label}
			</label>
			<input
				id={inputId}
				className={styles.input__control}
				aria-invalid={error ? true : undefined}
				aria-describedby={error || hint ? `${inputId}-note` : undefined}
				{...rest}
			/>
			{error ? (
				<span id={`${inputId}-note`} className={styles.input__error}>
					{error}
				</span>
			) : hint ? (
				<span id={`${inputId}-note`} className={styles.input__hint}>
					{hint}
				</span>
			) : null}
		</div>
	)
}
