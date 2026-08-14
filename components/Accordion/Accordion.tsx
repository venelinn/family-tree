import clsx from "clsx"
import { ChevronDown } from "lucide-react"
import styles from "./Accordion.module.scss"

/**
 * A collapsible section built on `<details>`.
 *
 * There is no `useState` and no `"use client"` here on purpose. The browser owns
 * the open state, so a section renders open or closed on the server and stays
 * usable before — or without — hydration. It also gets the platform's keyboard
 * handling, and find-in-page can open a closed section to reveal a match, which
 * a `hidden` div cannot.
 *
 * `defaultOpen` maps to the `open` attribute rather than to state: it is the
 * *initial* value, and the browser takes it from there.
 */
export function Accordion({
	title,
	count,
	defaultOpen = true,
	/**
	 * Groups sections so opening one closes its siblings. Left unset here — in
	 * the person panel every section is worth having open at once.
	 */
	name,
	children,
	className,
}: {
	title: string
	count?: number
	defaultOpen?: boolean
	name?: string
	children: React.ReactNode
	className?: string
}) {
	return (
		<details
			className={clsx(styles.accordion, className)}
			open={defaultOpen}
			name={name}
		>
			<summary className={styles.accordion__summary}>
				<span className={styles.accordion__title}>{title}</span>
				{count != null ? (
					<span className={styles.accordion__count}>{count}</span>
				) : null}
				<ChevronDown size={14} className={styles.accordion__chevron} />
			</summary>
			<div className={styles.accordion__content}>{children}</div>
		</details>
	)
}
