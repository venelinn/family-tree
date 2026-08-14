import clsx from "clsx"
import styles from "./FormError.module.scss"

/**
 * Why the last submit failed.
 *
 * `role="alert"` so it is announced when it appears — the user has usually moved
 * focus to the submit button by then and would otherwise never hear it.
 */
export function FormError({
	children,
	className,
}: {
	children: React.ReactNode
	className?: string
}) {
	if (!children) return null

	return (
		<p role="alert" className={clsx(styles.formError, className)}>
			{children}
		</p>
	)
}
