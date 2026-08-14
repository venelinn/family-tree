import clsx from "clsx"
import styles from "./Heading.module.scss"

/**
 * Every heading in the app.
 *
 * The point of the component is that **the tag and the size are separate
 * decisions**. A document has one `<h1>` and no gaps in its outline, which is
 * what a screen reader navigates by; the visual scale is a design question and
 * frequently disagrees. `as="h2" size="h3"` says both without either one having
 * to compromise.
 *
 * No `"use client"`: there is no state or event handler here, so the component
 * inherits whichever environment imports it. From a server component it renders
 * to HTML and ships no JavaScript at all; inside a client component it is part
 * of that bundle. A directive would have forced the second case everywhere.
 */

export type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "div"
export type HeadingSize = "hero" | "h1" | "h2" | "h3" | "h4" | "h5" | "base"

export interface HeadingProps {
	/** The semantic element. Governs the document outline, not the look. */
	as?: HeadingTag
	/** The visual step. Governs the look, not the outline. */
	size?: HeadingSize
	children?: React.ReactNode
	className?: string
	uppercase?: boolean
	center?: boolean
	/**
	 * Visually hidden, still announced. For a section that reads as a heading to
	 * a screen reader but is titled by its own layout on screen.
	 */
	isHidden?: boolean
	id?: string
}

export function Heading({
	as: Tag = "h2",
	size = "h2",
	children,
	className,
	uppercase = false,
	center = false,
	isHidden = false,
	id,
}: HeadingProps) {
	return (
		<Tag
			id={id}
			className={clsx(
				styles.heading,
				styles[`heading--${size}`],
				uppercase && styles["heading--uppercase"],
				center && styles["heading--center"],
				isHidden && styles["heading--hidden"],
				className,
			)}
		>
			{children}
		</Tag>
	)
}
