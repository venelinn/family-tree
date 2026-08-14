import clsx from "clsx"
import styles from "./Checkbox.module.scss"

/**
 * A checkbox and its label, as one clickable row.
 *
 * The control is nested inside the `<label>` here rather than associated by id:
 * a checkbox label is the thing you click, so the two are one target and there
 * is no id to keep in step.
 */
export interface CheckboxProps
	extends Omit<React.ComponentPropsWithoutRef<"input">, "type"> {
	label: string
}

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
	return (
		<label className={clsx(styles.checkbox, className)}>
			<input type="checkbox" className={styles.checkbox__control} {...rest} />
			{label}
		</label>
	)
}
