import clsx from "clsx"
import Link from "next/link"
import type { FormElementSize } from "@/components/Forms"
import styles from "./Button.module.scss"

/**
 * Every button and button-shaped link in the app.
 *
 * ## Which element it renders
 *
 * `href` decides, and it decides correctly: **`<Button>` for an action,
 * `<Link>` for a destination**. A `<div onClick>` is neither — it is not
 * focusable, does not fire on Enter, and is invisible to a screen reader's list
 * of controls. Passing `href` gets a real `next/link`, so the App Router
 * prefetches the route and navigates on the client; `isExternal` gets a plain
 * `<a>` with the `rel` that stops the new tab from reaching back into this one.
 *
 * ## Server and client
 *
 * No `"use client"` — deliberately. The component has no state, so it inherits
 * the environment of whatever imports it: rendered from a server component it
 * ships no JavaScript, and a navigation `<Button href>` in server-rendered
 * chrome stays free. `onClick` is what pulls it into a client bundle, and only
 * for the component that passes one, because a server component cannot pass a
 * function across the boundary at all — TypeScript rejects it at compile time
 * rather than the app failing at runtime.
 *
 * ## Icons
 *
 * `icon` takes a **node**, not a name: `icon={<Plus size={16} />}`. Resolving a
 * string through a registry would put every icon in the set into the bundle,
 * because a lookup by runtime value cannot be tree-shaken. Importing the one
 * icon at the call site keeps the cost to the icon actually used.
 */

export const BUTTON_VARIANTS = [
	"primary",
	"secondary",
	"ghost",
	"danger",
	"link",
] as const

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]
/** Shared with the form controls, so a button lines up beside an input. */
export type ButtonSize = FormElementSize

export interface ButtonProps {
	/** Visible text. Omit for an icon-only button — then `aria-label` is required. */
	label?: string
	/** Renders a `next/link` instead of a `<button>`. */
	href?: string
	/** Renders a plain `<a target="_blank">`. Requires `href`. */
	isExternal?: boolean
	type?: "button" | "submit" | "reset"
	onClick?: React.MouseEventHandler<HTMLButtonElement>
	variant?: ButtonVariant
	size?: ButtonSize
	/** Bordered rather than filled. */
	outlined?: boolean
	/** Fills the width of its container. */
	full?: boolean
	disabled?: boolean
	/** Icon node, before the label by default. */
	icon?: React.ReactNode
	/** Icon node, always after the label. */
	iconAfter?: React.ReactNode
	iconPosition?: "left" | "right"
	className?: string
	/** Required when there is no `label` — an icon has no accessible name. */
	"aria-label"?: string
	"aria-pressed"?: boolean
	"aria-expanded"?: boolean
	title?: string
	/**
	 * Data attributes pass through to the element. The styling rules make these
	 * the way a component expresses state to CSS, so the shared button has to
	 * carry them: `data-visible` on the card's add button, for one.
	 */
	[key: `data-${string}`]: unknown
}

export function Button({
	label,
	href,
	isExternal = false,
	type = "button",
	onClick,
	variant = "secondary",
	size = "md",
	outlined = false,
	full = false,
	disabled = false,
	icon,
	iconAfter,
	iconPosition = "left",
	className,
	title,
	...aria
}: ButtonProps) {
	const classes = clsx(
		styles.btn,
		styles[`btn--${variant}`],
		styles[`btn--${size}`],
		outlined && styles["btn--outlined"],
		full && styles["btn--full"],
		!label && styles["btn--icon-only"],
		className,
	)

	const content = (
		<>
			{icon && iconPosition === "left" ? (
				<span className={styles.btn__icon}>{icon}</span>
			) : null}
			{label ? <span className={styles.btn__label}>{label}</span> : null}
			{icon && iconPosition === "right" ? (
				<span className={styles.btn__icon}>{icon}</span>
			) : null}
			{iconAfter ? <span className={styles.btn__icon}>{iconAfter}</span> : null}
		</>
	)

	if (href && !disabled) {
		// External links leave the app, so they get a plain anchor: `next/link`
		// would prefetch a route that isn't ours.
		return isExternal ? (
			<a
				className={classes}
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				title={title}
				{...aria}
			>
				{content}
			</a>
		) : (
			<Link className={classes} href={href} title={title} {...aria}>
				{content}
			</Link>
		)
	}

	return (
		<button
			type={type}
			className={classes}
			onClick={onClick}
			disabled={disabled}
			title={title}
			{...aria}
		>
			{content}
		</button>
	)
}
