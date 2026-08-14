import clsx from "clsx"
import styles from "./Callout.module.scss"

/**
 * A tinted note: a promise, a caveat, or a failure.
 *
 * `role="alert"` on the error tone only — an alert interrupts a screen reader,
 * which is right for "that didn't work" and wrong for a paragraph that was on
 * the page all along.
 */
export function Callout({
	tone = "info",
	icon,
	children,
	className,
}: {
	tone?: "info" | "warning" | "error"
	icon?: React.ReactNode
	children: React.ReactNode
	className?: string
}) {
	if (!children) return null

	return (
		<p
			role={tone === "error" ? "alert" : undefined}
			className={clsx(styles.callout, styles[`callout--${tone}`], className)}
		>
			{icon ? <span className={styles.callout__icon}>{icon}</span> : null}
			{children}
		</p>
	)
}
