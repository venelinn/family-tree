import clsx from "clsx"
import { Heading } from "@/components/Heading"
import styles from "./Panel.module.scss"

/**
 * A titled card: heading, one line of explanation, and whatever the section is
 * actually for.
 *
 * Exists so pages can stay what `rules/html-rules.mdc` asks them to be — data
 * fetching and composition — instead of carrying the same bordered `<section>`
 * four times over.
 */
export function Panel({
	title,
	description,
	as = "h2",
	children,
	className,
}: {
	title: string
	description?: string
	/** The heading level. The visual size never changes; the outline does. */
	as?: "h2" | "h3"
	children?: React.ReactNode
	className?: string
}) {
	return (
		<section className={clsx(styles.panel, className)}>
			<Heading as={as} size="base">
				{title}
			</Heading>
			{description ? (
				<p className={styles.panel__description}>{description}</p>
			) : null}
			{children ? <div className={styles.panel__body}>{children}</div> : null}
		</section>
	)
}
